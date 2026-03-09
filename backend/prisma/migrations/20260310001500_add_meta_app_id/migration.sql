-- AlterTable: Add metaAppId to WhatsAppConfig
ALTER TABLE "WhatsAppConfig" ADD COLUMN "metaAppId" TEXT;

-- Backfill existing record with known App ID
UPDATE "WhatsAppConfig" SET "metaAppId" = '950743807617295' WHERE "metaAppId" IS NULL;
