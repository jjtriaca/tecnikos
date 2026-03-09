-- AlterTable: Add regime to Partner (CLT/PJ for technicians)
ALTER TABLE "Partner" ADD COLUMN "regime" TEXT;

-- AlterTable: Add contractType and replyMessage to TechnicianContract
ALTER TABLE "TechnicianContract" ADD COLUMN "contractType" TEXT NOT NULL DEFAULT 'CONTRACT';
ALTER TABLE "TechnicianContract" ADD COLUMN "replyMessage" TEXT;
