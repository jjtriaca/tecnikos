-- AlterTable: Add declined reason fields to ServiceOrder
ALTER TABLE "ServiceOrder" ADD COLUMN "declinedReason" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN "declinedAt" TIMESTAMP(3);
