-- Add qtyDecimals column to PoolBudgetItem
-- Configures decimal precision allowed in the qty input field per line.
-- 0=integer, 1=0.1, 2=0.01, etc. Default 0 (integer — common for equipment qty).

ALTER TABLE "PoolBudgetItem" ADD COLUMN IF NOT EXISTS "qtyDecimals" INTEGER NOT NULL DEFAULT 0;
