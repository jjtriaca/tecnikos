# Tenant Migrator — Gotcha: NOT NULL sem default em tabela populada

## Incidente (10/04/2026, v1.08.87)

Deploy da migration `20260410180000_bank_statement_monthly` funcionou no schema `public` mas falhou silenciosamente no schema `tenant_sls`:

- `BankStatement` table foi criada (via `CREATE TABLE LIKE public INCLUDING ALL`)
- `BankStatementImport.statementId` foi adicionado (coluna nullable no schema)
- `BankStatementLine.statementId` **NAO foi adicionada** — ficou faltando

Resultado no tenant:
- 40 linhas existentes preservadas com conciliacoes
- `BankStatement` table vazia
- UI mostrando "Nenhum extrato importado"
- Imports novos falhavam silenciosamente (INSERT exigia `statementId` que nao existia)

## Causa raiz

`TenantMigratorService.addColumn` executava:

```sql
ALTER TABLE tenant_sls."BankStatementLine" ADD COLUMN IF NOT EXISTS "statementId" TEXT NOT NULL
```

Postgres rejeitou com erro `column contains null values` porque a tabela tinha 40 linhas existentes e o NOT NULL nao pode ser aplicado. O erro foi capturado em `syncSchema` catch block e logado como `warn`, nao como erro fatal. Deploy prosseguiu feliz.

## Fix aplicado (v1.08.88)

`addColumn` agora detecta o padrao "NOT NULL sem default + tabela populada" ANTES de executar o ALTER:

1. Se `isNullable === 'NO'` e nao tem `columnDefault`:
2. Faz `SELECT COUNT(*) FROM tabela` no schema do tenant
3. Se tem linhas: adiciona a coluna como NULLABLE
4. Emite warning LOUD instruindo backfill manual + `ALTER COLUMN SET NOT NULL`

Assim o ALTER nunca falha silenciosamente. O dev ve o warning e sabe que precisa criar um script de backfill.

## Licao aprendida — ao escrever migrations Prisma que afetam tabelas populadas

**Regra:** se voce adicionar uma coluna NOT NULL sem default em tabela que ja tem dados, voce precisa de um **script de backfill manual** que rode em TODOS os tenants apos o deploy. Nao confie no TenantMigratorService para backfill — ele so sincroniza estrutura.

**Checklist antes de merge:**
1. A migration adiciona coluna NOT NULL sem default? → Tem data migration?
2. A data migration funciona no schema public E nos schemas dos tenants?
3. Testar com `docker exec postgres psql -c "SELECT schemaname FROM pg_tables WHERE tablename = 'X'"` para ver em quais schemas a tabela existe
4. Se precisa rodar o SQL em varios schemas, escrever um script que itera por `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`

**Script de fix usado no incidente:** `fix-tenant-statements.sql` (na raiz do repo). Pode ser reusado como template para futuros incidentes similares.

## Como verificar se ha drift entre public e tenants

```sql
-- Para cada tabela, compare colunas entre public e tenant_X
SELECT table_name, column_name, 'missing in tenant' AS issue
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT IN ('_prisma_migrations', 'Tenant', 'Plan', 'Subscription', 'Promotion')
  AND (table_name, column_name) NOT IN (
    SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'tenant_sls'
  );
```

Rodar periodicamente (ou adicionar ao health check) para detectar drift rapido.
