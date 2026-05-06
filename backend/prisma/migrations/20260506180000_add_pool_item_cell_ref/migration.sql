-- v1.10.43: PoolBudgetItem.cellRef
-- Endereco estavel da linha (L1, L2, ...) usado em formulas pra referenciar
-- a quantidade/total/preco unitario de OUTRAS linhas (qty(L7), total(L7), unitPrice(L7)).
-- Estavel: nao muda quando reordena. Excluido de uma linha NAO e reusado.

ALTER TABLE "PoolBudgetItem" ADD COLUMN IF NOT EXISTS "cellRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PoolBudgetItem_budgetId_cellRef_key"
  ON "PoolBudgetItem" ("budgetId", "cellRef")
  WHERE "cellRef" IS NOT NULL;

-- Backfill items existentes: L1, L2, ... por (poolSection, sortOrder, id) dentro do budget
WITH numbered AS (
  SELECT
    id,
    'L' || ROW_NUMBER() OVER (
      PARTITION BY "budgetId"
      ORDER BY "poolSection", "sortOrder", id
    ) AS new_ref
  FROM "PoolBudgetItem"
  WHERE "cellRef" IS NULL
)
UPDATE "PoolBudgetItem" p
SET "cellRef" = n.new_ref
FROM numbered n
WHERE p.id = n.id;
