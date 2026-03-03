-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT;
