-- v1.10.41: PoolPaymentTerm — formas de pagamento de obra (modulo Piscina)
-- Separado dos PaymentMethod do financeiro (PIX/Cartao). Aqui descreve estrutura de parcelas.
-- structure (Json): array de partes
--   { label, percent, count, intervalDays, firstOffsetDays }

CREATE TABLE IF NOT EXISTS "PoolPaymentTerm" (
  "id"        TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "structure" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PoolPaymentTerm_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoolPaymentTerm_companyId_name_key"
  ON "PoolPaymentTerm" ("companyId", "name");

CREATE INDEX IF NOT EXISTS "PoolPaymentTerm_companyId_isActive_deletedAt_idx"
  ON "PoolPaymentTerm" ("companyId", "isActive", "deletedAt");

-- Adiciona FK em PoolBudget
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "paymentTermId" TEXT;
ALTER TABLE "PoolBudget" DROP CONSTRAINT IF EXISTS "PoolBudget_paymentTermId_fkey";
ALTER TABLE "PoolBudget" ADD CONSTRAINT "PoolBudget_paymentTermId_fkey"
  FOREIGN KEY ("paymentTermId") REFERENCES "PoolPaymentTerm"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
