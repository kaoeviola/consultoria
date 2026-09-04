import { EMPRESAS_EXTERNAS } from '@/lib/validador/empresasExternas'
import { LEIS_CANONICAS, type CodigoLeiCanonica } from '@/lib/validador/leisCanonicas'
import type {
  CategoriaFidelidade,
  ContextoFidelidade,
  Divergencia,
  ResultadoFidelidade,
  SeveridadeFidelidade,
} from '@/lib/validador/tipos'

const DESCONTOS: Record<SeveridadeFidelidade, number> = {
  critica: 25,
  alta: 10,
  media: 3,
  info: 0,
}

const PROCESSOS_ESCOPO_TOTAL = ['matriz de aspectos', 'aspectos e impactos', 'inventario de riscos', 'diagnostico']

export async function validarFidelidade(
  documento: string,
  contexto: ContextoFidelidade,
): Promise<ResultadoFidelidade> {
  const divergencias = [
    ...regraEmpresaCorreta(documento, contexto),
    ...regraProcessosSubconjunto(documento, contexto),
    ...regraSetorConsistente(documento, contexto),
    ...regraFuncionariosConsistente(documento, contexto),
    ...regraEscopoCategoria(documento, contexto),
    ...regraEmpresasExternas(documento),
    ...regraLeisCanonicas(documento),
    ...regraCompletudeMatrizRequisitosLegais(documento, contexto),
  ]

  return agregarResultado(divergencias)
}

function regraEmpresaCorreta(documento: string, contexto: ContextoFidelidade): Divergencia[] {
  const divergencias: Divergencia[] = []
  const docNorm = normalizar(documento)
    .replace(/\blogistica reversa\b/g, 'sistema de retorno pos consumo')
    .replace(/\blogistica de reversa\b/g, 'sistema de retorno pos consumo')
  const nomeEmpresa = contexto.empresa.nome
  const aliases = gerarAliasesEmpresa(nomeEmpresa)

  if (!aliases.some((alias) => docNorm.includes(normalizar(alias)))) {
    divergencias.push({
      severidade: 'critica',
      regra: 'empresa_nao_mencionada',
      esperado: aliases,
      encontrado: 'nome da empresa ausente',
      mensagem: `O documento nao menciona a empresa correta (${nomeEmpresa}).`,
    })
  }

  for (const outraEmpresa of contexto.empresasRegistradas || []) {
    if (normalizar(outraEmpresa) === normalizar(nomeEmpresa)) continue
    if (docNorm.includes(normalizar(outraEmpresa))) {
      divergencias.push({
        severidade: 'critica',
        regra: 'empresa_errada_mencionada',
        esperado: nomeEmpresa,
        encontrado: outraEmpresa,
        mensagem: `O documento menciona outra empresa registrada: ${outraEmpresa}.`,
      })
    }
  }

  return divergencias
}

function regraProcessosSubconjunto(documento: string, contexto: ContextoFidelidade): Divergencia[] {
  const processosAnamnese = extrairProcessosAnamnese(contexto.anamnese.processosPrincipais)
  if (!processosAnamnese.length) return []

  const processosEstruturados = extrairProcessosTabela(documento, processosAnamnese)
  const processosDocumento = processosEstruturados.length
    ? processosEstruturados
    : extrairProcessosDoDocumento(documento, processosAnamnese, contexto)
  const esperadosNorm = new Map(processosAnamnese.map((processo) => [normalizar(processo), processo]))
  const encontradosNorm = new Map(processosDocumento.map((processo) => [normalizar(processo), processo]))
  const divergencias: Divergencia[] = []

  for (const [key, processo] of encontradosNorm) {
    if (!esperadosNorm.has(key)) {
      divergencias.push({
        severidade: 'critica',
        regra: 'processo_inventado',
        esperado: processosAnamnese,
        encontrado: processo,
        mensagem: `Processo "${processo}" aparece no documento, mas nao esta declarado na anamnese.`,
        localizacao: localizar(documento, processo),
      })
    }
  }

  if (documentoExigeTodosProcessos(contexto.tipoDocumento)) {
    for (const [key, processo] of esperadosNorm) {
      if (!encontradosNorm.has(key)) {
        divergencias.push({
          severidade: 'alta',
          regra: 'processo_omitido',
          esperado: processo,
          encontrado: processosDocumento,
          mensagem: `Processo "${processo}" esta na anamnese, mas nao aparece no documento.`,
        })
      }
    }
  }

  return divergencias
}

function regraSetorConsistente(documento: string, contexto: ContextoFidelidade): Divergencia[] {
  const setor = contexto.empresa.setor
  if (!setor) return []

  const setorNorm = normalizar(setor)
  const aliasesSetor = aliasesDoSetor(setor)
  const setores = ['metalurgia', 'quimico', 'plastico', 'logistica', 'construcao', 'alimentos', 'alimenticio', 'servicos']
  const divergencias: Divergencia[] = []
  const declaracoes = extrairDeclaracoesSetor(documento)

  if (!declaracoes.length) {
    return []
  }

  for (const declaracao of declaracoes) {
    const declaracaoNorm = normalizar(declaracao)
    if (aliasesSetor.some((alias) => declaracaoNorm.includes(normalizar(alias)))) continue

    const outroSetor = setores.find((item) => {
      if (normalizar(item) === setorNorm || aliasesSetor.some((alias) => normalizar(alias) === normalizar(item))) {
        return false
      }
      return declaracaoNorm.includes(normalizar(item))
    })

    if (outroSetor) {
      divergencias.push({
        severidade: 'alta',
        regra: 'setor_divergente',
        esperado: setor,
        encontrado: declaracao,
        mensagem: `O documento menciona setor diferente do cadastro: ${outroSetor}.`,
        localizacao: declaracao,
      })
    }
  }

  return divergencias
}

function extrairDeclaracoesSetor(documento: string) {
  const padroesSetorDeclarado = [
    /setor:\s*([a-záéíóúâêôãõç\s/.-]+)/gi,
    /ramo:\s*([a-záéíóúâêôãõç\s/.-]+)/gi,
    /segmento:\s*([a-záéíóúâêôãõç\s/.-]+)/gi,
    /atividade principal:\s*([a-záéíóúâêôãõç\s/.-]+)/gi,
  ]
  const declaracoes: string[] = []

  for (const padrao of padroesSetorDeclarado) {
    for (const match of documento.matchAll(padrao)) {
      const declaracao = match[1]
        ?.split(/\n|\r| {2,}|\||\\/)[0]
        ?.trim()
      if (declaracao) declaracoes.push(declaracao)
    }
  }

  return declaracoes
}

function aliasesDoSetor(setor: string) {
  const setorNorm = normalizar(setor)
  if (setorNorm.includes('metalurg')) return ['metalurgia', 'metalurgica', 'metalurgico']
  if (setorNorm.includes('quim')) return ['quimico', 'quimica', 'quimicos']
  if (setorNorm.includes('plastic')) return ['plastico', 'plasticos', 'transformacao plastica']
  if (setorNorm.includes('logistic')) return ['logistica', 'expedicao', 'transporte']
  if (setorNorm.includes('construc')) return ['construcao', 'obra', 'canteiro']
  if (setorNorm.includes('aliment')) return ['alimentos', 'alimenticio', 'alimenticia']
  return [setor]
}

function regraFuncionariosConsistente(documento: string, contexto: ContextoFidelidade): Divergencia[] {
  const esperado = contexto.anamnese.numFuncionarios
  if (!esperado) return []

  const matches = [...documento.matchAll(/(\d{1,5})\s+(?:funcion[aá]rios|colaboradores|empregados)/gi)]
  const divergencias: Divergencia[] = []

  for (const match of matches) {
    const encontrado = Number(match[1])
    const tolerancia = Math.max(1, Math.ceil(esperado * 0.05))
    if (Math.abs(encontrado - esperado) > tolerancia) {
      divergencias.push({
        severidade: 'media',
        regra: 'numero_funcionarios_divergente',
        esperado: String(esperado),
        encontrado: String(encontrado),
        mensagem: `Quantidade de funcionarios mencionada (${encontrado}) diverge da anamnese (${esperado}).`,
        localizacao: match[0],
      })
    }
  }

  return divergencias
}

function regraEscopoCategoria(documento: string, contexto: ContextoFidelidade): Divergencia[] {
  const docNorm = normalizar(documento)
  const divergencias: Divergencia[] = []

  if (contexto.categoria === 'ambiental') {
    if (/NBR\s*ISO\s*45001|ISO\s*45001/i.test(documento)) {
      divergencias.push({
        severidade: 'alta',
        regra: 'escopo_violado',
        esperado: 'documento ambiental sem referencia a ISO 45001',
        encontrado: 'NBR ISO 45001',
        mensagem: 'NBR ISO 45001 e norma de SST e nao deve aparecer em documento ambiental.',
        localizacao: localizar(documento, 'ISO 45001'),
      })
    }

    const nrsEncontradas = new Set<string>()
    for (const match of documento.matchAll(/\bNR[-\s]?(?:[1-9]|[12]\d|3[0-7])\b/gi)) {
      const nr = match[0].toUpperCase().replace(/\s+/g, '')
      if (nr === 'NR-25' || nr === 'NR25') continue
      if (nrsEncontradas.has(nr)) continue
      nrsEncontradas.add(nr)
      divergencias.push({
        severidade: 'alta',
        regra: 'escopo_violado',
        esperado: 'Documento ambiental sem NRs de SST',
        encontrado: match[0],
        mensagem: `Documento ambiental menciona norma de SST fora do escopo: ${match[0]}.`,
        localizacao: match[0],
      })
    }
  }

  if (contexto.categoria === 'sst') {
    const ambientais = ['conama', 'lei 12 305', 'lei 6 938', 'politica nacional de residuos', 'politica nacional do meio ambiente']
    for (const termo of ambientais) {
      if (docNorm.includes(termo)) {
        divergencias.push({
          severidade: 'alta',
          regra: 'escopo_violado',
          esperado: 'Documento SST sem legislacao ambiental especifica',
          encontrado: termo,
          mensagem: `Documento SST menciona legislacao ambiental fora do escopo: ${termo}.`,
          localizacao: termo,
        })
      }
    }
  }

  if (contexto.categoria === 'gestao') {
    const tecnicos = ['fumos metalicos', 'efluentes', 'residuos classe i', 'ruido ocupacional', 'nr 9', 'nr-9', 'conama 430']
    for (const termo of tecnicos) {
      if (docNorm.includes(normalizar(termo))) {
        divergencias.push({
          severidade: 'alta',
          regra: 'escopo_violado',
          esperado: 'Documento de gestao sem detalhes tecnicos ambientais/SST especificos',
          encontrado: termo,
          mensagem: `Documento de gestao traz detalhe tecnico especifico fora do escopo: ${termo}.`,
          localizacao: termo,
        })
      }
    }
  }

  return divergencias
}

function regraCompletudeMatrizRequisitosLegais(documento: string, contexto: ContextoFidelidade): Divergencia[] {
  if (!isMatrizRequisitosLegais(contexto.tipoDocumento)) return []

  const minimoLeisObrigatorias = [
    'CONAMA 237',
    'Lei 6.938',
    'Lei 12.305',
    'NBR 10.004',
    'CONAMA 357',
  ]
  const docNorm = normalizar(documento)
  const ausentes = minimoLeisObrigatorias.filter((lei) => !docNorm.includes(normalizar(lei)))

  if (!ausentes.length) return []

  return [
    {
      severidade: 'alta',
      regra: 'matriz_legal_incompleta',
      esperado: minimoLeisObrigatorias,
      encontrado: minimoLeisObrigatorias.filter((lei) => !ausentes.includes(lei)),
      mensagem: `Matriz de Requisitos Legais Ambientais esta incompleta. Normas ausentes: ${ausentes.join(', ')}`,
    },
  ]
}

function regraEmpresasExternas(documento: string): Divergencia[] {
  const docNorm = normalizar(documento)

  return EMPRESAS_EXTERNAS.filter((empresa) => docNorm.includes(normalizar(empresa))).map((empresa) => ({
    severidade: 'critica',
    regra: 'empresa_externa_mencionada',
    esperado: 'Nenhuma empresa externa',
    encontrado: empresa,
    mensagem: `Documento menciona empresa externa conhecida: ${empresa}.`,
    localizacao: localizar(documento, empresa),
  }))
}

function regraLeisCanonicas(documento: string): Divergencia[] {
  const divergencias: Divergencia[] = []
  const docNorm = normalizar(documento)

  if (docNorm.includes('programa de prevencao de riscos ambientais')) {
    divergencias.push({
      severidade: 'alta',
      regra: 'lei_descricao_incorreta',
      esperado: LEIS_CANONICAS['NR-9'].tema,
      encontrado: 'Programa de Prevencao de Riscos Ambientais',
      mensagem: 'NR-9 foi mencionada com nomenclatura antiga/revogada.',
      localizacao: 'NR-9',
    })
  }

  for (const match of documento.matchAll(/CONAMA\s*430[\s\S]{0,160}/gi)) {
    const trecho = match[0]
    const trechoNorm = normalizar(trecho)
    const mencionaTemaCorreto = trechoNorm.includes('efluente') || trechoNorm.includes('lancamento')
    const associaResiduo =
      trechoNorm.includes('classificacao de residuo') ||
      trechoNorm.includes('classificacao dos residuos') ||
      trechoNorm.includes('residuos classe') ||
      trechoNorm.includes('classe i')

    if (associaResiduo && !mencionaTemaCorreto) {
      divergencias.push({
        severidade: 'alta',
        regra: 'lei_descricao_incorreta',
        esperado: LEIS_CANONICAS['CONAMA 430'].tema,
        encontrado: trecho.slice(0, 120),
        mensagem: 'CONAMA 430 foi associada a residuos/classificacao; o tema correto e lancamento de efluentes.',
        localizacao: trecho.slice(0, 120),
      })
      break
    }
  }

  for (const codigo of Object.keys(LEIS_CANONICAS) as CodigoLeiCanonica[]) {
    const regex = regexCodigoLei(codigo)
    const match = documento.match(regex)
    if (!match) continue

    const trecho = extrairTrechoApos(documento, match.index || 0, 180)
    const contexto = documento.slice(Math.max((match.index || 0) - 100, 0), (match.index || 0) + 180)
    const temaCanonico = LEIS_CANONICAS[codigo].tema
    const descricaoUsada = limparDescricaoLegal(trecho, codigo)
    const trechoNorm = normalizar(trecho)
    const contextoNorm = normalizar(contexto)
    const temaNorm = normalizar(temaCanonico)
    const aliases = aliasesCanonicos(codigo).map(normalizar)
    const descricaoNorm = normalizar(descricaoUsada)

    if (!descricaoUsada || descricaoUsada.length < 12) continue
    if (LEIS_CANONICAS[codigo].escopo === 'gestao') continue
    if (contextoNorm.includes(temaNorm)) continue
    if (aliases.some((alias) => contextoNorm.includes(alias))) continue
    if (trechoNorm.includes(temaNorm)) continue
    if (descricaoNorm.includes(temaNorm)) continue
    if (aliases.some((alias) => trechoNorm.includes(alias))) continue
    if (aliases.some((alias) => descricaoNorm.includes(alias))) continue

    const similaridade = jaccard(descricaoUsada, temaCanonico)
    if (similaridade < 0.5) {
      divergencias.push({
        severidade: 'alta',
        regra: 'lei_descricao_incorreta',
        esperado: temaCanonico,
        encontrado: descricaoUsada,
        mensagem: `${codigo} parece estar descrita com tema divergente do canonico.`,
        localizacao: trecho.slice(0, 120),
      })
    }
  }

  return dedupeDivergencias(divergencias)
}

function agregarResultado(divergencias: Divergencia[]): ResultadoFidelidade {
  const contagem = {
    criticas: divergencias.filter((item) => item.severidade === 'critica').length,
    altas: divergencias.filter((item) => item.severidade === 'alta').length,
    medias: divergencias.filter((item) => item.severidade === 'media').length,
    infos: divergencias.filter((item) => item.severidade === 'info').length,
  }
  const desconto = divergencias.reduce((total, item) => total + DESCONTOS[item.severidade], 0)

  return {
    score: Math.max(0, 100 - desconto),
    divergencias,
    contagem,
    bloqueia: contagem.criticas > 0,
  }
}

function extrairProcessosAnamnese(value: string | null) {
  if (!value) return []

  return value
    .split(/[,;|/]+|\s+e\s+/i)
    .map((item) => item.trim())
    .filter(Boolean)
}

function extrairProcessosDoDocumento(documento: string, processosAnamnese: string[], contexto: ContextoFidelidade) {
  const processos = new Set<string>()
  const conhecidos = [
    ...processosAnamnese,
    ...extrairProcessosPerfil(contexto.perfilOperacional),
    'usinagem',
    'soldagem',
    'pintura',
    'expedicao',
    'expedição',
    'tratamento superficial',
    'caldeiraria',
    'logistica',
    'armazenagem',
    'mistura',
    'envase',
  ]
  const docNorm = normalizar(documento)
    .replace(/\blogistica reversa\b/g, 'sistema de retorno pos consumo')
    .replace(/\blogistica de reversa\b/g, 'sistema de retorno pos consumo')
    .replace(/\barmazenagem\b/g, 'expedicao')

  for (const processo of conhecidos) {
    if (docNorm.includes(normalizar(processo))) {
      processos.add(processo)
    }
  }

  for (const processo of extrairProcessosTabela(documento, processosAnamnese)) {
    processos.add(processo)
  }

  return [...processos]
}

function extrairProcessosTabela(documento: string, processosAnamnese: string[] = []) {
  const processos = new Set<string>()
  const esperados = new Set(processosAnamnese.map(normalizar))
  let processoIndex = -1

  for (const line of documento.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed.split('|').slice(1, -1).map((cell) => cell.trim())
    if (cells.some((cell) => /^-+$/.test(cell.replace(/:/g, '').trim()))) continue

    const headerIndex = cells.findIndex((cell) => normalizar(cell) === 'processo')
    if (headerIndex >= 0) {
      processoIndex = headerIndex
      continue
    }

    if (processoIndex >= 0 && cells[processoIndex]) {
      adicionarProcesso(processos, cells[processoIndex], esperados)
    }
  }

  return [...processos]
}

function adicionarProcesso(processos: Set<string>, value: string, esperados: Set<string>) {
  if (processoIgnorado(value)) return

  const partes = value.split(/[,;/]+|\s+e\s+/i).map((item) => item.trim()).filter(Boolean)
  if (partes.length > 1 && partes.every((parte) => esperados.has(normalizar(parte)))) {
    partes.forEach((parte) => processos.add(parte))
    return
  }

  processos.add(value)
}

function processoIgnorado(value: string) {
  const norm = normalizar(value)
  return [
    'requisito',
    'aspectos ambientais',
    'identificacao de perigos e avaliacao de riscos',
    'identificacao de perigos',
    'avaliacao de riscos',
  ].includes(norm)
}

function aliasesCanonicos(codigo: CodigoLeiCanonica) {
  const aliases: Partial<Record<CodigoLeiCanonica, string[]>> = {
    'NBR ISO 14001': ['Sistema de Gestao Ambiental', 'requisitos com orientacoes para uso', 'ISO 14001:2015'],
    'Lei 12.846': ['Lei Anticorrupcao', 'Lei da Empresa Limpa', 'anticorrupcao'],
    'Decreto 11.129': ['Programa de Integridade', 'Regulamenta a Lei Anticorrupcao', 'decreto regulamentador'],
    'Lei 13.709': ['Lei Geral de Protecao de Dados', 'LGPD', 'protecao de dados pessoais'],
    'LGPD': ['Lei Geral de Protecao de Dados', 'protecao de dados pessoais'],
    'Lei 14.457': ['Programa Emprega + Mulheres', 'prevencao ao assedio', 'CIPA', 'assedio sexual'],
    'Lei 8.213': ['Plano de Beneficios da Previdencia Social', 'comunicacao de acidentes', 'acidente de trabalho'],
    'Lei 12.305': ['Politica Nacional de Residuos Solidos', 'PNRS', 'residuos solidos'],
    'NBR 10.004': ['Classificacao de residuos solidos', 'residuos solidos quanto a periculosidade'],
    'NBR 10.007': ['Amostragem de residuos solidos'],
  }

  return aliases[codigo] || []
}

function extrairProcessosPerfil(perfil: ContextoFidelidade['perfilOperacional']) {
  if (!perfil?.processos_provaveis || !Array.isArray(perfil.processos_provaveis)) return []
  return perfil.processos_provaveis.filter((item): item is string => typeof item === 'string')
}

function documentoExigeTodosProcessos(tipoDocumento: string) {
  const tipo = normalizar(tipoDocumento)
  return PROCESSOS_ESCOPO_TOTAL.some((item) => tipo.includes(item))
}

function isMatrizRequisitosLegais(tipoDocumento: string) {
  const tipo = normalizar(tipoDocumento)
  return tipo.includes('matriz') && tipo.includes('requisitos') && tipo.includes('legais')
}

function gerarAliasesEmpresa(nome: string) {
  const semSufixo = nome.replace(/\b(ltda|sa|s\/a|me|eireli)\b\.?/gi, '').replace(/\s+/g, ' ').trim()
  const initials = semSufixo
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .map((part) => part[0])
    .join('')

  return [nome, semSufixo, initials].filter((item) => item.length >= 3)
}

function regexCodigoLei(codigo: CodigoLeiCanonica) {
  const escaped = codigo
    .replace('.', '\\.?')
    .replace('-', '[-\\s]?')
    .replace(/\s+/g, '\\s+')
  return new RegExp(escaped, 'i')
}

function extrairTrechoApos(texto: string, index: number, length: number) {
  return texto.slice(index, index + length).replace(/\s+/g, ' ').trim()
}

function limparDescricaoLegal(trecho: string, codigo: string) {
  return trecho
    .replace(regexCodigoLei(codigo as CodigoLeiCanonica), '')
    .replace(/^[\s:–—-]+/, '')
    .split(/[.;\n|]/)[0]
    .trim()
}

function jaccard(a: string, b: string) {
  const setA = new Set(tokenizar(a))
  const setB = new Set(tokenizar(b))
  if (!setA.size || !setB.size) return 0

  const intersection = [...setA].filter((item) => setB.has(item)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

function tokenizar(value: string) {
  return normalizar(value)
    .split(/\s+/)
    .filter((item) => item.length > 2)
}

function localizar(documento: string, termo: string) {
  const index = normalizar(documento).indexOf(normalizar(termo))
  if (index < 0) return undefined

  const before = documento.slice(0, index)
  const line = before.split('\n').length
  return `linha aproximada ${line}`
}

function dedupeDivergencias(divergencias: Divergencia[]) {
  const seen = new Set<string>()
  const result: Divergencia[] = []

  for (const divergencia of divergencias) {
    const key = [
      divergencia.severidade,
      divergencia.regra,
      JSON.stringify(divergencia.esperado),
      JSON.stringify(divergencia.encontrado),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(divergencia)
  }

  return result
}

function normalizar(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ã§|Ã§/g, 'c')
    .replace(/ã£|Ã£/g, 'a')
    .replace(/ã¡|Ã¡/g, 'a')
    .replace(/ã©|Ã©/g, 'e')
    .replace(/ã­|Ã­/g, 'i')
    .replace(/ã³|Ã³/g, 'o')
    .replace(/ãº|Ãº/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function inferirCategoriaFidelidade(nome: string, tipo: string): CategoriaFidelidade {
  const alvo = normalizar(`${nome} ${tipo}`)
  if (alvo.includes('sst') || alvo.includes('seguranca') || alvo.includes('pcmso') || alvo.includes('pgr ') || alvo === 'pgr') {
    return 'sst'
  }
  if (alvo.includes('ambient') || alvo.includes('aspecto') || alvo.includes('residuo') || alvo.includes('pgrs') || alvo.includes('efluente')) {
    return 'ambiental'
  }
  if (alvo.includes('homolog')) return 'homologacao'
  return 'gestao'
}
