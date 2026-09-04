import { jsPDF } from 'jspdf'

export const PDF_FONT = 'times'

export function setupFonteAcentos(doc: jsPDF) {
  const languageAwareDoc = doc as jsPDF & { setLanguage?: (language: string) => void }
  languageAwareDoc.setLanguage?.('pt-BR')
  doc.setFont(PDF_FONT, 'normal')
}
