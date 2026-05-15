-- v1.11.27 — Product.isSystemProduct: flag pra marcar produtos padrao do sistema
-- (ex: "Sem Produto" universal). Protegidos contra delete, edicao sensivel e
-- duplicacao via import. Criados automaticamente pelo TenantMigratorService no
-- startup pra garantir que todos os tenants tenham. TenantMigrator sincroniza
-- a coluna nos schemas tenant_* via ensureTrackingColumns.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "isSystemProduct" BOOLEAN NOT NULL DEFAULT false;

-- Marca o "Sem Produto" ja existente no schema public como system (compat com
-- tenants antigos). Tenants serao marcados pelo TenantMigratorService.
UPDATE "Product"
SET "isSystemProduct" = true
WHERE lower(description) = 'sem produto'
  AND "deletedAt" IS NULL
  AND "isSystemProduct" = false;
