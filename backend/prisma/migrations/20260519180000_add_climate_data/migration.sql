-- ClimateData: dados climaticos por UF/cidade pro Simulador de Aquecimento
-- monthlyData JSONB armazena { temp: number[12], humidity: number[12], radSol: number[12] }
-- cidade=NULL = padrao do estado (capital). UNIQUE composto suporta capital + cidades-polo.
CREATE TABLE "ClimateData" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "cidade" TEXT,
    "ufName" TEXT NOT NULL,
    "monthlyData" JSONB NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimateData_pkey" PRIMARY KEY ("id")
);

-- UNIQUE composto: nao deixa duplicar (uf, cidade) por tenant.
-- NULL em cidade representa capital/padrao do estado.
CREATE UNIQUE INDEX "ClimateData_companyId_uf_cidade_key" ON "ClimateData"("companyId", "uf", "cidade");

CREATE INDEX "ClimateData_companyId_uf_isActive_idx" ON "ClimateData"("companyId", "uf", "isActive");

ALTER TABLE "ClimateData" ADD CONSTRAINT "ClimateData_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
