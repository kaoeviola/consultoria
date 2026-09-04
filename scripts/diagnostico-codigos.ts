import { PrismaClient } from '@prisma/client'
import { detectarCodigoDocumento } from '../src/lib/documentos/codigo'

const prisma = new PrismaClient()
const projetoId = 'cmq2yrsog0001rvw851s1i0co'

async function main() {
  const fields = Object.keys((prisma.docProjeto as unknown as { fields?: Record<string, unknown> }).fields || {})
  const hasCodigoField = fields.includes('codigo')

  console.log('DocProjeto tem campo codigo no Prisma Client:', hasCodigoField)

  const docs = await prisma.docProjeto.findMany({
    where: { projetoId },
    select: {
      id: true,
      nome: true,
      tipo: true,
      versao: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const sequenciais = new Map<string, number>()
  const docsOrdenados = [...docs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const sequencialPorId = new Map<string, number>()

  for (const doc of docsOrdenados) {
    let prefixo = 'SEM-CODIGO'

    try {
      prefixo = detectarCodigoDocumento(doc.nome, doc.tipo, 1).replace(/-\d{3}$/, '')
    } catch {
      // Erro sera exibido no mapa final.
    }

    const next = (sequenciais.get(prefixo) || 0) + 1
    sequenciais.set(prefixo, next)
    sequencialPorId.set(doc.id, next)
  }

  const docsComCodigo = docs.map((doc) => {
    let codigoCalculado: string | null = null
    let erroCodigo: string | null = null

    try {
      codigoCalculado = detectarCodigoDocumento(doc.nome, doc.tipo, sequencialPorId.get(doc.id) || 1)
    } catch (error) {
      erroCodigo = error instanceof Error ? error.message : String(error)
    }

    return {
      ...doc,
      codigoCalculado,
      erroCodigo,
    }
  })

  console.log('Documentos do projeto:')
  console.log(JSON.stringify(docsComCodigo, null, 2))

  const porCodigo = new Map<string, typeof docsComCodigo>()
  for (const doc of docsComCodigo) {
    if (!doc.codigoCalculado) continue
    const bucket = porCodigo.get(doc.codigoCalculado) || []
    bucket.push(doc)
    porCodigo.set(doc.codigoCalculado, bucket)
  }

  const duplicados = Array.from(porCodigo.entries())
    .filter(([, items]) => items.length > 1)
    .map(([codigo, items]) => ({
      codigo,
      count: items.length,
      documentos: items.map((item) => ({
        id: item.id,
        nome: item.nome,
        tipo: item.tipo,
        versao: item.versao,
        createdAt: item.createdAt,
      })),
    }))

  console.log('Codigos calculados duplicados no projeto:')
  console.log(JSON.stringify(duplicados, null, 2))

  if (hasCodigoField) {
    console.log('Campo codigo existe; adicione groupBy real aqui se o schema for migrado.')
  } else {
    console.log('Campo codigo nao existe no banco; nao ha unique constraint de codigo em DocProjeto neste schema.')
  }
}

main()
  .catch((error) => {
    console.error('Erro no diagnostico:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
