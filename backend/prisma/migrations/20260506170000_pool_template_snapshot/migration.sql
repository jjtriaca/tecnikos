-- v1.10.43: PoolBudgetTemplate ganha itemsSnapshot e defaults
-- Permite "salvar como modelo" capturando o estado completo de um orcamento
-- (items por etapa + impostos/desconto/garantias/forma pagto/etc).

ALTER TABLE "PoolBudgetTemplate"
  ADD COLUMN IF NOT EXISTS "itemsSnapshot" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "PoolBudgetTemplate"
  ADD COLUMN IF NOT EXISTS "defaults" JSONB;
