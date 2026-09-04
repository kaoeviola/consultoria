import { NextResponse } from 'next/server'

type ErrorLike = {
  message?: string
  code?: string
  meta?: unknown
  stack?: string
  constructor?: { name?: string }
}

export function jsonErrorResponse(error: unknown, label = '[API ERROR]') {
  const err = error as ErrorLike
  const isPrismaError = Boolean(err?.constructor?.name?.includes('Prisma'))
  const detalhe = {
    error: err?.message || 'Erro desconhecido',
    code: err?.code,
    meta: err?.meta,
    prismaError: isPrismaError,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  }

  console.error(label, detalhe)
  return NextResponse.json(detalhe, { status: 500 })
}
