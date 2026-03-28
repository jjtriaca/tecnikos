import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, Min } from 'class-validator';

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
}
