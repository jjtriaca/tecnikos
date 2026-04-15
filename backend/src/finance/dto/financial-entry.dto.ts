import { IsString, IsOptional, IsInt, IsEnum, IsNotEmpty, IsDateString, IsBoolean, Min, IsNumber } from 'class-validator';

export class CreateFinancialEntryDto {
  @IsEnum(['RECEIVABLE', 'PAYABLE'])
  type: 'RECEIVABLE' | 'PAYABLE';

  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Parceiro e obrigatorio' })
  partnerId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  grossCents: number;

  @IsOptional()
  @IsInt()
  commissionBps?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  installmentCount?: number;

  @IsOptional()
  interestType?: 'SIMPLE' | 'COMPOUND';

  @IsOptional()
  @IsNumber()
  interestRateMonthly?: number;

  @IsOptional()
  @IsNumber()
  penaltyPercent?: number;

  @IsOptional()
  @IsInt()
  penaltyFixedCents?: number;

  @IsOptional()
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  // Meio de pagamento/recebimento (instrumento) — quando preenchido, sistema:
  //  (1) seta o campo paymentInstrumentId no entry
  //  (2) se o instrumento tem autoMarkPaid=true, entry nasce com status PAID e cashAccount atualizado
  @IsOptional()
  @IsString()
  paymentInstrumentId?: string;

  // Conta caixa/banco — usado tanto em criacao PENDING (sem efeito no saldo ainda) quanto em autoMarkPaid (conta inicial)
  @IsOptional()
  @IsString()
  cashAccountId?: string;
}

export class UpdateFinancialEntryDto {
  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  grossCents?: number;

  @IsOptional()
  @IsInt()
  commissionBps?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  financialAccountId?: string;
}

export class ChangeEntryStatusDto {
  @IsEnum(['PAID', 'CANCELLED', 'REVERSED'])
  status: 'PAID' | 'CANCELLED' | 'REVERSED';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paidAt?: string; // ISO date string — defaults to now() if not provided

  @IsOptional()
  @IsString()
  cardBrand?: string;

  @IsOptional()
  @IsString()
  cancelledReason?: string;

  @IsOptional()
  @IsString()
  cancelledByName?: string;

  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  cardFeeRateId?: string;

  @IsOptional()
  @IsString()
  paymentInstrumentId?: string;

  // Check (cheque) data fields
  @IsOptional()
  @IsString()
  checkNumber?: string;

  @IsOptional()
  @IsString()
  checkBank?: string;

  @IsOptional()
  @IsString()
  checkAgency?: string;

  @IsOptional()
  @IsString()
  checkAccount?: string;

  @IsOptional()
  @IsString()
  checkClearanceDate?: string;

  @IsOptional()
  @IsString()
  checkHolder?: string;
}
