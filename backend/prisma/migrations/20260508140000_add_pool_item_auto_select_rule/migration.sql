-- v1.10.67: PoolBudgetItem.autoSelectRule
-- Regra de auto-selecao do produto/servico baseada em variaveis da piscina + specs do candidato.
-- Estrutura JSON: { filterCategoria, filterDescription, where, orderBy, indicator: { label, expr, unit, levels[] } }
-- recalculateTotals usa pra varrer catalogo, filtrar candidatos, avaliar criterio, ordenar e vincular.

ALTER TABLE "PoolBudgetItem" ADD COLUMN IF NOT EXISTS "autoSelectRule" JSONB;
