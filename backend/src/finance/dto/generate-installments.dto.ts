import { IsInt, Min, IsDateString, IsOptional, IsNumber } from 'class-validator';

export class GenerateInstallmentsDto {
  @IsInt()
  @Min(2)
  count: number; // Number of installments (min 2)

  @IsDateString()
  firstDueDate: string; // Date of first installment

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number; // Days between installments (default: 30)

  @IsOptional()
  @IsNumber()
  interestRateMonthly?: number; // Monthly interest rate % (e.g. 2.0)

  @IsOptional()
  @IsNumber()
  penaltyPercent?: number; // Penalty % (e.g. 2.0)

  @IsOptional()
  @IsInt()
  penaltyFixedCents?: number; // Fixed penalty in cents

  @IsOptional()
  interestType?: 'SIMPLE' | 'COMPOUND'; // Default: SIMPLE
}
