-- v1.12.19 — PoolBudgetItem.customSectionKey: armazena a chave da etapa
-- customizada (CUSTOM_<slug>_<rand>) quando a linha pertence a uma etapa
-- criada pelo operador. Resolve o bug onde linhas em etapa custom eram
-- rejeitadas pelo @IsEnum(PoolSection) do DTO.
--
-- Comportamento:
-- - Linha em etapa padrao (do enum PoolSection): customSectionKey = NULL.
-- - Linha em etapa custom: poolSection = 'OUTROS' (fallback do enum) +
--   customSectionKey = 'CUSTOM_<slug>_<rand>'.
-- - Frontend agrupa por: COALESCE(customSectionKey, poolSection::text).
--
-- TenantMigrator sincroniza ADD COLUMN nos schemas tenant_*.

ALTER TABLE "PoolBudgetItem"
  ADD COLUMN IF NOT EXISTS "customSectionKey" TEXT;

CREATE INDEX IF NOT EXISTS "PoolBudgetItem_budgetId_customSectionKey_sortOrder_idx"
  ON "PoolBudgetItem" ("budgetId", "customSectionKey", "sortOrder");
