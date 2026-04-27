-- =====================================================================
-- Rebalance SICREDI — fecha divergencia historica auditoria 27/04/2026
--
-- Estado atual:
--   Saldo SICREDI = R$ 5.789,80
--   Sum_calc movs = R$ 5.493,50  (R$ 296,30 abaixo do saldo)
--   Banco em 24/04 = R$ 5.813,50  (R$ 23,70 acima do saldo)
--
-- Pra fechar 100% (saldo = banco = sum_calc = R$ 5.813,50):
--   Saldo precisa subir +R$ 23,70
--   Sum_calc precisa subir +R$ 320,00 (= 296,30 + 23,70)
--
-- 2 entries auditaveis isRefundEntry=true:
--
-- FIN-00487: RECEIVABLE +R$ 296,30 — registra mov ausente que originou
--            excesso historico no saldo. INSERT entry sem UPDATE saldo
--            (saldo ja tem esse valor por UPDATE antigo nao rastreado).
--
-- FIN-00488: RECEIVABLE +R$ 23,70 — diff residual conferencia banco 31/03.
--            INSERT entry + UPDATE saldo (mov real que faltou).
-- =====================================================================

BEGIN;
SET search_path = tenant_sls;

-- ANTES
SELECT 'ANTES' AS fase, name, "currentBalanceCents"/100.0 AS saldo
FROM "CashAccount" WHERE name='SICREDI';

-- =====================================================================
-- FIN-00487: registra mov ausente (R$ 296,30) — sum sobe, saldo nao muda
-- =====================================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, status, description, "grossCents", "netCents", "paidAt", "confirmedAt", "dueDate", "cashAccountId", "isRefundEntry", "createdAt", "updatedAt", notes)
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  'FIN-00487',
  'RECEIVABLE',
  'PAID',
  'Ajuste cumulativo historico SICREDI — registra mov ausente (R$ 296,30)',
  29630, 29630,
  NOW(), NOW(), NOW(),
  '6e8703d3-5ed8-4855-be2a-a10f4cd431ed',
  true,
  NOW(), NOW(),
  '[REBALANCE_AJUSTE] 27/04/2026 — Juliano Triaca (SQL)
Motivo: Auditoria sessao 182 identificou saldo SICREDI R$ 296,30 acima do calc das movs registradas. Causa nao rastreavel sem audit log de UPDATEs antigos. Possivel: cleanup script v1.08.x ou UPDATE direto no passado.
Acao: registra entry tecnico que faltava no historico SEM mexer saldo (saldo ja tinha esse valor).
Saldo antes: R$ 5.789,80
Delta saldo: 0 (apenas ajusta sum_calc)'
);
-- NAO atualiza saldo (esse entry compensa UPDATE antigo nao rastreado)

-- =====================================================================
-- FIN-00488: diff residual conferencia banco (R$ 23,70) — sum E saldo sobem
-- =====================================================================
INSERT INTO "FinancialEntry" (id, "companyId", code, type, status, description, "grossCents", "netCents", "paidAt", "confirmedAt", "dueDate", "cashAccountId", "isRefundEntry", "createdAt", "updatedAt", notes)
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000002',
  'FIN-00488',
  'RECEIVABLE',
  'PAID',
  'Ajuste residual conferencia banco SICREDI 31/03 (R$ 23,70)',
  2370, 2370,
  NOW(), NOW(), NOW(),
  '6e8703d3-5ed8-4855-be2a-a10f4cd431ed',
  true,
  NOW(), NOW(),
  '[REBALANCE_AJUSTE] 27/04/2026 — Juliano Triaca (SQL)
Motivo: Diff residual auditoria sessao 182. Apos ajuste cumulativo (FIN-00487), sistema fica R$ 23,70 abaixo do banco SICREDI em 31/03/2026. Possivel: outra inconsistencia historica.
Saldo antes: R$ 5.789,80
Delta: +R$ 23,70'
);
UPDATE "CashAccount"
SET "currentBalanceCents" = "currentBalanceCents" + 2370, "updatedAt" = NOW()
WHERE id = '6e8703d3-5ed8-4855-be2a-a10f4cd431ed';

-- Avancar code counter
UPDATE "CodeCounter" SET "nextNumber" = "nextNumber" + 2 WHERE entity = 'FINANCIAL_ENTRY';

-- DEPOIS — saldo deve ser R$ 5.813,50 (= banco)
SELECT 'DEPOIS' AS fase, name, "currentBalanceCents"/100.0 AS saldo
FROM "CashAccount" WHERE name='SICREDI';

-- Verificar entries criadas
SELECT fe.code, fe.type, fe."netCents"/100.0 AS valor, fe."isRefundEntry", LEFT(fe.description, 60) AS desc
FROM "FinancialEntry" fe
WHERE fe.code IN ('FIN-00487','FIN-00488')
ORDER BY fe.code;

-- Validar conferencia interna (sum_calc deve = saldo)
WITH rec AS (SELECT COALESCE(SUM("netCents"),0) AS v FROM "FinancialEntry" WHERE "cashAccountId"=(SELECT id FROM "CashAccount" WHERE name='SICREDI') AND status='PAID' AND type='RECEIVABLE' AND "deletedAt" IS NULL),
     pay AS (SELECT COALESCE(SUM("netCents"),0) AS v FROM "FinancialEntry" WHERE "cashAccountId"=(SELECT id FROM "CashAccount" WHERE name='SICREDI') AND status='PAID' AND type='PAYABLE' AND "deletedAt" IS NULL),
     tin AS (SELECT COALESCE(SUM("amountCents"),0) AS v FROM "AccountTransfer" WHERE "toAccountId"=(SELECT id FROM "CashAccount" WHERE name='SICREDI')),
     tout AS (SELECT COALESCE(SUM("amountCents"),0) AS v FROM "AccountTransfer" WHERE "fromAccountId"=(SELECT id FROM "CashAccount" WHERE name='SICREDI'))
SELECT (SELECT "currentBalanceCents" FROM "CashAccount" WHERE name='SICREDI')/100.0 AS saldo_db,
       ((SELECT "initialBalanceCents" FROM "CashAccount" WHERE name='SICREDI') + rec.v - pay.v + tin.v - tout.v)/100.0 AS sum_calc,
       ((SELECT "currentBalanceCents" FROM "CashAccount" WHERE name='SICREDI') - ((SELECT "initialBalanceCents" FROM "CashAccount" WHERE name='SICREDI') + rec.v - pay.v + tin.v - tout.v))/100.0 AS divergencia
FROM rec, pay, tin, tout;

COMMIT;
