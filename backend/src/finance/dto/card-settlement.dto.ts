import { IsInt, IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class SettleCardDto {
  @IsInt()
  actualAmountCents: number;

  @IsString()
  cashAccountId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BatchSettleCardDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsString()
  cashAccountId: string;

  @IsOptional()
  @IsBoolean()
  useExpectedAmounts?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
