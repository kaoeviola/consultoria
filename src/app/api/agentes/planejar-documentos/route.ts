import { NextResponse } from 'next/server'
import { z } from 'zod'
import { planejarDocumentos } from '@/lib/agents/planejadorDocumentos'
import {
  CATEGORIAS_DOCUMENTO,
  getDocumentoInfo,
  getDocumentosRecomendadosPorSetor,
} from '@/lib/ontologia/documentos'
import { jsonErrorResponse } from '@/lib/api-error'
import { getProjetoDashboard } from '@/lib/projeto-dashboard'
import { prisma } from '@/lib/prisma'

const requestSchema = z.object({
  projetoId: z.string().trim().min(1, 'Projeto é obrigatório.'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { projetoId } = requestSchema.parse(body)
    const dashboard = await getProjetoDashboard(projetoId)

    if (!dashboard) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const setor = dashboard.empresa.setorCodigo || dashboard.empresa.setor || 'outro'
    const ontologia = await prisma.setorIndustrial.findFirst({
      where: { codigo: setor },
      include: {
        processos: {
          include: {
            riscosSST: true,
            aspectosAmbientais: true,
          },
        },
      },
    })
    const documentosObrigatorios = await prisma.documentoObrigatorio.findMany({
      where: { setores: { has: setor } },
      orderBy: { nome: 'asc' },
    })

    const plano = await planejarDocumentos(dashboard.projeto, dashboard.gapAnalysis, {
      setor: ontologia,
      documentosObrigatorios,
      documentosExistentes: dashboard.documentos.map((documento) => ({
        nome: documento.nome,
        tipo: documento.tipo,
        status: documento.status,
      })),
    })

    const recomendados = dedupeDocumentos([
      ...documentosDosGaps(dashboard.gapAnalysis),
      ...documentosTipicosPorSetor(setor, documentosObrigatorios.map((documento) => documento.nome)),
      ...plano.documentos_gerar_agora.map((documento) => ({ ...documento, status: 'pendente' })),
      ...plano.documentos_gerar_depois.map((documento) => ({ ...documento, status: 'pendente' })),
      ...plano.documentos_solicitar_cliente.map((documento) => ({ ...documento, status: 'aguardando_cliente' })),
      ...plano.documentos_urgentes.map((documento) => ({
        ...documento,
        status: inferTipo(documento.nome) === 'exigivel_cliente' ? 'aguardando_cliente' : 'pendente',
      })),
    ])
    const criados = []

    for (const documento of recomendados) {
      const exists = await prisma.docProjeto.findFirst({
        where: {
          projetoId,
          nome: documento.nome,
        },
      })

      if (exists) {
        const requisitosOrigem = Array.from(
          new Set([...(exists.requisitosOrigem || []), ...(documento.requisitosOrigem || [])]),
        )
        if (requisitosOrigem.length !== exists.requisitosOrigem.length) {
          await prisma.docProjeto.update({
            where: { id: exists.id },
            data: { requisitosOrigem },
          })
        }
        continue
      }

      criados.push(
        await prisma.docProjeto.create({
          data: {
            projetoId,
            nome: documento.nome,
            tipo: documento.tipo || inferTipo(documento.nome),
            status: documento.status,
            requisitosOrigem: documento.requisitosOrigem || [],
            conteudo: null,
          },
        }),
      )
    }

    return NextResponse.json({ plano, documentosCriados: criados })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos.', issues: error.issues },
        { status: 400 },
      )
    }

    return jsonErrorResponse(error, '[API ERROR] planejar-documentos')
  }
}

type DocumentoRecomendado = {
  nome: string
  tipo: string
  prioridade: number
  motivo: string
  dependencias: string[]
  requisitosOrigem: string[]
  status: 'pendente' | 'aguardando_cliente'
}

function documentosDosGaps(gapAnalysis: unknown): DocumentoRecomendado[] {
  const itens = (gapAnalysis as { itens?: GapItem[] } | null)?.itens || []

  return itens
    .filter((item) => ['nao_atende', 'atende_parcialmente', 'precisa_validacao'].includes(item.status))
    .filter((item) => item.requisito?.documentoEsperado)
    .map((item) => {
      const nome = item.requisito?.documentoEsperado || 'Documento de evidÃªncia'
      const tipo = inferTipo(nome)

      return {
        nome,
        tipo,
        prioridade: item.status === 'nao_atende' ? 5 : 3,
        motivo: `Identificado no gap do requisito ${item.requisito?.codigo || item.requisito?.titulo || item.requisitoId}`,
        dependencias: [],
        requisitosOrigem: item.requisito?.id ? [item.requisito.id] : [],
        status: tipo === 'exigivel_cliente' || tipo === 'requer_parceria_tecnica' ? 'aguardando_cliente' : 'pendente',
      }
    })
}

type GapItem = {
  status: string
  requisitoId?: string
  requisito?: {
    id?: string
    codigo?: string | null
    titulo?: string | null
    documentoEsperado?: string | null
  }
}

function documentosTipicosPorSetor(setor: string, obrigatorios: string[]): DocumentoRecomendado[] {
  const documentos = [
    ...getDocumentosRecomendadosPorSetor(setor),
    ...obrigatorios.map((nome) => ({
      nome,
      categoriaAutonomia: CATEGORIAS_DOCUMENTO.EXIGIVEL_CLIENTE,
    })),
  ]

  return documentos.map((documento) => {
    const nome = documento.nome
    const tipo = inferTipo(nome)

    return {
      nome,
      tipo,
      prioridade: tipo === 'exigivel_cliente' || tipo === 'requer_parceria_tecnica' ? 5 : 3,
      motivo: `Documento tÃ­pico ou obrigatÃ³rio do setor ${setor || 'informado'}.`,
      dependencias: [],
      requisitosOrigem: [],
      status: tipo === 'exigivel_cliente' || tipo === 'requer_parceria_tecnica' ? 'aguardando_cliente' : 'pendente',
    }
  })
}

function dedupeDocumentos(
  documentos: Array<Omit<Partial<DocumentoRecomendado>, 'status'> & { nome: string; status?: string }>,
): DocumentoRecomendado[] {
  const unique = new Map<string, DocumentoRecomendado>()

  for (const documento of documentos) {
    const key = normalize(documento.nome)
    const tipo = documento.tipo || inferTipo(documento.nome)
    const atual = unique.get(key)
    const normalized: DocumentoRecomendado = {
      nome: documento.nome,
      tipo,
      prioridade: documento.prioridade || 3,
      motivo: documento.motivo || 'Documento recomendado pelo planejamento do projeto.',
      dependencias: documento.dependencias || [],
      requisitosOrigem: documento.requisitosOrigem || [],
      status: normalizeStatus(documento.status, tipo),
    }

    if (!atual) {
      unique.set(key, normalized)
      continue
    }

    unique.set(key, {
      ...atual,
      prioridade: Math.max(atual.prioridade, normalized.prioridade),
      requisitosOrigem: Array.from(new Set([...atual.requisitosOrigem, ...normalized.requisitosOrigem])),
      status:
        atual.status === 'aguardando_cliente' || normalized.status === 'aguardando_cliente'
          ? 'aguardando_cliente'
          : 'pendente',
    })
  }

  return Array.from(unique.values())
}

function inferTipo(nome: string) {
  const info = getDocumentoInfo(nome)
  if (info?.categoriaAutonomia === CATEGORIAS_DOCUMENTO.REQUER_PARCERIA_TECNICA) {
    return 'requer_parceria_tecnica'
  }
  if (info?.categoriaAutonomia === CATEGORIAS_DOCUMENTO.EXIGIVEL_CLIENTE) {
    return 'exigivel_cliente'
  }
  if (info?.categoriaAutonomia === CATEGORIAS_DOCUMENTO.CONSULTORIA_AUTONOMA) {
    return 'geravel_ia'
  }

  const n = normalize(nome)
  if (n.includes('pgrs')) {
    return 'geravel_ia'
  }
  if (['pgr', 'pcmso', 'avcb', 'clcb', 'alvara', 'licenca'].some((term) => n.includes(term))) {
    return 'exigivel_cliente'
  }
  if (
    n.includes('politica') ||
    n.includes('matriz') ||
    n.includes('inventario') ||
    n.includes('plano') ||
    n.includes('procedimento') ||
    n.includes('pgrs')
  ) {
    return 'geravel_ia'
  }
  return 'semi_geravel'
}

function normalizeStatus(status: string | undefined, tipo: string): 'pendente' | 'aguardando_cliente' {
  if (status === 'pendente' || status === 'aguardando_cliente') {
    return status
  }

  return tipo === 'exigivel_cliente' || tipo === 'requer_parceria_tecnica'
    ? 'aguardando_cliente'
    : 'pendente'
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
