import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.configuracaoConsultoria.upsert({
    where: { id: 'seed-consultoria-sgi' },
    update: {
      nome: 'Consultoria SGI',
      nomeConsultoria: 'Consultoria SGI',
      nomeCompleto: 'Consultoria em Sistemas de Gestão Integrada',
      slogan: 'ISO 14001 · ISO 45001 · SST · ESG',
      responsavelTecnico: 'A SER PREENCHIDO PELA CONSULTORIA',
      registroResponsavel: 'A SER PREENCHIDO PELA CONSULTORIA',
    },
    create: {
      id: 'seed-consultoria-sgi',
      nome: 'Consultoria SGI',
      nomeConsultoria: 'Consultoria SGI',
      nomeCompleto: 'Consultoria em Sistemas de Gestão Integrada',
      slogan: 'ISO 14001 · ISO 45001 · SST · ESG',
      responsavelTecnico: 'A SER PREENCHIDO PELA CONSULTORIA',
      registroResponsavel: 'A SER PREENCHIDO PELA CONSULTORIA',
    },
  })

  const empresa = await prisma.empresa.upsert({
    where: { id: 'seed-metalurgica-sao-paulo' },
    update: {
      nome: 'Metalúrgica São Paulo Ltda',
      cnpj: '12.345.678/0001-90',
      cnae: '2599-3/99',
      setor: 'metalurgia',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    create: {
      id: 'seed-metalurgica-sao-paulo',
      nome: 'Metalúrgica São Paulo Ltda',
      cnpj: '12.345.678/0001-90',
      cnae: '2599-3/99',
      setor: 'metalurgia',
      cidade: 'São Paulo',
      estado: 'SP',
    },
  })

  const projetoExistente = await prisma.projeto.findFirst({
    where: {
      empresaId: empresa.id,
      nome: 'Diagnóstico Inicial ISO 14001',
    },
  })

  const projeto = projetoExistente
    ? await prisma.projeto.update({
        where: { id: projetoExistente.id },
        data: {
          tipo: 'diagnostico_inicial',
          status: 'em_andamento',
        },
      })
    : await prisma.projeto.create({
        data: {
          nome: 'Diagnóstico Inicial ISO 14001',
          tipo: 'diagnostico_inicial',
          status: 'em_andamento',
          empresaId: empresa.id,
        },
      })

  await prisma.anamnese.upsert({
    where: { projetoId: projeto.id },
    update: {
      numFuncionarios: 45,
      turnos: '2 turnos',
      processosPrincipais: 'usinagem, soldagem, pintura, expedição',
      dadosSetor: {
        licencaAmbiental: 'em processo',
        pgrAtualizado: 'sim',
        pcmsoAtualizado: 'sim',
        produtosQuimicos: 'sim',
        residuosPerigosos: 'sim',
        observacoesGerais:
          'Operação metalúrgica com uso de óleos, solventes, tintas, fumos metálicos e geração de resíduos contaminados.',
      },
    },
    create: {
      projetoId: projeto.id,
      numFuncionarios: 45,
      turnos: '2 turnos',
      processosPrincipais: 'usinagem, soldagem, pintura, expedição',
      dadosSetor: {
        licencaAmbiental: 'em processo',
        pgrAtualizado: 'sim',
        pcmsoAtualizado: 'sim',
        produtosQuimicos: 'sim',
        residuosPerigosos: 'sim',
        observacoesGerais:
          'Operação metalúrgica com uso de óleos, solventes, tintas, fumos metálicos e geração de resíduos contaminados.',
      },
    },
  })

  const modelo = await prisma.modeloAvaliacao.upsert({
    where: { id: 'seed-iso-14001-base' },
    update: {
      nome: 'ISO 14001 — Gestão Ambiental Base',
      descricao:
        'Modelo inicial para diagnóstico de gestão ambiental com requisitos essenciais da ISO 14001.',
      categoria: 'iso14001',
      versao: '1.0',
      ativo: true,
    },
    create: {
      id: 'seed-iso-14001-base',
      nome: 'ISO 14001 — Gestão Ambiental Base',
      descricao:
        'Modelo inicial para diagnóstico de gestão ambiental com requisitos essenciais da ISO 14001.',
      categoria: 'iso14001',
      versao: '1.0',
      ativo: true,
    },
  })

  await prisma.requisito.deleteMany({
    where: { modeloId: modelo.id },
  })

  await prisma.requisito.createMany({
    data: [
      {
        modeloId: modelo.id,
        codigo: '4.1',
        titulo: 'Entendimento da organização e seu contexto',
        descricao:
          'A organização deve determinar questões internas e externas relevantes ao seu propósito e que afetem sua capacidade de alcançar os resultados pretendidos do sistema de gestão ambiental.',
        categoria: 'Contexto da organização',
        peso: 1,
        ordem: 1,
        evidenciaEsperada:
          'Análise de contexto ambiental considerando processos de usinagem, soldagem, pintura, resíduos e requisitos de partes interessadas.',
        documentoEsperado: 'Matriz de contexto ambiental',
        acaoRecomendada:
          'Mapear questões internas e externas associadas à operação metalúrgica e seus aspectos ambientais.',
      },
      {
        modeloId: modelo.id,
        codigo: '4.2',
        titulo: 'Entendimento das necessidades e expectativas das partes interessadas',
        descricao:
          'A organização deve determinar partes interessadas pertinentes ao sistema de gestão ambiental e seus requisitos relevantes.',
        categoria: 'Contexto da organização',
        peso: 1,
        ordem: 2,
        evidenciaEsperada:
          'Lista de partes interessadas como clientes, órgãos ambientais, vizinhança, fornecedores de químicos e transportadores de resíduos.',
        documentoEsperado: 'Matriz de partes interessadas',
        acaoRecomendada:
          'Identificar requisitos ambientais de clientes, órgão ambiental, comunidade e fornecedores críticos.',
      },
      {
        modeloId: modelo.id,
        codigo: '5.2',
        titulo: 'Política ambiental',
        descricao:
          'A alta direção deve estabelecer, implementar e manter uma política ambiental apropriada ao propósito e contexto da organização.',
        categoria: 'Liderança',
        peso: 1.2,
        ordem: 3,
        evidenciaEsperada:
          'Política ambiental assinada pela direção, compatível com metalurgia, controle de resíduos perigosos, prevenção da poluição e atendimento legal.',
        documentoEsperado: 'Política Ambiental',
        acaoRecomendada:
          'Criar ou revisar política ambiental mencionando aspectos da operação metalúrgica e compromissos legais.',
      },
      {
        modeloId: modelo.id,
        codigo: '6.1.2',
        titulo: 'Aspectos ambientais',
        descricao:
          'A organização deve determinar os aspectos ambientais de suas atividades, produtos e serviços que pode controlar e influenciar, considerando uma perspectiva de ciclo de vida.',
        categoria: 'Planejamento',
        peso: 1.5,
        ordem: 4,
        evidenciaEsperada:
          'Levantamento de aspectos e impactos para usinagem, soldagem, pintura, consumo de energia, efluentes, emissões e resíduos perigosos.',
        documentoEsperado: 'Matriz de aspectos e impactos ambientais',
        acaoRecomendada:
          'Elaborar matriz de aspectos e impactos com critérios de significância para processos metalúrgicos.',
      },
      {
        modeloId: modelo.id,
        codigo: '8.1',
        titulo: 'Planejamento e controle operacional',
        descricao:
          'A organização deve estabelecer, implementar, controlar e manter processos necessários para atender aos requisitos do sistema de gestão ambiental.',
        categoria: 'Operação',
        peso: 1.5,
        ordem: 5,
        evidenciaEsperada:
          'Procedimentos ou controles operacionais para armazenamento de químicos, pintura, segregação de resíduos, destinação e resposta a emergências ambientais.',
        documentoEsperado: 'Procedimento de controle operacional ambiental',
        acaoRecomendada:
          'Definir controles operacionais para produtos químicos, resíduos perigosos e atividades com impacto ambiental significativo.',
      },
    ],
  })

  console.log('Seed concluído com sucesso.')
  console.log(`Empresa: ${empresa.nome}`)
  console.log(`Projeto: ${projeto.nome}`)
  console.log(`Modelo: ${modelo.nome}`)
}

main()
  .catch((error) => {
    console.error('Erro ao executar seed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
