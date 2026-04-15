import { IsString, IsOptional, IsBoolean, IsInt, IsNotEmpty, IsNumber, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FeeRateItemDto {
  @IsInt()
  @Min(1)
  @Max(48)
  installmentFrom!: number;

  @IsInt()
  @Min(1)
  @Max(48)
  installmentTo!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivingDays?: number;
}

export class CreatePaymentInstrumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Forma de pagamento é obrigatória' })
  paymentMethodId: string;

  @IsOptional()
  @IsString()
  cardLast4?: string;

  @IsOptional()
  @IsString()
  cardBrand?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  billingClosingDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  billingDueDay?: number;

  // Direcao do uso — pelo menos 1 precisa ser true (validado no service)
  @IsOptional()
  @IsBoolean()
  showInReceivables?: boolean;

  @IsOptional()
  @IsBoolean()
  showInPayables?: boolean;

  // Comportamento ao lancar
  @IsOptional()
  @IsBoolean()
  autoMarkPaid?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivingDays?: number;

  // UX: quando true, backend cria CashAccount dedicada ao instrumento (ignora cashAccountId informado)
  @IsOptional()
  @IsBoolean()
  createExclusiveAccount?: boolean;

  // Taxas de parcelamento embutidas (substitui cadastro separado de CardFeeRate)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeRateItemDto)
  feeRates?: FeeRateItemDto[];
}

export class UpdatePaymentInstrumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  cardLast4?: string;

  @IsOptional()
  @IsString()
  cardBrand?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  billingClosingDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  billingDueDay?: number;

  @IsOptional()
  @IsBoolean()
  showInReceivables?: boolean;

  @IsOptional()
  @IsBoolean()
  showInPayables?: boolean;

  @IsOptional()
  @IsBoolean()
  autoMarkPaid?: boolean;

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
  createExclusiveAccount?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeRateItemDto)
  feeRates?: FeeRateItemDto[];
}
