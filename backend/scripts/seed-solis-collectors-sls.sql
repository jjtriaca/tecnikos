-- Seed dos 5 coletores Solis Tropicos no tenant_sls (Fase 7 do Sprint Simulador Solar).
-- Cada coletor entra como Product novo com technicalSpecs.tipoEquipamento='SOLAR' +
-- areaM2, kwhPorM2, eficiencia (lidos pelo SolarBudgetService.listSolarCollectors).
--
-- Idempotente: ON CONFLICT (companyId, code) DO NOTHING — re-rodar nao duplica.
-- Os precos sao PLACEHOLDER — operador ajusta em /products apos importar.
--
-- Rodar manualmente apos deploy:
--   docker exec -i tecnikos_postgres psql -U tecnikos_user -d tecnikos < backend/scripts/seed-solis-collectors-sls.sql
--
-- Fonte: Planilha original (Tabela69 da aba CALCULOS_SOLAR de ANDREIA SANTANA).

SET search_path TO tenant_sls;

-- Helper: descobre companyId da unica empresa do tenant_sls
DO $$
DECLARE
  v_company_id TEXT;
BEGIN
  SELECT id INTO v_company_id FROM "Company" LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Nenhuma Company no tenant_sls — abortando seed';
    RETURN;
  END IF;

  -- ==== Solis 2.00x1.12 — 2.24 m² ====
  INSERT INTO "Product" (
    id, "companyId", code, description, model, unit, "salePriceCents",
    "useInSale", "useInWork", status, "technicalSpecs", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_company_id, 'SOL-200',
    'Coletor solar Solis 2,00x1,12 2,24m²', 'Solis 2.00', 'UN', 35000,
    false, true, 'ATIVO',
    jsonb_build_object(
      'tipoEquipamento', 'SOLAR',
      'areaM2', 2.24,
      'kwhPorM2', 95.8,
      'eficiencia', 0.706,
      'comprimentoCm', 200, 'larguraCm', 112
    ),
    NOW(), NOW()
  )
  ON CONFLICT ("companyId", code) DO NOTHING;

  -- ==== Solis 3.00x1.12 — 3.36 m² ====
  INSERT INTO "Product" (
    id, "companyId", code, description, model, unit, "salePriceCents",
    "useInSale", "useInWork", status, "technicalSpecs", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_company_id, 'SOL-300',
    'Coletor solar Solis 3,00x1,12 3,36m²', 'Solis 3.00', 'UN', 48000,
    false, true, 'ATIVO',
    jsonb_build_object(
      'tipoEquipamento', 'SOLAR',
      'areaM2', 3.36,
      'kwhPorM2', 102.3,
      'eficiencia', 0.732,
      'comprimentoCm', 300, 'larguraCm', 112
    ),
    NOW(), NOW()
  )
  ON CONFLICT ("companyId", code) DO NOTHING;

  -- ==== Solis 4.00x1.12 — 4.48 m² (modelo mais comum) ====
  INSERT INTO "Product" (
    id, "companyId", code, description, model, unit, "salePriceCents",
    "useInSale", "useInWork", status, "technicalSpecs", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_company_id, 'SOL-400',
    'Coletor solar Solis 4,00x1,12 4,48m²', 'Solis 4.00', 'UN', 62000,
    false, true, 'ATIVO',
    jsonb_build_object(
      'tipoEquipamento', 'SOLAR',
      'areaM2', 4.48,
      'kwhPorM2', 102.3,
      'eficiencia', 0.732,
      'comprimentoCm', 400, 'larguraCm', 112
    ),
    NOW(), NOW()
  )
  ON CONFLICT ("companyId", code) DO NOTHING;

  -- ==== Solis 5.00x1.12 — 5.60 m² ====
  INSERT INTO "Product" (
    id, "companyId", code, description, model, unit, "salePriceCents",
    "useInSale", "useInWork", status, "technicalSpecs", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_company_id, 'SOL-500',
    'Coletor solar Solis 5,00x1,12 5,60m²', 'Solis 5.00', 'UN', 78000,
    false, true, 'ATIVO',
    jsonb_build_object(
      'tipoEquipamento', 'SOLAR',
      'areaM2', 5.60,
      'kwhPorM2', 102.3,
      'eficiencia', 0.732,
      'comprimentoCm', 500, 'larguraCm', 112
    ),
    NOW(), NOW()
  )
  ON CONFLICT ("companyId", code) DO NOTHING;

  -- ==== Solis 6.00x1.12 — 6.72 m² ====
  INSERT INTO "Product" (
    id, "companyId", code, description, model, unit, "salePriceCents",
    "useInSale", "useInWork", status, "technicalSpecs", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_company_id, 'SOL-600',
    'Coletor solar Solis 6,00x1,12 6,72m²', 'Solis 6.00', 'UN', 92000,
    false, true, 'ATIVO',
    jsonb_build_object(
      'tipoEquipamento', 'SOLAR',
      'areaM2', 6.72,
      'kwhPorM2', 102.3,
      'eficiencia', 0.732,
      'comprimentoCm', 600, 'larguraCm', 112
    ),
    NOW(), NOW()
  )
  ON CONFLICT ("companyId", code) DO NOTHING;

  RAISE NOTICE 'Seed Solis: 5 coletores processados (idempotente)';
END $$;

-- Conferencia
SELECT code, description, "salePriceCents" / 100.0 AS preco_brl,
       "technicalSpecs"->>'areaM2' AS area_m2,
       "technicalSpecs"->>'eficiencia' AS eficiencia,
       "technicalSpecs"->>'tipoEquipamento' AS tipo
FROM "Product"
WHERE "technicalSpecs"->>'tipoEquipamento' = 'SOLAR'
ORDER BY ("technicalSpecs"->>'areaM2')::float;
