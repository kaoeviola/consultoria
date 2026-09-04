import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarPoliticaCanalDenuncia(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('gestao', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    '## CONTEUDO OBRIGATORIO DESTE DOCUMENTO',
    '',
    'A Politica de Canal de Denuncia deve incluir explicitamente referencia a:',
    '',
    '1. LGPD (Lei 13.709/2018) - Tratamento de dados pessoais do denunciante. Secao obrigatoria "Tratamento de Dados Pessoais conforme LGPD", explicando: base legal do tratamento (legitimo interesse e cumprimento de obrigacao legal), direitos do titular, prazo de retencao dos dados de denuncia e controle de acesso.',
    '',
    '2. Lei 14.457/2022 - Canal de denuncia para casos de assedio sexual e outras formas de violencia, especialmente vinculado a CIPA. Secao obrigatoria "Conformidade com Lei 14.457/2022 e CIPA".',
    '',
    '3. Lei 12.846/2013 (Lei Anticorrupcao) - Canal como elemento de Programa de Integridade exigido pela Lei e regulamentado pelo Decreto 11.129/2022.',
    '',
    'Estrutura minima das secoes: Objetivo, Abrangencia, Base Legal citando LGPD, Lei 14.457/2022, Lei 12.846/2013 e Decreto 11.129/2022, Tipos de Denuncia, Canais Disponiveis (presencial, telefone, online, e-mail), Garantias ao Denunciante, Tratamento de Dados (LGPD), Triagem e Investigacao, Protecao contra Retaliacao, Sancoes, Indicadores, Aprovacao.',
    '',
    'Lembre-se: a empresa tem 45 funcionarios. Nao invente "comite de etica" ou "departamento de compliance" estruturado. Use formulacoes realistas: "responsavel pela gestao de compliance", "gestor designado pela direcao".',
    '',
    'Voce e especialista em compliance, governanca corporativa e ESG.',
    'Gere Politica de Canal de Denuncia em markdown, especifica para a empresa.',
    'Estrutura obrigatoria: Objetivo, Abrangencia, Tipos de denuncia aceitas, Procedimentos de recebimento e triagem, Garantias ao denunciante, Confidencialidade, Protecao contra retaliacao, Investigacao, Prazos, Responsabilidades, Registros e Indicadores.',
    'Inclua denuncias de assedio, discriminacao, corrupcao, fraude, seguranca do trabalho, meio ambiente e violacoes do codigo de conduta.',
    'Use linguagem formal, objetiva e auditavel. Nao invente canal existente; quando nao houver, proponha canal a implantar.',
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
    metadados: { raciocinioIA: raciocinio, agente: 'politicaCanalDenuncia' },
  }
}
