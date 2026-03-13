-- AlterTable: Add companyId to Tenant for webhook/cron tenant resolution
ALTER TABLE "Tenant" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_companyId_key" ON "Tenant"("companyId");
