-- CreateTable
CREATE TABLE "ValidacaoFidelidade" (
    "id" TEXT NOT NULL,
    "docProjetoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "divergencias" JSONB NOT NULL,
    "criticas" INTEGER NOT NULL DEFAULT 0,
    "altas" INTEGER NOT NULL DEFAULT 0,
    "medias" INTEGER NOT NULL DEFAULT 0,
    "infos" INTEGER NOT NULL DEFAULT 0,
    "bloqueia" BOOLEAN NOT NULL DEFAULT false,
    "executadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidacaoFidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidacaoFidelidade_docProjetoId_versao_idx" ON "ValidacaoFidelidade"("docProjetoId", "versao");

-- AddForeignKey
ALTER TABLE "ValidacaoFidelidade" ADD CONSTRAINT "ValidacaoFidelidade_docProjetoId_fkey" FOREIGN KEY ("docProjetoId") REFERENCES "DocProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
