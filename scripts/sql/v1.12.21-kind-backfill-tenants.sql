-- v1.12.21 — Backfill PoolBudgetItem.kind em todos os schemas tenant_*.
-- A migration Prisma adiciona a coluna com DEFAULT 'PRODUCT' (rodado tambem
-- pelo TenantMigratorService nos tenants). Mas items com serviceId vinculado
-- deveriam ser SERVICE — esse UPDATE corrige.
--
-- USO:
--   docker exec -i tecnikos_postgres psql -U tecnikos_user -d tecnikos_prod \
--     -f /tmp/v1.12.21-kind-backfill-tenants.sql
--
-- Idempotente: pode rodar varias vezes (UPDATE so afeta linhas que ainda
-- nao foram backfilladas).

DO $$
DECLARE
  tenant_schema text;
  updated_count integer;
BEGIN
  FOR tenant_schema IN
    SELECT s.schema_name
    FROM information_schema.schemata s
    WHERE s.schema_name LIKE 'tenant_%'
    ORDER BY s.schema_name
  LOOP
    -- Verifica se a coluna existe (o TenantMigratorService adiciona no startup do backend)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = tenant_schema
        AND table_name = 'PoolBudgetItem'
        AND column_name = 'kind'
    ) THEN
      RAISE NOTICE '[%] coluna kind nao existe ainda — TenantMigrator deve rodar primeiro', tenant_schema;
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE %I."PoolBudgetItem" SET "kind" = ''SERVICE'' WHERE "serviceId" IS NOT NULL AND "kind" = ''PRODUCT''',
      tenant_schema
    );
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '[%] backfill kind=SERVICE: % linhas atualizadas', tenant_schema, updated_count;
  END LOOP;
END $$;
