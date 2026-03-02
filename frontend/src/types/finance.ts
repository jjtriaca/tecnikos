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

export const ENTRY_TYPE_CONFIG: Record<FinancialEntryType, { label: string; icon: string }> = {
  RECEIVABLE: { label: 'A Receber', icon: '📥' },
  PAYABLE:    { label: 'A Pagar',   icon: '📤' },
};

export const ACTION_TYPE_OPTIONS = [
  { value: 'STATUS_CHANGE', label: 'Alterar Status' },
  { value: 'INTEREST_APPLY', label: 'Aplicar Juros' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'E-mail' },
];
