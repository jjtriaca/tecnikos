"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AuditLogDrawer from "@/components/ui/AuditLogDrawer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import { exportToCSV, fmtDate, fmtDateTime, fmtMoney, fmtStatus, type ExportColumn } from "@/lib/export-utils";
import AgendaView from "@/components/os/AgendaView";
import EarlyFinancialModal from "@/components/os/EarlyFinancialModal";

type OrdersTabId = "lista" | "agenda";
const ORDERS_TABS: { id: OrdersTabId; label: string; icon: string }[] = [
  { id: "lista", label: "Lista", icon: "📋" },
  { id: "agenda", label: "Agenda", icon: "📅" },
];

type ServiceOrder = {
  id: string;
  code: string | null;
  title: string;
  description?: string;
  addressText: string;
  status: string;
  valueCents: number;
  techCommissionCents?: number | null;
  commissionBps?: number | null;
  deadlineAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  assignedPartner?: { id: string; name: string; phone: string } | null;
  clientPartner?: { id: string; name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Ofertada",
  ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDA: "Concluída",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
  CANCELADA: "Cancelada",
  RECUSADA: "Recusada",
};

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  OFERTADA: "bg-orange-100 text-orange-800 border-orange-200",
  ATRIBUIDA: "bg-blue-100 text-blue-800 border-blue-200",
  EM_EXECUCAO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CONCLUIDA: "bg-green-100 text-green-800 border-green-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AJUSTE: "bg-amber-100 text-amber-800 border-amber-200",
  CANCELADA: "bg-slate-100 text-slate-600 border-slate-200",
  RECUSADA: "bg-red-100 text-red-800 border-red-200",
};

const TERMINAL_STATUSES = ["CONCLUIDA", "APROVADA", "CANCELADA"];

const ORDER_FILTERS: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "Todos os Status",
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
  { key: "dateFrom", label: "De", type: "date" },
  { key: "dateTo", label: "Até", type: "date" },
  { key: "valueMin", label: "Valor mín (R$)", type: "numberRange", placeholder: "0" },
  { key: "valueMax", label: "Valor máx (R$)", type: "numberRange", placeholder: "0" },
];

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(order: ServiceOrder) {
  return (
    new Date(order.deadlineAt) < new Date() &&
    !TERMINAL_STATUSES.includes(order.status)
  );
}

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

/* ---- Audit clock icon ---- */
function AuditToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Histórico de alterações"
      className={`rounded border px-1.5 py-1 text-xs transition-colors ${active ? "border-blue-300 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

/* ---- Actions dropdown (fixed positioning to escape overflow clip) ---- */
function ActionsDropdown({
  order,
  canEdit,
  canDelete,
  onCancel,
  onDuplicate,
  onDelete,
  onEarlyFinancial,
  sysConfig,
}: {
  order: ServiceOrder;
  canEdit: boolean;
  canDelete: boolean;
  onCancel: (order: ServiceOrder) => void;
  onDuplicate: (order: ServiceOrder) => void;
  onDelete: (order: ServiceOrder) => void;
  onEarlyFinancial: (order: ServiceOrder) => void;
  sysConfig: any;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isEditable = (() => {
    if (!TERMINAL_STATUSES.includes(order.status)) return true;
    if (order.status === "CONCLUIDA" && sysConfig?.os?.allowEditConcluida) return true;
    if (order.status === "APROVADA" && sysConfig?.os?.allowEditAprovada) return true;
    return false;
  })();

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 220; // estimated max height
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

  // Close on scroll to avoid stale position
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

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
            href={`/orders/${order.id}`}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Ver detalhes
          </Link>

          {/* Editar */}
          {canEdit && isEditable && (
            <Link
              href={`/orders/${order.id}/edit`}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Editar
            </Link>
          )}

          {/* Duplicar */}
          {canEdit && (
            <button
              onClick={() => { setOpen(false); onDuplicate(order); }}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Duplicar
            </button>
          )}

          {/* Lancar Financeiro Antecipado */}
          {canEdit && isEditable && order.status !== "ABERTA" && (
            <button
              onClick={() => { setOpen(false); onEarlyFinancial(order); }}
              className="block w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50"
            >
              Lancar Financeiro
            </button>
          )}

          {/* Retorno */}
          {canEdit && TERMINAL_STATUSES.includes(order.status) && (
            <Link
              href={`/orders/new?returnFrom=${order.id}`}
              className="block px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
              onClick={() => setOpen(false)}
            >
              Retorno
            </Link>
          )}

          {/* Cancelar */}
          {canEdit && isEditable && (
            <button
              onClick={() => { setOpen(false); onCancel(order); }}
              className="block w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
            >
              Cancelar
            </button>
          )}

          {/* Excluir */}
          {canDelete && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setOpen(false); onDelete(order); }}
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

/* ---- Column definitions ---- */
function makeColumns(
  canEdit: boolean,
  canDelete: boolean,
  onCancel: (o: ServiceOrder) => void,
  onDuplicate: (o: ServiceOrder) => void,
  onDelete: (o: ServiceOrder) => void,
  onEarlyFinancial: (o: ServiceOrder) => void,
  expandedAuditId: string | null,
  onToggleAudit: (id: string) => void,
  sysConfig: any,
): ColumnDefinition<ServiceOrder>[] {
  const cols: ColumnDefinition<ServiceOrder>[] = [
    {
      id: "code",
      label: "Código",
      sortable: true,
      render: (order) => <span className="font-mono text-xs text-slate-500">{order.code || "—"}</span>,
    },
    {
      id: "title",
      label: "Título",
      sortable: true,
      render: (order) => (
        <Link href={`/orders/${order.id}`} className="font-medium text-slate-900 hover:text-blue-600">
          {order.title}
        </Link>
      ),
    },
    {
      id: "clientPartner",
      label: "Cliente",
      render: (order) => (
        <span className="text-slate-600">{order.clientPartner?.name || "\u2014"}</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (order) => (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${(order as any).isPaused ? "bg-orange-100 text-orange-800 border-orange-300" : STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}>
          {isOverdue(order) && <span title="Atrasada!">!</span>}
          {(order as any).isPaused ? "⏸️ Pausada" : STATUS_LABELS[order.status] || order.status}
        </span>
      ),
    },
    {
      id: "technician",
      label: "Técnico",
      render: (order) => (
        <span className="text-slate-600">{order.assignedPartner?.name || "\u2014"}</span>
      ),
    },
    {
      id: "valueCents",
      label: "Valor",
      sortable: true,
      align: "right",
      render: (order) => (
        <span className="font-medium text-slate-700">{formatCurrency(order.valueCents)}</span>
      ),
    },
    {
      id: "techCommissionCents",
      label: "Comissão Técnico",
      sortable: true,
      align: "right",
      render: (order) => {
        const cents = order.techCommissionCents
          ?? (order.commissionBps != null && order.valueCents ? Math.round((order.valueCents * order.commissionBps) / 10000) : null);
        return <span className="font-medium text-green-700">{cents != null && cents > 0 ? formatCurrency(cents) : "\u2014"}</span>;
      },
    },
    {
      id: "createdAt",
      label: "Criada em",
      sortable: true,
      render: (order) => (
        <span className="text-slate-500 whitespace-nowrap">{formatDateTime(order.createdAt)}</span>
      ),
    },
    {
      id: "acceptedAt",
      label: "Aceite",
      sortable: true,
      render: (order) => (
        <span className="text-slate-500 whitespace-nowrap">{formatDateTime(order.acceptedAt)}</span>
      ),
    },
    {
      id: "startedAt",
      label: "Iniciada",
      sortable: true,
      render: (order) => (
        <span className="text-slate-500 whitespace-nowrap">{formatDateTime(order.startedAt)}</span>
      ),
    },
    {
      id: "completedAt",
      label: "Concluída",
      sortable: true,
      render: (order) => (
        <span className="text-slate-500 whitespace-nowrap">{formatDateTime(order.completedAt)}</span>
      ),
    },
    {
      id: "deadlineAt",
      label: "Prazo",
      sortable: true,
      align: "right",
      render: (order) => (
        <span className={`whitespace-nowrap ${isOverdue(order) ? "text-red-600 font-medium" : "text-slate-600"}`}>
          {formatDate(order.deadlineAt)}
        </span>
      ),
    },
    {
      id: "address",
      label: "Endereço",
      render: (order) => (
        <span className="text-slate-600 truncate block max-w-[200px]" title={order.addressText}>
          {order.addressText}
        </span>
      ),
    },
  ];

  // Actions column — always present (audit toggle for all, dropdown for editors)
  cols.unshift({
    id: "actions",
    label: "Ações",
    align: "right",
    render: (order) => (
      <div className="flex items-center justify-end gap-1">
        <AuditToggle
          active={expandedAuditId === order.id}
          onClick={() => onToggleAudit(order.id)}
        />
        {(canEdit || canDelete) && (
          <ActionsDropdown
            order={order}
            canEdit={canEdit}
            canDelete={canDelete}
            onCancel={onCancel}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onEarlyFinancial={onEarlyFinancial}
            sysConfig={sysConfig}
          />
        )}
      </div>
    ),
  });

  return cols;
}

export default function OrdersPage() {
  const tp = useTableParams({ defaultSortBy: "createdAt", defaultSortOrder: "desc" });
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  const canEdit = authUser?.roles?.some(r => r === "ADMIN" || r === "DESPACHO") ?? false;
  const canDelete = authUser?.roles?.includes("ADMIN") ?? false;

  // System config for conditional features (edit terminal OS)
  const [sysConfig, setSysConfig] = useState<any>(null);
  useEffect(() => {
    api.get<any>("/companies/system-config").then(setSysConfig).catch(() => {});
  }, []);

  // Tab state with localStorage persistence + URL deep-link support
  const [activeTab, setActiveTab] = useState<OrdersTabId>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get("tab");
      if (urlTab === "agenda") return "agenda";
      const saved = localStorage.getItem("orders-active-tab");
      if (saved === "lista" || saved === "agenda") return saved;
    }
    return "lista";
  });

  useEffect(() => {
    localStorage.setItem("orders-active-tab", activeTab);
  }, [activeTab]);

  const [cancelTarget, setCancelTarget] = useState<ServiceOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceOrder | null>(null);
  const [earlyFinancialTarget, setEarlyFinancialTarget] = useState<ServiceOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const columns = makeColumns(
    canEdit,
    canDelete,
    (o) => setCancelTarget(o),
    async (o) => {
      try {
        const dup = await api.post<any>(`/service-orders/${o.id}/duplicate`);
        toast("OS duplicada com sucesso!", "success");
        router.push(`/orders/${dup.id}/edit`);
      } catch {
        toast("Erro ao duplicar OS.", "error");
      }
    },
    (o) => setDeleteTarget(o),
    (o) => setEarlyFinancialTarget(o),
    expandedAuditId,
    (id) => setExpandedAuditId((prev) => (prev === id ? null : id)),
    sysConfig,
  );

  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout("orders-v3", columns);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tp.buildQueryString();
      const params = new URLSearchParams(qs);
      const vMin = params.get("valueMin");
      const vMax = params.get("valueMax");
      if (vMin) params.set("valueMin", String(Math.round(Number(vMin) * 100)));
      if (vMax) params.set("valueMax", String(Math.round(Number(vMax) * 100)));
      const result = await api.get<PaginatedResponse<ServiceOrder>>(`/service-orders?${params.toString()}`);
      setOrders(result.data);
      setMeta(result.meta);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tp.buildQueryString]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await api.patch(`/service-orders/${cancelTarget.id}/cancel`);
      toast("OS cancelada com sucesso!", "success");
      setCancelTarget(null);
      loadOrders();
    } catch {
      toast("Erro ao cancelar OS.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.del(`/service-orders/${deleteTarget.id}`);
      toast("OS excluída com sucesso!", "success");
      setDeleteTarget(null);
      loadOrders();
    } catch {
      toast("Erro ao excluir OS.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  const CSV_COLUMNS: ExportColumn<ServiceOrder>[] = [
    { header: "Título", value: (r) => r.title },
    { header: "Cliente", value: (r) => r.clientPartner?.name || "" },
    { header: "Status", value: (r) => fmtStatus(r.status) },
    { header: "Técnico", value: (r) => r.assignedPartner?.name || "" },
    { header: "Valor (R$)", value: (r) => r.valueCents ? (r.valueCents / 100).toFixed(2).replace(".", ",") : "" },
    { header: "Comissão Técnico (R$)", value: (r) => {
      const cents = r.techCommissionCents ?? (r.commissionBps != null && r.valueCents ? Math.round((r.valueCents * r.commissionBps) / 10000) : null);
      return cents != null && cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
    }},
    { header: "Criada em", value: (r) => fmtDateTime(r.createdAt) },
    { header: "Aceite em", value: (r) => fmtDateTime(r.acceptedAt) },
    { header: "Iniciada em", value: (r) => fmtDateTime(r.startedAt) },
    { header: "Concluída em", value: (r) => fmtDateTime(r.completedAt) },
    { header: "Prazo", value: (r) => fmtDate(r.deadlineAt) },
    { header: "Endereço", value: (r) => r.addressText },
  ];

  function handleExportCSV() {
    if (!orders.length) { toast("Nenhum dado para exportar", "error"); return; }
    const date = new Date().toISOString().slice(0, 10);
    exportToCSV(orders, CSV_COLUMNS, `ordens-de-servico-${date}.csv`);
    toast("CSV exportado com sucesso!", "success");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Servico</h1>
          <p className="text-sm text-slate-500">
            {activeTab === "lista"
              ? `${meta.total} ordem${meta.total !== 1 ? "s" : ""} encontrada${meta.total !== 1 ? "s" : ""}`
              : "Visualizacao dos servicos agendados"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "lista" && (
            <button
              onClick={handleExportCSV}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              title="Exportar CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          )}
          {canEdit && (
            <Link
              href="/orders/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              + Nova OS
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {ORDERS_TABS.map((tab) => (
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

      {/* Lista Tab Content */}
      {activeTab === "lista" && <>
      {/* Filter Bar */}
      <FilterBar
        filters={ORDER_FILTERS}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por título, endereço ou cliente..."
      />

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            {tp.search || Object.keys(tp.filters).length > 0
              ? "Nenhuma OS encontrada com os filtros selecionados."
              : "Nenhuma ordem de serviço cadastrada."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm" style={{ overflowX: "auto", overflowY: "hidden" }}>
          <table className="text-sm" style={{ tableLayout: "fixed", minWidth: "1000px", width: "max-content" }}>
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
              {orders.map((order) => (
                <React.Fragment key={order.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {orderedColumns.map((col) => {
                      const w = columnWidths[col.id];
                      const tdStyle: React.CSSProperties = w ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden" } : {};
                      return (
                        <td
                          key={col.id}
                          style={tdStyle}
                          className={`py-3 px-4 ${col.className || ""} ${col.align === "right" ? "text-right" : ""}`}
                        >
                          {col.render(order)}
                        </td>
                      );
                    })}
                  </tr>
                  <AuditLogDrawer
                    entityType="SERVICE_ORDER"
                    entityId={order.id}
                    open={expandedAuditId === order.id}
                    colSpan={orderedColumns.length}
                  />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination meta={meta} onPageChange={tp.setPage} />
      </>}

      {/* Agenda Tab Content */}
      {activeTab === "agenda" && <AgendaView />}

      {/* Cancel Modal */}
      <ConfirmModal
        open={!!cancelTarget}
        title="Cancelar OS"
        message={cancelTarget ? `Deseja realmente cancelar a OS "${cancelTarget.title}"? Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Cancelar OS"
        variant="warning"
        loading={actionLoading}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Delete Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir OS"
        message={deleteTarget ? `Deseja realmente excluir a OS "${deleteTarget.title}"? Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Excluir"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Early Financial Modal */}
      <EarlyFinancialModal
        open={!!earlyFinancialTarget}
        orderId={earlyFinancialTarget?.id || ""}
        onClose={() => setEarlyFinancialTarget(null)}
        onLaunched={() => { setEarlyFinancialTarget(null); loadOrders(); }}
      />
    </div>
  );
}
