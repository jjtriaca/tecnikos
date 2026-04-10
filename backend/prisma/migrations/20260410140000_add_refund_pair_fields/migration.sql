-- Estorno/Devolucao PIX indevido (v1.08.86)
-- Adiciona suporte para par de estorno em BankStatementLine e FinancialEntry

-- BankStatementLine: self-FK para linha par + flag de estorno
ALTER TABLE "BankStatementLine"
  ADD COLUMN "refundPairLineId" TEXT,
  ADD COLUMN "isRefund" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BankStatementLine"
  ADD CONSTRAINT "BankStatementLine_refundPairLineId_fkey"
  FOREIGN KEY ("refundPairLineId") REFERENCES "BankStatementLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BankStatementLine_refundPairLineId_idx" ON "BankStatementLine"("refundPairLineId");

-- FinancialEntry: self-FK para entry par + flag de lancamento tecnico de estorno
ALTER TABLE "FinancialEntry"
  ADD COLUMN "refundPairEntryId" TEXT,
  ADD COLUMN "isRefundEntry" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "FinancialEntry"
  ADD CONSTRAINT "FinancialEntry_refundPairEntryId_fkey"
  FOREIGN KEY ("refundPairEntryId") REFERENCES "FinancialEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FinancialEntry_refundPairEntryId_idx" ON "FinancialEntry"("refundPairEntryId");
