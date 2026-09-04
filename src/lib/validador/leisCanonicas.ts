export const LEIS_CANONICAS = {
  // Ambiental - federais e normas tecnicas
  'CONAMA 237': { ano: 1997, tema: 'Criterios e procedimentos para licenciamento ambiental', escopo: 'ambiental' },
  'CONAMA 313': { ano: 2002, tema: 'Inventario Nacional de Residuos Solidos Industriais', escopo: 'ambiental' },
  'CONAMA 357': { ano: 2005, tema: 'Classificacao de aguas e padroes de lancamento', escopo: 'ambiental' },
  'CONAMA 430': { ano: 2011, tema: 'Padroes de lancamento de efluentes', escopo: 'ambiental' },
  'Decreto 7.404': { ano: 2010, tema: 'Regulamenta a Politica Nacional de Residuos Solidos', escopo: 'ambiental' },
  'Decreto 10.388': { ano: 2020, tema: 'Sistema de logistica reversa de medicamentos', escopo: 'ambiental' },
  'Lei 6.938': { ano: 1981, tema: 'Politica Nacional do Meio Ambiente', escopo: 'ambiental' },
  'Lei 9.605': { ano: 1998, tema: 'Lei de Crimes Ambientais', escopo: 'ambiental' },
  'Lei 12.305': { ano: 2010, tema: 'Politica Nacional de Residuos Solidos', escopo: 'ambiental' },
  'NBR 10.004': { ano: 2004, tema: 'Classificacao de residuos solidos quanto a periculosidade', escopo: 'ambiental' },
  'NBR 10.007': { ano: 2004, tema: 'Amostragem de residuos solidos', escopo: 'ambiental' },
  'NBR ISO 14001': { ano: 2015, tema: 'Sistema de Gestao Ambiental - requisitos com orientacoes para uso', escopo: 'ambiental' },

  // Ambiental - estaduais SP/CETESB
  'Lei Estadual SP 997': { ano: 1976, tema: 'Controle da poluicao do meio ambiente no Estado de Sao Paulo', escopo: 'ambiental' },
  'Decreto SP 8.468': { ano: 1976, tema: 'Regulamenta a Lei Estadual SP 997/76 sobre prevencao e controle de poluicao', escopo: 'ambiental' },
  'Decisao de Diretoria CETESB 38': { ano: 2017, tema: 'Procedimentos de licenciamento ambiental no Estado de Sao Paulo', escopo: 'ambiental' },

  // SST
  'NR-1': { ano: 2020, tema: 'Disposicoes gerais e gerenciamento de riscos ocupacionais', escopo: 'sst' },
  'NR-6': { ano: 1978, tema: 'Equipamento de Protecao Individual', escopo: 'sst' },
  'NR-7': { ano: 2022, tema: 'Programa de Controle Medico de Saude Ocupacional', escopo: 'sst' },
  'NR-9': { ano: 2020, tema: 'Avaliacao e Controle das Exposicoes Ocupacionais', escopo: 'sst' },
  'NR-12': { ano: 2010, tema: 'Seguranca no trabalho em maquinas e equipamentos', escopo: 'sst' },
  'NR-15': { ano: 1978, tema: 'Atividades e operacoes insalubres', escopo: 'sst' },
  'NR-17': { ano: 2022, tema: 'Ergonomia', escopo: 'sst' },
  'NR-33': { ano: 2006, tema: 'Seguranca e Saude no Trabalho em Espacos Confinados', escopo: 'sst' },
  'NR-35': { ano: 2012, tema: 'Trabalho em Altura', escopo: 'sst' },
  'Lei 8.213': { ano: 1991, tema: 'Plano de Beneficios da Previdencia Social - base de comunicacao de acidentes', escopo: 'sst' },
  'Decreto 3.048': { ano: 1999, tema: 'Regulamento da Previdencia Social', escopo: 'sst' },
  'Portaria MTE 1.510': { ano: 2009, tema: 'Sistema de Registro Eletronico de Ponto', escopo: 'sst' },

  // Gestao / governanca / ESG
  'Lei 12.846': { ano: 2013, tema: 'Lei Anticorrupcao (Lei da Empresa Limpa)', escopo: 'gestao' },
  'Decreto 11.129': { ano: 2022, tema: 'Regulamenta a Lei Anticorrupcao e dispoe sobre Programa de Integridade', escopo: 'gestao' },
  LGPD: { ano: 2018, tema: 'Lei Geral de Protecao de Dados Pessoais', escopo: 'gestao' },
  'Lei 13.709': { ano: 2018, tema: 'Lei Geral de Protecao de Dados Pessoais', escopo: 'gestao' },
  'Lei 14.457': { ano: 2022, tema: 'Programa Emprega + Mulheres e Jovens, com CIPA + medidas de prevencao ao assedio', escopo: 'gestao' },
  'ISO 37001': { ano: 2016, tema: 'Sistema de gestao antissuborno', escopo: 'gestao' },
  'ISO 37301': { ano: 2021, tema: 'Sistema de gestao de compliance', escopo: 'gestao' },
} as const

export type CodigoLeiCanonica = keyof typeof LEIS_CANONICAS
