import { IsString, IsOptional, IsInt, IsEnum, IsNotEmpty, IsDateString, IsBoolean, Min, IsNumber } from 'class-validator';

export class CreateFinancialEntryDto {
  @IsEnum(['RECEIVABLE', 'PAYABLE'])
  type: 'RECEIVABLE' | 'PAYABLE';

  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Parceiro e obrigatorio' })
  partnerId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  grossCents: number;

  @IsOptional()
  @IsInt()
  commissionBps?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  installmentCount?: number;

  @IsOptional()
  interestType?: 'SIMPLE' | 'COMPOUND';

  @IsOptional()
  @IsNumber()
  interestRateMonthly?: number;

  @IsOptional()
  @IsNumber()
  penaltyPercent?: number;

  @IsOptional()
  @IsInt()
  penaltyFixedCents?: number;
}

export class UpdateFinancialEntryDto {
  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  grossCents?: number;

  @IsOptional()
  @IsInt()
  commissionBps?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ChangeEntryStatusDto {
  @IsEnum(['CONFIRMED', 'PAID', 'CANCELLED'])
  status: 'CONFIRMED' | 'PAID' | 'CANCELLED';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  cardBrand?: string;

  @IsOptional()
  @IsString()
  cancelledReason?: string;

  @IsOptional()
  @IsString()
  cancelledByName?: string;
}
