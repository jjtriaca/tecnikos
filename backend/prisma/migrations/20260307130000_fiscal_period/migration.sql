-- Período Fiscal (Escrituração e Apuração)

CREATE TABLE IF NOT EXISTS "FiscalPeriod" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  -- Resumo quantitativo
  "totalNfeEntrada" INTEGER,
  "totalNfeSaida" INTEGER,
  "totalNfseEntrada" INTEGER,
  "totalNfseSaida" INTEGER,
  -- ICMS
  "icmsDebitoCents" INTEGER,
  "icmsCreditoCents" INTEGER,
  "icmsSaldoCents" INTEGER,
  "icmsStCents" INTEGER,
  -- IPI
  "ipiDebitoCents" INTEGER,
  "ipiCreditoCents" INTEGER,
  "ipiSaldoCents" INTEGER,
  -- PIS
  "pisDebitoCents" INTEGER,
  "pisCreditoCents" INTEGER,
  "pisSaldoCents" INTEGER,
  -- COFINS
  "cofinsDebitoCents" INTEGER,
  "cofinsCreditoCents" INTEGER,
  "cofinsSaldoCents" INTEGER,
  -- ISS
  "issDevidoCents" INTEGER,
  "issRetidoCents" INTEGER,
  -- Totais
  "totalEntradaCents" INTEGER,
  "totalSaidaCents" INTEGER,
  -- Controle
  "closedAt" TIMESTAMP(3),
  "closedByName" TEXT,
  "filedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "FiscalPeriod_companyId_year_month_key" ON "FiscalPeriod"("companyId", "year", "month");
CREATE INDEX IF NOT EXISTS "FiscalPeriod_companyId_status_idx" ON "FiscalPeriod"("companyId", "status");

-- Foreign key
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
