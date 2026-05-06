import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PoolPaymentTermPartDto {
  @ApiProperty({ example: 'Entrada' })
  @IsString()
  @MaxLength(60)
  label!: string;

  @ApiProperty({ description: '% do total geral pra esse bloco (0-100)' })
  @IsNumber()
  @Min(0)
  percent!: number;

  @ApiProperty({ description: 'Quantidade de parcelas no bloco', example: 1 })
  @IsInt()
  @Min(1)
  count!: number;

  @ApiProperty({ description: 'Dias entre parcelas do bloco (0 = todas no mesmo dia)', example: 30 })
  @IsInt()
  @Min(0)
  intervalDays!: number;

  @ApiProperty({ description: 'Dias da startDate ate a 1a parcela do bloco', example: 0 })
  @IsInt()
  @Min(0)
  firstOffsetDays!: number;
}

export class CreatePoolPaymentTermDto {
  @ApiProperty({ example: '33% Entrada + 10x quinzenal' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ type: [PoolPaymentTermPartDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PoolPaymentTermPartDto)
  structure!: PoolPaymentTermPartDto[];
}

export class UpdatePoolPaymentTermDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: [PoolPaymentTermPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoolPaymentTermPartDto)
  structure?: PoolPaymentTermPartDto[];
}
