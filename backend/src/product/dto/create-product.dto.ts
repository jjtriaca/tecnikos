import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
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
}
