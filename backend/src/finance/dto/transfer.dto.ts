import { IsString, IsOptional, IsInt, Min, IsDateString } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  fromAccountId: string;

  @IsString()
  toAccountId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  transferDate?: string;
}
