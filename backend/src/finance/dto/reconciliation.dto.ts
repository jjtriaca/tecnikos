import { IsString, IsOptional, IsInt } from 'class-validator';

export class MatchLineDto {
  @IsOptional()
  @IsString()
  entryId?: string;

  @IsOptional()
  @IsString()
  installmentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  liquidCents?: number;

  @IsOptional()
  @IsInt()
  taxCents?: number;
}

export class MatchAsRefundDto {
  @IsString()
  pairedLineId: string;

  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
