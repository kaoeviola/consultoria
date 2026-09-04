import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { openai } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

type ExecutarComRaciocinioOptions = {
  docProjetoId?: string
  maxTokens?: number
  model?: 'gpt-4o' | 'gpt-4o-mini'
  temperature?: number
}

export type ResultadoComRaciocinio<T> = {
  resultado: T
  raciocinio: string
}

export async function executarComRaciocinio<T>(
  systemPrompt: string,
  userPrompt: string,
  schema?: z.ZodType<T>,
  options: ExecutarComRaciocinioOptions = {},
): Promise<ResultadoComRaciocinio<T | string>> {
  const analise = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    max_tokens: 1600,
    temperature: options.temperature,
    messages: [
      {
        role: 'system',
        content: [
          systemPrompt,
          'Produza uma análise técnica estruturada para auditoria. Liste fatos conhecidos, dados faltantes, riscos técnicos/jurídicos para esta empresa específica e abordagem de geração. Não gere o documento final ainda.',
        ].join('\n\n'),
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  })

  const raciocinio =
    analise.choices[0]?.message.content ||
    'A IA não retornou análise técnica preliminar.'

  const final = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    max_tokens: options.maxTokens || 3500,
    temperature: options.temperature,
    response_format: schema ? { type: 'json_object' } : undefined,
    messages: [
      {
        role: 'system',
        content: [
          systemPrompt,
          'NUNCA envolva sua resposta em blocos de codigo markdown. Retorne markdown puro direto, sem markdown no inicio nem ``` no fim.',
        ].join('\n\n'),
      },
      {
        role: 'user',
        content: [
          'Use a análise técnica abaixo como contexto de auditoria, mas retorne apenas o documento final solicitado.',
          '',
          'Análise técnica preliminar:',
          raciocinio,
          '',
          'Solicitação original:',
          userPrompt,
        ].join('\n'),
      },
    ],
  })

  const content = final.choices[0]?.message.content

  if (!content) {
    throw new Error('A OpenAI não retornou conteúdo final.')
  }

  const resultado = schema ? schema.parse(JSON.parse(content)) : content

  if (options.docProjetoId) {
    await prisma.docProjeto.update({
      where: { id: options.docProjetoId },
      data: {
        metadados: {
          raciocinioIA: raciocinio,
          atualizadoEm: new Date().toISOString(),
        } satisfies Prisma.InputJsonObject,
      },
    })
  }

  return {
    resultado,
    raciocinio,
  }
}
