"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useFiscalModule } from "@/contexts/FiscalModuleContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Link from "next/link";
import LookupField from "@/components/ui/LookupField";
import { maskCurrency, parseCurrencyToCents } from "@/lib/brazil-utils";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import type {
  FinancialEntry,
  FinancialEntryType,
  FinancialEntryStatus,
  FinanceSummaryV2,
  PaymentMethod,
  PaymentInstrument,
  CardFeeRate,
} from "@/types/finance";
import { ENTRY_STATUS_CONFIG, NFSE_STATUS_CONFIG } from "@/types/finance";
import GenerateInstallmentsModal from "./components/GenerateInstallmentsModal";
import InstallmentDetailModal from "./components/InstallmentDetailModal";
import RenegotiationModal from "./components/RenegotiationModal";
import NfseEmissionModal from "./components/NfseEmissionModal";
import CollectionRulesTab from "./components/CollectionRulesTab";
import PaymentMethodsTab from "./components/PaymentMethodsTab";
import PaymentInstrumentsTab from "./components/PaymentInstrumentsTab";
import CashAccountsTab from "./components/CashAccountsTab";
import ReconciliationTab from "./components/ReconciliationTab";
import CardSettlementTab from "./components/CardSettlementTab";
import FinancialReportModal from "./components/FinancialReportModal";


interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/* ── Helpers ────────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ── Tab definitions ───────────────────────────────────── */

type TabId = "resumo" | "receber" | "pagar" | "parcelas" | "cartoes" | "contas" | "conciliacao" | "formas" | "instrumentos" | "cobranca";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "resumo", label: "Resumo", icon: "📊" },
  { id: "receber", label: "A Receber", icon: "📥" },
  { id: "pagar", label: "A Pagar", icon: "📤" },
  { id: "parcelas", label: "Parcelas", icon: "📑" },
  { id: "cartoes", label: "Baixa Cartoes", icon: "🔻" },
  { id: "contas", label: "Caixas/Bancos", icon: "🏦" },
  { id: "conciliacao", label: "Conciliacao", icon: "🔄" },
  { id: "formas", label: "Formas Pgto", icon: "💳" },
  { id: "instrumentos", label: "Instrumentos", icon: "🏷️" },
  { id: "cobranca", label: "Cobranca", icon: "⚡" },
];

/* ── StatusBadge ───────────────────────────────────────── */

function StatusBadge({ status }: { status: FinancialEntryStatus }) {
  const cfg = ENTRY_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
      {cfg.label}
    </span>
  );
}

/* ── Entry Filters ─────────────────────────────────────── */

const ENTRY_FILTERS: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "Todos",
    options: [
      { value: "PENDING", label: "Pendente" },
      { value: "CONFIRMED", label: "Confirmado" },
      { value: "PAID", label: "Pago" },
      { value: "CANCELLED", label: "Cancelado" },
    ],
  },
  { key: "dateFrom", label: "De", type: "date" },
  { key: "dateTo", label: "Até", type: "date" },
];

/* ── Partner lookup ────────────────────────────────────── */

type PartnerSummary = { id: string; name: string; document: string | null; phone: string | null };

const partnerFetcher: LookupFetcher<PartnerSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<PartnerSummary>>(
    `/partners?${params.toString()}`,
    { signal },
  );
};

/* ── Payment method options ────────────────────────────── */

/** Cached payment methods from API (loaded by EntriesTab) */
let _cachedPaymentMethods: PaymentMethod[] = [];

function paymentMethodLabel(method?: string, brand?: string) {
  if (!method) return "—";
  const pm = _cachedPaymentMethods.find((p) => p.code === method);
  const label = pm?.name || method;
  if (brand && pm?.requiresBrand) {
    return `${label} (${brand})`;
  }
  return label;
}

/* ── Entry Columns ─────────────────────────────────────── */

function buildEntryColumns(type: FinancialEntryType): ColumnDefinition<FinancialEntry>[] {
  const cols: ColumnDefinition<FinancialEntry>[] = [
    {
      id: "actions",
      label: "Ações",
      render: () => null as any,
    },
    {
      id: "code",
      label: "Código",
      sortable: true,
      render: (e) => <span className="font-mono text-xs text-slate-500">{e.code || "—"}</span>,
    },
    {
      id: "description",
      label: "Descrição",
      render: (e) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-900 truncate block" title={e.description || ""}>
            {e.description || "(sem descrição)"}
          </span>
          {e.installmentCount && e.installmentCount > 0 && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap">
              {e.installmentCount}x
            </span>
          )}
          {e.parentEntryId && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200 whitespace-nowrap">
              Reneg.
            </span>
          )}
          {e.dueDate && new Date(e.dueDate) < new Date() && e.status !== "PAID" && e.status !== "CANCELLED" && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
              Vencida
            </span>
          )}
        </div>
      ),
    },
    {
      id: "os",
      label: "OS",
      render: (e) =>
        e.serviceOrder ? (
          <Link href={`/orders/${e.serviceOrder.id}`} className="text-sm text-blue-600 hover:underline truncate block">
            {e.serviceOrder.title}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "partner",
      label: "Parceiro",
      render: (e) =>
        e.partner ? (
          <span className="text-sm text-slate-700 truncate block" title={e.partner.name}>{e.partner.name}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "category",
      label: "Categoria",
      render: (e) =>
        e.financialAccount ? (
          <span className="text-xs text-slate-600 truncate block" title={`${e.financialAccount.code} - ${e.financialAccount.name}`}>
            {e.financialAccount.name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  if (type === "PAYABLE") {
    cols.push({
      id: "grossCents",
      label: "Bruto",
      sortable: true,
      align: "right",
      render: (e) => <span className="text-slate-700">{formatCurrency(e.grossCents)}</span>,
    });
    cols.push({
      id: "commission",
      label: "Comissão",
      align: "right",
      render: (e) =>
        e.commissionCents != null ? (
          <span className="text-amber-600 text-xs">
            -{formatCurrency(e.commissionCents)}
            {e.commissionBps != null && (
              <span className="ml-1 text-slate-400">({(e.commissionBps / 100).toFixed(1)}%)</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    });
  }

  cols.push(
    {
      id: "netCents",
      label: "Valor",
      sortable: true,
      align: "right",
      render: (e) => (
        <span className={`font-semibold ${type === "RECEIVABLE" ? "text-green-700" : "text-blue-700"}`}>
          {formatCurrency(e.netCents)}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      id: "nfseStatus",
      label: "NFS-e",
      render: (e) => {
        const st = e.nfseStatus || "NOT_ISSUED";
        const cfg = NFSE_STATUS_CONFIG[st] || NFSE_STATUS_CONFIG.NOT_ISSUED;
        return (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      id: "dueDate",
      label: "Vencimento",
      sortable: true,
      align: "right",
      render: (e) =>
        e.dueDate ? (
          <span className="text-sm text-slate-500">{formatDate(e.dueDate)}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "createdAt",
      label: "Criado",
      sortable: true,
      align: "right",
      render: (e) => <span className="text-sm text-slate-500">{formatDate(e.createdAt)}</span>,
    },
    {
      id: "reason",
      label: "Registro",
      render: (e) => {
        if (e.cancelledReason) {
          return (
            <span className="text-xs text-slate-600 truncate block" title={e.cancelledReason}>
              {e.cancelledReason}
            </span>
          );
        }
        if (e.notes) {
          // Show last log line as tooltip, extract reason from notes
          const lines = e.notes.split("\n").filter((l: string) => l.startsWith("["));
          if (lines.length > 0) {
            const last = lines[lines.length - 1];
            return (
              <span className="text-xs text-slate-600 truncate block cursor-help" title={e.notes}>
                {last.replace(/^\[.*?\]\s*/, "")}
              </span>
            );
          }
        }
        return <span className="text-xs text-slate-400">—</span>;
      },
    },
  );

  return cols;
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function FinancePage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const tabParam = searchParams.get("tab");

  const initialTab = useMemo<TabId>(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) return tabParam as TabId;
    if (typeParam === "RECEIVABLE") return "receber";
    if (typeParam === "PAYABLE") return "pagar";
    return "resumo";
  }, [typeParam, tabParam]);

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Sync when URL changes (e.g. browser back/forward)
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-500">
            Controle de receitas, despesas, comissões e repasses.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "resumo" && <SummaryTab onNavigateTab={setActiveTab} />}
      {activeTab === "receber" && <EntriesTab type="RECEIVABLE" />}
      {activeTab === "pagar" && <EntriesTab type="PAYABLE" />}
      {activeTab === "parcelas" && <InstallmentsOverviewTab />}
      {activeTab === "cartoes" && <CardSettlementTab />}
      {activeTab === "contas" && <CashAccountsTab />}
      {activeTab === "conciliacao" && <ReconciliationTab />}
      {activeTab === "formas" && <PaymentMethodsTab />}
      {activeTab === "instrumentos" && <PaymentInstrumentsTab />}
      {activeTab === "cobranca" && <CollectionRulesTab />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB: RESUMO (Summary v2)
   ══════════════════════════════════════════════════════════ */

function SummaryTab({ onNavigateTab }: { onNavigateTab?: (tab: TabId) => void }) {
  const [data, setData] = useState<FinanceSummaryV2 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FinanceSummaryV2>("/finance/summary-v2")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
        Erro ao carregar dados financeiros.
      </div>
    );
  }

  const { receivables: r, payables: p } = data;

  return (
    <div className="space-y-6">
      {/* A Receber */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
          <span>📥</span> A Receber
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total Pendente"
            value={formatCurrency(r.pendingCents + r.confirmedCents)}
            count={r.pendingCount + r.confirmedCount}
            colorClass="border-amber-200 bg-amber-50"
            valueColor="text-amber-900"
            onClick={() => onNavigateTab?.("receber")}
          />
          <SummaryCard
            label="Recebido"
            value={formatCurrency(r.paidCents)}
            count={r.paidCount}
            colorClass="border-green-200 bg-green-50"
            valueColor="text-green-900"
            onClick={() => onNavigateTab?.("receber")}
          />
          <SummaryCard
            label="Aguardando Confirmação"
            value={String(r.pendingCount)}
            sub="entradas pendentes"
            colorClass="border-slate-200 bg-slate-50"
            valueColor="text-slate-900"
            onClick={() => onNavigateTab?.("receber")}
          />
        </div>
      </div>

      {/* A Pagar */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
          <span>📤</span> A Pagar
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total Pendente"
            value={formatCurrency(p.pendingCents + p.confirmedCents)}
            count={p.pendingCount + p.confirmedCount}
            colorClass="border-amber-200 bg-amber-50"
            valueColor="text-amber-900"
            onClick={() => onNavigateTab?.("pagar")}
          />
          <SummaryCard
            label="Pago"
            value={formatCurrency(p.paidCents)}
            count={p.paidCount}
            colorClass="border-blue-200 bg-blue-50"
            valueColor="text-blue-900"
            onClick={() => onNavigateTab?.("pagar")}
          />
          <SummaryCard
            label="Aguardando Confirmação"
            value={String(p.pendingCount)}
            sub="entradas pendentes"
            colorClass="border-slate-200 bg-slate-50"
            valueColor="text-slate-900"
            onClick={() => onNavigateTab?.("pagar")}
          />
        </div>
      </div>

      {/* Saldo */}
      <div className="rounded-xl border-2 border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">Saldo (Recebido - Pago)</p>
            <p className={`text-3xl font-bold mt-1 ${data.balanceCents >= 0 ? "text-green-700" : "text-red-700"}`}>
              {formatCurrency(data.balanceCents)}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
            {data.balanceCents >= 0 ? "📈" : "📉"}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  count,
  sub,
  colorClass,
  valueColor,
  onClick,
}: {
  label: string;
  value: string;
  count?: number;
  sub?: string;
  colorClass: string;
  valueColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${colorClass} ${onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all" : ""}`}
      onClick={onClick}
    >
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <p className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</p>
      {count != null && (
        <p className="mt-0.5 text-xs text-slate-500">{count} entrada{count !== 1 ? "s" : ""}</p>
      )}
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB: ENTRIES (A Receber / A Pagar)
   ══════════════════════════════════════════════════════════ */

function EntriesTab({ type }: { type: FinancialEntryType }) {
  const { user } = useAuth();
  const { fiscalEnabled } = useFiscalModule();
  const tp = useTableParams({ defaultSortBy: "createdAt", defaultSortOrder: "desc", defaultFilters: { status: "PENDING" } });
  const allColumns = buildEntryColumns(type);
  const columns = fiscalEnabled ? allColumns : allColumns.filter((c) => c.id !== "nfseStatus");
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout(
    `finance-v3-${type}`,
    columns,
  );
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Cancel with reason
  const [cancelAction, setCancelAction] = useState<{ entry: FinancialEntry } | null>(null);
  const [reverseAction, setReverseAction] = useState<{ entry: FinancialEntry } | null>(null);

  // Pay/Confirm with payment method
  const [payAction, setPayAction] = useState<{ entry: FinancialEntry; action: "CONFIRMED" | "PAID" } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedCardRateId, setSelectedCardRateId] = useState("");
  const [activePMs, setActivePMs] = useState<PaymentMethod[]>([]);
  const [cardFeeRates, setCardFeeRates] = useState<CardFeeRate[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<{ id: string; name: string; type: string; currentBalanceCents: number }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [availableInstruments, setAvailableInstruments] = useState<PaymentInstrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // New entry modal
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ description: "", grossCents: "", dueDate: "", notes: "", financialAccountId: "" });
  const [selectedPartner, setSelectedPartner] = useState<PartnerSummary | null>(null);
  const [postableAccounts, setPostableAccounts] = useState<{ id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } }[]>([]);

  // v2.00 — Installment & Renegotiation modals
  const [installmentModal, setInstallmentModal] = useState<{ entryId: string; netCents: number } | null>(null);
  const [detailModal, setDetailModal] = useState<{ entryId: string; description?: string } | null>(null);
  const [renegotiateModal, setRenegotiateModal] = useState<{ entryId: string; description?: string; netCents: number } | null>(null);

  // v3.00 — NFS-e emission modal
  const [nfseModal, setNfseModal] = useState<string | null>(null); // financialEntryId
  const [nfseWarnEntry, setNfseWarnEntry] = useState<{ entry: FinancialEntry; action: "CONFIRMED" | "PAID" } | null>(null);

  // Edit entry modal
  const [editEntry, setEditEntry] = useState<FinancialEntry | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const { toast } = useToast();

  // Determine if selected payment method is a card and filter available brands
  const isCardPayment = useMemo(() => {
    const pm = activePMs.find((p) => p.code === paymentMethod);
    return !!pm?.requiresBrand;
  }, [paymentMethod, activePMs]);

  // Determine card type (CREDITO/DEBITO) from payment method
  const cardType = useMemo(() => {
    const pm = activePMs.find((p) => p.code === paymentMethod);
    if (!pm || !pm.requiresBrand) return "";
    const text = (pm.code + " " + pm.name).toUpperCase();
    const isDebit = text.includes("DEBIT") || text.includes("DÉBITO") || text.includes("DEBITO");
    return isDebit ? "DEBITO" : "CREDITO";
  }, [paymentMethod, activePMs]);

  // Filter card fee rates by type
  const filteredCardRates = useMemo(() => {
    if (!cardType) return [];
    return cardFeeRates.filter((r) => r.type === cardType && r.isActive);
  }, [cardType, cardFeeRates]);

  // Selected card rate object
  const selectedCardRate = useMemo(() => {
    if (!selectedCardRateId) return null;
    return cardFeeRates.find((r) => r.id === selectedCardRateId) || null;
  }, [selectedCardRateId, cardFeeRates]);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const qs = tp.buildQueryString();
      const result = await api.get<PaginatedResponse<FinancialEntry>>(
        `/finance/entries?type=${type}&${qs}`,
      );
      setEntries(result.data);
      setMeta(result.meta);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString, type]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load active payment methods and accounts for dropdowns
  useEffect(() => {
    api.get<PaymentMethod[]>("/finance/payment-methods/active")
      .then((pms) => { setActivePMs(pms); _cachedPaymentMethods = pms; })
      .catch(() => {});
    api.get<{ id: string; name: string; type: string; currentBalanceCents: number }[]>("/finance/cash-accounts/active")
      .then(setActiveAccounts)
      .catch(() => {});
    api.get<CardFeeRate[]>("/finance/card-fee-rates")
      .then(setCardFeeRates)
      .catch(() => {});
    api.get<{ id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } }[]>("/finance/accounts/postable")
      .then(setPostableAccounts)
      .catch(() => {});
  }, []);

  function openEditEntry(e: FinancialEntry) {
    setEditEntry(e);
    setEditDesc(e.description || "");
    setEditAccountId(e.financialAccount?.id || "");
    setEditNotes(e.notes || "");
  }

  async function handleSaveEdit() {
    if (!editEntry) return;
    setEditSaving(true);
    try {
      await api.patch(`/finance/entries/${editEntry.id}`, {
        description: editDesc || undefined,
        financialAccountId: editAccountId || undefined,
        notes: editNotes || undefined,
      });
      toast("Lancamento atualizado!", "success");
      setEditEntry(null);
      loadEntries();
    } catch {
      toast("Erro ao atualizar.", "error");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCancel(reason: string) {
    if (!cancelAction) return;
    const { entry } = cancelAction;
    setActionLoading(entry.id);
    try {
      await api.patch(`/finance/entries/${entry.id}/status`, {
        status: "CANCELLED",
        cancelledReason: reason,
        cancelledByName: user?.name || user?.email || "Desconhecido",
      });
      toast("Entrada cancelada com sucesso!", "success");
      setCancelAction(null);
      await loadEntries();
    } catch {
      toast("Erro ao cancelar entrada.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReverseWithReason(reason: string) {
    if (!reverseAction) return;
    const { entry } = reverseAction;
    setActionLoading(entry.id);
    try {
      await api.patch(`/finance/entries/${entry.id}/status`, {
        status: "REVERSED",
        notes: `[ESTORNO] ${reason}`,
        cancelledByName: user?.name || user?.email || "Desconhecido",
      });
      toast("Recebimento estornado com sucesso!", "success");
      setReverseAction(null);
      await loadEntries();
    } catch {
      toast("Erro ao estornar recebimento.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePayConfirm() {
    if (!payAction) return;
    if (!paymentMethod) {
      toast("Selecione a forma de pagamento.", "error");
      return;
    }
    const selectedPM = activePMs.find((p) => p.code === paymentMethod);
    if (selectedPM?.requiresBrand && !selectedCardRateId) {
      toast("Selecione o cartao.", "error");
      return;
    }
    const { entry, action } = payAction;
    setActionLoading(entry.id);
    try {
      const isCard = !!selectedPM?.requiresBrand;
      await api.patch(`/finance/entries/${entry.id}/status`, {
        status: action,
        paymentMethod,
        cardBrand: isCard && selectedCardRate ? selectedCardRate.brand : undefined,
        cardFeeRateId: isCard ? selectedCardRateId : undefined,
        cashAccountId: isCard ? undefined : (selectedAccountId || undefined),
        paymentInstrumentId: selectedInstrumentId || undefined,
      });
      const labels: Record<string, string> = { CONFIRMED: "confirmada", PAID: "paga" };
      toast(`Entrada ${labels[action]} com sucesso!`, "success");
      setPayAction(null);
      setPaymentMethod("");
      setSelectedCardRateId("");
      setSelectedAccountId("");
      setSelectedInstrumentId("");
      setAvailableInstruments([]);
      await loadEntries();
    } catch {
      toast("Erro ao atualizar status.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateEntry() {
    if (!selectedPartner) {
      toast("Selecione um parceiro.", "error");
      return;
    }
    const gross = parseCurrencyToCents(formData.grossCents);
    if (!gross || gross <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/finance/entries", {
        type,
        partnerId: selectedPartner.id,
        description: formData.description || undefined,
        grossCents: gross,
        dueDate: formData.dueDate || undefined,
        notes: formData.notes || undefined,
        financialAccountId: formData.financialAccountId || undefined,
      });
      toast("Entrada criada com sucesso!", "success");
      setShowNewForm(false);
      setFormData({ description: "", grossCents: "", dueDate: "", notes: "", financialAccountId: "" });
      setSelectedPartner(null);
      await loadEntries();
    } catch {
      toast("Erro ao criar entrada.", "error");
    } finally {
      setSaving(false);
    }
  }

  const typeLabel = type === "RECEIVABLE" ? "A Receber" : "A Pagar";
  const typeColor = type === "RECEIVABLE" ? "green" : "blue";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {typeLabel}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {meta.total} registro{meta.total !== 1 ? "s" : ""}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReportModal(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            title="Gerar Relatorio PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Relatorio PDF
          </button>
          <button
            onClick={() => setShowNewForm(true)}
            className={`rounded-lg bg-${typeColor}-600 px-3 py-2 text-sm font-semibold text-white hover:bg-${typeColor}-700 transition-colors`}
          >
            + Nova Entrada
          </button>
        </div>
      </div>

      <FilterBar
        filters={ENTRY_FILTERS}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por descrição, OS ou parceiro..."
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            {tp.search || Object.keys(tp.filters).length > 0
              ? "Nenhuma entrada encontrada com os filtros selecionados."
              : `Nenhuma entrada ${typeLabel.toLowerCase()} criada ainda.`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm" style={{ overflowX: "auto", overflowY: "hidden" }}>
          <table className="text-sm" style={{ tableLayout: "fixed", minWidth: "700px", width: "max-content" }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {orderedColumns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    index={idx}
                    columnId={col.id}
                    onReorder={reorderColumns}
                    onResize={setColumnWidth}
                    width={columnWidths[col.id]}
                    className={col.headerClassName || ""}
                  >
                    {col.sortable ? (
                      <SortableHeader
                        as="div"
                        label={col.label}
                        column={col.sortKey || col.id}
                        currentColumn={tp.sort.column}
                        currentOrder={tp.sort.order}
                        onToggle={tp.toggleSort}
                        align={col.align}
                      />
                    ) : (
                      <div className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${col.align === "right" ? "text-right" : ""}`}>
                        {col.label}
                      </div>
                    )}
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {orderedColumns.map((col) => {
                    const w = columnWidths[col.id];
                    const tdStyle: React.CSSProperties = w ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden" } : {};
                    if (col.id === "actions") {
                      return (
                        <td key={col.id} style={tdStyle} className="py-3 px-4">
                          <EntryActions
                            entry={e}
                            type={type}
                            loading={actionLoading === e.id}
                            onAction={async (action) => {
                              if (action === "REVERSED") {
                                setReverseAction({ entry: e });
                                return;
                              }
                              if (action === "CANCELLED") {
                                setCancelAction({ entry: e });
                              } else if (fiscalEnabled && type === "RECEIVABLE" && e.nfseStatus !== "AUTHORIZED") {
                                // Check NFS-e before payment on receivables (only when fiscal module is enabled)
                                try {
                                  const check = await api.get<{ requiresNfse: boolean; behavior: string; nfseStatus: string | null }>(
                                    `/nfse-emission/check-payment/${e.id}`,
                                  );
                                  if (check.requiresNfse && check.behavior === "BLOCK") {
                                    toast("NFS-e obrigatoria! Emita a nota antes de receber.", "error");
                                    setNfseModal(e.id);
                                    return;
                                  }
                                  if (check.requiresNfse && check.behavior === "WARN") {
                                    setNfseWarnEntry({ entry: e, action });
                                    return;
                                  }
                                } catch { /* config not found, proceed */ }
                                setPayAction({ entry: e, action });
                              } else {
                                setPayAction({ entry: e, action });
                              }
                            }}
                            onInstallments={() => setInstallmentModal({ entryId: e.id, netCents: e.netCents })}
                            onViewInstallments={() => setDetailModal({ entryId: e.id, description: e.description })}
                            onRenegotiate={() => setRenegotiateModal({ entryId: e.id, description: e.description, netCents: e.netCents })}
                            onEmitNfse={fiscalEnabled && type === "RECEIVABLE" ? () => setNfseModal(e.id) : undefined}
                            onEdit={() => openEditEntry(e)}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={col.id} style={tdStyle} className={`py-3 px-4 ${col.className || ""} ${col.align === "right" ? "text-right" : ""}`}>
                        {col.render(e)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination meta={meta} onPageChange={tp.setPage} />

      {/* Cancel modal — requires reason (min 10 chars) */}
      <ConfirmModal
        open={!!cancelAction}
        title="Cancelar Entrada"
        message={
          cancelAction
            ? `Deseja cancelar a entrada "${cancelAction.entry.description || "(sem descrição)"}" (${formatCurrency(cancelAction.entry.netCents)})?`
            : ""
        }
        confirmLabel="Cancelar Entrada"
        variant="danger"
        loading={!!actionLoading}
        reasonRequired
        reasonMinLength={10}
        reasonPlaceholder="Informe o motivo do cancelamento (mín. 10 caracteres)..."
        onConfirm={() => {}}
        onConfirmWithReason={handleCancel}
        onCancel={() => setCancelAction(null)}
      />

      {/* Reverse modal */}
      <ConfirmModal
        open={!!reverseAction}
        title="Estornar Recebimento"
        message={
          reverseAction
            ? `Deseja estornar o recebimento "${reverseAction.entry.description || "(sem descrição)"}" (${formatCurrency(reverseAction.entry.netCents)})? O saldo da conta será revertido e o lançamento voltará para "Confirmado".`
            : ""
        }
        confirmLabel="Estornar"
        variant="danger"
        loading={!!actionLoading}
        reasonRequired
        reasonMinLength={10}
        reasonPlaceholder="Informe o motivo do estorno (mín. 10 caracteres)..."
        onConfirm={() => {}}
        onConfirmWithReason={handleReverseWithReason}
        onCancel={() => setReverseAction(null)}
      />

      {/* Payment method modal */}
      {payAction && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setPayAction(null); setPaymentMethod(""); setSelectedCardRateId(""); setSelectedInstrumentId(""); setAvailableInstruments([]); }} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">
                  {type === "RECEIVABLE" ? "Receber" : "Pagar"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {`${type === "RECEIVABLE" ? "Receber" : "Pagar"} "${payAction.entry.description || "(sem descrição)"}" — ${formatCurrency(payAction.entry.netCents)}`}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Forma de {type === "RECEIVABLE" ? "Recebimento" : "Pagamento"} *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const code = e.target.value;
                    setPaymentMethod(code);
                    setSelectedCardRateId("");
                    setSelectedInstrumentId("");
                    // Load instruments for this payment method
                    const pm = activePMs.find((p) => p.code === code);
                    if (pm) {
                      api.get<PaymentInstrument[]>(`/finance/payment-instruments/by-method/${pm.id}`)
                        .then(setAvailableInstruments)
                        .catch(() => setAvailableInstruments([]));
                    } else {
                      setAvailableInstruments([]);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {activePMs.map((m) => (
                    <option key={m.code} value={m.code}>{m.name}</option>
                  ))}
                </select>
              </div>

              {isCardPayment && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cartao *</label>
                  {filteredCardRates.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                      <p className="font-medium">Nenhum cartao cadastrado para {cardType === "DEBITO" ? "debito" : "credito"}.</p>
                      <p className="mt-1">Cadastre as taxas na aba <strong>Baixa Cartoes</strong> → Configurar Taxas por Bandeira.</p>
                    </div>
                  ) : (
                    <select
                      value={selectedCardRateId}
                      onChange={(e) => setSelectedCardRateId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">Selecione o cartao...</option>
                      {filteredCardRates.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.description || `${r.brand} ${r.type === "CREDITO" ? "Credito" : "Debito"} ${r.installmentFrom}x`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Fee preview for selected card */}
              {isCardPayment && selectedCardRate && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400">Bandeira</span>
                      <p className="font-medium text-slate-700">{selectedCardRate.brand}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Taxa</span>
                      <p className="font-medium text-slate-700">{selectedCardRate.feePercent.toFixed(2)}%</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Recebimento</span>
                      <p className="font-medium text-slate-700">{selectedCardRate.receivingDays} dias</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-blue-600">
                    O saldo do caixa sera atualizado na baixa (aba Baixa Cartoes).
                  </p>
                </div>
              )}

              {/* Card info when no card selected yet */}
              {isCardPayment && !selectedCardRate && filteredCardRates.length > 0 && (
                <p className="text-[10px] text-blue-600">
                  O saldo do caixa sera atualizado na baixa (aba Baixa Cartoes).
                </p>
              )}

              {/* Cash account (optional — hidden for card payments) */}
              {activeAccounts.length > 0 && !isCardPayment && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Conta/Caixa</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Nenhuma (nao atualizar saldo)</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type === "CAIXA" ? "Caixa" : "Banco"}) — {formatCurrency(a.currentBalanceCents)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-slate-400">Selecione para atualizar o saldo automaticamente</p>
                </div>
              )}

              {/* Payment Instrument (optional) */}
              {paymentMethod && availableInstruments.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Instrumento</label>
                  <select
                    value={selectedInstrumentId}
                    onChange={(e) => setSelectedInstrumentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Nenhum (generico)</option>
                    {availableInstruments.map((pi) => (
                      <option key={pi.id} value={pi.id}>
                        {pi.name}
                        {pi.cardLast4 ? ` (*${pi.cardLast4})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-slate-400">Selecione o instrumento especifico para conciliacao</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setPayAction(null); setPaymentMethod(""); setSelectedCardRateId(""); setSelectedAccountId(""); setSelectedInstrumentId(""); setAvailableInstruments([]); }}
                disabled={!!actionLoading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handlePayConfirm}
                disabled={!!actionLoading || !paymentMethod || !!(activePMs.find((p) => p.code === paymentMethod)?.requiresBrand && !selectedCardRateId)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processando...
                  </span>
                ) : (
                  type === "RECEIVABLE" ? "Receber" : "Pagar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Nova Entrada — {typeLabel}
            </h3>
            <div className="space-y-3">
              <LookupField
                label="Parceiro *"
                placeholder="Selecione um parceiro"
                modalTitle="Buscar Parceiro"
                modalPlaceholder="Nome, documento ou telefone..."
                value={selectedPartner}
                displayValue={(p) => p.name}
                onChange={(p) => setSelectedPartner(p)}
                fetcher={partnerFetcher}
                keyExtractor={(p) => p.id}
                required
                renderItem={(p) => (
                  <div>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                      {p.document && <span>{p.document}</span>}
                      {p.phone && <span>{p.phone}</span>}
                    </div>
                  </div>
                )}
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Pagamento serviço técnico"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.grossCents}
                    onChange={(e) => setFormData({ ...formData, grossCents: maskCurrency(e.target.value) })}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vencimento</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                <select
                  value={formData.financialAccountId}
                  onChange={(e) => setFormData({ ...formData, financialAccountId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Sem categoria</option>
                  {(() => {
                    const grouped = new Map<string, typeof postableAccounts>();
                    for (const acc of postableAccounts) {
                      const parentName = acc.parent?.name || "Outros";
                      if (!grouped.has(parentName)) grouped.set(parentName, []);
                      grouped.get(parentName)!.push(acc);
                    }
                    return Array.from(grouped.entries()).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Notas opcionais..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setFormData({ description: "", grossCents: "", dueDate: "", notes: "", financialAccountId: "" });
                  setSelectedPartner(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateEntry}
                disabled={saving}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                  type === "RECEIVABLE"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {saving ? "Salvando..." : "Criar Entrada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v2.00 — Generate Installments Modal */}
      {installmentModal && (
        <GenerateInstallmentsModal
          entryId={installmentModal.entryId}
          entryNetCents={installmentModal.netCents}
          open={true}
          onClose={() => setInstallmentModal(null)}
          onSuccess={() => { setInstallmentModal(null); loadEntries(); }}
        />
      )}

      {/* v2.00 — Installment Detail Modal */}
      {detailModal && (
        <InstallmentDetailModal
          entryId={detailModal.entryId}
          entryDescription={detailModal.description}
          open={true}
          onClose={() => setDetailModal(null)}
          onSuccess={() => { setDetailModal(null); loadEntries(); }}
        />
      )}

      {/* v2.00 — Renegotiation Modal */}
      {renegotiateModal && (
        <RenegotiationModal
          entryId={renegotiateModal.entryId}
          entryDescription={renegotiateModal.description}
          entryNetCents={renegotiateModal.netCents}
          open={true}
          onClose={() => setRenegotiateModal(null)}
          onSuccess={() => { setRenegotiateModal(null); loadEntries(); }}
        />
      )}

      {/* v3.00 — NFS-e Emission Modal (only when fiscal module is enabled) */}
      {fiscalEnabled && nfseModal && (
        <NfseEmissionModal
          financialEntryId={nfseModal}
          open={true}
          onClose={() => setNfseModal(null)}
          onSuccess={() => { setNfseModal(null); loadEntries(); }}
        />
      )}

      {/* v3.00 — NFS-e Warning before payment */}
      {fiscalEnabled && nfseWarnEntry && (
        <ConfirmModal
          open={true}
          title="NFS-e nao emitida"
          message="Esta conta a receber nao possui NFS-e emitida. Deseja continuar sem emitir ou emitir agora?"
          confirmLabel="Continuar sem NFS-e"
          cancelLabel="Emitir NFS-e"
          onConfirm={() => {
            setPayAction({ entry: nfseWarnEntry.entry, action: nfseWarnEntry.action });
            setNfseWarnEntry(null);
          }}
          onCancel={() => {
            setNfseModal(nfseWarnEntry.entry.id);
            setNfseWarnEntry(null);
          }}
        />
      )}

      {/* Financial Report Modal */}
      <FinancialReportModal
        open={showReportModal}
        defaultType={type}
        onClose={() => setShowReportModal(false)}
      />

      {/* Edit Entry Modal */}
      {editEntry && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditEntry(null)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Editar Lancamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Descricao do lancamento..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Sem categoria</option>
                  {(() => {
                    const grouped = new Map<string, typeof postableAccounts>();
                    for (const acc of postableAccounts) {
                      const parentName = acc.parent ? `${acc.parent.code} - ${acc.parent.name}` : "Sem grupo";
                      if (!grouped.has(parentName)) grouped.set(parentName, []);
                      grouped.get(parentName)!.push(acc);
                    }
                    return Array.from(grouped.entries()).map(([group, accs]) => (
                      <optgroup key={group} label={group}>
                        {accs.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observacoes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Observacoes opcionais..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditEntry(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                {editSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Entry Action Buttons ──────────────────────────────── */

function EntryActions({
  entry,
  type,
  loading,
  onAction,
  onInstallments,
  onViewInstallments,
  onRenegotiate,
  onEmitNfse,
  onEdit,
}: {
  entry: FinancialEntry;
  type: FinancialEntryType;
  loading: boolean;
  onAction: (action: "CONFIRMED" | "PAID" | "CANCELLED" | "REVERSED") => void;
  onInstallments: () => void;
  onViewInstallments: () => void;
  onRenegotiate: () => void;
  onEmitNfse?: () => void;
  onEdit?: () => void;
}) {
  const { toast } = useToast();
  if (loading) {
    return <span className="text-xs text-slate-400 animate-pulse">Processando...</span>;
  }

  const confirmLabel = type === "RECEIVABLE" ? "Receber" : "Pagar";
  const statusButtons: { label: string; action: "CONFIRMED" | "PAID" | "CANCELLED" | "REVERSED"; className: string }[] = [];

  if (entry.status === "PENDING") {
    statusButtons.push(
      { label: confirmLabel, action: "CONFIRMED", className: "text-blue-600 hover:text-blue-800" },
      { label: "Cancelar", action: "CANCELLED", className: "text-red-500 hover:text-red-700" },
    );
  } else if (entry.status === "CONFIRMED") {
    statusButtons.push(
      { label: confirmLabel, action: "PAID", className: "text-green-600 hover:text-green-800" },
      { label: "Cancelar", action: "CANCELLED", className: "text-red-500 hover:text-red-700" },
    );
  } else if (entry.status === "PAID") {
    statusButtons.push(
      { label: "Estornar", action: "REVERSED", className: "text-orange-600 hover:text-orange-800" },
    );
  }

  const isTerminal = entry.status === "CANCELLED" || entry.status === "PAID";
  const hasInstallments = entry.installmentCount && entry.installmentCount > 0;

  return (
    <div className="flex gap-1.5 flex-wrap">
      {/* Status actions */}
      {statusButtons.map((btn) => (
        <button
          key={btn.action}
          onClick={() => onAction(btn.action)}
          className={`text-xs font-medium ${btn.className} transition-colors`}
        >
          {btn.label}
        </button>
      ))}

      {/* Edit (3rd position) */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          title="Editar"
        >
          Editar
        </button>
      )}

      {/* View installments (only if already has them) */}
      {hasInstallments && (
        <button
          onClick={onViewInstallments}
          className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
          title="Ver parcelas"
        >
          Parcelas
        </button>
      )}

      {/* Renegotiate — only for non-terminal entries */}
      {!isTerminal && (
        <button
          onClick={onRenegotiate}
          className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
          title="Renegociar"
        >
          Renegociar
        </button>
      )}

      {/* NFS-e — download PDF when authorized */}
      {type === "RECEIVABLE" && onEmitNfse && entry.nfseStatus === "AUTHORIZED" && entry.nfseEmissionId && (
        <button
          onClick={async () => {
            try {
              const token = getAccessToken();
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/nfse-emission/emissions/${entry.nfseEmissionId}/pdf`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) throw new Error("Erro ao baixar PDF");
              const blob = await res.blob();
              // Extract filename from Content-Disposition header
              const cd = res.headers.get("content-disposition") || "";
              const fnMatch = cd.match(/filename="?([^";\n]+)"?/);
              const filename = fnMatch?.[1] || `NFS-e ${entry.nfseEmissionId}.pdf`;
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            } catch {
              toast("Erro ao baixar PDF da NFS-e.", "error");
            }
          }}
          className="text-xs font-medium text-green-600 hover:text-green-800 transition-colors"
          title="Baixar PDF da NFS-e"
        >
          PDF NFS-e
        </button>
      )}
      {type === "RECEIVABLE" && onEmitNfse && entry.nfseStatus !== "AUTHORIZED" && entry.nfseStatus !== "PROCESSING" && entry.status !== "CANCELLED" && (
        <button
          onClick={onEmitNfse}
          className="text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
          title="Emitir NFS-e"
        >
          NFS-e
        </button>
      )}

      {/* Show dash if terminal and no installments */}
      {isTerminal && !hasInstallments && statusButtons.length === 0 && (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB: PARCELAS (Installments Overview)
   ══════════════════════════════════════════════════════════ */

function InstallmentsOverviewTab() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<{ entryId: string; description?: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "paid">("all");

  useEffect(() => {
    async function loadEntriesWithInstallments() {
      try {
        setLoading(true);
        // Load both receivable and payable entries that have installments
        const [rec, pay] = await Promise.all([
          api.get<PaginatedResponse<FinancialEntry>>("/finance/entries?type=RECEIVABLE&limit=100"),
          api.get<PaginatedResponse<FinancialEntry>>("/finance/entries?type=PAYABLE&limit=100"),
        ]);
        const allEntries = [...rec.data, ...pay.data].filter((e) => e.installmentCount && e.installmentCount > 0);
        setEntries(allEntries);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    loadEntriesWithInstallments();
  }, []);

  const filteredEntries = entries.filter((e) => {
    if (filter === "all") return true;
    if (filter === "paid") return e.status === "PAID";
    if (filter === "pending") return e.status === "PENDING" || e.status === "CONFIRMED";
    if (filter === "overdue") return e.dueDate && new Date(e.dueDate) < new Date() && e.status !== "PAID" && e.status !== "CANCELLED";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Lançamentos com Parcelas
          <span className="ml-2 text-xs font-normal text-slate-400">
            {entries.length} lançamento{entries.length !== 1 ? "s" : ""}
          </span>
        </h3>
        <div className="flex gap-1">
          {(["all", "pending", "overdue", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {{ all: "Todos", pending: "Pendentes", overdue: "Vencidas", paid: "Pagas" }[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            {filter !== "all" ? "Nenhum lançamento encontrado com este filtro." : "Nenhum lançamento com parcelas ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((e) => {
            const isOverdue = e.dueDate && new Date(e.dueDate) < new Date() && e.status !== "PAID" && e.status !== "CANCELLED";
            return (
              <div
                key={e.id}
                className={`rounded-xl border p-4 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow ${
                  isOverdue ? "border-red-200" : "border-slate-200"
                }`}
                onClick={() => setDetailModal({ entryId: e.id, description: e.description })}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {e.description || "(sem descrição)"}
                      </span>
                      <StatusBadge status={e.status} />
                      {isOverdue && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          Vencida
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {e.type === "RECEIVABLE" ? "📥 A Receber" : "📤 A Pagar"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      {e.partner && <span className="text-xs text-slate-500">{e.partner.name}</span>}
                      <span className="text-xs text-slate-400">{e.installmentCount}x parcelas</span>
                      {e.dueDate && <span className="text-xs text-slate-400">Venc: {formatDate(e.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(e.netCents)}</p>
                    <p className="text-xs text-slate-400">Clique para ver parcelas</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Installment Detail Modal */}
      {detailModal && (
        <InstallmentDetailModal
          entryId={detailModal.entryId}
          entryDescription={detailModal.description}
          open={true}
          onClose={() => setDetailModal(null)}
          onSuccess={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}


