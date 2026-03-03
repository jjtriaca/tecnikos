-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('CAIXA', 'BANCO');
CREATE TYPE "BankAccountType" AS ENUM ('CORRENTE', 'POUPANCA');
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA');
CREATE TYPE "StatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- CreateTable: PaymentMethod
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "feePercent" DOUBLE PRECISION,
    "receivingDays" INTEGER,
    "requiresBrand" BOOLEAN NOT NULL DEFAULT false,
    "requiresCheckData" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CashAccount
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "bankCode" TEXT,
    "bankName" TEXT,
    "agency" TEXT,
    "accountNumber" TEXT,
    "accountType" "BankAccountType",
    "pixKeyType" "PixKeyType",
    "pixKey" TEXT,
    "initialBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "currentBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountTransfer
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BankStatementImport
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByName" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BankStatementLine
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "fitId" TEXT,
    "checkNum" TEXT,
    "refNum" TEXT,
    "status" "StatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedEntryId" TEXT,
    "matchedInstallmentId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable: FinancialEntry
ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "cashAccountId" TEXT;

-- CreateIndexes
CREATE UNIQUE INDEX "PaymentMethod_companyId_code_key" ON "PaymentMethod"("companyId", "code");
CREATE INDEX "PaymentMethod_companyId_isActive_idx" ON "PaymentMethod"("companyId", "isActive");
CREATE INDEX "CashAccount_companyId_isActive_idx" ON "CashAccount"("companyId", "isActive");
CREATE INDEX "CashAccount_companyId_type_idx" ON "CashAccount"("companyId", "type");
CREATE INDEX "AccountTransfer_companyId_transferDate_idx" ON "AccountTransfer"("companyId", "transferDate");
CREATE INDEX "AccountTransfer_fromAccountId_idx" ON "AccountTransfer"("fromAccountId");
CREATE INDEX "AccountTransfer_toAccountId_idx" ON "AccountTransfer"("toAccountId");
CREATE INDEX "BankStatementImport_companyId_idx" ON "BankStatementImport"("companyId");
CREATE INDEX "BankStatementImport_cashAccountId_idx" ON "BankStatementImport"("cashAccountId");
CREATE INDEX "BankStatementLine_importId_idx" ON "BankStatementLine"("importId");
CREATE INDEX "BankStatementLine_cashAccountId_transactionDate_idx" ON "BankStatementLine"("cashAccountId", "transactionDate");
CREATE INDEX "BankStatementLine_status_idx" ON "BankStatementLine"("status");
CREATE INDEX "FinancialEntry_paymentMethodId_idx" ON "FinancialEntry"("paymentMethodId");
CREATE INDEX "FinancialEntry_cashAccountId_idx" ON "FinancialEntry"("cashAccountId");

-- AddForeignKeys
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
