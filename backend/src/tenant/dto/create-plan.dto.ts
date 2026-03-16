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
  @Min(1, { message: 'Preço mensal deve ser maior que zero' })
  priceCents: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Preço anual deve ser maior que zero' })
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

  // Structured feature fields
  @IsOptional()
  @IsInt()
  @Min(0)
  maxTechnicians?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAiMessages?: number;

  @IsOptional()
  @IsString()
  supportLevel?: string; // EMAIL, EMAIL_CHAT, PRIORITY

  @IsOptional()
  @IsBoolean()
  allModulesIncluded?: boolean;
}
