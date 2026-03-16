-- Remove global commission fields from Company
-- Commission is now defined per Service only
ALTER TABLE "Company" DROP COLUMN IF EXISTS "commissionBps";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "commissionOverrideEnabled";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "commissionMinBps";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "commissionMaxBps";
