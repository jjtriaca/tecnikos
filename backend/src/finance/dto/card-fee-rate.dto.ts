import { IsString, IsNumber, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CreateCardFeeRateDto {
  @IsString()
  description: string; // Ex: "Visa Crédito 1x"

  @IsString()
  brand: string; // Visa, Mastercard, Elo, etc.

  @IsString()
  type: string; // CREDITO, DEBITO

  @IsInt()
  @Min(1)
  installmentFrom: number;

  @IsInt()
  @Min(1)
  installmentTo: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent: number;

  @IsInt()
  @Min(0)
  receivingDays: number;
}

export class UpdateCardFeeRateDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivingDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
