import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolSection } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePoolCatalogConfigDto {
  @ApiPropertyOptional({ description: 'ID do Product (informe productId OU serviceId, não ambos)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'ID do Service (informe productId OU serviceId, não ambos)' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ enum: PoolSection, description: 'Seção do orçamento de piscina' })
  @IsEnum(PoolSection)
  poolSection!: PoolSection;

  @ApiPropertyOptional({ description: 'Ordem de exibição dentro da seção (corresponde ao Seq da Linear)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    description:
      'Fórmula de cálculo automático da quantidade. Ex: {basis:"POOL_AREA",factor:0.15} → m³ concreto = área da piscina × 0.15',
    example: { basis: 'POOL_AREA', factor: 0.15 },
  })
  @IsOptional()
  @IsObject()
  poolFormula?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Condicional de inclusão. Ex: {requires:["AQUECIMENTO_SOLAR"]} - só inclui se cliente quiser aquecimento solar',
    example: { requires: ['AQUECIMENTO_SOLAR'] },
  })
  @IsOptional()
  @IsObject()
  poolCondition?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Especificações técnicas (varia por tipo de produto). Ex filtro: {vazaoM3h:7}',
    example: { vazaoM3h: 7, btuPorM3: 1500 },
  })
  @IsOptional()
  @IsObject()
  technicalSpecs?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
