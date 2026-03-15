import { IsString, IsOptional, IsInt, IsBoolean, IsArray, Min } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  commissionBps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultQty?: number;

  @IsOptional()
  @IsArray()
  checklists?: Array<{ name: string; items: string[] }>;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
