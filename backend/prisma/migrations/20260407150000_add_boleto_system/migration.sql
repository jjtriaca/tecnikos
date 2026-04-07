-- CreateEnum
CREATE TYPE "BoletoStatus" AS ENUM ('DRAFT', 'REGISTERING', 'REGISTERED', 'REJECTED', 'PAID', 'OVERDUE', 'CANCELLED', 'PROTESTED', 'WRITTEN_OFF');

-- CreateTable
CREATE TABLE "BoletoConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "cashAccountId" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "apiKey" TEXT,
    "certificateBase64" TEXT,
    "certificatePassword" TEXT,
    "bankSpecificConfig" JSONB,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "convenio" TEXT,
    "carteira" TEXT,
    "especie" TEXT NOT NULL DEFAULT 'R$',
    "especieDoc" TEXT NOT NULL DEFAULT 'DM',
    "aceite" TEXT NOT NULL DEFAULT 'N',
    "defaultInterestType" TEXT,
    "defaultInterestValue" DOUBLE PRECISION,
    "defaultPenaltyPercent" DOUBLE PRECISION,
    "defaultDiscountType" TEXT,
    "defaultDiscountValue" DOUBLE PRECISION,
    "defaultDiscountDaysBefore" INTEGER,
    "defaultInstructions1" TEXT,
    "defaultInstructions2" TEXT,
    "defaultInstructions3" TEXT,
    "autoRegisterOnEntry" BOOLEAN NOT NULL DEFAULT false,
    "nextNossoNumero" INTEGER NOT NULL DEFAULT 1,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoletoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boleto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "boletoConfigId" TEXT NOT NULL,
    "financialEntryId" TEXT,
    "installmentId" TEXT,
    "partnerId" TEXT,
    "nossoNumero" TEXT NOT NULL,
    "seuNumero" TEXT,
    "linhaDigitavel" TEXT,
    "codigoBarras" TEXT,
    "pixCopiaECola" TEXT,
    "amountCents" INTEGER NOT NULL,
    "interestCents" INTEGER NOT NULL DEFAULT 0,
    "penaltyCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "payerName" TEXT NOT NULL,
    "payerDocument" TEXT NOT NULL,
    "payerDocumentType" TEXT NOT NULL,
    "payerAddress" TEXT,
    "payerCity" TEXT,
    "payerState" TEXT,
    "payerCep" TEXT,
    "status" "BoletoStatus" NOT NULL DEFAULT 'DRAFT',
    "bankProtocol" TEXT,
    "bankResponse" JSONB,
    "errorMessage" TEXT,
    "pdfUrl" TEXT,
    "interestType" TEXT,
    "interestValue" DOUBLE PRECISION,
    "penaltyPercent" DOUBLE PRECISION,
    "discountType" TEXT,
    "discountValue" DOUBLE PRECISION,
    "discountDeadline" TIMESTAMP(3),
    "instructions1" TEXT,
    "instructions2" TEXT,
    "instructions3" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boleto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoletoConfig_companyId_key" ON "BoletoConfig"("companyId");

-- CreateIndex
CREATE INDEX "BoletoConfig_companyId_idx" ON "BoletoConfig"("companyId");

-- CreateIndex
CREATE INDEX "Boleto_companyId_status_idx" ON "Boleto"("companyId", "status");

-- CreateIndex
CREATE INDEX "Boleto_financialEntryId_idx" ON "Boleto"("financialEntryId");

-- CreateIndex
CREATE INDEX "Boleto_installmentId_idx" ON "Boleto"("installmentId");

-- CreateIndex
CREATE INDEX "Boleto_dueDate_status_idx" ON "Boleto"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Boleto_partnerId_idx" ON "Boleto"("partnerId");

-- CreateIndex
CREATE INDEX "Boleto_boletoConfigId_idx" ON "Boleto"("boletoConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "Boleto_companyId_nossoNumero_boletoConfigId_key" ON "Boleto"("companyId", "nossoNumero", "boletoConfigId");

-- AddForeignKey
ALTER TABLE "BoletoConfig" ADD CONSTRAINT "BoletoConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoletoConfig" ADD CONSTRAINT "BoletoConfig_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_boletoConfigId_fkey" FOREIGN KEY ("boletoConfigId") REFERENCES "BoletoConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "FinancialInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
