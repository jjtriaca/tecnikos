-- v1.12.21 — PoolBudgetItem.kind: define se a linha eh PRODUTO ou SERVICO
-- de forma explicita, em vez de inferir do productId/serviceId. Permite:
-- - Modal de adicionar linha pedir tipo (toggle Produto/Servico)
-- - Linha sem vinculo mostrar "Sem produto" ou "Sem servico" baseado em kind
-- - Picker e auto-selecao filtrarem catalogo por kind
--
-- Backfill: items existentes pegam kind baseado no vinculo atual.
-- - Se tem serviceId nao-null: SERVICE
-- - Se tem productId nao-null: PRODUCT
-- - Caso contrario (linha livre, raro): PRODUCT (default razoavel —
--   a maioria das linhas livres em orcamentos historicos sao produtos)
--
-- TenantMigratorService propaga ADD COLUMN com DEFAULT NOT NULL pra
-- schemas tenant_*. Mas o backfill (UPDATE com base em serviceId) precisa
-- rodar manual nos tenants — incluido em scripts/sql/v1.12.21-kind-backfill-tenants.sql.

ALTER TABLE "PoolBudgetItem"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'PRODUCT';

-- Backfill no schema public (rodar em tenants via script standalone)
UPDATE "PoolBudgetItem" SET "kind" = 'SERVICE' WHERE "serviceId" IS NOT NULL AND "kind" = 'PRODUCT';
