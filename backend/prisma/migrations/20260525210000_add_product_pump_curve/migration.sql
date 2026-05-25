-- v1.12.32 — Product.pumpCurve: array de pontos {vazaoM3h, alturaMca}
-- representando a curva caracteristica de uma bomba hidraulica. Permite
-- auto-selecao precisa (interpolar curva na altura manometrica calculada
-- pra ver se a vazao entregue atende a vazao necessaria) em vez de
-- comparacao simples pressaoMaxima >= alturaGeometrica.
--
-- Nullable: bombas sem curva cadastrada caem no fallback do pressaoTrabalhoMca.
-- TenantMigratorService propaga ADD COLUMN nos schemas tenant_*.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "pumpCurve" JSONB;
