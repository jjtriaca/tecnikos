-- Migra Product.technicalSpecs.tipoEquipamento de "SOLAR" pra "COLETOR_SOLAR_PISCINA"
-- Roda em todos os tenants (schema_name LIKE 'tenant_%')
-- Uso: docker exec -i tecnikos_postgres psql -U tecnikos_user -d tecnikos < migrate-solar-to-coletor-solar-piscina.sql

DO $$
DECLARE
  schema_rec RECORD;
  updated_count INTEGER;
  total_updated INTEGER := 0;
BEGIN
  FOR schema_rec IN
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'
  LOOP
    EXECUTE format(
      'UPDATE %I."Product"
       SET "technicalSpecs" = jsonb_set("technicalSpecs"::jsonb, ''{tipoEquipamento}'', ''"COLETOR_SOLAR_PISCINA"'')
       WHERE "technicalSpecs"->>''tipoEquipamento'' = ''SOLAR''',
      schema_rec.schema_name
    );
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    total_updated := total_updated + updated_count;
    RAISE NOTICE 'Schema % — % produtos atualizados', schema_rec.schema_name, updated_count;
  END LOOP;
  RAISE NOTICE 'TOTAL: % produtos migrados SOLAR -> COLETOR_SOLAR_PISCINA', total_updated;
END $$;
