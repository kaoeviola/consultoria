import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { salvarDocumentoAprovado } from '@/lib/memoria'
import { prisma } from '@/lib/prisma'

const documentoUpdateSchema = z.object({
  status: z
    .enum(['pendente', 'em_revisao', 'aprovado', 'exportado', 'entregue', 'aguardando_cliente'])
    .optional(),
  conteudo: z.string().optional().nullable(),
  aprovadoOverrideJustificativa: z.string().trim().min(5).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const documento = await prisma.docProjeto.findUnique({
      where: { id },
      include: {
        versoes: {
          orderBy: { versao: 'asc' },
          select: {
            id: true,
            versao: true,
            createdAt: true,
            alteracoes: true,
            autor: true,
          },
        },
      },
    })

    if (!documento) {
      return NextResponse.json(
        { error: 'Documento não encontrado.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ...documento,
      validacaoAuditoria: getValidacaoAuditoria(documento.metadados),
    })
  } catch (error) {
    console.error('Erro ao buscar documento:', error)
    return NextResponse.json(
      { error: 'Não foi possível buscar o documento.' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const body = await request.json().catch(() => null)
    const data = documentoUpdateSchema.parse(body)
    let metadadosAtuais: unknown = null

    if (data.status === 'aprovado') {
      const atual = await prisma.docProjeto.findUnique({
        where: { id },
        select: {
          metadados: true,
          validacoesFidelidade: {
            orderBy: { executadoEm: 'desc' },
            take: 1,
          },
        },
      })
      metadadosAtuais = atual?.metadados || null
      const validacao = getValidacaoAuditoria(atual?.metadados)
      const validacaoFidelidade = atual?.validacoesFidelidade[0]
      const temOverride = Boolean(data.aprovadoOverrideJustificativa)

      if (validacao?.temProblemasCriticos && !temOverride) {
        return NextResponse.json(
          {
            error: 'Documento possui problemas criticos de auditoria e nao pode ser aprovado.',
            validacaoAuditoria: validacao,
          },
          { status: 400 },
        )
      }

      if (validacaoFidelidade?.bloqueia && !temOverride) {
        return NextResponse.json(
          {
            error: 'Documento possui divergencias criticas de fidelidade e nao pode ser aprovado.',
            validacaoFidelidade,
          },
          { status: 400 },
        )
      }
    }

    const documento = await prisma.docProjeto.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.conteudo !== undefined ? { conteudo: data.conteudo } : {}),
        ...(data.aprovadoOverrideJustificativa
          ? {
              metadados: JSON.parse(JSON.stringify({
                ...(metadadosAtuais && typeof metadadosAtuais === 'object' && !Array.isArray(metadadosAtuais)
                  ? metadadosAtuais
                  : {}),
                aprovacaoOverride: {
                  justificativa: data.aprovadoOverrideJustificativa,
                  aprovadoEm: new Date().toISOString(),
                },
              })) as Prisma.InputJsonValue,
            }
          : {}),
        aprovadoPor: data.status === 'aprovado' ? 'humano' : undefined,
      },
      include: {
        projeto: {
          include: {
            empresa: true,
          },
        },
      },
    })

    if (data.status === 'aprovado') {
      await salvarDocumentoAprovado(
        {
          id: documento.id,
          nome: documento.nome,
          tipo: documento.tipo,
          conteudo: documento.conteudo,
          projetoId: documento.projetoId,
        },
        {
          id: documento.projeto.empresa.id,
          nome: documento.projeto.empresa.nome,
          setor: documento.projeto.empresa.setor,
          setorCodigo: documento.projeto.empresa.setorCodigo,
        },
        documento.projeto.empresa.setorCodigo || documento.projeto.empresa.setor,
      )
    }

    return NextResponse.json(documento)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos.', issues: error.issues },
        { status: 400 },
      )
    }

    console.error('Erro ao atualizar documento:', error)
    return NextResponse.json(
      { error: 'Não foi possível atualizar o documento.' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.docProjeto.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}

function getValidacaoAuditoria(metadados: unknown) {
  if (!metadados || typeof metadados !== 'object') {
    return null
  }

  const validacao = (metadados as { validacaoAuditoria?: unknown }).validacaoAuditoria
  if (!validacao || typeof validacao !== 'object') {
    return null
  }

  return validacao as { temProblemasCriticos?: boolean }
}
