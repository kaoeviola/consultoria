import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProjetoTabs } from '@/components/projeto/ProjetoTabs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ProjetoDetalhePage({
  params,
}: {
  params: Promise<{ id: string; projetoId: string }>
}) {
  const { id, projetoId } = await params
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    include: {
      empresa: {
        select: {
          id: true,
          nome: true,
          cnpj: true,
          cnae: true,
          setor: true,
          setorCodigo: true,
          cidade: true,
          estado: true,
        },
      },
      arquivos: {
        orderBy: { createdAt: 'desc' },
      },
      anamnese: true,
      avaliacoes: {
        include: {
          modelo: {
            include: {
              requisitos: true,
            },
          },
          itens: {
            include: {
              requisito: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      },
      documentos: {
        include: {
          exportacoes: {
            orderBy: { createdAt: 'desc' },
          },
          versoes: {
            orderBy: { createdAt: 'desc' },
          },
          validacoesFidelidade: {
            orderBy: { executadoEm: 'desc' },
            take: 5,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
    },
  })

  if (!projeto || projeto.empresaId !== id) {
    notFound()
  }

  const modelosDisponiveis = await prisma.modeloAvaliacao.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: {
        select: { requisitos: true },
      },
    },
  })

  const projetoData = {
    id: projeto.id,
    nome: projeto.nome,
    tipo: projeto.tipo,
    status: projeto.status,
    createdAt: projeto.createdAt.toISOString(),
    empresa: projeto.empresa,
    dashboard: buildDashboardSnapshot(projeto),
    hasPerfilOperacional: Boolean(projeto.anamnese?.perfilOperacional),
    arquivos: projeto.arquivos.map((arquivo) => ({
      id: arquivo.id,
      nome: arquivo.nome,
      url: arquivo.url,
      tipo: arquivo.tipo,
      tamanho: arquivo.tamanho,
      metadados:
        arquivo.metadados &&
        typeof arquivo.metadados === 'object' &&
        !Array.isArray(arquivo.metadados)
          ? arquivo.metadados
          : null,
      createdAt: arquivo.createdAt.toISOString(),
    })),
    anamnese: projeto.anamnese
      ? {
          id: projeto.anamnese.id,
          projetoId: projeto.anamnese.projetoId,
          numFuncionarios: projeto.anamnese.numFuncionarios,
          turnos: projeto.anamnese.turnos,
          processosPrincipais: projeto.anamnese.processosPrincipais,
          dadosSetor:
            projeto.anamnese.dadosSetor &&
            typeof projeto.anamnese.dadosSetor === 'object' &&
            !Array.isArray(projeto.anamnese.dadosSetor)
              ? projeto.anamnese.dadosSetor
              : null,
          perfilOperacional:
            projeto.anamnese.perfilOperacional &&
            typeof projeto.anamnese.perfilOperacional === 'object' &&
            !Array.isArray(projeto.anamnese.perfilOperacional)
              ? projeto.anamnese.perfilOperacional
              : null,
        }
      : null,
    avaliacoes: projeto.avaliacoes.map((avaliacao) => ({
      id: avaliacao.id,
      modeloId: avaliacao.modeloId,
      modelo: {
        id: avaliacao.modelo.id,
        nome: avaliacao.modelo.nome,
        categoria: avaliacao.modelo.categoria,
        versao: avaliacao.modelo.versao,
        requisitos: avaliacao.modelo.requisitos.map((requisito) => ({
          id: requisito.id,
          codigo: requisito.codigo,
          titulo: requisito.titulo,
          descricao: requisito.descricao,
          categoria: requisito.categoria,
          peso: requisito.peso,
          evidenciaEsperada: requisito.evidenciaEsperada,
          documentoEsperado: requisito.documentoEsperado,
        })),
      },
      itens: avaliacao.itens.map((item) => ({
        id: item.id,
        status: item.status,
        confiancaIA: item.confiancaIA,
        observacao: item.observacao,
        requisito: {
          id: item.requisito.id,
          codigo: item.requisito.codigo,
          titulo: item.requisito.titulo,
          descricao: item.requisito.descricao,
          evidenciaEsperada: item.requisito.evidenciaEsperada,
          documentoEsperado: item.requisito.documentoEsperado,
          categoria: item.requisito.categoria,
        },
      })),
    })),
    documentos: projeto.documentos.map((documento) => ({
      id: documento.id,
      nome: documento.nome,
      tipo: documento.tipo,
      status: documento.status,
      conteudo: documento.conteudo,
      versao: documento.versao,
      requisitosOrigem: documento.requisitosOrigem,
      geradoPorIA: documento.geradoPorIA,
      scoreQualidade: documento.scoreQualidade,
      aprovadoPor: documento.aprovadoPor,
      urlExportado: documento.urlExportado,
      createdAt: documento.createdAt.toISOString(),
      metadados:
        documento.metadados &&
        typeof documento.metadados === 'object' &&
        !Array.isArray(documento.metadados)
          ? documento.metadados
          : null,
      updatedAt: documento.updatedAt.toISOString(),
      exportacoes: documento.exportacoes.map((exportacao) => ({
        id: exportacao.id,
        formato: exportacao.formato,
        versao: exportacao.versao,
        urlArquivo: exportacao.urlArquivo,
        hashArquivo: exportacao.hashArquivo,
        exportadoPor: exportacao.exportadoPor,
        createdAt: exportacao.createdAt.toISOString(),
      })),
      versoes: documento.versoes.map((versao) => ({
        id: versao.id,
        versao: versao.versao,
        createdAt: versao.createdAt.toISOString(),
      })),
      validacoesFidelidade: documento.validacoesFidelidade.map((validacao) => ({
        id: validacao.id,
        versao: validacao.versao,
        score: validacao.score,
        divergencias: (Array.isArray(validacao.divergencias) ? validacao.divergencias : []) as Array<{
          severidade: 'critica' | 'alta' | 'media' | 'info'
          regra: string
          esperado: string | string[]
          encontrado: string | string[]
          mensagem: string
          localizacao?: string
        }>,
        criticas: validacao.criticas,
        altas: validacao.altas,
        medias: validacao.medias,
        infos: validacao.infos,
        bloqueia: validacao.bloqueia,
        executadoEm: validacao.executadoEm.toISOString(),
      })),
    })),
    modelosDisponiveis: modelosDisponiveis.map((modelo) => ({
      id: modelo.id,
      nome: modelo.nome,
      categoria: modelo.categoria,
      versao: modelo.versao,
      requisitosCount: modelo._count.requisitos,
    })),
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/empresas/${id}`}
        className="text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        Voltar para empresa
      </Link>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Projeto
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          {projeto.nome}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {projeto.empresa.nome} · {projeto.status}
        </p>
      </div>
      <ProjetoTabs projeto={projetoData} />
    </div>
  )
}

function buildDashboardSnapshot(projeto: {
  avaliacoes: {
    modelo: { nome: string }
    itens: {
      id: string
      status: string
      requisito: {
        codigo: string | null
        titulo: string
        peso: number
        documentoEsperado: string | null
        acaoRecomendada: string | null
      }
    }[]
  }[]
  documentos: { status: string }[]
}) {
  const itens = projeto.avaliacoes.flatMap((avaliacao) =>
    avaliacao.itens.map((item) => ({
      id: item.id,
      status: item.status,
      modelo: avaliacao.modelo.nome,
      requisito: {
        codigo: item.requisito.codigo,
        titulo: item.requisito.titulo,
        peso: item.requisito.peso,
        documentoEsperado: item.requisito.documentoEsperado,
        acaoRecomendada: item.requisito.acaoRecomendada,
      },
    })),
  )
  const contagem = {
    total: itens.length,
    atende: itens.filter((item) => item.status === 'atende').length,
    nao_atende: itens.filter((item) => item.status === 'nao_atende').length,
    atende_parcialmente: itens.filter((item) => item.status === 'atende_parcialmente').length,
    nao_se_aplica: itens.filter((item) => item.status === 'nao_se_aplica').length,
    precisa_validacao: itens.filter((item) => item.status === 'precisa_validacao').length,
  }
  const avaliaveis = itens.filter((item) => item.status !== 'nao_se_aplica').length

  return {
    scoreConformidade: avaliaveis ? Math.round((contagem.atende / avaliaveis) * 100) : 0,
    contagem,
    gapsCriticos: itens
      .filter((item) =>
        ['nao_atende', 'atende_parcialmente', 'precisa_validacao'].includes(item.status),
      )
      .sort((a, b) => b.requisito.peso - a.requisito.peso)
      .slice(0, 5),
    documentosPorStatus: projeto.documentos.reduce<Record<string, number>>((acc, documento) => {
      acc[documento.status] = (acc[documento.status] || 0) + 1
      return acc
    }, {}),
  }
}
