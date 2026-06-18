-- v1.13.x — FinancialAccount.requiresNfse: opt-in por plano de contas pra exigir NFS-e
-- autorizada ao RECEBER/CONCILIAR lancamentos de receita deste plano. So planos marcados
-- avisam/bloqueiam sem NF (regra NfseConfig.receiveWithoutNfse). Juros/reembolso/receita
-- financeira ficam livres (conta nao marcada).
--
-- Boolean NOT NULL DEFAULT false: Postgres preenche linhas existentes com false (seguro em
-- tabela populada). TenantMigratorService propaga ADD COLUMN nos schemas tenant_* no boot.

ALTER TABLE "FinancialAccount"
  ADD COLUMN IF NOT EXISTS "requiresNfse" BOOLEAN NOT NULL DEFAULT false;
