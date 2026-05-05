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
}

export class UpdateBudgetItemDto {
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
}
