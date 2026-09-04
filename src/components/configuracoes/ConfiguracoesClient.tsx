'use client'

import { useMemo, useState } from 'react'
import { CONSULTORIA_CONFIG } from '@/lib/config/consultoria'

const PLACEHOLDER_RESPONSAVEL = 'A SER PREENCHIDO PELA CONSULTORIA'

type Configuracao = {
  nome: string
  nomeConsultoria: string | null
  nomeCompleto: string | null
  slogan: string | null
  corPrimaria: string
  corSecundaria: string
  logoUrl: string | null
  responsavelNome: string | null
  responsavelRegistro: string | null
  responsavelTecnico: string | null
  registroResponsavel: string | null
  responsavelCargo: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  site: string | null
}

export function ConfiguracoesClient({ initialConfig }: { initialConfig: Configuracao }) {
  const [config, setConfig] = useState(initialConfig)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const temResponsavelPendente =
    isPlaceholder(config.responsavelTecnico) || isPlaceholder(config.registroResponsavel)
  const initials = useMemo(
    () =>
      config.nome
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join(''),
    [config.nome],
  )

  function update<K extends keyof Configuracao>(key: K, value: Configuracao[K]) {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    setIsSaving(true)

    const formData = new FormData()
    Object.entries(config).forEach(([key, value]) => {
      formData.append(key, value || '')
    })
    if (logoFile) {
      formData.append('logo', logoFile)
    }

    const response = await fetch('/api/configuracoes', {
      method: 'PUT',
      body: formData,
    })

    setIsSaving(false)

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error || 'Não foi possível salvar as configurações.')
      return
    }

    const saved = (await response.json()) as Configuracao
    setConfig(saved)
    setLogoFile(null)
    setMessage('Configurações salvas com sucesso.')
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_360px]">
      <form onSubmit={save} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Identidade visual
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Configurações</h1>
        </div>

        {temResponsavelPendente ? (
          <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Preencha o responsável técnico e o registro profissional antes de exportar documentos para clientes.
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Nome da consultoria" value={config.nome} onChange={(value) => update('nome', value)} />
          <Field label="Nome curto/assinatura" value={config.nomeConsultoria || ''} onChange={(value) => update('nomeConsultoria', value)} />
          <Field label="Nome completo" value={config.nomeCompleto || ''} onChange={(value) => update('nomeCompleto', value)} />
          <Field label="Slogan" value={config.slogan || ''} onChange={(value) => update('slogan', value)} />
          <Field label="Cor primária" type="color" value={config.corPrimaria} onChange={(value) => update('corPrimaria', value)} />
          <Field label="Cor secundária" type="color" value={config.corSecundaria} onChange={(value) => update('corSecundaria', value)} />
          <div>
            <label className="block text-sm font-medium text-slate-700">Logo PNG/SVG</label>
            <input
              type="file"
              accept=".png,.svg,image/png,image/svg+xml"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <SectionTitle title="Responsável técnico padrão" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Responsável técnico" value={config.responsavelTecnico || ''} onChange={(value) => update('responsavelTecnico', value)} />
          <Field label="CREA/CRQ/Registro" value={config.registroResponsavel || ''} onChange={(value) => update('registroResponsavel', value)} />
          <Field label="Cargo" value={config.responsavelCargo || ''} onChange={(value) => update('responsavelCargo', value)} />
        </div>

        <SectionTitle title="Rodapé dos documentos" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Endereço" value={config.endereco || ''} onChange={(value) => update('endereco', value)} />
          <Field label="Telefone" value={config.telefone || ''} onChange={(value) => update('telefone', value)} />
          <Field label="Email" value={config.email || ''} onChange={(value) => update('email', value)} />
          <Field label="Site" value={config.site || ''} onChange={(value) => update('site', value)} />
        </div>

        {message ? <p className="mt-5 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>

      <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Preview da sidebar</h2>
        <div className="mt-5 rounded-xl bg-[var(--cor-sidebar)] p-5 text-white">
          <div className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3">
            <div
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
              style={{ backgroundColor: config.corPrimaria }}
            >
              {config.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.logoUrl} alt={config.nome} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="font-semibold">{config.nome}</p>
              <p className="mt-0.5 text-xs text-slate-300">
                {config.slogan || CONSULTORIA_CONFIG.slogan}
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: config.corPrimaria }}>
            Empresas
          </div>
          <div className="mt-2 rounded-md bg-white/10 px-3 py-2 text-sm text-slate-200">
            Modelos de Avaliação
          </div>
        </div>
      </aside>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-4 mt-8 text-lg font-semibold text-slate-950">{title}</h2>
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  )
}

function isPlaceholder(value?: string | null) {
  return !value || value.trim().toUpperCase() === PLACEHOLDER_RESPONSAVEL
}
