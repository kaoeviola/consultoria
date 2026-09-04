import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { aplicarWarningProcessos } from '@/lib/agents/validacao-processos'
import { validarComoAuditor } from '@/lib/agents/validadorAuditoria'
import { jsonErrorResponse } from '@/lib/api-error'
import { limparMarkdownFence } from '@/lib/documentos/markdown'
import { prisma } from '@/lib/prisma'

const projetoCompletoInclude = {
  empresa: true,
  anamnese: true,
  avaliacoes: {
    include: {
      itens: {
        where: {
          status: {
            in: ['nao_atende', 'atende_parcialmente'],
          },
        },
        include: {
          requisito: true,
        },
      },
    },
  },
} satisfies Prisma.ProjetoInclude

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('=== GERAR DOCUMENTO ===')
    console.log('Body recebido:', JSON.stringify(body, null, 2))

    const {
      docProjetoId,
      projetoId,
      tipoDocumento,
      nomeDocumento,
      requisitosOrigem,
    } = body || {}

    if (!docProjetoId && (!projetoId || !nomeDocumento)) {
      return NextResponse.json(
        {
          error: 'Informe docProjetoId OU (projetoId + nomeDocumento)',
          recebido: body,
        },
        { status: 400 },
      )
    }

    let docProjeto
    const isRegeneracao = Boolean(docProjetoId)

    if (docProjetoId) {
      docProjeto = await prisma.docProjeto.findUnique({
        where: { id: String(docProjetoId) },
        include: {
          projeto: {
            include: projetoCompletoInclude,
          },
        },
      })

      if (!docProjeto) {
        return NextResponse.json(
          { error: 'DocProjeto nao encontrado' },
          { status: 404 },
        )
      }
    } else {
      const projeto = await prisma.projeto.findUnique({
        where: { id: String(projetoId) },
        include: {
          empresa: true,
          anamnese: true,
        },
      })

      if (!projeto) {
        return NextResponse.json(
          { error: 'Projeto nao encontrado' },
          { status: 404 },
        )
      }

      docProjeto = await prisma.docProjeto.create({
        data: {
          projetoId: String(projetoId),
          nome: String(nomeDocumento),
          tipo: tipoDocumento ? String(tipoDocumento) : 'geravel_ia',
          status: 'em_revisao',
          requisitosOrigem: Array.isArray(requisitosOrigem) ? requisitosOrigem.map(String) : [],
          geradoPorIA: true,
        },
        include: {
          projeto: {
            include: projetoCompletoInclude,
          },
        },
      })
    }

    console.log('DocProjeto resolvido:', docProjeto.id, docProjeto.nome)

    if (isRegeneracao && docProjeto.conteudo) {
      await prisma.versaoDocumento.create({
        data: {
          docProjetoId: docProjeto.id,
          versao: docProjeto.versao,
          conteudo: docProjeto.conteudo,
          alteracoes: 'Atualização do documento',
          autor: 'IA geradora',
        },
      })
    }

    const gaps = docProjeto.projeto.avaliacoes.flatMap((avaliacao) =>
      avaliacao.itens.map((item) => ({
        requisito: item.requisito.titulo,
        status: item.status,
        justificativa: item.observacao,
        documentoEsperado: item.requisito.documentoEsperado,
      })),
    )

    const { gerarDocumento } = await import('@/lib/agents/geradorDocumentos')
    const documentoGerado = await gerarDocumento(
      {
        id: docProjeto.id,
        projetoId: docProjeto.projetoId,
        nome: docProjeto.nome,
        tipo: docProjeto.tipo,
        gaps,
      },
      {
        nome: docProjeto.projeto.empresa.nome,
        setor: docProjeto.projeto.empresa.setor,
        setorCodigo: docProjeto.projeto.empresa.setorCodigo,
        cnae: docProjeto.projeto.empresa.cnae,
        cidade: docProjeto.projeto.empresa.cidade,
        estado: docProjeto.projeto.empresa.estado,
      },
      docProjeto.projeto.anamnese
        ? {
            numFuncionarios: docProjeto.projeto.anamnese.numFuncionarios,
            turnos: docProjeto.projeto.anamnese.turnos,
            processosPrincipais: docProjeto.projeto.anamnese.processosPrincipais,
            dadosSetor: docProjeto.projeto.anamnese.dadosSetor,
          }
        : null,
      docProjeto.projeto.anamnese?.perfilOperacional || {},
    )

    const conteudo = garantirEmpresaNoConteudo(
      sanitizarConteudoAntesDeSalvar(
      limparMarkdownFence(
      typeof documentoGerado === 'string' ? documentoGerado : documentoGerado.conteudo,
      ),
      docProjeto.nome,
      ),
      docProjeto.projeto.empresa.nome,
    )
    const metadados =
      typeof documentoGerado === 'string' ? null : documentoGerado.metadados
    const validacaoAuditoria = aplicarWarningProcessos(
      validarComoAuditor(
        conteudo,
        docProjeto.tipo || docProjeto.nome,
        { nome: docProjeto.projeto.empresa.nome },
      ),
      metadados,
    )
    const autoRevisao = metadados?.autoRevisao
    const rawScore =
      autoRevisao && typeof autoRevisao === 'object' && 'score' in autoRevisao
        ? (autoRevisao as { score?: unknown }).score
        : undefined
    const scoreQualidade =
      rawScore !== null && rawScore !== undefined
        ? Number(rawScore)
        : undefined

    const docAtualizado = await prisma.docProjeto.update({
      where: { id: docProjeto.id },
      data: {
        conteudo,
        status: 'em_revisao',
        geradoPorIA: true,
        metadados: JSON.parse(
          JSON.stringify({
            ...(metadados || {}),
            validacaoAuditoria,
          }),
        ) as Prisma.InputJsonValue,
        scoreQualidade: Number.isFinite(scoreQualidade)
          ? scoreQualidade
          : validacaoAuditoria.scoreAuditoria,
        versao: isRegeneracao ? { increment: 1 } : docProjeto.versao,
      },
    })

    return NextResponse.json({
      success: true,
      documento: docAtualizado,
    })
  } catch (error: unknown) {
    return jsonErrorResponse(error, '[API ERROR] gerar-documento')
  }
}

function sanitizarConteudoAntesDeSalvar(conteudo: string, nomeDocumento: string) {
  const nomeNormalizado = nomeDocumento
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const conteudoSanitizado = conteudo
    .replace(/NR-9\s*[-–—:]\s*Programa de Prevencao de Riscos Ambientais/gi, 'NR-9/2020 - Avaliacao e Controle das Exposicoes Ocupacionais')
    .replace(/NR-9\s*[-–—:]\s*Programa de Prevenção de Riscos Ambientais/gi, 'NR-9/2020 - Avaliacao e Controle das Exposicoes Ocupacionais')
    .replace(/\bPPRA\b/gi, 'NR-9/2020 - Avaliacao e Controle das Exposicoes Ocupacionais')
    .replace(/NBR\s*10\.004\s*[-–—:]\s*Gest[aã]o Ambiental/gi, 'NBR 10.004:2004 - Classificacao de residuos solidos quanto a periculosidade')
    .replace(/NBR\s*10\.004\s*[-–—:]\s*Classifica[cç][aã]o de res[ií]duos s[oó]lidos\b/gi, 'NBR 10.004:2004 - Classificacao de residuos solidos quanto a periculosidade')
    .replace(/\bINSAT\b/g, 'empresa de referencia externa omitida')
    .replace(/\bGrupo KWM\b/g, 'empresa de referencia externa omitida')
    .replace(/\bTempo BR\b/g, 'empresa de referencia externa omitida')
    .replace(/\bBrasil Ar\b/g, 'empresa de referencia externa omitida')
    .replace(/\bVolkswagen\b/g, 'cliente externo omitido')

  if (nomeNormalizado.includes('matriz') && nomeNormalizado.includes('requisitos') && nomeNormalizado.includes('legais')) {
    return conteudoSanitizado
      .split('\n')
      .filter((linha) => !/(^|[^A-Z0-9])NR[-\s]?\d{1,2}([^0-9]|$)/i.test(linha))
      .map((linha) => linha.replace(/\blogistica reversa\b/gi, 'sistema de retorno pos-consumo'))
      .filter((linha) => !(/CONAMA\s*430/i.test(linha) && /res[ií]du|classifica/i.test(linha)))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (nomeNormalizado.includes('controle') && nomeNormalizado.includes('operacional') && nomeNormalizado.includes('ambiental')) {
    return conteudoSanitizado
      .split('\n')
      .map((linha) => linha.replace(/\blog[ií]stica\b/gi, 'Expedicao'))
      .filter((linha) => !(/CONAMA\s*430/i.test(linha) && !/efluente/i.test(linha)))
      .filter((linha) => !(/Lei\s*6\.938/i.test(linha) && !/Politica Nacional do Meio Ambiente/i.test(linha)))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (nomeNormalizado.includes('matriz') && nomeNormalizado.includes('treinamento')) {
    return conteudoSanitizado
      .replace(/\barmazenagem\b/gi, 'Expedicao')
      .replace(/\blog[ií]stica\b/gi, 'Expedicao')
  }

  if (nomeNormalizado.includes('plano') && nomeNormalizado.includes('emergencia')) {
    return conteudoSanitizado
      .split('\n')
      .filter((linha) => !/(CONAMA|Lei\s*12\.305|PNRS|Politica Nacional de Residuos)/i.test(linha))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (nomeNormalizado.includes('auditoria') && nomeNormalizado.includes('interna')) {
    return conteudoSanitizado
      .split('\n')
      .filter((linha) => !/\bNR[-\s]?\d{1,2}\b/i.test(linha))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (nomeNormalizado.includes('apr')) {
    return conteudoSanitizado
      .replace(/\barmazenagem\b/gi, 'Expedicao')
      .replace(/\blog[ií]stica\b/gi, 'Expedicao')
  }

  return conteudoSanitizado
}

function garantirEmpresaNoConteudo(conteudo: string, nomeEmpresa: string) {
  if (normalizarTexto(conteudo).includes(normalizarTexto(nomeEmpresa))) return conteudo

  return [`Empresa avaliada: ${nomeEmpresa}`, '', conteudo].join('\n')
}

function normalizarTexto(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
