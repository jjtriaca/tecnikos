import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Origens possiveis de um relatorio (EngineReporter biblia). null/ausente = POOL_BUDGET (legado).
export const REPORT_SOURCE_TYPES = [
  'POOL_BUDGET',
  'QUOTE',
  'SERVICE_ORDER',
  'FIN_RECEIVABLE',
  'FIN_PAYABLE',
] as const;

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

  @ApiPropertyOptional({
    description: 'Origem dos dados do relatorio (EngineReporter). Default POOL_BUDGET.',
    enum: REPORT_SOURCE_TYPES,
  })
  @IsOptional()
  @IsIn(REPORT_SOURCE_TYPES as unknown as string[])
  sourceType?: string;

  @ApiPropertyOptional({ description: '(Obras) modelo de obra alvo (PoolBudgetTemplate.id) que escopa etapas/linhas' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateId?: string;
}

export class UpdatePoolPrintLayoutDto extends PartialType(CreatePoolPrintLayoutDto) {}
