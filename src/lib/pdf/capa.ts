import { jsPDF } from 'jspdf'
import { PDF_FONT, setupFonteAcentos } from '@/lib/pdf/fontes'

type ConfiguracaoCapa = {
  nome?: string | null
  nomeConsultoria?: string | null
  slogan?: string | null
  logoUrl?: string | null
  responsavelNome?: string | null
  responsavelRegistro?: string | null
  responsavelTecnico?: string | null
  registroResponsavel?: string | null
}

type EmpresaCapa = {
  nome: string
  cnpj?: string | null
  cnae?: string | null
  setor?: string | null
  cidade?: string | null
  estado?: string | null
}

type DocumentoCapa = {
  nome: string
  tipo: string
  codigo: string
  tipoNome: string
}

type CapaParams = {
  doc: jsPDF
  configuracao: ConfiguracaoCapa
  empresa: EmpresaCapa
  documento: DocumentoCapa
  versao: { numero: number; data: Date }
}

export function gerarCapa({ doc, configuracao, empresa, documento, versao }: CapaParams) {
  setupFonteAcentos(doc)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const nomeConsultoria = configuracao.nomeConsultoria || configuracao.nome || 'Consultoria SGI'
  const responsavel = configuracao.responsavelTecnico || configuracao.responsavelNome || 'A SER PREENCHIDO PELA CONSULTORIA'
  const registro = configuracao.registroResponsavel || configuracao.responsavelRegistro
  const localizacao = [empresa.cidade, empresa.estado].filter(Boolean).join(' - ') || 'Localização a definir'

  doc.setTextColor(15, 23, 42)

  if (configuracao.logoUrl) {
    try {
      doc.addImage(configuracao.logoUrl, 'PNG', 20, 20, 50, 25)
    } catch {
      drawConsultoriaText(doc, nomeConsultoria)
    }
  } else {
    drawConsultoriaText(doc, nomeConsultoria)
  }

  doc.setFontSize(10)
  doc.setFont(PDF_FONT, 'normal')
  doc.text(configuracao.slogan || 'ISO 14001 - ISO 45001 - SST - ESG', 20, 50)

  doc.setDrawColor(26, 86, 219)
  doc.setLineWidth(0.6)
  doc.line(20, 60, pageWidth - 20, 60)

  doc.setFontSize(24)
  doc.setFont(PDF_FONT, 'bold')
  const tituloLinhas = doc.splitTextToSize(documento.tipoNome.toUpperCase(), pageWidth - 40) as string[]
  doc.text(tituloLinhas, pageWidth / 2, pageHeight / 2 - 34, { align: 'center' })

  doc.setFontSize(16)
  doc.setFont(PDF_FONT, 'normal')
  doc.text(empresa.nome, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' })

  doc.setFontSize(11)
  doc.text(`CNPJ: ${empresa.cnpj || 'A definir'}`, pageWidth / 2, pageHeight / 2 + 24, { align: 'center' })
  doc.text(`CNAE: ${empresa.cnae || 'A definir'} - ${empresa.setor || 'Setor a definir'}`, pageWidth / 2, pageHeight / 2 + 32, { align: 'center' })
  doc.text(localizacao, pageWidth / 2, pageHeight / 2 + 40, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont(PDF_FONT, 'bold')
  doc.text(`Código: ${documento.codigo}`, 20, pageHeight - 50)
  doc.text(`Revisão: ${String(Math.max(versao.numero - 1, 0)).padStart(2, '0')}`, 20, pageHeight - 40)
  doc.text(`Data de Emissão: ${versao.data.toLocaleDateString('pt-BR')}`, 20, pageHeight - 30)

  doc.setFont(PDF_FONT, 'normal')
  doc.text(`Responsável Técnico: ${responsavel}`, pageWidth - 20, pageHeight - 50, { align: 'right' })
  if (registro) {
    doc.text(`Registro: ${registro}`, pageWidth - 20, pageHeight - 40, { align: 'right' })
  }

  doc.setFontSize(8)
  doc.setFont(PDF_FONT, 'italic')
  doc.setTextColor(100)
  doc.text('Documento confidencial - uso exclusivo do cliente', pageWidth / 2, pageHeight - 15, { align: 'center' })
  doc.setTextColor(0)
}

function drawConsultoriaText(doc: jsPDF, nomeConsultoria: string) {
  doc.setFontSize(18)
  doc.setFont(PDF_FONT, 'bold')
  doc.text(nomeConsultoria, 20, 35)
}
