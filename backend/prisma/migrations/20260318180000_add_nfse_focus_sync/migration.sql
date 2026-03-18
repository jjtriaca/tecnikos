-- NfseEntrada: campos Focus NFe
ALTER TABLE "NfseEntrada" ADD COLUMN IF NOT EXISTS "chaveNfse" TEXT;
ALTER TABLE "NfseEntrada" ADD COLUMN IF NOT EXISTS "focusSource" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NfseEntrada" ADD COLUMN IF NOT EXISTS "situacaoFocus" TEXT;
ALTER TABLE "NfseEntrada" ADD COLUMN IF NOT EXISTS "versaoFocus" INTEGER;

-- Unique constraint para deduplicação
CREATE UNIQUE INDEX IF NOT EXISTS "NfseEntrada_companyId_chaveNfse_key" ON "NfseEntrada"("companyId", "chaveNfse");

-- NfseConfig: campos de sync
ALTER TABLE "NfseConfig" ADD COLUMN IF NOT EXISTS "autoSyncNfseRecebida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NfseConfig" ADD COLUMN IF NOT EXISTS "lastNfseSyncVersion" INTEGER NOT NULL DEFAULT 0;
