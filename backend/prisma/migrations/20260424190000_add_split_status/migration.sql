-- Adiciona valor SPLIT ao enum FinancialEntryStatus.
-- Usado pra entries "pai" que foram parcelados em N filhas (via parentEntryId).
-- SPLIT some dos relatorios de A Receber/A Pagar, mas preserva historico (NFS-e etc).
-- TenantMigratorService propaga o novo valor pros schemas dos tenants no proximo boot.

ALTER TYPE "FinancialEntryStatus" ADD VALUE IF NOT EXISTS 'SPLIT';
