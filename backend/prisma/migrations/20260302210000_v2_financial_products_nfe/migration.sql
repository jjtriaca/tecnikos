-- =============================================
-- v2.0 — Financeiro Completo + Produtos + NFe
-- =============================================

-- CreateEnum: InstallmentStatus
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED');

-- AlterTable: FinancialEntry — campos de parcelas, juros e renegociação
ALTER TABLE "FinancialEntry" ADD COLUMN "installmentCount" INTEGER;
ALTER TABLE "FinancialEntry" ADD COLUMN "interestType" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "interestRateMonthly" DOUBLE PRECISION;
ALTER TABLE "FinancialEntry" ADD COLUMN "penaltyPercent" DOUBLE PRECISION;
ALTER TABLE "FinancialEntry" ADD COLUMN "penaltyFixedCents" INTEGER;
ALTER TABLE "FinancialEntry" ADD COLUMN "parentEntryId" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "renegotiatedAt" TIMESTAMP(3);
ALTER TABLE "FinancialEntry" ADD COLUMN "renegotiatedToId" TEXT;

-- CreateIndex: parentEntryId
CREATE INDEX "FinancialEntry_parentEntryId_idx" ON "FinancialEntry"("parentEntryId");

-- AddForeignKey: self-relations para renegociação
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_parentEntryId_fkey" FOREIGN KEY ("parentEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_renegotiatedToId_fkey" FOREIGN KEY ("renegotiatedToId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: FinancialInstallment
CREATE TABLE "FinancialInstallment" (
    "id" TEXT NOT NULL,
    "financialEntryId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "interestCents" INTEGER NOT NULL DEFAULT 0,
    "penaltyCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidAmountCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInstallment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialInstallment_financialEntryId_installmentNumber_key" ON "FinancialInstallment"("financialEntryId", "installmentNumber");
CREATE INDEX "FinancialInstallment_financialEntryId_idx" ON "FinancialInstallment"("financialEntryId");
CREATE INDEX "FinancialInstallment_dueDate_status_idx" ON "FinancialInstallment"("dueDate", "status");
CREATE INDEX "FinancialInstallment_status_idx" ON "FinancialInstallment"("status");

ALTER TABLE "FinancialInstallment" ADD CONSTRAINT "FinancialInstallment_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: CollectionRule
CREATE TABLE "CollectionRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysAfterDue" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "messageTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CollectionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionRule_companyId_isActive_idx" ON "CollectionRule"("companyId", "isActive");
CREATE INDEX "CollectionRule_daysAfterDue_idx" ON "CollectionRule"("daysAfterDue");

ALTER TABLE "CollectionRule" ADD CONSTRAINT "CollectionRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: CollectionExecution
CREATE TABLE "CollectionExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "collectionRuleId" TEXT NOT NULL,
    "financialEntryId" TEXT,
    "installmentId" TEXT,
    "status" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "message" TEXT,
    "error" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionExecution_companyId_executedAt_idx" ON "CollectionExecution"("companyId", "executedAt");
CREATE INDEX "CollectionExecution_financialEntryId_idx" ON "CollectionExecution"("financialEntryId");
CREATE INDEX "CollectionExecution_installmentId_idx" ON "CollectionExecution"("installmentId");

-- CreateTable: Product
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "barcode" TEXT,
    "description" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "ncm" TEXT,
    "cest" TEXT,
    "origin" TEXT,
    "category" TEXT,
    "icmsRate" DOUBLE PRECISION,
    "ipiRate" DOUBLE PRECISION,
    "pisRate" DOUBLE PRECISION,
    "cofinsRate" DOUBLE PRECISION,
    "csosn" TEXT,
    "cfop" TEXT,
    "cst" TEXT,
    "cstPis" TEXT,
    "cstCofins" TEXT,
    "costCents" INTEGER,
    "salePriceCents" INTEGER,
    "profitMarginPercent" DOUBLE PRECISION,
    "lastPurchasePriceCents" INTEGER,
    "averageCostCents" INTEGER,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION,
    "maxStock" DOUBLE PRECISION,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_companyId_code_key" ON "Product"("companyId", "code");
CREATE INDEX "Product_companyId_deletedAt_idx" ON "Product"("companyId", "deletedAt");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_companyId_category_idx" ON "Product"("companyId", "category");

ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ProductEquivalent
CREATE TABLE "ProductEquivalent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "supplierDescription" TEXT,
    "lastPriceCents" INTEGER,
    "lastPurchaseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductEquivalent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductEquivalent_productId_supplierId_supplierCode_key" ON "ProductEquivalent"("productId", "supplierId", "supplierCode");
CREATE INDEX "ProductEquivalent_supplierId_supplierCode_idx" ON "ProductEquivalent"("supplierId", "supplierCode");

ALTER TABLE "ProductEquivalent" ADD CONSTRAINT "ProductEquivalent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductEquivalent" ADD CONSTRAINT "ProductEquivalent_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: NfeImport
CREATE TABLE "NfeImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeNumber" TEXT,
    "nfeSeries" TEXT,
    "nfeKey" TEXT,
    "issueDate" TIMESTAMP(3),
    "supplierId" TEXT,
    "supplierCnpj" TEXT,
    "supplierName" TEXT,
    "totalCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "financialEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfeImport_nfeKey_key" ON "NfeImport"("nfeKey");
CREATE INDEX "NfeImport_companyId_idx" ON "NfeImport"("companyId");
CREATE INDEX "NfeImport_nfeKey_idx" ON "NfeImport"("nfeKey");

ALTER TABLE "NfeImport" ADD CONSTRAINT "NfeImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: NfeImportItem
CREATE TABLE "NfeImportItem" (
    "id" TEXT NOT NULL,
    "nfeImportId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "productCode" TEXT,
    "description" TEXT,
    "ncm" TEXT,
    "cfop" TEXT,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitPriceCents" INTEGER,
    "totalCents" INTEGER,
    "productId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeImportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NfeImportItem_nfeImportId_idx" ON "NfeImportItem"("nfeImportId");

ALTER TABLE "NfeImportItem" ADD CONSTRAINT "NfeImportItem_nfeImportId_fkey" FOREIGN KEY ("nfeImportId") REFERENCES "NfeImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfeImportItem" ADD CONSTRAINT "NfeImportItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
