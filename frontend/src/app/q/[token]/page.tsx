"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

/* ── Types ── */
interface PublicQuoteItem {
  description: string;
  type: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  discountPercent: number | null;
  totalCents: number;
  sortOrder: number;
}

interface PublicQuoteAttachment {
  id: string;
  fileName: string;
  label: string | null;
  supplierName: string | null;
}

interface PublicQuoteData {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: string;
  termsConditions: string | null;
  validityDays: number;
  expiresAt: string | null;
  subtotalCents: number;
  productValueCents: number;
  totalCents: number;
  discountPercent: number | null;
  discountCents: number | null;
  items: PublicQuoteItem[];
  attachments: PublicQuoteAttachment[];
  company: { name: string; logoUrl: string | null; phone: string | null; email: string | null };
  clientPartner: { name: string };
}

/* ── Helpers ── */
const API_BASE = typeof window !== "undefined" ? "/api" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const TYPE_LABELS: Record<string, string> = { SERVICE: "Servico", PRODUCT: "Produto", LABOR: "Mao de Obra" };

const STATUS_MAP: Record<string, { label: string; color: string; bgPage: string }> = {
  ENVIADO: { label: "Aguardando Aprovacao", color: "bg-blue-100 text-blue-800", bgPage: "from-blue-50 to-white" },
  APROVADO: { label: "Aprovado", color: "bg-green-100 text-green-800", bgPage: "from-green-50 to-white" },
  REJEITADO: { label: "Rejeitado", color: "bg-red-100 text-red-800", bgPage: "from-red-50 to-white" },
  EXPIRADO: { label: "Expirado", color: "bg-orange-100 text-orange-800", bgPage: "from-orange-50 to-white" },
  CANCELADO: { label: "Cancelado", color: "bg-slate-200 text-slate-700", bgPage: "from-slate-100 to-white" },
};

export default function PublicQuotePage() {
  const params = useParams();
  const token = params.token as string;

  const [quote, setQuote] = useState<PublicQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval flow
  const [approverName, setApproverName] = useState("");
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/q/${token}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Orcamento nao encontrado ou link expirado");
        }
        const data = await res.json();
        if (!cancelled) setQuote(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Erro ao carregar orcamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleApprove() {
    if (!approverName.trim()) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(`${API_BASE}/q/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: approverName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao aprovar");
      }
      setActionResult({ type: "success", message: "Orcamento aprovado com sucesso!" });
      setShowApproveForm(false);
      // Reload
      const updated = await fetch(`${API_BASE}/q/${token}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (updated.ok) setQuote(await updated.json());
    } catch (err: any) {
      setActionResult({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(`${API_BASE}/q/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao rejeitar");
      }
      setActionResult({ type: "success", message: "Orcamento rejeitado." });
      setShowRejectForm(false);
      const updated = await fetch(`${API_BASE}/q/${token}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (updated.ok) setQuote(await updated.json());
    } catch (err: any) {
      setActionResult({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <svg className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-500 text-sm">Carregando orcamento...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Orcamento Indisponivel</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const status = STATUS_MAP[quote.status] || { label: quote.status, color: "bg-slate-100 text-slate-700", bgPage: "from-slate-50 to-white" };
  const canRespond = quote.status === "ENVIADO";
  const isExpired = quote.expiresAt && new Date(quote.expiresAt) < new Date();

  return (
    <div className={`min-h-screen bg-gradient-to-b ${status.bgPage}`}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Company header */}
        <div className="text-center mb-8">
          {quote.company.logoUrl && (
            <img src={quote.company.logoUrl} alt="" className="h-16 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-xl font-bold text-slate-800">{quote.company.name}</h1>
          <div className="text-sm text-slate-500 mt-1">
            {quote.company.phone && <span>{quote.company.phone}</span>}
            {quote.company.phone && quote.company.email && <span> | </span>}
            {quote.company.email && <span>{quote.company.email}</span>}
          </div>
        </div>

        {/* Status badge */}
        <div className="text-center mb-6">
          <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-bold ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Result message */}
        {actionResult && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium ${
            actionResult.type === "success" ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"
          }`}>
            {actionResult.message}
          </div>
        )}

        {/* Quote card */}
        <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden mb-6">
          {/* Title bar */}
          <div className="bg-blue-700 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-blue-200 uppercase tracking-wider">Orcamento</div>
                <div className="text-lg font-bold">{quote.title}</div>
              </div>
              {quote.code && (
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono">{quote.code}</div>
                </div>
              )}
            </div>
          </div>

          {/* Client & validity */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <span className="text-slate-500">Cliente:</span>
              <span className="ml-1 font-medium text-slate-800">{quote.clientPartner.name}</span>
            </div>
            {quote.expiresAt && (
              <div>
                <span className="text-slate-500">Valido ate:</span>
                <span className={`ml-1 font-medium ${isExpired ? "text-red-600" : "text-slate-800"}`}>
                  {formatDate(quote.expiresAt)}
                  {isExpired && " (expirado)"}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {quote.description && (
            <div className="px-6 py-3 text-sm text-slate-600 border-b border-slate-100">
              {quote.description}
            </div>
          )}

          {/* Items */}
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-center w-16">Qtd</th>
                  <th className="pb-2 text-right w-24">Valor</th>
                  <th className="pb-2 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...quote.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3">
                      <div className="font-medium text-slate-800">{item.description}</div>
                      <div className="text-xs text-slate-400">
                        {TYPE_LABELS[item.type] || item.type}
                        {item.discountPercent ? ` | ${item.discountPercent}% desc.` : ""}
                      </div>
                    </td>
                    <td className="py-3 text-center text-slate-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 text-right text-slate-600">
                      {formatCurrency(item.unitPriceCents)}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-800">
                      {formatCurrency(item.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-6 w-full max-w-xs justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">{formatCurrency(quote.subtotalCents)}</span>
              </div>
              {(quote.discountPercent || quote.discountCents) && (
                <div className="flex gap-6 w-full max-w-xs justify-between">
                  <span className="text-slate-500">Desconto{quote.discountPercent ? ` (${quote.discountPercent}%)` : ""}</span>
                  <span className="font-medium text-red-600">-{formatCurrency(quote.subtotalCents - quote.totalCents + (quote.productValueCents || 0))}</span>
                </div>
              )}
              {quote.productValueCents > 0 && (
                <div className="flex gap-6 w-full max-w-xs justify-between">
                  <span className="text-slate-500">Valor Produtos</span>
                  <span className="font-medium text-slate-700">{formatCurrency(quote.productValueCents)}</span>
                </div>
              )}
              <div className="flex gap-6 w-full max-w-xs justify-between border-t border-slate-300 pt-2 mt-1">
                <span className="text-lg font-bold text-slate-800">TOTAL</span>
                <span className="text-lg font-bold text-blue-700">{formatCurrency(quote.totalCents)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          {quote.termsConditions && (
            <div className="px-6 py-4 border-t border-slate-200">
              <h4 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">Termos e Condicoes</h4>
              <p className="text-sm text-slate-600 whitespace-pre-line">{quote.termsConditions}</p>
            </div>
          )}
        </div>

        {/* Attachments */}
        {quote.attachments.length > 0 && (
          <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Documentos Anexos</h3>
            </div>
            <div className="p-4 space-y-3">
              {quote.attachments.map(att => (
                <a key={att.id} href={`${API_BASE}/q/${token}/attachments/${att.id}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors group">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors flex-shrink-0">
                    <svg className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                      {att.supplierName || att.label || "Documento anexo"}
                    </div>
                    <div className="text-xs text-slate-500">{att.fileName}</div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:text-blue-700 flex-shrink-0">
                    <span>Visualizar</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {canRespond && !isExpired && !actionResult && (
          <div className="space-y-4">
            {!showApproveForm && !showRejectForm && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveForm(true)}
                  className="flex-1 rounded-xl bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                >
                  Aprovar Orcamento
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="rounded-xl border-2 border-red-300 bg-white py-4 px-6 text-lg font-bold text-red-600 hover:bg-red-50 transition-colors"
                >
                  Recusar
                </button>
              </div>
            )}

            {/* Approve form */}
            {showApproveForm && (
              <div className="rounded-2xl bg-white shadow-lg border border-green-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-3">Confirmar Aprovacao</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Informe seu nome para confirmar a aprovacao do orcamento no valor de{" "}
                  <span className="font-bold text-blue-700">{formatCurrency(quote.totalCents)}</span>.
                </p>
                <input
                  type="text"
                  value={approverName}
                  onChange={e => setApproverName(e.target.value)}
                  placeholder="Seu nome completo..."
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={handleApprove} disabled={!approverName.trim() || actionLoading}
                    className="flex-1 rounded-lg bg-green-600 py-3 text-base font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-50">
                    {actionLoading ? "Processando..." : "Confirmar Aprovacao"}
                  </button>
                  <button onClick={() => { setShowApproveForm(false); setApproverName(""); }}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-600 hover:bg-slate-100 transition-colors">
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* Reject form */}
            {showRejectForm && (
              <div className="rounded-2xl bg-white shadow-lg border border-red-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-3">Recusar Orcamento</h3>
                <p className="text-sm text-slate-500 mb-4">Informe o motivo da recusa (opcional).</p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Motivo da recusa..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 mb-4 resize-none"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={handleReject} disabled={actionLoading}
                    className="flex-1 rounded-lg bg-red-600 py-3 text-base font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                    {actionLoading ? "Processando..." : "Confirmar Recusa"}
                  </button>
                  <button onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-600 hover:bg-slate-100 transition-colors">
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF link */}
        <div className="text-center mt-6">
          <a href={`${API_BASE}/q/${token}/pdf`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar PDF do Orcamento
          </a>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-400">
          Powered by Tecnikos
        </div>
      </div>
    </div>
  );
}
