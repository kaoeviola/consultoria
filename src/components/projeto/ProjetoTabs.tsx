'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { CalendarDays, FileImage, FileText, FileType, ListChecks, Sparkles } from 'lucide-react'
import { AnamneseForm, type AnamneseData } from '@/components/projeto/AnamneseForm'
import { ChecklistRapido } from '@/components/projeto/ChecklistRapido'
import { DocumentosHub } from '@/components/projeto/DocumentosHub'
import { OnboardingGuia } from '@/components/projeto/OnboardingGuia'
import { ZonaIngestao } from '@/components/projeto/ZonaIngestao'
import { exportarPDF, exportarWord, gerarPreviewHtml, type DocumentoExport } from '@/lib/exportar'
import {
  getOnboardingSteps,
  isOnboardingComplete,
  isProjectAtStart,
  type OnboardingStepId,
} from '@/lib/projeto-onboarding'

type ArquivoAnalise = {
  tipoDetectado?: string
  analise?: {
    tipo_confirmado?: string
    validade?: string | null
    orgao_emissor?: string | null
    numero_documento?: string | null
    resumo?: string
    informacoes_relevantes?: string[]
    requisitos_atendidos?: string[]
    dados_especificos?: Record<string, unknown> | null
  }
}

type DocumentoExistente = {
  possui?: boolean
  dataUltimaRevisao?: string | null
  responsavelTecnico?: string | null
  observacoes?: string | null
  arquivoUrl?: string | null
}

type ArquivoData = {
  id: string
  nome: string
  url: string
  tipo: string
  tamanho: number | null
  metadados: ArquivoAnalise | null
  createdAt: string
}

type ModeloDisponivel = {
  id: string
  nome: string
  categoria: string | null
  versao: string
  requisitosCount: number
}

type ItemAvaliacaoData = {
  id: string
  status: string
  confiancaIA: string | null
  observacao: string | null
    requisito: {
      id: string
      codigo: string | null
      titulo: string
      descricao: string | null
      categoria?: string | null
      evidenciaEsperada: string | null
      documentoEsperado: string | null
    }
}

type AvaliacaoData = {
  id: string
  modeloId: string
  modelo: {
    id: string
    nome: string
    categoria: string | null
    versao: string
    requisitos: {
      id: string
      codigo: string | null
      titulo: string
      descricao: string | null
      categoria: string | null
      peso: number
      evidenciaEsperada: string | null
      documentoEsperado: string | null
    }[]
  }
  itens: ItemAvaliacaoData[]
}

type DocumentoData = {
  id: string
  nome: string
  tipo: string
  status: string
  conteudo: string | null
  versao: number
  requisitosOrigem: string[]
  geradoPorIA: boolean
  scoreQualidade: number | null
  aprovadoPor: string | null
  urlExportado: string | null
  createdAt: string
  metadados: {
    raciocinioIA?: string
    agente?: string
    geradoEm?: string
    autoRevisao?: {
      score?: number
      revisoes?: {
        iteracao: number
        score: number
        problemas: string[]
        melhorias: string[]
      }[]
    }
  } | null
  updatedAt: string
  exportacoes: {
    id: string
    formato: string
    versao: number
    urlArquivo: string
    hashArquivo: string | null
    exportadoPor: string | null
    createdAt: string
  }[]
  validacoesFidelidade?: {
    id?: string
    versao: number
    score: number
    divergencias: {
      severidade: 'critica' | 'alta' | 'media' | 'info'
      regra: string
      esperado: string | string[]
      encontrado: string | string[]
      mensagem: string
      localizacao?: string
    }[]
    criticas?: number
    altas?: number
    medias?: number
    infos?: number
    bloqueia: boolean
    executadoEm: string
  }[]
}

type ProjetoData = {
  id: string
  nome: string
  tipo: string
  status: string
  createdAt: string
  empresa: {
    id: string
    nome: string
    cnpj?: string | null
    cnae?: string | null
    setor?: string | null
    setorCodigo?: string | null
    cidade?: string | null
    estado?: string | null
  }
  dashboard: {
    scoreConformidade: number
    contagem: {
      total: number
      atende: number
      nao_atende: number
      atende_parcialmente: number
      nao_se_aplica: number
      precisa_validacao: number
    }
    gapsCriticos: {
      id: string
      status: string
      modelo: string
      requisito: {
        codigo: string | null
        titulo: string
        peso: number
        documentoEsperado: string | null
        acaoRecomendada: string | null
      }
    }[]
    documentosPorStatus: Record<string, number>
  }
  hasPerfilOperacional: boolean
  arquivos: ArquivoData[]
  anamnese: AnamneseData | null
  avaliacoes: AvaliacaoData[]
  documentos: DocumentoData[]
  modelosDisponiveis: ModeloDisponivel[]
}

const documentosContexto = [
  { key: 'pgr', termos: ['pgr', 'programa de gerenciamento de riscos'] },
  { key: 'pcmso', termos: ['pcmso'] },
  { key: 'licencaAmbiental', termos: ['licenca ambiental', 'licença ambiental'] },
  { key: 'avcbClcb', termos: ['avcb', 'clcb'] },
  { key: 'alvaraFuncionamento', termos: ['alvara', 'alvará'] },
  { key: 'planoEmergencia', termos: ['plano de emergencia', 'plano de emergência'] },
  {
    key: 'inventarioProdutosQuimicos',
    termos: ['inventario de produtos quimicos', 'inventário de produtos químicos', 'fispq'],
  },
  { key: 'matrizTreinamentos', termos: ['matriz de treinamentos', 'treinamento'] },
]

const tabs = [
  'Visão Geral',
  'Arquivos',
  'Anamnese',
  'Modelos de Avaliação',
  'Gap Analysis',
  'Documentos',
]

const statusOptions = [
  { value: 'atende', label: 'Atende' },
  { value: 'atende_parcialmente', label: 'Atende parcialmente' },
  { value: 'nao_atende', label: 'Não atende' },
  { value: 'nao_se_aplica', label: 'Não se aplica' },
  { value: 'precisa_validacao', label: 'Precisa validação' },
]

function normalizarTexto(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function arquivoCorresponde(arquivo: ArquivoData, termos: string[]) {
  const texto = normalizarTexto(
    [
      arquivo.nome,
      arquivo.tipo,
      arquivo.metadados?.tipoDetectado,
      arquivo.metadados?.analise?.tipo_confirmado,
    ]
      .filter(Boolean)
      .join(' '),
  )

  return termos.some((termo) => texto.includes(normalizarTexto(termo)))
}

function calcularQualidadeContexto(projeto: ProjetoData) {
  const dadosSetor = projeto.anamnese?.dadosSetor as
    | { documentosExistentes?: Record<string, DocumentoExistente> }
    | null
  const documentosExistentes = dadosSetor?.documentosExistentes || {}
  const totalPossivel = documentosContexto.length * 2
  const pontos = documentosContexto.reduce((acc, documento) => {
    const declarado = documentosExistentes[documento.key]?.possui ? 1 : 0
    const processado = projeto.arquivos.some(
      (arquivo) => arquivo.metadados && arquivoCorresponde(arquivo, documento.termos),
    )
      ? 1
      : 0

    return acc + declarado + processado
  }, 0)

  return Math.round((pontos / totalPossivel) * 100)
}

export function ProjetoTabs({ projeto }: { projeto: ProjetoData }) {
  const [activeTab, setActiveTab] = useState('Visão Geral')
  const [selectedAvaliacaoId, setSelectedAvaliacaoId] = useState<string | null>(null)
  const qualidadeContexto = calcularQualidadeContexto(projeto)
  const onboardingSteps = getOnboardingSteps(projeto)

  function openGap(avaliacaoId: string) {
    setSelectedAvaliacaoId(avaliacaoId)
    setActiveTab('Gap Analysis')
  }

  function goToStep(step: OnboardingStepId) {
    const tabByStep: Record<OnboardingStepId, string> = {
      anamnese: 'Anamnese',
      arquivos: 'Arquivos',
      modelos: 'Modelos de Avaliação',
      gap: 'Gap Analysis',
      diagnostico: 'Visão Geral',
    }

    setActiveTab(tabByStep[step])
  }

  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              Qualidade do contexto: {qualidadeContexto}%
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Baseado nos documentos chave declarados e nos arquivos já analisados por IA.
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:w-56">
            <div
              className={`h-full rounded-full ${
                qualidadeContexto >= 70
                  ? 'bg-emerald-600'
                  : qualidadeContexto >= 40
                    ? 'bg-amber-500'
                    : 'bg-red-600'
              }`}
              style={{ width: `${qualidadeContexto}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
              activeTab === tab
                ? 'border-slate-950 text-slate-950'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-6">
          <ChecklistRapido steps={onboardingSteps} />
        </div>
        {activeTab === 'Visão Geral' ? (
          <VisaoGeral projeto={projeto} onboardingSteps={onboardingSteps} onStepAction={goToStep} />
        ) : null}
        {activeTab === 'Arquivos' ? (
          <ArquivosTab projetoId={projeto.id} arquivos={projeto.arquivos} />
        ) : null}
        {activeTab === 'Anamnese' ? (
          <AnamneseForm projetoId={projeto.id} anamnese={projeto.anamnese} />
        ) : null}
        {activeTab === 'Modelos de Avaliação' ? (
          <ModelosProjetoTab projeto={projeto} onAvaliar={openGap} />
        ) : null}
        {activeTab === 'Gap Analysis' ? (
          <GapAnalysisTab
            avaliacoes={projeto.avaliacoes}
            hasPerfilOperacional={projeto.hasPerfilOperacional}
            selectedAvaliacaoId={selectedAvaliacaoId}
            onSelectAvaliacao={setSelectedAvaliacaoId}
          />
        ) : null}
        {activeTab === 'Documentos' ? (
          <DocumentosHub projeto={projeto} />
        ) : null}
      </div>
    </div>
  )
}

function VisaoGeral({
  projeto,
  onboardingSteps,
  onStepAction,
}: {
  projeto: ProjetoData
  onboardingSteps: ReturnType<typeof getOnboardingSteps>
  onStepAction: (step: OnboardingStepId) => void
}) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)
  const [message, setMessage] = useState('')
  const score = projeto.dashboard.scoreConformidade
  const scoreTone =
    score >= 75
      ? 'border-emerald-500 text-emerald-700'
      : score >= 45
        ? 'border-amber-500 text-amber-700'
        : 'border-red-500 text-red-700'

  async function gerarDiagnostico() {
    setMessage('')
    setIsGenerating(true)

    const response = await fetch('/api/agentes/diagnostico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projetoId: projeto.id }),
    })

    setIsGenerating(false)

    if (!response.ok) {
      setMessage('Não foi possível gerar o diagnóstico inicial.')
      return
    }

    setMessage('Diagnóstico inicial gerado em Documentos.')
    router.refresh()
  }

  async function planejarDocumentos() {
    setMessage('')
    setIsPlanning(true)

    const response = await fetch('/api/agentes/planejar-documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projetoId: projeto.id }),
    })

    setIsPlanning(false)

    if (!response.ok) {
      setMessage('Não foi possível planejar documentos.')
      return
    }

    const data = (await response.json()) as { documentosCriados?: unknown[] }
    setMessage(`Planejamento concluído. ${data.documentosCriados?.length || 0} documentos criados.`)
    router.refresh()
  }

  return (
    <section className="grid gap-6">
      {isProjectAtStart(projeto) && !isOnboardingComplete(projeto) ? (
        <OnboardingGuia steps={onboardingSteps} onAction={onStepAction} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div
            className={`mx-auto flex h-40 w-40 items-center justify-center rounded-full border-[10px] ${scoreTone}`}
          >
            <span className="text-4xl font-semibold">{score}%</span>
          </div>
          <h2 className="mt-5 text-lg font-semibold text-slate-950">
            Score de conformidade
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Percentual dos requisitos avaliáveis que atendem plenamente.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Info label="Total requisitos" value={String(projeto.dashboard.contagem.total)} />
          <Info label="Atendem" value={String(projeto.dashboard.contagem.atende)} />
          <Info label="Não atendem" value={String(projeto.dashboard.contagem.nao_atende)} />
          <Info label="Parciais" value={String(projeto.dashboard.contagem.atende_parcialmente)} />
          <Info label="Não avaliados" value={String(projeto.dashboard.contagem.precisa_validacao)} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Ações executivas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Gere o relatório de diagnóstico e crie uma lista inteligente de documentos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={gerarDiagnostico}
              disabled={isGenerating}
              title="Gera relatório técnico completo baseado em todos os dados do projeto"
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? 'Gerando...' : 'Gerar Diagnóstico Inicial'}
            </button>
            <button
              type="button"
              onClick={planejarDocumentos}
              disabled={isPlanning}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <ListChecks className="h-4 w-4" />
              {isPlanning ? 'Planejando...' : 'Planejar Documentos'}
            </button>
            <Link
              href={`/empresas/${projeto.empresa.id}/projetos/${projeto.id}/entrega`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Ver Entrega Final
            </Link>
          </div>
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">5 gaps mais críticos</h2>
          <div className="mt-4 space-y-3">
            {projeto.dashboard.gapsCriticos.length > 0 ? (
              projeto.dashboard.gapsCriticos.map((gap) => (
                <article key={gap.id} className="rounded-md bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={gap.status === 'nao_atende' ? 'red' : 'amber'}>
                      {gap.status}
                    </Badge>
                    <span className="text-xs text-slate-500">{gap.modelo}</span>
                    <span className="text-xs text-slate-500">Peso {gap.requisito.peso}</span>
                  </div>
                  <h3 className="mt-2 font-medium text-slate-950">
                    {gap.requisito.codigo ? `${gap.requisito.codigo} · ` : ''}
                    {gap.requisito.titulo}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {gap.requisito.acaoRecomendada || 'Priorizar análise e plano de ação.'}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                Nenhum gap crítico identificado.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
            <CalendarDays className="h-5 w-5" />
            Timeline
          </h2>
          <div className="mt-4 space-y-4 text-sm">
            <SmallInfo
              label="Criado em"
              value={new Date(projeto.createdAt).toLocaleDateString('pt-BR')}
            />
            <SmallInfo label="Status" value={projeto.status} />
            <SmallInfo
              label="Empresa"
              value={`${projeto.empresa.nome} · ${projeto.empresa.setor || 'setor não informado'}`}
            />
            <SmallInfo
              label="Documentos"
              value={Object.entries(projeto.dashboard.documentosPorStatus)
                .map(([status, total]) => `${status}: ${total}`)
                .join(' · ') || 'Nenhum documento'}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function ModelosProjetoTab({
  projeto,
  onAvaliar,
}: {
  projeto: ProjetoData
  onAvaliar: (avaliacaoId: string) => void
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedModelos, setSelectedModelos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const linkedModelIds = new Set(projeto.avaliacoes.map((avaliacao) => avaliacao.modeloId))
  const modelosNaoVinculados = projeto.modelosDisponiveis.filter(
    (modelo) => !linkedModelIds.has(modelo.id),
  )

  async function vincularModelos() {
    setError('')
    setIsSubmitting(true)

    const response = await fetch('/api/avaliacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projetoId: projeto.id,
        modeloIds: selectedModelos,
      }),
    })

    setIsSubmitting(false)

    if (!response.ok) {
      setError('Não foi possível vincular os modelos.')
      return
    }

    setSelectedModelos([])
    setIsOpen(false)
    router.refresh()
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Modelos vinculados
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Escolha modelos para gerar avaliações e itens de gap analysis.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Vincular Modelo
        </button>
      </div>

      {projeto.avaliacoes.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {projeto.avaliacoes.map((avaliacao) => {
            const total = avaliacao.itens.length
            const avaliados = avaliacao.itens.filter(
              (item) => item.status !== 'precisa_validacao',
            ).length

            return (
              <div
                key={avaliacao.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      {avaliacao.modelo.nome}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {avaliacao.modelo.categoria || 'Sem categoria'} · v
                      {avaliacao.modelo.versao}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {total} requisitos
                  </span>
                </div>
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-sm text-slate-600">
                    <span>Progresso</span>
                    <span>
                      {avaliados} de {total}
                    </span>
                  </div>
                  <Progress value={total ? (avaliados / total) * 100 : 0} />
                </div>
                <button
                  type="button"
                  onClick={() => onAvaliar(avaliacao.id)}
                  className="mt-5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Avaliar
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Nenhum modelo vinculado a este projeto.
        </div>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">
                  Vincular Modelo
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Selecione um ou mais modelos disponíveis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto">
              {modelosNaoVinculados.length > 0 ? (
                modelosNaoVinculados.map((modelo) => (
                  <label
                    key={modelo.id}
                    className="flex items-start gap-3 rounded-md border border-slate-200 p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedModelos.includes(modelo.id)}
                      onChange={(event) => {
                        setSelectedModelos((current) =>
                          event.target.checked
                            ? [...current, modelo.id]
                            : current.filter((id) => id !== modelo.id),
                        )
                      }}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-950">
                        {modelo.nome}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {modelo.categoria || 'Sem categoria'} · {modelo.requisitosCount}{' '}
                        requisitos
                      </span>
                    </span>
                  </label>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
                  Todos os modelos disponíveis já estão vinculados.
                </div>
              )}
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting || selectedModelos.length === 0}
                onClick={vincularModelos}
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Vinculando...' : 'Vincular selecionados'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function GapAnalysisTab({
  avaliacoes,
  hasPerfilOperacional,
  selectedAvaliacaoId,
  onSelectAvaliacao,
}: {
  avaliacoes: AvaliacaoData[]
  hasPerfilOperacional: boolean
  selectedAvaliacaoId: string | null
  onSelectAvaliacao: (id: string | null) => void
}) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const avaliacoesFiltradas = selectedAvaliacaoId
    ? avaliacoes.filter((avaliacao) => avaliacao.id === selectedAvaliacaoId)
    : avaliacoes
  const itens = avaliacoesFiltradas.flatMap((avaliacao) =>
    avaliacao.itens.map((item) => ({ ...item, avaliacao })),
  )
  const resumo = useMemo(() => {
    const total = itens.length
    const avaliados = itens.filter((item) => item.status !== 'precisa_validacao').length

    return {
      total,
      avaliados,
      atende: itens.filter((item) => item.status === 'atende').length,
      parcial: itens.filter((item) => item.status === 'atende_parcialmente').length,
      naoAtende: itens.filter((item) => item.status === 'nao_atende').length,
      progresso: total ? (avaliados / total) * 100 : 0,
    }
  }, [itens])
  const hasAiSuggestions = itens.some((item) =>
    ['alta', 'media', 'baixa'].includes(item.confiancaIA || ''),
  )

  async function suggestWithAi() {
    const target = selectedAvaliacaoId || avaliacoes[0]?.id

    if (!target) {
      return
    }

    setIsGenerating(true)
    setMessage('')

    const response = await fetch('/api/agentes/gap-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avaliacaoId: target }),
    })

    setIsGenerating(false)

    if (!response.ok) {
      setMessage('Não foi possível gerar sugestões com IA.')
      return
    }

    setMessage('Sugestões geradas. Confirme cada item antes de usar.')
    router.refresh()
  }

  async function confirmAll() {
    setIsConfirming(true)
    setMessage('')

    const response = await fetch('/api/itens-avaliacao', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmarTodos: true,
        avaliacaoIds: avaliacoesFiltradas.map((avaliacao) => avaliacao.id),
      }),
    })

    setIsConfirming(false)

    if (!response.ok) {
      setMessage('Não foi possível confirmar os itens.')
      return
    }

    setMessage('Itens confirmados como revisão humana.')
    router.refresh()
  }

  if (avaliacoes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
        Vincule um modelo de avaliação para iniciar o Gap Analysis.
      </div>
    )
  }

  return (
    <section>
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Gap Analysis</h2>
            <p className="mt-1 text-sm text-slate-600">
              Avalie os requisitos dos modelos vinculados e gere pendências documentais.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedAvaliacaoId ?? ''}
              onChange={(event) => onSelectAvaliacao(event.target.value || null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Todos os modelos</option>
              {avaliacoes.map((avaliacao) => (
                <option key={avaliacao.id} value={avaliacao.id}>
                  {avaliacao.modelo.nome}
                </option>
              ))}
            </select>
            {hasPerfilOperacional ? (
              <button
                type="button"
                onClick={suggestWithAi}
                disabled={isGenerating}
                title="A IA avalia cada requisito com base no perfil operacional e nos documentos disponíveis"
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Sugerindo...' : 'Sugerir com IA'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={confirmAll}
              disabled={isConfirming || itens.length === 0}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConfirming ? 'Confirmando...' : 'Confirmar todos'}
            </button>
          </div>
        </div>

        {isGenerating ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
            Gerando sugestões com IA...
          </div>
        ) : null}

        {hasAiSuggestions ? (
          <span className="mt-4 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Sugerido por IA — confirme cada item
          </span>
        ) : null}

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-5">
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>Progresso geral</span>
            <span>
              {resumo.avaliados} de {resumo.total} requisitos avaliados
            </span>
          </div>
          <Progress value={resumo.progresso} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Info label="Atendem" value={String(resumo.atende)} />
          <Info label="Parciais" value={String(resumo.parcial)} />
          <Info label="Não atendem" value={String(resumo.naoAtende)} />
        </div>
      </div>

      <div className="grid gap-4">
        {itens.map((item) => (
          <GapItemCard key={item.id} item={item} modeloNome={item.avaliacao.modelo.nome} />
        ))}
      </div>
    </section>
  )
}

function GapItemCard({
  item,
  modeloNome,
}: {
  item: ItemAvaliacaoData
  modeloNome: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(item.status)
  const [observacao, setObservacao] = useState(item.observacao || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function saveItem() {
    setIsSaving(true)
    setMessage('')

    const response = await fetch('/api/itens-avaliacao', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        status,
        observacao,
      }),
    })

    setIsSaving(false)

    if (!response.ok) {
      setMessage('Erro ao salvar.')
      return
    }

    setMessage('Salvo.')
    router.refresh()
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {modeloNome}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            {item.requisito.codigo ? `${item.requisito.codigo} · ` : ''}
            {item.requisito.titulo}
          </h3>
          {item.requisito.descricao ? (
            <p className="mt-2 text-sm text-slate-600">{item.requisito.descricao}</p>
          ) : null}
        </div>
        <ConfidenceBadge value={item.confiancaIA} />
      </div>

      {item.observacao?.startsWith('[IA]') ? (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Justificativa da IA: {item.observacao.replace('[IA]', '').trim()}
        </div>
      ) : null}

      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <SmallInfo
          label="Evidência esperada"
          value={item.requisito.evidenciaEsperada || 'Não informada'}
        />
        <SmallInfo
          label="Documento esperado"
          value={item.requisito.documentoEsperado || 'Não informado'}
        />
      </dl>

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr_auto] lg:items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`status-${item.id}`}>
            Status
          </label>
          <select
            id={`status-${item.id}`}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor={`observacao-${item.id}`}
          >
            Observação
          </label>
          <textarea
            id={`observacao-${item.id}`}
            rows={2}
            value={observacao}
            onChange={(event) => setObservacao(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={saveItem}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
          {message ? <span className="text-sm text-slate-500">{message}</span> : null}
        </div>
      </div>
    </article>
  )
}

function DocumentosTab({
  documentos,
  empresa,
}: {
  documentos: DocumentoData[]
  empresa: { nome: string }
}) {
  const grupos = [
    { title: 'Pendentes', statuses: ['pendente'] },
    { title: 'Em revisão', statuses: ['em_revisao', 'rascunho'] },
    { title: 'Aprovados', statuses: ['aprovado', 'exportado', 'entregue'] },
  ]

  return (
    <section className="grid gap-6">
      {grupos.map((grupo) => {
        const itens = documentos.filter((documento) =>
          grupo.statuses.includes(documento.status),
        )

        return (
          <div key={grupo.title}>
            <h2 className="mb-3 text-xl font-semibold text-slate-950">{grupo.title}</h2>
            {itens.length > 0 ? (
              <div className="grid gap-3">
                {itens.map((documento) => (
                  <DocumentoCard
                    key={documento.id}
                    documento={documento}
                    empresa={empresa}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                Nenhum documento nesta etapa.
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

type ResultadoRevisao = {
  aprovado: boolean
  score: number
  problemas: string[]
  sugestoes: string[]
  alertas_legais: string[]
}

function DocumentoCard({
  documento,
  empresa,
}: {
  documento: DocumentoData
  empresa: { nome: string }
}) {
  const router = useRouter()
  const [isApproving, setIsApproving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [forceApproval, setForceApproval] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [review, setReview] = useState<ResultadoRevisao | null>(null)
  const [error, setError] = useState('')
  const canApprove =
    documento.status !== 'aprovado' &&
    (documento.status !== 'em_revisao' || !review || review.score >= 70 || forceApproval)

  async function generate() {
    setError('')
    setIsGenerating(true)

    const response = await fetch('/api/agentes/gerar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docProjetoId: documento.id,
      }),
    })

    setIsGenerating(false)

    if (!response.ok) {
      setError('Não foi possível gerar o documento.')
      return
    }

    router.refresh()
  }

  async function approve() {
    setError('')
    setIsApproving(true)

    const response = await fetch(`/api/documentos/${documento.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'aprovado',
      }),
    })

    setIsApproving(false)

    if (response.ok) {
      router.refresh()
      return
    }

    setError('Não foi possível aprovar o documento.')
  }

  async function reviewDocument() {
    setError('')
    setIsReviewing(true)

    const response = await fetch('/api/agentes/revisar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docProjetoId: documento.id,
      }),
    })

    setIsReviewing(false)

    if (!response.ok) {
      setError('Não foi possível revisar o documento.')
      return
    }

    setReview((await response.json()) as ResultadoRevisao)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">{documento.nome}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={documento.tipo === 'geravel_ia' ? 'blue' : 'amber'}>
              {documento.tipo}
            </Badge>
            <Badge tone={statusTone(documento.status)}>
              {statusLabel(documento.status)}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isGenerating}
            onClick={generate}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
                Gerando...
              </span>
            ) : documento.conteudo ? (
              'Regenerar'
            ) : (
              'Gerar com IA'
            )}
          </button>
          {documento.status === 'em_revisao' && documento.conteudo ? (
            <button
              type="button"
              disabled={isReviewing}
              onClick={reviewDocument}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isReviewing ? 'Revisando...' : 'Revisar com IA'}
            </button>
          ) : null}
          {documento.metadados?.raciocinioIA ? (
            <button
              type="button"
              onClick={() => setShowReasoning((value) => !value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {showReasoning ? 'Ocultar raciocínio' : 'Ver raciocínio da IA'}
            </button>
          ) : null}
          {documento.status === 'aprovado' && documento.conteudo ? (
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Visualizar antes de exportar
            </button>
          ) : null}
          {canApprove ? (
            <button
              type="button"
              disabled={isApproving}
              onClick={approve}
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApproving ? 'Salvando...' : 'Aprovar documento'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {review ? (
        <ReviewPanel
          review={review}
          forceApproval={forceApproval}
          onForceApprovalChange={setForceApproval}
        />
      ) : null}

      {showReasoning && documento.metadados?.raciocinioIA ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-950">Raciocínio técnico da IA</h4>
            {documento.metadados.agente ? (
              <Badge tone="amber">{documento.metadados.agente}</Badge>
            ) : null}
            {documento.metadados.autoRevisao?.score !== undefined ? (
              <Badge tone={documento.metadados.autoRevisao.score >= 75 ? 'green' : 'red'}>
                Auto-revisão {documento.metadados.autoRevisao.score}/100
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
            {documento.metadados.raciocinioIA}
          </p>
          {documento.metadados.autoRevisao?.revisoes?.length ? (
            <div className="mt-4 border-t border-amber-200 pt-4">
              <h5 className="text-sm font-semibold text-slate-950">Loop de auto-revisão</h5>
              <div className="mt-2 space-y-3">
                {documento.metadados.autoRevisao.revisoes.map((revisao) => (
                  <div key={revisao.iteracao} className="rounded-md bg-white p-3">
                    <p className="text-sm font-medium text-slate-950">
                      Iteração {revisao.iteracao} · score {revisao.score}/100
                    </p>
                    {revisao.problemas.length ? (
                      <p className="mt-1 text-xs text-red-700">
                        Problemas: {revisao.problemas.join('; ')}
                      </p>
                    ) : null}
                    {revisao.melhorias.length ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Melhorias: {revisao.melhorias.join('; ')}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {documento.conteudo ? (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="prose prose-sm max-w-none prose-slate">
            <ReactMarkdown>{documento.conteudo}</ReactMarkdown>
          </div>
        </div>
      ) : null}

      {isPreviewOpen && documento.conteudo ? (
        <DocumentoPreviewModal
          documento={toDocumentoExport(documento)}
          empresa={empresa}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </div>
  )
}

function toDocumentoExport(documento: DocumentoData): DocumentoExport {
  return {
    id: documento.id,
    nome: documento.nome,
    tipo: documento.tipo,
    status: documento.status,
    versao: documento.versao,
    conteudo: documento.conteudo || '',
  }
}

function DocumentoPreviewModal({
  documento,
  empresa,
  onClose,
}: {
  documento: DocumentoExport
  empresa: { nome: string }
  onClose: () => void
}) {
  const [html, setHtml] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    gerarPreviewHtml(documento, empresa).then((preview) => {
      if (active) {
        setHtml(preview)
        setIsLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [documento, empresa])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="flex h-full w-full max-w-6xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Visualização de exportação</h3>
            <p className="text-sm text-slate-600">{documento.nome}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportarPDF(documento, empresa)}
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => exportarWord(documento, empresa)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Exportar Word
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-600">Gerando preview...</div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewPanel({
  review,
  forceApproval,
  onForceApprovalChange,
}: {
  review: ResultadoRevisao
  forceApproval: boolean
  onForceApprovalChange: (value: boolean) => void
}) {
  const scoreTone =
    review.score >= 70
      ? 'bg-emerald-500'
      : review.score >= 50
        ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-semibold text-slate-950">Revisão técnica por IA</h4>
          <p className="mt-1 text-sm text-slate-600">Score: {review.score}/100</p>
        </div>
        <Badge tone={review.aprovado ? 'green' : 'amber'}>
          {review.aprovado ? 'Aprovável' : 'Revisar'}
        </Badge>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${scoreTone}`}
          style={{ width: `${Math.min(100, Math.max(0, review.score))}%` }}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ReviewList title="Problemas" tone="red" items={review.problemas} />
        <ReviewList title="Sugestões" tone="amber" items={review.sugestoes} />
        <ReviewList title="Alertas legais" tone="orange" items={review.alertas_legais} />
      </div>

      {review.score < 70 ? (
        <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={forceApproval}
            onChange={(event) => onForceApprovalChange(event.target.checked)}
          />
          Forçar aprovação manual mesmo com score abaixo de 70
        </label>
      ) : null}
    </div>
  )
}

function ReviewList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'red' | 'amber' | 'orange'
}) {
  const toneClass = {
    red: 'text-red-700',
    amber: 'text-amber-700',
    orange: 'text-orange-700',
  }[tone]

  return (
    <div>
      <h5 className={`text-sm font-semibold ${toneClass}`}>{title}</h5>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Nenhum item apontado.</p>
      )}
    </div>
  )
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    em_revisao: 'Em revisão',
    aprovado: 'Aprovado',
    exportado: 'Exportado',
    entregue: 'Entregue',
  }

  return labels[status] || status
}

function statusTone(status: string): 'amber' | 'green' | 'slate' {
  if (status === 'em_revisao') {
    return 'amber'
  }

  if (status === 'aprovado') {
    return 'green'
  }

  return 'slate'
}

function ArquivosTab({
  projetoId,
  arquivos,
}: {
  projetoId: string
  arquivos: ArquivoData[]
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isIngestaoOpen, setIsIngestaoOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const payload = {
      ...Object.fromEntries(formData.entries()),
      projetoId,
    }

    const response = await fetch('/api/arquivos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setIsSubmitting(false)

    if (!response.ok) {
      setError('Não foi possível salvar o arquivo.')
      return
    }

    setIsOpen(false)
    router.refresh()
  }

  async function processArquivo(arquivoId: string) {
    setError('')
    setProcessingId(arquivoId)

    const response = await fetch('/api/arquivos/processar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivoId }),
    })

    setProcessingId(null)

    if (!response.ok) {
      setError('Não foi possível analisar o arquivo com IA.')
      return
    }

    router.refresh()
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Arquivos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Registre evidências e documentos vinculados ao projeto.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsIngestaoOpen(true)}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Importar documentos
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Upload
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {arquivos.length > 0 ? (
        <div className="grid gap-4">
          {arquivos.map((arquivo) => (
            <ArquivoCard
              key={arquivo.id}
              arquivo={arquivo}
              isProcessing={processingId === arquivo.id}
              onProcess={() => processArquivo(arquivo.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Nenhum arquivo registrado para este projeto.
        </div>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">
                  Registrar arquivo
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Informe os metadados do arquivo já enviado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field id="nome" label="Nome" required />
              <Field id="url" label="URL" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="tipo" label="Tipo" required />
                <Field id="tamanho" label="Tamanho em bytes" type="number" />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar arquivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isIngestaoOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="w-full max-w-5xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">
                  Importar documentos
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Envie todos os documentos disponíveis para análise automática e atualização do contexto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsIngestaoOpen(false)}
                className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Fechar
              </button>
            </div>
            <ZonaIngestao
              projetoId={projetoId}
              onClose={() => setIsIngestaoOpen(false)}
              onApplied={() => {
                setIsIngestaoOpen(false)
                router.refresh()
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ArquivoCard({
  arquivo,
  isProcessing,
  onProcess,
}: {
  arquivo: ArquivoData
  isProcessing: boolean
  onProcess: () => void
}) {
  const analise = arquivo.metadados?.analise
  const tipoDetectado = analise?.tipo_confirmado || arquivo.metadados?.tipoDetectado
  const validity = getValidityStatus(analise?.validade || null)

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            {renderFileIcon(arquivo)}
          </div>
          <div>
            <a
              href={arquivo.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-slate-950 hover:underline"
            >
              {arquivo.nome}
            </a>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="slate">{arquivo.tipo}</Badge>
              {tipoDetectado ? <Badge tone="blue">{tipoDetectado}</Badge> : null}
              {validity ? <Badge tone={validity.tone}>{validity.label}</Badge> : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Enviado em {new Date(arquivo.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onProcess}
          disabled={isProcessing}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProcessing ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
              Analisando...
            </span>
          ) : analise ? (
            'Reanalisar com IA'
          ) : (
            'Analisar com IA'
          )}
        </button>
      </div>

      {analise ? (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SmallInfo label="Validade" value={analise.validade || 'Não identificada'} />
            <SmallInfo label="Órgão emissor" value={analise.orgao_emissor || 'Não identificado'} />
            <SmallInfo label="Número" value={analise.numero_documento || 'Não identificado'} />
          </div>
          {analise.resumo ? (
            <p className="mt-4 text-sm text-slate-700">{analise.resumo}</p>
          ) : null}
          {analise.requisitos_atendidos?.length ? (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Requisitos que comprova
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {analise.requisitos_atendidos.map((requisito) => (
                  <Badge key={requisito} tone="green">
                    {requisito}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {analise.dados_especificos || analise.informacoes_relevantes?.length ? (
            <details className="mt-4 rounded-md border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-950">
                Contexto extraído
              </summary>
              {analise.informacoes_relevantes?.length ? (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Informações relevantes
                  </h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {analise.informacoes_relevantes.map((info) => (
                      <li key={info}>{info}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analise.dados_especificos ? (
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  {Object.entries(analise.dados_especificos).map(([key, value]) => (
                    <div key={key} className="rounded-md bg-slate-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {key.replaceAll('_', ' ')}
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {formatExtractedValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function formatExtractedValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : 'Não identificado'
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value ? String(value) : 'Não identificado'
}

function renderFileIcon(arquivo: ArquivoData) {
  const value = `${arquivo.nome} ${arquivo.tipo}`.toLowerCase()

  if (value.includes('pdf')) {
    return <FileText className="h-5 w-5" />
  }

  if (value.includes('doc') || value.includes('word')) {
    return <FileType className="h-5 w-5" />
  }

  if (value.includes('png') || value.includes('jpg') || value.includes('jpeg') || value.includes('imagem')) {
    return <FileImage className="h-5 w-5" />
  }

  return <FileText className="h-5 w-5" />
}

function getValidityStatus(validade: string | null): { label: string; tone: 'amber' | 'red' } | null {
  if (!validade) {
    return null
  }

  const date = new Date(validade)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const now = new Date()
  const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (days < 0) {
    return { label: 'Vencido', tone: 'red' }
  }

  if (days <= 30) {
    return { label: 'Vence em breve', tone: 'amber' }
  }

  return null
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-slate-950 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function ConfidenceBadge({ value }: { value: string | null }) {
  if (value === 'alta') {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Alta
      </span>
    )
  }

  if (value === 'media') {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        Média
      </span>
    )
  }

  if (value === 'baixa') {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Baixa
      </span>
    )
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      humano
    </span>
  )
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'blue' | 'amber' | 'green' | 'slate' | 'red'
}) {
  const classes = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-red-50 text-red-700',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>
      {children}
    </span>
  )
}

function Field({
  id,
  label,
  type = 'text',
  required = false,
}: {
  id: string
  label: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-slate-950">{value}</dd>
    </div>
  )
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-slate-700">{value}</dd>
    </div>
  )
}
