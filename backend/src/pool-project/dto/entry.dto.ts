import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoolEntryType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Lançamento no livro caixa da obra. Substitui a aba Lancamentos da planilha.
 */
export class CreatePoolProjectEntryDto {
  @ApiPropertyOptional({ description: 'Item do orçamento associado (pra comparar realizado vs orçado)' })
  @IsOptional()
  @IsString()
  budgetItemId?: string;

  @ApiProperty({ description: 'Data do lançamento (ISO)' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'Nome do fornecedor (texto livre)' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ description: 'ID do Partner se cadastrado como fornecedor' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiProperty({ example: '5 sacos cimento CP-V' })
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceCents?: number;

  @ApiProperty({ description: 'Total em centavos (digitado direto OU calculado)' })
  @IsInt()
  @Min(0)
  totalCents!: number;

  @ApiProperty({ enum: PoolEntryType })
  @IsEnum(PoolEntryType)
  type!: PoolEntryType;

  @ApiPropertyOptional({ example: 'PIX' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Se true, gera FinancialEntry no Financeiro geral do tenant',
  })
  @IsOptional()
  @IsBoolean()
  reflectsInFinance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePoolProjectEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalCents?: number;

  @ApiPropertyOptional({ enum: PoolEntryType })
  @IsOptional()
  @IsEnum(PoolEntryType)
  type?: PoolEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
