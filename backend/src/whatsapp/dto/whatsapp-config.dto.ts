import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateWhatsAppConfigDto {
  @IsString()
  @IsNotEmpty()
  metaAccessToken: string;

  @IsString()
  @IsNotEmpty()
  metaPhoneNumberId: string;

  @IsOptional()
  @IsString()
  metaWabaId?: string;
}
