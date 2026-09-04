import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { jsonErrorResponse } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

type DadosSetor = {
  produtosQuimicos?: string | null
  residuosPerigosos?: string | null
  observacoesGerais?: string | null
}

function normalizeDadosSetor(value: unknown): DadosSetor {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as DadosSetor
  }

  return {}
}

export async function POST(request: NextRequest) {
  try {
    const { projetoId } = await request.json()

    console.log('=== PERFIL OPERACIONAL ===')
    console.log('projetoId:', projetoId)
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
    console.log('OPENAI_API_KEY prefix:', process.env.OPENAI_API_KEY?.substring(0, 20))

    if (!projetoId) {
      return NextResponse.json({ error: 'projetoId obrigatorio' }, { status: 400 })
    }

    const projeto = await prisma.projeto.findUnique({
      where: { id: projetoId },
      include: { empresa: true, anamnese: true },
    })

    if (!projeto) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const dadosSetor = normalizeDadosSetor(projeto.anamnese?.dadosSetor)

    const prompt = `Voce e especialista em SST e ISO 14001/45001. Analise e retorne APENAS JSON valido:

Empresa: ${projeto.empresa.nome}
Setor: ${projeto.empresa.setor}
CNAE: ${projeto.empresa.cnae}
Funcionarios: ${projeto.anamnese?.numFuncionarios}
Processos: ${projeto.anamnese?.processosPrincipais}
Produtos quimicos: ${dadosSetor.produtosQuimicos}
Residuos perigosos: ${dadosSetor.residuosPerigosos}
Observacoes: ${dadosSetor.observacoesGerais}

Retorne JSON com: processos_provaveis, riscos_sst, aspectos_ambientais, documentos_esperados, legislacao_aplicavel, observacoes`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Retorne APENAS JSON valido, sem markdown, sem explicacoes.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })

    const perfil = JSON.parse(response.choices[0].message.content || '{}')

    await prisma.anamnese.update({
      where: { projetoId },
      data: { perfilOperacional: perfil },
    })

    return NextResponse.json({ perfil })
  } catch (error: unknown) {
    return jsonErrorResponse(error, '[API ERROR] perfil-operacional')
  }
}
