-- v1.10.40: PoolBudget.sectionOrder
-- Array de PoolSection na ordem de exibicao do orcamento.
-- Default vazio = front usa SECTION_ORDER padrao.

ALTER TABLE "PoolBudget" ADD COLUMN IF NOT EXISTS "sectionOrder" TEXT[] NOT NULL DEFAULT '{}';
