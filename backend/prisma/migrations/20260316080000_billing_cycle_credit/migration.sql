-- Billing cycle tracking, pro-rata credit, pending downgrade, and structured plan features

-- 1. Subscription: billing cycle + credit + pending downgrade
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "creditBalanceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingPlanAt" TIMESTAMP(3);

-- 2. Plan: structured feature fields (replacing free-text features array)
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxTechnicians" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxAiMessages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "supportLevel" TEXT NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "allModulesIncluded" BOOLEAN NOT NULL DEFAULT true;

-- 3. Tenant: grandfather snapshot fields
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "maxTechnicians" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "maxAiMessages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "supportLevel" TEXT NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "allModulesIncluded" BOOLEAN NOT NULL DEFAULT true;

-- 4. Populate existing plans with sensible defaults based on current data
-- Essencial (SLS current plan): 100 OS, 5 users
UPDATE "Plan" SET "maxTechnicians" = 0, "maxAiMessages" = 50, "supportLevel" = 'EMAIL', "allModulesIncluded" = false
WHERE "name" = 'Essencial' AND "maxTechnicians" = 0;

UPDATE "Plan" SET "maxTechnicians" = 0, "maxAiMessages" = 200, "supportLevel" = 'EMAIL_CHAT', "allModulesIncluded" = true
WHERE "name" = 'Profissional' AND "maxTechnicians" = 0;

UPDATE "Plan" SET "maxTechnicians" = 0, "maxAiMessages" = 0, "supportLevel" = 'PRIORITY', "allModulesIncluded" = true
WHERE "name" = 'Enterprise' AND "maxTechnicians" = 0;

-- 5. Snapshot current plan features to existing tenants (grandfather)
UPDATE "Tenant" t SET
  "maxTechnicians" = p."maxTechnicians",
  "maxAiMessages" = p."maxAiMessages",
  "supportLevel" = p."supportLevel",
  "allModulesIncluded" = p."allModulesIncluded"
FROM "Plan" p
WHERE t."planId" = p."id" AND t."planId" IS NOT NULL;

-- 6. Set billingCycle for existing subscriptions based on Asaas data
-- Default is MONTHLY which is correct for all current subscriptions
