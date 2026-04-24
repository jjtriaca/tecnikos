-- Cleanup Royalle (R$ 2.980 conciliacao OK mas faltou AccountTransfer VT->SICREDI)
-- + Flavio (linha desfeita mas entries ficaram PAID — bug do unmatchLine match-multiple)

BEGIN;
SET search_path = tenant_sls;

-- ═══ ANTES ═══
SELECT 'ANTES' AS fase, name, "currentBalanceCents" / 100.0 AS saldo_brl FROM "CashAccount" WHERE name IN ('SICREDI','VALORES EM TRANSITO') ORDER BY name;

-- ═══ A) ROYALLE — criar AccountTransfer rastreavel VT -> SICREDI ═══
INSERT INTO "AccountTransfer" (id, "companyId", "fromAccountId", "toAccountId", "amountCents", description, "transferDate", "createdByName", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2', -- VT
  '6e8703d3-5ed8-4855-be2a-a10f4cd431ed', -- SICREDI
  298000, -- R$ 2.980,00
  'Conciliacao Royalle 4 entries — AccountTransfer pos-fato (linha 8195ffc5)',
  '2026-04-22',
  'Juliano Triaca (manual SQL)',
  NOW()
);

-- Decrementar VT em R$ 2.980 (SICREDI ja foi creditado quando linha foi conciliada)
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 298000
WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';

-- ═══ B) FLAVIO — reverter conciliacao desfeita ═══

-- Reverter FIN-00467 pra PENDING (parcela 1 do Flavio)
UPDATE "FinancialEntry" SET
  status = 'PENDING',
  "paidAt" = NULL,
  "cashAccountId" = NULL,
  "invoiceMatchLineId" = NULL,
  "autoMarkedPaid" = false,
  notes = NULL,
  "updatedAt" = NOW()
WHERE code = 'FIN-00467';

-- Soft-delete FIN-00469 (juros — ajuste auto-criado pra conciliacao desfeita)
UPDATE "FinancialEntry" SET
  "deletedAt" = NOW(),
  "updatedAt" = NOW()
WHERE code = 'FIN-00469';

-- Decrementar SICREDI em R$ 573,70 (saldo creditado pela conciliacao errada)
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 57370
WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';

-- ═══ DEPOIS ═══
SELECT 'DEPOIS' AS fase, name, "currentBalanceCents" / 100.0 AS saldo_brl FROM "CashAccount" WHERE name IN ('SICREDI','VALORES EM TRANSITO') ORDER BY name;

SELECT code, status, "grossCents" / 100.0 AS valor_brl, "paidAt"::date, "deletedAt" IS NOT NULL AS deletado, "invoiceMatchLineId" IS NOT NULL AS tem_match
FROM "FinancialEntry" WHERE code IN ('FIN-00467','FIN-00468','FIN-00469')
ORDER BY code;

SELECT description, "amountCents" / 100.0 AS valor_brl, "transferDate"
FROM "AccountTransfer"
WHERE description LIKE '%Royalle%4 entries%' AND "createdAt" > NOW() - INTERVAL '5 minutes';

COMMIT;
