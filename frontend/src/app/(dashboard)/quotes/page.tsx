"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
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
    render: (q) => <span className="text-sm font-medium">{formatCurrency(q.totalCents)}</span>,
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

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/quotes/${id}/duplicate`);
      toast("Orçamento duplicado", "success");
      loadQuotes();
      loadStats();
    } catch {
      toast("Erro ao duplicar", "error");
    }
  };

  const handleSend = async (id: string) => {
    try {
      await api.post(`/quotes/${id}/send`, {});
      toast("Orçamento enviado ao cliente", "success");
      loadQuotes();
      loadStats();
    } catch {
      toast("Erro ao enviar orçamento", "error");
    }
  };

  // Inject action column render
  const columnsWithActions = orderedColumns.map((col) => {
    if (col.id === "actions") {
      return {
        ...col,
        render: (q: Quote) => (
          <div className="flex items-center justify-end gap-1">
            {/* View */}
            <Link
              href={`/quotes/${q.id}`}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Ver"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            {/* Edit (only RASCUNHO) */}
            {q.status === "RASCUNHO" && (
              <Link
                href={`/quotes/${q.id}/edit`}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                title="Editar"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </Link>
            )}

            {/* Send (RASCUNHO or ENVIADO) */}
            {["RASCUNHO", "ENVIADO"].includes(q.status) && (
              <button
                onClick={() => handleSend(q.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-green-600"
                title="Enviar"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            )}

            {/* Duplicate */}
            <button
              onClick={() => handleDuplicate(q.id)}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Duplicar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            </button>

            {/* Delete (only RASCUNHO) */}
            {q.status === "RASCUNHO" && (
              <button
                onClick={() => setConfirmDelete(q.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                title="Excluir"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}

            {/* PDF */}
            <a
              href={`/api/quotes/${q.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="PDF"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </a>
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
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
