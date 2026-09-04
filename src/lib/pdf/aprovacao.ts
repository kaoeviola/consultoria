import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_FONT, setupFonteAcentos } from '@/lib/pdf/fontes'

type ConfiguracaoAprovacao = {
  nome?: string | null
  nomeConsultoria?: string | null
  responsavelNome?: string | null
  responsavelTecnico?: string | null
}

type AprovacaoParams = {
  doc: jsPDF
  configuracao: ConfiguracaoAprovacao
  versoes: Array<{ numero: number; data: Date; alteracoes: string; autor: string }>
}

export function gerarPaginaAprovacao({ doc, configuracao, versoes }: AprovacaoParams) {
  doc.addPage('a4', 'portrait')
  setupFonteAcentos(doc)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const responsavel = configuracao.responsavelTecnico || configuracao.responsavelNome || 'A SER PREENCHIDO PELA CONSULTORIA'

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(16)
  doc.setFont(PDF_FONT, 'bold')
  doc.text('Aprovação e Controle de Revisões', 20, 30)

  doc.setFontSize(11)
  doc.text('Aprovação', 20, 55)

  const blocoWidth = (pageWidth - 60) / 3
  const blocoY = 70
  const blocoH = 70

  ;['Elaborado por', 'Revisado por', 'Aprovado por'].forEach((rotulo, index) => {
    const x = 20 + index * (blocoWidth + 10)
    doc.setDrawColor(180)
    doc.rect(x, blocoY, blocoWidth, blocoH)
    doc.setFont(PDF_FONT, 'bold')
    doc.setFontSize(10)
    doc.text(rotulo, x + 5, blocoY + 9)

    doc.setFont(PDF_FONT, 'normal')
    doc.setFontSize(9)
    doc.text('Nome:', x + 5, blocoY + blocoH - 35)
    doc.text('Cargo:', x + 5, blocoY + blocoH - 25)
    doc.text('Data:', x + 5, blocoY + blocoH - 15)
    doc.text('Assinatura:', x + 5, blocoY + blocoH - 5)
  })

  doc.setFontSize(11)
  doc.setFont(PDF_FONT, 'bold')
  doc.text('Histórico de Revisões', 20, blocoY + blocoH + 25)

  autoTable(doc, {
    startY: blocoY + blocoH + 30,
    head: [['Revisão', 'Data', 'Alterações', 'Responsável']],
    body: versoes.map((versao) => [
      String(Math.max(versao.numero - 1, 0)).padStart(2, '0'),
      versao.data.toLocaleDateString('pt-BR'),
      versao.alteracoes || 'Versão inicial',
      versao.autor || responsavel,
    ]),
    margin: { left: 20, right: 20 },
    styles: { font: PDF_FONT, fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [50, 50, 50], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 86 },
      3: { cellWidth: 34 },
    },
  })

  doc.setFontSize(8)
  doc.setFont(PDF_FONT, 'italic')
  doc.setTextColor(100)
  doc.text('Documento confidencial - uso exclusivo do cliente', pageWidth / 2, pageHeight - 15, { align: 'center' })
  doc.setTextColor(0)
}
