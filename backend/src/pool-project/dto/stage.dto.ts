import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolSection, PoolStageStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePoolStageDto {
  @ApiProperty({ enum: PoolSection })
  @IsEnum(PoolSection)
  poolSection!: PoolSection;

  @ApiProperty({ example: 'Escavação e gabarito' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

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

export class UpdatePoolStageDto {
  @ApiPropertyOptional({ enum: PoolStageStatus })
  @IsOptional()
  @IsEnum(PoolStageStatus)
  status?: PoolStageStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: string;

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
