/* ═══════════════════════════════════════════════════════════════
   FINANCIAL TYPES — v1.00.17 Financeiro Expandido
   ═══════════════════════════════════════════════════════════════ */

export type FinancialEntryType = 'RECEIVABLE' | 'PAYABLE';
export type FinancialEntryStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

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

export const ENTRY_TYPE_CONFIG: Record<FinancialEntryType, { label: string; icon: string }> = {
  RECEIVABLE: { label: 'A Receber', icon: '📥' },
  PAYABLE:    { label: 'A Pagar',   icon: '📤' },
};
