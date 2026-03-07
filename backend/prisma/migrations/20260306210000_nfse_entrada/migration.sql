-- NFS-e de Entrada (Serviços Tomados)

CREATE TABLE IF NOT EXISTS "NfseEntrada" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "numero" TEXT,
  "codigoVerificacao" TEXT,
  "dataEmissao" TIMESTAMP(3),
  "competencia" TEXT,
  "layout" TEXT,
  "prestadorId" TEXT,
  "prestadorCnpjCpf" TEXT,
  "prestadorRazaoSocial" TEXT,
  "prestadorIm" TEXT,
  "prestadorMunicipio" TEXT,
  "prestadorUf" TEXT,
  "tomadorCnpj" TEXT,
  "itemListaServico" TEXT,
  "codigoCnae" TEXT,
  "codigoTribMunicipio" TEXT,
  "codigoTribNacional" TEXT,
  "discriminacao" TEXT,
  "municipioServico" TEXT,
  "naturezaOperacao" TEXT,
  "exigibilidadeIss" TEXT,
  "valorServicosCents" INTEGER,
  "valorDeducoesCents" INTEGER,
  "baseCalculoCents" INTEGER,
  "aliquotaIss" DOUBLE PRECISION,
  "issRetido" BOOLEAN NOT NULL DEFAULT false,
  "valorIssCents" INTEGER,
  "valorPisCents" INTEGER,
  "valorCofinsCents" INTEGER,
  "valorInssCents" INTEGER,
  "valorIrCents" INTEGER,
  "valorCsllCents" INTEGER,
  "outrasRetCents" INTEGER,
  "descontoIncondCents" INTEGER,
  "descontoCondCents" INTEGER,
  "valorLiquidoCents" INTEGER,
  "codigoObra" TEXT,
  "art" TEXT,
  "financialEntryId" TEXT,
  "obraId" TEXT,
  "xmlContent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NfseEntrada_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "NfseEntrada_companyId_idx" ON "NfseEntrada"("companyId");
CREATE INDEX IF NOT EXISTS "NfseEntrada_companyId_competencia_idx" ON "NfseEntrada"("companyId", "competencia");
CREATE INDEX IF NOT EXISTS "NfseEntrada_companyId_status_idx" ON "NfseEntrada"("companyId", "status");
CREATE INDEX IF NOT EXISTS "NfseEntrada_prestadorCnpjCpf_idx" ON "NfseEntrada"("prestadorCnpjCpf");

-- Foreign keys
ALTER TABLE "NfseEntrada" ADD CONSTRAINT "NfseEntrada_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfseEntrada" ADD CONSTRAINT "NfseEntrada_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
