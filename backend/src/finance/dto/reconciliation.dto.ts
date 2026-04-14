import { IsString, IsOptional, IsInt, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MatchLineDto {
  @IsOptional()
  @IsString()
  entryId?: string;

  @IsOptional()
  @IsString()
  installmentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  liquidCents?: number;

  @IsOptional()
  @IsInt()
  taxCents?: number;

  // Plano de contas a aplicar no entry ao conciliar (quando vazio ou alterando)
  @IsOptional()
  @IsString()
  financialAccountId?: string;
}

export class MatchAsRefundDto {
  @IsString()
  pairedLineId: string;

  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EntryAccountAssignmentDto {
  @IsString()
  entryId!: string;

  @IsString()
  financialAccountId!: string;
}

export class MatchCardInvoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  entryIds!: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  // Atribuicao de plano de contas para entries sem categoria (entryId -> financialAccountId).
  // Necessario se a empresa tem plano configurado e algum entry nao tem financialAccountId preenchido.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryAccountAssignmentDto)
  entryAccountAssignments?: EntryAccountAssignmentDto[];
}
