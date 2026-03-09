-- Company: commission override settings
ALTER TABLE "Company" ADD COLUMN "commissionOverrideEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "commissionMinBps" INTEGER;
ALTER TABLE "Company" ADD COLUMN "commissionMaxBps" INTEGER;

-- ServiceOrder: per-OS commission + return visit
ALTER TABLE "ServiceOrder" ADD COLUMN "commissionBps" INTEGER;
ALTER TABLE "ServiceOrder" ADD COLUMN "techCommissionCents" INTEGER;
ALTER TABLE "ServiceOrder" ADD COLUMN "isReturn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceOrder" ADD COLUMN "returnPaidToTech" BOOLEAN NOT NULL DEFAULT true;
