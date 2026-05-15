-- v1.11.40 — Product.defaultQty agora tem default 1 (quantidade padrao no orcamento
-- de piscina). Produtos existentes com NULL ficam com 1. TenantMigrator nao sincroniza
-- DEFAULT — sera aplicado nos tenants via script post-deploy.

-- Public schema: set default + backfill rows existentes
ALTER TABLE "Product" ALTER COLUMN "defaultQty" SET DEFAULT 1;

UPDATE "Product" SET "defaultQty" = 1 WHERE "defaultQty" IS NULL;
