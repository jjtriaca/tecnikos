-- Adiciona campo slotName ao PoolBudgetItem.
-- Rotulo do "papel" da linha dentro da etapa (ex: "Capa Termica", "Bomba Aquecimento").
-- Funciona como checklist pro operador nao esquecer items padrao da etapa.
-- v1.10.38: substitui a coluna "Etapa" da planilha original (linear sheet),
--          renomeado pra slotName pra nao colidir com o nome da etapa-card (poolSection).
-- Nullable e sem default — items existentes ficam com NULL ate o user preencher.

ALTER TABLE "PoolBudgetItem" ADD COLUMN IF NOT EXISTS "slotName" TEXT;
