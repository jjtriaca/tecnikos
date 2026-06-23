import { IsString, IsOptional, IsInt, Min, IsDateString, IsArray, ArrayNotEmpty } from 'class-validator';

/**
 * Deposito de cheque(s) de terceiro em carteira: move o saldo do Caixa pra conta de transito
 * "Cheques a Compensar" e marca cada cheque como depositado (checkOutKind='DEPOSIT'). O banco
 * de destino (targetBankAccountId) e so informativo — a compensacao real acontece na conciliacao
 * do extrato (transito -> banco). v1.13.86 (Fase 2a).
 */
export class DepositChecksDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  checkEntryIds: string[];

  @IsOptional()
  @IsString()
  targetBankAccountId?: string; // conta BANCO onde o cheque sera depositado (informativo)

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  transferDate?: string;
}

export class CreateTransferDto {
  @IsString()
  fromAccountId: string;

  @IsString()
  toAccountId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  transferDate?: string;
}
