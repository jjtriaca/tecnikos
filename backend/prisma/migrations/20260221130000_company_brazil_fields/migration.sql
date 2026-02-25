-- AlterTable: add Brazilian company fields
ALTER TABLE "Company" ADD COLUMN "tradeName" TEXT;
ALTER TABLE "Company" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Company" ADD COLUMN "ie" TEXT;
ALTER TABLE "Company" ADD COLUMN "im" TEXT;
ALTER TABLE "Company" ADD COLUMN "phone" TEXT;
ALTER TABLE "Company" ADD COLUMN "email" TEXT;
ALTER TABLE "Company" ADD COLUMN "cep" TEXT;
ALTER TABLE "Company" ADD COLUMN "addressStreet" TEXT;
ALTER TABLE "Company" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "addressComp" TEXT;
ALTER TABLE "Company" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "Company" ADD COLUMN "city" TEXT;
ALTER TABLE "Company" ADD COLUMN "state" TEXT;
ALTER TABLE "Company" ADD COLUMN "ownerName" TEXT;
ALTER TABLE "Company" ADD COLUMN "ownerCpf" TEXT;
ALTER TABLE "Company" ADD COLUMN "ownerPhone" TEXT;
ALTER TABLE "Company" ADD COLUMN "ownerEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");
