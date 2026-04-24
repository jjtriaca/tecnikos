-- Migracao FIN-00273 (3x cartao Mastercard, recebido antecipado em VT)
-- Opcao B: 3 filhas PAID em VT espelhando estado do pai. Conciliacao com depositos da
-- operadora cria AccountTransfer VT->banco rastreavel quando cada parcela for paga.
-- Vencimentos dia 23 de cada mes (abril/maio/junho 2026).

BEGIN;
SET search_path = tenant_sls;

-- ANTES
SELECT 'ANTES' AS fase, code, status, "grossCents", "installmentCount",
  (SELECT COUNT(*) FROM "FinancialEntry" WHERE "parentEntryId" = fe.id AND "deletedAt" IS NULL) AS filhas
FROM "FinancialEntry" fe WHERE code = 'FIN-00273';

-- 1) FIN-00472 — Parcela 1/3 — R$ 301,66 venc 23/04/2026
INSERT INTO "FinancialEntry" (
  id, "companyId", code, type, status, description,
  "grossCents", "netCents", "dueDate", "paidAt",
  "parentEntryId", "partnerId", "serviceOrderId",
  "paymentMethod", "paymentInstrumentId",
  "financialAccountId", "cashAccountId",
  "nfseStatus", "nfseEmissionId",
  "installmentCount",
  notes,
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  fe."companyId",
  'FIN-00472',
  fe.type,
  'PAID',
  fe.description || ' — Parcela 1/3',
  30166,
  30166,
  '2026-04-23 12:00:00',
  fe."paidAt",
  fe.id,
  fe."partnerId",
  fe."serviceOrderId",
  fe."paymentMethod",
  fe."paymentInstrumentId",
  fe."financialAccountId",
  fe."cashAccountId",
  fe."nfseStatus",
  fe."nfseEmissionId",
  3,
  '[Parcela cartao Mastercard 1/3] Aguardando deposito da operadora',
  NOW(), NOW()
FROM "FinancialEntry" fe WHERE code = 'FIN-00273';

-- 2) FIN-00473 — Parcela 2/3 — R$ 301,67 venc 23/05/2026
INSERT INTO "FinancialEntry" (
  id, "companyId", code, type, status, description,
  "grossCents", "netCents", "dueDate", "paidAt",
  "parentEntryId", "partnerId", "serviceOrderId",
  "paymentMethod", "paymentInstrumentId",
  "financialAccountId", "cashAccountId",
  "nfseStatus", "nfseEmissionId",
  "installmentCount",
  notes,
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  fe."companyId",
  'FIN-00473',
  fe.type,
  'PAID',
  fe.description || ' — Parcela 2/3',
  30167,
  30167,
  '2026-05-23 12:00:00',
  fe."paidAt",
  fe.id,
  fe."partnerId",
  fe."serviceOrderId",
  fe."paymentMethod",
  fe."paymentInstrumentId",
  fe."financialAccountId",
  fe."cashAccountId",
  fe."nfseStatus",
  fe."nfseEmissionId",
  3,
  '[Parcela cartao Mastercard 2/3] Aguardando deposito da operadora',
  NOW(), NOW()
FROM "FinancialEntry" fe WHERE code = 'FIN-00273';

-- 3) FIN-00474 — Parcela 3/3 — R$ 301,67 venc 23/06/2026
INSERT INTO "FinancialEntry" (
  id, "companyId", code, type, status, description,
  "grossCents", "netCents", "dueDate", "paidAt",
  "parentEntryId", "partnerId", "serviceOrderId",
  "paymentMethod", "paymentInstrumentId",
  "financialAccountId", "cashAccountId",
  "nfseStatus", "nfseEmissionId",
  "installmentCount",
  notes,
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  fe."companyId",
  'FIN-00474',
  fe.type,
  'PAID',
  fe.description || ' — Parcela 3/3',
  30167,
  30167,
  '2026-06-23 12:00:00',
  fe."paidAt",
  fe.id,
  fe."partnerId",
  fe."serviceOrderId",
  fe."paymentMethod",
  fe."paymentInstrumentId",
  fe."financialAccountId",
  fe."cashAccountId",
  fe."nfseStatus",
  fe."nfseEmissionId",
  3,
  '[Parcela cartao Mastercard 3/3] Aguardando deposito da operadora',
  NOW(), NOW()
FROM "FinancialEntry" fe WHERE code = 'FIN-00273';

-- 4) Incrementar CodeCounter (3 codigos usados: 472, 473, 474)
UPDATE "CodeCounter" SET "nextNumber" = "nextNumber" + 3
WHERE entity = 'FINANCIAL_ENTRY';

-- 5) Pai vira SPLIT, notes formatado
UPDATE "FinancialEntry"
SET status = 'SPLIT',
    notes = E'[Parcelado em 3x] Total: R$ 905,00\n- FIN-00472 (R$ 301,66 venc 23/04/2026)\n- FIN-00473 (R$ 301,67 venc 23/05/2026)\n- FIN-00474 (R$ 301,67 venc 23/06/2026)',
    "updatedAt" = NOW()
WHERE code = 'FIN-00273';

-- DEPOIS
SELECT 'DEPOIS' AS fase, code, status, "grossCents", "installmentCount",
  (SELECT COUNT(*) FROM "FinancialEntry" WHERE "parentEntryId" = fe.id AND "deletedAt" IS NULL) AS filhas
FROM "FinancialEntry" fe WHERE code = 'FIN-00273';

SELECT 'FILHAS' AS fase, code, status, "grossCents", "dueDate"::date, "paidAt"::date,
  (SELECT name FROM "CashAccount" WHERE id = fe."cashAccountId") AS conta
FROM "FinancialEntry" fe WHERE code IN ('FIN-00472','FIN-00473','FIN-00474') ORDER BY code;

COMMIT;
