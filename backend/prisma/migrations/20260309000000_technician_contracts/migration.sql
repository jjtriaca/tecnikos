-- CreateTable
CREATE TABLE "TechnicianContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "token" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "contractContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "blockUntilAccepted" BOOLEAN NOT NULL DEFAULT true,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentVia" TEXT,
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedIp" TEXT,
    "acceptedUserAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianContract_token_key" ON "TechnicianContract"("token");
CREATE INDEX "TechnicianContract_companyId_idx" ON "TechnicianContract"("companyId");
CREATE INDEX "TechnicianContract_partnerId_idx" ON "TechnicianContract"("partnerId");
CREATE INDEX "TechnicianContract_token_idx" ON "TechnicianContract"("token");
CREATE INDEX "TechnicianContract_companyId_status_idx" ON "TechnicianContract"("companyId", "status");

-- AddForeignKey
ALTER TABLE "TechnicianContract" ADD CONSTRAINT "TechnicianContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicianContract" ADD CONSTRAINT "TechnicianContract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicianContract" ADD CONSTRAINT "TechnicianContract_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
