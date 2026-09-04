import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gerarDiagnosticoInicial } from '@/lib/agents/diagnosticoInicial'
import { jsonErrorResponse } from '@/lib/api-error'
import { getProjetoDashboard } from '@/lib/projeto-dashboard'
import { prisma } from '@/lib/prisma'

const requestSchema = z.object({
  projetoId: z.string().trim().min(1, 'Projeto e obrigatorio.'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { projetoId } = requestSchema.parse(body)
    const dashboard = await getProjetoDashboard(projetoId)

    if (!dashboard) {
      return NextResponse.json({ error: 'Projeto nao encontrado.' }, { status: 404 })
    }

    const conteudo = await gerarDiagnosticoInicial(
      dashboard.projeto,
      dashboard.empresa,
      dashboard.anamnese,
      dashboard.perfilOperacional,
      dashboard.gapAnalysis,
    )

    const documentoExistente = await prisma.docProjeto.findFirst({
      where: {
        projetoId,
        nome: 'Relatorio de Diagnostico Inicial',
      },
    })

    const documento = documentoExistente
      ? await prisma.docProjeto.update({
          where: { id: documentoExistente.id },
          data: {
            conteudo,
            tipo: 'geravel_ia',
            status: 'em_revisao',
          },
        })
      : await prisma.docProjeto.create({
          data: {
            projetoId,
            nome: 'Relatorio de Diagnostico Inicial',
            tipo: 'geravel_ia',
            status: 'em_revisao',
            conteudo,
          },
        })

    return NextResponse.json(documento)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados invalidos.', issues: error.issues },
        { status: 400 },
      )
    }

    return jsonErrorResponse(error, '[API ERROR] diagnostico')
  }
}
