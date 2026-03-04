-- AlterTable: Add fiscalEnabled flag to Company
ALTER TABLE "Company" ADD COLUMN "fiscalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add autoEmitOnEntry flag to NfseConfig
ALTER TABLE "NfseConfig" ADD COLUMN "autoEmitOnEntry" BOOLEAN NOT NULL DEFAULT false;
