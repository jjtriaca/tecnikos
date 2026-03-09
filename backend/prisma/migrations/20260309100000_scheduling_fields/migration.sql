-- Agendamento CLT: campos de data/hora agendada e duracao estimada
ALTER TABLE "ServiceOrder" ADD COLUMN "scheduledStartAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN "estimatedDurationMinutes" INTEGER;

-- Indices para consulta de agenda
CREATE INDEX "ServiceOrder_companyId_scheduledStartAt_idx" ON "ServiceOrder"("companyId", "scheduledStartAt");
CREATE INDEX "ServiceOrder_assignedPartnerId_scheduledStartAt_idx" ON "ServiceOrder"("assignedPartnerId", "scheduledStartAt");
