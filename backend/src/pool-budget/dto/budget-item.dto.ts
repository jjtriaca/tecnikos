import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

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

  // Chave da etapa: aceita tanto valores do enum PoolSection (CONSTRUCAO,
  // FILTRO, ...) quanto chaves customizadas geradas no frontend
  // (CUSTOM_<slug>_<rand>). Validacao soft pra evitar abuso (so chars A-Z,
  // 0-9 e _, max 64 chars). v1.12.20.
  @ApiProperty({ description: 'Chave da etapa (enum padrao ou CUSTOM_*)' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Z0-9_]+$/i, { message: 'poolSection deve conter so letras, numeros e _' })
  poolSection!: string;

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
  // Mover item entre etapas (qualquer chave: enum padrao ou CUSTOM_*).
  @ApiPropertyOptional({ description: 'Chave da etapa (enum padrao ou CUSTOM_*)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Z0-9_]+$/i, { message: 'poolSection deve conter so letras, numeros e _' })
  poolSection?: string;

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
