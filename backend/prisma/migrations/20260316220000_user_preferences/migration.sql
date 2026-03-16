-- AlterTable: Add preferences JSON to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
