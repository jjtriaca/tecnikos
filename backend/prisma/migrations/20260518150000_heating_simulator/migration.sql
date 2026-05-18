-- v1.12.x — Simulador de Aquecimento (Trocador de Calor):
-- 1. Tabela EnergyTariff (per-tenant, tarifas de energia: kWh/GLP/GN)
-- 2. PoolBudget.heatingReport (Json cache do relatorio computado)
-- TenantMigrator sincroniza EnergyTariff nos schemas tenant_*.

-- ============ 1. EnergyTariff ============

CREATE TABLE IF NOT EXISTS "EnergyTariff" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kwhBRLCents" INTEGER NOT NULL DEFAULT 115,
  "glpKgBRLCents" INTEGER NOT NULL DEFAULT 850,
  "gnM3BRLCents" INTEGER NOT NULL DEFAULT 850,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EnergyTariff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EnergyTariff_companyId_isActive_idx"
  ON "EnergyTariff"("companyId", "isActive");

-- FK opcional (TenantMigrator nao replica FKs cross-schema; pra public schema apenas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EnergyTariff_companyId_fkey'
  ) THEN
    ALTER TABLE "EnergyTariff"
      ADD CONSTRAINT "EnergyTariff_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

-- ============ 2. PoolBudget.heatingReport ============

ALTER TABLE "PoolBudget"
  ADD COLUMN IF NOT EXISTS "heatingReport" JSONB;
