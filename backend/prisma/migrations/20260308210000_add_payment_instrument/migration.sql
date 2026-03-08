-- CreateTable
CREATE TABLE "PaymentInstrument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "bankName" TEXT,
    "cashAccountId" TEXT,
    "details" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentInstrument_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "FinancialEntry" ADD COLUMN "paymentInstrumentId" TEXT;

-- CreateIndex
CREATE INDEX "PaymentInstrument_companyId_isActive_idx" ON "PaymentInstrument"("companyId", "isActive");
CREATE INDEX "PaymentInstrument_companyId_paymentMethodId_idx" ON "PaymentInstrument"("companyId", "paymentMethodId");

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_paymentInstrumentId_fkey" FOREIGN KEY ("paymentInstrumentId") REFERENCES "PaymentInstrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT "PaymentInstrument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT "PaymentInstrument_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT "PaymentInstrument_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
