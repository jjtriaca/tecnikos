import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolSection } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBudgetItemDto {
  @ApiPropertyOptional({ description: 'CatalogConfig de origem' })
  @IsOptional()
  @IsString()
  catalogConfigId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ enum: PoolSection })
  @IsEnum(PoolSection)
  poolSection!: PoolSection;

  @ApiPropertyOptional({ description: 'Rotulo do papel da linha (ex: Capa Termica, Bomba Aquecimento)' })
  @IsOptional()
  @IsString()
  slotName?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional({ default: 'UN' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: 'Quantidade efetiva' })
  @IsNumber()
  @Min(0)
  qty!: number;

  @ApiProperty({ description: 'Valor unitário em centavos' })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Item adicional (não veio do template)' })
  @IsOptional()
  @IsBoolean()
  isExtra?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Expressao pra auto-calcular qty (vars: length, width, depth, area, perimeter, volume)' })
  @IsOptional()
  @IsString()
  formulaExpr?: string;
}

export class UpdateBudgetItemDto {
  @ApiPropertyOptional({ description: 'Rotulo do papel da linha' })
  @IsOptional()
  @IsString()
  slotName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Expressao pra auto-calcular qty. String vazia = remove formula.' })
  @IsOptional()
  @IsString()
  formulaExpr?: string;

  // Vinculacao ao catalogo (quando troca item via lupa). null = desvincular (livre).
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  catalogConfigId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  productId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  serviceId?: string | null;
}
