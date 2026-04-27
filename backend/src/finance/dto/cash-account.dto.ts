import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsDateString, MinLength, Min } from 'class-validator';

export class CreateCashAccountDto {
  @IsString()
  name: string;

  @IsEnum(['CAIXA', 'BANCO'])
  type: 'CAIXA' | 'BANCO';

  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  agency?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsEnum(['CORRENTE', 'POUPANCA'])
  accountType?: 'CORRENTE' | 'POUPANCA';

  @IsOptional()
  @IsEnum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'])
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsInt()
  initialBalanceCents?: number;

  @IsOptional()
  @IsDateString()
  initialBalanceDate?: string;

  @IsOptional()
  @IsBoolean()
  showInReceivables?: boolean;

  @IsOptional()
  @IsBoolean()
  showInPayables?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCashAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['CAIXA', 'BANCO', 'TRANSITO'])
  type?: 'CAIXA' | 'BANCO' | 'TRANSITO';

  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  agency?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsEnum(['CORRENTE', 'POUPANCA'])
  accountType?: 'CORRENTE' | 'POUPANCA';

  @IsOptional()
  @IsEnum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'])
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsBoolean()
  showInReceivables?: boolean;

  @IsOptional()
  @IsBoolean()
  showInPayables?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  initialBalanceCents?: number;

  @IsOptional()
  @IsDateString()
  initialBalanceDate?: string;
}

export class RebalanceCashAccountDto {
  @IsEnum(['CREDIT', 'DEBIT'])
  direction: 'CREDIT' | 'DEBIT';

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  @MinLength(10, { message: 'Motivo deve ter ao menos 10 caracteres.' })
  reason: string;

  @IsOptional()
  @IsString()
  financialAccountId?: string;
}
