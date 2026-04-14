-- Conciliacao N-para-1 de fatura de cartao (v1.08.95)
-- 1 linha do extrato (debito unico da fatura) agrupa N entries (compras feitas com o cartao no periodo)

-- FinancialEntry: nova FK opcional para a linha do extrato que consolida esta compra
ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "invoiceMatchLineId" TEXT;

ALTER TABLE "FinancialEntry"
  ADD CONSTRAINT "FinancialEntry_invoiceMatchLineId_fkey"
  FOREIGN KEY ("invoiceMatchLineId") REFERENCES "BankStatementLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FinancialEntry_invoiceMatchLineId_idx"
  ON "FinancialEntry"("invoiceMatchLineId");

-- BankStatementLine: flag que identifica linhas conciliadas como fatura de cartao (N entries vinculados)
ALTER TABLE "BankStatementLine"
  ADD COLUMN IF NOT EXISTS "isCardInvoice" BOOLEAN NOT NULL DEFAULT false;
