-- Conciliacao auto-paga entries PENDING (v1.08.96)
-- Marcamos entries que foram mudados de PENDING->PAID pelo match da conciliacao,
-- para conseguir reverter corretamente no unmatch.

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "autoMarkedPaid" BOOLEAN NOT NULL DEFAULT false;
