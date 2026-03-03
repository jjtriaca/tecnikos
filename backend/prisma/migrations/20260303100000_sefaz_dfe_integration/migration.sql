-- =============================================
-- v1.00.53 — SEFAZ DistribuiçãoDFe Integration
-- =============================================

-- CreateTable: SefazConfig
CREATE TABLE "SefazConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "pfxBase64" TEXT NOT NULL,
    "pfxPassword" TEXT NOT NULL,
    "certificateCN" TEXT,
    "certificateExpiry" TIMESTAMP(3),
    "lastNsu" TEXT NOT NULL DEFAULT '000000000000000',
    "lastFetchAt" TIMESTAMP(3),
    "lastFetchStatus" TEXT,
    "lastFetchError" TEXT,
    "autoFetchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SefazConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SefazConfig_companyId_key" ON "SefazConfig"("companyId");

ALTER TABLE "SefazConfig" ADD CONSTRAINT "SefazConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: SefazDocument
CREATE TABLE "SefazDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nsu" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "nfeKey" TEXT,
    "emitterCnpj" TEXT,
    "emitterName" TEXT,
    "issueDate" TIMESTAMP(3),
    "nfeValue" INTEGER,
    "situacao" TEXT,
    "xmlContent" TEXT,
    "nfeImportId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FETCHED',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SefazDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SefazDocument_companyId_nsu_key" ON "SefazDocument"("companyId", "nsu");
CREATE INDEX "SefazDocument_companyId_status_idx" ON "SefazDocument"("companyId", "status");
CREATE INDEX "SefazDocument_companyId_nfeKey_idx" ON "SefazDocument"("companyId", "nfeKey");
CREATE INDEX "SefazDocument_companyId_fetchedAt_idx" ON "SefazDocument"("companyId", "fetchedAt");
CREATE INDEX "SefazDocument_emitterCnpj_idx" ON "SefazDocument"("emitterCnpj");

ALTER TABLE "SefazDocument" ADD CONSTRAINT "SefazDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: NfeImport — add sefazDocumentId
ALTER TABLE "NfeImport" ADD COLUMN "sefazDocumentId" TEXT;
