import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarProcedimentoControleOperacionalAmbiental(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('ambiental', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e auditor ambiental senior em ISO 14001:2015, controle operacional ambiental e processos industriais.',
    'Gere Procedimento de Controle Operacional Ambiental em markdown, especifico para os processos declarados na anamnese.',
    'Estrutura obrigatoria: Objetivo, Escopo, Referencias ambientais, Responsabilidades, Controles por processo, Monitoramento, Registros, Tratamento de desvios, Revisao e Aprovacao.',
    'Para cada processo declarado, descreva: aspecto ambiental controlado, impacto potencial, controle operacional, frequencia de verificacao, registro gerado e responsavel.',
    'Use somente referencias ambientais: ISO 14001:2015, Lei 12.305/2010, Lei 6.938/1981, CONAMA ambiental pertinente e ABNT NBR 10.004/10.007 quando aplicavel.',
    'Se a anamnese usa "Expedicao", mantenha exatamente "Expedicao". Nao substitua por Logistica.',
    'Cite CONAMA 430 apenas se tratar de efluentes. Nao cite CONAMA 430 para residuos ou classificacao.',
    'Se citar Lei 6.938, use exatamente a descricao: Politica Nacional do Meio Ambiente.',
    'Nao cite NRs de SST. Nao transforme este documento em PGR, APR, matriz de treinamentos ou procedimento de seguranca do trabalho.',
    'Quando faltar dado operacional, use "A definir" diretamente. Documento com 800 a 1500 palavras, linguagem tecnica e auditavel.',
  ].join('\n')
  const userPrompt = [
    'Gere um Procedimento de Controle Operacional Ambiental.',
    'Use somente os processos reais declarados e os aspectos ambientais identificados no contexto documental.',
    '',
    'Contexto completo:',
    contexto,
  ].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 3500 },
  )

  return {
    conteudo: String(resultado),
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'procedimentoControleOperacionalAmbiental',
    },
  }
}
