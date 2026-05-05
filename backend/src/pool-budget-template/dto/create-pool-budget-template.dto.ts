import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolSection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TemplateSectionItemDto {
  @ApiProperty({ description: 'ID do PoolCatalogConfig referenciado' })
  @IsString()
  catalogConfigId!: string;

  @ApiPropertyOptional({ description: 'Ordem do item dentro da seção' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Item obrigatório no template (sempre cria)' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class TemplateSectionDto {
  @ApiProperty({ enum: PoolSection })
  @IsEnum(PoolSection)
  section!: PoolSection;

  @ApiPropertyOptional({ description: 'Ordem da seção dentro do template' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ type: [TemplateSectionItemDto], description: 'Itens da seção' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionItemDto)
  items!: TemplateSectionItemDto[];
}

export class CreatePoolBudgetTemplateDto {
  @ApiProperty({ example: 'Padrão' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Template padrão para piscina simples' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Marca como template default do tenant' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    type: [TemplateSectionDto],
    description: 'Estrutura de seções e itens do template',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  sections!: TemplateSectionDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
