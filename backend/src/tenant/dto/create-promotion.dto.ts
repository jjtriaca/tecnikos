import { IsString, IsOptional, IsInt, IsNumber, IsBoolean, IsArray, IsDateString, Min } from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsInt()
  discountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsOptional()
  @IsArray()
  applicablePlans?: string[];

  @IsOptional()
  @IsInt()
  maxUses?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  skipPayment?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
