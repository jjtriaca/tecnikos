-- v1.10.39: PoolBudget - Impostos %, Prazo automatico e Condicoes gerais
--
-- Imposto agora e armazenado como % (taxesPercent), o sistema calcula taxesCents = subtotal × tax%/100.
-- Prazo e calculado a partir dos items: itens com unit ∈ {h,H,hora,horas} somam horas, itens com unit ∈ {d,D,dia,dias} × 8h.
-- Total de horas / 8h por dia = duracao em dias corridos. endDate = startDate + duracao.
-- Condicoes gerais (garantias, forma de pagamento) sao texto livre exibido na proposta.
--
-- Todas nullable, items existentes ficam com NULL ate o operador preencher.

ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "taxesPercent"            DOUBLE PRECISION;
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "startDate"               TIMESTAMP(3);
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "endDate"                 TIMESTAMP(3);
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "estimatedDurationDays"   INT;
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "equipmentWarranty"       TEXT;
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "workWarranty"            TEXT;
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "paymentTerms"            TEXT;
ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "earlyPaymentDiscountPct" DOUBLE PRECISION;
