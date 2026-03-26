import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SendQuoteDto {
  @IsOptional()
  @IsString()
  deliveryMethod?: string; // Override: WHATSAPP_LINK | WHATSAPP_MESSAGE | EMAIL_LINK

  @IsOptional()
  @IsString()
  message?: string; // Custom message to include

  @IsOptional()
  @IsBoolean()
  sendWhatsApp?: boolean;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
