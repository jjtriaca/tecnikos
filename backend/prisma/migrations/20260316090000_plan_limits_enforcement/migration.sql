-- Plan limits enforcement: anti-fraud fields + chat IA access control

-- User: chat IA access toggle + anti-fraud cooldown
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatIAEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDeactivatedAt" TIMESTAMP(3);

-- Partner: anti-fraud cooldown for technicians
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "deactivationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "lastDeactivatedAt" TIMESTAMP(3);

-- Company: add maxTechnicians and maxAiMessages (propagated from Tenant snapshot)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxTechnicians" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxAiMessages" INTEGER NOT NULL DEFAULT 0;
