-- NFS-e Emission Module (v3.0)

-- NfseConfig: configurações fiscais por empresa
CREATE TABLE "NfseConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "focusNfeToken" TEXT,
    "focusNfeEnvironment" TEXT NOT NULL DEFAULT 'HOMOLOGATION',
    "focusNfeCompanyId" TEXT,
    "inscricaoMunicipal" TEXT,
    "codigoMunicipio" TEXT,
    "naturezaOperacao" TEXT NOT NULL DEFAULT '1',
    "regimeEspecialTributacao" TEXT,
    "optanteSimplesNacional" BOOLEAN NOT NULL DEFAULT false,
    "itemListaServico" TEXT,
    "codigoCnae" TEXT,
    "codigoTributarioMunicipio" TEXT,
    "aliquotaIss" DOUBLE PRECISION,
    "askOnFinishOS" BOOLEAN NOT NULL DEFAULT true,
    "receiveWithoutNfse" TEXT NOT NULL DEFAULT 'WARN',
    "sendEmailToTomador" BOOLEAN NOT NULL DEFAULT true,
    "rpsSeries" TEXT NOT NULL DEFAULT 'A',
    "rpsNextNumber" INTEGER NOT NULL DEFAULT 1,
    "defaultDiscriminacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfseConfig_companyId_key" ON "NfseConfig"("companyId");

-- NfseEmission: cada nota emitida
CREATE TABLE "NfseEmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "rpsNumber" INTEGER NOT NULL,
    "rpsSeries" TEXT NOT NULL,
    "nfseNumber" TEXT,
    "codigoVerificacao" TEXT,
    "focusNfeRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "prestadorCnpj" TEXT NOT NULL,
    "prestadorIm" TEXT,
    "prestadorCodigoMunicipio" TEXT,
    "tomadorCnpjCpf" TEXT,
    "tomadorRazaoSocial" TEXT,
    "tomadorEmail" TEXT,
    "valorServicos" INTEGER NOT NULL,
    "aliquotaIss" DOUBLE PRECISION,
    "issRetido" BOOLEAN NOT NULL DEFAULT false,
    "valorIss" INTEGER,
    "itemListaServico" TEXT,
    "codigoCnae" TEXT,
    "discriminacao" TEXT,
    "codigoMunicipioServico" TEXT,
    "naturezaOperacao" TEXT,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseEmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfseEmission_focusNfeRef_key" ON "NfseEmission"("focusNfeRef");
CREATE INDEX "NfseEmission_companyId_status_idx" ON "NfseEmission"("companyId", "status");
CREATE INDEX "NfseEmission_serviceOrderId_idx" ON "NfseEmission"("serviceOrderId");
CREATE INDEX "NfseEmission_focusNfeRef_idx" ON "NfseEmission"("focusNfeRef");

-- Campos NFS-e no FinancialEntry
ALTER TABLE "FinancialEntry" ADD COLUMN "nfseStatus" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "nfseEmissionId" TEXT;
CREATE INDEX "FinancialEntry_nfseEmissionId_idx" ON "FinancialEntry"("nfseEmissionId");

-- Foreign Keys
ALTER TABLE "NfseConfig" ADD CONSTRAINT "NfseConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfseEmission" ADD CONSTRAINT "NfseEmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfseEmission" ADD CONSTRAINT "NfseEmission_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_nfseEmissionId_fkey" FOREIGN KEY ("nfseEmissionId") REFERENCES "NfseEmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
