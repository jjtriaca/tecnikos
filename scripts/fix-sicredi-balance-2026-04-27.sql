-- =====================================================================
-- Fix saldo SICREDI: aplicacao 1+2 da auditoria 27/04/2026
--
-- (1) Royalle: aplicar credito R$ 2.980 no SICREDI (AccountTransfer ja existe)
-- (2) Refazer 3 conciliacoes legacy de cartao via fluxo transito (v1.09.94):
--     - FIN-00336 (Visa Debito 11/03): gross 160, liquido 157.60, taxa 2.40
--     - FIN-00335 (Elo Debito 11/03): gross 160, liquido 156.00, taxa 4.00
--     - FIN-00272 (Master Debito 26/03): gross 5260, liquido 5181.10, taxa 78.90
--
-- Net no saldo:
--   SICREDI: +R$ 2.980,00 (apenas Royalle; 3 cartoes legacy nao mexem saldo)
--   VT: 0 (entries movidos pra VT compensam taxa+transfer)
--
-- Net na divergencia interna (saldo - sum_calc):
--   SICREDI: +85,30 (3 taxas saem do sum como recv) +2.980 (Royalle credita saldo) = +R$ 3.065,30
--             vai do -R$ 2.769 atual para +R$ 296,30 (saldo > sum)
--             — discrepancia residual a investigar depois
-- =====================================================================

BEGIN;
SET search_path = tenant_sls;

-- ANTES: snapshot
SELECT 'ANTES' AS fase, name, "currentBalanceCents"/100.0 AS saldo
FROM "CashAccount"
WHERE name IN ('SICREDI','VALORES EM TRANSITO')
ORDER BY name;

-- =====================================================================
-- FIX 1: Royalle - aplicar credito R$ 2.980 no SICREDI
-- =====================================================================
UPDATE "CashAccount"
SET "currentBalanceCents" = "currentBalanceCents" + 298000,
    "updatedAt" = NOW()
WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';

-- =====================================================================
-- FIX 2: Refazer 3 conciliacoes legacy via fluxo transito (v1.09.94)
-- =====================================================================

-- ===== FIN-00336 (Visa Debito 11/03, gross 160, liquido 157.60, taxa 2.40) =====
-- a) Reverter credito legado SICREDI (recebeu liquido 157.60 do match legado)
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 15760
WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';
-- b) Mover entry SICREDI -> VT
UPDATE "FinancialEntry" SET "cashAccountId" = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2', "updatedAt" = NOW()
WHERE id = 'f637a471-4411-411b-b0bd-1ebf322527b0';
-- c) Saldo VT recebe +gross (entry agora esta em VT como se tivesse sido criado PAID em VT)
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" + 16000
WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';
-- d) AccountTransfer VT->SICREDI no liquido + ajuste saldos
INSERT INTO "AccountTransfer" (id, "companyId", "fromAccountId", "toAccountId", "amountCents", description, "transferDate", "createdByName", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2',
  '6e8703d3-5ed8-4855-be2a-a10f4cd431ed',
  15760,
  'Conciliacao - linha e427a4b1 (entry f637a471) — refactor v1.09.94',
  '2026-03-11 15:00:00',
  'Juliano Triaca (refactor SQL)',
  NOW()
);
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 15760 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" + 15760 WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';
-- e) Entry de taxa PAYABLE PAID em VT
INSERT INTO "FinancialEntry" (id, "companyId", code, type, status, description, "grossCents", "netCents", "paidAt", "cashAccountId", "financialAccountId", "isRefundEntry", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  'FIN-00484',
  'PAYABLE',
  'PAID',
  'Taxa cartao - conciliacao linha e427a4b1 (entry f637a471)',
  240, 240,
  '2026-03-11 15:00:00',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2',
  '83f32c05-3dcb-46eb-a76b-779dfd693c76',
  true,
  NOW(), NOW()
);
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 240 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';

-- ===== FIN-00335 (Elo Debito 11/03, gross 160, liquido 156.00, taxa 4.00) =====
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 15600 WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';
UPDATE "FinancialEntry" SET "cashAccountId" = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2', "updatedAt" = NOW() WHERE id = '92038297-1308-41a5-a7e5-571319abd02e';
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" + 16000 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';
INSERT INTO "AccountTransfer" (id, "companyId", "fromAccountId", "toAccountId", "amountCents", description, "transferDate", "createdByName", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2',
  '6e8703d3-5ed8-4855-be2a-a10f4cd431ed',
  15600,
  'Conciliacao - linha a4f92841 (entry 92038297) — refactor v1.09.94',
  '2026-03-11 15:00:00',
  'Juliano Triaca (refactor SQL)',
  NOW()
);
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 15600 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" + 15600 WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';
INSERT INTO "FinancialEntry" (id, "companyId", code, type, status, description, "grossCents", "netCents", "paidAt", "cashAccountId", "financialAccountId", "isRefundEntry", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  'FIN-00485',
  'PAYABLE',
  'PAID',
  'Taxa cartao - conciliacao linha a4f92841 (entry 92038297)',
  400, 400,
  '2026-03-11 15:00:00',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2',
  '83f32c05-3dcb-46eb-a76b-779dfd693c76',
  true,
  NOW(), NOW()
);
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 400 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';

-- ===== FIN-00272 (Master Debito 26/03, gross 5260, liquido 5181.10, taxa 78.90) =====
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 518110 WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';
UPDATE "FinancialEntry" SET "cashAccountId" = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2', "updatedAt" = NOW() WHERE id = '2a6e50a0-4544-4066-9c8e-3fd4dfd67c16';
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" + 526000 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';
INSERT INTO "AccountTransfer" (id, "companyId", "fromAccountId", "toAccountId", "amountCents", description, "transferDate", "createdByName", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2',
  '6e8703d3-5ed8-4855-be2a-a10f4cd431ed',
  518110,
  'Conciliacao - linha 21bbd29c (entry 2a6e50a0) — refactor v1.09.94',
  '2026-03-25 15:00:00',
  'Juliano Triaca (refactor SQL)',
  NOW()
);
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 518110 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" + 518110 WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';
INSERT INTO "FinancialEntry" (id, "companyId", code, type, status, description, "grossCents", "netCents", "paidAt", "cashAccountId", "financialAccountId", "isRefundEntry", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  'FIN-00486',
  'PAYABLE',
  'PAID',
  'Taxa cartao - conciliacao linha 21bbd29c (entry 2a6e50a0)',
  7890, 7890,
  '2026-03-25 15:00:00',
  '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2',
  '83f32c05-3dcb-46eb-a76b-779dfd693c76',
  true,
  NOW(), NOW()
);
UPDATE "CashAccount" SET "currentBalanceCents" = "currentBalanceCents" - 7890 WHERE id = '936e7bb3-e3f2-4e9d-8df2-e3aec2d7adc2';

-- Avancar codigo counter (3 codigos usados)
UPDATE "CodeCounter" SET "nextNumber" = "nextNumber" + 3 WHERE entity = 'FINANCIAL_ENTRY';

-- DEPOIS: snapshot
SELECT 'DEPOIS' AS fase, name, "currentBalanceCents"/100.0 AS saldo
FROM "CashAccount"
WHERE name IN ('SICREDI','VALORES EM TRANSITO')
ORDER BY name;

-- Verificar entries criadas
SELECT fe.code, fe.type, fe.status, fe."grossCents"/100.0 AS valor, fe."paidAt"::date, ca.name AS conta
FROM "FinancialEntry" fe
LEFT JOIN "CashAccount" ca ON ca.id = fe."cashAccountId"
WHERE fe.code IN ('FIN-00484','FIN-00485','FIN-00486')
ORDER BY fe.code;

-- Verificar transfers criados
SELECT at."transferDate"::date AS data, at."amountCents"/100.0 AS valor, fa.name AS de, ta.name AS para, LEFT(at.description, 60) AS desc
FROM "AccountTransfer" at
LEFT JOIN "CashAccount" fa ON fa.id = at."fromAccountId"
LEFT JOIN "CashAccount" ta ON ta.id = at."toAccountId"
WHERE at.description LIKE '%refactor v1.09.94%'
ORDER BY at."transferDate";

COMMIT;
