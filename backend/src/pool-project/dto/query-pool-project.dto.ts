import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoolProjectStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryPoolProjectDto {
  @ApiPropertyOptional({ enum: PoolProjectStatus })
  @IsOptional()
  @IsEnum(PoolProjectStatus)
  status?: PoolProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Buscar por código ou nome do cliente' })
  @IsOptional()
  @IsString()
  search?: string;
}
