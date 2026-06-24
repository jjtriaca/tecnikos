-- v1.13.94 — Cartao agrupado / conciliacao por lote: carimba a PASSADA (batchPaymentId) tambem na
-- baixa de cartao (CardSettlement), nao so no lancamento. Permite AGRUPAR a tela "Baixa de Cartao"
-- por passada (1 swipe = 1 linha) e baixar o lote inteiro de uma vez.
-- NULLABLE (sem default) — seguro em tabela populada; baixas avulsas (fora de lote) ficam NULL.
-- O TenantMigratorService propaga o ADD COLUMN nos schemas tenant_* no boot (detecta coluna faltante);
-- o ensureCardSettlementTable (prisma.service) tambem auto-cura com ALTER ... ADD COLUMN IF NOT EXISTS.

ALTER TABLE "CardSettlement"
  ADD COLUMN IF NOT EXISTS "batchPaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "CardSettlement_companyId_batchPaymentId_idx"
  ON "CardSettlement"("companyId", "batchPaymentId");
