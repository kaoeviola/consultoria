import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CONSULTORIA_CONFIG } from '@/lib/config/consultoria'
import { prisma } from '@/lib/prisma'

const configuracaoSchema = z.object({
  nome: z.string().trim().min(1),
  nomeConsultoria: z.string().trim().optional().nullable(),
  nomeCompleto: z.string().trim().optional().nullable(),
  slogan: z.string().trim().optional().nullable(),
  corPrimaria: z.string().trim().min(1),
  corSecundaria: z.string().trim().min(1),
  logoUrl: z.string().trim().optional().nullable(),
  responsavelNome: z.string().trim().optional().nullable(),
  responsavelRegistro: z.string().trim().optional().nullable(),
  responsavelTecnico: z.string().trim().optional().nullable(),
  registroResponsavel: z.string().trim().optional().nullable(),
  responsavelCargo: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  site: z.string().trim().optional().nullable(),
})

export async function GET() {
  const config = await getOrCreateConfig()
  return NextResponse.json(config)
}

export async function PUT(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const body = contentType.includes('multipart/form-data')
      ? await parseFormData(await request.formData())
      : await request.json()
    const data = configuracaoSchema.parse(body)
    const normalizedData = {
      ...data,
      nomeConsultoria: data.nomeConsultoria || data.nome,
      responsavelTecnico: data.responsavelTecnico || data.responsavelNome,
      registroResponsavel: data.registroResponsavel || data.responsavelRegistro,
    }
    const current = await getOrCreateConfig()
    const config = await prisma.configuracaoConsultoria.update({
      where: { id: current.id },
      data: normalizedData,
    })

    return NextResponse.json(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos.', issues: error.issues },
        { status: 400 },
      )
    }

    console.error('Erro ao salvar configurações:', error)
    return NextResponse.json(
      { error: 'Não foi possível salvar as configurações.' },
      { status: 500 },
    )
  }
}

async function getOrCreateConfig() {
  const config = await prisma.configuracaoConsultoria.findFirst({
    orderBy: { updatedAt: 'desc' },
  })

  if (config) return config

  return prisma.configuracaoConsultoria.create({
    data: {
      nome: CONSULTORIA_CONFIG.nome,
      nomeConsultoria: CONSULTORIA_CONFIG.nome,
      nomeCompleto: CONSULTORIA_CONFIG.nomeCompleto,
      slogan: CONSULTORIA_CONFIG.slogan,
      corPrimaria: CONSULTORIA_CONFIG.corPrimaria,
      corSecundaria: CONSULTORIA_CONFIG.corSecundaria,
      responsavelTecnico: CONSULTORIA_CONFIG.responsavelTecnico,
      registroResponsavel: CONSULTORIA_CONFIG.registroResponsavel,
    },
  })
}

async function parseFormData(formData: FormData) {
  const logo = formData.get('logo')
  const logoUrl =
    logo instanceof File && logo.size > 0 ? await fileToDataUrl(logo) : formData.get('logoUrl')?.toString()

  return {
    nome: formData.get('nome')?.toString() || CONSULTORIA_CONFIG.nome,
    nomeConsultoria: formData.get('nomeConsultoria')?.toString() || formData.get('nome')?.toString() || CONSULTORIA_CONFIG.nome,
    nomeCompleto: formData.get('nomeCompleto')?.toString() || null,
    slogan: formData.get('slogan')?.toString() || null,
    corPrimaria: formData.get('corPrimaria')?.toString() || CONSULTORIA_CONFIG.corPrimaria,
    corSecundaria: formData.get('corSecundaria')?.toString() || CONSULTORIA_CONFIG.corSecundaria,
    logoUrl: logoUrl || null,
    responsavelNome: formData.get('responsavelNome')?.toString() || null,
    responsavelRegistro: formData.get('responsavelRegistro')?.toString() || null,
    responsavelTecnico: formData.get('responsavelTecnico')?.toString() || formData.get('responsavelNome')?.toString() || null,
    registroResponsavel: formData.get('registroResponsavel')?.toString() || formData.get('responsavelRegistro')?.toString() || null,
    responsavelCargo: formData.get('responsavelCargo')?.toString() || null,
    endereco: formData.get('endereco')?.toString() || null,
    telefone: formData.get('telefone')?.toString() || null,
    email: formData.get('email')?.toString() || null,
    site: formData.get('site')?.toString() || null,
  }
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  return `data:${file.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`
}
