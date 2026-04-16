-- Add receivedCardLast4 (4 digitos do cartao do cliente em recebimentos via cartao)
-- v1.09.48: captura os 4 ultimos digitos do cartao do pagador no lancamento financeiro

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "receivedCardLast4" TEXT;
