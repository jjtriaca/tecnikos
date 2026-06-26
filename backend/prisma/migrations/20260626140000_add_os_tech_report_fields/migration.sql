-- v1.14.30 — Relatório técnico da OS: descrição dos serviços prestados + relação de material
-- utilizado, preenchidos pelo bloco "Materiais" do fluxo de atendimento (onde cada campo grava
-- é configurável no editor do bloco: saveNoteTo / saveItemsTo). NULLABLE — seguro em tabela
-- populada; o TenantMigratorService propaga o ADD COLUMN nos schemas tenant_* no boot.

ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "serviceDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "materialsUsed" TEXT;
