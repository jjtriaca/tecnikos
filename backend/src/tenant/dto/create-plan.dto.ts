import { IsString, IsInt, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  maxUsers: number;

  @IsInt()
  @Min(0)
  maxOsPerMonth: number;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearlyCents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}
