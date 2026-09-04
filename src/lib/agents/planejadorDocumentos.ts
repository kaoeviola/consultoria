import { z } from 'zod'
import { openai } from '@/lib/openai'

const documentoPlanejadoSchema = z.object({
  nome: z.string(),
  tipo: z.string(),
  prioridade: z.coerce.number().int().min(1).max(5),
  motivo: z.string(),
  dependencias: z.array(z.string()),
  requisitosOrigem: z.array(z.string()).default([]),
})

const planoSchema = z.object({
  documentos_gerar_agora: z.array(documentoPlanejadoSchema),
  documentos_gerar_depois: z.array(documentoPlanejadoSchema),
  documentos_solicitar_cliente: z.array(documentoPlanejadoSchema),
  documentos_urgentes: z.array(documentoPlanejadoSchema),
})

export type PlanoDocumentos = z.infer<typeof planoSchema>

export async function planejarDocumentos(
  projeto: unknown,
  gapAnalysis: unknown,
  ontologia: unknown,
): Promise<PlanoDocumentos> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você é consultor sênior em ISO 14001, ISO 45001, SST e requisitos legais brasileiros. Planeje documentos a partir de gaps reais, documentos obrigatórios do setor e evidências disponíveis. Retorne apenas JSON válido, sem texto fora do JSON.',
      },
      {
        role: 'user',
        content: [
          'Classifique os documentos em:',
          'documentos_gerar_agora: geráveis por IA com dados suficientes.',
          'documentos_gerar_depois: geráveis por IA, mas dependem de dados ausentes.',
          'documentos_solicitar_cliente: exigíveis do cliente, não geráveis pela IA.',
          'documentos_urgentes: legais vencidos, ausentes ou críticos.',
          '',
          'Planeje documentos para TODOS os gaps identificados, nÃ£o apenas os crÃ­ticos.',
          'Inclua tambÃ©m documentos tÃ­picos e obrigatÃ³rios do setor quando eles aparecerem na ontologia.',
          'Para metalurgia, considere especialmente: PolÃ­tica Ambiental, PolÃ­tica SST, Matriz de Aspectos e Impactos, InventÃ¡rio de Riscos, PGR, PCMSO, Plano de EmergÃªncia, PGRS, Procedimento de Controle de ResÃ­duos, Matriz de Treinamentos, Plano de AÃ§Ã£o, InventÃ¡rio de Produtos QuÃ­micos, Procedimento de GestÃ£o de FISPQ.',
          'Para quÃ­mico, inclua tambÃ©m: Plano de Atendimento a EmergÃªncia QuÃ­mica, InventÃ¡rio de SubstÃ¢ncias Perigosas, Procedimento de Armazenamento QuÃ­mico.',
          '',
          'Cada item deve ter: nome, tipo, prioridade (1-5), motivo, dependencias, requisitosOrigem.',
          'Use requisitosOrigem com os IDs dos requisitos que originaram o documento quando existirem.',
          '',
          'Dados:',
          JSON.stringify({ projeto, gapAnalysis, ontologia }, null, 2),
        ].join('\n'),
      },
    ],
  })

  const content = completion.choices[0]?.message.content

  if (!content) {
    throw new Error('A OpenAI não retornou plano de documentos.')
  }

  return planoSchema.parse(JSON.parse(content))
}
