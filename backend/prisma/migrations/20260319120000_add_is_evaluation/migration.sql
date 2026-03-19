-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "isEvaluation" BOOLEAN NOT NULL DEFAULT false;
