import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ChatIASendMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @MaxLength(4000)
  content: string;
}
