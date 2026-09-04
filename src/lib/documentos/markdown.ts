export function limparMarkdownFence(content: string): string {
  return content
    .replace(/^```(?:markdown|md)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/^markdown\s*\n/i, '')
    .trim()
}

export function limparMarkersInternos(content: string): string {
  return content
    .replace(/\[IA\]\s*/g, '')
    .replace(/\[Dados precisam de validação\]/g, 'A definir')
    .replace(/\[Dados precisam de validacao\]/g, 'A definir')
    .replace(/\[REVISAR\]/g, '')
    .replace(/\[PLACEHOLDER:[^\]]+\]/g, '')
}

export function limparConteudoParaExportacao(content: string): string {
  return limparMarkersInternos(limparMarkdownFence(content)).trim()
}
