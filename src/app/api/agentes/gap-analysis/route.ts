import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gerarGapAnalysis } from '@/lib/agents/gapAnalysis'
import { jsonErrorResponse } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

const requestSchema = z.object({
  avaliacaoId: z.string().trim().min(1, 'Avaliacao e obrigatoria'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { avaliacaoId } = requestSchema.parse(body)

    const avaliacao = await prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: {
        projeto: {
          include: {
            empresa: true,
            anamnese: true,
          },
        },
        modelo: true,
        itens: {
          include: {
            requisito: true,
          },
        },
      },
    })

    if (!avaliacao) {
      return NextResponse.json({ error: 'Avaliacao nao encontrada.' }, { status: 404 })
    }

    if (!avaliacao.projeto.anamnese?.perfilOperacional) {
      return NextResponse.json(
        { error: 'Gere o perfil operacional antes de sugerir o gap analysis.' },
        { status: 400 },
      )
    }

    const sugestoes = await gerarGapAnalysis(
      {
        projetoId: avaliacao.projetoId,
        modelo: {
          nome: avaliacao.modelo.nome,
          categoria: avaliacao.modelo.categoria,
          versao: avaliacao.modelo.versao,
        },
        itens: avaliacao.itens.map((item) => ({
          requisito: {
            id: item.requisito.id,
            codigo: item.requisito.codigo,
            titulo: item.requisito.titulo,
            descricao: item.requisito.descricao,
            categoria: item.requisito.categoria,
            evidenciaEsperada: item.requisito.evidenciaEsperada,
            documentoEsperado: item.requisito.documentoEsperado,
          },
        })),
      },
      avaliacao.projeto.anamnese.perfilOperacional,
      {
        nome: avaliacao.projeto.empresa.nome,
        setor: avaliacao.projeto.empresa.setor,
        cnae: avaliacao.projeto.empresa.cnae,
      },
    )

    const itemByRequisito = new Map(
      avaliacao.itens.map((item) => [item.requisitoId, item]),
    )

    for (const sugestao of sugestoes) {
      const item = itemByRequisito.get(sugestao.requisitoId)

      if (!item) continue

      await prisma.itemAvaliacao.update({
        where: { id: item.id },
        data: {
          status: sugestao.status,
          confiancaIA: sugestao.confianca,
          observacao: `[IA] ${sugestao.justificativa}`,
        },
      })
    }

    return NextResponse.json({ sugestoes })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados invalidos.', issues: error.issues },
        { status: 400 },
      )
    }

    return jsonErrorResponse(error, '[API ERROR] gap-analysis')
  }
}
