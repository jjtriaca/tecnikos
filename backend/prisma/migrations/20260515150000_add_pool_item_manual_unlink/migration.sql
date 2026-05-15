-- v1.11.21 — PoolBudgetItem.manualUnlink: flag pra marcar items intencionalmente
-- sem vinculo (operador clicou "Sem produto / servico" no catalog picker).
-- Auto-link silencioso por descricao (recalculateTotals PASSO -1) deve pular
-- items com essa flag = true. TenantMigrator sincroniza nos schemas tenant_*.

ALTER TABLE "PoolBudgetItem"
  ADD COLUMN IF NOT EXISTS "manualUnlink" BOOLEAN NOT NULL DEFAULT false;
