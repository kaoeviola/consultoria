import { jsPDF } from 'jspdf'
import { PDF_FONT, setupFonteAcentos } from '@/lib/pdf/fontes'

export type EntradaSumario = {
  titulo: string
  nivel: 1 | 2 | 3
  pagina: number
}

type SumarioParams = {
  doc: jsPDF
  entradas: EntradaSumario[]
  addPage?: boolean
  paginasReservadas?: number
}

export function calcularPaginasSumario(entradas: Array<Pick<EntradaSumario, 'nivel'>>) {
  let paginas = 1
  let y = 50

  entradas.forEach((entrada) => {
    if (y > 267) {
      paginas += 1
      y = 50
    }

    y += entrada.nivel === 1 ? 9 : 7
  })

  return Math.max(1, paginas)
}

export function gerarSumario({ doc, entradas, addPage = true, paginasReservadas = 1 }: SumarioParams) {
  if (addPage) doc.addPage('a4', 'portrait')
  setupFonteAcentos(doc)

  const paginaInicial = doc.getCurrentPageInfo().pageNumber
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let paginaAtual = 1

  drawTitulo()

  let y = 50
  entradas.forEach((entrada) => {
    if (y > pageHeight - 30) {
      if (addPage) {
        doc.addPage('a4', 'portrait')
      } else if (paginaAtual < paginasReservadas) {
        doc.setPage(paginaInicial + paginaAtual)
      } else {
        return
      }

      paginaAtual += 1
      drawTitulo()
      y = 50
    }

    const indent = (entrada.nivel - 1) * 8
    const fontStyle = entrada.nivel === 1 ? 'bold' : 'normal'
    const fontSize = entrada.nivel === 1 ? 11 : 10
    const tituloX = 20 + indent
    const paginaTexto = String(entrada.pagina)
    const paginaX = pageWidth - 20
    const paginaWidth = doc.getTextWidth(paginaTexto)
    const tituloMaxWidth = paginaX - tituloX - paginaWidth - 10

    doc.setFont(PDF_FONT, fontStyle)
    doc.setFontSize(fontSize)

    const tituloQuebrado = doc.splitTextToSize(entrada.titulo, tituloMaxWidth) as string[]
    const titulo = tituloQuebrado[0] || entrada.titulo
    doc.text(titulo, tituloX, y)

    const tituloWidth = doc.getTextWidth(titulo)
    const pontosInicio = tituloX + tituloWidth + 3
    const pontosFim = paginaX - paginaWidth - 3
    if (pontosFim > pontosInicio) {
      doc.setFont(PDF_FONT, 'normal')
      doc.setFontSize(9)
      const numPontos = Math.floor((pontosFim - pontosInicio) / 2)
      doc.text('.'.repeat(Math.max(0, numPontos)), pontosInicio, y)
    }

    doc.setFont(PDF_FONT, fontStyle)
    doc.setFontSize(fontSize)
    doc.text(paginaTexto, paginaX, y, { align: 'right' })
    y += entrada.nivel === 1 ? 9 : 7
  })

  for (let index = 0; index < paginaAtual; index += 1) {
    doc.setPage(paginaInicial + index)
    drawRodape()
  }

  doc.setTextColor(0)

  function drawTitulo() {
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(16)
    doc.setFont(PDF_FONT, 'bold')
    doc.text('Sumário', 20, 30)

    doc.setDrawColor(180)
    doc.setLineWidth(0.3)
    doc.line(20, 35, pageWidth - 20, 35)
  }

  function drawRodape() {
    doc.setFontSize(8)
    doc.setFont(PDF_FONT, 'italic')
    doc.setTextColor(100)
    doc.text('Documento confidencial - uso exclusivo do cliente', pageWidth / 2, pageHeight - 15, { align: 'center' })
  }
}
