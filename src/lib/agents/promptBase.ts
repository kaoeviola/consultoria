import { LEIS_CANONICAS } from '@/lib/validador/leisCanonicas'

export type CategoriaDocumento = 'ambiental' | 'sst' | 'gestao' | 'homologacao'

type EscopoCategoria = {
  leis_permitidas: string[]
  leis_proibidas: string[]
  descricao: string
}

const ESCOPO_POR_CATEGORIA: Record<CategoriaDocumento, EscopoCategoria> = {
  ambiental: {
    leis_permitidas: [
      'CONAMA 237',
      'CONAMA 313',
      'CONAMA 357',
      'CONAMA 430',
      'Lei 12.305',
      'Lei 6.938',
      'Lei 9.605',
      'NBR 10.004',
      'NBR 10.007',
      'NBR ISO 14001',
      'Decreto 7.404',
      'Decreto 10.388',
      'Lei Estadual SP 997',
      'Decreto SP 8.468',
      'Decisao de Diretoria CETESB 38',
      'NR-25 apenas quando o tema for residuos industriais e sem ampliar para SST',
    ],
    leis_proibidas: ['NR-1', 'NR-6', 'NR-9', 'NR-12', 'NR-15', 'NR-17', 'NR-26', 'NR-33', 'NR-35'],
    descricao:
      'Documentos ambientais (Sistema de Gestao Ambiental, ISO 14001) usam apenas legislacao ambiental. Nao citam NRs do MTE, pois essas sao de SST.',
  },
  sst: {
    leis_permitidas: ['NR-1', 'NR-6', 'NR-7', 'NR-9', 'NR-12', 'NR-15', 'NR-17', 'NR-33', 'NR-35', 'Lei 8.213', 'Decreto 3.048', 'Portaria MTE 1.510'],
    leis_proibidas: ['CONAMA 237', 'CONAMA 357', 'CONAMA 430', 'Lei 12.305', 'PNRS', 'Lei 6.938'],
    descricao:
      'Documentos de SST (Saude e Seguranca no Trabalho, ISO 45001) usam apenas NRs do MTE e leis trabalhistas/previdenciarias aplicaveis. Nao citam CONAMA, PNRS ou Politica Ambiental.',
  },
  gestao: {
    leis_permitidas: ['Lei 12.846', 'Decreto 11.129', 'Lei 13.709', 'LGPD', 'Lei 14.457', 'ISO 37001', 'ISO 37301'],
    leis_proibidas: ['NRs especificas', 'CONAMA especifico', 'PNRS como base central do documento'],
    descricao:
      'Documentos de gestao e ESG (governanca, compliance, etica) usam leis de governanca. Podem fazer referencia generica a obrigacoes de SST e ambientais, mas nao citam NRs ou CONAMA especificos.',
  },
  homologacao: {
    leis_permitidas: [],
    leis_proibidas: [],
    descricao: 'Documentos de homologacao seguem requisitos do cliente ancora. Validacao caso a caso.',
  },
}

export function montarPromptBase(params: {
  categoria: CategoriaDocumento
  anamnese: { processosPrincipais: string[] | string; numeroFuncionarios?: number | string | null; observacoes?: string | null }
  empresa: { nome?: string | null; setor?: string | null; cnae?: string | null; localizacao?: string | null }
}): string {
  const escopo = ESCOPO_POR_CATEGORIA[params.categoria]
  const processos = normalizarListaProcessos(params.anamnese.processosPrincipais)
  const descricoesLeis = Object.entries(LEIS_CANONICAS)
    .map(([codigo, info]) => `- ${codigo}: ${info.tema} (escopo: ${info.escopo})`)
    .join('\n')

  return `
# REGRAS UNIVERSAIS DE GERACAO DE DOCUMENTOS

Voce esta gerando um documento tecnico de consultoria para uma empresa real. As regras abaixo sao inviolaveis. Descumprir qualquer uma invalida o documento.

## 1. FIDELIDADE A ANAMNESE

A empresa e: ${params.empresa.nome || 'nao informada'} (CNAE ${params.empresa.cnae || 'nao informado'}, setor ${params.empresa.setor || 'nao informado'}, ${params.empresa.localizacao || 'localizacao nao informada'}).

Processos declarados na anamnese: ${processos.length ? processos.join(', ') : 'nao informados'}.
Numero de funcionarios: ${params.anamnese.numeroFuncionarios ?? 'nao informado'}.

REGRAS:
- Use apenas os processos declarados acima. Nao acrescente processos tipicos do setor que nao estejam na lista, mesmo que parecam obvios para o ramo.
- Nao invente atividades, departamentos, cargos, clientes, fornecedores ou areas que nao foram declaradas.
- Se a anamnese diz "Usinagem, Soldagem, Pintura, Expedicao", esses sao exatamente os 4 processos - nem mais, nem menos.
- Voce pode enriquecer a descricao de cada processo com aspectos, riscos e controles tipicos, mas nao pode inventar processos novos.

## 2. ESCOPO ESTRITO DA CATEGORIA

Este documento e da categoria: ${params.categoria}.

${escopo.descricao}

Leis e normas permitidas nesta categoria:
${escopo.leis_permitidas.length ? escopo.leis_permitidas.map((lei) => `- ${lei}`).join('\n') : '- Validacao caso a caso'}

Leis e normas proibidas nesta categoria:
${escopo.leis_proibidas.length ? escopo.leis_proibidas.map((lei) => `- ${lei}`).join('\n') : '- Nenhuma lista fixa'}

Nunca cite legislacao fora do escopo desta categoria, mesmo que seja relevante para a empresa em outro contexto.

## 3. DESCRICOES CANONICAS DE LEIS

Se citar qualquer lei ou norma desta base, use apenas estas descricoes. Nao invente descricoes e nao use nomes antigos de normas revogadas:

${descricoesLeis}

## TERMOS PROIBIDOS - NUNCA use estas formulacoes

A seguir, frases e descricoes que estao desatualizadas ou incorretas. Mesmo que parecam familiares, nao use estes nomes:

- "Programa de Prevencao de Riscos Ambientais" (nome antigo da NR-9, revogado em 2020)
- "PPRA" (sigla revogada - nao use mais)
- "CONAMA 430 - Classificacao de Residuos" (CONAMA 430 e sobre efluentes, nao residuos)
- "Lei 12.305 - Classificacao de Residuos" (Lei 12.305 e a Politica Nacional de Residuos Solidos)
- "NBR 10.004 - Gestao Ambiental" (NBR 10.004 e especificamente sobre classificacao de residuos solidos)

## FRASES OBRIGATORIAS - Use EXATAMENTE estas formulacoes

- "NR-9 - Avaliacao e Controle das Exposicoes Ocupacionais" (versao vigente desde 2020)
- "NR-1 - Disposicoes gerais e gerenciamento de riscos ocupacionais" (versao vigente)
- "CONAMA 430/2011 - Padroes de lancamento de efluentes"
- "Lei 12.305/2010 - Politica Nacional de Residuos Solidos (PNRS)"
- "NBR 10.004:2004 - Classificacao de residuos solidos quanto a periculosidade"

## REGRA DE CITACAO DE LEI

Quando citar qualquer lei ou norma, use o formato exato:
[SIGLA/Tipo] [Numero]/[Ano] - [Tema oficial]

Exemplos corretos:
- NR-9/2020 - Avaliacao e Controle das Exposicoes Ocupacionais
- Lei 6.938/1981 - Politica Nacional do Meio Ambiente
- Decreto 7.404/2010 - Regulamento da PNRS

Se voce nao souber a descricao oficial exata, nao cite a lei. Prefira omitir a citar errado.

## 4. RESTRICOES FORMAIS

- Nunca envolva sua resposta em blocos de codigo markdown. Retorne markdown puro direto, sem markdown no inicio nem cercas no fim.
- Nao mencione outras empresas, clientes exemplo, grupos empresariais ou marcas externas.
- Nao use placeholders como [Definir], [IA], [REVISAR] ou [Dados precisam de validacao]. Se a informacao nao esta disponivel, use "A definir" diretamente.
- Nao use emojis.

## ESTRUTURA DE HEADINGS

Para que o sumario automatico funcione corretamente, use estritamente:
- # Titulo Principal (apenas 1 por documento, no inicio)
- ## Secoes (use para as secoes principais como Objetivo, Escopo, Metodologia, etc.)
- ### Subsecoes (use para divisoes internas das secoes)

Nunca use #### ou niveis mais profundos.

---

Agora siga as instrucoes especificas deste agente abaixo:
`.trim()
}

export function montarPromptBaseDoContexto(categoria: CategoriaDocumento, contexto: string): string {
  const empresa = {
    nome: extrairLinha(contexto, /^Empresa:\s*(.+)$/im),
    setor: extrairLinha(contexto, /^Setor:\s*(.+)$/im) || extrairLinha(contexto, /^Setor na ontologia:\s*(.+)$/im),
    cnae: extrairLinha(contexto, /^CNAE:\s*(.+)$/im),
    localizacao: extrairLinha(contexto, /^Localizacao:\s*(.+)$/im),
  }
  const anamnese = {
    processosPrincipais:
      extrairLinha(contexto, /^Processos principais(?: declarados na anamnese)?:\s*(.+)$/im) || [],
    numeroFuncionarios: extrairLinha(contexto, /^Numero de funcionarios:\s*(.+)$/im),
    observacoes: extrairLinha(contexto, /^Observacoes(?: gerais)?:\s*(.+)$/im),
  }

  return montarPromptBase({ categoria, empresa, anamnese })
}

function extrairLinha(contexto: string, pattern: RegExp) {
  const value = contexto.match(pattern)?.[1]?.trim()
  if (!value || /nao informad[oa]/i.test(value)) return null
  return value
}

function normalizarListaProcessos(processos: string[] | string) {
  if (Array.isArray(processos)) {
    return processos.map((processo) => processo.trim()).filter(Boolean)
  }

  return processos
    .split(/[,;|/]+|\s+e\s+/i)
    .map((processo) => processo.trim())
    .filter(Boolean)
}
