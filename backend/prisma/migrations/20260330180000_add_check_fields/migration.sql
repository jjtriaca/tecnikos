-- AlterTable: Add check data fields to FinancialEntry
ALTER TABLE "FinancialEntry" ADD COLUMN "checkNumber" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "checkBank" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "checkAgency" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "checkAccount" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "checkClearanceDate" TIMESTAMP(3);
ALTER TABLE "FinancialEntry" ADD COLUMN "checkHolder" TEXT;
