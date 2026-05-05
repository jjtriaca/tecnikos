import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Dimensões da piscina e parâmetros que alimentam as fórmulas automáticas.
 * Substitui a aba CAPA da planilha original.
 */
export class PoolDimensionsDto {
  @ApiProperty({ description: 'Comprimento da piscina em metros' })
  @IsNumber()
  @Min(0)
  length!: number;

  @ApiProperty({ description: 'Largura da piscina em metros' })
  @IsNumber()
  @Min(0)
  width!: number;

  @ApiProperty({ description: 'Profundidade média em metros' })
  @IsNumber()
  @Min(0)
  depth!: number;

  @ApiPropertyOptional({ description: 'Profundidade rasa (ex: 0.30m)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shallowDepth?: number;

  @ApiPropertyOptional({ description: 'Profundidade funda (ex: 1.80m)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deepDepth?: number;

  @ApiPropertyOptional({ description: 'Área (m²) — calculada se não enviar' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  area?: number;

  @ApiPropertyOptional({ description: 'Perímetro (m) — calculado se não enviar' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perimeter?: number;

  @ApiPropertyOptional({ description: 'Volume (m³) — calculado se não enviar' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volume?: number;

  @ApiPropertyOptional({
    description: 'Área de azulejo/revestimento (m²)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tileArea?: number;

  @ApiPropertyOptional({
    description: 'Área de parede (m²) — paredes laterais',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wallArea?: number;

  @ApiPropertyOptional({
    description: 'Tipo de construção',
    example: 'PARED_PRE_MOLDADA',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasSpa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCascata?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasAquecimentoSolar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasAutomacao?: boolean;
}
