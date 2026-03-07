-- AlterTable: Add manifestation fields to SefazDocument
ALTER TABLE "SefazDocument" ADD COLUMN IF NOT EXISTS "manifestType" TEXT;
ALTER TABLE "SefazDocument" ADD COLUMN IF NOT EXISTS "manifestedAt" TIMESTAMP(3);

-- AlterTable: Add auto-manifest flag to SefazConfig
ALTER TABLE "SefazConfig" ADD COLUMN IF NOT EXISTS "autoManifestCiencia" BOOLEAN NOT NULL DEFAULT false;
