-- v1.13.97 — Compensacao do cheque: data em que o deposito caiu no banco (pego AUTOMATICAMENTE do
-- extrato quando o deposito "Cheques a Compensar"->Banco e conciliado via matchAsTransfer).
-- Completa a linha do tempo do cheque: recebido (paidAt) -> depositado (checkOutAt) -> COMPENSADO
-- (checkClearedAt) -> devolvido (checkReturnedAt, se houver). NULLABLE — seguro em tabela populada;
-- o TenantMigratorService propaga o ADD COLUMN nos schemas tenant_* no boot.

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "checkClearedAt" TIMESTAMP(3);
