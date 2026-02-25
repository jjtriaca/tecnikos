import { IsString, IsOptional, IsInt, IsEnum, IsNotEmpty, IsDateString, IsBoolean } from 'class-validator';

export class CreateFinancialEntryDto {
  @IsEnum(['RECEIVABLE', 'PAYABLE'])
  type: 'RECEIVABLE' | 'PAYABLE';

  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

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
}

export class UpdateFinancialEntryDto {
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
}
