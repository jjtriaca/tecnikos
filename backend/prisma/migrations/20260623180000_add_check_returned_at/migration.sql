-- v1.13.93 — Devolucao de cheque (sem fundo). Marca o cheque depositado que VOLTOU. A conciliacao
-- da linha "DEVOLUCAO CHEQUE" desfaz a trilha Caixa->Compensar->Banco ao contrario (2 AccountTransfers
-- reversos), estorna o recebimento (lancamento volta pra "a receber") e marca o cheque aqui. NULLABLE
-- (sem default) — cheques nascem nao-devolvidos. TenantMigratorService propaga o ADD COLUMN no boot.

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "checkReturnedAt" TIMESTAMP(3);
