'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { detectarCodigoDocumento } from '@/lib/documentos/codigo'
import { exportarPDF, exportarWord, type DocumentoExport } from '@/lib/exportar'
import { PreviewDocumento } from '@/components/projeto/PreviewDocumento'
import {
  CATEGORIAS_DOCUMENTO,
  getDocumentoInfo,
  getDocumentosRecomendadosPorSetor,
  type CategoriaAutonomia,
  type GrupoDocumento,
} from '@/lib/ontologia/documentos'

type DocumentoHub = {
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
  updatedAt: string
  metadados: unknown | null
  exportacoes: {
    id: string
    formato: string
    versao: number
    urlArquivo: string
    hashArquivo: string | null
    exportadoPor: string | null
    createdAt: string
  }[]
  versoes?: {
    id: string
    versao: number
    createdAt: string
  }[]
  validacoesFidelidade?: ValidacaoFidelidade[]
}

type ProjetoHub = {
  id: string
  empresa: { nome: string; setor?: string | null; setorCodigo?: string | null }
  documentos: DocumentoHub[]
  avaliacoes: {
    modelo: { nome: string }
    itens: {
      id: string
      status: string
      requisito: {
        id: string
        codigo: string | null
        titulo: string
        documentoEsperado: string | null
      }
    }[]
  }[]
}

type Recomendacao = {
  nome: string
  tipo: string
  origem: string
  requisitosOrigem: string[]
  categoriaAutonomia: CategoriaAutonomia
  grupo: GrupoDocumento
  motivoParceria?: string
}

type Revisao = {
  aprovado: boolean
  score: number
  problemas: string[]
  sugestoes: string[]
  alertas_legais: string[]
}

type DivergenciaFidelidade = {
  severidade: 'critica' | 'alta' | 'media' | 'info'
  regra: string
  esperado: string | string[]
  encontrado: string | string[]
  mensagem: string
  localizacao?: string
}

type ValidacaoFidelidade = {
  id?: string
  versao: number
  score: number
  divergencias: DivergenciaFidelidade[]
  criticas?: number
  altas?: number
  medias?: number
  infos?: number
  contagem?: { criticas: number; altas: number; medias: number; infos: number }
  bloqueia: boolean
  executadoEm: string
}

export function DocumentosHub({ projeto }: { projeto: ProjetoHub }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<DocumentoHub | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentoHub | null>(null)
  const [reviews, setReviews] = useState<Record<string, Revisao>>({})
  const [fidelidade, setFidelidade] = useState<Record<string, ValidacaoFidelidade>>({})
  const recomendacoes = useMemo(() => buildRecomendacoes(projeto), [projeto])
  const recomendacoesAutonomas = recomendacoes.filter(
    (item) => item.categoriaAutonomia === CATEGORIAS_DOCUMENTO.CONSULTORIA_AUTONOMA,
  )
  const recomendacoesParceria = recomendacoes.filter(
    (item) => item.categoriaAutonomia === CATEGORIAS_DOCUMENTO.REQUER_PARCERIA_TECNICA,
  )
  const recomendacoesCliente = recomendacoes.filter(
    (item) => item.categoriaAutonomia === CATEGORIAS_DOCUMENTO.EXIGIVEL_CLIENTE,
  )
  const gerados = projeto.documentos.filter((documento) => documento.geradoPorIA).length
  const aprovados = projeto.documentos.filter((documento) => documento.status === 'aprovado').length
  const geraveisPendentes = projeto.documentos.filter(
    (documento) => documento.status === 'pendente' && documento.tipo !== 'exigivel_cliente',
  )

  async function planejar() {
    setBusyId('planejar')
    setMessage('')
    const response = await fetch('/api/agentes/planejar-documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projetoId: projeto.id }),
    })
    setBusyId(null)
    setMessage(response.ok ? 'Planejamento concluído.' : 'Não foi possível planejar documentos.')
    router.refresh()
  }

  async function createAndGenerate(recomendacao: Recomendacao) {
    setBusyId(recomendacao.nome)
    setMessage('Gerando documento com IA... isso pode levar 30-60 segundos.')
    const response = await fetch('/api/agentes/gerar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projetoId: projeto.id,
        nomeDocumento: recomendacao.nome,
        tipoDocumento: recomendacao.tipo,
        requisitosOrigem: recomendacao.requisitosOrigem || [],
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setMessage('')
      setBusyId(null)
      return
    }

    setMessage('Documento gerado com sucesso.')
    setBusyId(null)
    router.refresh()
  }

  async function createWaitingDocument(recomendacao: Recomendacao, label: string) {
    setBusyId(recomendacao.nome)
    setMessage('')
    const response = await fetch('/api/documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projetoId: projeto.id,
        nome: recomendacao.nome,
        tipo: recomendacao.tipo,
        status: 'aguardando_cliente',
        requisitosOrigem: recomendacao.requisitosOrigem || [],
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setBusyId(null)
      return
    }
    setMessage(label)
    setBusyId(null)
    router.refresh()
  }

  async function generate(documentoId: string, refresh = true) {
    setBusyId(documentoId)
    setMessage('Gerando documento com IA... isso pode levar 30-60 segundos.')
    const response = await fetch('/api/agentes/gerar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docProjetoId: documentoId }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setMessage('')
      setBusyId(null)
      return
    }
    setMessage('Documento gerado com sucesso.')
    setBusyId(null)
    if (refresh) router.refresh()
  }

  async function regenerate(documentoId: string) {
    if (!window.confirm('Deseja regenerar este documento? O conteudo atual sera salvo no historico de versoes.')) {
      return
    }

    await generate(documentoId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setBusyId(`delete-${deleteTarget.id}`)
    const response = await fetch(`/api/documentos/${deleteTarget.id}`, {
      method: 'DELETE',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setBusyId(null)
      return
    }

    setDeleteTarget(null)
    setBusyId(null)
    router.refresh()
  }

  async function generateAll() {
    setBusyId('gerar-todos')
    setMessage('Gerando documentos com IA em lote... isso pode levar alguns minutos.')
    for (const documento of geraveisPendentes) {
      await generate(documento.id, false)
    }
    setMessage('GeraÃ§Ã£o em lote concluÃ­da.')
    setBusyId(null)
    router.refresh()
  }

  async function updateStatus(documentoId: string, status: string) {
    setBusyId(documentoId)
    await fetch(`/api/documentos/${documentoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusyId(null)
    router.refresh()
  }

  async function review(documentoId: string) {
    setBusyId(`review-${documentoId}`)
    const response = await fetch('/api/agentes/revisar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docProjetoId: documentoId }),
    })
    if (response.ok) {
      const data = (await response.json()) as Revisao
      console.log('typeof audit?.score:', typeof data?.score, data?.score)
      const revisaoNormalizada = {
        ...data,
        score: Number(data?.score ?? 0),
      }
      setReviews((current) => ({ ...current, [documentoId]: revisaoNormalizada }))
    }
    setBusyId(null)
  }

  async function validarFidelidadeDocumento(documentoId: string) {
    setBusyId(`fidelidade-${documentoId}`)
    setMessage('Validando fidelidade factual contra anamnese e perfil operacional...')
    const response = await fetch('/api/agentes/validar-fidelidade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docProjetoId: documentoId }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setMessage('')
      setBusyId(null)
      return
    }

    setFidelidade((current) => ({ ...current, [documentoId]: data as ValidacaoFidelidade }))
    setMessage('Validação de fidelidade concluída.')
    setBusyId(null)
    router.refresh()
  }

  async function approveDocument(documento: DocumentoHub, force = false) {
    const validacao = latestFidelidade(documento, fidelidade)
    const bloqueia = Boolean(validacao?.bloqueia)
    let justificativa: string | null = null

    if (bloqueia && !force) {
      alert('Resolva divergências críticas antes de aprovar.')
      return
    }

    if (force) {
      justificativa = window.prompt('Justifique a aprovação manual apesar das divergências críticas:')
      if (!justificativa?.trim()) return
    }

    setBusyId(`aprovar-${documento.id}`)
    const response = await fetch(`/api/documentos/${documento.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'aprovado',
        ...(justificativa ? { aprovadoOverrideJustificativa: justificativa } : {}),
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setBusyId(null)
      return
    }

    setBusyId(null)
    router.refresh()
  }

  async function regenerateFixing(documentoId: string, problemas: unknown[]) {
    const audit = reviews[documentoId]
    console.log('typeof audit?.score antes do submit:', typeof audit?.score, audit?.score)
    const body = {
      docProjetoId: documentoId,
      problemas,
      score: Number(audit?.score ?? 0),
    }

    setBusyId(`regen-${documentoId}`)
    setMessage('Regenerando documento corrigindo problemas de auditoria...')
    const response = await fetch('/api/agentes/regenerar-corrigindo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Erro completo:', data)
      alert(`Erro: ${data?.error || data?.message || JSON.stringify(data).substring(0, 200)}`)
      setMessage('')
      setBusyId(null)
      return
    }
    setMessage('Documento regenerado com correcoes.')
    setBusyId(null)
    setPreview(null)
    router.refresh()
  }

  async function markClientReceived(documento: DocumentoHub, file?: File | null) {
    setBusyId(documento.id)
    if (file) {
      const url = await fileToDataUrl(file)
      await fetch('/api/arquivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetoId: projeto.id,
          nome: file.name,
          url,
          tipo: file.type || 'arquivo_cliente',
          tamanho: file.size,
        }),
      })
    }
    await updateStatus(documento.id, 'entregue')
    setBusyId(null)
  }

  return (
    <section className="space-y-6 overflow-hidden">
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-semibold text-slate-950">Painel de documentos</h2>
            <p className="mt-1 break-words text-sm text-slate-600">
              {recomendacoes.length} documentos recomendados · {gerados} gerados · {aprovados} aprovados
            </p>
            {message ? <p className="mt-2 break-words text-sm text-slate-600">{message}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === 'planejar'}
              onClick={planejar}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              Planejar documentos com IA
            </button>
            <button
              type="button"
              disabled={busyId === 'gerar-todos' || geraveisPendentes.length === 0}
              onClick={generateAll}
              className="rounded-md border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
            >
              Gerar todos os pendentes em lote
            </button>
          </div>
        </div>
      </div>

      <DocumentSection
        title="Documentos que a consultoria gera autonomamente"
        tone="blue"
        count={recomendacoesAutonomas.length}
      >
        {(['Ambiental', 'SST Documental', 'Sistema de Gestao / ESG', 'Homologacao'] as GrupoDocumento[]).map((grupo) => {
          const itens = recomendacoesAutonomas.filter((recomendacao) => recomendacao.grupo === grupo)
          if (!itens.length) return null

          return (
            <div key={grupo} className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <h3 className="mb-3 text-sm font-semibold text-blue-950">{grupo}</h3>
              <div className="grid gap-3">
                {itens.map((recomendacao) => (
                  <Card key={recomendacao.nome}>
                    <CardHeader title={recomendacao.nome} subtitle={`Origem: ${recomendacao.origem}`} badge="Consultoria autonoma" />
                    <button
                      type="button"
                      disabled={busyId === recomendacao.nome}
                      onClick={() => createAndGenerate(recomendacao)}
                      className="mt-4 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {busyId === recomendacao.nome ? <LoadingLabel label="Gerando..." /> : 'Criar e gerar com IA'}
                    </button>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </DocumentSection>

      <details className="rounded-lg border-l-4 border-orange-500 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-slate-950">
          Documentos que requerem parceria tecnica ({recomendacoesParceria.length})
        </summary>
        <div className="mt-4 grid gap-3">
          {recomendacoesParceria.map((recomendacao) => (
            <Card key={recomendacao.nome}>
              <CardHeader title={recomendacao.nome} subtitle={recomendacao.motivoParceria || recomendacao.origem} badge="Requer parceria" />
              <Action
                variant="secondary"
                disabled={busyId === recomendacao.nome}
                onClick={() => createWaitingDocument(recomendacao, 'Documento marcado como aguardando parceiro tecnico.')}
              >
                {busyId === recomendacao.nome ? <LoadingLabel label="Marcando..." /> : 'Marcar como aguardando parceiro'}
              </Action>
            </Card>
          ))}
        </div>
      </details>

      <details className="rounded-lg border-l-4 border-slate-400 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-slate-950">
          Documentos exigiveis do cliente ({recomendacoesCliente.length})
        </summary>
        <div className="mt-4 grid gap-3">
          {recomendacoesCliente.map((recomendacao) => (
            <Card key={recomendacao.nome}>
              <CardHeader title={recomendacao.nome} subtitle={`Cliente deve providenciar: ${recomendacao.origem}`} badge="Exigivel cliente" />
              <Action
                variant="secondary"
                disabled={busyId === recomendacao.nome}
                onClick={() => createWaitingDocument(recomendacao, 'Documento marcado como aguardando cliente.')}
              >
                {busyId === recomendacao.nome ? <LoadingLabel label="Marcando..." /> : 'Marcar como aguardando cliente'}
              </Action>
            </Card>
          ))}
        </div>
      </details>

      <DocumentSection title="Em rascunho" tone="slate" count={countByStatus(projeto.documentos, 'pendente')}>
        {byStatus(projeto.documentos, 'pendente').map((documento) => (
          <Card key={documento.id}>
            <CardTools documento={documento} onDelete={() => setDeleteTarget(documento)} />
            <CardHeader title={documento.nome} subtitle={originText(documento)} badge={documento.tipo} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Action onClick={() => generate(documento.id)} disabled={busyId === documento.id}>
                {busyId === documento.id ? <LoadingLabel label="Gerando..." /> : 'Gerar com IA'}
              </Action>
              <Action variant="secondary" onClick={() => updateStatus(documento.id, 'aguardando_cliente')}>Marcar como exigível do cliente</Action>
            </div>
          </Card>
        ))}
      </DocumentSection>

      <DocumentSection title="Gerados pela IA" tone="amber" count={countByStatus(projeto.documentos, 'em_revisao')}>
        {byStatus(projeto.documentos, 'em_revisao').map((documento) => (
          <Card key={documento.id}>
            <CardTools documento={documento} onDelete={() => setDeleteTarget(documento)} />
            <CardHeader title={documento.nome} subtitle="Gerado por IA — revisar" badge={`Score ${documento.scoreQualidade ?? '-'}/100`} />
            <PreviewText text={documento.conteudo || ''} onMore={() => setPreview(documento)} />
            {reviews[documento.id] ? <ReviewSummary review={reviews[documento.id]} /> : null}
            <FidelidadePanel validacao={latestFidelidade(documento, fidelidade)} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Action onClick={() => setPreview(documento)}>Visualizar completo</Action>
              <Action
                variant="secondary"
                onClick={() => approveDocument(documento)}
                disabled={Boolean(latestFidelidade(documento, fidelidade)?.bloqueia)}
                title={latestFidelidade(documento, fidelidade)?.bloqueia ? 'Resolva divergências críticas antes de aprovar' : undefined}
              >
                Aprovar
              </Action>
              {latestFidelidade(documento, fidelidade)?.bloqueia ? (
                <Action variant="secondary" onClick={() => approveDocument(documento, true)}>
                  Aprovar mesmo assim (justificar)
                </Action>
              ) : null}
              <Action variant="secondary" onClick={() => regenerate(documento.id)}>Regenerar</Action>
              <Action variant="secondary" onClick={() => review(documento.id)} disabled={busyId === `review-${documento.id}`}>Revisar com IA</Action>
              <Action variant="secondary" onClick={() => validarFidelidadeDocumento(documento.id)} disabled={busyId === `fidelidade-${documento.id}`}>
                {busyId === `fidelidade-${documento.id}` ? <LoadingLabel label="Validando..." /> : 'Validar Fidelidade'}
              </Action>
            </div>
          </Card>
        ))}
      </DocumentSection>

      <DocumentSection title="Aprovados" tone="green" count={countByStatus(projeto.documentos, 'aprovado')}>
        {byStatus(projeto.documentos, 'aprovado').map((documento) => (
          <Card key={documento.id}>
            <CardTools documento={documento} onDelete={() => setDeleteTarget(documento)} />
            <CardHeader title={documento.nome} subtitle={`Versão ${documento.versao} · aprovado por ${documento.aprovadoPor || 'humano'} · ${new Date(documento.updatedAt).toLocaleDateString('pt-BR')}`} badge="Aprovado" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Action onClick={() => exportarPDF(toExport(documento, projeto.documentos), projeto.empresa)}>Exportar PDF</Action>
              <Action variant="secondary" onClick={() => exportarWord(toExport(documento, projeto.documentos), projeto.empresa)}>Exportar Word</Action>
              <Action variant="secondary" onClick={() => setPreview(documento)}>Histórico de versões</Action>
            </div>
          </Card>
        ))}
      </DocumentSection>

      <DocumentSection title="Aguardando cliente" tone="orange" count={countByStatus(projeto.documentos, 'aguardando_cliente')}>
        {byStatus(projeto.documentos, 'aguardando_cliente').map((documento) => (
          <Card key={documento.id}>
            <CardTools documento={documento} onDelete={() => setDeleteTarget(documento)} />
            <CardHeader title={documento.nome} subtitle={originText(documento)} badge="Aguardando cliente" />
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
              <UploadCloud className="h-4 w-4" />
              Marcar como recebido
              <input
                type="file"
                className="hidden"
                onChange={(event) => void markClientReceived(documento, event.target.files?.[0])}
              />
            </label>
          </Card>
        ))}
      </DocumentSection>

      <DocumentSection title="Entregues" tone="purple" count={countByStatus(projeto.documentos, 'entregue')}>
        {byStatus(projeto.documentos, 'entregue').map((documento) => (
          <Card key={documento.id}>
            <CardTools documento={documento} onDelete={() => setDeleteTarget(documento)} />
            <CardHeader title={documento.nome} subtitle={`Entregue em ${new Date(documento.updatedAt).toLocaleDateString('pt-BR')}`} badge="Entregue" />
            {documento.urlExportado ? (
              <a className="mt-3 inline-block text-sm font-medium text-blue-700 underline" href={documento.urlExportado}>
                Abrir arquivo exportado
              </a>
            ) : null}
          </Card>
        ))}
      </DocumentSection>

      {preview ? (
        <FullPreview
          documento={preview}
          empresa={projeto.empresa}
          regenerando={busyId === `regen-${preview.id}`}
          onRegenerarCorrigindo={(problemas) => regenerateFixing(preview.id, problemas)}
          onClose={() => setPreview(null)}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDeleteModal
          documento={deleteTarget}
          isDeleting={busyId === `delete-${deleteTarget.id}`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}

function buildRecomendacoes(projeto: ProjetoHub): Recomendacao[] {
  const existingNames = new Set(projeto.documentos.map((documento) => normalize(documento.nome)))
  const fromGaps = projeto.avaliacoes.flatMap((avaliacao) =>
    avaliacao.itens
      .filter((item) => ['nao_atende', 'atende_parcialmente', 'precisa_validacao'].includes(item.status))
      .filter((item) => item.requisito.documentoEsperado)
      .map((item) => {
        const nome = item.requisito.documentoEsperado || 'Documento de evidencia'
        return {
          nome,
          tipo: inferTipo(nome),
          origem: `Identificado no gap do requisito ${item.requisito.codigo || item.requisito.titulo}`,
          requisitosOrigem: [item.requisito.id],
          ...metadataDocumento(nome),
        }
      }),
  )
  const setorDocs = getDocumentosRecomendadosPorSetor(projeto.empresa.setorCodigo || projeto.empresa.setor || '')
  const all = [
    ...fromGaps,
    ...setorDocs.map((documento) => ({
      nome: documento.nome,
      tipo: inferTipo(documento.nome),
      origem: `Documento típico do setor ${projeto.empresa.setor || 'informado'}`,
      requisitosOrigem: [],
      categoriaAutonomia: documento.categoriaAutonomia,
      grupo: documento.grupo,
      motivoParceria: documento.motivoParceria,
    })),
  ]
  const unique = new Map<string, Recomendacao>()
  for (const item of all) {
    const key = normalize(item.nome)
    if (!existingNames.has(key) && !unique.has(key)) unique.set(key, item)
  }
  return Array.from(unique.values())
}

function inferTipo(nome: string) {
  const info = getDocumentoInfo(nome)
  if (info?.categoriaAutonomia === CATEGORIAS_DOCUMENTO.REQUER_PARCERIA_TECNICA) return 'requer_parceria_tecnica'
  if (info?.categoriaAutonomia === CATEGORIAS_DOCUMENTO.EXIGIVEL_CLIENTE) return 'exigivel_cliente'
  if (info?.categoriaAutonomia === CATEGORIAS_DOCUMENTO.CONSULTORIA_AUTONOMA) return 'geravel_ia'

  const n = normalize(nome)
  if (n.includes('pgrs')) return 'geravel_ia'
  if (['pgr', 'pcmso', 'avcb', 'alvara', 'licenca'].some((term) => n.includes(term))) return 'exigivel_cliente'
  if (n.includes('plano') || n.includes('politica') || n.includes('matriz') || n.includes('procedimento')) return 'geravel_ia'
  return 'semi_geravel'
}

function metadataDocumento(nome: string) {
  const info = getDocumentoInfo(nome)

  return {
    categoriaAutonomia: info?.categoriaAutonomia || CATEGORIAS_DOCUMENTO.CONSULTORIA_AUTONOMA,
    grupo: info?.grupo || 'Homologacao',
    motivoParceria: info?.motivoParceria,
  } satisfies Pick<Recomendacao, 'categoriaAutonomia' | 'grupo' | 'motivoParceria'>
}

function DocumentSection({
  title,
  tone,
  count,
  children,
}: {
  title: string
  tone: 'blue' | 'slate' | 'amber' | 'green' | 'orange' | 'purple'
  count: number
  children: React.ReactNode
}) {
  if (count === 0) {
    return (
      <details className={`rounded-lg border-l-4 bg-white p-4 shadow-sm ${borderClass(tone)}`}>
        <summary className="cursor-pointer font-semibold text-slate-700">{title} (0)</summary>
      </details>
    )
  }
  return (
    <section className={`overflow-hidden rounded-lg border-l-4 bg-white p-5 shadow-sm ${borderClass(tone)}`}>
      <h2 className="break-words text-xl font-semibold text-slate-950">{title} ({count})</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 pr-20 shadow-sm">{children}</article>
}

function CardTools({ documento, onDelete }: { documento: DocumentoHub; onDelete: () => void }) {
  return (
    <div className="absolute right-3 top-3 flex items-center gap-2">
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
        v{documento.versao}
      </span>
      <button
        type="button"
        onClick={onDelete}
        title="Excluir documento"
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function CardHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="break-words font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 break-words text-sm text-slate-600">{subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{badge}</span>
    </div>
  )
}

function PreviewText({ text, onMore }: { text: string; onMore: () => void }) {
  const truncated = text.length > 200 ? `${text.slice(0, 200)}...` : text
  return (
    <div className="mt-3 overflow-hidden rounded-md bg-slate-50 p-3">
      <p className="break-words text-sm text-slate-700">{truncated || 'Sem conteúdo.'}</p>
      {text.length > 200 ? <button onClick={onMore} className="mt-2 text-sm font-medium text-blue-700">Ver mais</button> : null}
    </div>
  )
}

function Action({
  children,
  onClick,
  disabled,
  title,
  variant = 'primary',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={
        variant === 'primary'
          ? 'rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60'
          : 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
      }
    >
      {children}
    </button>
  )
}

function LoadingLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </span>
  )
}

function ReviewSummary({ review }: { review: Revisao }) {
  return (
    <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
      Score revisão: {review.score}/100 · {review.aprovado ? 'Aprovável' : 'Revisar antes de aprovar'}
    </div>
  )
}

function FidelidadePanel({ validacao }: { validacao: ValidacaoFidelidade | null }) {
  if (!validacao) {
    return (
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Fidelidade factual ainda não validada.
      </div>
    )
  }

  const grupos = (['critica', 'alta', 'media', 'info'] as const)
    .map((severidade) => ({
      severidade,
      itens: validacao.divergencias.filter((item) => item.severidade === severidade),
    }))
    .filter((grupo) => grupo.itens.length)

  return (
    <div className={`mt-3 rounded-md border p-3 text-sm ${scoreTone(validacao.score)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Validação de Fidelidade: {validacao.score}/100</p>
        <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-medium">
          {validacao.bloqueia ? 'Bloqueia aprovação' : 'Sem bloqueio crítico'}
        </span>
      </div>
      <p className="mt-1 text-xs opacity-80">
        v{validacao.versao} · {new Date(validacao.executadoEm).toLocaleString('pt-BR')}
      </p>

      {grupos.length ? (
        <div className="mt-3 space-y-3">
          {grupos.map((grupo) => (
            <div key={grupo.severidade}>
              <p className="text-xs font-bold uppercase">{grupo.severidade}</p>
              <ul className="mt-1 space-y-2">
                {grupo.itens.map((item, index) => (
                  <li key={`${item.regra}-${index}`} className="rounded bg-white/70 p-2">
                    <p className="break-words font-medium">{item.regra}</p>
                    <p className="break-words">{item.mensagem}</p>
                    <p className="mt-1 break-words text-xs">
                      Esperado: {formatValue(item.esperado)} · Encontrado: {formatValue(item.encontrado)}
                    </p>
                    {item.localizacao ? <p className="break-words text-xs">Localização: {item.localizacao}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2">Nenhuma divergência factual encontrada.</p>
      )}
    </div>
  )
}

function FullPreview({
  documento,
  empresa,
  regenerando,
  onRegenerarCorrigindo,
  onClose,
}: {
  documento: DocumentoHub
  empresa: { nome: string }
  regenerando?: boolean
  onRegenerarCorrigindo: (problemas: unknown[]) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="flex h-full w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h3 className="break-words font-semibold text-slate-950">{documento.nome}</h3>
          <div className="flex gap-2">
            <Action onClick={() => exportarPDF(toExport(documento), empresa)}>Exportar PDF</Action>
            <Action variant="secondary" onClick={() => exportarWord(toExport(documento), empresa)}>Exportar Word</Action>
            <Action variant="secondary" onClick={onClose}>Fechar</Action>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <PreviewDocumento
            documento={documento}
            regenerando={regenerando}
            onRegenerarCorrigindo={(problemas) => onRegenerarCorrigindo(problemas)}
          />
          {documento.exportacoes.length > 0 ? (
            <div className="mt-6 rounded-md bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-950">Histórico de exportações</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {documento.exportacoes.map((exportacao) => (
                  <li key={exportacao.id} className="break-words">
                    {exportacao.formato.toUpperCase()} · v{exportacao.versao} · {new Date(exportacao.createdAt).toLocaleString('pt-BR')} · {exportacao.urlArquivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {documento.versoes?.length ? (
            <div className="mt-6 rounded-md bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-950">Histórico de versões do conteúdo</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {documento.versoes.map((versao) => (
                  <li key={versao.id} className="break-words">
                    v{versao.versao} salva em {new Date(versao.createdAt).toLocaleString('pt-BR')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({
  documento,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  documento: DocumentoHub
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="break-words text-lg font-semibold text-slate-950">Excluir documento</h3>
        <p className="mt-2 break-words text-sm text-slate-600">
          Tem certeza que deseja excluir este documento? Esta acao nao pode ser desfeita.
        </p>
        <p className="mt-3 break-words rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">
          {documento.nome} - v{documento.versao}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function toExport(documento: DocumentoHub, documentos: DocumentoHub[] = [documento]): DocumentoExport {
  return {
    id: documento.id,
    nome: documento.nome,
    tipo: documento.tipo,
    status: documento.status,
    versao: documento.versao,
    sequencial: getSequencialDocumento(documento, documentos),
    tabelaLargura: isMatrizAspectos(documento) ? 'manter-linha' : 'pode-dividir',
    conteudo: documento.conteudo || '',
  }
}

function isMatrizAspectos(documento: DocumentoHub) {
  const text = `${documento.nome} ${documento.tipo}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return text.includes('matriz') && text.includes('aspectos') && text.includes('impactos')
}

function getSequencialDocumento(documento: DocumentoHub, documentos: DocumentoHub[]) {
  const prefix = detectarCodigoDocumento(documento.nome, documento.tipo, 1).replace(/-\d{3}$/, '')
  const ordenados = documentos
    .filter((item) => safeCodigoDocumento(item)?.startsWith(prefix))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return Math.max(1, ordenados.findIndex((item) => item.id === documento.id) + 1)
}

function safeCodigoDocumento(documento: DocumentoHub) {
  try {
    return detectarCodigoDocumento(documento.nome, documento.tipo, 1)
  } catch {
    return null
  }
}

function latestFidelidade(
  documento: DocumentoHub,
  overrides: Record<string, ValidacaoFidelidade>,
): ValidacaoFidelidade | null {
  return overrides[documento.id] || documento.validacoesFidelidade?.[0] || null
}

function scoreTone(score: number) {
  if (score >= 85) return 'border-green-200 bg-green-50 text-green-800'
  if (score >= 70) return 'border-yellow-200 bg-yellow-50 text-yellow-800'
  if (score >= 50) return 'border-orange-200 bg-orange-50 text-orange-800'
  return 'border-red-200 bg-red-50 text-red-800'
}

function formatValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(', ') : value
}

function byStatus(documentos: DocumentoHub[], status: string) {
  return documentos.filter((documento) => documento.status === status)
}

function countByStatus(documentos: DocumentoHub[], status: string) {
  return byStatus(documentos, status).length
}

function originText(documento: DocumentoHub) {
  return documento.requisitosOrigem.length
    ? `Requisitos vinculados: ${documento.requisitosOrigem.length}`
    : 'Sem requisito de origem vinculado'
}

function borderClass(tone: string) {
  return {
    blue: 'border-l-blue-600',
    slate: 'border-l-slate-400',
    amber: 'border-l-amber-500',
    green: 'border-l-emerald-600',
    orange: 'border-l-orange-500',
    purple: 'border-l-purple-600',
  }[tone]
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
