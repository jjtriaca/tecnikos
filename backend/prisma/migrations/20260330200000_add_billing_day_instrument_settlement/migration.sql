-- PaymentInstrument: billing cycle fields
ALTER TABLE "PaymentInstrument" ADD COLUMN "billingClosingDay" INTEGER;
ALTER TABLE "PaymentInstrument" ADD COLUMN "billingDueDay" INTEGER;

-- CardSettlement: denormalize paymentInstrumentId for easy filtering
ALTER TABLE "CardSettlement" ADD COLUMN "paymentInstrumentId" TEXT;

-- Index for filtering settlements by instrument
CREATE INDEX "CardSettlement_companyId_paymentInstrumentId_idx" ON "CardSettlement"("companyId", "paymentInstrumentId");
