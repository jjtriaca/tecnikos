-- Natureza da Operacao (<natOp> do XML, disponivel em procNFe) no documento SEFAZ.
-- Nullable: resNFe/resEvento (resumo) nao trazem natOp; procNFe traz.
-- Tenants: TenantMigratorService propaga via ADD COLUMN IF NOT EXISTS no boot.
ALTER TABLE "SefazDocument" ADD COLUMN "naturezaOperacao" TEXT;
