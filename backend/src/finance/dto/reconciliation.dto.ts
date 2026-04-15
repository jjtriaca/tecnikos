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

/**
 * Concilia uma linha do extrato criando uma AccountTransfer
 * (deposito em dinheiro, transferencia entre contas, etc).
 * O sistema cria a transferencia entre a conta externa (sourceAccountId)
 * e a conta do extrato (line.cashAccountId), respeitando o sinal do amountCents.
 */
export class MatchAsTransferDto {
  // Conta externa — a OUTRA ponta da transferencia (a conta do extrato e inferida pela linha).
  // Se linha e credito (amount > 0): source = conta de origem (ex: Caixa) -> destino = conta do extrato
  // Se linha e debito (amount < 0): source = conta de destino -> origem e a conta do extrato
  @IsString()
  sourceAccountId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
