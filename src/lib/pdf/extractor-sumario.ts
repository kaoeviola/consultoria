export type EstruturaSumario = {
  titulo: string
  nivel: 1 | 2 | 3
}

export function extrairEstrutura(markdown: string): EstruturaSumario[] {
  return markdown
    .split('\n')
    .map((linha) => linha.match(/^(#{1,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      titulo: limparTitulo(match[2]),
      nivel: match[1].length as 1 | 2 | 3,
    }))
    .filter((entrada) => entrada.titulo.length > 0)
}

function limparTitulo(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}
