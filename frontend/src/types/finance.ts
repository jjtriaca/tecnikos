/* ═══════════════════════════════════════════════════════════════
   FINANCIAL TYPES — v2.00 Financeiro Completo
   ═══════════════════════════════════════════════════════════════ */

export type FinancialEntryType = 'RECEIVABLE' | 'PAYABLE';
export type FinancialEntryStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'RENEGOTIATED';

export interface FinancialEntry {
  id: string;
  companyId: string;
  serviceOrderId?: string;
  partnerId?: string;
  type: FinancialEntryType;
  status: FinancialEntryStatus;
  description?: string;
  grossCents: number;
  commissionBps?: number;
  commissionCents?: number;
  netCents: number;
  dueDate?: string;
  paidAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  notes?: string;
  paymentMethod?: string;
  cardBrand?: string;
  cancelledReason?: string;
  cancelledByName?: string;
  createdAt: string;
  updatedAt: string;
  serviceOrder?: { id: string; title: string; status: string };
  partner?: { id: string; name: string };

  // v2.00 — Installment & Renegotiation
  installmentCount?: number;
  interestType?: 'SIMPLE' | 'COMPOUND';
  interestRateMonthly?: number;
  penaltyPercent?: number;
  penaltyFixedCents?: number;
  parentEntryId?: string;
  renegotiatedAt?: string;
  renegotiatedToId?: string;
  installments?: FinancialInstallment[];
  parentEntry?: { id: string; description?: string; grossCents: number; netCents: number };

  // v3.00 — NFS-e
  nfseStatus?: string | null;       // NOT_ISSUED | PROCESSING | AUTHORIZED | ERROR | CANCELLED
  nfseEmissionId?: string | null;

  // v1.01 — Plano de Contas
  financialAccountId?: string | null;
  financialAccount?: { id: string; code: string; name: string } | null;
}

export interface FinancialInstallment {
  id: string;
  financialEntryId: string;
  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  interestCents: number;
  penaltyCents: number;
  discountCents: number;
  totalCents: number;
  status: InstallmentStatus;
  paidAt?: string;
  paidAmountCents?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* v3.00 — Payment Methods, Cash Accounts, Reconciliation */

export interface PaymentMethod {
  id: string;
  companyId: string;
  name: string;
  code: string;
  isActive: boolean;
  feePercent?: number | null;
  receivingDays?: number | null;
  requiresBrand: boolean;
  requiresCheckData: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CashAccount {
  id: string;
  companyId: string;
  name: string;
  type: 'CAIXA' | 'BANCO';
  bankCode?: string | null;
  bankName?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  accountType?: 'CORRENTE' | 'POUPANCA' | null;
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA' | null;
  pixKey?: string | null;
  initialBalanceCents: number;
  currentBalanceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AccountTransfer {
  id: string;
  companyId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  description?: string | null;
  transferDate: string;
  createdByName: string;
  createdAt: string;
  fromAccount?: CashAccount;
  toAccount?: CashAccount;
}

export interface BankStatementImport {
  id: string;
  companyId: string;
  cashAccountId: string;
  fileName: string;
  fileType: string;
  importedAt: string;
  importedByName: string;
  lineCount: number;
  matchedCount: number;
}

export type StatementLineStatus = 'UNMATCHED' | 'MATCHED' | 'IGNORED';

export interface BankStatementLine {
  id: string;
  importId: string;
  cashAccountId: string;
  transactionDate: string;
  description: string;
  amountCents: number;
  fitId?: string | null;
  checkNum?: string | null;
  refNum?: string | null;
  status: StatementLineStatus;
  matchedEntryId?: string | null;
  matchedInstallmentId?: string | null;
  matchedAt?: string | null;
  matchedByName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CollectionRule {
  id: string;
  companyId: string;
  name: string;
  daysAfterDue: number;
  actionType: string;
  messageTemplate?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionExecution {
  id: string;
  companyId: string;
  collectionRuleId: string;
  financialEntryId?: string;
  installmentId?: string;
  status: string;
  actionType: string;
  message?: string;
  error?: string;
  executedAt: string;
}

export interface OverdueAgingReport {
  buckets: {
    '0-30': AgingBucket;
    '31-60': AgingBucket;
    '61-90': AgingBucket;
    '90+': AgingBucket;
  };
  totalOverdueCents: number;
  totalOverdueCount: number;
}

export interface AgingBucket {
  count: number;
  totalCents: number;
}

export interface FinanceSummaryV2 {
  receivables: SummaryBlock;
  payables: SummaryBlock;
  balanceCents: number;
}

export interface SummaryBlock {
  pendingCents: number;
  confirmedCents: number;
  paidCents: number;
  pendingCount: number;
  confirmedCount: number;
  paidCount: number;
}

/* Status display helpers */

export const ENTRY_STATUS_CONFIG: Record<FinancialEntryStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  PENDING:   { label: 'Pendente',   color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  CONFIRMED: { label: 'Confirmado', color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200' },
  PAID:      { label: 'Pago',       color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  CANCELLED: { label: 'Cancelado',  color: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
};

export const INSTALLMENT_STATUS_CONFIG: Record<InstallmentStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  PENDING:      { label: 'Pendente',     color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  PAID:         { label: 'Pago',         color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  OVERDUE:      { label: 'Vencida',      color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  CANCELLED:    { label: 'Cancelada',    color: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  RENEGOTIATED: { label: 'Renegociada',  color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
};

export type NfseStatusType = 'NOT_ISSUED' | 'PROCESSING' | 'AUTHORIZED' | 'ERROR' | 'CANCELLED';

export const NFSE_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  NOT_ISSUED:  { label: 'Sem NFS-e',     color: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  PROCESSING:  { label: 'Processando',   color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  AUTHORIZED:  { label: 'Autorizada',    color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  ERROR:       { label: 'Erro',          color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  CANCELLED:   { label: 'Cancelada',     color: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
};

export const ENTRY_TYPE_CONFIG: Record<FinancialEntryType, { label: string; icon: string }> = {
  RECEIVABLE: { label: 'A Receber', icon: '📥' },
  PAYABLE:    { label: 'A Pagar',   icon: '📤' },
};

/* Card Settlement (Baixa de Cartoes) */

export type CardSettlementStatus = 'PENDING' | 'SETTLED' | 'CANCELLED';

export interface CardSettlement {
  id: string;
  companyId: string;
  financialEntryId: string;
  paymentMethodCode?: string;
  cardBrand?: string;
  grossCents: number;
  feePercent: number;
  feeCents: number;
  expectedNetCents: number;
  expectedDate: string;
  receivingDays: number;
  status: CardSettlementStatus;
  settledAt?: string;
  actualAmountCents?: number;
  differenceCents?: number;
  cashAccountId?: string;
  settledByName?: string;
  notes?: string;
  createdAt: string;
  cardFeeRateId?: string;
  financialEntry?: {
    id: string;
    description?: string;
    partner?: { id: string; name: string };
  };
  cardFeeRate?: {
    id: string;
    description: string;
    brand: string;
  };
}

export interface CardSettlementSummary {
  pendingCount: number;
  pendingAmountCents: number;
  expectedThisWeekCount: number;
  expectedThisWeekCents: number;
  overdueCount: number;
  overdueCents: number;
}

export interface CardFeeRate {
  id: string;
  companyId: string;
  description: string;
  brand: string;
  type: string; // CREDITO | DEBITO
  installmentFrom: number;
  installmentTo: number;
  feePercent: number;
  receivingDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CARD_BRANDS = [
  'Visa',
  'Mastercard',
  'Elo',
  'Hipercard',
  'American Express',
  'Outros',
] as const;

export const CARD_TYPES = [
  { value: 'CREDITO', label: 'Credito' },
  { value: 'DEBITO', label: 'Debito' },
] as const;

export const CARD_SETTLEMENT_STATUS_CONFIG: Record<CardSettlementStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  PENDING:   { label: 'Pendente',  color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  SETTLED:   { label: 'Baixado',   color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  CANCELLED: { label: 'Cancelado', color: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
};

export const ACTION_TYPE_OPTIONS = [
  { value: 'STATUS_CHANGE', label: 'Alterar Status' },
  { value: 'INTEREST_APPLY', label: 'Aplicar Juros' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'ENVIAR_RELATORIO', label: 'Enviar Relatorio' },
];

// ═══════════════════════════════════════════════════════════════
//   FINANCIAL ACCOUNTS (Plano de Contas) — v1.01
// ═══════════════════════════════════════════════════════════════

export type FinancialAccountType = 'REVENUE' | 'EXPENSE' | 'COST';

export interface FinancialAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: FinancialAccountType;
  parentId?: string | null;
  level: number;
  allowPosting: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: FinancialAccount[];
  parent?: { id: string; code: string; name: string };
  _count?: { entries: number; children: number };
}

export const ACCOUNT_TYPE_CONFIG: Record<FinancialAccountType, { label: string; color: string; bgColor: string }> = {
  REVENUE: { label: 'Receita', color: 'text-green-700', bgColor: 'bg-green-50' },
  COST:    { label: 'Custo',   color: 'text-amber-700', bgColor: 'bg-amber-50' },
  EXPENSE: { label: 'Despesa', color: 'text-red-700',   bgColor: 'bg-red-50' },
};
