import { IsString, IsOptional, IsNumber, IsDateString, IsArray, Min, Matches, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceOrderDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  addressText: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Valor deve ser positivo' })
  valueCents: number;

  @IsDateString({}, { message: 'Data de prazo inválida' })
  deadlineAt: string;

  @IsOptional()
  @IsString()
  workflowTemplateId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Cliente e obrigatorio' })
  clientPartnerId: string;

  // Endereço estruturado (v1.00.09)
  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressNumber?: string;

  @IsOptional()
  @IsString()
  addressComp?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve ter 2 letras maiúsculas (UF)' })
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  cep?: string;

  // Atribuição de técnico (v1.00.24)
  @IsOptional()
  @IsString()
  techAssignmentMode?: string; // 'BY_SPECIALIZATION' | 'DIRECTED' | 'BY_WORKFLOW'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSpecializationIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  directedTechnicianIds?: string[];

  @IsOptional()
  @IsString()
  contactPersonName?: string;

  // Tempo para aceitar (v1.00.34) — null = usa do fluxo
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Tempo para aceitar deve ser pelo menos 1 minuto' })
  acceptTimeoutMinutes?: number;

  // Tempo para clicar a caminho (v1.00.35) — null = usa do fluxo
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Tempo para clicar a caminho deve ser pelo menos 1 minuto' })
  enRouteTimeoutMinutes?: number;
}
