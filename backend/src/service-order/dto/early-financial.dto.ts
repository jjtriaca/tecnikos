import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

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

  // 4 ultimos digitos do cartao do cliente (em recebimentos via cartao)
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Ultimos 4 digitos devem ser 4 numeros.' })
  receivedCardLast4?: string;
}
