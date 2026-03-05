import { IsString, IsOptional, IsBoolean, IsInt, IsEnum } from 'class-validator';

export class CreateFinancialAccountDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(['REVENUE', 'EXPENSE', 'COST'])
  type: 'REVENUE' | 'EXPENSE' | 'COST';

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateFinancialAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
