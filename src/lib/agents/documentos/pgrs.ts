import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarPGRS(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('ambiental', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e especialista senior em gestao de residuos solidos, ISO 14001, PNRS, ABNT NBR 10004 e MTR.',
    'Gere Plano de Gestao de Residuos Solidos (PGRS) em markdown, especifico para o setor real da empresa.',
    'Estrutura obrigatoria: Objetivo, Escopo, Caracterizacao da empresa, Diagnostico de residuos, Classificacao legal, Segregacao, Acondicionamento, Coleta interna, Armazenamento temporario, Destinacao final licenciada, Sistema de retorno pos-consumo quando aplicavel, Indicadores, Registros e Plano de acao.',
    'Para cada residuo, trazer: identificacao, classe I/IIA/IIB conforme ABNT NBR 10004, quantificacao estimada, acondicionamento, coleta interna, armazenamento temporario, destinacao final licenciada, MTR obrigatorio e indicador.',
    'Cite Lei 12.305/2010 como Politica Nacional de Residuos Solidos e ABNT NBR 10.004 como Classificacao de residuos solidos.',
    'Nao use a expressao "logistica reversa"; use "sistema de retorno pos-consumo" quando aplicavel, para nao confundir com processo operacional da empresa.',
    'Nao associe CONAMA 430 a classificacao de residuos; CONAMA 430 trata de padroes de lancamento de efluentes.',
    'Nao invente dados; quando faltar volume ou destinador, marcar precisa validacao. Documento com 800 a 1500 palavras.',
  ].join('\n')
  const userPrompt = [
    'Gere um PGRS - Plano de Gerenciamento de Residuos Solidos.',
    'Use residuos gerados da ontologia, anamnese e arquivos processados.',
    '',
    'Contexto completo:',
    contexto,
  ].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, maxTokens: 4000, model: 'gpt-4o-mini', temperature: 0.3 },
  )

  return {
    conteudo: String(resultado),
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'pgrs',
    },
  }
}
