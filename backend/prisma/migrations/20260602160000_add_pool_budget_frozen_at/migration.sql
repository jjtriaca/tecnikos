-- v1.13.x — PoolBudget.frozenAt / frozenByName: "Cadastrar" (congelar) um orcamento.
-- O gestor finaliza o orcamento e clica "Cadastrar" -> frozenAt = agora. Isso CONGELA
-- edicao + recalculo automatico (totais/qty/heating/solar) e libera o PDF. "Editar" limpa
-- frozenAt (descongela). Reversivel — diferente do lock PERMANENTE de status APROVADO.
--
-- Nullable: orcamentos nao-cadastrados ficam com frozenAt = NULL (editaveis).
-- TenantMigratorService propaga ADD COLUMN nos schemas tenant_*.

ALTER TABLE "PoolBudget"
  ADD COLUMN IF NOT EXISTS "frozenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frozenByName" TEXT;
