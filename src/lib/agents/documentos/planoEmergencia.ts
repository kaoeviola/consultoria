import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { gerarComAutoRevisao } from '@/lib/agents/base/agenteAutoRevisor'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarPlanoEmergencia(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('sst', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'ATENCAO: Antes de citar qualquer norma neste documento, releia as secoes "TERMOS PROIBIDOS" e "FRASES OBRIGATORIAS" do prompt base. Use apenas as formulacoes da lista de FRASES OBRIGATORIAS. Qualquer outra descricao de NR-9, CONAMA 430, Lei 12.305 ou NBR 10.004 sera considerada erro tecnico grave.',
    '',
    'Voce e especialista senior em resposta a emergencias industriais, SST e gestao ambiental.',
    'Gere Plano de Atendimento a Emergencias (PAE) em markdown, especifico para o setor e processos reais da empresa.',
    'Estrutura obrigatoria: Objetivo, Escopo, Referencias, Cenarios de emergencia, Classificacao de emergencia, Sistema de alarme, Brigada, Rotas de fuga, Pontos de encontro, Comunicacao externa, Recursos, Treinamentos, Simulados, Registros e Revisao.',
    'Para cada cenario, trazer: descricao, causas provaveis, impactos, procedimento de resposta, recursos necessarios, responsaveis, comunicacao, isolamento, controle, registro e retorno a normalidade.',
    'Cite NR-23, requisitos de bombeiros, ISO 14001/45001 e normas aplicaveis quando pertinente.',
    'Nao invente layout ou brigada existente; se nao houver evidencia, marque precisa validacao. Documento com 800 a 1500 palavras.',
  ].join('\n')
  const userPrompt = [
    'Gere um Plano de Emergencia em markdown.',
    'Use produtos quimicos, processos, layout se disponivel, brigada existente, recursos disponiveis e dados extraidos dos arquivos.',
    '',
    'Contexto completo:',
    contexto,
  ].join('\n')

  const { raciocinio } = await executarComRaciocinio(systemPrompt, userPrompt, undefined, {
    docProjetoId,
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 3500,
  })
  const revisao = await gerarComAutoRevisao([systemPrompt, '', userPrompt].join('\n'), contexto, [
    'Tem cenarios especificos do setor e dos processos?',
    'Tem responsaveis nominais ou papeis claramente definidos?',
    'Tem recursos listados?',
    'Tem fluxo de acionamento e comunicacao?',
  ])

  return {
    conteudo: revisao.documento,
    metadados: {
      raciocinioIA: raciocinio,
      autoRevisao: revisao,
      agente: 'planoEmergencia',
    },
  }
}
