import { mkdir, writeFile } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { validarFidelidade } from '@/lib/validador/fidelidade'
import type { CategoriaFidelidade } from '@/lib/validador/tipos'

const TIPOS_DOCUMENTO: { tipo: string; nome: string; categoria: CategoriaFidelidade }[] = [
  { tipo: 'politica-ambiental', nome: 'Politica Ambiental', categoria: 'ambiental' },
  { tipo: 'politica-sst', nome: 'Politica de SST', categoria: 'sst' },
  { tipo: 'matriz-aspectos-impactos', nome: 'Matriz de aspectos e impactos ambientais', categoria: 'ambiental' },
  { tipo: 'matriz-requisitos-legais', nome: 'Matriz de Requisitos Legais Ambientais', categoria: 'ambiental' },
  { tipo: 'pgrs', nome: 'PGRS', categoria: 'ambiental' },
  { tipo: 'plano-emergencia', nome: 'Plano de Emergencia', categoria: 'sst' },
  { tipo: 'inventario-riscos', nome: 'Inventario de riscos ocupacionais', categoria: 'sst' },
  { tipo: 'apr', nome: 'Procedimento de APR', categoria: 'sst' },
  { tipo: 'matriz-treinamentos', nome: 'Matriz de Treinamentos', categoria: 'sst' },
  { tipo: 'codigo-conduta-etica', nome: 'Codigo de Conduta e Etica', categoria: 'gestao' },
  { tipo: 'politica-canal-denuncia', nome: 'Politica de Canal de Denuncia', categoria: 'gestao' },
  { tipo: 'procedimento-auditoria-interna', nome: 'Procedimento de Auditoria Interna', categoria: 'gestao' },
  {
    tipo: 'procedimento-controle-operacional-ambiental',
    nome: 'Procedimento de controle operacional ambiental',
    categoria: 'ambiental',
  },
]

type ResultadoBateria = {
  tipo: string
  categoria: CategoriaFidelidade
  score?: number
  bloqueia?: boolean
  criticas?: number
  altas?: number
  medias?: number
  status?: string
  erro?: string
  divergencias?: string[]
}

async function main() {
  const projetoId = 'cmq2yrsog0001rvw851s1i0co'
  const args = process.argv.slice(2)
  const regenerar = process.env.BATERIA_REGERAR === '1' || args.includes('--regenerar')
  const filtroTipos = (args.find((arg) => arg.startsWith('--tipos='))?.replace('--tipos=', '') || process.env.BATERIA_TIPOS || '')
    .split(',')
    .map((tipo) => tipo.trim())
    .filter(Boolean)
  const tiposSelecionados = filtroTipos.length
    ? TIPOS_DOCUMENTO.filter((doc) => filtroTipos.includes(doc.tipo))
    : TIPOS_DOCUMENTO

  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    include: { empresa: true, anamnese: true },
  })

  if (!projeto?.anamnese) {
    throw new Error('Projeto Metalurgica sem anamnese.')
  }

  const resultados: ResultadoBateria[] = []

  for (const { tipo, nome, categoria } of tiposSelecionados) {
    console.log(`\n--- Processando: ${tipo} ---`)

    let doc = await buscarDocumento(projetoId, tipo, nome)

    if (regenerar || !doc?.conteudo) {
      console.log(doc?.id ? '  Regenerando documento existente...' : '  Documento nao existe, gerando...')
      const res = await fetch('http://localhost:3000/api/agentes/gerar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc?.id
          ? { docProjetoId: doc.id }
          : { projetoId, nomeDocumento: nome, tipoDocumento: tipo }),
      })

      if (!res.ok) {
        resultados.push({ tipo, categoria, status: 'erro_geracao', erro: await res.text() })
        continue
      }

      const payload = await res.json().catch(() => null)
      const id = payload?.documento?.id || payload?.id || doc?.id
      doc = id
        ? await prisma.docProjeto.findUnique({ where: { id } })
        : await buscarDocumento(projetoId, tipo, nome)
    }

    if (!doc?.conteudo) {
      resultados.push({ tipo, categoria, status: 'erro_busca' })
      continue
    }

    const validacao = await validarFidelidade(doc.conteudo, {
      empresa: projeto.empresa,
      projeto,
      anamnese: projeto.anamnese,
      perfilOperacional: projeto.anamnese.perfilOperacional as Record<string, unknown>,
      tipoDocumento: nome,
      categoria,
    })

    resultados.push({
      tipo,
      categoria,
      score: validacao.score,
      bloqueia: validacao.bloqueia,
      criticas: validacao.contagem.criticas,
      altas: validacao.contagem.altas,
      medias: validacao.contagem.medias,
      divergencias: validacao.divergencias.map((d) => `[${d.severidade.toUpperCase()}] ${d.regra}: ${d.mensagem}`),
    })

    console.log(`  Score: ${validacao.score} | Criticas: ${validacao.contagem.criticas} | Altas: ${validacao.contagem.altas}`)
  }

  console.log('\n\n========== RELATORIO CONSOLIDADO ==========\n')
  resultados.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))

  console.log('Documento | Score | Criticas | Altas | Medias | Status')
  console.log('---|---|---|---|---|---')
  resultados.forEach((r) => {
    const status = r.bloqueia ? 'BLOQUEIA' : (r.score ?? 0) < 70 ? 'AJUSTAR' : (r.score ?? 0) < 90 ? 'REFINAR' : 'OK'
    console.log(`${r.tipo} | ${r.score ?? '-'} | ${r.criticas ?? '-'} | ${r.altas ?? '-'} | ${r.medias ?? '-'} | ${status}`)
  })

  console.log('\n\n========== DIVERGENCIAS POR DOCUMENTO ==========\n')
  resultados
    .filter((r) => r.divergencias?.length)
    .forEach((r) => {
      console.log(`\n## ${r.tipo} (score ${r.score})`)
      r.divergencias?.forEach((d) => console.log(`  - ${d}`))
    })

  await mkdir('relatorios', { recursive: true })
  const filePath = `relatorios/bateria-regressao-${new Date().toISOString().split('T')[0]}.json`
  await writeFile(filePath, JSON.stringify(resultados, null, 2))
  console.log(`\nRelatorio salvo em ${filePath}`)
}

async function buscarDocumento(projetoId: string, tipo: string, nome: string) {
  const docs = await prisma.docProjeto.findMany({
    where: { projetoId },
    orderBy: { updatedAt: 'desc' },
  })
  const tipoNorm = normalize(tipo)
  const nomeNorm = normalize(nome)

  return docs.find((doc) => {
    const alvo = normalize(`${doc.nome} ${doc.tipo}`)
    return alvo.includes(tipoNorm) || tipoNorm.split('-').every((part) => alvo.includes(part)) || alvo.includes(nomeNorm)
  }) || null
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
