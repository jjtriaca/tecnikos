-- Meios de Pagamento e Recebimento — configuracao rica (v1.08.100)
-- Unifica PaymentInstrument como cadastro unico visivel ao usuario
-- PaymentMethod fica escondido na UI (so admin)

-- Direcao do uso — onde este meio aparece nos dropdowns
ALTER TABLE "PaymentInstrument"
  ADD COLUMN IF NOT EXISTS "showInReceivables" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PaymentInstrument"
  ADD COLUMN IF NOT EXISTS "showInPayables" BOOLEAN NOT NULL DEFAULT true;

-- Comportamento ao criar lancamento
ALTER TABLE "PaymentInstrument"
  ADD COLUMN IF NOT EXISTS "autoMarkPaid" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentInstrument"
  ADD COLUMN IF NOT EXISTS "feePercent" DOUBLE PRECISION;

ALTER TABLE "PaymentInstrument"
  ADD COLUMN IF NOT EXISTS "receivingDays" INTEGER;

-- Defaults inteligentes por tipo (DINHEIRO e PIX nascem com autoMarkPaid=true)
-- Executa apenas no schema public (Prisma migrate deploy) — TenantMigratorService
-- vai aplicar o mesmo UPDATE em cada tenant ao sincronizar colunas.
UPDATE "PaymentInstrument" pi
SET "autoMarkPaid" = true
FROM "PaymentMethod" pm
WHERE pi."paymentMethodId" = pm.id
  AND pi."autoMarkPaid" = false
  AND pm.code IN ('DINHEIRO', 'PIX');
