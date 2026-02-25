-- AlterTable: add auth fields to Technician
ALTER TABLE "Technician" ADD COLUMN "email" TEXT;
ALTER TABLE "Technician" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Technician_email_key" ON "Technician"("email");
