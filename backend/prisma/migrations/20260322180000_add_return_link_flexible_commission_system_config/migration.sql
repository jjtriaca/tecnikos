-- CreateEnum
CREATE TYPE "CommissionRule" AS ENUM ('COMMISSION_ONLY', 'FIXED_ONLY', 'HIGHER', 'LOWER');

-- ServiceOrder: parentOrderId
ALTER TABLE "ServiceOrder" ADD COLUMN "parentOrderId" TEXT;
CREATE INDEX "ServiceOrder_parentOrderId_idx" ON "ServiceOrder"("parentOrderId");
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Service: flexible commission
ALTER TABLE "Service" ADD COLUMN "techFixedValueCents" INTEGER;
ALTER TABLE "Service" ADD COLUMN "commissionRule" "CommissionRule";

-- ServiceOrderItem: snapshot fields
ALTER TABLE "ServiceOrderItem" ADD COLUMN "techFixedValueCents" INTEGER;
ALTER TABLE "ServiceOrderItem" ADD COLUMN "commissionRule" "CommissionRule";

-- Company: systemConfig
ALTER TABLE "Company" ADD COLUMN "systemConfig" JSONB;
