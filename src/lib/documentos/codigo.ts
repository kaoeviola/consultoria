const PREFIXOS_CATEGORIA = {
  ambiental: 'AMB',
  sst: 'SST',
  gestao: 'GES',
  homologacao: 'HOM',
} as const

const PREFIXOS_TIPO = {
  'politica-ambiental': 'POL',
  'politica-sst': 'POL',
  'politica-canal-denuncia': 'PCD',
  'codigo-conduta-etica': 'COD',
  'matriz-aspectos-impactos': 'MAT',
  'matriz-requisitos-legais': 'MRL',
  'plano-monitoramento-ambiental': 'PMA',
  'procedimento-controle-operacional-ambiental': 'PCO',
  'pgrs': 'PGRS',
  'pgr': 'PGR',
  'pcmso': 'PCM',
  'inventario-riscos': 'INV',
  'plano-emergencia': 'PAE',
  'matriz-treinamentos': 'MTR',
  'procedimento-apr': 'APR',
  'auditoria-interna': 'AUD',
  'plano-acao': 'PAC',
  'diagnostico-inicial': 'DIA',
} as const

type Categoria = keyof typeof PREFIXOS_CATEGORIA
type TipoDocumento = keyof typeof PREFIXOS_TIPO

export function gerarCodigoDocumento(categoria: Categoria, tipo: TipoDocumento, sequencial = 1) {
  return `${PREFIXOS_CATEGORIA[categoria]}-${PREFIXOS_TIPO[tipo]}-${String(sequencial).padStart(3, '0')}`
}

export function detectarCodigoDocumento(nome: string, tipo = '', sequencial = 1) {
  const alvo = normalizar(`${nome} ${tipo}`)
  const slugNormalizado = slugify(`${nome} ${tipo}`)
  let categoria: Categoria | null = null
  let tipoDocumento: TipoDocumento | null = null

  if (alvo.includes('canal') && alvo.includes('denuncia')) {
    categoria = 'gestao'
    tipoDocumento = 'politica-canal-denuncia'
  } else if (alvo.includes('codigo') && alvo.includes('conduta')) {
    categoria = 'gestao'
    tipoDocumento = 'codigo-conduta-etica'
  } else if (
    slugNormalizado.includes('matriz-requisitos-legais') ||
    slugNormalizado.includes('matriz-de-requisitos-legais') ||
    (alvo.includes('matriz') && alvo.includes('requisito') && alvo.includes('legal'))
  ) {
    categoria = 'ambiental'
    tipoDocumento = 'matriz-requisitos-legais'
  } else if (alvo.includes('matriz') && alvo.includes('aspecto')) {
    categoria = 'ambiental'
    tipoDocumento = 'matriz-aspectos-impactos'
  } else if (alvo.includes('plano') && alvo.includes('monitoramento') && alvo.includes('ambiental')) {
    categoria = 'ambiental'
    tipoDocumento = 'plano-monitoramento-ambiental'
  } else if (alvo.includes('procedimento') && alvo.includes('controle') && alvo.includes('operacional') && alvo.includes('ambiental')) {
    categoria = 'ambiental'
    tipoDocumento = 'procedimento-controle-operacional-ambiental'
  } else if (alvo.includes('politica ambiental')) {
    categoria = 'ambiental'
    tipoDocumento = 'politica-ambiental'
  } else if (alvo.includes('politica') && (alvo.includes('sst') || alvo.includes('seguranca') || alvo.includes('saude'))) {
    categoria = 'sst'
    tipoDocumento = 'politica-sst'
  } else if (alvo.includes('pcmso')) {
    categoria = 'sst'
    tipoDocumento = 'pcmso'
  } else if (alvo.includes('pgrs')) {
    categoria = 'ambiental'
    tipoDocumento = 'pgrs'
  } else if (alvo.includes('pgr') || alvo.includes('programa de gerenciamento de riscos')) {
    categoria = 'sst'
    tipoDocumento = 'pgr'
  } else if (alvo.includes('inventario') && alvo.includes('risco')) {
    categoria = 'sst'
    tipoDocumento = 'inventario-riscos'
  } else if (alvo.includes('treinamento')) {
    categoria = 'sst'
    tipoDocumento = 'matriz-treinamentos'
  } else if (alvo.includes('apr') || alvo.includes('analise preliminar')) {
    categoria = 'sst'
    tipoDocumento = 'procedimento-apr'
  } else if (alvo.includes('auditoria') && alvo.includes('interna')) {
    categoria = 'gestao'
    tipoDocumento = 'auditoria-interna'
  } else if (alvo.includes('plano') && alvo.includes('emergencia')) {
    categoria = 'sst'
    tipoDocumento = 'plano-emergencia'
  } else if (alvo.includes('plano') && alvo.includes('acao')) {
    categoria = 'homologacao'
    tipoDocumento = 'plano-acao'
  } else if (alvo.includes('diagnostico')) {
    categoria = 'homologacao'
    tipoDocumento = 'diagnostico-inicial'
  }

  const prefixo = categoria && tipoDocumento ? `${PREFIXOS_CATEGORIA[categoria]}-${PREFIXOS_TIPO[tipoDocumento]}` : null
  console.log('Tipo recebido:', tipo, 'Slug normalizado:', slugNormalizado, 'Prefixo encontrado:', prefixo)

  if (categoria && tipoDocumento) {
    return gerarCodigoDocumento(categoria, tipoDocumento, sequencial)
  }

  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`Tipo de documento sem mapeamento de codigo: nome="${nome}", tipo="${tipo}", slug="${slugNormalizado}"`)
  }

  return `DOC-${slugify(nome).toUpperCase()}-${String(sequencial).padStart(3, '0')}`
}

function normalizar(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function slugify(value: string) {
  return normalizar(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
