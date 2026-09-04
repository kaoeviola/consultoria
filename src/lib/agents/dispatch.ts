const AGENTES_REGISTRADOS = {
  politica_ambiental: true,
  politica_sst: true,
  matriz_aspectos_impactos: true,
  matriz_aspectos: true,
  matriz_requisitos_legais: true,
  pgrs: true,
  pgr: true,
  pcmso: true,
  plano_emergencia: true,
  inventario_riscos: true,
  apr: true,
  matriz_treinamentos: true,
  codigo_conduta_etica: true,
  codigo_conduta: true,
  politica_canal_denuncia: true,
  procedimento_auditoria_interna: true,
  auditoria_interna: true,
  procedimento_controle_operacional_ambiental: true,
  controle_operacional_ambiental: true,
  procedimento: true,
  plano_acao: true,
} satisfies Record<string, true>

const ALIASES_TIPO_DECLARADO: Record<string, keyof typeof AGENTES_REGISTRADOS> = {
  matriz_aspectos_impactos: 'matriz_aspectos',
  codigo_conduta_etica: 'codigo_conduta',
  procedimento_auditoria_interna: 'auditoria_interna',
  procedimento_controle_operacional_ambiental: 'controle_operacional_ambiental',
}

export function detectarTipoAgente(nomeDocumento: string, tipoDeclarado?: string | null): string {
  if (tipoDeclarado) {
    const tipoNormalizado = normalizarTipoDeclarado(tipoDeclarado)
    const alias = ALIASES_TIPO_DECLARADO[tipoNormalizado]

    if (alias) return alias
    if (tipoNormalizado in AGENTES_REGISTRADOS) return tipoNormalizado
  }

  const agenteDetectado = detectarPorNome(nomeDocumento)
  if (process.env.NODE_ENV === 'development' && agenteDetectado === 'generico') {
    console.warn(
      `[DISPATCH WARN] Documento "${nomeDocumento}" caiu em "generico". Tipo declarado: "${tipoDeclarado || 'nao informado'}". Verifique mapeamento.`,
    )
  }

  return agenteDetectado
}

function detectarPorNome(nome: string) {
  const n = normalizarNomeDocumento(nome)

  if (n.includes('politica ambiental')) return 'politica_ambiental'
  if (n.includes('politica') && (n.includes('sst') || n.includes('seguranca') || n.includes('saude'))) {
    return 'politica_sst'
  }
  if (n.includes('pgrs') || (n.includes('residuos') && n.includes('solidos')) || n.includes('gerenciamento de residuos')) return 'pgrs'
  if (n === 'pgr' || n.includes('programa de gerenciamento de riscos')) return 'pgr'
  if (n.includes('pcmso') || n.includes('controle medico')) return 'pcmso'
  if (n.includes('matriz') && n.includes('requisito') && (n.includes('legal') || n.includes('legais'))) return 'matriz_requisitos_legais'
  if (n.includes('matriz') && n.includes('aspecto')) return 'matriz_aspectos'
  if (n.includes('inventario') && n.includes('risco')) return 'inventario_riscos'
  if (n.includes('apr') || n.includes('analise preliminar')) return 'apr'
  if (n.includes('plano') && n.includes('emergencia')) return 'plano_emergencia'
  if (n.includes('pae')) return 'plano_emergencia'
  if (n.includes('matriz') && n.includes('treinamento')) return 'matriz_treinamentos'
  if (n.includes('codigo') && n.includes('conduta')) return 'codigo_conduta'
  if (n.includes('canal') && n.includes('denuncia')) return 'politica_canal_denuncia'
  if (n.includes('auditoria') && n.includes('interna')) return 'auditoria_interna'
  if (n.includes('controle') && n.includes('operacional') && n.includes('ambiental')) return 'controle_operacional_ambiental'
  if (n.includes('procedimento')) return 'procedimento'
  if (n.includes('plano de acao')) return 'plano_acao'

  return 'generico'
}

function normalizarTipoDeclarado(value: string) {
  return normalizarNomeDocumento(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizarNomeDocumento(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ÃƒÂ£|Ã£Â£/g, 'a')
    .replace(/ÃƒÂ¡|Ã£Â¡/g, 'a')
    .replace(/ÃƒÂ¢|Ã£Â¢/g, 'a')
    .replace(/ÃƒÂ©|Ã£Â©/g, 'e')
    .replace(/ÃƒÂª|Ã£Âª/g, 'e')
    .replace(/ÃƒÂ­|Ã£Â­/g, 'i')
    .replace(/ÃƒÂ³|Ã£Â³/g, 'o')
    .replace(/ÃƒÂµ|Ã£Âµ/g, 'o')
    .replace(/ÃƒÂº|Ã£Âº/g, 'u')
    .replace(/ÃƒÂ§|Ã£Â§/g, 'c')
}
