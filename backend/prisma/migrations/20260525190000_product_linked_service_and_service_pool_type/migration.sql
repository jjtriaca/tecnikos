-- v1.12.22 — Vinculo Produto-Servico + Tipo do Servico
--
-- Product.linkedServiceId: opcional. Quando preenchido, este produto tem
-- um servico de instalacao/montagem padrao. Usado pela auto-selecao de
-- servico do orcamento (autoSelectRule.followProductLine) — quando uma
-- linha de servico segue uma linha de produto, le este campo pra vincular
-- o Service correto automaticamente.
--
-- Service.poolType: paridade com Product.poolType. Permite filtrar servicos
-- por tipo (ex: "Instalacao de Bomba de Calor", "Instalacao Filtro Areia")
-- na auto-selecao do orcamento.
--
-- Ambas as colunas sao nullable — itens existentes ficam sem vinculo /
-- sem tipo, ate o operador preencher manualmente. TenantMigratorService
-- propaga ADD COLUMN nos schemas tenant_*.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "linkedServiceId" TEXT;

-- FK constraint: aponta pra Service.id. ON DELETE SET NULL pra nao bloquear
-- delete de Service que ainda tem Products apontando.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_linkedServiceId_fkey"
  FOREIGN KEY ("linkedServiceId") REFERENCES "Service"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Product_linkedServiceId_idx"
  ON "Product"("linkedServiceId");

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "poolType" TEXT;

CREATE INDEX IF NOT EXISTS "Service_companyId_poolType_idx"
  ON "Service"("companyId", "poolType");
