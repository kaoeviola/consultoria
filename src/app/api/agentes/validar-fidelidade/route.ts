import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { jsonErrorResponse } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'
import { inferirCategoriaFidelidade, validarFidelidade } from '@/lib/validador/fidelidade'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const docProjetoId = String(body?.docProjetoId || '')

    if (!docProjetoId) {
      return NextResponse.json({ error: 'docProjetoId e obrigatorio.' }, { status: 400 })
    }

    const documento = await prisma.docProjeto.findUnique({
      where: { id: docProjetoId },
      include: {
        projeto: {
          include: {
            empresa: true,
            anamnese: true,
          },
        },
      },
    })

    if (!documento) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404 })
    }

    if (!documento.conteudo) {
      return NextResponse.json({ error: 'Documento ainda nao possui conteudo.' }, { status: 400 })
    }

    if (!documento.projeto.anamnese) {
      return NextResponse.json({ error: 'Projeto sem anamnese para validar fidelidade.' }, { status: 400 })
    }

    const empresasRegistradas = await prisma.empresa.findMany({
      select: { nome: true },
    })
    const categoria = inferirCategoriaFidelidade(documento.nome, documento.tipo)
    const resultado = await validarFidelidade(documento.conteudo, {
      empresa: documento.projeto.empresa,
      projeto: documento.projeto,
      anamnese: documento.projeto.anamnese,
      perfilOperacional: documento.projeto.anamnese.perfilOperacional as Record<string, unknown>,
      tipoDocumento: documento.nome,
      categoria,
      empresasRegistradas: empresasRegistradas.map((empresa) => empresa.nome),
    })

    const validacao = await prisma.validacaoFidelidade.create({
      data: {
        docProjetoId: documento.id,
        versao: documento.versao,
        score: resultado.score,
        divergencias: resultado.divergencias as unknown as Prisma.InputJsonValue,
        criticas: resultado.contagem.criticas,
        altas: resultado.contagem.altas,
        medias: resultado.contagem.medias,
        infos: resultado.contagem.infos,
        bloqueia: resultado.bloqueia,
      },
    })

    return NextResponse.json({
      ...resultado,
      id: validacao.id,
      docProjetoId: documento.id,
      versao: documento.versao,
      executadoEm: validacao.executadoEm,
    })
  } catch (error) {
    return jsonErrorResponse(error, '[API ERROR] validar-fidelidade')
  }
}
