-- Add transferMatchId FK on BankStatementLine for reconciliation as deposit/transfer
-- v1.09.44: deposito em dinheiro agora pode ser conciliado como AccountTransfer

ALTER TABLE "BankStatementLine"
  ADD COLUMN IF NOT EXISTS "transferMatchId" TEXT;

-- FK (ON DELETE SET NULL: se transfer for deletado, mantem linha sem vinculo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BankStatementLine_transferMatchId_fkey'
      AND table_name = 'BankStatementLine'
  ) THEN
    ALTER TABLE "BankStatementLine"
      ADD CONSTRAINT "BankStatementLine_transferMatchId_fkey"
      FOREIGN KEY ("transferMatchId") REFERENCES "AccountTransfer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for quick lookup by transfer
CREATE INDEX IF NOT EXISTS "BankStatementLine_transferMatchId_idx"
  ON "BankStatementLine"("transferMatchId");
