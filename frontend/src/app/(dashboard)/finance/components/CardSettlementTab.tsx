"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "@/types/finance";
import { CARD_SETTLEMENT_STATUS_CONFIG } from "@/types/finance";

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
  { key: "dateTo", label: "Ate", type: "date" },
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
  const [settling, setSettling] = useState(false);

  // Batch
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModal, setBatchModal] = useState(false);
  const [batchCashAccountId, setBatchCashAccountId] = useState("");
  const [batchNotes, setBatchNotes] = useState("");

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
  }, [loadSummary, loadCashAccounts]);

  // Load settlements when filters/pagination change
  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  /* ── Column definitions ───────────────────────────────── */

  const columnDefs: ColumnDefinition<CardSettlement>[] = useMemo(
    () => [
      {
        id: "descricao",
        label: "Descricao",
        sortable: true,
        sortKey: "description",
        render: (cs) => (
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {cs.financialEntry?.description || "—"}
            </p>
            {cs.financialEntry?.partner?.name && (
              <p className="text-xs text-slate-500 truncate">
                {cs.financialEntry.partner.name}
              </p>
            )}
          </div>
        ),
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
        label: "Liquido",
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
        id: "bandeira",
        label: "Bandeira",
        sortable: true,
        sortKey: "cardBrand",
        render: (cs) => (
          <span className="text-xs text-slate-600">
            {cs.cardBrand || cs.paymentMethodCode || "—"}
          </span>
        ),
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
      {
        id: "acoes",
        label: "Acoes",
        sortable: false,
        align: "center" as const,
        render: (cs) => {
          if (cs.status !== "PENDING") {
            return <span className="text-xs text-slate-400">—</span>;
          }
          return (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openSettleModal(cs);
                }}
                className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Baixar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel(cs);
                }}
                className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  /* ── Table layout (drag/resize) ───────────────────────── */

  const {
    orderedColumns,
    columnOrder,
    reorderColumns,
    columnWidths,
    setColumnWidth,
  } = useTableLayout("card-settlements", columnDefs);

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
    setSettleAmount((cs.expectedNetCents / 100).toFixed(2));
    setSettleCashAccountId(cashAccounts.length > 0 ? cashAccounts[0].id : "");
    setSettleNotes("");
  }

  function closeSettleModal() {
    setSettleModal(null);
    setSettleAmount("");
    setSettleCashAccountId("");
    setSettleNotes("");
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

  /* ── Settle modal difference ──────────────────────────── */

  const settleDifferenceCents = settleModal
    ? Math.round(parseFloat(settleAmount || "0") * 100) - settleModal.cs.expectedNetCents
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
                <span className="text-slate-500">Bruto</span>
                <span className="font-medium text-slate-700">
                  {formatCurrency(settleModal.cs.grossCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Taxa</span>
                <span className="font-medium text-slate-500">
                  {settleModal.cs.feePercent.toFixed(2)}% (
                  {formatCurrency(settleModal.cs.feeCents)})
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Liq. Esperado</span>
                <span className="font-semibold text-green-700">
                  {formatCurrency(settleModal.cs.expectedNetCents)}
                </span>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-4">
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

            <p className="text-sm text-slate-600 mb-4">
              Serao baixados <strong>{selectedIds.size}</strong> lancamento
              {selectedIds.size !== 1 ? "s" : ""} utilizando os valores esperados
              (liquido) de cada um.
            </p>

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
    </div>
  );
}
