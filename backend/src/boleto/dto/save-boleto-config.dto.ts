import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveBoletoConfigDto {
  @ApiProperty({ description: 'Codigo do banco (ex: 077, 748, 001)' })
  @IsString()
  bankCode: string;

  @ApiProperty({ description: 'Nome do banco' })
  @IsString()
  bankName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  // Credenciais (encrypted)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateBase64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificatePassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  bankSpecificConfig?: Record<string, any>;

  @ApiPropertyOptional({ default: 'SANDBOX' })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  convenio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carteira?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  especie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  especieDoc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aceite?: string;

  // Defaults juros/multa/desconto
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultInterestType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultInterestValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultPenaltyPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultDiscountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultDiscountValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDiscountDaysBefore?: number;

  // Instrucoes
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultInstructions1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultInstructions2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultInstructions3?: string;

  // Comportamento
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoRegisterOnEntry?: boolean;
}
