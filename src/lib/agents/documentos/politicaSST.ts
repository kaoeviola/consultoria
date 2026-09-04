import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

type GerarPoliticaSSTInput = {
  empresa: unknown
  perfilOperacional: unknown
  contextoCompleto: string
  docProjetoId?: string
}

export async function gerarPoliticaSST({
  empresa,
  perfilOperacional,
  contextoCompleto,
  docProjetoId,
}: GerarPoliticaSSTInput) {
  const systemPrompt = [
    montarPromptBaseDoContexto('sst', contextoCompleto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'ATENCAO: Antes de citar qualquer norma neste documento, releia as secoes "TERMOS PROIBIDOS" e "FRASES OBRIGATORIAS" do prompt base. Use apenas as formulacoes da lista de FRASES OBRIGATORIAS. Qualquer outra descricao de NR-1, NR-9, CONAMA 430, Lei 12.305 ou NBR 10.004 sera considerada erro tecnico grave.',
    '',
    'Voce e auditor lider ISO 45001:2018 e especialista senior em SST.',
    'Gere Politica de SST em markdown, especifica para a empresa e baseada em riscos reais.',
    'A politica deve citar ISO 45001:2018 clausula 5.2, consulta e participacao de trabalhadores, prevencao de lesoes e agravos, atendimento a requisitos legais e melhoria continua.',
    'Mencione riscos reais do perfil operacional e responsabilidades da alta direcao.',
    'Por ser uma politica, NAO liste NRs especificas. Use a expressao generica "requisitos legais e outros requisitos aplicaveis de SST".',
    'Se for indispensavel citar NR-1, use exatamente: "NR-1 - Disposicoes gerais e gerenciamento de riscos ocupacionais".',
    'Nao use linguagem comercial generica.',
  ].join('\n')

  const userPrompt = [
    'Empresa:',
    JSON.stringify(empresa, null, 2),
    '',
    'Perfil operacional:',
    JSON.stringify(perfilOperacional, null, 2),
    '',
    'Contexto completo:',
    contextoCompleto,
  ].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, maxTokens: 3500 },
  )

  return {
    conteudo: String(resultado),
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'politicaSST',
    },
  }
}
