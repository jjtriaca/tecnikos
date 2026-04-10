-- Fix tenant_sls: corrige migration 20260410180000 que nao sincronizou
-- Adiciona statementId em BankStatementLine, popula BankStatement, faz backfill

SET search_path TO tenant_sls;

-- 1. Adicionar coluna statementId em BankStatementLine (idempotente)
ALTER TABLE "BankStatementLine" ADD COLUMN IF NOT EXISTS "statementId" TEXT;
CREATE INDEX IF NOT EXISTS "BankStatementLine_statementId_idx" ON "BankStatementLine"("statementId");

-- 2. Popular BankStatement agrupando linhas existentes por conta+mes (Brazil TZ)
INSERT INTO "BankStatement" (
  "id", "companyId", "cashAccountId", "periodYear", "periodMonth",
  "lineCount", "matchedCount",
  "lastImportAt", "lastImportByName", "lastFileName",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  imp."companyId",
  line."cashAccountId",
  EXTRACT(YEAR FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')::int,
  EXTRACT(MONTH FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')::int,
  COUNT(*)::int,
  COUNT(*) FILTER (WHERE line."status" = 'MATCHED')::int,
  MAX(imp."importedAt"),
  (ARRAY_AGG(imp."importedByName" ORDER BY imp."importedAt" DESC))[1],
  (ARRAY_AGG(imp."fileName" ORDER BY imp."importedAt" DESC))[1],
  NOW(),
  NOW()
FROM "BankStatementLine" line
JOIN "BankStatementImport" imp ON line."importId" = imp."id"
GROUP BY
  imp."companyId",
  line."cashAccountId",
  EXTRACT(YEAR FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo'),
  EXTRACT(MONTH FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')
ON CONFLICT ("cashAccountId", "periodYear", "periodMonth") DO NOTHING;

-- 3. Backfill statementId em BankStatementLine
UPDATE "BankStatementLine" line
SET "statementId" = s."id"
FROM "BankStatement" s
WHERE s."cashAccountId" = line."cashAccountId"
  AND s."periodYear" = EXTRACT(YEAR FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')::int
  AND s."periodMonth" = EXTRACT(MONTH FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')::int
  AND line."statementId" IS NULL;

-- 4. Backfill statementId em BankStatementImport (pega o statement do primeiro line do import)
UPDATE "BankStatementImport" imp
SET "statementId" = sub."statementId"
FROM (
  SELECT DISTINCT ON (line."importId")
    line."importId",
    line."statementId"
  FROM "BankStatementLine" line
  WHERE line."statementId" IS NOT NULL
  ORDER BY line."importId", line."statementId"
) sub
WHERE imp."id" = sub."importId" AND imp."statementId" IS NULL;

-- 5. Recalcular contadores (caso ja existissem statements parciais)
UPDATE "BankStatement" s
SET
  "lineCount" = (SELECT COUNT(*) FROM "BankStatementLine" WHERE "statementId" = s."id"),
  "matchedCount" = (SELECT COUNT(*) FROM "BankStatementLine" WHERE "statementId" = s."id" AND "status" = 'MATCHED');

-- 6. Tornar statementId NOT NULL apos backfill
ALTER TABLE "BankStatementLine" ALTER COLUMN "statementId" SET NOT NULL;

-- 7. Criar FK se nao existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BankStatementLine_statementId_fkey'
      AND table_schema = 'tenant_sls'
  ) THEN
    ALTER TABLE "BankStatementLine"
      ADD CONSTRAINT "BankStatementLine_statementId_fkey"
      FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id")
      ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BankStatementImport_statementId_fkey'
      AND table_schema = 'tenant_sls'
  ) THEN
    ALTER TABLE "BankStatementImport"
      ADD CONSTRAINT "BankStatementImport_statementId_fkey"
      FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'tenant_sls' AND indexname = 'BankStatementImport_statementId_idx'
  ) THEN
    CREATE INDEX "BankStatementImport_statementId_idx" ON "BankStatementImport"("statementId");
  END IF;
END $$;

-- 8. Relatorio final
SELECT
  'Statements criados' as metric, COUNT(*)::text as value
FROM "BankStatement"
UNION ALL
SELECT
  'Linhas com statementId', COUNT(*)::text
FROM "BankStatementLine" WHERE "statementId" IS NOT NULL
UNION ALL
SELECT
  'Linhas conciliadas preservadas', COUNT(*)::text
FROM "BankStatementLine" WHERE "status" = 'MATCHED'
UNION ALL
SELECT
  'Imports vinculados', COUNT(*)::text
FROM "BankStatementImport" WHERE "statementId" IS NOT NULL;
