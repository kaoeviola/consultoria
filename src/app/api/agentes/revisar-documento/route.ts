import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revisarDocumento } from '@/lib/agents/revisorTecnico'
import { jsonErrorResponse } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

const requestSchema = z.object({
  docProjetoId: z.string().trim().min(1, 'Documento e obrigatorio'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { docProjetoId } = requestSchema.parse(body)

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
      return NextResponse.json({ error: 'Gere o documento antes de revisar.' }, { status: 400 })
    }

    const revisao = await revisarDocumento(
      documento.conteudo,
      {
        nome: documento.projeto.empresa.nome,
        setor: documento.projeto.empresa.setor,
        cnae: documento.projeto.empresa.cnae,
      },
      documento.projeto.anamnese?.perfilOperacional || null,
      documento.nome,
    )

    return NextResponse.json(revisao)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados invalidos.', issues: error.issues },
        { status: 400 },
      )
    }

    return jsonErrorResponse(error, '[API ERROR] revisar-documento')
  }
}
