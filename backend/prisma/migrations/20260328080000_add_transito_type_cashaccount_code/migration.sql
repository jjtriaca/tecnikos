-- AlterEnum: Add TRANSITO to CashAccountType
ALTER TYPE "CashAccountType" ADD VALUE IF NOT EXISTS 'TRANSITO';

-- AlterTable: Add code field to CashAccount
ALTER TABLE "CashAccount" ADD COLUMN IF NOT EXISTS "code" TEXT;
