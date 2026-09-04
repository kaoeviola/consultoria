import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { gerarComAutoRevisao } from '@/lib/agents/base/agenteAutoRevisor'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarMatrizAspectosImpactos(contexto: string, docProjetoId?: string) {
  const processosAnamnese = extrairProcessosAnamnese(contexto)
  const processosObrigatorios = processosAnamnese.length
    ? processosAnamnese.join(', ')
    : 'nao localizados no contexto'
  const systemPrompt = [
    montarPromptBaseDoContexto('ambiental', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e especialista senior em ISO 14001, avaliacao de aspectos e impactos ambientais e auditoria ambiental industrial.',
    'Gere Matriz de Aspectos e Impactos Ambientais em markdown, especifica para o setor real da empresa.',
    'Estrutura obrigatoria: Objetivo, Escopo, Metodologia, Criterios de significancia, Matriz, Controles operacionais, Indicadores e Revisao.',
    'A matriz deve conter exatamente estas colunas: Processo / Atividade / Aspecto Ambiental / Impacto Ambiental / Classificacao (Real/Potencial) / Condicao (Normal/Anormal/Emergencia) / Significancia (matriz frequencia x severidade) / Controle Operacional / Indicador.',
    '',
    'REGRA CRITICA DE FIDELIDADE A ANAMNESE:',
    'Use APENAS os processos declarados na anamnese da empresa. Nao acrescente processos tipicos do setor que nao estejam na lista da anamnese, mesmo que a ontologia setorial sugira que sejam comuns.',
    `Processos declarados na anamnese para este documento: ${processosObrigatorios}.`,
    'Se a anamnese lista "Usinagem, Soldagem, Pintura, Expedicao", a matriz deve ter EXATAMENTE esses 4 processos como linhas - nem mais, nem menos.',
    'Voce pode consultar a ontologia para enriquecer a coluna de ASPECTOS e IMPACTOS dentro de cada processo declarado, mas NAO para adicionar novos processos.',
    'Gere uma unica linha para cada processo declarado na anamnese, mantendo rastreabilidade linha-por-linha.',
    '',
    'Para cada combinacao processo-aspecto, gere uma descricao de IMPACTO especifica daquela combinacao. NUNCA copie a descricao de outra linha.',
    'Se um aspecto se repete em processos diferentes, o impacto deve descrever a especificidade daquele processo.',
    'Para SOLDAGEM em metalurgia, os aspectos tipicos NAO incluem VOC. Os aspectos reais sao: fumos metalicos, material particulado, ruido, radiacao nao-ionizante, consumo de gases inertes (Argon, CO2).',
    'Cite ISO 14001, Lei 12.305/2010, CONAMA e ABNT NBR 10004 quando aplicavel.',
    'NUNCA envolva sua resposta em blocos de codigo markdown. Retorne markdown puro direto, sem markdown no inicio nem ``` no fim.',
    'ESCOPO ESTRITO: esta e uma Matriz de Aspectos e Impactos Ambientais da ISO 14001 clausula 6.1.2.',
    'NUNCA liste NRs de SST como NR-01, NR-06, NR-09, NR-12 ou NR-15. Normas Regulamentadoras sao SST, nao matriz ambiental.',
    'NUNCA inclua coluna de legislacao aplicavel nesta matriz. Legislacao pertence a Matriz de Requisitos Legais Ambientais, ISO 14001 clausula 6.1.3.',
    'Se precisar citar referencia normativa ambiental, cite apenas ISO 14001, Lei 12.305/2010, CONAMA ambiental pertinente ou ABNT NBR 10004 fora da tabela.',
    'Este documento NAO e Matriz de Requisitos Legais. Nao troque a matriz de processo/aspecto/impacto por tabela de leis.',
    'Nao invente dados ausentes; marque como precisa validacao. Documento com 800 a 1500 palavras.',
  ].join('\n')
  const userPrompt = [
    'Gere uma Matriz de Aspectos e Impactos Ambientais.',
    'Use somente os processos reais declarados na anamnese. Use ontologia setorial apenas para enriquecer aspectos e impactos desses processos.',
    `Processos obrigatorios da anamnese: ${processosObrigatorios}.`,
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
  const promptFinal = [
    systemPrompt,
    '',
    userPrompt,
    '',
    'Regras finais obrigatorias:',
    '- Retorne somente a Matriz de Aspectos e Impactos Ambientais.',
    '- Nao inclua NR-01, NR-06, NR-09, NR-12, NR-15 ou qualquer NR.',
    '- Nao inclua coluna de legislacao relevante/aplicavel na tabela.',
    '- Nao gere Matriz de Requisitos Legais.',
    `- A tabela deve conter exatamente estes processos na coluna Processo: ${processosObrigatorios}.`,
    '- Nao substitua Expedicao por Tratamento Superficial, Caldeiraria ou outro processo tipico.',
    '- Para Soldagem, use fumos metalicos/material particulado/ruido/radiacao nao-ionizante/gases inertes; nao use VOC.',
  ].join('\n')

  const revisao = await gerarComAutoRevisao(promptFinal, contexto, [
    'Tem processo -> aspecto -> impacto -> significancia -> controle?',
    'Usa processos reais da empresa, ontologia e arquivos processados?',
    'Diferencia situacao normal, anormal e emergencia?',
    'Evita afirmar controles inexistentes sem evidencia?',
    'Nao contem NRs de SST como NR-09 ou NR-15?',
    'Nao contem coluna de legislacao aplicavel ou relevante na matriz?',
    'Usa exatamente os processos declarados na anamnese, sem adicionar processos tipicos nao declarados?',
    'Soldagem nao foi associada a VOC de pintura?',
  ])
  const conteudoConsolidado = consolidarTabelaPorProcesso(revisao.documento, processosAnamnese)
  const validacaoProcessos = validarProcessosDaMatriz(conteudoConsolidado, processosAnamnese)

  return {
    conteudo: conteudoConsolidado,
    metadados: {
      raciocinioIA: raciocinio,
      autoRevisao: revisao,
      validacaoProcessos,
      agente: 'matrizAspectosImpactos',
    },
  }
}

function extrairProcessosAnamnese(contexto: string) {
  const match = contexto.match(/Processos principais(?: declarados na anamnese)?:\s*([^\n]+)/i)
  const raw = match?.[1]?.trim()
  if (!raw || /nao informado/i.test(raw)) return []

  return raw
    .split(/[,;|/]+|\s+e\s+/i)
    .map((item) => item.trim())
    .filter(Boolean)
}

function validarProcessosDaMatriz(conteudo: string, processosAnamnese: string[]) {
  if (!processosAnamnese.length) {
    return {
      ok: false,
      warning: 'processos da anamnese nao localizados no contexto',
      processosEsperados: [],
      processosEncontrados: [],
      faltantes: [],
      extras: [],
    }
  }

  const processosEncontrados = extrairProcessosTabela(conteudo)
  const esperadosNorm = new Map(processosAnamnese.map((processo) => [normalizar(processo), processo]))
  const encontradosNorm = new Map(processosEncontrados.map((processo) => [normalizar(processo), processo]))
  const faltantes = [...esperadosNorm.entries()]
    .filter(([key]) => !encontradosNorm.has(key))
    .map(([, value]) => value)
  const extras = [...encontradosNorm.entries()]
    .filter(([key]) => !esperadosNorm.has(key))
    .map(([, value]) => value)
  const ok = faltantes.length === 0 && extras.length === 0

  return {
    ok,
    warning: ok ? null : 'processos divergentes da anamnese',
    processosEsperados: processosAnamnese,
    processosEncontrados,
    faltantes,
    extras,
  }
}

function extrairProcessosTabela(conteudo: string) {
  const linhas = conteudo.split('\n').map((linha) => linha.trim())
  const processos = new Set<string>()
  let processoIndex = -1

  for (const linha of linhas) {
    if (!linha.startsWith('|')) continue
    const cells = linha.split('|').slice(1, -1).map((cell) => cell.trim())
    if (cells.length < 2) continue

    if (cells.some((cell) => /^-+$/.test(cell.replace(/:/g, '').trim()))) continue

    const headerIndex = cells.findIndex((cell) => normalizar(cell) === 'processo')
    if (headerIndex >= 0) {
      processoIndex = headerIndex
      continue
    }

    if (processoIndex >= 0 && cells[processoIndex]) {
      processos.add(cells[processoIndex])
    }
  }

  return [...processos]
}

function normalizar(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function consolidarTabelaPorProcesso(conteudo: string, processosAnamnese: string[]) {
  if (!processosAnamnese.length) return conteudo

  const linhas = conteudo.split('\n')
  const inicioTabela = linhas.findIndex((linha) => {
    const trimmed = linha.trim()
    return trimmed.startsWith('|') && /\|\s*Processo\s*\|/i.test(trimmed)
  })
  if (inicioTabela < 0 || inicioTabela + 1 >= linhas.length) return conteudo

  let fimTabela = inicioTabela
  while (fimTabela < linhas.length && linhas[fimTabela].trim().startsWith('|')) {
    fimTabela += 1
  }

  const tableLines = linhas.slice(inicioTabela, fimTabela)
  const header = tableLines[0].split('|').slice(1, -1).map((cell) => cell.trim())
  const processoIndex = header.findIndex((cell) => normalizar(cell) === 'processo')
  if (processoIndex < 0) return conteudo

  const rows = tableLines
    .slice(2)
    .map((linha) => linha.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length === header.length)

  const rowByProcesso = new Map<string, string[][]>()
  for (const row of rows) {
    const key = normalizar(row[processoIndex] || '')
    if (!key) continue
    rowByProcesso.set(key, [...(rowByProcesso.get(key) || []), row])
  }

  const consolidatedRows = processosAnamnese.map((processo) => {
    const group = rowByProcesso.get(normalizar(processo)) || []
    if (!group.length) {
      return header.map((_, index) => (index === processoIndex ? processo : 'A definir'))
    }

    return header.map((_, index) => {
      if (index === processoIndex) return normalizarLabelProcesso(processo)
      const values = group
        .map((row) => row[index])
        .filter(Boolean)
        .flatMap((value) => value.split(/\s*;\s*/))
        .map((value) => value.trim())
        .filter(Boolean)
      return unique(values).join('; ') || 'A definir'
    })
  })

  const novaTabela = [
    `| ${header.join(' |')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...consolidatedRows.map((row) => `| ${row.join(' | ')} |`),
  ]

  return [
    ...linhas.slice(0, inicioTabela),
    ...novaTabela,
    ...linhas.slice(fimTabela),
  ].join('\n')
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const key = normalizar(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }

  return result
}

function normalizarLabelProcesso(processo: string) {
  return processo
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
