'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { saveAs } from 'file-saver'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { CONSULTORIA_CONFIG } from '@/lib/config/consultoria'
import { detectarCodigoDocumento } from '@/lib/documentos/codigo'
import { limparConteudoParaExportacao } from '@/lib/documentos/markdown'
import { gerarPaginaAprovacao } from '@/lib/pdf/aprovacao'
import { gerarCapa } from '@/lib/pdf/capa'
import { extrairEstrutura } from '@/lib/pdf/extractor-sumario'
import { PDF_FONT } from '@/lib/pdf/fontes'
import { calcularPaginasSumario, gerarSumario, type EntradaSumario } from '@/lib/pdf/sumario'

type EmpresaExport = {
  nome: string
  cnpj?: string | null
  cnae?: string | null
  setor?: string | null
  cidade?: string | null
  estado?: string | null
}

export type DocumentoExport = {
  id?: string
  nome: string
  tipo: string
  status: string
  versao?: number
  sequencial?: number
  tabelaLargura?: 'manter-linha' | 'pode-dividir'
  conteudo: string
}

type VersaoAprovacao = {
  numero: number
  data: Date
  alteracoes: string
  autor: string
}

type ConfigExport = {
  nome: string
  nomeConsultoria?: string | null
  nomeCompleto?: string | null
  slogan?: string | null
  logoUrl?: string | null
  responsavelNome?: string | null
  responsavelRegistro?: string | null
  responsavelTecnico?: string | null
  registroResponsavel?: string | null
  responsavelCargo?: string | null
  endereco?: string | null
  telefone?: string | null
  email?: string | null
  site?: string | null
}

async function getConfig(): Promise<ConfigExport> {
  try {
    const response = await fetch('/api/configuracoes')
    if (!response.ok) throw new Error('Config indisponivel')
    return (await response.json()) as ConfigExport
  } catch {
    return {
      nome: CONSULTORIA_CONFIG.nome,
      nomeConsultoria: CONSULTORIA_CONFIG.nome,
      nomeCompleto: CONSULTORIA_CONFIG.nomeCompleto,
      slogan: CONSULTORIA_CONFIG.slogan,
      responsavelTecnico: CONSULTORIA_CONFIG.responsavelTecnico,
      registroResponsavel: CONSULTORIA_CONFIG.registroResponsavel,
    }
  }
}

async function carregarVersoesAprovacao(
  documento: DocumentoExport,
  dataExportacao: Date,
  config: ConfigExport,
): Promise<VersaoAprovacao[]> {
  const responsavel = config.responsavelTecnico || config.responsavelNome || 'A SER PREENCHIDO PELA CONSULTORIA'
  const versaoAtual = documento.versao || 1
  const atual: VersaoAprovacao = {
    numero: versaoAtual,
    data: dataExportacao,
    alteracoes: versaoAtual > 1 ? 'Atualização do documento' : 'Versão inicial',
    autor: responsavel,
  }

  if (!documento.id) return [atual]

  try {
    const response = await fetch(`/api/documentos/${documento.id}`)
    if (!response.ok) return [atual]

    const payload = (await response.json()) as {
      versoes?: Array<{
        versao: number
        createdAt: string
        alteracoes?: string | null
        autor?: string | null
      }>
    }
    const historico = (payload.versoes || []).map((versao) => ({
      numero: versao.versao,
      data: new Date(versao.createdAt),
      alteracoes: versao.alteracoes || (versao.versao === 1 ? 'Versão inicial' : 'Atualização do documento'),
      autor: versao.autor || responsavel,
    }))

    if (!historico.some((versao) => versao.numero === versaoAtual)) {
      historico.push(atual)
    }

    return historico.sort((a, b) => a.numero - b.numero)
  } catch {
    return [atual]
  }
}

export async function gerarPreviewHtml(documento: DocumentoExport, _empresa?: EmpresaExport) {
  void _empresa
  return `<article class="prose prose-slate max-w-none">${escapeHtml(limparConteudoParaExportacao(documento.conteudo))}</article>`
}

export async function exportarPDF(documento: DocumentoExport, empresa: EmpresaExport) {
  const config = await getConfig()
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })
  const margemEsq = 20
  const margemDir = 20
  const larguraTexto = 210 - margemEsq - margemDir
  const tabelaLargura = documento.tabelaLargura || detectarTabelaLargura(documento)
  const codigoDocumento = getCodigoDocumento(documento)
  const dataExportacao = new Date()
  const versoesAprovacao = await carregarVersoesAprovacao(documento, dataExportacao, config)
  const conteudoLimpo = limparConteudoParaExportacao(documento.conteudo)
  const estrutura = extrairEstrutura(conteudoLimpo)
  const paginasEstimadas = Math.ceil(conteudoLimpo.split('\n').length / 45)
  const secoesPrincipais = estrutura.filter((entrada) => entrada.nivel === 2).length
  const incluirSumario = secoesPrincipais >= 3 || paginasEstimadas >= 3
  const paginasSumarioReservadas = incluirSumario ? calcularPaginasSumario(estrutura) : 0
  const entradasSumario: EntradaSumario[] = []
  let headingIndex = 0
  let y = 20
  let pendingPortraitAfterWideTable = false

  gerarCapa({
    doc,
    configuracao: config,
    empresa,
    documento: {
      nome: documento.nome,
      tipo: documento.tipo,
      codigo: codigoDocumento,
      tipoNome: documento.nome,
    },
    versao: { numero: documento.versao || 1, data: dataExportacao },
  })

  for (let index = 0; index < paginasSumarioReservadas; index += 1) {
    doc.addPage('a4', 'portrait')
  }

  addPage('portrait')

  const linhas = conteudoLimpo.split('\n')
  for (let index = 0; index < linhas.length; index += 1) {
    const linha = linhas[index].trim()

    if (linha.startsWith('|') && linha.includes('|')) {
      const tableLines: string[] = []
      while (index < linhas.length && linhas[index].trim().startsWith('|')) {
        tableLines.push(linhas[index].trim())
        index += 1
      }
      index -= 1
      pendingPortraitAfterWideTable = drawTable(tableLines)
      continue
    }

    if (pendingPortraitAfterWideTable && linha) {
      addPage('portrait')
      pendingPortraitAfterWideTable = false
    }

    if (y > pageHeight() - 27) addPage()

    if (linha.startsWith('# ')) {
      capturarHeading(linha, 1)
      y += 5
      doc.setFont(PDF_FONT, 'bold')
      doc.setFontSize(18)
      writeWrapped(cleanMarkdown(linha.replace(/^# /, '')), margemEsq, larguraTexto, 8)
      y += 5
    } else if (linha.startsWith('## ')) {
      capturarHeading(linha, 2)
      y += 4
      doc.setFont(PDF_FONT, 'bold')
      doc.setFontSize(14)
      writeWrapped(cleanMarkdown(linha.replace(/^## /, '')), margemEsq, larguraTexto, 6)
      y += 3
    } else if (linha.startsWith('### ')) {
      capturarHeading(linha, 3)
      y += 3
      doc.setFont(PDF_FONT, 'bold')
      doc.setFontSize(12)
      writeWrapped(cleanMarkdown(linha.replace(/^### /, '')), margemEsq, larguraTexto, 6)
    } else if (linha.startsWith('- ') || linha.startsWith('* ')) {
      doc.setFont(PDF_FONT, 'normal')
      doc.setFontSize(10)
      writeWrapped(`- ${cleanMarkdown(linha.replace(/^[-*] /, ''))}`, margemEsq + 3, larguraTexto - 5, 5)
    } else if (linha === '') {
      y += 3
    } else if (linha === '---') {
      y += 2
      doc.line(margemEsq, y, 210 - margemDir, y)
      y += 4
    } else {
      doc.setFont(PDF_FONT, 'normal')
      doc.setFontSize(10)
      writeWrapped(cleanMarkdown(linha), margemEsq, larguraTexto, 5)
    }
  }

  gerarPaginaAprovacao({
    doc,
    configuracao: config,
    versoes: versoesAprovacao,
  })

  if (incluirSumario && entradasSumario.length) {
    doc.setPage(2)
    gerarSumario({ doc, entradas: entradasSumario, addPage: false, paginasReservadas: paginasSumarioReservadas })
  }

  drawFooters()
  const fileName = `${slugify(documento.nome)}.pdf`
  const blob = doc.output('blob')
  doc.save(fileName)
  await registrarExportacao(documento, 'pdf', fileName, await hashBlob(blob), config)

  function drawHeader() {
    doc.setFont(PDF_FONT, 'bold')
    doc.setFontSize(10)
    doc.text(config.nome || 'Consultoria', margemEsq, y)
    doc.setFont(PDF_FONT, 'normal')
    doc.text(empresa.nome, pageWidth() - margemDir, y, { align: 'right' })
    y += 5
    doc.setLineWidth(0.3)
    doc.line(margemEsq, y, pageWidth() - margemDir, y)
    drawVersionTable()
  }

  function drawVersionTable() {
    const tabelaY = 28
    const tableWidth = pageWidth() - margemEsq - margemDir
    const codeWidth = Math.min(105, tableWidth * 0.58)
    const revWidth = 34
    const codigo = codigoDocumento
    const revisao = `Rev. ${String(Math.max((documento.versao || 1) - 1, 0)).padStart(2, '0')}`

    doc.setFontSize(8)
    doc.setFont(PDF_FONT, 'normal')
    doc.setDrawColor(180)
    doc.rect(margemEsq, tabelaY, tableWidth, 12)
    doc.line(margemEsq + codeWidth, tabelaY, margemEsq + codeWidth, tabelaY + 12)
    doc.line(margemEsq + codeWidth + revWidth, tabelaY, margemEsq + codeWidth + revWidth, tabelaY + 12)

    doc.setFontSize(7)
    doc.setTextColor(100)
    doc.text('CÓDIGO', margemEsq + 2, tabelaY + 3)
    doc.text('REVISÃO', margemEsq + codeWidth + 2, tabelaY + 3)
    doc.text('DATA', margemEsq + codeWidth + revWidth + 2, tabelaY + 3)

    let codeFontSize = 9
    doc.setFont(PDF_FONT, 'bold')
    while (codeFontSize > 6 && doc.getTextWidth(codigo) > codeWidth - 4) {
      codeFontSize -= 0.5
      doc.setFontSize(codeFontSize)
    }
    doc.setTextColor(0)
    doc.text(codigo, margemEsq + 2, tabelaY + 9)
    doc.setFontSize(9)
    doc.text(revisao, margemEsq + codeWidth + 2, tabelaY + 9)
    doc.text(new Date().toLocaleDateString('pt-BR'), margemEsq + codeWidth + revWidth + 2, tabelaY + 9)

    y = tabelaY + 18
  }

  function addPage(orientation: 'portrait' | 'landscape' = 'portrait') {
    doc.addPage('a4', orientation)
    y = 20
    drawHeader()
  }

  function capturarHeading(linha: string, nivel: 1 | 2 | 3) {
    if (!incluirSumario) return

    const titulo = cleanMarkdown(linha.replace(/^#{1,3}\s+/, '')).trim()
    const estruturaAtual = estrutura[headingIndex]
    headingIndex += 1

    entradasSumario.push({
      titulo: estruturaAtual?.titulo || titulo,
      nivel: estruturaAtual?.nivel || nivel,
      pagina: currentPage(),
    })
  }

  function writeWrapped(texto: string, x: number, width: number, lineHeight: number) {
    const linhasQuebradas = doc.splitTextToSize(texto, width) as string[]
    for (const line of linhasQuebradas) {
      if (y > pageHeight() - 27) addPage()
      doc.text(line, x, y)
      y += lineHeight
    }
  }

  function drawTable(tableLines: string[]) {
    const rows = tableLines
      .filter((line) => !/^\|[\s:-|]+\|$/.test(line))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cleanMarkdown(cell.trim())))

    if (!rows.length) return false
    const columnCount = rows[0].length
    const isWide = columnCount >= 5 || rows.some((row) => row.some((cell) => cell.length > 80))
    const margin = isWide ? { left: 10, right: 10 } : { left: margemEsq, right: margemDir }

    if (isWide) {
      addPage('landscape')
    }

    const manterLinha = tabelaLargura === 'manter-linha'
    const groups: string[][][] = columnCount > 6 && !manterLinha ? splitWideTable(rows) : [rows]

    for (const groupRows of groups) {
      autoTable(doc, {
        head: [groupRows[0]],
        body: groupRows.slice(1),
        startY: y,
        margin,
        tableWidth: 'auto',
        styles: {
          font: PDF_FONT,
          fontSize: manterLinha ? 5.7 : isWide ? 7 : 8,
          cellPadding: manterLinha ? 1.2 : 2,
          overflow: 'linebreak',
          cellWidth: 'auto',
          minCellWidth: manterLinha ? 10 : isWide ? 18 : 12,
        },
        headStyles: { fillColor: [26, 86, 219], textColor: 255 },
        columnStyles: buildColumnStyles(groupRows[0], manterLinha),
      })

      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 8
      if (y > pageHeight() - 35 && groups.indexOf(groupRows) < groups.length - 1) {
        addPage('landscape')
      }
    }

    return isWide
  }

  function drawFooters() {
    const totalPaginas = doc.getNumberOfPages()
    for (let i = 1; i <= totalPaginas; i += 1) {
      if (i === 1 || i === totalPaginas) continue
      doc.setPage(i)
      doc.setFont(PDF_FONT, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120)
      const centerX = pageWidth() / 2
      const footerY = pageHeight() - 10
      doc.text(`Página ${i} de ${totalPaginas}`, centerX, footerY - 5, { align: 'center' })
      doc.text('Documento confidencial - uso exclusivo do cliente', centerX, footerY, { align: 'center' })
      doc.setTextColor(0)
    }
  }

  function pageWidth() {
    return doc.internal.pageSize.getWidth()
  }

  function pageHeight() {
    return doc.internal.pageSize.getHeight()
  }

  function currentPage() {
    return doc.getCurrentPageInfo().pageNumber
  }
}

export async function exportarWord(documento: DocumentoExport, empresa: EmpresaExport) {
  const config = await getConfig()
  const doc = new Document({
    title: documento.nome,
    creator: config.nome,
    subject: documento.tipo,
    description: `Documento tecnico para ${empresa.nome}`,
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${config.nome} - ${empresa.nome}`, bold: true })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('Pagina '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' de '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                  new TextRun(` - ${config.email || ''} - Documento confidencial`),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ text: documento.nome, heading: HeadingLevel.TITLE, spacing: { after: 320 } }),
          new Paragraph({ text: `Cliente: ${empresa.nome}` }),
          new Paragraph({ text: `Consultoria: ${config.nome}` }),
          new Paragraph({ text: `Data: ${new Date().toLocaleDateString('pt-BR')} - Versao ${documento.versao || 1}` }),
          ...markdownToDocxParagraphs(limparConteudoParaExportacao(documento.conteudo)),
          new Paragraph({ text: 'Assinaturas', heading: HeadingLevel.HEADING_1 }),
          signatureTable(config, empresa),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const fileName = `${slugify(documento.nome)}.docx`
  saveAs(blob, fileName)
  await registrarExportacao(documento, 'word', fileName, await hashBlob(blob), config)
}

function markdownToDocxParagraphs(markdown: string) {
  const children: Array<Paragraph | Table> = []
  const lines = markdown.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed) continue

    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index].trim())
        index += 1
      }
      index -= 1
      const rows = tableLines
        .filter((line) => !/^\|[\s:-|]+\|$/.test(line))
        .map((line) => line.split('|').slice(1, -1).map((cell) => cleanMarkdown(cell.trim())))
      if (rows.length) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        borders: simpleBorders(),
                        children: [new Paragraph({ children: [new TextRun(cell)] })],
                      }),
                  ),
                }),
            ),
          }),
        )
      }
      continue
    }

    if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({ text: cleanMarkdown(trimmed.slice(2)), heading: HeadingLevel.HEADING_1 }))
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({ text: cleanMarkdown(trimmed.slice(3)), heading: HeadingLevel.HEADING_2 }))
    } else if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({ text: cleanMarkdown(trimmed.slice(4)), heading: HeadingLevel.HEADING_3 }))
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      children.push(new Paragraph({ text: cleanMarkdown(trimmed.slice(2)), bullet: { level: 0 } }))
    } else {
      children.push(new Paragraph({ children: [new TextRun(cleanMarkdown(trimmed))], spacing: { after: 160 } }))
    }
  }

  return children
}

function signatureTable(config: ConfigExport, empresa: EmpresaExport) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: simpleBorders(),
            children: [
              new Paragraph('Responsavel tecnico'),
              new Paragraph(config.responsavelNome || 'Nome completo'),
              new Paragraph(config.responsavelRegistro || 'Registro profissional'),
              new Paragraph('Data: ____/____/______'),
            ],
          }),
          new TableCell({
            borders: simpleBorders(),
            children: [
              new Paragraph('Representante do cliente'),
              new Paragraph(empresa.nome),
              new Paragraph('Assinatura: ____________________________'),
              new Paragraph('Data: ____/____/______'),
            ],
          }),
        ],
      }),
    ],
  })
}

function simpleBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  }
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
}

function getCodigoDocumento(documento: DocumentoExport) {
  return detectarCodigoDocumento(documento.nome, documento.tipo, documento.sequencial || 1)
}

function splitWideTable(rows: string[][]): string[][][] {
  const header = rows[0]
  const body = rows.slice(1)
  const firstColumn = header[0]
  const groups: string[][][] = []

  for (let start = 1; start < header.length; start += 5) {
    const indexes = [0, ...header.slice(start, start + 5).map((_, index) => start + index)]
    groups.push([
      indexes.map((index) => header[index]),
      ...body.map((row) => indexes.map((index) => row[index] || '')),
    ])
  }

  if (groups.length) return groups

  return [[[firstColumn], ...body.map((row) => [row[0] || ''])]]
}

function buildColumnStyles(header: string[], manterLinha = false) {
  const styles: Record<number, { cellWidth: number }> = {}
  const normalized = header.map((item) => normalizar(item))

  if (manterLinha) {
    normalized.forEach((title, index) => {
      if (title.includes('processo')) styles[index] = { cellWidth: 22 }
      if (title.includes('atividade')) styles[index] = { cellWidth: 25 }
      if (title.includes('aspecto')) styles[index] = { cellWidth: 34 }
      if (title.includes('impacto')) styles[index] = { cellWidth: 43 }
      if (title.includes('classificacao')) styles[index] = { cellWidth: 20 }
      if (title.includes('condicao')) styles[index] = { cellWidth: 22 }
      if (title.includes('significancia')) styles[index] = { cellWidth: 38 }
      if (title.includes('controle')) styles[index] = { cellWidth: 38 }
      if (title.includes('indicador')) styles[index] = { cellWidth: 30 }
    })

    return styles
  }

  normalized.forEach((title, index) => {
    if (title.includes('codigo')) styles[index] = { cellWidth: 24 }
    if (title.includes('norma') || title.includes('nome')) styles[index] = { cellWidth: 36 }
    if (title.includes('descricao')) styles[index] = { cellWidth: 58 }
    if (title.includes('orgao') || title.includes('tipo')) styles[index] = { cellWidth: 26 }
    if (title.includes('setor') || title.includes('aplicabilidade')) styles[index] = { cellWidth: 38 }
    if (title.includes('obrigatorio') || title.includes('status')) styles[index] = { cellWidth: 28 }
    if (title.includes('evidencia')) styles[index] = { cellWidth: 48 }
  })

  return styles
}

function detectarTabelaLargura(documento: DocumentoExport): 'manter-linha' | 'pode-dividir' {
  const slug = normalizar(`${documento.nome} ${documento.tipo}`)
  if (slug.includes('matriz') && slug.includes('aspectos') && slug.includes('impactos')) {
    return 'manter-linha'
  }

  return 'pode-dividir'
}

function normalizar(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ã£|ã£/g, 'a')
    .replace(/Ã¡|ã¡/g, 'a')
    .replace(/Ã©|ã©/g, 'e')
    .replace(/Ãª|ãª/g, 'e')
    .replace(/Ã­|ã­/g, 'i')
    .replace(/Ã³|ã³/g, 'o')
    .replace(/Ãµ|ãµ/g, 'o')
    .replace(/Ãº|ãº/g, 'u')
    .replace(/Ã§|ã§/g, 'c')
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function hashBlob(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function registrarExportacao(
  documento: DocumentoExport,
  formato: 'pdf' | 'word',
  fileName: string,
  hashArquivo: string,
  config: ConfigExport,
) {
  if (!documento.id) return

  await fetch('/api/exportacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      docProjetoId: documento.id,
      formato,
      versao: documento.versao || 1,
      urlArquivo: fileName,
      hashArquivo,
      exportadoPor: config.responsavelNome || 'consultor',
    }),
  }).catch(() => null)
}
