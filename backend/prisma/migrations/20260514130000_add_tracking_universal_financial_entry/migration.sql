-- v1.10.87 — Tracking universal: createdBy + updatedBy + createdVia + deletedBy
-- em FinancialEntry. Migration AIDITIVA, todos os campos nullable — registros
-- existentes ficam com null (UI mostra "—" ou "Sistema").
--
-- Enum CreationSource adicionado pela primeira vez. TenantMigrator sincroniza
-- a estrutura nos schemas tenant_* via ensureTrackingColumns.
--
-- Esta eh a primeira tabela financeira da Fase 1. Outras tabelas (FinancialInstallment,
-- AccountTransfer, CashAccount, etc.) seguirao em migrations subsequentes.

-- Cria enum CreationSource (se nao existir)
DO $$ BEGIN
  CREATE TYPE "CreationSource" AS ENUM (
    'MANUAL',
    'IMPORT_CSV',
    'IMPORT_OFX',
    'IMPORT_NFE_XML',
    'WEBHOOK_FOCUS',
    'WEBHOOK_ASAAS',
    'WEBHOOK_SICREDI',
    'WEBHOOK_META',
    'CRON',
    'CHAT_IA',
    'API_PUBLIC',
    'SYSTEM_SEED',
    'MIGRATION_BACKFILL'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FinancialEntry: 7 colunas novas (deletedAt ja existia)
ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;
