-- v1.11.23 — PoolBudgetItem.previousQty: snapshot da qty antes de virar
-- "Sem produto / servico". Quando o operador re-escolhe um produto pra essa
-- linha, restauramos a qty anterior. Nullable — so preenchido quando o item
-- esta em estado manualUnlink. TenantMigrator sincroniza nos schemas tenant_*.

ALTER TABLE "PoolBudgetItem"
  ADD COLUMN IF NOT EXISTS "previousQty" DOUBLE PRECISION;
