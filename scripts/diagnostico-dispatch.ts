import { detectarTipoAgente } from '@/lib/agents/dispatch'

const TIPOS_DOCUMENTO = [
  'politica-ambiental',
  'politica-sst',
  'matriz-aspectos-impactos',
  'matriz-requisitos-legais',
  'pgrs',
  'plano-emergencia',
  'inventario-riscos',
  'apr',
  'matriz-treinamentos',
  'codigo-conduta-etica',
  'politica-canal-denuncia',
  'procedimento-auditoria-interna',
  'procedimento-controle-operacional-ambiental',
] as const

const NOMES_COMUNS: Record<(typeof TIPOS_DOCUMENTO)[number], string> = {
  'politica-ambiental': 'Política Ambiental',
  'politica-sst': 'Política de Saúde e Segurança no Trabalho',
  'matriz-aspectos-impactos': 'Matriz de Aspectos e Impactos Ambientais',
  'matriz-requisitos-legais': 'Matriz de Requisitos Legais Ambientais',
  pgrs: 'Plano de Gerenciamento de Resíduos Sólidos',
  'plano-emergencia': 'Plano de Resposta a Emergências',
  'inventario-riscos': 'Inventário de Riscos Ocupacionais',
  apr: 'Análise Preliminar de Riscos',
  'matriz-treinamentos': 'Matriz de Treinamentos',
  'codigo-conduta-etica': 'Código de Conduta e Ética',
  'politica-canal-denuncia': 'Política de Canal de Denúncia',
  'procedimento-auditoria-interna': 'Procedimento de Auditoria Interna',
  'procedimento-controle-operacional-ambiental': 'Procedimento de Controle Operacional Ambiental',
}

const AGENTE_ESPERADO: Record<(typeof TIPOS_DOCUMENTO)[number], string> = {
  'politica-ambiental': 'politica_ambiental',
  'politica-sst': 'politica_sst',
  'matriz-aspectos-impactos': 'matriz_aspectos',
  'matriz-requisitos-legais': 'matriz_requisitos_legais',
  pgrs: 'pgrs',
  'plano-emergencia': 'plano_emergencia',
  'inventario-riscos': 'inventario_riscos',
  apr: 'apr',
  'matriz-treinamentos': 'matriz_treinamentos',
  'codigo-conduta-etica': 'codigo_conduta',
  'politica-canal-denuncia': 'politica_canal_denuncia',
  'procedimento-auditoria-interna': 'auditoria_interna',
  'procedimento-controle-operacional-ambiental': 'controle_operacional_ambiental',
}

async function main() {
  console.log('\n========== DIAGNÓSTICO DE DISPATCH ==========\n')
  console.log('Tipo declarado'.padEnd(48), '|', 'Nome amigável'.padEnd(50), '|', 'Agente que captura'.padEnd(35), '| Status')

  for (const tipo of TIPOS_DOCUMENTO) {
    const nome = NOMES_COMUNS[tipo]
    const agenteCapturado = detectarTipoAgente(nome, tipo)
    const esperado = AGENTE_ESPERADO[tipo]
    const status = agenteCapturado === esperado ? 'OK' : 'CAINDO EM MAPEAMENTO ERRADO'

    console.log(`${tipo.padEnd(48)} | ${nome.padEnd(50)} | ${agenteCapturado.padEnd(35)} | ${status}`)
  }
}

main().catch(console.error)
