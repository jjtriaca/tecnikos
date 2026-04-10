-- Extrato mensal por conta (v1.08.87)
-- Cria model BankStatement (1 por conta+mes) e migra linhas/imports existentes.

-- 1. Criar tabela BankStatement
CREATE TABLE "BankStatement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "cashAccountId" TEXT NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "lineCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "lastImportAt" TIMESTAMP(3),
  "lastImportByName" TEXT,
  "lastFileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankStatement_cashAccountId_periodYear_periodMonth_key"
  ON "BankStatement"("cashAccountId", "periodYear", "periodMonth");
CREATE INDEX "BankStatement_companyId_cashAccountId_idx"
  ON "BankStatement"("companyId", "cashAccountId");
CREATE INDEX "BankStatement_periodYear_periodMonth_idx"
  ON "BankStatement"("periodYear", "periodMonth");

ALTER TABLE "BankStatement"
  ADD CONSTRAINT "BankStatement_cashAccountId_fkey"
  FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- 2. Adicionar colunas statementId em Import e Line
ALTER TABLE "BankStatementImport"
  ADD COLUMN "statementId" TEXT;
ALTER TABLE "BankStatementLine"
  ADD COLUMN "statementId" TEXT;

-- 3. Data migration: cria 1 BankStatement por (cashAccountId, year, month)
-- usando as linhas existentes
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
  EXTRACT(MONTH FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo');

-- 4. Atualizar statementId em BankStatementLine via join
UPDATE "BankStatementLine" line
SET "statementId" = s."id"
FROM "BankStatement" s
WHERE s."cashAccountId" = line."cashAccountId"
  AND s."periodYear" = EXTRACT(YEAR FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')::int
  AND s."periodMonth" = EXTRACT(MONTH FROM line."transactionDate" AT TIME ZONE 'America/Sao_Paulo')::int;

-- 5. Atualizar statementId nos Imports (pega o statement "principal" do import:
-- aquele que contem a MAIOR parte das linhas do import)
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
WHERE imp."id" = sub."importId";

-- 6. Tornar statementId NOT NULL em Line (Import fica nullable para flexibilidade)
ALTER TABLE "BankStatementLine"
  ALTER COLUMN "statementId" SET NOT NULL;

-- 7. Criar FKs
ALTER TABLE "BankStatementImport"
  ADD CONSTRAINT "BankStatementImport_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankStatementLine"
  ADD CONSTRAINT "BankStatementLine_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- 8. Indices
CREATE INDEX "BankStatementImport_statementId_idx" ON "BankStatementImport"("statementId");
CREATE INDEX "BankStatementLine_statementId_idx" ON "BankStatementLine"("statementId");
