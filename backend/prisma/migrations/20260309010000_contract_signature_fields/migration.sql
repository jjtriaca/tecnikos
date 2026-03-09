-- AlterTable: Add signature/acceptance fields to TechnicianContract
ALTER TABLE "TechnicianContract" ADD COLUMN "requireSignature" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TechnicianContract" ADD COLUMN "requireAcceptance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TechnicianContract" ADD COLUMN "signatureData" TEXT;
