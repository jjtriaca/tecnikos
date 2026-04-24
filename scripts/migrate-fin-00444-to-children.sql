-- Migracao FIN-00444 pra novo modelo (entries filhas com parentEntryId)
-- Contexto: FIN-00444 e renegociacao R$ 1.100 parcelada em 2x via FinancialInstallment legado.
-- Pos-refactor v1.09.99: parcelas sao FinancialEntry filhas. Migrar dados existentes.

BEGIN;
SET search_path = tenant_sls;

-- Confere estado inicial
SELECT 'ANTES' AS fase, code, status, "grossCents", "installmentCount",
  (SELECT COUNT(*) FROM "FinancialInstallment" WHERE "financialEntryId" = fe.id) AS fi_count,
  (SELECT COUNT(*) FROM "FinancialEntry" WHERE "parentEntryId" = fe.id AND "deletedAt" IS NULL) AS filhas
FROM "FinancialEntry" fe WHERE code = 'FIN-00444';

-- 1) Criar FIN-00467 (Parcela 1/2 — R$ 550, venc 15/04)
INSERT INTO "FinancialEntry" (
  id, "companyId", code, type, status, description,
  "grossCents", "netCents", "dueDate",
  "parentEntryId", "partnerId", "serviceOrderId",
  "paymentMethod", "paymentMethodId", "paymentInstrumentId",
  "financialAccountId", "cashAccountId",
  "nfseStatus", "nfseEmissionId",
  "interestType", "interestRateMonthly",
  "penaltyPercent", "penaltyFixedCents",
  "installmentCount",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  fe."companyId",
  'FIN-00467',
  fe.type,
  'PENDING',
  fe.description || ' — Parcela 1/2',
  fi."amountCents",
  fi."amountCents",
  fi."dueDate",
  fe.id,
  fe."partnerId",
  fe."serviceOrderId",
  fe."paymentMethod",
  fe."paymentMethodId",
  fe."paymentInstrumentId",
  fe."financialAccountId",
  fe."cashAccountId",
  fe."nfseStatus",
  fe."nfseEmissionId",
  fe."interestType",
  fe."interestRateMonthly",
  fe."penaltyPercent",
  fe."penaltyFixedCents",
  2,
  NOW(), NOW()
FROM "FinancialEntry" fe
JOIN "FinancialInstallment" fi ON fi."financialEntryId" = fe.id AND fi."installmentNumber" = 1
WHERE fe.code = 'FIN-00444';

-- 2) Criar FIN-00468 (Parcela 2/2 — R$ 550, venc 10/05)
INSERT INTO "FinancialEntry" (
  id, "companyId", code, type, status, description,
  "grossCents", "netCents", "dueDate",
  "parentEntryId", "partnerId", "serviceOrderId",
  "paymentMethod", "paymentMethodId", "paymentInstrumentId",
  "financialAccountId", "cashAccountId",
  "nfseStatus", "nfseEmissionId",
  "interestType", "interestRateMonthly",
  "penaltyPercent", "penaltyFixedCents",
  "installmentCount",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  fe."companyId",
  'FIN-00468',
  fe.type,
  'PENDING',
  fe.description || ' — Parcela 2/2',
  fi."amountCents",
  fi."amountCents",
  fi."dueDate",
  fe.id,
  fe."partnerId",
  fe."serviceOrderId",
  fe."paymentMethod",
  fe."paymentMethodId",
  fe."paymentInstrumentId",
  fe."financialAccountId",
  fe."cashAccountId",
  fe."nfseStatus",
  fe."nfseEmissionId",
  fe."interestType",
  fe."interestRateMonthly",
  fe."penaltyPercent",
  fe."penaltyFixedCents",
  2,
  NOW(), NOW()
FROM "FinancialEntry" fe
JOIN "FinancialInstallment" fi ON fi."financialEntryId" = fe.id AND fi."installmentNumber" = 2
WHERE fe.code = 'FIN-00444';

-- 3) Incrementar CodeCounter FINANCIAL_ENTRY em +2 (467, 468 usados)
UPDATE "CodeCounter"
SET "nextNumber" = "nextNumber" + 2
WHERE entity = 'FINANCIAL_ENTRY';

-- 4) Cancelar FIN-00444 (pai) — preserva NFS-e e historico
UPDATE "FinancialEntry"
SET status = 'CANCELLED',
    notes = '[Parcelado em 2x — substituido por FIN-00467 e FIN-00468]',
    "updatedAt" = NOW()
WHERE code = 'FIN-00444';

-- 5) Deletar FinancialInstallment do pai (substituidos pelas entries filhas)
DELETE FROM "FinancialInstallment"
WHERE "financialEntryId" = (SELECT id FROM "FinancialEntry" WHERE code = 'FIN-00444');

-- Validacao
SELECT 'DEPOIS' AS fase, code, status, "grossCents", "installmentCount",
  (SELECT COUNT(*) FROM "FinancialInstallment" WHERE "financialEntryId" = fe.id) AS fi_count,
  (SELECT COUNT(*) FROM "FinancialEntry" WHERE "parentEntryId" = fe.id AND "deletedAt" IS NULL) AS filhas
FROM "FinancialEntry" fe WHERE code = 'FIN-00444';

SELECT 'FILHAS' AS fase, code, status, "grossCents", "dueDate", "nfseStatus", "parentEntryId" IS NOT NULL AS tem_pai
FROM "FinancialEntry" WHERE code IN ('FIN-00467', 'FIN-00468') ORDER BY code;

COMMIT;
