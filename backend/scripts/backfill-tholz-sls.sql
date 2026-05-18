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

-- ==== Tholz X23-09C: 9.5 kW = 8168 Kcal/h = 30000 BTU/h ====
UPDATE "Product"
SET "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
  'kcalHNominal', 8168,
  'btuH', 30000,
  'kwNominal', 9.5,
  'ratedInputPowerKW', 0.97,
  'copAt50Capacity', 7.2,
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
  'copAt50Capacity', 7.3,
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
  'copAt50Capacity', 7.0,
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
  'copAt50Capacity', 7.3,
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
  'copAt50Capacity', 7.5,
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
