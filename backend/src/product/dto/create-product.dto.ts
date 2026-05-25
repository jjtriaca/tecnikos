import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';

export class CreateProductDto {
  /* ── Aba Geral ──────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  unit?: string = 'UN';

  @IsOptional()
  @IsString()
  ncm?: string;

  @IsOptional()
  @IsString()
  cest?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /* ── Aba Impostos ───────────────────────────────────────── */

  @IsOptional()
  @IsNumber()
  icmsRate?: number;

  @IsOptional()
  @IsNumber()
  ipiRate?: number;

  @IsOptional()
  @IsNumber()
  pisRate?: number;

  @IsOptional()
  @IsNumber()
  cofinsRate?: number;

  @IsOptional()
  @IsString()
  csosn?: string;

  @IsOptional()
  @IsString()
  cfop?: string;

  @IsOptional()
  @IsString()
  cst?: string;

  @IsOptional()
  @IsString()
  cstPis?: string;

  @IsOptional()
  @IsString()
  cstCofins?: string;

  /* ── Aba Margem de Lucro ────────────────────────────────── */

  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salePriceCents?: number;

  @IsOptional()
  @IsNumber()
  profitMarginPercent?: number;

  /* ── Aba Estoque ────────────────────────────────────────── */

  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  minStock?: number;

  @IsOptional()
  @IsNumber()
  maxStock?: number;

  @IsOptional()
  @IsString()
  location?: string;

  /* ── Aba Modulo de uso (Venda / Obra) ───────────────────── */

  @IsOptional()
  @IsBoolean()
  useInSale?: boolean;

  @IsOptional()
  @IsBoolean()
  useInWork?: boolean;

  /* ── Specs tecnicas (modulo Piscina) ────────────────────── */

  @IsOptional()
  @IsObject()
  technicalSpecs?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Tipo do produto no modulo Piscina (Cascata, Aquecedor, Conjunto de filtragem,
  // Tubos cascata, etc.). Substitui o uso de technicalSpecs.categoriaPlanilha.
  @IsOptional()
  @IsString()
  poolType?: string;

  // Quantidade padrao ao escolher esse produto numa linha do orcamento de piscina.
  // Null = sem padrao (fluxo usa 1).
  @IsOptional()
  @IsNumber()
  defaultQty?: number;

  // Servico de instalacao/montagem vinculado a este produto. Quando uma
  // linha de servico do orcamento usa autoSelectRule.followProductLine, le
  // este campo pra vincular o Service correto automaticamente. v1.12.22.
  @IsOptional()
  @IsString()
  linkedServiceId?: string | null;
}
