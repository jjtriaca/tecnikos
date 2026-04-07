import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBoletoDto {
  @ApiPropertyOptional({ description: 'ID do lancamento financeiro' })
  @IsOptional()
  @IsString()
  financialEntryId?: string;

  @ApiPropertyOptional({ description: 'ID da parcela especifica' })
  @IsOptional()
  @IsString()
  installmentId?: string;

  @ApiPropertyOptional({ description: 'ID do parceiro (sacado)' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiProperty({ description: 'Valor em centavos' })
  @IsNumber()
  @Min(1)
  amountCents: number;

  @ApiProperty({ description: 'Data de vencimento' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Data de emissao (default: hoje)' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seuNumero?: string;

  // Override dos defaults do config
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  interestType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  interestValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  penaltyPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  discountDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions3?: string;

  @ApiPropertyOptional({ description: 'Registrar no banco imediatamente', default: true })
  @IsOptional()
  @IsBoolean()
  registerImmediately?: boolean;
}

export class CreateBoletosForEntryDto {
  @ApiProperty({ description: 'ID do lancamento financeiro' })
  @IsString()
  financialEntryId: string;

  @ApiPropertyOptional({ description: 'Registrar no banco imediatamente', default: true })
  @IsOptional()
  @IsBoolean()
  registerImmediately?: boolean;
}

export class CancelBoletoDto {
  @ApiPropertyOptional({ description: 'Motivo do cancelamento' })
  @IsOptional()
  @IsString()
  reason?: string;
}
