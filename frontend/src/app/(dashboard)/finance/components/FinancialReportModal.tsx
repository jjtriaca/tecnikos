"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import LookupField from "@/components/ui/LookupField";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";
import { api } from "@/lib/api";

/* ── Types ─────────────────────────────────────────────── */

type PartnerSummary = { id: string; name: string; document: string | null; phone: string | null };

const partnerFetcher: LookupFetcher<PartnerSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<PartnerSummary>>(
    `/partners?${params.toString()}`,
    { signal },
  );
};

/* ══════════════════════════════════════════════════════════
   FINANCIAL REPORT MODAL
   ══════════════════════════════════════════════════════════ */

interface FinancialReportModalProps {
  open: boolean;
  defaultType?: "RECEIVABLE" | "PAYABLE";
  onClose: () => void;
}

export default function FinancialReportModal({ open, defaultType, onClose }: FinancialReportModalProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  // Filters
  const [selectedPartner, setSelectedPartner] = useState<PartnerSummary | null>(null);
  const [reportType, setReportType] = useState<string>(defaultType || "ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");

  if (!open) return null;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const params = new URLSearchParams();
      if (selectedPartner) params.set("partnerId", selectedPartner.id);
      if (reportType && reportType !== "ALL") params.set("type", reportType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status) params.set("status", status);

      const token = getAccessToken();
      const res = await fetch(`/api/finance/report/pdf?${params.toString()}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao gerar relatorio");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || "Relatorio_Financeiro.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast("Relatorio gerado com sucesso!", "success");

      setTimeout(() => {
        const openFile = window.confirm(
          "Relatorio PDF gerado com sucesso!\n\nDeseja abrir o arquivo?"
        );
        if (openFile) {
          window.open(url, "_blank");
        } else {
          URL.revokeObjectURL(url);
        }
      }, 100);

      onClose();
    } catch (err: any) {
      toast(err.message || "Erro ao gerar relatorio", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Gerar Relatorio Financeiro</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {/* Partner */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cliente / Parceiro</label>
            <LookupField<PartnerSummary>
              value={selectedPartner}
              onChange={(p) => setSelectedPartner(p)}
              fetcher={partnerFetcher}
              displayValue={(p) => p.name}
              keyExtractor={(p) => p.id}
              placeholder="Todos (sem filtro)"
              modalTitle="Selecionar Parceiro"
              modalPlaceholder="Nome, documento ou telefone..."
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
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todos</option>
              <option value="RECEIVABLE">A Receber (Entradas)</option>
              <option value="PAYABLE">A Pagar (Saidas)</option>
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Ate</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos (exceto cancelados)</option>
              <option value="PENDING">Pendente</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PAID">Pago</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gerando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
