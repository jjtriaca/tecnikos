"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, ApiError, getAccessToken } from "@/lib/api";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

/* ── Types ── */
interface QuoteItem {
  id: string;
  type: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  discountPercent: number | null;
  totalCents: number;
  sortOrder: number;
  product: { id: string; name: string; code: string | null } | null;
  service: { id: string; name: string; code: string | null } | null;
}

interface QuoteAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string;
  label: string | null;
  supplierName: string | null;
  createdAt: string;
}

interface QuoteDetail {
  id: string;
  code: string | null;
  version: number;
  status: string;
  title: string;
  description: string | null;
  notes: string | null;
  termsConditions: string | null;
  validityDays: number;
  expiresAt: string | null;
  deliveryMethod: string;
  approvalMode: string;
  discountPercent: number | null;
  discountCents: number | null;
  subtotalCents: number;
  productValueCents: number;
  totalCents: number;
  publicToken: string | null;
  sentAt: string | null;
  sentVia: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  approvedByType: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectedReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
  clientPartner: { id: string; name: string; document: string | null; phone: string | null; email: string | null };
  serviceOrder: { id: string; code: string; title: string } | null;
  createdByUser: { id: string; name: string } | null;
  parentQuote: { id: string; code: string | null } | null;
  items: QuoteItem[];
  attachments: QuoteAttachment[];
}

/* ── Helpers ── */
function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  RASCUNHO: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
  ENVIADO: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  APROVADO: { label: "Aprovado", color: "bg-green-100 text-green-700" },
  REJEITADO: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
  EXPIRADO: { label: "Expirado", color: "bg-orange-100 text-orange-700" },
  CANCELADO: { label: "Cancelado", color: "bg-slate-200 text-slate-600" },
};

const TYPE_LABELS: Record<string, string> = {
  SERVICE: "Servico",
  PRODUCT: "Produto",
  LABOR: "Mao de Obra",
};


export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;
  const { toast } = useToast();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action modals
  const [showSendModal, setShowSendModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateOsModal, setShowCreateOsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = await api.get<QuoteDetail>(`/quotes/${quoteId}`);
        if (!cancelled) setQuote(q);
      } catch (err: any) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Erro ao carregar orcamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quoteId]);

  async function handleAction(action: string, body?: any) {
    setActionLoading(true);
    try {
      if (action === "send") {
        await api.post(`/quotes/${quoteId}/send`, body || {});
        toast("Orcamento enviado!", "success");
      } else if (action === "approve") {
        await api.post(`/quotes/${quoteId}/approve`);
        toast("Orcamento aprovado!", "success");
      } else if (action === "reject") {
        await api.post(`/quotes/${quoteId}/reject`, body);
        toast("Orcamento rejeitado", "success");
      } else if (action === "cancel") {
        await api.post(`/quotes/${quoteId}/cancel`, body);
        toast("Orcamento cancelado", "success");
      } else if (action === "delete") {
        await api.del(`/quotes/${quoteId}`);
        toast("Orcamento excluido", "success");
        router.push("/quotes");
        return;
      } else if (action === "duplicate") {
        const dup = await api.post<{ id: string }>(`/quotes/${quoteId}/duplicate`);
        toast("Orcamento duplicado!", "success");
        router.push(`/quotes/${dup.id}/edit`);
        return;
      } else if (action === "create-os") {
        const os = await api.post<{ id: string }>(`/quotes/${quoteId}/create-os`);
        toast("OS criada a partir do orcamento!", "success");
        router.push(`/orders/${os.id}`);
        return;
      }
      // Reload quote
      const q = await api.get<QuoteDetail>(`/quotes/${quoteId}`);
      setQuote(q);
    } catch (err: any) {
      toast(err instanceof ApiError ? err.message : "Erro na operacao", "error");
    } finally {
      setActionLoading(false);
      setShowSendModal(false);
      setShowApproveModal(false);
      setShowRejectModal(false);
      setShowCancelModal(false);
      setShowDeleteModal(false);
      setShowCreateOsModal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error || "Orcamento nao encontrado"}</p>
          <Link href="/quotes" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Voltar para lista</Link>
        </div>
      </div>
    );
  }

  const s = STATUS_MAP[quote.status] || { label: quote.status, color: "bg-slate-100 text-slate-700" };
  const publicUrl = quote.publicToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/q/${quote.publicToken}` : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/quotes" className="hover:text-blue-600">Orcamentos</Link>
        <span>/</span>
        <span className="text-slate-700">{quote.code || quoteId.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">{quote.title}</h1>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${s.color}`}>
              {s.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {quote.code && <span className="font-mono text-blue-600">{quote.code}</span>}
            <span>Criado em {formatDateTime(quote.createdAt)}</span>
            {quote.createdByUser && <span>por {quote.createdByUser.name}</span>}
            {quote.version > 1 && <span>v{quote.version}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {quote.status === "RASCUNHO" && (
            <>
              <Link href={`/quotes/${quoteId}/edit`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Editar
              </Link>
              <button onClick={() => setShowSendModal(true)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                Enviar
              </button>
            </>
          )}
          {quote.status === "ENVIADO" && quote.approvalMode === "INTERNAL" && (
            <>
              <button onClick={() => setShowApproveModal(true)}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                Aprovar
              </button>
              <button onClick={() => setShowRejectModal(true)}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors">
                Rejeitar
              </button>
            </>
          )}
          {quote.status === "APROVADO" && (
            <button onClick={() => setShowCreateOsModal(true)}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Gerar OS
            </button>
          )}
          {["RASCUNHO", "ENVIADO"].includes(quote.status) && (
            <button onClick={() => setShowCancelModal(true)}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              Cancelar
            </button>
          )}
          <button onClick={() => handleAction("duplicate")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Duplicar
          </button>
          <button onClick={async () => {
              try {
                // Use public endpoint if token available (works without auth)
                if (quote.publicToken) {
                  window.open(`/q/${quote.publicToken}/pdf`, "_blank");
                  return;
                }
                const token = getAccessToken();
                const res = await fetch(`/api/quotes/${quoteId}/pdf`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                  const errBody = await res.json().catch(() => null);
                  throw new Error(errBody?.message || "Erro ao gerar PDF");
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              } catch (err: any) {
                toast(err?.message || "Erro ao gerar PDF", "error");
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            PDF
          </button>
          {quote.status === "RASCUNHO" && (
            <button onClick={() => setShowDeleteModal(true)}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Public link */}
      {publicUrl && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <svg className="h-5 w-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-600 font-medium">Link publico de aprovacao:</span>
            <div className="text-sm text-blue-800 truncate font-mono">{publicUrl}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { navigator.clipboard.writeText(publicUrl); toast("Link copiado!", "success"); }}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Copiar
            </button>
            {quote.clientPartner?.phone && (
              <button
                onClick={async () => {
                  try {
                    await api.post(`/quotes/${quoteId}/send-whatsapp`, {});
                    toast("Orcamento enviado por WhatsApp!", "success");
                  } catch (err: any) {
                    toast(err?.response?.data?.message || err?.message || "Erro ao enviar WhatsApp", "error");
                  }
                }}
                className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                title={`Enviar para ${quote.clientPartner.phone}`}
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.728-1.396A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.318-.727-6.003-1.958l-.42-.313-3.07.907.844-3.183-.33-.434A9.96 9.96 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                WhatsApp
              </button>
            )}
            {quote.clientPartner?.email && (
              <button
                onClick={async () => {
                  try {
                    await api.post(`/quotes/${quoteId}/send-email`, {});
                    toast("Orcamento enviado por Email!", "success");
                  } catch (err: any) {
                    toast(err?.response?.data?.message || err?.message || "Erro ao enviar Email", "error");
                  }
                }}
                className="rounded bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-colors flex items-center gap-1"
                title={`Enviar para ${quote.clientPartner.email}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Email
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Client + OS + Status info */}
        <div className="space-y-6">
          {/* Client card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Cliente</h3>
            <div className="text-base font-semibold text-slate-800">{quote.clientPartner.name}</div>
            {quote.clientPartner.document && <div className="text-sm text-slate-500 mt-1">{quote.clientPartner.document}</div>}
            {quote.clientPartner.phone && <div className="text-sm text-slate-500">{quote.clientPartner.phone}</div>}
            {quote.clientPartner.email && <div className="text-sm text-slate-500">{quote.clientPartner.email}</div>}
          </div>

          {/* OS card */}
          {quote.serviceOrder && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">OS Vinculada</h3>
              <Link href={`/orders/${quote.serviceOrder.id}`} className="text-base font-semibold text-blue-600 hover:underline">
                {quote.serviceOrder.code}
              </Link>
              <div className="text-sm text-slate-500 mt-1">{quote.serviceOrder.title}</div>
            </div>
          )}

          {/* Info card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Informacoes</h3>
            <dl className="space-y-2 text-sm">
              {quote.sentAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Enviado em</dt>
                  <dd className="text-slate-800 font-medium">{formatDateTime(quote.sentAt)}</dd>
                </div>
              )}
              {quote.approvedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Aprovado em</dt>
                  <dd className="text-green-700 font-medium">{formatDateTime(quote.approvedAt)}</dd>
                </div>
              )}
              {quote.approvedByName && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Aprovado por</dt>
                  <dd className="text-slate-800 font-medium">{quote.approvedByName} ({quote.approvedByType})</dd>
                </div>
              )}
              {quote.rejectedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Rejeitado em</dt>
                  <dd className="text-red-700 font-medium">{formatDateTime(quote.rejectedAt)}</dd>
                </div>
              )}
              {quote.rejectedReason && (
                <div>
                  <dt className="text-slate-500 mb-1">Motivo da rejeicao</dt>
                  <dd className="text-sm text-red-700 bg-red-50 rounded p-2">{quote.rejectedReason}</dd>
                </div>
              )}
              {quote.cancelledAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Cancelado em</dt>
                  <dd className="text-slate-600 font-medium">{formatDateTime(quote.cancelledAt)}</dd>
                </div>
              )}
              {quote.cancelledReason && (
                <div>
                  <dt className="text-slate-500 mb-1">Motivo do cancelamento</dt>
                  <dd className="text-sm text-slate-600 bg-slate-50 rounded p-2">{quote.cancelledReason}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Parent quote */}
          {quote.parentQuote && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">Versao anterior</h3>
              <Link href={`/quotes/${quote.parentQuote.id}`} className="text-sm text-blue-600 hover:underline">
                {quote.parentQuote.code || quote.parentQuote.id.slice(0, 8)}
              </Link>
            </div>
          )}
        </div>

        {/* Right column: Items + Totals + Notes + Attachments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600">Itens ({quote.items.length})</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2 w-8">#</th>
                    <th className="px-4 py-2">Descricao</th>
                    <th className="px-4 py-2 w-16">Tipo</th>
                    <th className="px-4 py-2 w-12 text-center">Unid</th>
                    <th className="px-4 py-2 w-14 text-right">Qtd</th>
                    <th className="px-4 py-2 w-24 text-right">Valor Unit.</th>
                    <th className="px-4 py-2 w-14 text-right">Desc.%</th>
                    <th className="px-4 py-2 w-28 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...quote.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{item.description}</div>
                        {item.product?.code && <div className="text-xs text-slate-500">{item.product.code}</div>}
                        {item.service?.code && <div className="text-xs text-slate-500">{item.service.code}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.type === "PRODUCT" ? "bg-green-100 text-green-700" :
                          item.type === "SERVICE" ? "bg-purple-100 text-purple-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-600">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(item.unitPriceCents)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">
                        {item.discountPercent ? `${item.discountPercent}%` : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">{formatCurrency(item.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex flex-col items-end gap-1.5 text-sm">
                <div className="flex gap-8">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-800 w-32 text-right">{formatCurrency(quote.subtotalCents)}</span>
                </div>
                {(quote.discountPercent || quote.discountCents) && (
                  <div className="flex gap-8">
                    <span className="text-slate-500">
                      Desconto {quote.discountPercent ? `(${quote.discountPercent}%)` : ""}
                    </span>
                    <span className="font-medium text-red-600 w-32 text-right">
                      -{formatCurrency(quote.subtotalCents - quote.totalCents + (quote.productValueCents || 0))}
                    </span>
                  </div>
                )}
                {quote.productValueCents > 0 && (
                  <div className="flex gap-8">
                    <span className="text-slate-500">Valor Produtos</span>
                    <span className="font-medium text-slate-800 w-32 text-right">{formatCurrency(quote.productValueCents)}</span>
                  </div>
                )}
                <div className="flex gap-8 border-t border-slate-300 pt-2 mt-1 text-base font-bold">
                  <span className="text-slate-800">TOTAL</span>
                  <span className="text-blue-700 w-32 text-right">{formatCurrency(quote.totalCents)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          {quote.attachments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">
                Orcamentos de Parceiros ({quote.attachments.length})
              </h3>
              <div className="space-y-2">
                {quote.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <svg className="h-8 w-8 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{att.fileName}</div>
                      <div className="text-xs text-slate-500">
                        {att.supplierName && <span className="font-medium">{att.supplierName}</span>}
                        {att.supplierName && att.label && <span> - </span>}
                        {att.label && <span>{att.label}</span>}
                        {att.fileSize && <span className="ml-2">({(att.fileSize / 1024).toFixed(0)} KB)</span>}
                      </div>
                    </div>
                    <a href={`/api/${att.filePath}`} target="_blank" rel="noreferrer"
                      className="rounded bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 transition-colors">
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes & Terms */}
          {(quote.notes || quote.termsConditions || quote.description) && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              {quote.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-1">Descricao</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{quote.description}</p>
                </div>
              )}
              {quote.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-1">Observacoes Internas</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-line bg-amber-50 rounded p-3 border border-amber-200">{quote.notes}</p>
                </div>
              )}
              {quote.termsConditions && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-1">Termos e Condicoes</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded p-3 border border-slate-200">{quote.termsConditions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <ConfirmModal
        open={showSendModal}
        title="Enviar Orcamento"
        message={`Deseja enviar o orcamento "${quote.title}" para ${quote.clientPartner.name}?`}
        confirmLabel="Enviar"
        variant="default"
        loading={actionLoading}
        onConfirm={() => handleAction("send")}
        onCancel={() => setShowSendModal(false)}
      />

      <ConfirmModal
        open={showApproveModal}
        title="Aprovar Orcamento"
        message={`Confirma a aprovacao interna do orcamento "${quote.title}" no valor de ${formatCurrency(quote.totalCents)}?`}
        confirmLabel="Aprovar"
        variant="default"
        loading={actionLoading}
        onConfirm={() => handleAction("approve")}
        onCancel={() => setShowApproveModal(false)}
      />

      <ConfirmModal
        open={showRejectModal}
        title="Rejeitar Orcamento"
        message="Informe o motivo da rejeicao:"
        confirmLabel="Rejeitar"
        variant="danger"
        loading={actionLoading}
        reasonRequired
        reasonPlaceholder="Motivo da rejeicao..."
        onConfirm={() => {}}
        onConfirmWithReason={(reason) => handleAction("reject", { reason })}
        onCancel={() => setShowRejectModal(false)}
      />

      <ConfirmModal
        open={showCancelModal}
        title="Cancelar Orcamento"
        message="Informe o motivo do cancelamento:"
        confirmLabel="Cancelar Orcamento"
        variant="warning"
        loading={actionLoading}
        reasonRequired
        reasonPlaceholder="Motivo do cancelamento..."
        onConfirm={() => {}}
        onConfirmWithReason={(reason) => handleAction("cancel", { reason })}
        onCancel={() => setShowCancelModal(false)}
      />

      <ConfirmModal
        open={showDeleteModal}
        title="Excluir Orcamento"
        message={`Deseja excluir permanentemente o rascunho "${quote.title}"?`}
        confirmLabel="Excluir"
        variant="danger"
        loading={actionLoading}
        onConfirm={() => handleAction("delete")}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ConfirmModal
        open={showCreateOsModal}
        title="Gerar Ordem de Servico"
        message={`Deseja criar uma nova OS a partir do orcamento aprovado "${quote.title}" (${formatCurrency(quote.totalCents)})?`}
        confirmLabel="Criar OS"
        variant="default"
        loading={actionLoading}
        onConfirm={() => handleAction("create-os")}
        onCancel={() => setShowCreateOsModal(false)}
      />
    </div>
  );
}
