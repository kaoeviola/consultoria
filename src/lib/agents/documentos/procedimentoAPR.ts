import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarProcedimentoAPR(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('sst', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e especialista senior em SST e gestao de riscos ocupacionais.',
    'Gere Procedimento de Analise Preliminar de Risco (APR) em markdown, adaptado ao setor real da empresa.',
    'Estrutura obrigatoria: Objetivo, Escopo, Referencias legais, Responsabilidades, Quando aplicar APR, Metodologia, Formulario APR, Aprovacao e Registros.',
    'A tabela de APR deve conter: Identificacao da tarefa, Etapas, Perigos por etapa, Riscos, Controles existentes, Controles adicionais, Responsavel, Aprovacao.',
    'Cite NR-01, NR-06, NR-12, NR-17, NR-18, NR-33 ou NR-35 somente quando aplicavel ao contexto.',
    'Nao invente dados ausentes; marque como precisa validacao.',
    'Documento com 800 a 1500 palavras, linguagem tecnica auditavel.',
  ].join('\n')
  const userPrompt = ['Contexto completo:', contexto].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 3500 },
  )

  return {
    conteudo: String(resultado),
    metadados: { raciocinioIA: raciocinio, agente: 'procedimentoAPR' },
  }
}
