-- v1.11.37 — Product.defaultQty: quantidade padrao do produto no orcamento de piscina.
-- Null = sem padrao (fluxo usa 1). Usado pelo handler do catalog picker pra setar
-- a qty inicial ao escolher um produto. UI mostra fundo amarelo na linha quando
-- qty != defaultQty (operador editou manualmente, fora do padrao).
-- TenantMigrator sincroniza nos schemas tenant_*.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "defaultQty" DOUBLE PRECISION;
