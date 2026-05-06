import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PoolDimensionsDto } from './pool-dimensions.dto';

export class CreatePoolBudgetDto {
  @ApiProperty()
  @IsString()
  clientPartnerId!: string;

  @ApiPropertyOptional({ description: 'Template a usar (auto-cria os items se enviado)' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Layout de impressão padrão pra esse orçamento' })
  @IsOptional()
  @IsString()
  printLayoutId?: string;

  @ApiProperty({ example: 'Piscina Residencial — Sr. João' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Notas internas (não aparecem pro cliente)' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Termos e condições (visíveis pro cliente)' })
  @IsOptional()
  @IsString()
  termsConditions?: string;

  @ApiProperty({ type: PoolDimensionsDto })
  @ValidateNested()
  @Type(() => PoolDimensionsDto)
  poolDimensions!: PoolDimensionsDto;

  @ApiPropertyOptional({
    description: 'Parâmetros ambientais (temperatura, capa térmica, região solar, etc.)',
  })
  @IsOptional()
  @IsObject()
  environmentParams?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @ApiPropertyOptional({ description: 'Desconto em centavos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountCents?: number;

  @ApiPropertyOptional({ description: 'Desconto em percentual (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Imposto em percentual (0-100). taxesCents e calculado automaticamente.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxesPercent?: number;

  @ApiPropertyOptional({ description: 'Data de inicio da obra (ISO). endDate e calculada automaticamente.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Garantia dos equipamentos (texto livre)' })
  @IsOptional()
  @IsString()
  equipmentWarranty?: string;

  @ApiPropertyOptional({ description: 'Garantia da obra em geral (ex: "5 anos")' })
  @IsOptional()
  @IsString()
  workWarranty?: string;

  @ApiPropertyOptional({ description: 'Forma de pagamento (texto livre)' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Desconto pra pagamento antecipado em % (informativo)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earlyPaymentDiscountPct?: number;
}
