-- v1.10.44: Product/Service.technicalSpecs (Json) — especificacoes tecnicas
-- Espelha os 25+ campos do banco da planilha (Peso, Voltagem, Vazao, Eficiencia, etc).
-- Json livre pra ficar extensivel sem novas migrations a cada campo novo.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "technicalSpecs" JSONB;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "technicalSpecs" JSONB;
