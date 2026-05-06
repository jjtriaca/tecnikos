-- v1.10.42: PoolBudgetItem.formulaExpr
-- Expressao aritmetica pra auto-calcular qty a partir das dimensoes da piscina.
-- Variaveis disponiveis: length, width, depth, area, perimeter, volume
-- Operadores: + - * / ( )
-- Ex: "area * 2" (capa termica), "perimeter * 0.5" (borda), "volume * 1.1" (margem)

ALTER TABLE "PoolBudgetItem" ADD COLUMN IF NOT EXISTS "formulaExpr" TEXT;
