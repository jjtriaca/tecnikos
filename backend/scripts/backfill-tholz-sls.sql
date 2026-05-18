-- Backfill de specs tecnicas dos equipamentos Tholz X23 no tenant_sls.
-- F3 do Simulador de Aquecimento — popula technicalSpecs com kcalHNominal,
-- btuH, kwNominal, ratedInputPowerKW (consumo medio em kW), copAt50Capacity (COP),
-- e tipoEquipamento. Apos rodar, o auto-select de Bomba de Calor consegue escolher
-- o modelo certo via where: kcalHNominal >= calorNecessarioKcalH.
--
-- Fontes: TAB006 Tholz X23-3 (Nomenclatura + Specification air 15°C).
-- Rodar manualmente no Hetzner apos deploy F3:
--   docker exec -i tecnikos-postgres psql -U postgres -d tecnikos < backend/scripts/backfill-tholz-sls.sql
--
-- Idempotente: usa COALESCE pra preservar specs existentes e || merge no jsonb
-- pra atualizar apenas as keys novas.

SET search_path TO tenant_sls;

-- ==== COPs (TAB006 Specification rows 9, 10, 16, 17) ====
-- Cada modelo tem 3 COPs relevantes:
--   copMax       = COP maximo em condicao ideal (ar 26°C, carga baixa) — "marketing"
--   copAt50Air26 = COP em 50% capacidade, ar 26°C (verao tipico)
--   copAt50Air15 = COP em 50% capacidade, ar 15°C (inverno BR — USADO NO CALCULO)
-- O calculo de consumo usa copAt50Air15 (conservador, garante que estimativa nao subestime).

-- ==== Tholz X23-09C: 9.5 kW = 8168 Kcal/h = 30000 BTU/h ====
UPDATE "Product"
SET "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
  'kcalHNominal', 8168,
  'btuH', 30000,
  'kwNominal', 9.5,
  'ratedInputPowerKW', 0.97,
  'copMax', 22.8,
  'copAt50Air26', 14.6,
  'copAt50Air15', 7.2,
  'copCurveA', 16.553,
  'copCurveB', -38.9205,
  'copCurveC', 29.922,
  'tipoEquipamento', 'BOMBA_CALOR'
),
"poolType" = COALESCE("poolType", 'Bomba de Calor'),
"updatedAt" = NOW()
WHERE ("description" ILIKE '%X23-09C%' OR "description" ILIKE '%X23 09C%' OR ("description" ILIKE '%Tholz%' AND "description" ILIKE '%09%'))
  AND "deletedAt" IS NULL;

-- ==== Tholz X23-14C: 13.48 kW = 11590 Kcal/h = 50000 BTU/h ====
UPDATE "Product"
SET "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
  'kcalHNominal', 11590,
  'btuH', 50000,
  'kwNominal', 13.48,
  'ratedInputPowerKW', 0.955,
  'copMax', 22.5,
  'copAt50Air26', 14.5,
  'copAt50Air15', 7.3,
  'copCurveA', 15.947,
  'copCurveB', -37.8295,
  'copCurveC', 29.428,
  'tipoEquipamento', 'BOMBA_CALOR'
),
"poolType" = COALESCE("poolType", 'Bomba de Calor'),
"updatedAt" = NOW()
WHERE ("description" ILIKE '%X23-14C%' OR "description" ILIKE '%X23 14C%' OR ("description" ILIKE '%Tholz%' AND "description" ILIKE '%14%'))
  AND "deletedAt" IS NULL;

-- ==== Tholz X23-18C: 18.49 kW = 15901 Kcal/h = 65000 BTU/h ====
UPDATE "Product"
SET "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
  'kcalHNominal', 15901,
  'btuH', 65000,
  'kwNominal', 18.49,
  'ratedInputPowerKW', 1.465,
  'copMax', 16.4,
  'copAt50Air26', 13.5,
  'copAt50Air15', 7.0,
  'copCurveA', 0.8333,
  'copCurveB', -10.25,
  'copCurveC', 18.4167,
  'tipoEquipamento', 'BOMBA_CALOR'
),
"poolType" = COALESCE("poolType", 'Bomba de Calor'),
"updatedAt" = NOW()
WHERE ("description" ILIKE '%X23-18C%' OR "description" ILIKE '%X23 18C%' OR ("description" ILIKE '%Tholz%' AND "description" ILIKE '%18%'))
  AND "deletedAt" IS NULL;

-- ==== Tholz X23-26C: 25.5 kW = 21930 Kcal/h = 90000 BTU/h ====
UPDATE "Product"
SET "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
  'kcalHNominal', 21930,
  'btuH', 90000,
  'kwNominal', 25.5,
  'ratedInputPowerKW', 2.04,
  'copMax', 22.2,
  'copAt50Air26', 14.1,
  'copAt50Air15', 7.3,
  'copCurveA', 15.7955,
  'copCurveB', -38.0568,
  'copCurveC', 29.1795,
  'tipoEquipamento', 'BOMBA_CALOR'
),
"poolType" = COALESCE("poolType", 'Bomba de Calor'),
"updatedAt" = NOW()
WHERE ("description" ILIKE '%X23-26C%' OR "description" ILIKE '%X23 26C%' OR ("description" ILIKE '%Tholz%' AND "description" ILIKE '%26%'))
  AND "deletedAt" IS NULL;

-- ==== Tholz X23-40C: 40 kW = 34400 Kcal/h = 140000 BTU/h ====
UPDATE "Product"
SET "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
  'kcalHNominal', 34400,
  'btuH', 140000,
  'kwNominal', 40,
  'ratedInputPowerKW', 3.145,
  'copMax', 23.0,
  'copAt50Air26', 15.0,
  'copAt50Air15', 7.5,
  'copCurveA', 15.4924,
  'copCurveB', -37.5114,
  'copCurveC', 29.8826,
  'tipoEquipamento', 'BOMBA_CALOR'
),
"poolType" = COALESCE("poolType", 'Bomba de Calor'),
"updatedAt" = NOW()
WHERE ("description" ILIKE '%X23-40C%' OR "description" ILIKE '%X23 40C%' OR ("description" ILIKE '%Tholz%' AND "description" ILIKE '%40%'))
  AND "deletedAt" IS NULL;

-- ==== Resumo ====
SELECT
  COUNT(*) FILTER (WHERE "technicalSpecs"->>'tipoEquipamento' = 'BOMBA_CALOR') AS bombas_atualizadas,
  COUNT(*) AS total_produtos
FROM "Product"
WHERE "description" ILIKE '%Tholz%' AND "deletedAt" IS NULL;

SELECT
  id,
  description,
  "poolType",
  "technicalSpecs"->>'kcalHNominal' AS kcal_h,
  "technicalSpecs"->>'kwNominal' AS kw,
  "technicalSpecs"->>'tipoEquipamento' AS tipo
FROM "Product"
WHERE "description" ILIKE '%Tholz%' AND "deletedAt" IS NULL
ORDER BY ("technicalSpecs"->>'kcalHNominal')::int NULLS LAST;
