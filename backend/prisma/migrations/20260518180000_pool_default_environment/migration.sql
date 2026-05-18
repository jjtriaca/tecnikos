-- v1.11.61 — PoolModuleConfig.defaultEnvironmentParams (Json).
-- Permite tenant salvar valores padrao de aquecimento (UF/cidade/temp/capa/vento/etc)
-- pra herdar em novos orcamentos. Operador clica "Salvar como padrao" no modal
-- "Editar dados" e os valores ficam aqui.

ALTER TABLE "PoolModuleConfig"
  ADD COLUMN IF NOT EXISTS "defaultEnvironmentParams" JSONB;
