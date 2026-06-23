-- v1.13.85 — Cheque de terceiro em carteira: rastreia quando um cheque recebido (paymentMethod
-- CHEQUE) SAIU da carteira e por qual caminho. Em carteira = campos NULL (cheque na mao, na conta
-- tipo CAIXA). Saiu = checkOutAt preenchido + checkOutKind ('DEPOSIT' = depositado no banco, vai pra
-- conta de transito "Cheques a Compensar"; 'ENDORSE' = repassado p/ pagar fornecedor) + checkOutRef
-- (id do AccountTransfer do deposito OU da FinancialEntry PAYABLE quitada no repasse).
-- Todos NULLABLE (sem default) — seguro em tabela populada. O TenantMigratorService propaga o
-- ADD COLUMN nos schemas tenant_* no boot (detecta coluna faltante).

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "checkOutAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkOutKind" TEXT,
  ADD COLUMN IF NOT EXISTS "checkOutRef" TEXT;
