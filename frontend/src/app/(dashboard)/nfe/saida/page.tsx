"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import { NFSE_STATUS_CONFIG } from "@/types/finance";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────── */

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NfseServiceOrder {
  id: string;
  title: string;
}

interface NfseFinancialEntry {
  id: string;
  netCents: number;
  description: string;
}

interface NfseEmission {
  id: string;
  rpsNumber: number;
  rpsSeries: string;
  nfseNumber: string | null;
  codigoVerificacao: string | null;
  focusNfeRef: string;
  status: string;
  errorMessage: string | null;
  prestadorCnpj: string;
  tomadorCnpjCpf: string | null;
  tomadorRazaoSocial: string | null;
  tomadorEmail: string | null;
  valorServicos: number;
  aliquotaIss: number | null;
  discriminacao: string | null;
  itemListaServico: string | null;
  createdAt: string;
  serviceOrder: NfseServiceOrder | null;
  financialEntries: NfseFinancialEntry[];
}

/* ── Filters ───────────────────────────────────────── */

const FILTERS: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "PROCESSING", label: "Processando" },
      { value: "AUTHORIZED", label: "Autorizada" },
      { value: "ERROR", label: "Erro" },
      { value: "CANCELLING", label: "Cancelando" },
      { value: "CANCELLED", label: "Cancelada" },
    ],
  },
  { key: "dateFrom", label: "Data de", type: "date" },
  { key: "dateTo", label: "Data até", type: "date" },
];

/* ── Columns ───────────────────────────────────────── */

function buildColumns(): ColumnDefinition<NfseEmission>[] {
  return [
    {
      id: "createdAt",
      label: "Data",
      sortable: true,
      render: (row) => {
        const d = new Date(row.createdAt);
        return (
          <span className="text-sm text-slate-700 whitespace-nowrap">
            {d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        );
      },
    },
    {
      id: "nfseNumber",
      label: "NFS-e",
      sortable: true,
      render: (row) => (
        <span className="text-sm font-medium text-slate-800">
          {row.nfseNumber || `RPS ${row.rpsNumber}`}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (row) => {
        const cfg = NFSE_STATUS_CONFIG[row.status] || NFSE_STATUS_CONFIG.NOT_ISSUED;
        return (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      id: "tomadorRazaoSocial",
      label: "Tomador",
      sortable: false,
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-slate-800 truncate">{row.tomadorRazaoSocial || "—"}</p>
          {row.tomadorCnpjCpf && (
            <p className="text-xs text-slate-400 truncate">{row.tomadorCnpjCpf}</p>
          )}
        </div>
      ),
    },
    {
      id: "valorServicos",
      label: "Valor",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="text-sm font-medium text-slate-800 whitespace-nowrap">
          {(row.valorServicos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      ),
    },
    {
      id: "serviceOrder",
      label: "OS",
      sortable: false,
      render: (row) =>
        row.serviceOrder ? (
          <Link
            href={`/orders/${row.serviceOrder.id}`}
            className="text-sm text-blue-600 hover:underline truncate block"
          >
            {row.serviceOrder.title}
          </Link>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        ),
    },
    {
      id: "errorMessage",
      label: "Erro",
      sortable: false,
      render: (row) =>
        row.status === "ERROR" && row.errorMessage ? (
          <span className="text-xs text-red-600 truncate block max-w-[200px]" title={row.errorMessage}>
            {row.errorMessage}
          </span>
        ) : null,
    },
  ];
}

/* ── Actions Dropdown ─────────────────────────────── */

function ActionsDropdown({
  emission,
  isLoading,
  onDownloadPdf,
  onResendEmail,
  onRefreshStatus,
  onCancel,
  onToggleDetails,
  isExpanded,
}: {
  emission: NfseEmission;
  isLoading: boolean;
  onDownloadPdf: () => void;
  onResendEmail: () => void;
  onRefreshStatus: () => void;
  onCancel: () => void;
  onToggleDetails: () => void;
  isExpanded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const isAuthorized = emission.status === "AUTHORIZED";
  const isRetryable = emission.status === "PROCESSING" || emission.status === "ERROR" || emission.status === "CANCELLING";

  const menuItem = (label: string, onClick: () => void, className = "text-slate-700 hover:bg-slate-50") => (
    <button
      key={label}
      onClick={() => { setOpen(false); onClick(); }}
      disabled={isLoading}
      className={`w-full text-left px-3 py-2 text-sm disabled:opacity-50 ${className}`}
    >
      {label}
    </button>
  );

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
          className="fixed z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)" }}
        >
          {isAuthorized && menuItem("Baixar PDF", onDownloadPdf)}
          {isAuthorized && menuItem("Reenviar Email", onResendEmail)}
          {isRetryable && menuItem("Consultar Status", onRefreshStatus)}
          {(isAuthorized || isRetryable) && <div className="my-1 border-t border-slate-100" />}
          {isAuthorized && menuItem("Cancelar NFS-e", onCancel, "text-red-600 hover:bg-red-50")}
          {isAuthorized && <div className="my-1 border-t border-slate-100" />}
          {menuItem(isExpanded ? "Fechar Detalhes" : "Detalhes", onToggleDetails)}
        </div>
      )}
    </>
  );
}

/* ── Page ──────────────────────────────────────────── */

export default function NfseSaidaPage() {
  const { toast } = useToast();
  const tp = useTableParams({
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
    persistKey: "nfse-saida",
  });

  const columns = buildColumns();
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout("nfse-saida", columns);

  const [emissions, setEmissions] = useState<NfseEmission[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ emissionId: string; nfseNumber: string } | null>(null);
  const [cancelJustificativa, setCancelJustificativa] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadEmissions = useCallback(async () => {
    try {
      setLoading(true);
      const qs = tp.buildQueryString();
      const result = await api.get<{ items: NfseEmission[]; total: number; page: number; limit: number; pages: number }>(
        `/nfse-emission/emissions?${qs}`
      );
      setEmissions(result.items);
      setMeta({ total: result.total, page: result.page, limit: result.limit, totalPages: result.pages });
    } catch {
      toast("Erro ao carregar notas fiscais.", "error");
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString, toast]);

  useEffect(() => {
    loadEmissions();
  }, [loadEmissions]);

  /* ── Actions ── */

  async function handleRefreshStatus(emission: NfseEmission) {
    setActionLoading(emission.id);
    try {
      await api.post(`/nfse-emission/emissions/${emission.id}/refresh`, {});
      toast("Status atualizado!", "success");
      loadEmissions();
    } catch (err: any) {
      toast(err?.message || "Erro ao atualizar status", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownloadPdf(emission: NfseEmission) {
    setActionLoading(emission.id);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/nfse-emission/emissions/${emission.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "Erro ao baixar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfse-${emission.nfseNumber || emission.rpsNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err?.message || "Erro ao baixar PDF", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendEmail(emission: NfseEmission) {
    if (!emission.tomadorEmail) {
      toast("Tomador nao possui email cadastrado", "error");
      return;
    }
    setActionLoading(emission.id);
    try {
      await api.post(`/nfse-emission/emissions/${emission.id}/resend-email`, {});
      toast(`Email reenviado para ${emission.tomadorEmail}`, "success");
    } catch (err: any) {
      toast(err?.message || "Erro ao reenviar email", "error");
    } finally {
      setActionLoading(null);
    }
  }

  function handleCancelOpen(emission: NfseEmission) {
    setCancelModal({ emissionId: emission.id, nfseNumber: emission.nfseNumber || String(emission.rpsNumber) });
    setCancelJustificativa("");
    setCancelError(null);
  }

  async function handleCancelConfirm() {
    if (!cancelModal) return;
    if (cancelJustificativa.trim().length < 15) {
      setCancelError("A justificativa deve ter pelo menos 15 caracteres.");
      return;
    }
    setCancelError(null);
    setActionLoading(cancelModal.emissionId);
    try {
      await api.post(`/nfse-emission/${cancelModal.emissionId}/cancel`, { justificativa: cancelJustificativa.trim() });
      toast("Cancelamento enviado com sucesso! Aguarde confirmacao da prefeitura.", "success");
      setCancelModal(null);
      loadEmissions();
    } catch (err: any) {
      setCancelError(err?.message || "Erro ao cancelar NFS-e");
    } finally {
      setActionLoading(null);
    }
  }

  /* ── Bulk: retry all PROCESSING ── */
  async function handleRetryAllProcessing() {
    const processingItems = emissions.filter((e) => e.status === "PROCESSING");
    if (!processingItems.length) {
      toast("Nenhuma nota em processamento", "info");
      return;
    }
    setActionLoading("bulk");
    let successCount = 0;
    for (const item of processingItems) {
      try {
        await api.post(`/nfse-emission/emissions/${item.id}/refresh`, {});
        successCount++;
      } catch {
        // continue with next
      }
    }
    toast(`${successCount} de ${processingItems.length} notas atualizadas`, "success");
    setActionLoading(null);
    loadEmissions();
  }

  /* ── Stats ── */
  const stats = {
    total: meta.total,
    authorized: emissions.filter((e) => e.status === "AUTHORIZED").length,
    processing: emissions.filter((e) => e.status === "PROCESSING").length,
    error: emissions.filter((e) => e.status === "ERROR").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/nfe" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            NFe
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-700 font-medium">Saida</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notas Fiscais Emitidas</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie todas as NFS-e emitidas pelo sistema
            </p>
          </div>
          <div className="flex gap-2">
            {stats.processing > 0 && (
              <button
                onClick={handleRetryAllProcessing}
                disabled={actionLoading === "bulk"}
                className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {actionLoading === "bulk" ? "Atualizando..." : `Validar Pendentes (${stats.processing})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-green-600">Autorizadas</p>
          <p className="text-2xl font-bold text-green-700">{stats.authorized}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-600">Processando</p>
          <p className="text-2xl font-bold text-amber-700">{stats.processing}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-red-600">Com Erro</p>
          <p className="text-2xl font-bold text-red-700">{stats.error}</p>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={FILTERS}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por tomador, CNPJ, numero NFS-e..."
      />

      {/* Table */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full" style={{ tableLayout: "fixed", minWidth: "900px" }}>
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
              <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-right w-[80px]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {orderedColumns.map((col) => (
                    <td key={col.id} className="py-3 px-4">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                  <td className="py-3 px-4"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                </tr>
              ))
            ) : emissions.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length + 1} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-slate-500">Nenhuma nota fiscal encontrada</p>
                  </div>
                </td>
              </tr>
            ) : (
              emissions.map((emission) => {
                const isExpanded = expandedRow === emission.id;
                const isLoading = actionLoading === emission.id;

                return (
                  <tr
                    key={emission.id}
                    className={`border-b border-slate-100 transition-colors ${
                      emission.status === "ERROR" ? "bg-red-50/30" : "hover:bg-slate-50"
                    }`}
                  >
                    {orderedColumns.map((col) => {
                      const w = columnWidths[col.id];
                      const tdStyle: React.CSSProperties = w
                        ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden" }
                        : {};
                      return (
                        <td key={col.id} style={tdStyle} className={`py-3 px-4 ${col.className || ""}`}>
                          {col.render(emission)}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right">
                      <ActionsDropdown
                        emission={emission}
                        isLoading={isLoading}
                        onDownloadPdf={() => handleDownloadPdf(emission)}
                        onResendEmail={() => handleResendEmail(emission)}
                        onRefreshStatus={() => handleRefreshStatus(emission)}
                        onCancel={() => handleCancelOpen(emission)}
                        onToggleDetails={() => setExpandedRow(isExpanded ? null : emission.id)}
                        isExpanded={isExpanded}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded Row Details (rendered outside table for layout) */}
      {expandedRow && (() => {
        const emission = emissions.find((e) => e.id === expandedRow);
        if (!emission) return null;
        return (
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Detalhes — {emission.nfseNumber ? `NFS-e ${emission.nfseNumber}` : `RPS ${emission.rpsNumber}/${emission.rpsSeries}`}
              </h3>
              <button onClick={() => setExpandedRow(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Prestador</p>
                <p className="text-slate-800">{emission.prestadorCnpj}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Tomador</p>
                <p className="text-slate-800">{emission.tomadorRazaoSocial || "—"}</p>
                <p className="text-xs text-slate-400">{emission.tomadorCnpjCpf}</p>
                {emission.tomadorEmail && <p className="text-xs text-slate-400">{emission.tomadorEmail}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Tributacao</p>
                <p className="text-slate-800">ISS: {emission.aliquotaIss ? `${emission.aliquotaIss}%` : "—"}</p>
                <p className="text-xs text-slate-400">Item LC: {emission.itemListaServico || "—"}</p>
              </div>
              {emission.codigoVerificacao && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Cod. Verificacao</p>
                  <p className="text-slate-800 font-mono text-xs">{emission.codigoVerificacao}</p>
                </div>
              )}
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Discriminacao</p>
                <p className="text-slate-700 text-xs whitespace-pre-wrap">{emission.discriminacao || "—"}</p>
              </div>
              {emission.status === "ERROR" && emission.errorMessage && (
                <div className="md:col-span-3 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Mensagem de Erro</p>
                  <p className="text-sm text-red-700">{emission.errorMessage}</p>
                  <button
                    onClick={() => handleRefreshStatus(emission)}
                    disabled={actionLoading === emission.id}
                    className="mt-2 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}
              {emission.financialEntries.length > 0 && (
                <div className="md:col-span-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Lancamentos Vinculados</p>
                  <div className="flex flex-wrap gap-2">
                    {emission.financialEntries.map((fe) => (
                      <span key={fe.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                        {fe.description} — {(fe.netCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Pagination */}
      <Pagination meta={meta} onPageChange={tp.setPage} />

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-600 mb-1">Cancelar NFS-e {cancelModal.nfseNumber}</h3>
            <p className="text-xs text-slate-500 mb-4">O cancelamento sera enviado a prefeitura. Esta acao nao pode ser desfeita.</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Justificativa * <span className="text-slate-400">(minimo 15 caracteres)</span></label>
              <textarea
                value={cancelJustificativa}
                onChange={(e) => setCancelJustificativa(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo do cancelamento..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none"
                autoFocus
              />
              <p className={`text-xs mt-1 ${cancelJustificativa.trim().length < 15 ? "text-slate-400" : "text-green-600"}`}>
                {cancelJustificativa.trim().length}/15 caracteres
              </p>
            </div>
            {cancelError && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{cancelError}</div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCancelModal(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Voltar
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={cancelJustificativa.trim().length < 15 || actionLoading === cancelModal.emissionId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === cancelModal.emissionId ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
