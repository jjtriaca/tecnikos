-- Add statement balance fields to BankStatement (v1.09.51)
-- Captura o saldo oficial do banco reportado no OFX pra permitir auditoria
-- de fechamento (comparar banco vs sistema na mesma data).

ALTER TABLE "BankStatement"
  ADD COLUMN IF NOT EXISTS "statementBalanceCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "statementBalanceDate" TIMESTAMP(3);
