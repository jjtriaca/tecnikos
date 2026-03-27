"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import type {
  CardSettlement,
  CardSettlementSummary,
  CashAccount,
  CardFeeRate,
} from "@/types/finance";
import { CARD_SETTLEMENT_STATUS_CONFIG, CARD_BRANDS, CARD_TYPES } from "@/types/finance";

/* ── Helpers ────────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── Pagination types ───────────────────────────────────── */

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

/* ── Filter definitions ─────────────────────────────────── */

const filterDefs: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "ALL", label: "Todos" },
      { value: "PENDING", label: "Pendente" },
      { value: "SETTLED", label: "Baixado" },
      { value: "CANCELLED", label: "Cancelado" },
    ],
  },
  { key: "dateFrom", label: "De", type: "date" },
  { key: "dateTo", label: "Até", type: "date" },
];

/* ── Spinner SVG ────────────────────────────────────────── */

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ── ActionsDropdown ───────────────────────────────────── */

function ActionsDropdown({
  cs,
  onSettle,
}: {
  cs: CardSettlement;
  onSettle: (cs: CardSettlement) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100"
      >
        &#x22EF;
      </button>
      {open && (
        <div
          className="fixed z-50 min-w-[120px] rounded border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {cs.status === "PENDING" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSettle(cs);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-green-700 hover:bg-slate-50"
            >
              Baixar
            </button>
          ) : (
            <span className="block px-3 py-1.5 text-xs text-slate-400">—</span>
          )}
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   CARD SETTLEMENT TAB
   ══════════════════════════════════════════════════════════ */

export default function CardSettlementTab() {
  const { toast } = useToast();

  /* ── Table params (persisted) ─────────────────────────── */
  const {
    page,
    limit,
    search,
    sort,
    filters,
    setPage,
    setSearch,
    toggleSort,
    setFilter,
    resetFilters,
    buildQueryString,
  } = useTableParams({
    persistKey: "card-settlements",
    defaultSortBy: "expectedDate",
    defaultSortOrder: "asc",
  });

  /* ── State ────────────────────────────────────────────── */
  const [settlements, setSettlements] = useState<PaginatedResponse<CardSettlement>>({
    data: [],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  });
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<CardSettlementSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);

  // Settle modal (single)
  const [settleModal, setSettleModal] = useState<{ cs: CardSettlement } | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCashAccountId, setSettleCashAccountId] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [settleInstallments, setSettleInstallments] = useState<number>(1);
  const [settling, setSettling] = useState(false);

  // Batch
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModal, setBatchModal] = useState(false);
  const [batchCashAccountId, setBatchCashAccountId] = useState("");
  const [batchNotes, setBatchNotes] = useState("");

  // Fee Rates
  const [showFeeRates, setShowFeeRates] = useState(false);
  const [feeRates, setFeeRates] = useState<CardFeeRate[]>([]);
  const [feeRatesLoading, setFeeRatesLoading] = useState(false);
  const [feeForm, setFeeForm] = useState<{
    id?: string;
    description: string;
    brand: string;
    type: string;
    installmentFrom: number;
    installmentTo: number;
    feePercent: string;
    receivingDays: string;
  } | null>(null);
  const [feeSaving, setFeeSaving] = useState(false);

  // Edit entry modal
  const [editModal, setEditModal] = useState<CardSettlement | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [postableAccounts, setPostableAccounts] = useState<{ id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } }[]>([]);

  /* ── Effective status filter (default PENDING) ────────── */
  const effectiveStatus = filters.status || "PENDING";

  /* ── Data loading ─────────────────────────────────────── */

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const result = await api.get<CardSettlementSummary>(
        "/finance/card-settlements/summary",
      );
      setSummary(result);
    } catch {
      /* ignore */
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadCashAccounts = useCallback(async () => {
    try {
      const result = await api.get<CashAccount[]>("/finance/cash-accounts/active");
      setCashAccounts(result);
    } catch {
      /* ignore */
    }
  }, []);

  const loadFeeRates = useCallback(async () => {
    setFeeRatesLoading(true);
    try {
      const result = await api.get<CardFeeRate[]>("/finance/card-fee-rates");
      setFeeRates(result);
    } catch {
      /* ignore */
    } finally {
      setFeeRatesLoading(false);
    }
  }, []);

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (sort.column && sort.order) {
        params.set("sortBy", sort.column);
        params.set("sortOrder", sort.order);
      }
      if (effectiveStatus && effectiveStatus !== "ALL") {
        params.set("status", effectiveStatus);
      }
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const result = await api.get<PaginatedResponse<CardSettlement>>(
        `/finance/card-settlements?${params.toString()}`,
      );
      setSettlements(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, effectiveStatus, filters.dateFrom, filters.dateTo]);

  // Load summary + cash accounts on mount
  useEffect(() => {
    loadSummary();
    loadCashAccounts();
    api.get<typeof postableAccounts>("/finance/accounts/postable")
      .then(setPostableAccounts)
      .catch(() => {});
  }, [loadSummary, loadCashAccounts]);

  // Load fee rates when section opened
  useEffect(() => {
    if (showFeeRates) loadFeeRates();
  }, [showFeeRates, loadFeeRates]);

  // Load settlements when filters/pagination change
  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  /* ── Fee rate helpers ─────────────────────────────────── */

  function openNewFeeForm() {
    setFeeForm({
      description: "",
      brand: CARD_BRANDS[0],
      type: "CREDITO",
      installmentFrom: 1,
      installmentTo: 1,
      feePercent: "",
      receivingDays: "30",
    });
  }

  function openEditFeeForm(rate: CardFeeRate) {
    setFeeForm({
      id: rate.id,
      description: rate.description || "",
      brand: rate.brand,
      type: rate.type,
      installmentFrom: rate.installmentFrom,
      installmentTo: rate.installmentTo,
      feePercent: String(rate.feePercent),
      receivingDays: String(rate.receivingDays),
    });
  }

  async function saveFeeRate() {
    if (!feeForm) return;
    if (!feeForm.description.trim()) {
      toast("Informe a descricao do cartao.", "error");
      return;
    }
    const fee = parseFloat(feeForm.feePercent);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      toast("Informe uma taxa valida (0-100).", "error");
      return;
    }
    const days = parseInt(feeForm.receivingDays);
    if (isNaN(days) || days < 0) {
      toast("Informe dias de recebimento validos.", "error");
      return;
    }

    setFeeSaving(true);
    try {
      if (feeForm.id) {
        await api.patch(`/finance/card-fee-rates/${feeForm.id}`, {
          description: feeForm.description.trim(),
          feePercent: fee,
          receivingDays: days,
        });
        toast("Taxa atualizada!", "success");
      } else {
        await api.post("/finance/card-fee-rates", {
          description: feeForm.description.trim(),
          brand: feeForm.brand,
          type: feeForm.type,
          installmentFrom: feeForm.installmentFrom,
          installmentTo: feeForm.installmentTo,
          feePercent: fee,
          receivingDays: days,
        });
        toast("Taxa criada!", "success");
      }
      setFeeForm(null);
      loadFeeRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar taxa.";
      toast(msg, "error");
    } finally {
      setFeeSaving(false);
    }
  }

  async function deleteFeeRate(id: string) {
    if (!window.confirm("Excluir esta taxa?")) return;
    try {
      await api.del(`/finance/card-fee-rates/${id}`);
      toast("Taxa removida.", "success");
      loadFeeRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover taxa.";
      toast(msg, "error");
    }
  }

  /* ── Group fee rates by brand for display ──────────────── */

  const feeRatesByBrand = useMemo(() => {
    const map = new Map<string, CardFeeRate[]>();
    for (const r of feeRates) {
      const list = map.get(r.brand) || [];
      list.push(r);
      map.set(r.brand, list);
    }
    return map;
  }, [feeRates]);

  /* ── Edit entry helpers ──────────────────────────────── */

  function openEditModal(cs: CardSettlement) {
    setEditModal(cs);
    setEditDesc(cs.financialEntry?.description || "");
    setEditAccountId(cs.financialEntry?.financialAccountId || "");
    setEditNotes(cs.financialEntry?.notes || "");
  }

  async function handleSaveEdit() {
    if (!editModal?.financialEntry?.id) return;
    setEditSaving(true);
    try {
      await api.patch(`/finance/entries/${editModal.financialEntry.id}`, {
        description: editDesc || undefined,
        financialAccountId: editAccountId || undefined,
        notes: editNotes || undefined,
      });
      toast("Lancamento atualizado com sucesso!", "success");
      setEditModal(null);
      loadSettlements();
    } catch {
      toast("Erro ao atualizar lancamento.", "error");
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Column definitions ───────────────────────────────── */

  const columnDefs: ColumnDefinition<CardSettlement>[] = useMemo(
    () => [
      {
        id: "acoes",
        label: "Ações",
        sortable: false,
        align: "center" as const,
        render: (cs) => (
          <div className="flex items-center justify-center">
            <ActionsDropdown cs={cs} onSettle={openSettleModal} />
          </div>
        ),
      },
      {
        id: "descricao",
        label: "Descrição",
        sortable: true,
        sortKey: "cardBrand",
        render: (cs) => {
          // Use direct relation first, fallback to fuzzy match for old data
          const cardDesc = cs.cardFeeRate?.description
            || feeRates.find(
                (r) => r.brand === cs.cardBrand && Math.abs(r.feePercent - cs.feePercent) < 0.01,
              )?.description
            || cs.cardBrand
            || cs.paymentMethodCode
            || "—";
          return (
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {cardDesc}
              </p>
              {cs.financialEntry?.partner?.name && (
                <p className="text-xs text-slate-500 truncate">
                  {cs.financialEntry.partner.name}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "bruto",
        label: "Bruto",
        sortable: true,
        sortKey: "grossCents",
        align: "right" as const,
        render: (cs) => (
          <span className="text-sm font-medium text-slate-700">
            {formatCurrency(cs.grossCents)}
          </span>
        ),
      },
      {
        id: "taxa",
        label: "Taxa",
        sortable: true,
        sortKey: "feePercent",
        render: (cs) => (
          <span className="text-xs text-slate-500">
            {cs.feePercent.toFixed(2)}% ({formatCurrency(cs.feeCents)})
          </span>
        ),
      },
      {
        id: "liquido",
        label: "Líquido",
        sortable: true,
        sortKey: "expectedNetCents",
        align: "right" as const,
        render: (cs) => (
          <span className="text-sm font-semibold text-green-700">
            {formatCurrency(cs.expectedNetCents)}
          </span>
        ),
      },
      {
        id: "dataPrevista",
        label: "Data Prevista",
        sortable: true,
        sortKey: "expectedDate",
        render: (cs) => (
          <span className="text-sm text-slate-700 whitespace-nowrap">
            {formatDate(cs.expectedDate)}
          </span>
        ),
      },
      {
        id: "dias",
        label: "Dias",
        sortable: false,
        render: (cs) => {
          if (cs.status === "SETTLED") {
            return (
              <div className="text-xs text-green-600">
                <p>Baixado</p>
                {cs.settledAt && (
                  <p className="text-slate-400">{formatDateTime(cs.settledAt)}</p>
                )}
              </div>
            );
          }
          if (cs.status === "CANCELLED") {
            return <span className="text-xs text-slate-400">Cancelado</span>;
          }
          const days = daysUntil(cs.expectedDate);
          let color = "text-green-600";
          let label = `${days}d restantes`;
          if (days < 0) {
            color = "text-red-600 font-semibold";
            label = `${Math.abs(days)}d atrasado`;
          } else if (days === 0) {
            color = "text-amber-600 font-semibold";
            label = "Hoje";
          } else if (days <= 3) {
            color = "text-amber-600";
          }
          return <span className={`text-xs ${color}`}>{label}</span>;
        },
      },
      {
        id: "status",
        label: "Status",
        sortable: true,
        sortKey: "status",
        align: "center" as const,
        render: (cs) => {
          const cfg = CARD_SETTLEMENT_STATUS_CONFIG[cs.status];
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}
            >
              {cfg.label}
            </span>
          );
        },
      },
    ],
    [feeRates],
  );

  /* ── Table layout (drag/resize) ───────────────────────── */

  const {
    orderedColumns,
    columnOrder,
    reorderColumns,
    columnWidths,
    setColumnWidth,
  } = useTableLayout("card-settlements-v2", columnDefs);

  /* ── Selection helpers ────────────────────────────────── */

  const pendingRows = settlements.data.filter((cs) => cs.status === "PENDING");
  const allPendingSelected =
    pendingRows.length > 0 && pendingRows.every((cs) => selectedIds.has(cs.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRows.map((cs) => cs.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  /* ── Settle modal ─────────────────────────────────────── */

  function openSettleModal(cs: CardSettlement) {
    setSettleModal({ cs });
    setSettleInstallments(1);
    setSettleAmount((cs.expectedNetCents / 100).toFixed(2));
    setSettleCashAccountId(cashAccounts.length > 0 ? cashAccounts[0].id : "");
    setSettleNotes("");
    // Load fee rates if not loaded yet
    if (feeRates.length === 0) loadFeeRates();
  }

  function closeSettleModal() {
    setSettleModal(null);
    setSettleAmount("");
    setSettleCashAccountId("");
    setSettleNotes("");
    setSettleInstallments(1);
  }

  function handleSettleInstallmentsChange(value: number) {
    setSettleInstallments(value);
    // Auto-recalculate amount based on new installments
    if (settleModal) {
      const cs = settleModal.cs;
      const cardType = (cs.paymentMethodCode || "").toUpperCase().includes("DEBIT") ? "DEBITO" : "CREDITO";
      const rate = feeRates.find(
        (r) => r.brand === cs.cardBrand && r.type === cardType && r.isActive &&
          r.installmentFrom <= value && r.installmentTo >= value,
      );
      if (rate) {
        const feeCents = Math.round(cs.grossCents * rate.feePercent / 100);
        const netCents = cs.grossCents - feeCents;
        setSettleAmount((netCents / 100).toFixed(2));
      }
    }
  }

  async function handleSettle() {
    if (!settleModal) return;
    const cs = settleModal.cs;
    const amountParsed = parseFloat(settleAmount);
    if (isNaN(amountParsed) || amountParsed <= 0) {
      toast("Informe um valor valido.", "error");
      return;
    }
    if (!settleCashAccountId) {
      toast("Selecione a conta de destino.", "error");
      return;
    }

    setSettling(true);
    try {
      await api.patch(`/finance/card-settlements/${cs.id}/settle`, {
        actualAmountCents: Math.round(amountParsed * 100),
        cashAccountId: settleCashAccountId,
        installments: settleInstallments,
        notes: settleNotes.trim() || undefined,
      });
      toast("Baixa realizada com sucesso!", "success");
      closeSettleModal();
      clearSelection();
      await Promise.all([loadSettlements(), loadSummary()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao realizar baixa.";
      toast(msg, "error");
    } finally {
      setSettling(false);
    }
  }

  /* ── Cancel ───────────────────────────────────────────── */

  async function handleCancel(cs: CardSettlement) {
    if (!window.confirm(`Deseja cancelar a baixa de cartao "${cs.financialEntry?.description || cs.id}"?`)) {
      return;
    }
    try {
      await api.patch(`/finance/card-settlements/${cs.id}/cancel`);
      toast("Baixa cancelada.", "success");
      await Promise.all([loadSettlements(), loadSummary()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar.";
      toast(msg, "error");
    }
  }

  /* ── Batch modal ──────────────────────────────────────── */

  function openBatchModal() {
    setBatchCashAccountId(cashAccounts.length > 0 ? cashAccounts[0].id : "");
    setBatchNotes("");
    setBatchModal(true);
  }

  function closeBatchModal() {
    setBatchModal(false);
    setBatchCashAccountId("");
    setBatchNotes("");
  }

  async function handleBatchSettle() {
    if (!batchCashAccountId) {
      toast("Selecione a conta de destino.", "error");
      return;
    }
    if (selectedIds.size === 0) {
      toast("Nenhum item selecionado.", "error");
      return;
    }

    setSettling(true);
    try {
      await api.post("/finance/card-settlements/batch-settle", {
        ids: [...selectedIds],
        cashAccountId: batchCashAccountId,
        useExpectedAmounts: true,
        notes: batchNotes.trim() || undefined,
      });
      toast(`${selectedIds.size} baixa(s) realizada(s) com sucesso!`, "success");
      closeBatchModal();
      clearSelection();
      await Promise.all([loadSettlements(), loadSummary()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro na baixa em lote.";
      toast(msg, "error");
    } finally {
      setSettling(false);
    }
  }

  /* ── Settle modal: available rates & fee calculation ──── */

  const settleAvailableRates = useMemo(() => {
    if (!settleModal) return [];
    const cs = settleModal.cs;
    const cardType = (cs.paymentMethodCode || "").toUpperCase().includes("DEBIT") ? "DEBITO" : "CREDITO";
    return feeRates
      .filter((r) => r.brand === cs.cardBrand && r.type === cardType && r.isActive)
      .sort((a, b) => a.installmentFrom - b.installmentFrom);
  }, [settleModal, feeRates]);

  const settleCalculatedFee = useMemo(() => {
    if (!settleModal || settleAvailableRates.length === 0) return null;
    const rate = settleAvailableRates.find(
      (r) => r.installmentFrom <= settleInstallments && r.installmentTo >= settleInstallments,
    );
    if (!rate) return null;
    const feeCents = Math.round(settleModal.cs.grossCents * rate.feePercent / 100);
    const netCents = settleModal.cs.grossCents - feeCents;
    return { feePercent: rate.feePercent, feeCents, netCents, receivingDays: rate.receivingDays };
  }, [settleModal, settleAvailableRates, settleInstallments]);

  // Use calculated fee or fallback to settlement defaults
  const effectiveFeePercent = settleCalculatedFee?.feePercent ?? settleModal?.cs.feePercent ?? 0;
  const effectiveFeeCents = settleCalculatedFee?.feeCents ?? settleModal?.cs.feeCents ?? 0;
  const effectiveNetCents = settleCalculatedFee?.netCents ?? settleModal?.cs.expectedNetCents ?? 0;

  const settleDifferenceCents = settleModal
    ? Math.round(parseFloat(settleAmount || "0") * 100) - effectiveNetCents
    : 0;

  function getDifferenceColor(diffCents: number): string {
    if (diffCents === 0) return "text-green-600";
    if (Math.abs(diffCents) <= 100) return "text-amber-600";
    return "text-red-600";
  }

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div>
      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {summaryLoading ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </>
        ) : summary ? (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <span className="text-xs font-medium text-amber-700">Pendentes</span>
              <p className="mt-1 text-2xl font-bold text-amber-900">
                {formatCurrency(summary.pendingAmountCents)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary.pendingCount} lancamento{summary.pendingCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <span className="text-xs font-medium text-blue-700">
                Previsto esta semana
              </span>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatCurrency(summary.expectedThisWeekCents)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary.expectedThisWeekCount} lancamento{summary.expectedThisWeekCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <span className="text-xs font-medium text-red-700">Atrasados</span>
              <p className="mt-1 text-2xl font-bold text-red-900">
                {formatCurrency(summary.overdueCents)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary.overdueCount} lancamento{summary.overdueCount !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Fee Rates Section (Collapsible) ─────────────── */}
      <div className="mb-6">
        <button
          onClick={() => setShowFeeRates(!showFeeRates)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
        >
          <svg
            className={`h-4 w-4 transition-transform ${showFeeRates ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Configurar Taxas por Bandeira
          <span className="text-xs text-slate-400">({feeRates.length} taxas cadastradas)</span>
        </button>

        {showFeeRates && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-800">Taxas de Cartao</h4>
              <button
                onClick={openNewFeeForm}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                + Nova Taxa
              </button>
            </div>

            {/* Fee rate form (inline) */}
            {feeForm && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-xs font-semibold text-blue-800 mb-3">
                  {feeForm.id ? "Editar Taxa" : "Nova Taxa"}
                </h5>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Descricao *</label>
                    <input
                      type="text"
                      value={feeForm.description}
                      onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })}
                      placeholder="Ex: Visa Credito 1x, Mastercard Debito a vista..."
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Bandeira</label>
                    <select
                      value={feeForm.brand}
                      onChange={(e) => setFeeForm({ ...feeForm, brand: e.target.value })}
                      disabled={!!feeForm.id}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white disabled:bg-slate-100"
                    >
                      {CARD_BRANDS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Tipo</label>
                    <select
                      value={feeForm.type}
                      onChange={(e) => setFeeForm({ ...feeForm, type: e.target.value })}
                      disabled={!!feeForm.id}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white disabled:bg-slate-100"
                    >
                      {CARD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Parcelas De</label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={feeForm.installmentFrom}
                      onChange={(e) => setFeeForm({ ...feeForm, installmentFrom: parseInt(e.target.value) || 1 })}
                      disabled={!!feeForm.id}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Parcelas Ate</label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={feeForm.installmentTo}
                      onChange={(e) => setFeeForm({ ...feeForm, installmentTo: parseInt(e.target.value) || 1 })}
                      disabled={!!feeForm.id}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Taxa (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={feeForm.feePercent}
                      onChange={(e) => setFeeForm({ ...feeForm, feePercent: e.target.value })}
                      placeholder="ex: 2.49"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Dias Receb.</label>
                    <input
                      type="number"
                      min={0}
                      value={feeForm.receivingDays}
                      onChange={(e) => setFeeForm({ ...feeForm, receivingDays: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setFeeForm(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveFeeRate}
                    disabled={feeSaving}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {feeSaving ? "Salvando..." : feeForm.id ? "Atualizar" : "Salvar"}
                  </button>
                </div>
              </div>
            )}

            {/* Fee rates table */}
            {feeRatesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : feeRates.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Nenhuma taxa cadastrada. Clique em &quot;+ Nova Taxa&quot; para adicionar.
              </p>
            ) : (
              <div className="space-y-4">
                {[...feeRatesByBrand.entries()].map(([brand, rates]) => (
                  <div key={brand}>
                    <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                      {brand}
                    </h5>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-2 px-3 text-left font-medium text-slate-600">Descricao</th>
                            <th className="py-2 px-3 text-left font-medium text-slate-600">Tipo</th>
                            <th className="py-2 px-3 text-center font-medium text-slate-600">Parcelas</th>
                            <th className="py-2 px-3 text-right font-medium text-slate-600">Taxa (%)</th>
                            <th className="py-2 px-3 text-right font-medium text-slate-600">Dias</th>
                            <th className="py-2 px-3 text-center font-medium text-slate-600">Status</th>
                            <th className="py-2 px-3 text-center font-medium text-slate-600">Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rates.map((r) => (
                            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-800 font-medium">
                                {r.description || "-"}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  r.type === "CREDITO"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                                }`}>
                                  {r.type === "CREDITO" ? "Credito" : "Debito"}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-700">
                                {r.installmentFrom === r.installmentTo
                                  ? `${r.installmentFrom}x`
                                  : `${r.installmentFrom}x - ${r.installmentTo}x`}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-800">
                                {r.feePercent.toFixed(2)}%
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600">
                                {r.receivingDays}d
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`inline-block w-2 h-2 rounded-full ${r.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEditFeeForm(r)}
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                    title="Editar"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => deleteFeeRate(r.id)}
                                    className="text-red-500 hover:text-red-700 font-medium"
                                    title="Excluir"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <FilterBar
        filters={filterDefs}
        values={{ ...filters, status: effectiveStatus }}
        onChange={(key, value) => {
          if (key === "status" && value === "ALL") {
            setFilter(key, "ALL");
          } else {
            setFilter(key, value);
          }
        }}
        onReset={resetFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por descricao ou parceiro..."
      />

      {/* ── Batch bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3">
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={openBatchModal}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Baixar Selecionados
          </button>
          <button
            onClick={clearSelection}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      ) : settlements.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Nenhuma baixa de cartao encontrada.</p>
          <p className="text-xs text-slate-400 mt-1">
            As baixas sao criadas automaticamente ao registrar pagamentos com cartao.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {/* Checkbox column */}
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                  >
                    {col.sortable ? (
                      <SortableHeader
                        label={col.label}
                        column={col.sortKey || col.id}
                        currentColumn={sort.column}
                        currentOrder={sort.order}
                        onToggle={toggleSort}
                        align={col.align}
                        as="div"
                      />
                    ) : (
                      <div
                        className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {col.label}
                      </div>
                    )}
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.data.map((cs) => (
                <tr
                  key={cs.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-3 w-10">
                    {cs.status === "PENDING" ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(cs.id)}
                        onChange={() => toggleSelect(cs.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    ) : (
                      <span />
                    )}
                  </td>
                  {orderedColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`py-3 px-4 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                      style={
                        columnWidths[col.id]
                          ? {
                              width: `${columnWidths[col.id]}px`,
                              minWidth: `${columnWidths[col.id]}px`,
                              maxWidth: `${columnWidths[col.id]}px`,
                            }
                          : undefined
                      }
                    >
                      {col.render(cs)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────── */}
      <Pagination meta={settlements.meta} onPageChange={setPage} />

      {/* ── Settle Modal (single) ─────────────────────────── */}
      {settleModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeSettleModal}
          />
          <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Baixar Cartao
            </h3>

            {/* Info */}
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Descricao</span>
                <span className="font-medium text-slate-900">
                  {settleModal.cs.financialEntry?.description || "—"}
                </span>
              </div>
              {settleModal.cs.financialEntry?.partner?.name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Parceiro</span>
                  <span className="font-medium text-slate-900">
                    {settleModal.cs.financialEntry.partner.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Bandeira</span>
                <span className="font-medium text-slate-700">
                  {settleModal.cs.cardBrand || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor Bruto</span>
                <span className="font-medium text-slate-700">
                  {formatCurrency(settleModal.cs.grossCents)}
                </span>
              </div>
            </div>

            {/* Parcelas + Fee calculation */}
            <div className="space-y-4">
              {settleAvailableRates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Parcelas *
                  </label>
                  <select
                    value={settleInstallments}
                    onChange={(e) => handleSettleInstallmentsChange(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    {settleAvailableRates.map((r) => (
                      <option key={r.id} value={r.installmentFrom}>
                        {r.installmentFrom === r.installmentTo
                          ? `${r.installmentFrom}x — ${r.feePercent.toFixed(2)}% (${r.receivingDays}d)`
                          : `${r.installmentFrom}x a ${r.installmentTo}x — ${r.feePercent.toFixed(2)}% (${r.receivingDays}d)`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fee preview */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa</span>
                  <span className="font-medium text-red-600">
                    {effectiveFeePercent.toFixed(2)}% = {formatCurrency(effectiveFeeCents)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500 font-medium">Liquido Esperado</span>
                  <span className="font-bold text-green-700">
                    {formatCurrency(effectiveNetCents)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Valor Recebido (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                {/* Difference indicator */}
                {settleAmount && !isNaN(parseFloat(settleAmount)) && (
                  <p className={`mt-1 text-xs ${getDifferenceColor(settleDifferenceCents)}`}>
                    Diferenca: {settleDifferenceCents >= 0 ? "+" : ""}
                    {formatCurrency(settleDifferenceCents)}
                    {settleDifferenceCents === 0 && " (exato)"}
                  </p>
                )}
              </div>

              {/* Cash account select */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Conta de destino *
                </label>
                <select
                  value={settleCashAccountId}
                  onChange={(e) => setSettleCashAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === "CAIXA" ? "Caixa" : "Banco"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Observacoes
                </label>
                <textarea
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  rows={2}
                  placeholder="Observacoes opcionais..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeSettleModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSettle}
                disabled={settling}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {settling ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Processando...
                  </span>
                ) : (
                  "Confirmar Baixa"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Modal ───────────────────────────────────── */}
      {batchModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeBatchModal}
          />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Baixa em Lote
            </h3>

            {(() => {
              const selected = settlements.data.filter((cs) => selectedIds.has(cs.id));
              const totalNet = selected.reduce((sum, cs) => sum + cs.expectedNetCents, 0);
              const totalFees = selected.reduce((sum, cs) => sum + cs.feeCents, 0);
              return (
                <>
                  <p className="text-sm text-slate-600 mb-3">
                    Serao baixados <strong>{selectedIds.size}</strong> lancamento
                    {selectedIds.size !== 1 ? "s" : ""} utilizando os valores esperados
                    (liquido) de cada um.
                  </p>
                  <div className="flex gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Total Liquido</p>
                      <p className="text-base font-semibold text-green-700">{formatCurrency(totalNet)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Total Taxas</p>
                      <p className="text-base font-semibold text-red-600">{formatCurrency(totalFees)}</p>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="space-y-4">
              {/* Cash account select */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Conta de destino *
                </label>
                <select
                  value={batchCashAccountId}
                  onChange={(e) => setBatchCashAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === "CAIXA" ? "Caixa" : "Banco"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Observacoes
                </label>
                <textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  rows={2}
                  placeholder="Observacoes opcionais..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeBatchModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchSettle}
                disabled={settling}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {settling ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Processando...
                  </span>
                ) : (
                  "Confirmar Baixa em Lote"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Entry Modal ─────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditModal(null)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Editar Lancamento
            </h3>

            <div className="space-y-4">
              {/* Descricao */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descricao
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Descricao do lancamento..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Categoria
                </label>
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
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>

              {/* Observacoes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Observacoes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Observacoes opcionais..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
