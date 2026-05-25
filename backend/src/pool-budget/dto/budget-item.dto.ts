import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolSection } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

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

  // Quando preenchido, a linha pertence a uma etapa customizada criada pelo
  // operador. poolSection acima fica como OUTROS (fallback do enum) e o
  // agrupamento efetivo da linha eh customSectionKey ?? poolSection.
  @ApiPropertyOptional({ description: 'Chave da etapa customizada (CUSTOM_*). Se nao, NULL.' })
  @IsOptional()
  @IsString()
  customSectionKey?: string | null;

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

  // autoSelectRule e JSON livre no schema Prisma — aceita {filter, where, orderBy, indicator}
  // sem precisar atualizar o DTO toda vez que mudar a forma. @IsObject() eh ESSENCIAL:
  // sem ele, o ValidationPipe global (whitelist: true) STRIPA o campo silenciosamente.
  // Mesmo bug do incidente v1.10.51 com poolDimensions.
  @ApiPropertyOptional({ description: 'Regra de auto-selecao do produto/servico (filter, where, orderBy, indicator)' })
  @IsOptional()
  @IsObject()
  autoSelectRule?: Record<string, any>;
}

export class UpdateBudgetItemDto {
  // Mover item entre etapas: tanto poolSection quanto customSectionKey podem
  // mudar. Pra mover de etapa padrao -> custom: poolSection='OUTROS' + customSectionKey='CUSTOM_*'.
  // Pra mover de custom -> padrao: poolSection=X + customSectionKey=null.
  @ApiPropertyOptional({ enum: PoolSection })
  @IsOptional()
  @IsEnum(PoolSection)
  poolSection?: PoolSection;

  @ApiPropertyOptional({ description: 'Chave da etapa custom. null = limpa (volta a ser etapa padrao).', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  customSectionKey?: string | null;

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

  @ApiPropertyOptional({ description: 'Casas decimais no input qty (0=inteiro, 1=0.1, 2=0.01...). v1.11.89.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  qtyDecimals?: number;

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

  // @IsObject() essencial pra ValidationPipe nao stripar o campo (v1.10.51 gotcha).
  // @ValidateIf permite passar null pra limpar a regra (sem o decorator, @IsObject rejeita null).
  @ApiPropertyOptional({ description: 'Regra de auto-selecao. null = remove regra.', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsObject()
  autoSelectRule?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'true quando operador escolheu "Sem produto / servico" no picker. Pula auto-link.' })
  @IsOptional()
  @IsBoolean()
  manualUnlink?: boolean;

  // @ValidateIf permite null pra LIMPAR o snapshot (sem o decorator, @IsNumber rejeita null
  // e ValidationPipe stripa o campo — backend nao limpava snapshot, ficava preso).
  @ApiPropertyOptional({ description: 'Snapshot da qty antes de virar "Sem produto" — restaura ao re-escolher produto. null = limpa.' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber()
  previousQty?: number | null;
}
