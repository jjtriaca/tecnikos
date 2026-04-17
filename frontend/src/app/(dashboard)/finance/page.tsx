"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import CardLast4Input, { isCardPayment as isCardPaymentCheck } from "@/components/ui/CardLast4Input";
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
import { ENTRY_STATUS_CONFIG, NFSE_STATUS_CONFIG, BOLETO_STATUS_CONFIG, Boleto } from "@/types/finance";
import GenerateInstallmentsModal from "./components/GenerateInstallmentsModal";
import InstallmentDetailModal from "./components/InstallmentDetailModal";
import RenegotiationModal from "./components/RenegotiationModal";
import NfseEmissionModal from "./components/NfseEmissionModal";
import BoletoGenerationModal from "./components/BoletoGenerationModal";
import BoletoDetailModal from "./components/BoletoDetailModal";
import BoletoStatusBadge from "./components/BoletoStatusBadge";
import CollectionRulesTab from "./components/CollectionRulesTab";
import PaymentMethodsTab from "./components/PaymentMethodsTab";
import PaymentInstrumentsTab from "./components/PaymentInstrumentsTab";
import CashAccountsTab from "./components/CashAccountsTab";
import ReconciliationTab from "./components/ReconciliationTab";
import CardSettlementTab from "./components/CardSettlementTab";
import CardFeeRatesTab from "./components/CardFeeRatesTab";
import FinancialReportModal from "./components/FinancialReportModal";
import AccountsTab from "./components/AccountsTab";


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

type TabId = "resumo" | "receber" | "pagar" | "parcelas" | "cartoes" | "contas" | "conciliacao" | "formas" | "instrumentos" | "cobranca" | "plano" | "taxas";

const MAIN_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "resumo", label: "Resumo", icon: "📊" },
  { id: "receber", label: "A Receber", icon: "📥" },
  { id: "pagar", label: "A Pagar", icon: "📤" },
  { id: "parcelas", label: "Parcelas", icon: "📑" },
  { id: "cartoes", label: "Baixa Cartoes", icon: "🔻" },
  { id: "conciliacao", label: "Conciliacao", icon: "🔄" },
];

const CADASTRO_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "contas", label: "Caixas/Bancos", icon: "🏦" },
  // "Formas de Pagamento" (tipos genericos) escondido do menu principal em v1.08.100
  // — os tipos (PIX, Cartao Credito, Boleto, etc.) ja vem pre-configurados.
  // "Taxas de Cartao" escondido em v1.09.04 — taxas agora sao embutidas em cada
  // Meio de Pagamento (secao "Taxas de parcelamento" no form).
  // Admin pode acessar via URL direta /finance?tab=formas ou /finance?tab=taxas se precisar customizar.
  { id: "instrumentos", label: "Meios de Pagamento e Recebimento", icon: "💳" },
  { id: "cobranca", label: "Regras de Cobrança", icon: "⚡" },
  { id: "plano", label: "Plano de Contas", icon: "📋" },
];

const CADASTRO_TAB_IDS = new Set<TabId>(CADASTRO_TABS.map(t => t.id));

/* ── CadastrosDropdown ─────────────────────────────────── */

function CadastrosDropdown({ activeTab, onSelect }: { activeTab: TabId; onSelect: (t: TabId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = CADASTRO_TAB_IDS.has(activeTab);
  const activeLabel = isActive ? CADASTRO_TABS.find(t => t.id === activeTab)?.label : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          isActive
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
        }`}
      >
        <span>⚙️</span>
        {activeLabel || "Cadastros"}
        <svg className={`w-3.5 h-3.5 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[220px] py-1">
          {CADASTRO_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { onSelect(tab.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── StatusBadge ───────────────────────────────────────── */

function StatusBadge({ status, entryType }: { status: FinancialEntryStatus; entryType?: FinancialEntryType }) {
  const cfg = ENTRY_STATUS_CONFIG[status];
  const label = status === "PAID" && entryType === "RECEIVABLE" ? "Recebido" : cfg.label;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
      {label}
    </span>
  );
}

/* ── Entry Filters ─────────────────────────────────────── */

function getEntryFilters(type: FinancialEntryType): FilterDefinition[] {
  const filters: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "Todos",
    options: [
      { value: "PENDING", label: "Pendente" },
      { value: "OVERDUE", label: "Vencidas" },
      { value: "PAID", label: type === "RECEIVABLE" ? "Recebido" : "Pago" },
      { value: "CANCELLED", label: "Cancelado" },
    ],
  },
  {
    key: "dateType",
    label: "Periodo por",
    type: "select",
    placeholder: "Criação",
    options: [
      { value: "created", label: "Criação" },
      { value: "paid", label: type === "RECEIVABLE" ? "Recebimento" : "Pagamento" },
      { value: "due", label: "Vencimento" },
    ],
  },
  { key: "dateFrom", label: "De", type: "date" },
  { key: "dateTo", label: "Até", type: "date" },
  ];

  // NFS-e filter only for RECEIVABLE
  if (type === "RECEIVABLE") {
    filters.push({
      key: "nfseStatus",
      label: "NFS-e",
      type: "select",
      placeholder: "Todas",
      options: [
        { value: "NOT_ISSUED", label: "Sem nota" },
        { value: "AUTHORIZED", label: "Autorizada" },
        { value: "PROCESSING", label: "Processando" },
        { value: "ERROR", label: "Com erro" },
        { value: "CANCELLED", label: "Cancelada" },
      ],
    });
  }

  return filters;
}

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

/** Resolve NFS-e status: usa proprio ou herda do parentEntry (renegociacao) */
function resolveNfse(entry: FinancialEntry): { status: string; emissionId: string | null } {
  if (entry.nfseStatus) return { status: entry.nfseStatus, emissionId: entry.nfseEmissionId || null };
  const parent = (entry as any).parentEntry;
  if (parent?.nfseStatus) return { status: parent.nfseStatus, emissionId: parent.nfseEmissionId || null };
  return { status: "NOT_ISSUED", emissionId: null };
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
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-900 truncate block max-w-[200px]" title={e.description || ""}>
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
          <Link href={`/orders/${e.serviceOrder.id}`} className="text-xs text-blue-600 hover:underline truncate block max-w-[120px]">
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
          <span className="text-xs text-slate-700 truncate block max-w-[160px]" title={e.partner.name}>{e.partner.name}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "category",
      label: "Plano de Contas",
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
      render: (e) => <span className="text-xs text-slate-700">{formatCurrency(e.grossCents)}</span>,
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
        <span className={`text-xs font-semibold ${type === "RECEIVABLE" ? "text-green-700" : "text-blue-700"}`}>
          {formatCurrency(e.netCents)}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (e) => <StatusBadge status={e.status} entryType={type} />,
    },
  );

  // NFS-e column only for RECEIVABLE (we emit notes for clients)
  if (type === "RECEIVABLE") {
    cols.push({
      id: "nfseStatus",
      label: "NFS-e",
      render: (e) => {
        const { status: st } = resolveNfse(e);
        const cfg = NFSE_STATUS_CONFIG[st] || NFSE_STATUS_CONFIG.NOT_ISSUED;
        return (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
            {cfg.label}
          </span>
        );
      },
    });
  }

  // Boleto column only for RECEIVABLE
  if (type === "RECEIVABLE") {
    cols.push({
      id: "boletoStatus",
      label: "Boleto",
      render: (e) => {
        const boleto = (e as any)._boleto;
        if (!boleto) return <span className="text-xs text-slate-400">—</span>;
        return <BoletoStatusBadge status={boleto.status} />;
      },
    });
  }

  cols.push(
    {
      id: "paidAt",
      label: type === "RECEIVABLE" ? "Recebido em" : "Pago em",
      sortable: true,
      align: "right",
      render: (e) =>
        e.paidAt ? (
          <span className="text-xs text-slate-500">{formatDate(e.paidAt)}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "dueDate",
      label: "Vencimento",
      sortable: true,
      align: "right",
      render: (e) =>
        e.dueDate ? (
          <span className="text-xs text-slate-500">{formatDate(e.dueDate)}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "createdAt",
      label: "Criado",
      sortable: true,
      align: "right",
      render: (e) => <span className="text-xs text-slate-500">{formatDate(e.createdAt)}</span>,
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

  const [sysConfig, setSysConfig] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    api.get<Record<string, any>>("/companies/system-config")
      .then(setSysConfig)
      .catch(() => {});
  }, []);

  const visibleMainTabs = useMemo(() => {
    if (!sysConfig) return MAIN_TABS.filter((t) => t.id !== "cartoes");
    const show = sysConfig.financial?.showBaixaCartoes === true;
    return show ? MAIN_TABS : MAIN_TABS.filter((t) => t.id !== "cartoes");
  }, [sysConfig]);

  const initialTab = useMemo<TabId>(() => {
    const allTabs = [...visibleMainTabs, ...CADASTRO_TABS];
    if (tabParam && allTabs.some((t) => t.id === tabParam)) return tabParam as TabId;
    if (typeParam === "RECEIVABLE") return "receber";
    if (typeParam === "PAYABLE") return "pagar";
    return "resumo";
  }, [typeParam, tabParam, visibleMainTabs]);

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [resumoKey, setResumoKey] = useState(0);

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
        {visibleMainTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === "resumo") setResumoKey(k => k + 1); }}
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
        {/* Dropdown: Cadastros */}
        <CadastrosDropdown activeTab={activeTab} onSelect={setActiveTab} />
      </div>

      {/* Tab Content */}
      {activeTab === "resumo" && <SummaryTab key={`resumo-${resumoKey}`} onNavigateTab={setActiveTab} />}
      {activeTab === "receber" && <EntriesTab type="RECEIVABLE" sysConfig={sysConfig} />}
      {activeTab === "pagar" && <EntriesTab type="PAYABLE" sysConfig={sysConfig} />}
      {activeTab === "parcelas" && <InstallmentsOverviewTab />}
      {activeTab === "cartoes" && <CardSettlementTab />}
      {activeTab === "contas" && <CashAccountsTab />}
      {activeTab === "conciliacao" && <ReconciliationTab />}
      {activeTab === "formas" && <PaymentMethodsTab />}
      {activeTab === "instrumentos" && <PaymentInstrumentsTab />}
      {activeTab === "taxas" && <CardFeeRatesTab />}
      {activeTab === "cobranca" && <CollectionRulesTab />}
      {activeTab === "plano" && <AccountsTab />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB: RESUMO (Summary v2)
   ══════════════════════════════════════════════════════════ */

const SUMMARY_SECTIONS_KEY = "tecnikos_finance_summary_order_v2";
const DEFAULT_SECTION_ORDER = ["kpi", "receber_pagar", "caixas_bancos", "extrato"];

function loadSectionOrder(): string[] {
  try {
    const stored = localStorage.getItem(SUMMARY_SECTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((s: string) => DEFAULT_SECTION_ORDER.includes(s));
        const missing = DEFAULT_SECTION_ORDER.filter(s => !valid.includes(s));
        if (missing.length === 0 && valid.length === DEFAULT_SECTION_ORDER.length) return valid;
        return [...valid, ...missing];
      }
    }
  } catch {}
  return DEFAULT_SECTION_ORDER;
}

function SummaryTab({ onNavigateTab }: { onNavigateTab?: (tab: TabId) => void }) {
  const [data, setData] = useState<FinanceSummaryV2 | null>(null);
  const [dashData, setDashData] = useState<any>(null);
  const [statementData, setStatementData] = useState<any[]>([]);
  const [stmtDateFrom, setStmtDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [stmtDateTo, setStmtDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtAccountFilter, setStmtAccountFilter] = useState("all");
  const [stmtDirection, setStmtDirection] = useState("all"); // all, CREDIT (recebimento), DEBIT (pagamento)
  const [stmtPaymentType, setStmtPaymentType] = useState("all"); // all or paymentMethod code
  const [stmtInstruments, setStmtInstruments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Card-level drag within caixas_bancos
  const CARD_ORDER_KEY = "tecnikos_finance_card_order";
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  useEffect(() => { setSectionOrder(loadSectionOrder()); }, []);

  // Load card order from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CARD_ORDER_KEY);
      if (stored) setCardOrder(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    Promise.all([
      api.get<FinanceSummaryV2>("/finance/summary-v2").catch(() => null),
      api.get(`/finance/dashboard?dateFrom=${first}&dateTo=${last}`).catch(() => null),
      api.get<any[]>(`/finance/statement?limit=200&dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}`).catch(() => []),
    ]).then(([summary, dash, statement]) => {
      setData(summary);
      setDashData(dash);
      setStatementData(statement ?? []);
    }).finally(() => setLoading(false));
    // Load instruments for type filter
    api.get<any[]>("/finance/payment-instruments/active").then(setStmtInstruments).catch(() => {});
  }, []);

  const reloadStatement = useCallback(() => {
    setStmtLoading(true);
    api.get<any[]>(`/finance/statement?limit=500&dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}`)
      .then((res) => setStatementData(res ?? []))
      .catch(() => {})
      .finally(() => setStmtLoading(false));
  }, [stmtDateFrom, stmtDateTo]);

  function handleDragStart(e: React.DragEvent, sectionId: string) {
    setDraggingId(sectionId);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragEnter(sectionId: string) {
    if (draggingId && sectionId !== draggingId) setDragOverId(sectionId);
  }
  function handleDragEnd() {
    if (draggingId && dragOverId && draggingId !== dragOverId) {
      const newOrder = [...sectionOrder];
      const fromIdx = newOrder.indexOf(draggingId);
      const toIdx = newOrder.indexOf(dragOverId);
      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggingId);
        setSectionOrder(newOrder);
        localStorage.setItem(SUMMARY_SECTIONS_KEY, JSON.stringify(newOrder));
      }
    }
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleCardDragStart(e: React.DragEvent, cardId: string) {
    e.stopPropagation();
    setDraggingCardId(cardId);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleCardDragEnter(e: React.DragEvent, cardId: string) {
    e.stopPropagation();
    if (draggingCardId && cardId !== draggingCardId) setDragOverCardId(cardId);
  }
  function handleCardDragEnd(e: React.DragEvent) {
    e.stopPropagation();
    if (draggingCardId && dragOverCardId && draggingCardId !== dragOverCardId) {
      const newOrder = [...cardOrder];
      const fromIdx = newOrder.indexOf(draggingCardId);
      const toIdx = newOrder.indexOf(dragOverCardId);
      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggingCardId);
        setCardOrder(newOrder);
        localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder));
      }
    }
    setDraggingCardId(null);
    setDragOverCardId(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  const r = data?.receivables;
  const p = data?.payables;

  // KPI data (3 cards — sem "Saldo em Caixa" que já aparece em Caixas/Bancos)
  const revenue = dashData?.dre?.revenue?.totalCents ?? 0;
  const costsAndExpenses = (dashData?.dre?.costs?.totalCents ?? 0) + (dashData?.dre?.expenses?.totalCents ?? 0);
  const netResult = dashData?.dre?.netResultCents ?? 0;
  const margin = revenue > 0 ? Math.round((netResult / revenue) * 100) : 0;

  const kpiCards = [
    { label: "Receita Bruta", value: formatCurrency(revenue), gradient: "from-emerald-500 to-emerald-600", icon: "📈", badge: null as string | null },
    { label: "Custos + Despesas", value: formatCurrency(costsAndExpenses), gradient: "from-red-500 to-red-600", icon: "📉", badge: null as string | null },
    { label: "Resultado Líquido", value: formatCurrency(netResult), gradient: netResult >= 0 ? "from-blue-500 to-blue-600" : "from-red-600 to-red-700", icon: "📊", badge: `${margin}% margem` },
  ];

  const sectionMap: Record<string, { label: string; content: React.ReactNode }> = {
    kpi: {
      label: "Resultados do Mês",
      content: (
        <div className="grid grid-cols-3 gap-3">
          {kpiCards.map((card) => (
            <div key={card.label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-4 text-white shadow-lg`}>
              <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-white/5" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-lg">{card.icon}</span>
                  {card.badge && <span className="text-[10px] font-medium bg-white/20 rounded-lg px-1.5 py-0.5">{card.badge}</span>}
                </div>
                <p className="mt-2 text-xl font-bold truncate">{card.value}</p>
                <p className="text-[11px] font-medium text-white/70">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    receber_pagar: {
      label: "Contas a Receber / Pagar",
      content: data && r && p ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("receber")}>
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3"><span>📥</span> A Receber</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-slate-500">Pendente</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(r.pendingCents + r.confirmedCents)}</p>
                <p className="text-[10px] text-slate-400">{r.pendingCount + r.confirmedCount} entrada{(r.pendingCount + r.confirmedCount) !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Recebido</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(r.paidCents)}</p>
                <p className="text-[10px] text-slate-400">{r.paidCount} entrada{r.paidCount !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Ag. Confirmação</p>
                <p className="text-lg font-bold text-slate-700">{r.pendingCount}</p>
                <p className="text-[10px] text-slate-400">pendentes</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("pagar")}>
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3"><span>📤</span> A Pagar</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-slate-500">Pendente</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(p.pendingCents + p.confirmedCents)}</p>
                <p className="text-[10px] text-slate-400">{p.pendingCount + p.confirmedCount} entrada{(p.pendingCount + p.confirmedCount) !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Pago</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(p.paidCents)}</p>
                <p className="text-[10px] text-slate-400">{p.paidCount} entrada{p.paidCount !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Ag. Confirmação</p>
                <p className="text-lg font-bold text-slate-700">{p.pendingCount}</p>
                <p className="text-[10px] text-slate-400">pendentes</p>
              </div>
            </div>
          </div>
        </div>
      ) : null,
    },
    caixas_bancos: {
      label: "Caixas e Bancos",
      content: dashData?.cashAccounts ? (() => {
        const accounts = dashData.cashAccounts as { id: string; name: string; type: string; currentBalanceCents: number }[];
        const active = accounts.filter((a: any) => a.currentBalanceCents !== undefined);
        const total = active.reduce((s: number, a: any) => s + a.currentBalanceCents, 0);

        // Build ordered card list
        type CardDef = { id: string; render: () => React.ReactNode };
        const allCards: CardDef[] = [];
        allCards.push({ id: "_total", render: () => (
          <div className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("contas")}>
            <span className="text-[11px] font-medium text-green-700">Saldo Total</span>
            <p className={`mt-0.5 text-lg font-bold ${total >= 0 ? "text-green-900" : "text-red-700"}`}>{formatCurrency(total)}</p>
            <p className="text-[10px] text-slate-400">{active.length} conta{active.length !== 1 ? "s" : ""} ativa{active.length !== 1 ? "s" : ""}</p>
          </div>
        )});
        for (const a of active.filter((a: any) => a.type === "CAIXA")) {
          allCards.push({ id: a.id, render: () => (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("contas")}>
              <span className="text-[11px] font-medium text-amber-700">💰 {a.name}</span>
              <p className={`mt-0.5 text-lg font-bold ${a.currentBalanceCents >= 0 ? "text-amber-900" : "text-red-700"}`}>{formatCurrency(a.currentBalanceCents)}</p>
              <p className="text-[10px] text-slate-400">Caixa</p>
            </div>
          )});
        }
        for (const a of active.filter((a: any) => a.type === "BANCO")) {
          allCards.push({ id: a.id, render: () => (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("contas")}>
              <span className="text-[11px] font-medium text-blue-700">🏦 {a.name}</span>
              <p className={`mt-0.5 text-lg font-bold ${a.currentBalanceCents >= 0 ? "text-blue-900" : "text-red-700"}`}>{formatCurrency(a.currentBalanceCents)}</p>
              <p className="text-[10px] text-slate-400">Banco</p>
            </div>
          )});
        }
        for (const a of active.filter((a: any) => a.type === "TRANSITO")) {
          const tb = dashData.transitBreakdown as { creditsCents: number; debitsCents: number } | undefined;
          allCards.push({ id: a.id, render: () => (
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("contas")}>
              <span className="text-[11px] font-medium text-purple-700">{a.name}</span>
              <p className={`mt-0.5 text-lg font-bold ${a.currentBalanceCents >= 0 ? "text-purple-900" : "text-red-700"}`}>{formatCurrency(a.currentBalanceCents)}</p>
              {tb && (
                <div className="mt-1.5 flex gap-3">
                  <span className="text-[10px] text-green-600">▲ {formatCurrency(tb.creditsCents)}</span>
                  <span className="text-[10px] text-red-500">▼ {formatCurrency(tb.debitsCents)}</span>
                </div>
              )}
              <p className="text-[10px] text-slate-400">Em Transito</p>
            </div>
          )});
        }
        for (const a of active.filter((a: any) => a.type === "CARTAO_CREDITO")) {
          const debt = Math.abs(a.currentBalanceCents);
          const hasDebt = a.currentBalanceCents < 0;
          allCards.push({ id: a.id, render: () => (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateTab?.("contas")}>
              <span className="text-[11px] font-medium text-rose-700">&#128179; {a.name}</span>
              <p className={`mt-0.5 text-lg font-bold ${hasDebt ? "text-rose-900" : "text-slate-500"}`}>{formatCurrency(debt)}</p>
              <p className="text-[10px] text-slate-400">{hasDebt ? "Em aberto" : "Fatura quitada"}</p>
            </div>
          )});
        }

        // Apply saved card order
        const orderedCards = cardOrder.length > 0
          ? [...allCards].sort((a, b) => {
              const ai = cardOrder.indexOf(a.id);
              const bi = cardOrder.indexOf(b.id);
              if (ai === -1 && bi === -1) return 0;
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            })
          : allCards;

        // Initialize card order if empty
        if (cardOrder.length === 0 && allCards.length > 0) {
          const ids = allCards.map(c => c.id);
          setCardOrder(ids);
          localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(ids));
        }

        const cols = Math.min(orderedCards.length, 8);
        return (
          <div className={`grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-${cols}`}>
            {orderedCards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleCardDragStart(e, card.id)}
                onDragEnter={(e) => handleCardDragEnter(e, card.id)}
                onDragEnd={handleCardDragEnd}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className={`transition-all ${draggingCardId === card.id ? "opacity-50 scale-95" : ""} ${dragOverCardId === card.id && draggingCardId ? "ring-2 ring-purple-400 ring-offset-1 rounded-xl" : ""}`}
              >
                {card.render()}
              </div>
            ))}
          </div>
        );
      })() : null,
    },
    extrato: {
      label: "Extrato Consolidado",
      content: (() => {
        let runningBalance = 0;
        let filtered = stmtAccountFilter === "all"
          ? statementData
          : statementData.filter((r) => r.cashAccountName === stmtAccountFilter);
        // Direction filter
        if (stmtDirection !== "all") {
          filtered = filtered.filter((r) => r.type === stmtDirection);
        }
        // Payment type/instrument filter
        if (stmtPaymentType !== "all") {
          if (stmtPaymentType.startsWith("pi:")) {
            const piName = stmtPaymentType.slice(3);
            filtered = filtered.filter((r) => r.paymentInstrumentName === piName);
          } else {
            filtered = filtered.filter((r) => r.paymentMethod === stmtPaymentType);
          }
        }
        const rows = filtered.length > 0
          ? [...filtered].reverse().map((row) => {
              runningBalance += row.amountCents;
              return { ...row, balance: runningBalance };
            }).reverse()
          : [];
        return (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Period filter */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <label className="text-xs text-slate-500">De</label>
              <input type="date" value={stmtDateFrom} onChange={(e) => setStmtDateFrom(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              <label className="text-xs text-slate-500">Até</label>
              <input type="date" value={stmtDateTo} onChange={(e) => setStmtDateTo(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              <select value={stmtAccountFilter} onChange={(e) => setStmtAccountFilter(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 outline-none">
                <option value="all">Todas as contas</option>
                {dashData?.cashAccounts?.map((a: any) => (
                  <option key={a.id} value={a.name}>{a.name} ({a.type === "BANCO" ? "Banco" : a.type === "TRANSITO" ? "Transito" : a.type === "CARTAO_CREDITO" ? "Cartao" : "Caixa"})</option>
                ))}
              </select>
              <select value={stmtDirection} onChange={(e) => { setStmtDirection(e.target.value); setStmtPaymentType("all"); }}
                className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 outline-none">
                <option value="all">Todos</option>
                <option value="DEBIT">Pagamento</option>
                <option value="CREDIT">Recebimento</option>
              </select>
              <select value={stmtPaymentType} onChange={(e) => setStmtPaymentType(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 outline-none min-w-[160px]">
                <option value="all">Tipos</option>
                {stmtInstruments.length > 0 && (
                  <optgroup label="Meios de Pagamento">
                    {stmtInstruments.map((pi: any) => (
                      <option key={pi.id} value={`pi:${pi.name}`}>
                        {pi.name}{pi.cardLast4 ? ` \u2022\u2022\u2022\u2022 ${pi.cardLast4}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Formas de Pagamento">
                  {(() => {
                    const methods = new Set<string>();
                    statementData
                      .filter((r) => stmtDirection === "all" || r.type === stmtDirection)
                      .forEach((r) => { if (r.paymentMethod) methods.add(r.paymentMethod); });
                    return Array.from(methods).sort().map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ));
                  })()}
                </optgroup>
              </select>
              <button onClick={reloadStatement} disabled={stmtLoading}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50">
                {stmtLoading ? "..." : "Filtrar"}
              </button>
              <span className="text-[10px] text-slate-400 ml-auto">{rows.length} movimento{rows.length !== 1 ? "s" : ""}</span>
            </div>
            {rows.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">Nenhum movimento no período selecionado.</div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Data</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Descrição</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Parceiro</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Plano de Contas</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Forma Pgto</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Conta</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Valor</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="px-3 py-2 text-xs text-slate-800 max-w-[200px] truncate">
                        {row.code && <span className="text-slate-400 mr-1">{row.code}</span>}
                        {row.description}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-[140px] truncate">{row.partnerName || "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-[140px] truncate">{row.category || "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{row.paymentMethod || "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-[120px] truncate">{row.cashAccountName || "—"}</td>
                      <td className={`px-3 py-2 text-xs font-semibold text-right whitespace-nowrap ${row.type === "CREDIT" ? "text-green-700" : "text-red-600"}`}>
                        {row.type === "CREDIT" ? "+" : ""}{formatCurrency(row.amountCents)}
                      </td>
                      <td className={`px-3 py-2 text-xs font-semibold text-right whitespace-nowrap ${row.balance >= 0 ? "text-slate-800" : "text-red-600"}`}>
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        );
      })(),
    },
  };

  return (
    <div className="space-y-5">
      {sectionOrder.map((sectionId) => {
        const section = sectionMap[sectionId];
        if (!section?.content) return null;
        const isDragging = draggingId === sectionId;
        const isDragOver = dragOverId === sectionId && draggingId !== sectionId;
        return (
          <div
            key={sectionId}
            draggable
            onDragStart={(e) => handleDragStart(e, sectionId)}
            onDragEnter={() => handleDragEnter(sectionId)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`group relative rounded-xl transition-all ${isDragging ? "opacity-50 scale-[0.98]" : ""} ${isDragOver ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
          >
            {/* Drag handle — visible on hover */}
            <div className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab active:cursor-grabbing text-slate-400 p-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>
            {/* Section label */}
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{section.label}</h3>
            {section.content}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB: ENTRIES (A Receber / A Pagar)
   ══════════════════════════════════════════════════════════ */

function EntriesTab({ type, sysConfig }: { type: FinancialEntryType; sysConfig?: Record<string, any> | null }) {
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
  const [totals, setTotals] = useState<{ sumNetCents: number; sumGrossCents: number }>({ sumNetCents: 0, sumGrossCents: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Cancel with reason
  const [cancelAction, setCancelAction] = useState<{ entry: FinancialEntry } | null>(null);
  const [reverseAction, setReverseAction] = useState<{ entry: FinancialEntry } | null>(null);

  // Pay/Confirm with payment method
  const [payAction, setPayAction] = useState<{ entry: FinancialEntry; action: "PAID" } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedCardRateId, setSelectedCardRateId] = useState("");
  const [activePMs, setActivePMs] = useState<PaymentMethod[]>([]);
  const [cardFeeRates, setCardFeeRates] = useState<CardFeeRate[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<{ id: string; name: string; type: string; currentBalanceCents: number }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [availableInstruments, setAvailableInstruments] = useState<PaymentInstrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  // All instruments for PAYABLE direct selection
  const [allInstruments, setAllInstruments] = useState<any[]>([]);
  const [showManualPayable, setShowManualPayable] = useState(false);
  // Check (cheque) data fields
  const [checkNumber, setCheckNumber] = useState("");
  const [checkBank, setCheckBank] = useState("");
  const [checkAgency, setCheckAgency] = useState("");
  const [checkAccount, setCheckAccount] = useState("");
  const [checkClearanceDate, setCheckClearanceDate] = useState("");
  const [checkHolder, setCheckHolder] = useState("");
  // 4 ultimos digitos do cartao do cliente no momento de receber
  const [payCardLast4, setPayCardLast4] = useState("");
  // Toggle "Lancar financeiro" (default ligado). Quando desligado: marca como PAID mas nao
  // mexe em saldo algum (util pra cartao pessoa fisica, reembolso ja compensado, etc.)
  const [payUpdateFinancials, setPayUpdateFinancials] = useState(true);

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // New entry modal
  const [showNewForm, setShowNewForm] = useState(false);
  const [receivedCardLast4, setReceivedCardLast4] = useState("");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ description: "", grossCents: "", dueDate: "", notes: "", financialAccountId: "", paymentMethod: "", paymentInstrumentId: "" });
  const [selectedPartner, setSelectedPartner] = useState<PartnerSummary | null>(null);
  const [postableAccounts, setPostableAccounts] = useState<{ id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } }[]>([]);

  // v2.00 — Installment & Renegotiation modals
  const [installmentModal, setInstallmentModal] = useState<{ entryId: string; netCents: number } | null>(null);
  const [detailModal, setDetailModal] = useState<{ entryId: string; description?: string } | null>(null);
  const [renegotiateModal, setRenegotiateModal] = useState<{ entryId: string; description?: string; netCents: number } | null>(null);

  // v3.00 — NFS-e emission modal
  const [nfseModal, setNfseModal] = useState<string | null>(null); // financialEntryId
  const [nfseWarnEntry, setNfseWarnEntry] = useState<{ entry: FinancialEntry; action: "PAID" } | null>(null);

  // Boleto modals
  const [boletoGenEntry, setBoletoGenEntry] = useState<FinancialEntry | null>(null);
  const [boletoDetail, setBoletoDetail] = useState<Boleto | null>(null);
  const [entryBoletos, setEntryBoletos] = useState<Record<string, Boleto | null>>({});

  // Edit entry modal
  const [editEntry, setEditEntry] = useState<FinancialEntry | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [batchPayMethod, setBatchPayMethod] = useState("");
  const [batchAccountId, setBatchAccountId] = useState("");
  const [batchUpdateFinancials, setBatchUpdateFinancials] = useState(true);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const { toast } = useToast();

  // Clear selection when filters/page change
  useEffect(() => { setSelectedIds(new Set()); }, [tp.buildQueryString]);

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
      const result = await api.get<PaginatedResponse<FinancialEntry> & { totals?: { sumNetCents: number; sumGrossCents: number } }>(
        `/finance/entries?type=${type}&${qs}`,
      );
      setEntries(result.data);
      setMeta(result.meta);
      if (result.totals) setTotals(result.totals);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString, type]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load boleto status for RECEIVABLE entries
  useEffect(() => {
    if (type !== "RECEIVABLE" || entries.length === 0) return;
    const loadBoletos = async () => {
      const map: Record<string, Boleto | null> = {};
      for (const entry of entries) {
        try {
          const boletos = await api.get<Boleto[]>(`/boleto/by-entry/${entry.id}`);
          // Use the most relevant boleto (first non-terminal, or most recent)
          const active = boletos.find((b) => !["CANCELLED", "REJECTED", "WRITTEN_OFF"].includes(b.status));
          map[entry.id] = active || boletos[0] || null;
        } catch {
          map[entry.id] = null;
        }
      }
      setEntryBoletos(map);
    };
    loadBoletos();
  }, [entries, type]);

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
    // Filtra por direcao: A Pagar mostra so meios configurados para pagamento,
    // A Receber mostra so os de recebimento. Backend aplica o filtro com showInReceivables/showInPayables.
    const direction = type === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
    api.get<any[]>(`/finance/payment-instruments/active?direction=${direction}`)
      .then(setAllInstruments)
      .catch(() => setAllInstruments([]));
  }, [type]);

  // State for category in pay modal
  const [payAccountId, setPayAccountId] = useState("");
  const [payDate, setPayDate] = useState("");

  /**
   * Auto-seleciona a Conta/Caixa baseado no Meio de Pagamento.
   * Prioridade:
   *  1) cashAccountId do PaymentInstrument selecionado (se tem)
   *  2) Primeiro PaymentInstrument ativo da empresa que corresponda ao code — usa seu cashAccountId
   *  3) Fallback por tipo: DINHEIRO/CHEQUE → CAIXA; demais → TRANSITO; CARTAO → vazio (entra no fluxo de cartao)
   */
  const autoSelectAccount = useCallback((pmCode: string, instrumentId?: string) => {
    // 1) Instrument especifico selecionado
    if (instrumentId) {
      const inst = allInstruments.find((i: any) => i.id === instrumentId);
      if (inst?.cashAccount?.id) {
        setSelectedAccountId(inst.cashAccount.id);
        return;
      }
    }
    // 2) Busca instrumento padrao por code na empresa
    const instByCode = allInstruments.find((i: any) => (i.paymentMethod?.code || "") === pmCode);
    if (instByCode?.cashAccount?.id) {
      setSelectedAccountId(instByCode.cashAccount.id);
      return;
    }
    // 3) Fallback por tipo
    if (pmCode === "DINHEIRO" || pmCode === "CHEQUE") {
      const caixa = activeAccounts.find((a) => a.type === "CAIXA");
      setSelectedAccountId(caixa?.id || "");
    } else if (pmCode && !pmCode.startsWith("CARTAO")) {
      const transit = activeAccounts.find((a) => a.type === "TRANSITO");
      setSelectedAccountId(transit?.id || "");
    }
  }, [allInstruments, activeAccounts]);

  // Pre-fill payment method, category, and date when opening pay modal
  useEffect(() => {
    if (payAction?.entry.paymentMethod) {
      setPaymentMethod(payAction.entry.paymentMethod);
      autoSelectAccount(payAction.entry.paymentMethod);
    }
    if (payAction?.entry.financialAccount?.id) {
      setPayAccountId(payAction.entry.financialAccount.id);
    } else if (payAction?.entry.type === "RECEIVABLE") {
      // Auto-select "Receita de Servicos" (code 1100) for receivables
      const receita = postableAccounts.find((a) => a.code === "1100");
      setPayAccountId(receita?.id || "");
    } else {
      setPayAccountId("");
    }
    // Default pay date to today
    if (payAction) {
      setPayDate(new Date().toISOString().slice(0, 10));
    }
  }, [payAction, activeAccounts, postableAccounts]);

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
    // Se o usuario selecionou um PaymentInstrument especifico (ex: Master Ueslei), ja temos
    // o cartao — nao precisa de CardFeeRate separado. Taxa vem de PaymentInstrumentFeeRate.
    // Pagamento pessoa fisica pula validacao — nao afeta caixa nem gera settlement.
    if (payUpdateFinancials && selectedPM?.requiresBrand && !selectedInstrumentId && !selectedCardRateId) {
      toast("Selecione o cartao.", "error");
      return;
    }
    const { entry, action } = payAction;
    setActionLoading(entry.id);
    try {
      const isCard = !!selectedPM?.requiresBrand;
      // Update category if changed
      if (payAccountId && payAccountId !== (entry.financialAccount?.id || "")) {
        await api.patch(`/finance/entries/${entry.id}`, { financialAccountId: payAccountId });
      }
      const isCheckPay = type === "RECEIVABLE" && !!selectedPM?.requiresCheckData;
      if (isCheckPay && !checkNumber) {
        toast("Preencha o numero do cheque.", "error");
        setActionLoading(null);
        return;
      }
      // RECEIVABLE com cartao: backend cria CardSettlement e gerencia a conta via settle
      // PAYABLE com cartao ou nao-cartao: passa cashAccountId pra debitar saldo direto
      const isReceivableCard = isCard && type === "RECEIVABLE";
      // Pagamento pessoa fisica: skipCashAccount=true pula CardSettlement, fallback e update de saldo
      await api.patch(`/finance/entries/${entry.id}/status`, {
        status: action,
        paymentMethod,
        paidAt: payDate || undefined,
        cardBrand: isCard && selectedCardRate ? selectedCardRate.brand : undefined,
        cardFeeRateId: (isReceivableCard && payUpdateFinancials) ? selectedCardRateId : undefined,
        cashAccountId: (!payUpdateFinancials || isReceivableCard) ? undefined : (selectedAccountId || undefined),
        paymentInstrumentId: !payUpdateFinancials ? undefined : (selectedInstrumentId || undefined),
        receivedCardLast4: (isReceivableCard && payCardLast4.length === 4) ? payCardLast4 : undefined,
        skipCashAccount: !payUpdateFinancials ? true : undefined,
        ...(isCheckPay && {
          checkNumber: checkNumber || undefined,
          checkBank: checkBank || undefined,
          checkAgency: checkAgency || undefined,
          checkAccount: checkAccount || undefined,
          checkClearanceDate: checkClearanceDate || undefined,
          checkHolder: checkHolder || undefined,
        }),
      });
      const labels: Record<string, string> = { PAID: type === "RECEIVABLE" ? "recebida" : "paga" };
      toast(`Entrada ${labels[action]} com sucesso!`, "success");
      setPayAction(null);
      setPaymentMethod("");
      setSelectedCardRateId("");
      setSelectedAccountId("");
      setSelectedInstrumentId("");
      setPayAccountId("");
      setPayDate("");
      setAvailableInstruments([]);
      setShowManualPayable(false);
      setPayUpdateFinancials(true);
      setCheckNumber(""); setCheckBank(""); setCheckAgency(""); setCheckAccount(""); setCheckClearanceDate(""); setCheckHolder("");
      await loadEntries();
    } catch {
      toast("Erro ao atualizar status.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBatchPay() {
    if (selectedIds.size === 0 || !batchPayMethod) return;
    setBatchProcessing(true);
    try {
      const result = await api.post<{ paidCount: number; totalPaidCents: number; errors: string[] }>("/finance/entries/batch-pay", {
        entryIds: Array.from(selectedIds),
        paymentMethod: batchPayMethod,
        paidAt: batchDate || undefined,
        cashAccountId: batchUpdateFinancials ? (batchAccountId || undefined) : undefined,
        skipCashAccount: !batchUpdateFinancials ? true : undefined,
      });
      if (result.errors.length > 0) {
        toast(`${result.paidCount} de ${selectedIds.size} ${type === "RECEIVABLE" ? "recebidos" : "pagos"}. ${result.errors.length} erro(s).`, "error");
      } else {
        toast(`${result.paidCount} lancamento(s) ${type === "RECEIVABLE" ? "recebido(s)" : "pago(s)"} — ${formatCurrency(result.totalPaidCents)}`, "success");
      }
      setShowBatchModal(false);
      setSelectedIds(new Set());
      setBatchPayMethod("");
      setBatchAccountId("");
      await loadEntries();
    } catch (err: any) {
      toast(err?.message || "Erro ao processar pagamento em lote", "error");
    } finally {
      setBatchProcessing(false);
    }
  }

  // Compute selected entries total
  const selectedEntries = entries.filter(e => selectedIds.has(e.id));
  const selectedTotal = selectedEntries.reduce((sum, e) => sum + e.netCents, 0);
  const selectableEntries = entries.filter(e => e.status === "PENDING" || e.status === "CONFIRMED");

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
    if (!formData.paymentMethod && !formData.paymentInstrumentId) {
      toast("Selecione o meio de pagamento.", "error");
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
        paymentMethod: formData.paymentMethod || undefined,
        paymentInstrumentId: formData.paymentInstrumentId || undefined,
        receivedCardLast4: receivedCardLast4 && receivedCardLast4.length === 4 ? receivedCardLast4 : undefined,
      });
      toast("Entrada criada com sucesso!", "success");
      setShowNewForm(false);
      setFormData({ description: "", grossCents: "", dueDate: "", notes: "", financialAccountId: "", paymentMethod: "", paymentInstrumentId: "" });
      setReceivedCardLast4("");
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
        filters={getEntryFilters(type)}
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
                <th className="py-2 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectableEntries.length > 0 && selectableEntries.every(e => selectedIds.has(e.id))}
                    onChange={(ev) => {
                      if (ev.target.checked) {
                        setSelectedIds(new Set(selectableEntries.map(e => e.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="accent-blue-600 w-3.5 h-3.5"
                    title="Selecionar todos pendentes"
                  />
                </th>
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
              {entries.map((rawE) => {
                const e = type === "RECEIVABLE" ? { ...rawE, _boleto: entryBoletos[rawE.id] || null } as any : rawE;
                return (
                <tr key={e.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedIds.has(e.id) ? "bg-blue-50" : ""}`}>
                  <td className="py-2 px-2 w-8">
                    {(e.status === "PENDING" || e.status === "CONFIRMED") && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(e.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                          setSelectedIds(next);
                        }}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    )}
                  </td>
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
                            onBoletoGenerate={type === "RECEIVABLE" && e.status !== "PAID" && !entryBoletos[e.id] ? () => setBoletoGenEntry(e) : undefined}
                            onBoletoView={type === "RECEIVABLE" && entryBoletos[e.id] ? () => setBoletoDetail(entryBoletos[e.id]!) : undefined}
                            onEdit={() => openEditEntry(e)}
                            allowDelete={sysConfig?.financial?.allowDeleteEntry === true}
                            onDelete={async () => {
                              if (!confirm("Tem certeza que deseja excluir este lancamento? Esta acao nao pode ser desfeita.")) return;
                              setActionLoading(e.id);
                              try {
                                await api.del(`/finance/entries/${e.id}`);
                                toast("Lancamento excluido", "success");
                                loadEntries();
                              } catch (err: any) {
                                toast(err?.message || "Erro ao excluir", "error");
                              } finally {
                                setActionLoading(null);
                              }
                            }}
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
              ); })}
            </tbody>
            {totals.sumNetCents > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={orderedColumns.findIndex(c => c.id === "netCents") + 1} className="py-3 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total filtrado ({meta.total} registro{meta.total !== 1 ? "s" : ""})
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`text-sm font-bold ${type === "RECEIVABLE" ? "text-green-700" : "text-blue-700"}`}>
                      {formatCurrency(totals.sumNetCents)}
                    </span>
                  </td>
                  <td colSpan={orderedColumns.length - orderedColumns.findIndex(c => c.id === "netCents") - 1} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <Pagination meta={meta} onPageChange={tp.setPage} />

      {/* Floating batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 animate-scale-in">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""} — {formatCurrency(selectedTotal)}
          </span>
          <button
            onClick={() => { setBatchDate(new Date().toISOString().slice(0, 10)); setBatchPayMethod(""); setBatchAccountId(""); setShowBatchModal(true); }}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${type === "RECEIVABLE" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {type === "RECEIVABLE" ? "Receber todos" : "Pagar todos"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Batch pay modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {type === "RECEIVABLE" ? "Receber" : "Pagar"} {selectedIds.size} lancamento{selectedIds.size !== 1 ? "s" : ""}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Total: <strong className={type === "RECEIVABLE" ? "text-green-700" : "text-blue-700"}>{formatCurrency(selectedTotal)}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data de {type === "RECEIVABLE" ? "Recebimento" : "Pagamento"}</label>
                <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Forma de {type === "RECEIVABLE" ? "Recebimento" : "Pagamento"} *</label>
                <select value={batchPayMethod} onChange={(e) => setBatchPayMethod(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Selecione...</option>
                  {activePMs.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                </select>
              </div>
              {/* Toggle "Lancar financeiro" — identico ao modal individual */}
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-xs font-medium text-slate-600">Lancar financeiro</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={batchUpdateFinancials}
                  onClick={() => {
                    const next = !batchUpdateFinancials;
                    setBatchUpdateFinancials(next);
                    if (!next) setBatchAccountId("");
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${batchUpdateFinancials ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${batchUpdateFinancials ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </label>
              {/* Conta/Caixa — filtra por showIn* (IC-02) + respeita lockAccountOnReceive (IM-03) */}
              {activeAccounts.length > 0 && batchUpdateFinancials && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Conta/Caixa</label>
                  <select
                    value={batchAccountId}
                    onChange={(e) => setBatchAccountId(e.target.value)}
                    disabled={sysConfig?.financial?.lockAccountOnReceive === true && type === "RECEIVABLE"}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none ${sysConfig?.financial?.lockAccountOnReceive === true && type === "RECEIVABLE" ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white"}`}>
                    <option value="">Nenhuma (nao atualizar saldo)</option>
                    {activeAccounts
                      .filter((a: any) => type === "RECEIVABLE" ? a.showInReceivables !== false : a.showInPayables !== false)
                      .map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type === "BANCO" ? "Banco" : a.type === "TRANSITO" ? "Transito" : a.type === "CARTAO_CREDITO" ? "Cartao" : "Caixa"})</option>)}
                  </select>
                  {!batchAccountId && (
                    <p className="mt-1 text-[10px] text-amber-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      Sem conta selecionada — o saldo nao sera atualizado
                    </p>
                  )}
                </div>
              )}
              {/* Selected entries summary */}
              <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Lancamentos selecionados</p>
                {selectedEntries.map((e) => (
                  <div key={e.id} className="flex justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 truncate max-w-[250px]">{e.description || e.code}</span>
                    <span className="font-medium text-slate-800 whitespace-nowrap ml-2">{formatCurrency(e.netCents)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowBatchModal(false)} disabled={batchProcessing} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancelar</button>
              <button
                onClick={handleBatchPay}
                disabled={batchProcessing || !batchPayMethod}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${type === "RECEIVABLE" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {batchProcessing ? "Processando..." : `${type === "RECEIVABLE" ? "Receber" : "Pagar"} ${formatCurrency(selectedTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setPayAction(null); setPaymentMethod(""); setSelectedCardRateId(""); setSelectedInstrumentId(""); setAvailableInstruments([]); setShowManualPayable(false); setCheckNumber(""); setCheckBank(""); setCheckAgency(""); setCheckAccount(""); setCheckClearanceDate(""); setCheckHolder(""); setPayCardLast4(""); }} />
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
              {/* Data do pagamento/recebimento */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Data de {type === "RECEIVABLE" ? "Recebimento" : "Pagamento"}
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Instrument-first dropdown (PAYABLE e RECEIVABLE) — mostra meios configurados pra direcao */}
              {allInstruments.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Meio de {type === "RECEIVABLE" ? "Recebimento" : "Pagamento"}
                  </label>
                  <select
                    value={selectedInstrumentId}
                    onChange={(e) => {
                      const piId = e.target.value;
                      setSelectedInstrumentId(piId);
                      if (!piId) {
                        setShowManualPayable(true);
                        setPaymentMethod("");
                        setSelectedAccountId("");
                      } else {
                        setShowManualPayable(false);
                        const pi = allInstruments.find((i: any) => i.id === piId);
                        if (pi) {
                          const code = pi.paymentMethod?.code || "";
                          setPaymentMethod(code);
                          autoSelectAccount(code, piId);
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Selecao manual...</option>
                    {allInstruments.map((pi: any) => {
                      const code = pi.paymentMethod?.code || "";
                      const isCard = code.includes("CARTAO") || code.includes("CREDITO") || code.includes("DEBITO");
                      const icon = isCard ? "\uD83D\uDCB3" : code === "PIX" ? "\u26A1" : code === "DINHEIRO" ? "\uD83D\uDCB5" : code === "BOLETO" ? "\uD83D\uDCC4" : code === "TRANSFERENCIA" ? "\uD83D\uDD04" : code === "CHEQUE" ? "\uD83D\uDCDD" : "\uD83D\uDCB0";
                      const last4 = isCard && pi.cardLast4 ? ` \u2022\u2022\u2022\u2022 ${pi.cardLast4}` : "";
                      const methodShort = code === "CARTAO_CREDITO" ? "Credito" : code === "CARTAO_DEBITO" ? "Debito" : (pi.paymentMethod?.name || "");
                      const suffix = isCard ? ` (${methodShort})` : (pi.cashAccount ? ` - ${pi.cashAccount.name}` : ` (${methodShort})`);
                      const autoBadge = pi.autoMarkPaid ? " \u26A1" : "";
                      return (
                        <option key={pi.id} value={pi.id}>
                          {icon} {pi.name}{last4}{suffix}{autoBadge}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Payment method dropdown manual (quando usuario seleciona "Selecao manual..." ou nao ha meios) */}
              {(showManualPayable || allInstruments.length === 0) && (
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
                    // Auto-select Conta/Caixa — usa cashAccountId do PaymentInstrument padrao desse code
                    autoSelectAccount(code);
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
              )}

              {/* Dropdown CardFeeRate so aparece quando:
                    - e cartao (isCardPayment)
                    - E usuario NAO selecionou um PaymentInstrument especifico (o instrumento ja tem suas proprias taxas)
                    - E NAO e pagamento pessoa fisica (nao rastreamos taxa pra cartao pessoal)
                  Fallback pra tenants que ainda nao cadastraram instrumentos */}
              {isCardPayment && !selectedInstrumentId && payUpdateFinancials && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cartao *</label>
                  {filteredCardRates.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                      <p className="font-medium">Nenhum cartao cadastrado para {cardType === "DEBITO" ? "debito" : "credito"}.</p>
                      <p className="mt-1">Cadastre as taxas em <strong>Meios de Pagamento e Recebimento</strong> (secao Taxas de parcelamento).</p>
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

              {/* Fee preview for selected instrument (Im-03: quando instrumento selecionado, mostra info) */}
              {isCardPayment && selectedInstrumentId && !selectedCardRate && (() => {
                const inst = allInstruments.find((i: any) => i.id === selectedInstrumentId);
                if (!inst) return null;
                const code = (inst.paymentMethod?.code || "").toUpperCase();
                const methodLabel = code.includes("CREDITO") ? "Credito" : code.includes("DEBITO") ? "Debito" : (inst.paymentMethod?.name || "Cartao");
                return (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400">Instrumento</span>
                        <p className="font-medium text-slate-700">{inst.name}{inst.cardLast4 ? ` •••• ${inst.cardLast4}` : ""}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Tipo</span>
                        <p className="font-medium text-slate-700">{methodLabel}</p>
                      </div>
                      {inst.cashAccount && (
                        <div>
                          <span className="text-[10px] text-slate-400">Conta</span>
                          <p className="font-medium text-slate-700">{inst.cashAccount.name}</p>
                        </div>
                      )}
                    </div>
                    {type === "RECEIVABLE" && (
                      <p className="mt-1.5 text-[10px] text-blue-600">
                        Taxa e prazo serao aplicados conforme configuracao do instrumento.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Fee preview for selected CardFeeRate (fallback generico) */}
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

              {/* 4 ultimos digitos do cartao do CLIENTE (so em recebimentos via cartao) */}
              {type === "RECEIVABLE" && isCardPayment && (
                <CardLast4Input
                  value={payCardLast4}
                  onChange={setPayCardLast4}
                  hint="Cartão do cliente — facilita identificar o pagamento depois."
                />
              )}

              {/* Toggle "Lancar financeiro" — padrao ligado. Desligado: marca como PAID sem mexer em saldo */}
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-xs font-medium text-slate-600">Lancar financeiro</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={payUpdateFinancials}
                  onClick={() => {
                    const next = !payUpdateFinancials;
                    setPayUpdateFinancials(next);
                    if (!next) {
                      setSelectedAccountId("");
                      setSelectedInstrumentId("");
                      setSelectedCardRateId("");
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${payUpdateFinancials ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${payUpdateFinancials ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </label>

              {/* Cash account (optional — hidden for card payments and personal card) */}
              {activeAccounts.length > 0 && !isCardPayment && payUpdateFinancials && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Conta/Caixa</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    disabled={sysConfig?.financial?.lockAccountOnReceive === true && payAction?.entry.type === "RECEIVABLE"}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none ${sysConfig?.financial?.lockAccountOnReceive === true && payAction?.entry.type === "RECEIVABLE" ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white"}`}
                  >
                    <option value="">Nenhuma (nao atualizar saldo)</option>
                    {activeAccounts
                      .filter((a: any) => type === "RECEIVABLE" ? a.showInReceivables !== false : a.showInPayables !== false)
                      .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type === "BANCO" ? "Banco" : a.type === "TRANSITO" ? "Transito" : a.type === "CARTAO_CREDITO" ? "Cartao" : "Caixa"})
                      </option>
                    ))}
                  </select>
                  {!selectedAccountId && (
                    <p className="mt-1 text-[10px] text-amber-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      Sem conta selecionada — o saldo nao sera atualizado
                    </p>
                  )}
                  {selectedAccountId && <p className="mt-0.5 text-[10px] text-green-600">Saldo sera atualizado automaticamente</p>}
                </div>
              )}

              {/* Dados do cheque (only for RECEIVABLE + CHEQUE method) */}
              {type === "RECEIVABLE" && activePMs.find((p) => p.code === paymentMethod)?.requiresCheckData && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-700">Dados do Cheque</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-0.5">Numero do Cheque *</label>
                      <input type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="000001" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-0.5">Banco Emissor *</label>
                      <input type="text" value={checkBank} onChange={(e) => setCheckBank(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="Bradesco" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-0.5">Agencia</label>
                      <input type="text" value={checkAgency} onChange={(e) => setCheckAgency(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="0001" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-0.5">Conta</label>
                      <input type="text" value={checkAccount} onChange={(e) => setCheckAccount(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="12345-6" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-0.5">Compensacao</label>
                      <input type="date" value={checkClearanceDate} onChange={(e) => setCheckClearanceDate(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-0.5">Titular</label>
                      <input type="text" value={checkHolder} onChange={(e) => setCheckHolder(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="Nome do titular" />
                    </div>
                  </div>
                </div>
              )}

              {/* Plano de Contas */}
              {postableAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Plano de Contas</label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    disabled={sysConfig?.financial?.lockPlanOnReceive === true && payAction?.entry.type === "RECEIVABLE"}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none ${sysConfig?.financial?.lockPlanOnReceive === true && payAction?.entry.type === "RECEIVABLE" ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white"}`}
                  >
                    <option value="">Selecione...</option>
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
                disabled={!!actionLoading || (!paymentMethod && !selectedInstrumentId) || !!(type === "RECEIVABLE" && !selectedInstrumentId && activePMs.find((p) => p.code === paymentMethod)?.requiresBrand && !selectedCardRateId)}
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Meio de {type === "RECEIVABLE" ? "Recebimento" : "Pagamento"} *</label>
                <select
                  value={formData.paymentInstrumentId}
                  onChange={(e) => {
                    const piId = e.target.value;
                    const pi = allInstruments.find((i: any) => i.id === piId);
                    setFormData({
                      ...formData,
                      paymentInstrumentId: piId,
                      paymentMethod: pi?.paymentMethod?.code || "",
                    });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {allInstruments.map((pi: any) => {
                    const code = pi.paymentMethod?.code || "";
                    const isCardInst = code.includes("CARTAO") || code.includes("CREDITO") || code.includes("DEBITO");
                    const icon = isCardInst ? "\uD83D\uDCB3" : code === "PIX" ? "\u26A1" : code === "DINHEIRO" ? "\uD83D\uDCB5" : code === "BOLETO" ? "\uD83D\uDCC4" : code === "TRANSFERENCIA" ? "\uD83D\uDD04" : code === "CHEQUE" ? "\uD83D\uDCDD" : "\uD83D\uDCB0";
                    const last4 = isCardInst && pi.cardLast4 ? ` \u2022\u2022\u2022\u2022 ${pi.cardLast4}` : "";
                    const autoBadge = pi.autoMarkPaid ? " \u26A1" : "";
                    return (
                      <option key={pi.id} value={pi.id}>
                        {icon} {pi.name}{last4}{autoBadge}
                      </option>
                    );
                  })}
                </select>
              </div>
              {/* 4 ultimos digitos do cartao do CLIENTE — so em RECEBIMENTOS via cartao */}
              {type === "RECEIVABLE" && (() => {
                const pi = allInstruments.find((i: any) => i.id === formData.paymentInstrumentId);
                const code = pi?.paymentMethod?.code || "";
                const show = isCardPaymentCheck({ paymentMethodCode: code, requiresBrand: pi?.paymentMethod?.requiresBrand });
                if (!show) return null;
                return (
                  <div>
                    <CardLast4Input
                      value={receivedCardLast4}
                      onChange={setReceivedCardLast4}
                      hint="Cartão do cliente — ajuda a identificar o pagamento na conciliação."
                    />
                  </div>
                );
              })()}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plano de Contas</label>
                <select
                  value={formData.financialAccountId}
                  onChange={(e) => setFormData({ ...formData, financialAccountId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
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
                  setFormData({ description: "", grossCents: "", dueDate: "", notes: "", financialAccountId: "", paymentMethod: "", paymentInstrumentId: "" });
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

      {/* Boleto Generation Modal */}
      {boletoGenEntry && (
        <BoletoGenerationModal
          entry={boletoGenEntry}
          onClose={() => setBoletoGenEntry(null)}
          onSuccess={() => { setBoletoGenEntry(null); loadEntries(); }}
        />
      )}

      {/* Boleto Detail Modal */}
      {boletoDetail && (
        <BoletoDetailModal
          boleto={boletoDetail}
          onClose={() => setBoletoDetail(null)}
          onRefresh={async () => {
            try {
              const updated = await api.get<Boleto>(`/boleto/${boletoDetail.id}`);
              setBoletoDetail(updated);
              loadEntries();
            } catch { setBoletoDetail(null); }
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Plano de Contas</label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
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

/* ── Entry Action Buttons (Dropdown) ──────────────────── */

function EntryActions({
  entry,
  type,
  loading,
  onAction,
  onInstallments,
  onViewInstallments,
  onRenegotiate,
  onEmitNfse,
  onBoletoGenerate,
  onBoletoView,
  onEdit,
  onDelete,
  allowDelete,
}: {
  entry: FinancialEntry;
  type: FinancialEntryType;
  loading: boolean;
  onAction: (action: "PAID" | "CANCELLED" | "REVERSED") => void;
  onInstallments: () => void;
  onViewInstallments: () => void;
  onRenegotiate: () => void;
  onEmitNfse?: () => void;
  onBoletoGenerate?: () => void;
  onBoletoView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  allowDelete?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function toggle() {
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 168) });
    }
    setOpen(true);
  }

  if (loading) {
    return <span className="text-xs text-slate-400 animate-pulse">Processando...</span>;
  }

  const payLabel = type === "RECEIVABLE" ? "Receber" : "Pagar";
  const isPendingOrConfirmed = entry.status === "PENDING" || entry.status === "CONFIRMED";
  const isPaid = entry.status === "PAID";
  const isTerminal = entry.status === "CANCELLED" || entry.status === "PAID";
  const hasInstallments = entry.installmentCount && entry.installmentCount > 0;

  // Build menu items
  type MenuItem = { label: string; onClick: () => void; className?: string; separator?: false } | { separator: true };
  const items: MenuItem[] = [];

  // Primary action: Receber/Pagar
  if (isPendingOrConfirmed) {
    items.push({
      label: payLabel,
      onClick: () => onAction("PAID"),
      className: "text-green-700 font-semibold",
    });
  }

  // Edit
  if (onEdit) {
    items.push({ label: "Editar", onClick: onEdit });
  }

  // View installments
  if (hasInstallments) {
    items.push({ label: "Parcelas", onClick: onViewInstallments, className: "text-purple-700" });
  }

  // Renegotiate (non-terminal)
  if (!isTerminal) {
    items.push({ label: "Renegociar", onClick: onRenegotiate });
  }

  // NFS-e actions (RECEIVABLE only) — resolve herda nfseStatus do parentEntry
  if (type === "RECEIVABLE" && onEmitNfse) {
    const nfse = resolveNfse(entry);
    if (nfse.status === "AUTHORIZED" && nfse.emissionId) {
      items.push({
        label: "PDF NFS-e",
        onClick: async () => {
          try {
            const token = getAccessToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/nfse-emission/emissions/${nfse.emissionId}/pdf`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => null);
              throw new Error(errBody?.message || "Erro ao baixar PDF");
            }
            const blob = await res.blob();
            const cd = res.headers.get("content-disposition") || "";
            const fnMatch = cd.match(/filename="?([^";\n]+)"?/);
            const filename = fnMatch?.[1] || `NFS-e ${nfse.emissionId}.pdf`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } catch (err: any) {
            toast(err?.message || "Erro ao baixar PDF da NFS-e.", "error");
          }
        },
        className: "text-green-700",
      });
    }
    if (nfse.status !== "AUTHORIZED" && nfse.status !== "PROCESSING" && entry.status !== "CANCELLED") {
      items.push({ label: "Emitir NFS-e", onClick: onEmitNfse, className: "text-teal-700" });
    }
  }

  // Boleto actions (RECEIVABLE only)
  if (type === "RECEIVABLE" && entry.status !== "CANCELLED") {
    if (onBoletoView) {
      items.push({ label: "Ver Boleto", onClick: onBoletoView, className: "text-blue-700" });
    }
    if (onBoletoGenerate && !onBoletoView) {
      items.push({ label: "Gerar Boleto", onClick: onBoletoGenerate, className: "text-indigo-700" });
    }
  }

  // Separator before destructive actions
  const hasDestructive = isPaid || isPendingOrConfirmed;
  if (hasDestructive && items.length > 0) {
    items.push({ separator: true });
  }

  // Estornar (PAID only)
  if (isPaid) {
    items.push({ label: "Estornar", onClick: () => onAction("REVERSED"), className: "text-amber-600" });
  }

  // Cancelar (PENDING/CONFIRMED only)
  if (isPendingOrConfirmed) {
    items.push({ label: "Cancelar", onClick: () => onAction("CANCELLED"), className: "text-red-600" });
  }

  // Excluir (only when system config allows)
  if (allowDelete && onDelete && isPendingOrConfirmed) {
    items.push({ label: "Excluir", onClick: onDelete, className: "text-red-700 font-semibold" });
  }

  // Nothing to show
  if (items.length === 0) {
    return <span className="text-xs text-slate-400">&mdash;</span>;
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
        title="Ações"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          ref={dropRef}
          className="fixed z-50 w-[168px] bg-white border border-slate-200 rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map((item, i) => {
            if ("separator" in item && item.separator) {
              return <div key={`sep-${i}`} className="my-1 border-t border-slate-100" />;
            }
            const mi = item as Exclude<MenuItem, { separator: true }>;
            return (
              <button
                key={mi.label}
                onClick={() => { setOpen(false); mi.onClick(); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${mi.className || "text-slate-700"}`}
              >
                {mi.label}
              </button>
            );
          })}
        </div>
      )}
    </>
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


