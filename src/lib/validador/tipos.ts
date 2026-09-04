import type { Anamnese, Empresa, Projeto } from '@prisma/client'

export type SeveridadeFidelidade = 'critica' | 'alta' | 'media' | 'info'

export type Divergencia = {
  severidade: SeveridadeFidelidade
  regra: string
  esperado: string | string[]
  encontrado: string | string[]
  mensagem: string
  localizacao?: string
}

export type ResultadoFidelidade = {
  score: number
  divergencias: Divergencia[]
  contagem: { criticas: number; altas: number; medias: number; infos: number }
  bloqueia: boolean
}

export type CategoriaFidelidade = 'ambiental' | 'sst' | 'gestao' | 'homologacao'

export type PerfilOperacional = {
  processos_provaveis?: string[]
  riscos_sst?: string[]
  aspectos_ambientais?: string[]
  documentos_esperados?: string[]
  legislacao_aplicavel?: string[]
  observacoes?: string
  [key: string]: unknown
}

export type ContextoFidelidade = {
  empresa: Empresa
  projeto: Projeto
  anamnese: Anamnese
  perfilOperacional?: PerfilOperacional
  tipoDocumento: string
  categoria: CategoriaFidelidade
  empresasRegistradas?: string[]
}
