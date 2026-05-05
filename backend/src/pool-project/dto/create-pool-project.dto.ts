import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePoolProjectDto {
  @ApiProperty({ description: 'ID do PoolBudget aprovado que origina a obra' })
  @IsString()
  budgetId!: string;

  @ApiPropertyOptional({ description: 'Data prevista de início (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data prevista de término (ISO)' })
  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
