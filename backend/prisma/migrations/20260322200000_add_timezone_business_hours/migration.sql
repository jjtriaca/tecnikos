ALTER TABLE "Company" ADD COLUMN "timezone" TEXT DEFAULT 'America/Sao_Paulo';
ALTER TABLE "Company" ADD COLUMN "businessHours" JSONB;
