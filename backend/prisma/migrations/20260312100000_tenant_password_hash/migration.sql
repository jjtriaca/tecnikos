-- AlterTable: Add passwordHash column to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
