-- ============================================================================
-- Migration: add_pool_module
-- Modulo Piscina/Obras (vertical do Tecnikos pra construcao de piscinas)
-- 11 modelos novos + 3 alteracoes (Company, Product, Service)
-- Origem: planilha .xlsm Juliano Piscinas
-- Documentacao: memory/project_modulo_piscina_tecnikos.md
-- ============================================================================

-- ============================ ENUMS ============================
CREATE TYPE "PoolSection" AS ENUM (
  'CONSTRUCAO', 'FILTRO', 'CASCATA', 'SPA', 'AQUECIMENTO',
  'ILUMINACAO', 'CASA_MAQUINAS', 'DISPOSITIVOS', 'ACIONAMENTOS',
  'BORDA_CALCADA', 'EXECUCAO', 'OUTROS'
);

CREATE TYPE "PoolBudgetStatus" AS ENUM (
  'RASCUNHO', 'ENVIADO', 'APROVADO', 'REJEITADO', 'CANCELADO', 'EXPIRADO'
);

CREATE TYPE "PoolProjectStatus" AS ENUM (
  'PLANEJADA', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA'
);

CREATE TYPE "PoolStageStatus" AS ENUM (
  'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'BLOQUEADA'
);

CREATE TYPE "PoolEntryType" AS ENUM (
  'MATERIAL', 'SERVICO', 'SUBEMPREITADA', 'FRETE', 'OUTRO'
);

CREATE TYPE "PoolPrintPageType" AS ENUM (
  'FIXED', 'DYNAMIC'
);

CREATE TYPE "PoolPrintDynamicType" AS ENUM (
  'COVER', 'BUDGET_SUMMARY', 'PRODUCTS_BY_SECTION', 'PHOTOS_GALLERY',
  'CALCULATIONS', 'TERMS_CONDITIONS', 'INSTALLMENTS', 'CUSTOM_TABLE'
);

-- ============================ ALTERACOES ============================
-- Toggle do modulo por tenant (default false: nao polui UI quem nao usa)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "poolModuleActive" BOOLEAN NOT NULL DEFAULT false;

-- Imagem do produto/servico pra layout automatico de impressao
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- ============================ TABELAS NOVAS ============================

-- 1. PoolCatalogConfig - 1:1 com Product OU Service (config pool especialista)
CREATE TABLE "PoolCatalogConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "poolSection" "PoolSection" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "poolFormula" JSONB,
    "poolCondition" JSONB,
    "technicalSpecs" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolCatalogConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PoolCatalogConfig_productId_key" ON "PoolCatalogConfig"("productId");
CREATE UNIQUE INDEX "PoolCatalogConfig_serviceId_key" ON "PoolCatalogConfig"("serviceId");
CREATE INDEX "PoolCatalogConfig_companyId_poolSection_isActive_idx" ON "PoolCatalogConfig"("companyId", "poolSection", "isActive");
CREATE INDEX "PoolCatalogConfig_companyId_displayOrder_idx" ON "PoolCatalogConfig"("companyId", "displayOrder");

-- 2. PoolBudgetTemplate - template editavel de etapas
CREATE TABLE "PoolBudgetTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PoolBudgetTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PoolBudgetTemplate_companyId_name_key" ON "PoolBudgetTemplate"("companyId", "name");
CREATE INDEX "PoolBudgetTemplate_companyId_isActive_idx" ON "PoolBudgetTemplate"("companyId", "isActive");

-- 3. PoolPrintLayout - layout de impressao (precisa existir antes do PoolBudget)
CREATE TABLE "PoolPrintLayout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "branding" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PoolPrintLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PoolPrintLayout_companyId_name_key" ON "PoolPrintLayout"("companyId", "name");
CREATE INDEX "PoolPrintLayout_companyId_isActive_idx" ON "PoolPrintLayout"("companyId", "isActive");

-- 4. PoolPrintPage - paginas dentro de um layout
CREATE TABLE "PoolPrintPage" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" "PoolPrintPageType" NOT NULL,
    "htmlContent" TEXT,
    "dynamicType" "PoolPrintDynamicType",
    "pageConfig" JSONB,
    "isConditional" BOOLEAN NOT NULL DEFAULT false,
    "conditionRule" JSONB,
    "pageBreak" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolPrintPage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoolPrintPage_layoutId_order_idx" ON "PoolPrintPage"("layoutId", "order");

-- 5. PoolBudget - orcamento de piscina
CREATE TABLE "PoolBudget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentBudgetId" TEXT,
    "status" "PoolBudgetStatus" NOT NULL DEFAULT 'RASCUNHO',
    "clientPartnerId" TEXT NOT NULL,
    "templateId" TEXT,
    "printLayoutId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "termsConditions" TEXT,
    "poolDimensions" JSONB NOT NULL,
    "environmentParams" JSONB,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "expiresAt" TIMESTAMP(3),
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER,
    "discountPercent" DOUBLE PRECISION,
    "taxesCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "publicToken" TEXT,
    "publicTokenExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentVia" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "approvedByType" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByName" TEXT,
    "rejectedReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByName" TEXT,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PoolBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PoolBudget_companyId_code_key" ON "PoolBudget"("companyId", "code");
CREATE UNIQUE INDEX "PoolBudget_publicToken_key" ON "PoolBudget"("publicToken");
CREATE INDEX "PoolBudget_companyId_status_deletedAt_idx" ON "PoolBudget"("companyId", "status", "deletedAt");
CREATE INDEX "PoolBudget_clientPartnerId_idx" ON "PoolBudget"("clientPartnerId");
CREATE INDEX "PoolBudget_publicToken_idx" ON "PoolBudget"("publicToken");
CREATE INDEX "PoolBudget_createdAt_idx" ON "PoolBudget"("createdAt");

-- 6. PoolBudgetItem - itens do orcamento
CREATE TABLE "PoolBudgetItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "catalogConfigId" TEXT,
    "productId" TEXT,
    "serviceId" TEXT,
    "poolSection" "PoolSection" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "qtyCalculated" DOUBLE PRECISION,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "isAutoCalculated" BOOLEAN NOT NULL DEFAULT true,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolBudgetItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoolBudgetItem_budgetId_poolSection_sortOrder_idx" ON "PoolBudgetItem"("budgetId", "poolSection", "sortOrder");

-- 7. PoolProject - obra (projeto/execucao)
CREATE TABLE "PoolProject" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "budgetId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "PoolProjectStatus" NOT NULL DEFAULT 'PLANEJADA',
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PoolProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PoolProject_budgetId_key" ON "PoolProject"("budgetId");
CREATE UNIQUE INDEX "PoolProject_companyId_code_key" ON "PoolProject"("companyId", "code");
CREATE INDEX "PoolProject_companyId_status_deletedAt_idx" ON "PoolProject"("companyId", "status", "deletedAt");
CREATE INDEX "PoolProject_customerId_idx" ON "PoolProject"("customerId");

-- 8. PoolProjectStage - etapas da obra
CREATE TABLE "PoolProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "poolSection" "PoolSection" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PoolStageStatus" NOT NULL DEFAULT 'PENDENTE',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolProjectStage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoolProjectStage_projectId_sortOrder_idx" ON "PoolProjectStage"("projectId", "sortOrder");

-- 9. PoolProjectEntry - lancamento livro caixa da obra
CREATE TABLE "PoolProjectEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT,
    "partnerId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DOUBLE PRECISION,
    "unitPriceCents" INTEGER,
    "totalCents" INTEGER NOT NULL,
    "type" "PoolEntryType" NOT NULL,
    "paymentMethod" TEXT,
    "invoiceNumber" TEXT,
    "reflectsInFinance" BOOLEAN NOT NULL DEFAULT false,
    "financialEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolProjectEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoolProjectEntry_projectId_date_idx" ON "PoolProjectEntry"("projectId", "date");
CREATE INDEX "PoolProjectEntry_budgetItemId_idx" ON "PoolProjectEntry"("budgetItemId");
CREATE INDEX "PoolProjectEntry_financialEntryId_idx" ON "PoolProjectEntry"("financialEntryId");

-- 10. PoolProjectPhoto - fotos da obra
CREATE TABLE "PoolProjectPhoto" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    CONSTRAINT "PoolProjectPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoolProjectPhoto_projectId_takenAt_idx" ON "PoolProjectPhoto"("projectId", "takenAt");

-- 11. PoolModuleConfig - config do tenant (defaults)
CREATE TABLE "PoolModuleConfig" (
    "companyId" TEXT NOT NULL,
    "defaultLayoutId" TEXT,
    "defaultTemplateId" TEXT,
    "defaultMarkup" DOUBLE PRECISION DEFAULT 0,
    "prefixBudget" TEXT NOT NULL DEFAULT 'ORCP',
    "prefixProject" TEXT NOT NULL DEFAULT 'OBR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolModuleConfig_pkey" PRIMARY KEY ("companyId")
);

-- ============================ FOREIGN KEYS ============================

-- PoolCatalogConfig
ALTER TABLE "PoolCatalogConfig" ADD CONSTRAINT "PoolCatalogConfig_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolCatalogConfig" ADD CONSTRAINT "PoolCatalogConfig_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolCatalogConfig" ADD CONSTRAINT "PoolCatalogConfig_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PoolBudgetTemplate
ALTER TABLE "PoolBudgetTemplate" ADD CONSTRAINT "PoolBudgetTemplate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PoolPrintLayout
ALTER TABLE "PoolPrintLayout" ADD CONSTRAINT "PoolPrintLayout_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PoolPrintPage
ALTER TABLE "PoolPrintPage" ADD CONSTRAINT "PoolPrintPage_layoutId_fkey"
  FOREIGN KEY ("layoutId") REFERENCES "PoolPrintLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PoolBudget
ALTER TABLE "PoolBudget" ADD CONSTRAINT "PoolBudget_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolBudget" ADD CONSTRAINT "PoolBudget_clientPartnerId_fkey"
  FOREIGN KEY ("clientPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolBudget" ADD CONSTRAINT "PoolBudget_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "PoolBudgetTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolBudget" ADD CONSTRAINT "PoolBudget_printLayoutId_fkey"
  FOREIGN KEY ("printLayoutId") REFERENCES "PoolPrintLayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolBudget" ADD CONSTRAINT "PoolBudget_parentBudgetId_fkey"
  FOREIGN KEY ("parentBudgetId") REFERENCES "PoolBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PoolBudgetItem
ALTER TABLE "PoolBudgetItem" ADD CONSTRAINT "PoolBudgetItem_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "PoolBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolBudgetItem" ADD CONSTRAINT "PoolBudgetItem_catalogConfigId_fkey"
  FOREIGN KEY ("catalogConfigId") REFERENCES "PoolCatalogConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolBudgetItem" ADD CONSTRAINT "PoolBudgetItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolBudgetItem" ADD CONSTRAINT "PoolBudgetItem_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PoolProject
ALTER TABLE "PoolProject" ADD CONSTRAINT "PoolProject_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolProject" ADD CONSTRAINT "PoolProject_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "PoolBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolProject" ADD CONSTRAINT "PoolProject_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PoolProjectStage
ALTER TABLE "PoolProjectStage" ADD CONSTRAINT "PoolProjectStage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "PoolProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PoolProjectEntry
ALTER TABLE "PoolProjectEntry" ADD CONSTRAINT "PoolProjectEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "PoolProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolProjectEntry" ADD CONSTRAINT "PoolProjectEntry_budgetItemId_fkey"
  FOREIGN KEY ("budgetItemId") REFERENCES "PoolBudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolProjectEntry" ADD CONSTRAINT "PoolProjectEntry_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolProjectEntry" ADD CONSTRAINT "PoolProjectEntry_financialEntryId_fkey"
  FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PoolProjectPhoto
ALTER TABLE "PoolProjectPhoto" ADD CONSTRAINT "PoolProjectPhoto_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "PoolProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PoolModuleConfig
ALTER TABLE "PoolModuleConfig" ADD CONSTRAINT "PoolModuleConfig_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
