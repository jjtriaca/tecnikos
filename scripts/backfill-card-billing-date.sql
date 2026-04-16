-- Backfill cardBillingDate para entries existentes com cartao de credito
-- Usa paidAt (ou dueDate) + billingClosingDay do instrumento pra calcular
-- Horario 12:00 pra evitar bugs de timezone
SET search_path TO tenant_sls;
BEGIN;

UPDATE "FinancialEntry" fe
SET "cardBillingDate" = CASE
  WHEN EXTRACT(DAY FROM COALESCE(fe."paidAt", fe."dueDate")) <= pi."billingClosingDay"
  THEN (DATE_TRUNC('month', COALESCE(fe."paidAt", fe."dueDate")) + ((pi."billingClosingDay" - 1) * INTERVAL '1 day') + INTERVAL '12 hours')::timestamp
  ELSE (DATE_TRUNC('month', COALESCE(fe."paidAt", fe."dueDate")) + INTERVAL '1 month' + ((pi."billingClosingDay" - 1) * INTERVAL '1 day') + INTERVAL '12 hours')::timestamp
END
FROM "PaymentInstrument" pi
WHERE fe."paymentInstrumentId" = pi.id
  AND pi."billingClosingDay" IS NOT NULL
  AND fe."deletedAt" IS NULL
  AND fe."cardBillingDate" IS NULL
  AND COALESCE(fe."paidAt", fe."dueDate") IS NOT NULL;

-- Verificacao
SELECT fe.code, fe.description,
       TO_CHAR(fe."paidAt", 'DD/MM/YY') as pago,
       TO_CHAR(fe."cardBillingDate", 'DD/MM/YY') as ciclo_fatura,
       pi.name as cartao
FROM "FinancialEntry" fe
JOIN "PaymentInstrument" pi ON fe."paymentInstrumentId" = pi.id
WHERE fe."cardBillingDate" IS NOT NULL AND fe."deletedAt" IS NULL
ORDER BY fe."cardBillingDate", fe."paidAt"
LIMIT 30;

COMMIT;
