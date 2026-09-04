import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

const REQUISITOS_LEGAIS_OBRIGATORIOS = [
  {
    codigo: 'CONAMA 237/1997',
    nome: 'Critérios e procedimentos para licenciamento ambiental',
    orgao: 'CONAMA',
  },
  {
    codigo: 'Lei 6.938/1981',
    nome: 'Política Nacional do Meio Ambiente',
    orgao: 'Governo Federal',
  },
  {
    codigo: 'Lei 12.305/2010',
    nome: 'Política Nacional de Resíduos Sólidos (PNRS)',
    orgao: 'Governo Federal',
  },
  {
    codigo: 'Decreto 7.404/2010',
    nome: 'Regulamenta a Política Nacional de Resíduos Sólidos',
    orgao: 'Governo Federal',
  },
  {
    codigo: 'Lei 9.605/1998',
    nome: 'Lei de Crimes Ambientais',
    orgao: 'Governo Federal',
  },
  {
    codigo: 'NBR 10.004:2004',
    nome: 'Classificação de resíduos sólidos quanto à periculosidade',
    orgao: 'ABNT',
  },
  {
    codigo: 'NBR 10.007:2004',
    nome: 'Amostragem de resíduos sólidos',
    orgao: 'ABNT',
  },
  {
    codigo: 'CONAMA 357/2005',
    nome: 'Classificação de águas e padrões de lançamento',
    orgao: 'CONAMA',
  },
  {
    codigo: 'CONAMA 430/2011',
    nome: 'Padrões de lançamento de efluentes',
    orgao: 'CONAMA',
  },
  {
    codigo: 'CONAMA 313/2002',
    nome: 'Inventário Nacional de Resíduos Sólidos Industriais',
    orgao: 'CONAMA',
  },
  {
    codigo: 'Lei Estadual SP 997/1976',
    nome: 'Controle da poluição no Estado de São Paulo',
    orgao: 'Estado de São Paulo',
  },
  {
    codigo: 'Decreto SP 8.468/1976',
    nome: 'Regulamenta a Lei Estadual SP 997/1976',
    orgao: 'Estado de São Paulo',
  },
  {
    codigo: 'Decisão de Diretoria CETESB 38/2017',
    nome: 'Procedimentos de licenciamento ambiental no Estado de São Paulo',
    orgao: 'CETESB',
  },
]

export async function gerarMatrizRequisitosLegais(contexto: string, docProjetoId?: string) {
  const enriquecimentoObrigatorio = [
    '## CONTEUDO OBRIGATORIO DESTA MATRIZ',
    '',
    'A Matriz de Requisitos Legais Ambientais deve incluir, no minimo, TODAS as seguintes leis e normas. Nao resuma esta lista. Nao substitua por normas de SST. Crie uma linha de tabela para cada item:',
    '',
    'Federais:',
    '- CONAMA 237/1997 - Criterios e procedimentos para licenciamento ambiental (critico se empresa nao tem licenca)',
    '- Lei 6.938/1981 - Politica Nacional do Meio Ambiente',
    '- Lei 12.305/2010 - Politica Nacional de Residuos Solidos (PNRS)',
    '- Decreto 7.404/2010 - Regulamenta a Politica Nacional de Residuos Solidos',
    '- Lei 9.605/1998 - Lei de Crimes Ambientais',
    '- NBR 10.004:2004 - Classificacao de residuos solidos quanto a periculosidade',
    '- NBR 10.007:2004 - Amostragem de residuos solidos',
    '- CONAMA 357/2005 - Classificacao de aguas e padroes de lancamento',
    '- CONAMA 430/2011 - Padroes de lancamento de efluentes',
    '- CONAMA 313/2002 - Inventario Nacional de Residuos Solidos Industriais',
    '',
    'Estaduais obrigatorias quando a empresa estiver em SP:',
    '- Lei Estadual SP 997/1976 - Controle da poluicao no Estado de Sao Paulo',
    '- Decreto SP 8.468/1976 - Regulamenta a Lei Estadual SP 997/76',
    '- Decisao de Diretoria CETESB 38/2017 - Procedimentos de licenciamento ambiental no Estado de Sao Paulo',
    '',
    'Para cada lei listada, preencher: Status de Atendimento (Atende / Atende Parcialmente / Nao Atende), Evidencia (documento, laudo, registro), Responsavel pelo monitoramento e proxima revisao.',
  ].join('\n')
  const systemPrompt = [
    montarPromptBaseDoContexto('ambiental', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    enriquecimentoObrigatorio,
    '',
    'Voce e auditor ambiental senior especialista em ISO 14001:2015 clausula 6.1.3 e requisitos legais ambientais brasileiros.',
    'Gere uma Matriz de Requisitos Legais Ambientais em markdown, especifica para a empresa e seu setor.',
    'NUNCA envolva sua resposta em blocos de codigo markdown. Retorne markdown puro direto, sem markdown no inicio nem ``` no fim.',
    'Este documento NAO e Matriz de Aspectos e Impactos. Nao avalie significancia P x G.',
    '',
    'ESCOPO ESTRITO: Esta e uma Matriz de Requisitos LEGAIS AMBIENTAIS.',
    '- Liste APENAS legislacao ambiental: leis federais (Lei 6.938/1981, Lei 12.305/2010, Lei 9.605/1998), decretos (Decreto 7.404/2010 quando aplicavel), Resolucoes CONAMA (237/1997 licenciamento, 357/2005 agua, 430/2011 efluentes), normas ABNT ambientais (ABNT NBR 10004 classificacao de residuos, ABNT NBR 10007 amostragem), legislacao estadual de SP (Lei 997/1976, Decreto 8.468/1976, Decisoes de Diretoria CETESB), legislacao municipal aplicavel.',
    '- NUNCA inclua NBR ISO 45001. Ela e norma de SST e pertence a matriz de requisitos SST, nao ambiental.',
    '- NUNCA liste NRs (NR-1 a NR-37), exceto NR-25 somente quando o tema for residuos industriais e sem ampliar para SST.',
    '- NUNCA inclua leis previdenciarias ou trabalhistas como Lei 8.213 ou Decreto 3.048.',
    '- NUNCA invente descricoes de normas. Se nao souber a descricao exata, use apenas o nome oficial sem complemento.',
    '',
    'ESTRUTURA OBRIGATORIA EXCLUSIVA - nao inclua outras secoes:',
    '1. Cabecalho de identificacao da empresa',
    '2. Escopo da matriz e metodologia',
    '3. Tabela de Requisitos Legais Aplicaveis',
    '4. Conclusao / Observacoes sobre conformidade legal especifica',
    '',
    'A tabela deve ter exatamente estas colunas: Codigo, Nome, Órgão Emissor, Descricao, Aplicabilidade, Status de Atendimento, Evidencia, Responsavel.',
    '',
    'NAO inclua: gaps, Gaps do Projeto, diagnosticos, inventarios ocupacionais, perigos SST, riscos juridicos gerais, dados faltantes, riscos tecnicos, plano de acao ou secoes de inventario de riscos.',
    'Esses conteudos pertencem ao Diagnostico Inicial e ao Gap Analysis, nao a esta matriz.',
    'Quando nao houver evidencia, use "A definir" no campo Evidencia de atendimento. Documento com 800 a 1500 palavras.',
  ].join('\n')
  const userPrompt = ['Contexto completo:', contexto].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 6500 },
  )
  const conteudo = garantirRequisitosObrigatorios(limparEscopoAmbiental(String(resultado)))

  return {
    conteudo,
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'matrizRequisitosLegais',
    },
  }
}

function limparEscopoAmbiental(conteudo: string) {
  return removerSecoesProibidas(conteudo)
    .split('\n')
    .filter((linha) => !/(^|[^A-Z0-9])NR[-\s]?\d{1,2}([^0-9]|$)/i.test(linha))
    .filter((linha) => !/NBR\s*ISO\s*45001|ISO\s*45001/i.test(linha))
    .filter((linha) => !/Lei\s*8\.213|Decreto\s*3\.048/i.test(linha))
    .map((linha) => linha.replace(/\blogistica reversa\b/gi, 'sistema de retorno pos-consumo'))
    .map((linha) => linha.replace(/\bOrgao\b/g, 'Órgão'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function removerSecoesProibidas(conteudo: string) {
  const proibidas = [
    'gaps do projeto',
    'inventario de riscos',
    'dados faltantes',
    'perfil operacional',
    'riscos de sst',
    'perigos sst',
    'riscos juridicos',
    'diagnostico',
  ]
  const linhas = conteudo.split('\n')
  const resultado: string[] = []
  let removendoNivel: number | null = null

  for (const linha of linhas) {
    const heading = linha.match(/^(#{1,3})\s+(?:\d+(?:\.\d+)*\.?\s*)?(.+)$/)

    if (heading) {
      const nivel = heading[1].length
      const titulo = heading[2].trim()

      if (removendoNivel !== null && nivel <= removendoNivel) {
        removendoNivel = null
      }

      const tituloNorm = normalizarParaBusca(titulo)
      if (proibidas.some((proibida) => tituloNorm.includes(proibida))) {
        removendoNivel = nivel
        continue
      }
    }

    if (removendoNivel !== null) continue
    resultado.push(linha)
  }

  return resultado.join('\n')
}

function garantirRequisitosObrigatorios(conteudo: string) {
  const missing = REQUISITOS_LEGAIS_OBRIGATORIOS.filter((item) => !temRequisito(conteudo, item.codigo))
  if (!missing.length) return conteudo

  const linhasComplementares = [
    '',
    '### Complemento obrigatório de requisitos legais aplicáveis',
    '',
    '| Codigo | Nome | Órgão Emissor | Descricao | Aplicabilidade | Status de Atendimento | Evidencia | Responsavel |',
    '|---|---|---|---|---|---|---|---|',
    ...missing.map((item) =>
      `| ${item.codigo} | ${item.nome} | ${item.orgao} | ${item.nome} | Aplicável ao monitoramento legal ambiental da empresa. | Atende Parcialmente | A definir | Responsável técnico ambiental |`,
    ),
  ]

  const conclusaoIndex = conteudo.search(/^#{1,3}\s*(4\.\s*)?(Conclus[aã]o|Conclusao|Observa)/im)
  if (conclusaoIndex >= 0) {
    return [conteudo.slice(0, conclusaoIndex).trimEnd(), ...linhasComplementares, '', conteudo.slice(conclusaoIndex).trimStart()].join('\n')
  }

  return [conteudo, ...linhasComplementares].join('\n')
}

function temRequisito(conteudo: string, codigo: string) {
  const doc = normalizarParaBusca(conteudo)
  const normalizedCodigo = normalizarParaBusca(codigo)
  const semAno = normalizedCodigo.replace(/\s*(19|20)\d{2}\b/g, '').trim()
  return doc.includes(normalizedCodigo) || (semAno.length >= 6 && doc.includes(semAno))
}

function normalizarParaBusca(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
