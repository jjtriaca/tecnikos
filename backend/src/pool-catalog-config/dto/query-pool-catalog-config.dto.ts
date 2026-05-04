import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoolSection } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryPoolCatalogConfigDto {
  @ApiPropertyOptional({ enum: PoolSection })
  @IsOptional()
  @IsEnum(PoolSection)
  poolSection?: PoolSection;

  @ApiPropertyOptional({ description: 'Buscar por descrição do Product/Service relacionado' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra apenas configs ativas (default: true)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar configs ligadas a Product (vs Service)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyProducts?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar configs ligadas a Service (vs Product)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyServices?: boolean;
}
