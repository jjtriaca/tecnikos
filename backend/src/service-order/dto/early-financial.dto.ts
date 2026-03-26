import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EarlyFinancialDto {
  @IsBoolean()
  launchReceivable: boolean;

  @IsBoolean()
  launchPayable: boolean;

  @IsOptional()
  @IsString()
  receivableDueDate?: string;

  @IsOptional()
  @IsString()
  payableDueDate?: string;

  @IsOptional()
  @IsString()
  receivableAccountId?: string;

  @IsOptional()
  @IsString()
  payableAccountId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  cardBrand?: string;

  @IsOptional()
  @IsString()
  cardFeeRateId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number;
}
