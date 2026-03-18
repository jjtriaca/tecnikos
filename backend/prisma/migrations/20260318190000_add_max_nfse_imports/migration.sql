-- Plan: maxNfseImports
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxNfseImports" INTEGER NOT NULL DEFAULT 0;

-- Tenant: maxNfseImports snapshot
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "maxNfseImports" INTEGER NOT NULL DEFAULT 0;

-- Company: maxNfseImports effective limit
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxNfseImports" INTEGER NOT NULL DEFAULT 0;
