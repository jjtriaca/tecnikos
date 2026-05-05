import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolPrintDynamicType, PoolPrintPageType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePoolPrintPageDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({
    enum: PoolPrintPageType,
    description: 'FIXED = HTML estático com placeholders. DYNAMIC = gerada por dados',
  })
  @IsEnum(PoolPrintPageType)
  type!: PoolPrintPageType;

  // FIXED
  @ApiPropertyOptional({
    description:
      'HTML do conteúdo (apenas pra type=FIXED). Suporta placeholders: ' +
      '{clientName}, {poolArea}, {poolVolume}, {budgetTotal}, etc.',
  })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  // DYNAMIC
  @ApiPropertyOptional({
    enum: PoolPrintDynamicType,
    description: 'Tipo da página dinâmica (apenas pra type=DYNAMIC)',
  })
  @IsOptional()
  @IsEnum(PoolPrintDynamicType)
  dynamicType?: PoolPrintDynamicType;

  @ApiPropertyOptional({
    description: 'Configuração do conteúdo dinâmico',
    example: { sections: ['CONSTRUCAO', 'FILTRO'], showImages: true },
  })
  @IsOptional()
  @IsObject()
  pageConfig?: Record<string, unknown>;

  // Conditional rendering
  @ApiPropertyOptional({
    description: 'Se true, página só aparece se condição bater',
  })
  @IsOptional()
  @IsBoolean()
  isConditional?: boolean;

  @ApiPropertyOptional({
    description: 'Regra de condição (ex: {requires: ["AQUECIMENTO_SOLAR"]})',
  })
  @IsOptional()
  @IsObject()
  conditionRule?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  pageBreak?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePoolPrintPageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ enum: PoolPrintPageType })
  @IsOptional()
  @IsEnum(PoolPrintPageType)
  type?: PoolPrintPageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ enum: PoolPrintDynamicType })
  @IsOptional()
  @IsEnum(PoolPrintDynamicType)
  dynamicType?: PoolPrintDynamicType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  pageConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isConditional?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  conditionRule?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pageBreak?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderPagesDto {
  @ApiProperty({
    description: 'Array de IDs de páginas na ordem desejada',
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsString({ each: true })
  pageIds!: string[];
}
