import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoolProjectStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePoolProjectDto {
  @ApiPropertyOptional({ enum: PoolProjectStatus })
  @IsOptional()
  @IsEnum(PoolProjectStatus)
  status?: PoolProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Percentual de progresso 0-100' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
