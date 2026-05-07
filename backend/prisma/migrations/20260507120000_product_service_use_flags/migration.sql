-- v1.10.49: flags de uso pra Product e Service
-- Permite distinguir produtos/servicos para venda vs obra de piscina vs ambos.
-- Default: useInSale/useInServiceOrder = true (compat); useInWork/useInPool = false.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "useInSale" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "useInWork" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "useInServiceOrder" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "useInPool"         BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: produtos/servicos cadastrados pelo seeder do Excel (code XLS-*) sao
-- prioritariamente pra obra de piscina. Marcamos useInWork/useInPool=true.
UPDATE "Product" SET "useInWork" = TRUE WHERE "code" LIKE 'XLS-%';
UPDATE "Service" SET "useInPool" = TRUE WHERE "code" LIKE 'XLS-%';
