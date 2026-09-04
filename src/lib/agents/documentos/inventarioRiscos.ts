import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarInventarioRiscos(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('sst', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e especialista em SST, PGR, higiene ocupacional e NRs brasileiras.',
    'Gere Inventario de Riscos Ocupacionais em markdown, especifico e auditavel.',
    'Use apenas os processos declarados na anamnese como origem das atividades. Nao acrescente Caldeiraria, Tratamento Superficial, Logistica ou outros processos se nao estiverem declarados.',
    'Para cada processo, identifique perigos, avalie riscos, classifique por GHE quando houver dados suficientes e indique medidas de controle pela hierarquia: eliminacao, substituicao, engenharia, administrativo e EPI.',
    'Referencie NRs especificas por tipo de risco somente quando forem SST e aplicaveis ao processo declarado.',
    'Use tabelas markdown e use "A definir" quando faltar funcao, cargo, medicao ou responsavel.',
  ].join('\n')
  const userPrompt = [
    'Gere um Inventario de Riscos Ocupacionais.',
    '',
    'Contexto completo:',
    contexto,
  ].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, maxTokens: 4000, model: 'gpt-4o-mini', temperature: 0.3 },
  )

  return {
    conteudo: String(resultado),
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'inventarioRiscos',
    },
  }
}
