import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoolBudgetStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryPoolBudgetDto {
  @ApiPropertyOptional({ enum: PoolBudgetStatus })
  @IsOptional()
  @IsEnum(PoolBudgetStatus)
  status?: PoolBudgetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientPartnerId?: string;

  @ApiPropertyOptional({ description: 'Buscar por código ou título' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Data de criação inicial (ISO)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Data de criação final (ISO)' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
