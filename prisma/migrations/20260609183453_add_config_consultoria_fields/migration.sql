-- AlterTable
ALTER TABLE "ConfiguracaoConsultoria" ADD COLUMN     "nomeConsultoria" TEXT NOT NULL DEFAULT 'Consultoria SGI',
ADD COLUMN     "registroResponsavel" TEXT,
ADD COLUMN     "responsavelTecnico" TEXT;
