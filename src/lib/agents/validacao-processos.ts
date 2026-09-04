type ValidacaoAuditoria = {
  scoreAuditoria: number
  aprovadoAuditoria: boolean
  problemas: {
    severidade: 'critica' | 'alta' | 'media'
    tipo: string
    descricao: string
  }[]
  temProblemasCriticos: boolean
}

type ValidacaoProcessos = {
  ok?: boolean
  warning?: string | null
  processosEsperados?: string[]
  processosEncontrados?: string[]
  faltantes?: string[]
  extras?: string[]
}

export function aplicarWarningProcessos(
  validacaoAuditoria: ValidacaoAuditoria,
  metadados: unknown,
) {
  const validacaoProcessos = extrairValidacaoProcessos(metadados)
  if (!validacaoProcessos?.warning || validacaoProcessos.ok) return validacaoAuditoria

  const detalhes = [
    validacaoProcessos.warning,
    validacaoProcessos.faltantes?.length
      ? `Faltantes: ${validacaoProcessos.faltantes.join(', ')}`
      : null,
    validacaoProcessos.extras?.length
      ? `Extras: ${validacaoProcessos.extras.join(', ')}`
      : null,
  ].filter(Boolean)

  return {
    ...validacaoAuditoria,
    scoreAuditoria: Math.max(0, validacaoAuditoria.scoreAuditoria - 10),
    aprovadoAuditoria: false,
    temProblemasCriticos: true,
    problemas: [
      ...validacaoAuditoria.problemas,
      {
        severidade: 'critica' as const,
        tipo: 'processos_divergentes_anamnese',
        descricao: detalhes.join(' | '),
      },
    ],
  }
}

function extrairValidacaoProcessos(metadados: unknown): ValidacaoProcessos | null {
  if (!metadados || typeof metadados !== 'object') return null

  const value = (metadados as { validacaoProcessos?: unknown }).validacaoProcessos
  if (!value || typeof value !== 'object') return null

  return value as ValidacaoProcessos
}
