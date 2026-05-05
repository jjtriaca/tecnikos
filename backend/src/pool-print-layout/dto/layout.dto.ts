import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePoolPrintLayoutDto {
  @ApiProperty({ example: 'Padrão' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Marca como layout default do tenant' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Branding: logo, cores, fonte, footer',
    example: {
      logoUrl: '/uploads/abc/logo.png',
      primaryColor: '#1a73e8',
      accentColor: '#fbbc04',
      fontFamily: 'Roboto, sans-serif',
      footerHtml: '<p>Empresa XYZ — CNPJ ...</p>',
    },
  })
  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePoolPrintLayoutDto extends PartialType(CreatePoolPrintLayoutDto) {}
