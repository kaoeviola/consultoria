import { executarComRaciocinio } from '@/lib/agents/base/agenteCOT'
import { montarPromptBaseDoContexto } from '@/lib/agents/promptBase'
import { PADRAO_PCMSO } from '@/lib/referencias/padroesTecnicos'

type GerarPCMSOInput = {
  empresa: unknown
  perfilOperacional: unknown
  arquivosAnalisados: unknown
  ontologiaSetor: unknown
  contextoCompleto: string
  docProjetoId?: string
}

export async function gerarPCMSO({
  empresa,
  perfilOperacional,
  arquivosAnalisados,
  ontologiaSetor,
  contextoCompleto,
  docProjetoId,
}: GerarPCMSOInput) {
  const systemPrompt = [
    montarPromptBaseDoContexto('sst', contextoCompleto),
    '',
    '# INSTRUCOES ESPECIFICAS DESTE AGENTE',
    '',
    'Voce e medico do trabalho senior elaborando PCMSO conforme NR-07 atualizada pela Portaria 6.734/2020. O PCMSO deve estar perfeitamente alinhado ao PGR da empresa.',
    '',
    'REGRAS ABSOLUTAS:',
    'Para cada risco identificado no PGR, defina exames especificos com periodicidade.',
    'Use os 10 objetivos textuais da NR-07 itens a-j sem modificacao.',
    'Exames devem ser especificos por agente: ruido -> audiometria, quimicos -> hemograma + funcao hepatica + renal especifica por substancia, vibracao -> exame neurologico, calor -> cardiovascular.',
    'Periodicidade: admissional, periodico (anual, semestral conforme risco), mudanca de funcao, retorno ao trabalho, demissional.',
    'Designe medico examinador com placeholder [Dr. Nome - CRM XX/UF].',
    'NUNCA omita o termo de ciencia e responsabilidade da empresa.',
    '',
    'Retorne PCMSO em markdown estruturado seguindo PADRAO_PCMSO.estruturaObrigatoria na ordem.',
  ].join('\n')

  const userPrompt = [
    'PADRAO_PCMSO:',
    JSON.stringify(PADRAO_PCMSO, null, 2),
    '',
    'Empresa:',
    JSON.stringify(empresa, null, 2),
    '',
    'Perfil operacional e riscos:',
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

  const { resultado, raciocinio } = await executarComRaciocinio(
    systemPrompt,
    userPrompt,
    undefined,
    { docProjetoId, maxTokens: 5000 },
  )

  return {
    conteudo: String(resultado),
    metadados: {
      raciocinioIA: raciocinio,
      agente: 'pcmso',
    },
  }
}
