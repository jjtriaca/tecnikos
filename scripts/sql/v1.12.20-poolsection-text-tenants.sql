-- v1.12.20 — Propaga a mudanca do PoolBudgetItem.poolSection enum -> TEXT
-- pra todos os schemas tenant_*. Tambem remove a coluna customSectionKey
-- (resquicio do v1.12.19, era a bandagem).
--
-- TenantMigratorService nao propaga ALTER COLUMN TYPE (so faz ADD COLUMN
-- e ADD ENUM VALUE), por isso este script eh manual.
--
-- USO:
--   docker exec -i tecnikos_postgres psql -U postgres -d tecnikos \
--     -f /tmp/v1.12.20-poolsection-text-tenants.sql
--
-- Idempotente: pode rodar varias vezes sem efeito colateral. Cada ALTER
-- verifica o estado antes via "DO $$ BEGIN ... EXCEPTION ... END $$".

DO $$
DECLARE
  tenant_schema text;
BEGIN
  FOR tenant_schema IN
    SELECT s.schema_name
    FROM information_schema.schemata s
    WHERE s.schema_name LIKE 'tenant_%'
    ORDER BY s.schema_name
  LOOP
    -- 1. Mudar poolSection de enum tenant_X."PoolSection" pra TEXT
    BEGIN
      EXECUTE format('ALTER TABLE %I."PoolBudgetItem" ALTER COLUMN "poolSection" DROP DEFAULT', tenant_schema);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] drop default: %', tenant_schema, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I."PoolBudgetItem" ALTER COLUMN "poolSection" TYPE TEXT USING "poolSection"::text', tenant_schema);
      RAISE NOTICE '[%] poolSection convertido pra TEXT', tenant_schema;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] type change: % (provavelmente ja eh TEXT)', tenant_schema, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I."PoolBudgetItem" ALTER COLUMN "poolSection" SET DEFAULT %L', tenant_schema, 'CONSTRUCAO');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] set default: %', tenant_schema, SQLERRM;
    END;

    -- 2. Drop indice de customSectionKey (se existir)
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS %I."PoolBudgetItem_budgetId_customSectionKey_sortOrder_idx"', tenant_schema);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] drop index: %', tenant_schema, SQLERRM;
    END;

    -- 3. Drop coluna customSectionKey (se existir)
    BEGIN
      EXECUTE format('ALTER TABLE %I."PoolBudgetItem" DROP COLUMN IF EXISTS "customSectionKey"', tenant_schema);
      RAISE NOTICE '[%] customSectionKey removido', tenant_schema;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] drop column: %', tenant_schema, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Concluido — todos os tenants atualizados';
END $$;
