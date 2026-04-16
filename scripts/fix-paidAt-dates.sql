SET search_path TO tenant_sls;
BEGIN;

-- PARCELAS fatura abril (dueDate 08/04): paidAt → 25/03 (fechamento)
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-25'
WHERE "dueDate" = '2026-04-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430' AND "deletedAt" IS NULL;

-- PARCELAS faturas futuras: paidAt → dia 25 do mes anterior ao dueDate
UPDATE "FinancialEntry" SET "paidAt" = '2026-04-25' WHERE "dueDate" = '2026-05-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-05-25' WHERE "dueDate" = '2026-06-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-06-25' WHERE "dueDate" = '2026-07-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-07-25' WHERE "dueDate" = '2026-08-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-08-25' WHERE "dueDate" = '2026-09-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-09-25' WHERE "dueDate" = '2026-10-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-10-25' WHERE "dueDate" = '2026-11-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-11-25' WHERE "dueDate" = '2026-12-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2026-12-25' WHERE "dueDate" = '2027-01-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';
UPDATE "FinancialEntry" SET "paidAt" = '2027-01-25' WHERE "dueDate" = '2027-02-08' AND code >= 'FIN-00374' AND code <= 'FIN-00430';

-- AVULSAS fatura abril: paidAt → data da compra real
UPDATE "FinancialEntry" SET "paidAt" = '2026-02-25' WHERE code = 'FIN-00431';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-18' WHERE code = 'FIN-00432';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-03' WHERE code = 'FIN-00433';
UPDATE "FinancialEntry" SET "paidAt" = '2026-02-26' WHERE code = 'FIN-00434';
UPDATE "FinancialEntry" SET "paidAt" = '2026-02-26' WHERE code = 'FIN-00435';
UPDATE "FinancialEntry" SET "paidAt" = '2026-02-24' WHERE code = 'FIN-00436';
UPDATE "FinancialEntry" SET "paidAt" = '2026-02-24' WHERE code = 'FIN-00437';

-- Entries ja existentes com paidAt errado
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-04' WHERE code = 'FIN-00013';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-02' WHERE code = 'FIN-00010';
UPDATE "FinancialEntry" SET "paidAt" = '2026-02-25' WHERE code = 'FIN-00008';

-- FIN-00297 a 00301: compras manuais com paidAt 15/04 errado
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-23' WHERE code = 'FIN-00297';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-19' WHERE code = 'FIN-00298';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-23' WHERE code = 'FIN-00300';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-23' WHERE code = 'FIN-00301';

-- 8 entries que estavam no cartao errado: paidAt era 16/04
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-17' WHERE code = 'FIN-00305';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-05' WHERE code = 'FIN-00306';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-13' WHERE code = 'FIN-00309';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-09' WHERE code = 'FIN-00310';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-20' WHERE code = 'FIN-00311';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-17' WHERE code = 'FIN-00312';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-16' WHERE code = 'FIN-00313';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-17' WHERE code = 'FIN-00314';

-- Proxima fatura (27/03+): corrigir paidAt pra data real
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-27' WHERE code = 'FIN-00302';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-27' WHERE code = 'FIN-00303';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-27' WHERE code = 'FIN-00299';
UPDATE "FinancialEntry" SET "paidAt" = '2026-03-27' WHERE code = 'FIN-00304';

-- Verificacao
SELECT code, description, "netCents"/100.0 as valor, TO_CHAR("paidAt", 'DD/MM/YYYY') as pago
FROM "FinancialEntry"
WHERE "paymentInstrumentId" IN ('01b83cdf-f3d1-4262-8ab8-ed2e664f86e7', 'e4794fc5-d454-45ae-b38b-1a820d46cbbc')
  AND "paidAt" >= '2026-02-24' AND "paidAt" <= '2026-03-25'
  AND "deletedAt" IS NULL AND status = 'PAID'
ORDER BY "paidAt", code;

COMMIT;
