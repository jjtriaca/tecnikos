import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

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
  @Min(0)
  techFixedValueCents?: number;

  @IsOptional()
  @IsString()
  commissionRule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultQty?: number;

  @IsOptional()
  checklists?: {
    toolsPpe?: string[];
    materials?: string[];
    initialCheck?: string[];
    finalCheck?: string[];
    custom?: string[];
  };

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
