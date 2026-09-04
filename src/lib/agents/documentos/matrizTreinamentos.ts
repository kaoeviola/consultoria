import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'

export async function gerarMatrizTreinamentos(contexto: string, docProjetoId?: string) {
  const systemPrompt = [
    montarPromptBaseDoContexto('sst', contexto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e consultor senior em SST, ISO 45001 e gestao de competencias.',
    'Gere Matriz de Treinamentos Obrigatorios em markdown para a empresa, usando setor, processos, riscos e documentos analisados.',
    'Estrutura obrigatoria: Objetivo, Escopo, Criterios de obrigatoriedade, Matriz de treinamentos, Controle de registros, Reciclagens e Responsabilidades.',
    'A tabela deve conter: Treinamento, Norma referencia, Publico-alvo, Carga horaria, Periodicidade, Tipo (admissional, periodico, reciclagem), Responsavel, Evidencia esperada.',
    'Cite NRs aplicaveis com nome completo quando houver relacao com os riscos do setor.',
    'Esta matriz e de SST. NAO cite legislacao ambiental especifica como Lei 12.305, PNRS, Lei 6.938, CONAMA, ISO 14001, NBR 10.004 ou NBR 10.007.',
    'Se houver necessidade de treinamento ambiental, mencione apenas "treinamento ambiental interno conforme procedimento da empresa", sem norma ambiental especifica.',
    'Use apenas processos declarados. Se a anamnese tiver "Expedicao", nao substitua por Armazenagem, Almoxarifado ou Logistica.',
    'Nao invente cargos; se nao existirem, use funcoes/processos provaveis e marque precisa validacao.',
    'Documento com 800 a 1500 palavras, linguagem tecnica e pratica.',
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
    metadados: { raciocinioIA: raciocinio, agente: 'matrizTreinamentos' },
  }
}
