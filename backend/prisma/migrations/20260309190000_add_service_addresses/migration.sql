-- CreateTable
CREATE TABLE "ServiceAddress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cep" TEXT,
    "addressStreet" TEXT NOT NULL,
    "addressNumber" TEXT,
    "addressComp" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAddress_companyId_partnerId_idx" ON "ServiceAddress"("companyId", "partnerId");

-- CreateIndex
CREATE INDEX "ServiceAddress_companyId_active_idx" ON "ServiceAddress"("companyId", "active");

-- AddForeignKey
ALTER TABLE "ServiceAddress" ADD CONSTRAINT "ServiceAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAddress" ADD CONSTRAINT "ServiceAddress_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
