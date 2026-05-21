-- =============================================================================
-- Atualiza coletores Solis no tenant SLS com dados oficiais Procel/Inmetro PBE
-- (versao 16/12/2025) — modelos NEW TROPICOS 2000-6000 classe A + adiciona 1000
--
-- Fonte: tabela PBE Coletor Solar Piscina, Inmetro
-- https://www.gov.br/inmetro/pt-br/assuntos/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/equipamentos-de-aquecimento-solar-de-agua
--
-- Dados comuns a todos:
--   Fornecedor:       Solis Ind. e Com. de Aquecedor Solar S.A.
--   Marca:            Solis Solar
--   Aplicacao:        Piscina
--   Pressao:          196 kPa (~20 mca)
--   Data concessao:   28/11/2024
--
-- Modelos (todos linha NEW TROPICOS):
--   1000 — 1.1 m² — PMEe 95.8 kWh/mes·m² — 70.6% — classe B — reg 018132/2024
--   2000 — 2.2 m² — PMEe 102.3 — 73.2% — classe A — reg 018134/2024
--   3000 — 3.4 m² — PMEe 102.3 — 73.2% — classe A — reg 018134/2024
--   4000 — 4.5 m² — PMEe 102.3 — 73.2% — classe A — reg 018134/2024
--   5000 — 5.6 m² — PMEe 102.3 — 73.2% — classe A — reg 018134/2024
--   6000 — 6.7 m² — PMEe 102.3 — 73.2% — classe A — reg 018134/2024
--
-- ESCOPO DO UPDATE:
-- - description: rebatiza pra nomenclatura oficial Procel
-- - technicalSpecs (merge com existente): areaM2, kwhPorM2, eficiencia,
--   classeEficiencia, pressaoFuncionamentokPa,
--   tipoEquipamento (COLETOR_SOLAR_PISCINA pra organizacao)
-- - NAO altera: salePriceCents (preserva preco do operador), code, brand,
--   poolType, model, currentStock, useInSale, useInWork
-- =============================================================================

BEGIN;

-- ========== XLS-30194 (Trop 2,24m² → NEW TROPICOS 2000, 2.2m² classe A) ==========
UPDATE tenant_sls."Product"
SET
  description = 'Coletor Solar Solis NEW TROPICOS 2000 — 2,2m² (Procel A 73,2%)',
  "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
    'areaM2', 2.2,
    'kwhPorM2', 102.3,
    'eficiencia', 0.732,
    'classeEficiencia', 'A',
    'pressaoFuncionamentokPa', 196,
    'tipoEquipamento', 'COLETOR_SOLAR_PISCINA',
    'procelRegistro', '018134/2024',
    'procelDataConcessao', '2024-11-28'
  ),
  "updatedAt" = NOW()
WHERE code = 'XLS-30194';

-- ========== XLS-30152 (Trop 3,36m² → NEW TROPICOS 3000, 3.4m² classe A) ==========
UPDATE tenant_sls."Product"
SET
  description = 'Coletor Solar Solis NEW TROPICOS 3000 — 3,4m² (Procel A 73,2%)',
  "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
    'areaM2', 3.4,
    'kwhPorM2', 102.3,
    'eficiencia', 0.732,
    'classeEficiencia', 'A',
    'pressaoFuncionamentokPa', 196,
    'tipoEquipamento', 'COLETOR_SOLAR_PISCINA',
    'procelRegistro', '018134/2024',
    'procelDataConcessao', '2024-11-28'
  ),
  "updatedAt" = NOW()
WHERE code = 'XLS-30152';

-- ========== XLS-30195 (Trop 4,48m² → NEW TROPICOS 4000, 4.5m² classe A) ==========
UPDATE tenant_sls."Product"
SET
  description = 'Coletor Solar Solis NEW TROPICOS 4000 — 4,5m² (Procel A 73,2%)',
  "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
    'areaM2', 4.5,
    'kwhPorM2', 102.3,
    'eficiencia', 0.732,
    'classeEficiencia', 'A',
    'pressaoFuncionamentokPa', 196,
    'tipoEquipamento', 'COLETOR_SOLAR_PISCINA',
    'procelRegistro', '018134/2024',
    'procelDataConcessao', '2024-11-28'
  ),
  "updatedAt" = NOW()
WHERE code = 'XLS-30195';

-- ========== XLS-30196 (Trop 5,60m² → NEW TROPICOS 5000, 5.6m² classe A) ==========
UPDATE tenant_sls."Product"
SET
  description = 'Coletor Solar Solis NEW TROPICOS 5000 — 5,6m² (Procel A 73,2%)',
  "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
    'areaM2', 5.6,
    'kwhPorM2', 102.3,
    'eficiencia', 0.732,
    'classeEficiencia', 'A',
    'pressaoFuncionamentokPa', 196,
    'tipoEquipamento', 'COLETOR_SOLAR_PISCINA',
    'procelRegistro', '018134/2024',
    'procelDataConcessao', '2024-11-28'
  ),
  "updatedAt" = NOW()
WHERE code = 'XLS-30196';

-- ========== XLS-30197 (Trop 6,72m² → NEW TROPICOS 6000, 6.7m² classe A) ==========
UPDATE tenant_sls."Product"
SET
  description = 'Coletor Solar Solis NEW TROPICOS 6000 — 6,7m² (Procel A 73,2%)',
  "technicalSpecs" = COALESCE("technicalSpecs", '{}'::jsonb) || jsonb_build_object(
    'areaM2', 6.7,
    'kwhPorM2', 102.3,
    'eficiencia', 0.732,
    'classeEficiencia', 'A',
    'pressaoFuncionamentokPa', 196,
    'tipoEquipamento', 'COLETOR_SOLAR_PISCINA',
    'procelRegistro', '018134/2024',
    'procelDataConcessao', '2024-11-28'
  ),
  "updatedAt" = NOW()
WHERE code = 'XLS-30197';

-- ========== Verificacao antes do COMMIT ==========
SELECT
  code,
  description,
  "salePriceCents"/100.0 AS preco_reais,
  "technicalSpecs"->>'areaM2' AS area_m2,
  "technicalSpecs"->>'kwhPorM2' AS kwh_mes_m2,
  "technicalSpecs"->>'eficiencia' AS eficiencia,
  "technicalSpecs"->>'classeEficiencia' AS classe,
  "technicalSpecs"->>'pressaoFuncionamentokPa' AS pressao_kpa
FROM tenant_sls."Product"
WHERE code IN ('XLS-30194', 'XLS-30152', 'XLS-30195', 'XLS-30196', 'XLS-30197')
ORDER BY ("technicalSpecs"->>'areaM2')::float;

-- Se a verificacao acima estiver OK, descomente o COMMIT abaixo.
-- Caso contrario, ROLLBACK desfaz tudo.
-- COMMIT;
-- ROLLBACK;
