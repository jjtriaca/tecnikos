import { IsString, IsOptional, IsInt, IsBoolean, IsObject, Min } from 'class-validator';

export class CreateServiceDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  commissionBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  techFixedValueCents?: number;

  @IsOptional()
  @IsString()
  commissionRule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultQty?: number;

  @IsOptional()
  checklists?: {
    toolsPpe?: string[];
    materials?: string[];
    initialCheck?: string[];
    finalCheck?: string[];
    custom?: string[];
  };

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /* ── Modulo de uso (OS / Obra de Piscina) ───────────────── */

  @IsOptional()
  @IsBoolean()
  useInServiceOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  useInPool?: boolean;

  /* ── Specs tecnicas (modulo Piscina) ────────────────────── */

  @IsOptional()
  @IsObject()
  technicalSpecs?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
