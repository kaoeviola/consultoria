import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarProcedimentoAuditoriaInterna(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('gestao', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e auditor lider em ISO 14001, ISO 45001 e sistemas de gestao integrados.',
    'Gere Procedimento de Auditoria Interna em markdown, especifico para a empresa.',
    'Estrutura obrigatoria: Objetivo, Escopo, Referencias, Frequencia, Criterios de independencia, Equipe auditora, Planejamento, Execucao, Relatorio, Tratamento de nao conformidades, Acompanhamento de acoes e Registros.',
    'Inclua criterios gerais para auditoria ambiental, SST, requisitos legais e homologacao de fornecedores quando aplicavel, sempre em nivel de sistema de gestao.',
    'NAO transforme este procedimento em matriz legal, procedimento operacional, inventario de riscos ou plano ambiental tecnico.',
    'NAO cite detalhes tecnicos especificos como efluentes, residuos classe I, fumos metalicos, ruido ocupacional ou controles de processo.',
    'NAO cite legislacao ambiental operacional especifica como CONAMA 430, CONAMA 357, Lei 12.305, Lei 6.938 ou NBR 10.004.',
    'Quando precisar mencionar requisitos legais, use a expressao generica "requisitos legais e outros requisitos aplicaveis" sem listar normas tecnicas ou leis setoriais.',
    'Como este documento e de gestao, NAO cite NRs especificas como NR-1, NR-9 ou NR-12. Use somente referencia generica a requisitos de SST quando necessario.',
    'Use linguagem tecnica, sem promessas comerciais. Documento com 800 a 1500 palavras.',
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
    metadados: { raciocinioIA: raciocinio, agente: 'procedimentoAuditoriaInterna' },
  }
}
