-- Taxas de Parcelamento por Meio de Pagamento (v1.09.04)
-- Substitui o cadastro separado de CardFeeRate (bandeira+tipo+parcelas) por faixas
-- embutidas direto no PaymentInstrument. CardFeeRate continua existindo no backend
-- para compatibilidade mas nao e mais usada pro lookup novo.

CREATE TABLE IF NOT EXISTS "PaymentInstrumentFeeRate" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId"            TEXT NOT NULL,
  "paymentInstrumentId"  TEXT NOT NULL,
  "installmentFrom"      INTEGER NOT NULL,
  "installmentTo"        INTEGER NOT NULL,
  "feePercent"           DOUBLE PRECISION NOT NULL,
  "receivingDays"        INTEGER,
  "sortOrder"            INTEGER NOT NULL DEFAULT 0,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"            TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "PaymentInstrumentFeeRate_companyId_idx"
  ON "PaymentInstrumentFeeRate"("companyId");

CREATE INDEX IF NOT EXISTS "PaymentInstrumentFeeRate_paymentInstrumentId_idx"
  ON "PaymentInstrumentFeeRate"("paymentInstrumentId");

CREATE INDEX IF NOT EXISTS "PaymentInstrumentFeeRate_pi_inst_idx"
  ON "PaymentInstrumentFeeRate"("paymentInstrumentId", "installmentFrom", "installmentTo");

-- FK: PaymentInstrument (so adiciona se nao existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInstrumentFeeRate_paymentInstrumentId_fkey'
  ) THEN
    ALTER TABLE "PaymentInstrumentFeeRate"
      ADD CONSTRAINT "PaymentInstrumentFeeRate_paymentInstrumentId_fkey"
      FOREIGN KEY ("paymentInstrumentId") REFERENCES "PaymentInstrument"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
