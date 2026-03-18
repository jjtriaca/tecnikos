-- CreateTable
CREATE TABLE "NfseServiceCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoNbs" TEXT,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'SERVICO',
    "aliquotaIss" DOUBLE PRECISION,
    "itemListaServico" TEXT,
    "codigoCnae" TEXT,
    "codigoTribMunicipal" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseServiceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfseServiceCode_companyId_active_idx" ON "NfseServiceCode"("companyId", "active");

-- CreateIndex
CREATE INDEX "NfseServiceCode_configId_idx" ON "NfseServiceCode"("configId");

-- AddForeignKey
ALTER TABLE "NfseServiceCode" ADD CONSTRAINT "NfseServiceCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfseServiceCode" ADD CONSTRAINT "NfseServiceCode_configId_fkey" FOREIGN KEY ("configId") REFERENCES "NfseConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
