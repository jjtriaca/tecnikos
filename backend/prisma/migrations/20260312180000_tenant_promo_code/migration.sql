-- AlterTable: add promoCode to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "promoCode" TEXT;
