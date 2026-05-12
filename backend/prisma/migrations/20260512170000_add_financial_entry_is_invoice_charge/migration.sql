-- v1.10.76 — Encargo de fatura (juros, IOF, anuidade) distinguido de compras de cartao.
-- Default false mantem todas as entries existentes como compras normais.
ALTER TABLE "FinancialEntry" ADD COLUMN "isInvoiceCharge" BOOLEAN NOT NULL DEFAULT false;
