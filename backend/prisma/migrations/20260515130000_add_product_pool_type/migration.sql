-- v1.11.14 — Product.poolType: campo dedicado de tipo pra modulo Piscina.
-- Substitui o uso de `technicalSpecs.categoriaPlanilha` (mantido por compat,
-- mas a UI nova ja usa poolType). Coluna nullable + backfill abaixo.
-- TenantMigrator sincroniza a coluna nos schemas tenant_* (sem indice — sera
-- criado em cada tenant via script post-deploy se houver volume).

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "poolType" TEXT;

-- Backfill: copia categoriaPlanilha dos technicalSpecs pra poolType (schema public).
-- Tenants serao backfilled via script post-deploy (separado).
UPDATE "Product"
SET "poolType" = "technicalSpecs"->>'categoriaPlanilha'
WHERE "poolType" IS NULL
  AND "technicalSpecs" ? 'categoriaPlanilha'
  AND length("technicalSpecs"->>'categoriaPlanilha') > 0;

-- Indice pra filtros por (companyId, poolType)
CREATE INDEX IF NOT EXISTS "Product_companyId_poolType_idx"
  ON "Product"("companyId", "poolType");
