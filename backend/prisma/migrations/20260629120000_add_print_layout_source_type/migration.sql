-- EngineReporter (biblia de campos, Fase 1) — liga o layout de impressao a uma ORIGEM
-- (sourceType) e, p/ obras, a um modelo de obra alvo (templateId) que escopa os campos de
-- etapa/linha. NULLABLE (o codigo trata null como POOL_BUDGET) — seguro em tabela populada; o
-- TenantMigratorService propaga o ADD COLUMN nos schemas tenant_* no boot. Backfill do public
-- p/ os layouts legados (todos sao de obra hoje).

ALTER TABLE "PoolPrintLayout"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "templateId" TEXT;

UPDATE "PoolPrintLayout" SET "sourceType" = 'POOL_BUDGET' WHERE "sourceType" IS NULL;
