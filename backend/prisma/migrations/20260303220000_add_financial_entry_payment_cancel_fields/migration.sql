-- AlterTable: Add payment and cancellation tracking fields
ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "cardBrand" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT;
