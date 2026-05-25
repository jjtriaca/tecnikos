-- v1.12.20 — Abandona o enum PoolSection no PoolBudgetItem.poolSection.
-- Etapa virou conceito livre: o operador pode criar etapas customizadas
-- com chaves quaisquer (CUSTOM_<slug>_<rand>) e elas funcionam identicas
-- as 12 etapas padrao (CONSTRUCAO, FILTRO, etc) em fórmulas, siblings,
-- agrupamento e tudo mais. Sem distincao tecnica entre padrao e custom.
--
-- Tambem remove a coluna customSectionKey adicionada em v1.12.19 (era a
-- bandagem agora obsoleta). Reverte o indice associado.
--
-- IMPORTANTE: o enum PoolSection PERMANECE no banco — outros models
-- (PoolCatalogConfig.poolSection, PoolProjectStage.poolSection) ainda
-- referenciam ele. So o PoolBudgetItem migra pra TEXT.
--
-- Pra tenants: rodar scripts/sql/v1.12.20-poolsection-text-tenants.sql
-- apos o deploy. O TenantMigratorService nao propaga ALTER COLUMN TYPE
-- (so faz ADD COLUMN e ADD ENUM VALUE).

ALTER TABLE "PoolBudgetItem" ALTER COLUMN "poolSection" DROP DEFAULT;
ALTER TABLE "PoolBudgetItem" ALTER COLUMN "poolSection" TYPE TEXT USING "poolSection"::text;
ALTER TABLE "PoolBudgetItem" ALTER COLUMN "poolSection" SET DEFAULT 'CONSTRUCAO';

DROP INDEX IF EXISTS "PoolBudgetItem_budgetId_customSectionKey_sortOrder_idx";

ALTER TABLE "PoolBudgetItem" DROP COLUMN IF EXISTS "customSectionKey";
