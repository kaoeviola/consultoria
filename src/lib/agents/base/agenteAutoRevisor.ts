import { z } from 'zod'
import { openai } from '@/lib/openai'

const itemTextoSchema = z.union([
  z.string(),
  z.object({}).passthrough().transform((obj) => JSON.stringify(obj)),
])

const avaliacaoSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  problemas: z.array(itemTextoSchema).default([]),
  melhorias: z.array(itemTextoSchema).default([]),
})

export type ResultadoAutoRevisao = {
  documento: string
  score: number
  revisoes: {
    iteracao: number
    score: number
    problemas: string[]
    melhorias: string[]
  }[]
}

export async function gerarComAutoRevisao(
  prompt: string,
  contexto: string,
  criterios: string[],
): Promise<ResultadoAutoRevisao> {
  let documento = await gerarDocumento(prompt, contexto)
  const revisoes: ResultadoAutoRevisao['revisoes'] = []

  for (let iteracao = 1; iteracao <= 3; iteracao += 1) {
    const avaliacao = await avaliarDocumento(documento, contexto, criterios)
    revisoes.push({
      iteracao,
      score: avaliacao.score,
      problemas: avaliacao.problemas,
      melhorias: avaliacao.melhorias,
    })

    if (avaliacao.score >= 75 || iteracao === 3) {
      return {
        documento,
        score: avaliacao.score,
        revisoes,
      }
    }

    documento = await refinarDocumento(documento, contexto, criterios, avaliacao)
  }

  return {
    documento,
    score: revisoes.at(-1)?.score || 0,
    revisoes,
  }
}

async function gerarDocumento(prompt: string, contexto: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 3500,
    messages: [
      {
        role: 'system',
        content:
          'Você é consultor técnico sênior em ISO 14001, ISO 45001, SST e gestão ambiental. Gere documentos específicos, auditáveis e em markdown.',
      },
      {
        role: 'user',
        content: [prompt, '', 'Contexto:', contexto].join('\n'),
      },
    ],
  })

  const content = completion.choices[0]?.message.content

  if (!content) {
    throw new Error('A OpenAI não retornou documento para auto-revisão.')
  }

  return content
}

async function avaliarDocumento(
  documento: string,
  contexto: string,
  criterios: string[],
) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você é auditor técnico rigoroso. Avalie o documento contra os critérios e retorne apenas JSON válido com score, problemas e melhorias.',
      },
      {
        role: 'user',
        content: [
          'Critérios:',
          criterios.map((criterio) => `- ${criterio}`).join('\n'),
          '',
          'Contexto:',
          contexto,
          '',
          'Documento:',
          documento,
        ].join('\n'),
      },
    ],
  })

  const content = completion.choices[0]?.message.content

  if (!content) {
    throw new Error('A OpenAI não retornou avaliação da auto-revisão.')
  }

  return avaliacaoSchema.parse(JSON.parse(content))
}

async function refinarDocumento(
  documento: string,
  contexto: string,
  criterios: string[],
  avaliacao: z.infer<typeof avaliacaoSchema>,
) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 3500,
    messages: [
      {
        role: 'system',
        content:
          'Você é consultor técnico sênior. Refine o documento mantendo markdown, corrigindo problemas técnicos e sem inventar dados ausentes.',
      },
      {
        role: 'user',
        content: [
          'Critérios:',
          criterios.map((criterio) => `- ${criterio}`).join('\n'),
          '',
          'Problemas encontrados:',
          avaliacao.problemas.map((problema) => `- ${problema}`).join('\n'),
          '',
          'Melhorias sugeridas:',
          avaliacao.melhorias.map((melhoria) => `- ${melhoria}`).join('\n'),
          '',
          'Contexto:',
          contexto,
          '',
          'Documento atual:',
          documento,
          '',
          'Retorne apenas o documento refinado em markdown.',
        ].join('\n'),
      },
    ],
  })

  const content = completion.choices[0]?.message.content

  if (!content) {
    throw new Error('A OpenAI não retornou documento refinado.')
  }

  return content
}
