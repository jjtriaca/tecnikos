import { IsString, IsOptional, IsBoolean, IsInt, IsNotEmpty } from 'class-validator';

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
}
