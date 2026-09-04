import { prisma } from '@/lib/prisma'
import { validarFidelidade } from '@/lib/validador/fidelidade'

async function main() {
  const projetoId = 'cmq2yrsog0001rvw851s1i0co'

  const docAtual = await prisma.docProjeto.findFirst({
    where: {
      projetoId,
      nome: { contains: 'Matriz de aspectos' },
    },
    include: {
      projeto: {
        include: {
          empresa: true,
          anamnese: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const versoes = await prisma.versaoDocumento.findMany({
    where: {
      docProjeto: {
        projetoId,
        nome: { contains: 'Matriz de aspectos' },
      },
    },
    include: {
      docProjeto: {
        include: {
          projeto: {
            include: {
              empresa: true,
              anamnese: true,
            },
          },
        },
      },
    },
    orderBy: { versao: 'asc' },
  })

  console.log(`Encontradas ${versoes.length} versoes historicas da Matriz de Aspectos.`)
  console.log(docAtual ? 'Documento atual encontrado para validar tambem.\n' : 'Documento atual nao encontrado.\n')

  for (const v of versoes) {
    const projeto = v.docProjeto.projeto
    if (!projeto.anamnese) {
      console.log(`=== Versao ${v.versao} ===`)
      console.log('Sem anamnese, pulando.\n')
      continue
    }

    console.log(`=== Versao ${v.versao} ===`)
    console.log(`Conteudo (primeiras 200 chars): ${v.conteudo.substring(0, 200)}...`)

    const resultado = await validarFidelidade(v.conteudo, {
      empresa: projeto.empresa,
      projeto,
      anamnese: projeto.anamnese,
      perfilOperacional: projeto.anamnese.perfilOperacional as Record<string, unknown>,
      tipoDocumento: v.docProjeto.nome,
      categoria: 'ambiental',
    })

    printResultado(resultado)
  }

  if (docAtual?.conteudo && docAtual.projeto.anamnese) {
    console.log(`=== Versao atual DocProjeto v${docAtual.versao} ===`)
    console.log(`Conteudo (primeiras 200 chars): ${docAtual.conteudo.substring(0, 200)}...`)

    const resultado = await validarFidelidade(docAtual.conteudo, {
      empresa: docAtual.projeto.empresa,
      projeto: docAtual.projeto,
      anamnese: docAtual.projeto.anamnese,
      perfilOperacional: docAtual.projeto.anamnese.perfilOperacional as Record<string, unknown>,
      tipoDocumento: docAtual.nome,
      categoria: 'ambiental',
    })

    printResultado(resultado)
  }
}

function printResultado(resultado: Awaited<ReturnType<typeof validarFidelidade>>) {
  console.log(`Score: ${resultado.score}`)
  console.log(`Bloqueia: ${resultado.bloqueia}`)
  console.log(`Divergencias (${resultado.divergencias.length}):`)
  resultado.divergencias.forEach((d) => {
    console.log(`  [${d.severidade.toUpperCase()}] ${d.regra}: ${d.mensagem}`)
    console.log(`    Esperado: ${JSON.stringify(d.esperado)}`)
    console.log(`    Encontrado: ${JSON.stringify(d.encontrado)}`)
  })
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
