-- AlterTable: Add specialization link and trigger to TechnicianContract
ALTER TABLE "TechnicianContract" ADD COLUMN "specializationId" TEXT;
ALTER TABLE "TechnicianContract" ADD COLUMN "trigger" TEXT;
