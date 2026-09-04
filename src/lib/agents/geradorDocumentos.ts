import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { gerarCodigoConduta } from '@/lib/agents/documentos/codigoConduta'
import { gerarInventarioRiscos } from '@/lib/agents/documentos/inventarioRiscos'
import { gerarMatrizAspectosImpactos } from '@/lib/agents/documentos/matrizAspectosImpactos'
import { gerarMatrizRequisitosLegais } from '@/lib/agents/documentos/matrizRequisitosLegais'
import { gerarMatrizTreinamentos } from '@/lib/agents/documentos/matrizTreinamentos'
import { gerarPCMSO } from '@/lib/agents/documentos/pcmso'
import { gerarPGR } from '@/lib/agents/documentos/pgr'
import { gerarPGRS } from '@/lib/agents/documentos/pgrs'
import { gerarPlanoEmergencia } from '@/lib/agents/documentos/planoEmergencia'
import { gerarPoliticaCanalDenuncia } from '@/lib/agents/documentos/politicaCanalDenuncia'
import { gerarPoliticaAmbiental } from '@/lib/agents/documentos/politicaAmbiental'
import { gerarPoliticaSST } from '@/lib/agents/documentos/politicaSST'
import { gerarProcedimentoAPR } from '@/lib/agents/documentos/procedimentoAPR'
import { gerarProcedimentoAuditoriaInterna } from '@/lib/agents/documentos/procedimentoAuditoriaInterna'
import { gerarProcedimentoControleOperacionalAmbiental } from '@/lib/agents/documentos/procedimentoControleOperacionalAmbiental'
import { detectarTipoAgente as detectarTipoAgenteDispatch } from '@/lib/agents/dispatch'
import { CONSULTORIA_CONFIG } from '@/lib/config/consultoria'
import { montarContextoCompleto } from '@/lib/contextoDocumental'
import { limparMarkdownFence } from '@/lib/documentos/markdown'
import { buscarPadroesSetor, normalizarSetor } from '@/lib/memoria'
import { prisma } from '@/lib/prisma'

export const detectarTipoAgente = detectarTipoAgenteDispatch

type DocProjetoInput = {
  id?: string
  projetoId?: string
  nome: string
  tipo: string
  gaps?: {
    requisito: string
    status: string
    justificativa: string | null
    documentoEsperado: string | null
  }[]
}

type EmpresaInput = {
  nome: string
  setor: string | null
  setorCodigo?: string | null
  cnae: string | null
  cidade?: string | null
  estado?: string | null
}

type AnamneseInput = {
  numFuncionarios: number | null
  turnos: string | null
  processosPrincipais: string | null
  dadosSetor: unknown
}

export type DocumentoGerado = {
  conteudo: string
  metadados: {
    raciocinioIA?: string
    autoRevisao?: unknown
    agente?: string
    geradoEm: string
    [key: string]: unknown
  }
}

const AGENTES_REGISTRADOS = {
  politica_ambiental: true,
  politica_sst: true,
  matriz_aspectos_impactos: true,
  matriz_aspectos: true,
  matriz_requisitos_legais: true,
  pgrs: true,
  pgr: true,
  pcmso: true,
  plano_emergencia: true,
  inventario_riscos: true,
  apr: true,
  matriz_treinamentos: true,
  codigo_conduta_etica: true,
  codigo_conduta: true,
  politica_canal_denuncia: true,
  procedimento_auditoria_interna: true,
  auditoria_interna: true,
  procedimento_controle_operacional_ambiental: true,
  controle_operacional_ambiental: true,
  procedimento: true,
  plano_acao: true,
} satisfies Record<string, true>

const ALIASES_TIPO_DECLARADO: Record<string, keyof typeof AGENTES_REGISTRADOS> = {
  matriz_aspectos_impactos: 'matriz_aspectos',
  codigo_conduta_etica: 'codigo_conduta',
  procedimento_auditoria_interna: 'auditoria_interna',
  procedimento_controle_operacional_ambiental: 'controle_operacional_ambiental',
}

// Mantido apenas como referência temporária da lógica anterior de dispatch.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function detectarTipoAgenteLegado(nomeDocumento: string, tipoDeclarado?: string | null): string {
  if (tipoDeclarado) {
    const tipoNormalizado = normalizarTipoDeclarado(tipoDeclarado)
    const alias = ALIASES_TIPO_DECLARADO[tipoNormalizado]

    if (alias) return alias
    if (tipoNormalizado in AGENTES_REGISTRADOS) return tipoNormalizado
  }

  const agenteDetectado = detectarPorNome(nomeDocumento)
  if (process.env.NODE_ENV === 'development' && agenteDetectado === 'generico') {
    console.warn(
      `[DISPATCH WARN] Documento "${nomeDocumento}" caiu em "generico". Tipo declarado: "${tipoDeclarado || 'nao informado'}". Verifique mapeamento.`,
    )
  }

  return agenteDetectado
}

function detectarPorNome(nome: string) {
  const n = normalizarNomeDocumento(nome)

  if (n.includes('politica ambiental')) return 'politica_ambiental'
  if (n.includes('politica') && (n.includes('sst') || n.includes('seguranca') || n.includes('saude'))) {
    return 'politica_sst'
  }
  if (n.includes('pgrs') || (n.includes('residuos') && n.includes('solidos')) || n.includes('gerenciamento de residuos')) return 'pgrs'
  if (n === 'pgr' || n.includes('programa de gerenciamento de riscos')) return 'pgr'
  if (n.includes('pcmso') || n.includes('controle medico')) return 'pcmso'
  if (n.includes('matriz') && n.includes('requisito') && (n.includes('legal') || n.includes('legais'))) return 'matriz_requisitos_legais'
  if (n.includes('matriz') && n.includes('aspecto')) return 'matriz_aspectos'
  if (n.includes('inventario') && n.includes('risco')) return 'inventario_riscos'
  if (n.includes('apr') || n.includes('analise preliminar')) return 'apr'
  if (n.includes('plano') && n.includes('emergencia')) return 'plano_emergencia'
  if (n.includes('pae')) return 'plano_emergencia'
  if (n.includes('matriz') && n.includes('treinamento')) return 'matriz_treinamentos'
  if (n.includes('codigo') && n.includes('conduta')) return 'codigo_conduta'
  if (n.includes('canal') && n.includes('denuncia')) return 'politica_canal_denuncia'
  if (n.includes('auditoria') && n.includes('interna')) return 'auditoria_interna'
  if (n.includes('controle') && n.includes('operacional') && n.includes('ambiental')) return 'controle_operacional_ambiental'
  if (n.includes('procedimento')) return 'procedimento'
  if (n.includes('plano de acao')) return 'plano_acao'

  return 'generico'
}

function normalizarTipoDeclarado(value: string) {
  return normalizarNomeDocumento(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizarNomeDocumento(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ã£|ã£/g, 'a')
    .replace(/Ã¡|ã¡/g, 'a')
    .replace(/Ã¢|ã¢/g, 'a')
    .replace(/Ã©|ã©/g, 'e')
    .replace(/Ãª|ãª/g, 'e')
    .replace(/Ã­|ã­/g, 'i')
    .replace(/Ã³|ã³/g, 'o')
    .replace(/Ãµ|ãµ/g, 'o')
    .replace(/Ãº|ãº/g, 'u')
    .replace(/Ã§|ã§/g, 'c')
}

function formatarContextoDocumental(contexto: Awaited<ReturnType<typeof montarContextoCompleto>>) {
  if (!contexto) return 'Contexto documental disponivel: nao localizado.'

  return [
    `Qualidade do contexto: ${contexto.qualidadeContexto}%`,
    'Anamnese estruturada:',
    `Processos principais declarados na anamnese: ${contexto.anamnese?.processosPrincipais || 'nao informado'}`,
    JSON.stringify(contexto.anamnese?.dadosSetor || {}, null, 2),
    '',
    'Arquivos processados e contexto extraido:',
    contexto.arquivosProcessados.length
      ? JSON.stringify(
          contexto.arquivosProcessados.map((arquivo) => ({
            nome: arquivo.nome,
            tipo: arquivo.tipo,
            metadados: arquivo.metadados,
          })),
          null,
          2,
        )
      : 'Nenhum arquivo processado por IA.',
    '',
    'Ontologia do setor:',
    JSON.stringify(contexto.ontologia, null, 2),
  ].join('\n')
}

function baseContext(
  docProjeto: DocProjetoInput,
  empresa: EmpresaInput,
  anamnese: AnamneseInput | null,
  perfilOperacional: unknown,
) {
  return [
    `Documento solicitado: ${docProjeto.nome}`,
    `Tipo interno: ${docProjeto.tipo}`,
    `Empresa: ${empresa.nome}`,
    `Setor: ${empresa.setor || 'nao informado'}`,
    `Setor na ontologia: ${empresa.setorCodigo || 'nao informado'}`,
    `CNAE: ${empresa.cnae || 'nao informado'}`,
    `Localizacao: ${[empresa.cidade, empresa.estado].filter(Boolean).join(', ') || 'nao informada'}`,
    `Numero de funcionarios: ${anamnese?.numFuncionarios ?? 'nao informado'}`,
    `Turnos: ${anamnese?.turnos || 'nao informado'}`,
    `Processos principais: ${anamnese?.processosPrincipais || 'nao informado'}`,
    `Dados adicionais da anamnese: ${JSON.stringify(anamnese?.dadosSetor || {})}`,
    `Perfil operacional: ${JSON.stringify(perfilOperacional || {})}`,
  ].join('\n')
}

async function montarContexto(
  docProjeto: DocProjetoInput,
  empresa: EmpresaInput,
  anamnese: AnamneseInput | null,
  perfilOperacional: unknown,
) {
  const contextoDocumental = docProjeto.projetoId
    ? await montarContextoCompleto(docProjeto.projetoId)
    : null
  const configuracao = await prisma.configuracaoConsultoria.findFirst({
    orderBy: { updatedAt: 'desc' },
  })
  const contextoConsultoria = {
    nome: configuracao?.nome || CONSULTORIA_CONFIG.nome,
    nomeCompleto: configuracao?.nomeCompleto || CONSULTORIA_CONFIG.nomeCompleto,
    slogan: configuracao?.slogan || CONSULTORIA_CONFIG.slogan,
    responsavelTecnico: {
      nome: configuracao?.responsavelNome || null,
      registro: configuracao?.responsavelRegistro || null,
      cargo: configuracao?.responsavelCargo || null,
    },
  }
  const contextoCompleto = [
    'Configuracao da consultoria responsavel:',
    JSON.stringify(contextoConsultoria, null, 2),
    '',
    'Contexto documental disponivel:',
    formatarContextoDocumental(contextoDocumental),
    '',
    baseContext(docProjeto, empresa, anamnese, perfilOperacional),
    docProjeto.gaps?.length
      ? `\nGaps do projeto:\n${JSON.stringify(docProjeto.gaps)}`
      : '\nGaps do projeto: nenhum gap informado.',
  ].join('\n')

  return { contextoDocumental, contextoCompleto }
}

export async function gerarDocumento(
  docProjeto: DocProjetoInput,
  empresa: EmpresaInput,
  anamnese: AnamneseInput | null,
  perfilOperacional: unknown,
): Promise<DocumentoGerado> {
  const tipo = detectarTipoAgente(docProjeto.nome, docProjeto.tipo)
  console.log(`[GERADOR] Documento: "${docProjeto.nome}" tipo declarado: "${docProjeto.tipo}" -> agente: ${tipo}`)

  const { contextoDocumental, contextoCompleto } = await montarContexto(
    docProjeto,
    empresa,
    anamnese,
    perfilOperacional,
  )

  if (tipo === 'politica_ambiental') {
    return withGeradoEm(
      await gerarPoliticaAmbiental({
        empresa,
        perfilOperacional,
        arquivosAnalisados: contextoDocumental?.arquivosProcessados || [],
        ontologiaSetor: contextoDocumental?.ontologia || {},
        contextoCompleto,
        docProjetoId: docProjeto.id,
      }),
    )
  }

  if (tipo === 'politica_sst') {
    return withGeradoEm(
      await gerarPoliticaSST({
        empresa,
        perfilOperacional,
        contextoCompleto,
        docProjetoId: docProjeto.id,
      }),
    )
  }

  if (tipo === 'pgr') {
    return withGeradoEm(
      await gerarPGR({
        empresa,
        perfilOperacional,
        setoresIdentificados: anamnese?.dadosSetor || {},
        arquivosAnalisados: contextoDocumental?.arquivosProcessados || [],
        ontologiaSetor: contextoDocumental?.ontologia || {},
        contextoCompleto,
        docProjetoId: docProjeto.id,
      }),
    )
  }

  if (tipo === 'pcmso') {
    return withGeradoEm(
      await gerarPCMSO({
        empresa,
        perfilOperacional,
        arquivosAnalisados: contextoDocumental?.arquivosProcessados || [],
        ontologiaSetor: contextoDocumental?.ontologia || {},
        contextoCompleto,
        docProjetoId: docProjeto.id,
      }),
    )
  }

  if (tipo === 'matriz_aspectos') {
    return withGeradoEm(await gerarMatrizAspectosImpactos(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'matriz_requisitos_legais') {
    return withGeradoEm(await gerarMatrizRequisitosLegais(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'inventario_riscos') {
    return withGeradoEm(await gerarInventarioRiscos(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'plano_emergencia') {
    return withGeradoEm(await gerarPlanoEmergencia(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'pgrs') {
    return withGeradoEm(await gerarPGRS(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'apr') {
    return withGeradoEm(await gerarProcedimentoAPR(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'matriz_treinamentos') {
    return withGeradoEm(await gerarMatrizTreinamentos(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'codigo_conduta') {
    return withGeradoEm(await gerarCodigoConduta(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'politica_canal_denuncia') {
    return withGeradoEm(await gerarPoliticaCanalDenuncia(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'auditoria_interna') {
    return withGeradoEm(await gerarProcedimentoAuditoriaInterna(contextoCompleto, docProjeto.id))
  }

  if (tipo === 'controle_operacional_ambiental') {
    return withGeradoEm(await gerarProcedimentoControleOperacionalAmbiental(contextoCompleto, docProjeto.id))
  }

  return gerarDocumentoGenerico(docProjeto, empresa, contextoCompleto)
}

async function gerarDocumentoGenerico(
  docProjeto: DocProjetoInput,
  empresa: EmpresaInput,
  contextoCompleto: string,
): Promise<DocumentoGerado> {
  const setorReferencia = normalizarSetor(empresa.setorCodigo || empresa.setor)
  const padroesSetor = await buscarPadroesSetor(setorReferencia, docProjeto.tipo || docProjeto.nome)
  const referencias = padroesSetor.length
    ? [
        'Exemplos de referencia aprovados pela consultoria:',
        ...padroesSetor.map((padrao, index) =>
          [
            `Exemplo ${index + 1}: ${padrao.nome}`,
            `Setor: ${padrao.setor}`,
            `Tipo: ${padrao.tipo}`,
            'Conteudo aprovado:',
            padrao.conteudo.slice(0, 4000),
          ].join('\n'),
        ),
      ].join('\n\n')
    : 'Nenhum documento aprovado anterior encontrado para este setor/tipo.'
  const userPrompt = [
    'Gere um documento tecnico em Markdown estruturado, especifico para a empresa.',
    'Use documentos aprovados como referencia de qualidade e especificidade quando existirem.',
    'Nao invente dados ausentes; marque como precisa validacao.',
    '',
    referencias,
    '',
    contextoCompleto,
  ].join('\n')
  const { resultado, raciocinio } = await executarComRaciocinio(
    'Voce e consultor senior em ISO 14001, ISO 45001 e SST. Gere documentos tecnicos auditaveis.',
    userPrompt,
    undefined,
    { docProjetoId: docProjeto.id, maxTokens: 3500 },
  )

  return {
    conteudo: limparMarkdownFence(String(resultado)),
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'genericoComCOT',
      geradoEm: new Date().toISOString(),
    },
  }
}

function withGeradoEm(gerado: Omit<DocumentoGerado, 'metadados'> & { metadados: Record<string, unknown> }): DocumentoGerado {
  return {
    conteudo: limparMarkdownFence(gerado.conteudo),
    metadados: {
      ...gerado.metadados,
      geradoEm: new Date().toISOString(),
    },
  }
}
