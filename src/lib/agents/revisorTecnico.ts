import { z } from 'zod'
import { openai } from '@/lib/openai'

type EmpresaInput = {
  nome: string
  setor: string | null
  cnae: string | null
}

const itemTextoSchema = z.union([
  z.string(),
  z.object({}).passthrough().transform((obj) => JSON.stringify(obj)),
])

const revisaoSchema = z.object({
  aprovado: z.boolean(),
  score: z.coerce.number().min(0).max(100),
  problemas: z.array(itemTextoSchema).default([]),
  sugestoes: z.array(itemTextoSchema).default([]),
  alertas_legais: z.array(itemTextoSchema).default([]),
})

export type ResultadoRevisao = z.infer<typeof revisaoSchema>

export async function revisarDocumento(
  conteudo: string,
  empresa: EmpresaInput,
  perfilOperacional: unknown,
  tipoDocumento: string,
): Promise<ResultadoRevisao> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'Voce e auditor tecnico especialista em ISO 14001, ISO 45001 e SST. Revise o documento e identifique: texto generico sem referencia a empresa real, afirmacoes sem evidencia, riscos juridicos, contradicoes, linguagem fraca, dados ausentes. Seja criterioso.',
          '',
          'Retorne APENAS JSON valido neste formato EXATO:',
          '{',
          '  "aprovado": true,',
          '  "score": 0,',
          '  "problemas": ["problema 1 como texto", "problema 2 como texto"],',
          '  "sugestoes": ["sugestao 1 como texto", "sugestao 2 como texto"],',
          '  "alertas_legais": ["alerta 1 como texto"]',
          '}',
          '',
          'IMPORTANTE: problemas, sugestoes e alertas_legais devem ser arrays de STRINGS simples, NUNCA arrays de objetos. Cada item e uma frase curta descrevendo o problema/sugestao/alerta.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          'Retorne APENAS JSON valido com as chaves: aprovado, score, problemas, sugestoes, alertas_legais.',
          `Empresa: ${empresa.nome}`,
          `Setor: ${empresa.setor || 'nao informado'}`,
          `CNAE: ${empresa.cnae || 'nao informado'}`,
          `Tipo de documento: ${tipoDocumento}`,
          `Perfil operacional: ${JSON.stringify(perfilOperacional || {})}`,
          '',
          'Documento para revisao:',
          conteudo,
        ].join('\n'),
      },
    ],
  })

  const content = completion.choices[0]?.message.content

  if (!content) {
    throw new Error('A OpenAI nao retornou conteudo para a revisao tecnica.')
  }

  return revisaoSchema.parse(JSON.parse(content))
}
