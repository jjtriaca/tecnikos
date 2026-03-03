import { IsString, IsOptional, IsBoolean, IsNumber, IsInt, Min } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  feePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivingDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresBrand?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresCheckData?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  feePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivingDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresBrand?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresCheckData?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
