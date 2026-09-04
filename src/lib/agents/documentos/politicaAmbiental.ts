import { openai } from '@/lib/openai'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'
import { PADRAO_POLITICA_AMBIENTAL } from '@/lib/referencias/padroesTecnicos'

type GerarPoliticaAmbientalInput = {
  empresa: unknown
  perfilOperacional: unknown
  arquivosAnalisados: unknown
  ontologiaSetor: unknown
  contextoCompleto: string
  docProjetoId?: string
}

export async function gerarPoliticaAmbiental({
  empresa,
  perfilOperacional,
  arquivosAnalisados,
  ontologiaSetor,
  contextoCompleto,
}: GerarPoliticaAmbientalInput) {
  const systemPrompt = [
    montarPromptBaseDoContexto('ambiental', contextoCompleto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'ATENCAO: Antes de citar qualquer norma neste documento, releia as secoes "TERMOS PROIBIDOS" e "FRASES OBRIGATORIAS" do prompt base. Use apenas as formulacoes da lista de FRASES OBRIGATORIAS. Qualquer outra descricao de NR-9, CONAMA 430, Lei 12.305 ou NBR 10.004 sera considerada erro tecnico grave.',
    '',
    'Voce e auditor lider ISO 14001:2015 com 25 anos de experiencia em certificacao ambiental para cadeias industriais.',
    '',
    'ESTRUTURA OBRIGATORIA - 8 SECOES NUMERADAS:',
    '',
    '1. PROPOSITO',
    '- Mencionar explicitamente: ISO 14001:2015',
    '- Compromissos com: protecao do meio ambiente, prevencao da poluicao, melhoria continua do SGA',
    '',
    '2. ESCOPO',
    '- Detalhar atividades, produtos e servicos reais da empresa',
    '- Citar processos identificados no perfil operacional',
    '',
    '3. COMPROMISSOS DA ORGANIZACAO',
    '3.1 Protecao do Meio Ambiente',
    '3.2 Atendimento a Requisitos Legais e Outros Requisitos',
    '3.3 Melhoria Continua do SGA',
    '',
    '4. DIRETRIZES AMBIENTAIS ESTRATEGICAS',
    'Subsecoes obrigatorias conforme aspectos ambientais reais do setor:',
    '4.1 Emissoes de Gases de Efeito Estufa (GEE)',
    '4.2 Eficiencia Energetica',
    '4.3 Agua - Consumo, Qualidade e Gestao',
    '4.4 Qualidade do Ar (se aplicavel)',
    '4.5 Gestao de Produtos Quimicos (se usa quimicos)',
    '4.6 Residuos - Reutilizacao e Reciclagem',
    '4.7 Qualidade do Solo (se ha risco de contaminacao)',
    '4.8 Ruido Ambiental (se aplicavel)',
    '4.9 Outros aspectos especificos do setor',
    'Cada subsecao deve ter 3-5 bullets com ACOES ESPECIFICAS, nao genericas.',
    '',
    '5. INTEGRACAO COM O SGA',
    'Listar 6 pontos: aspectos e impactos, objetivos e metas, planejamento de acoes, controles operacionais, monitoramento, auditorias.',
    '',
    '6. COMUNICACAO',
    'Como sera comunicada interna e externamente. Manutencao como informacao documentada.',
    '',
    '7. RESPONSABILIDADES',
    'Alta Direcao: integracao ao negocio, recursos, melhoria continua, lideranca.',
    '',
    '8. REVISAO E APROVACAO',
    'Periodicidade e gatilhos de revisao.',
    '',
    'REGRAS ABSOLUTAS:',
    '- NUNCA escrever texto generico tipo "buscamos melhoria continua" sem acao especifica.',
    '- SEMPRE mencionar o nome real da empresa pelo menos 5 vezes.',
    '- SEMPRE citar pelo menos 3 aspectos ambientais REAIS do setor vindos do perfil operacional.',
    '- SEMPRE citar legislacao especifica aplicavel: ISO 14001:2015, Lei 12.305/2010 (PNRS), CONAMA 430/2011 (efluentes), CONAMA 307/2002 (RCC), conforme aplicabilidade.',
    '- Use linguagem tecnica de auditoria, nao linguagem comercial.',
    '- Documento deve ter entre 1200 e 1800 palavras.',
    '- Retorne somente Markdown renderizavel, sem cercas de codigo.',
    '',
    'ERROS PROIBIDOS - O DOCUMENTO SERA REPROVADO SE COMETER:',
    '1. NUNCA citar Normas Regulamentadoras (NR-01 a NR-39) em Politica AMBIENTAL. NRs sao normas de SST, nao ambientais. Politica Ambiental cita ISO 14001, ISO 14004, ISO 14040, leis ambientais, CONAMA e ABNT NBR ambientais. Citacoes trabalhistas/SST pertencem a Politica SST separada.',
    '2. NUNCA pular numeracao de subsecoes. A numeracao deve ser sequencial e continua: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8.',
    '3. SEMPRE adaptar diretrizes ambientais aos aspectos REAIS do setor.',
    'Para metalurgia e OBRIGATORIO incluir:',
    '- 4.1 Emissoes de Gases de Efeito Estufa (GEE)',
    '- 4.2 Eficiencia Energetica',
    '- 4.3 Agua - Consumo e Efluentes Industriais, citando fluidos de corte usados',
    '- 4.4 Qualidade do Ar, citando fumos metalicos de soldagem e VOC de pintura',
    '- 4.5 Gestao de Produtos Quimicos, citando oleos, solventes, tintas e FISPQ',
    '- 4.6 Residuos Solidos, citando ABNT NBR 10004, classe I e classe II, sucata metalica e EPI contaminado',
    '- 4.7 Qualidade do Solo, citando prevencao de contaminacao por oleos',
    '- 4.8 Ruido Ambiental, citando vizinhanca',
    '4. SEMPRE citar legislacao ambiental correta. Obrigatorio: ABNT NBR ISO 14001:2015 e Lei 12.305/2010 (PNRS). Recomendado conforme aplicavel: Lei 6.938/1981, CONAMA 430/2011, CONAMA 307/2002, CONAMA 313/2002, CONAMA 357/2005, ABNT NBR 10004, ABNT NBR 10005, ABNT NBR 10006, ABNT NBR 10007 e Protocolo de Montreal.',
    '5. SEMPRE incluir compromissos mensuraveis. Cada diretriz deve ter pelo menos 1 indicador OU meta mensuravel, por exemplo kWh/tonelada produzida, m3 de agua/tonelada, kg residuo classe I/mes, % destinacao licenciada ou numero de vazamentos.',
    '6. Use linguagem tecnica de auditor. Evite "buscamos", "nos esforcamos" e "estamos comprometidos". Use "estabelece", "implementa", "mantem", "monitora" e "reporta".',
  ].join('\n')

  const userPrompt = [
    'PADRAO_POLITICA_AMBIENTAL:',
    JSON.stringify(PADRAO_POLITICA_AMBIENTAL, null, 2),
    '',
    'Empresa:',
    JSON.stringify(empresa, null, 2),
    '',
    'Perfil operacional:',
    JSON.stringify(perfilOperacional, null, 2),
    '',
    'Arquivos analisados:',
    JSON.stringify(arquivosAnalisados, null, 2),
    '',
    'Ontologia do setor:',
    JSON.stringify(ontologiaSetor, null, 2),
    '',
    'Contexto completo consolidado:',
    contextoCompleto,
  ].join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 3500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const conteudo = completion.choices[0]?.message.content

  if (!conteudo) {
    throw new Error('A OpenAI nao retornou Politica Ambiental.')
  }

  return {
    conteudo,
    metadados: {
      agente: 'politicaAmbiental',
      modelo: 'gpt-4o-mini',
      promptTecnico: 'politicaAmbientalISO14001Automotivo',
    },
  }
}
