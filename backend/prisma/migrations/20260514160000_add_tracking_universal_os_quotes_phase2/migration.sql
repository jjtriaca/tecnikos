-- v1.10.89 — Tracking universal Fase 2: OS, Orcamentos, Avaliacoes, Checklist
-- Migration ADITIVA, todos nullable. TenantMigrator sincroniza nos tenants
-- via information_schema + ADD COLUMN IF NOT EXISTS (ensureTrackingColumns).
--
-- IMPORTANTE:
--   - ServiceOrder ja tem createdByUserId / createdByName / deletedAt (legados v1.05.63/etc).
--   - Quote ja tem createdByUserId (NOT NULL legado, preservado) e deletedAt.
--   - Enum CreationSource ja foi criado em 20260514130000_add_tracking_universal_financial_entry.
-- Por isso, em ServiceOrder e Quote NAO adicionamos novamente o(s) campo(s) ja existentes.

-- ServiceOrder (createdByUserId, createdByName e deletedAt ja existem — NAO adicionar de novo)
ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- ServiceOrderItem
ALTER TABLE "ServiceOrderItem"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- ServiceOrderOffer
ALTER TABLE "ServiceOrderOffer"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- ServiceOrderEvent
ALTER TABLE "ServiceOrderEvent"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- ServiceOrderLedger
ALTER TABLE "ServiceOrderLedger"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- Quote (createdByUserId ja existe NOT NULL e deletedAt ja existe — NAO adicionar de novo)
ALTER TABLE "Quote"
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- QuoteItem
ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- QuoteAttachment
ALTER TABLE "QuoteAttachment"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- Evaluation
ALTER TABLE "Evaluation"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;

-- ChecklistResponse
ALTER TABLE "ChecklistResponse"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdVia" "CreationSource",
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;
