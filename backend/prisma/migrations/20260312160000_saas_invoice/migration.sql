-- CreateTable: SaasInvoice
CREATE TABLE "SaasInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "asaasInvoiceId" TEXT,
    "asaasPaymentId" TEXT,
    "asaasCustomerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "value" DOUBLE PRECISION NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "observations" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "rpsNumber" INTEGER,
    "invoiceNumber" TEXT,
    "iss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cofins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "csll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ir" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retainIss" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SaasInvoiceConfig
CREATE TABLE "SaasInvoiceConfig" (
    "id" TEXT NOT NULL,
    "autoEmitOnPayment" BOOLEAN NOT NULL DEFAULT false,
    "municipalServiceId" TEXT,
    "municipalServiceCode" TEXT,
    "municipalServiceName" TEXT,
    "defaultIss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultCofins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultCsll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultInss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultIr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultPis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultRetainIss" BOOLEAN NOT NULL DEFAULT false,
    "serviceDescriptionTemplate" TEXT NOT NULL DEFAULT 'Licenciamento de software SaaS - Plano {plano} - {empresa}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasInvoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasInvoice_asaasInvoiceId_key" ON "SaasInvoice"("asaasInvoiceId");
CREATE INDEX "SaasInvoice_tenantId_idx" ON "SaasInvoice"("tenantId");
CREATE INDEX "SaasInvoice_status_idx" ON "SaasInvoice"("status");
CREATE INDEX "SaasInvoice_asaasInvoiceId_idx" ON "SaasInvoice"("asaasInvoiceId");

-- AddForeignKey
ALTER TABLE "SaasInvoice" ADD CONSTRAINT "SaasInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
