import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarCodigoConduta(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('gestao', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    '## CONTEUDO OBRIGATORIO DESTE DOCUMENTO',
    '',
    'O Codigo de Conduta e Etica deve incluir explicitamente:',
    '',
    '1. Lei 12.846/2013 (Lei Anticorrupcao / Lei da Empresa Limpa) - Secao "Compromisso com a Lei Anticorrupcao" citando expressamente a Lei 12.846/2013 e o Decreto 11.129/2022 que a regulamenta. Deve mencionar: vedacao a pagamentos indevidos, brindes e hospitalidades com limites, due diligence de terceiros.',
    '',
    '2. Decreto 11.129/2022 - Programa de Integridade conforme o decreto regulamentador.',
    '',
    '3. LGPD (Lei 13.709/2018) - Compromisso com protecao de dados pessoais de colaboradores, clientes e fornecedores.',
    '',
    '4. Lei 14.457/2022 - Compromisso com prevencao de assedio sexual e moral, conforme a Lei.',
    '',
    '5. Referencia generica, nao detalhada, ao Sistema de Gestao de SST e ao Sistema de Gestao Ambiental como compromissos da empresa, sem citar NRs especificas. Lembre-se: Codigo de Conduta e categoria gestao.',
    '',
    'Estrutura minima: Proposito, Principios, Compromisso Anticorrupcao (Lei 12.846 + Decreto 11.129), Tratamento de Dados (LGPD), Prevencao de Assedio (Lei 14.457), Conduta com Colaboradores, Clientes, Fornecedores e Sociedade, Conflitos de Interesse, Canal de Denuncia, Sancoes, Termo de Ciencia.',
    '',
    'Voce e consultor senior em ESG, compliance e sistemas de gestao.',
    'Gere Codigo de Conduta e Etica em markdown, especifico para a empresa e seu setor.',
    'Estrutura obrigatoria: Proposito, Principios, Conduta com colaboradores, Conduta com clientes e fornecedores, Conduta com sociedade, Conflito de interesses, Anticorrupcao, Canal de denuncia, Sancoes, Termo de ciencia.',
    'Adapte exemplos de conduta aos riscos reais do setor, cadeia de suprimentos e contexto operacional.',
    'Use linguagem institucional, clara e auditavel. Nao use tom publicitario.',
    'Documento com 800 a 1500 palavras.',
  ].join('\n')
  const userPrompt = ['Contexto completo:', contexto].join('\n')

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 3500 },
  )

  return {
    conteudo: String(resultado),
    metadados: { raciocinioIA: raciocinio, agente: 'codigoConduta' },
  }
}
