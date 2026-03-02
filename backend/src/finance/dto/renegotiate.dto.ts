import { IsOptional, IsInt, Min, IsDateString, IsNumber, IsString } from 'class-validator';

export class RenegotiateDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  newAmountCents?: number; // New total amount (if changing)

  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number; // Number of new installments (if splitting)

  @IsOptional()
  @IsDateString()
  firstDueDate?: string; // First due date for new installments

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number; // Days between installments (default: 30)

  @IsOptional()
  @IsNumber()
  interestRateMonthly?: number;

  @IsOptional()
  @IsNumber()
  penaltyPercent?: number;

  @IsOptional()
  @IsInt()
  penaltyFixedCents?: number;

  @IsOptional()
  interestType?: 'SIMPLE' | 'COMPOUND';

  @IsOptional()
  @IsString()
  notes?: string;
}
