-- v1.13.51 — PoolBudgetItem.suppressVazaoAlert: silencia o ALERTA VERMELHO de "bomba sem vazao"
-- (Grade NBR 10339). Quando a linha eh referenciada por prod(Lx,"vazaoM3h") no `where` de
-- auto-selecao de outra linha (um ralo) E nao tem vazaoM3h cadastrada, ela some da soma do
-- ralo (subdimensiona = risco de aprisionamento) -> linha fica vermelha. Silenciar SO esconde
-- o aviso por-linha — a bomba CONTINUA no calculo do ralo.
--
-- Boolean NOT NULL DEFAULT false: Postgres preenche linhas existentes com false (seguro em
-- tabela populada). TenantMigratorService propaga ADD COLUMN nos schemas tenant_*.

ALTER TABLE "PoolBudgetItem"
  ADD COLUMN IF NOT EXISTS "suppressVazaoAlert" BOOLEAN NOT NULL DEFAULT false;
