import { IsString, IsInt, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateCollectionRuleDto {
  @IsString()
  name: string;

  @IsInt()
  daysAfterDue: number; // Negative = before due, positive = after

  @IsString()
  actionType: string; // WHATSAPP, EMAIL, STATUS_CHANGE, INTEREST_APPLY

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCollectionRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  daysAfterDue?: number;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
