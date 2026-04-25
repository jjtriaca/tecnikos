"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import ConfirmModal from "@/components/ui/ConfirmModal";

/* ── Types ────────────────────────────────────────────── */

interface Quote {
  id: string;
  code: string | null;
  title: string;
  status: string;
  totalCents: number;
  subtotalCents: number;
  validityDays: number;
  expiresAt: string | null;
  deliveryMethod: string;
  approvalMode: string;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  clientPartner: { id: string; name: string; phone: string | null; email: string | null };
  serviceOrder: { id: string; code: string; title: string } | null;
  _count: { items: number; attachments: number };
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: "bg-slate-100 text-slate-700 border-slate-300",
  ENVIADO: "bg-blue-100 text-blue-700 border-blue-300",
  APROVADO: "bg-green-100 text-green-700 border-green-300",
  REJEITADO: "bg-red-100 text-red-700 border-red-300",
  EXPIRADO: "bg-orange-100 text-orange-700 border-orange-300",
  CANCELADO: "bg-slate-200 text-slate-500 border-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
};

/* ── Filters ──────────────────────────────────────────── */

const QUOTE_FILTERS: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
  { key: "dateFrom", label: "De", type: "date" },
  { key: "dateTo", label: "Até", type: "date" },
];

/* ── Actions Dropdown (same pattern as OS page) ──────── */

function ActionsDropdown({
  quote,
  onDuplicate,
  onDelete,
  onSend,
  onPdf,
  onConvertToOs,
}: {
  quote: Quote;
  onDuplicate: (q: Quote) => void;
  onDelete: (q: Quote) => void;
  onSend: (q: Quote) => void;
  onPdf: (q: Quote) => void;
  onConvertToOs: (q: Quote) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 200;
      const fitsBelow = rect.bottom + menuHeight < window.innerHeight;
      setPos({
        top: fitsBelow ? rect.bottom + 4 : rect.top - menuHeight - 4,
        left: Math.max(8, rect.right - 168),
      });
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  const canEdit = ["RASCUNHO", "ENVIADO"].includes(quote.status);
  const canSend = quote.status === "RASCUNHO";
  const canDelete = quote.status === "RASCUNHO";
  const canConvertToOs = ["RASCUNHO", "APROVADO", "ENVIADO"].includes(quote.status) && !quote.serviceOrder;

  return (
    <div ref={wrapperRef}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          className="fixed z-50 min-w-[168px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
          style={{ top: pos.top, left: pos.left }}
        >
          {/* Ver detalhes */}
          <Link
            href={`/quotes/${quote.id}`}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            Ver detalhes
          </Link>

          {/* Abrir PDF */}
          <button
            onClick={() => { setOpen(false); onPdf(quote); }}
            className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Abrir PDF
          </button>

          {/* Editar */}
          {canEdit && (
            <Link
              href={`/quotes/${quote.id}/edit`}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              Editar
            </Link>
          )}

          {/* Duplicar */}
          <button
            onClick={() => { setOpen(false); onDuplicate(quote); }}
            className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Duplicar
          </button>

          {/* Converter em OS */}
          {canConvertToOs && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setOpen(false); onConvertToOs(quote); }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Converter em OS
              </button>
            </>
          )}

          {/* Enviar */}
          {canSend && (
            <button
              onClick={() => { setOpen(false); onSend(quote); }}
              className="block w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              Enviar ao cliente
            </button>
          )}

          {/* Excluir */}
          {canDelete && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setOpen(false); onDelete(quote); }}
                className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Excluir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Columns ──────────────────────────────────────────── */

const QUOTE_COLUMNS: ColumnDefinition<Quote>[] = [
  {
    id: "actions",
    label: "Ações",
    align: "right",
    render: () => null as any,
  },
  {
    id: "code",
    label: "Código",
    sortable: true,
    render: (q) => <span className="text-sm font-mono text-slate-600">{q.code || "—"}</span>,
  },
  {
    id: "title",
    label: "Título",
    sortable: true,
    render: (q) => (
      <Link href={`/quotes/${q.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600">
        {q.title}
      </Link>
    ),
  },
  {
    id: "clientName",
    label: "Cliente",
    sortable: true,
    sortKey: "clientName",
    render: (q) => <span className="text-sm text-slate-700">{q.clientPartner?.name || "—"}</span>,
  },
  {
    id: "totalCents",
    label: "Valor",
    sortable: true,
    align: "right",
    render: (q) => <span className="text-sm font-semibold text-slate-800">{formatCurrency(q.totalCents)}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortable: true,
    render: (q) => (
      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status] || ""}`}>
        {STATUS_LABELS[q.status] || q.status}
      </span>
    ),
  },
  {
    id: "expiresAt",
    label: "Validade",
    sortable: true,
    render: (q) => {
      const expired = q.expiresAt && new Date(q.expiresAt) < new Date();
      return (
        <span className={`text-sm ${expired ? "text-red-600 font-medium" : "text-slate-600"}`}>
          {formatDate(q.expiresAt)}
        </span>
      );
    },
  },
  {
    id: "createdAt",
    label: "Criado em",
    sortable: true,
    render: (q) => <span className="text-sm text-slate-500">{formatDate(q.createdAt)}</span>,
  },
];

/* ── Page Component ──────────────────────────────────── */

export default function QuotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const tp = useTableParams({ persistKey: "quotes-list" });
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } =
    useTableLayout("quotes-list", QUOTE_COLUMNS);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tp.buildQueryString();
      const res = await api.get<{ data: Quote[]; meta: PaginationMeta }>(`/quotes?${qs}`);
      setQuotes(res.data);
      setMeta(res.meta);
    } catch {
      toast("Erro ao carregar orçamentos", "error");
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString]);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.get<Record<string, number>>("/quotes/stats");
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/quotes/${id}`);
      toast("Orçamento excluído", "success");
      loadQuotes();
      loadStats();
    } catch {
      toast("Erro ao excluir orçamento", "error");
    }
    setConfirmDelete(null);
  };

  const handleDuplicate = async (q: Quote) => {
    try {
      await api.post(`/quotes/${q.id}/duplicate`);
      toast("Orçamento duplicado", "success");
      loadQuotes();
      loadStats();
    } catch {
      toast("Erro ao duplicar", "error");
    }
  };

  const handleSend = async (q: Quote) => {
    try {
      await api.post(`/quotes/${q.id}/send`, {});
      toast("Orçamento enviado ao cliente", "success");
      loadQuotes();
      loadStats();
    } catch {
      toast("Erro ao enviar orçamento", "error");
    }
  };

  const handlePdf = async (q: Quote) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/quotes/${q.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "Erro ao gerar PDF");
      }
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `${q.code || "ORC"}.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      toast(err?.message || "Erro ao gerar PDF", "error");
    }
  };

  const handleConvertToOs = (q: Quote) => {
    router.push(`/orders/new?fromQuote=${q.id}`);
  };

  // Inject action column render
  const columnsWithActions = orderedColumns.map((col) => {
    if (col.id === "actions") {
      return {
        ...col,
        render: (q: Quote) => (
          <div className="flex items-center justify-end gap-1">
            <ActionsDropdown
              quote={q}
              onDuplicate={handleDuplicate}
              onDelete={(q) => setConfirmDelete(q.id)}
              onSend={handleSend}
              onPdf={handlePdf}
              onConvertToOs={handleConvertToOs}
            />
          </div>
        ),
      };
    }
    return col;
  });

  const totalAll = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orçamentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalAll} orçamento{totalAll !== 1 ? "s" : ""} no total
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Orçamento
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {(["RASCUNHO", "ENVIADO", "APROVADO", "REJEITADO", "EXPIRADO", "CANCELADO"] as const).map((status) => (
          <button
            key={status}
            onClick={() => tp.setFilter("status", tp.filters.status === status ? "" : status)}
            className={`rounded-lg border p-3 text-center transition-all ${
              tp.filters.status === status ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="text-lg font-bold text-slate-900">{stats[status] || 0}</div>
            <div className="text-xs text-slate-500">{STATUS_LABELS[status]}</div>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={QUOTE_FILTERS}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por título, código ou cliente..."
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: "900px" }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columnsWithActions.map((col, idx) => (
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
            {loading ? (
              <tr>
                <td colSpan={columnsWithActions.length} className="py-16 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td colSpan={columnsWithActions.length} className="py-16 text-center text-slate-400">
                  Nenhum orçamento encontrado
                </td>
              </tr>
            ) : (
              quotes.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-100 transition-colors">
                  {columnsWithActions.map((col) => {
                    const w = columnWidths[col.id];
                    const tdStyle = w
                      ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden" }
                      : {};
                    return (
                      <td
                        key={col.id}
                        style={tdStyle}
                        className={`py-3 px-4 ${col.align === "right" ? "text-right" : ""}`}
                      >
                        {col.render(q)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination meta={meta} onPageChange={tp.setPage} />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!confirmDelete}
        title="Excluir Orçamento"
        message="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
