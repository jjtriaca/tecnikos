"use client";

/**
 * ════════════════════════════════════════════════════════════
 * PADRAO TECNIKOS — Tela de Detalhe de FinancialEntry (v1.10.79)
 * ════════════════════════════════════════════════════════════
 *
 * REGRA: A tela mostra TUDO que esta no banco sobre o lancamento financeiro.
 *
 * Como funciona:
 *  - Backend `/finance/entries/:id/detail` retorna `entry` sem select projection
 *    (campo a campo, automático) + relacoes (NFe, NFS-e, Boleto, OS, etc).
 *  - Esta tela tem secoes nomeadas pros campos importantes (Geral, Pagamento, etc).
 *  - A secao "Outros dados do banco" no final usa Object.entries(entry) e mostra
 *    QUALQUER campo NAO listado em KNOWN_FIELDS_RENDERED como fallback.
 *
 * Ao adicionar campo novo ao schema Prisma `FinancialEntry`:
 *  - Se for campo importante e merece label custom: adicione na secao apropriada
 *    abaixo (Geral/Pagamento/Documentos) E ao set KNOWN_FIELDS_RENDERED.
 *  - Se nao fizer nada: cai em "Outros dados do banco" automaticamente — gestor
 *    ja consegue ver o dado. NUNCA remover essa secao de fallback — eh garantia
 *    anti-bug de descoberta de campos novos.
 *
 * NUNCA remover:
 *  - A secao "Outros dados do banco" (fallback automático).
 *  - O log de comentarios PADRAO TECNIKOS — orientam IA em futuras sessoes.
 *  - O cruzamento com NfeImport (botao "Baixar DANFE") — eh o ponto unico de
 *    acesso ao PDF da NFe vinculada a um lancamento.
 * ════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/**
 * KNOWN_FIELDS_RENDERED — fields exibidos em secao especifica.
 * Quando voce adiciona campo novo aqui, lembre de tambem renderizar ele
 * na secao correspondente do JSX abaixo.
 */
const KNOWN_FIELDS_RENDERED = new Set<string>([
  // Identificacao
  "id", "code", "companyId", "createdAt", "updatedAt", "deletedAt",
  // Tipo/Status
  "type", "status",
  // Geral
  "description", "notes", "partnerId", "serviceOrderId",
  "financialAccountId", "obraId",
  // Valores
  "grossCents", "netCents", "commissionBps", "commissionCents",
  // Datas
  "dueDate", "paidAt", "confirmedAt", "cancelledAt",
  // Pagamento
  "paymentMethod", "paymentMethodId", "paymentInstrumentId", "cashAccountId",
  "cardBrand", "receivedCardLast4", "cardBillingDate", "autoMarkedPaid",
  // Cheque
  "checkNumber", "checkBank", "checkAgency", "checkAccount",
  "checkClearanceDate", "checkHolder",
  // Cancelamento
  "cancelledReason", "cancelledByName",
  // Parcelas
  "installmentCount", "interestType", "interestRateMonthly",
  "penaltyPercent", "penaltyFixedCents",
  // Renegociação
  "parentEntryId", "renegotiatedAt", "renegotiatedToId",
  // NFS-e
  "nfseStatus", "nfseEmissionId",
  // Conciliação
  "invoiceMatchLineId",
  // Estorno
  "refundPairEntryId", "isRefundEntry",
  // Encargo (v1.10.76)
  "isInvoiceCharge",
  // Lote
  "batchPaymentId",
  // Tracking universal (v1.10.87+) — renderizado em secao Auditoria
  "createdByUserId", "createdByName", "createdVia",
  "updatedByUserId", "updatedByName",
  "deletedByUserId", "deletedByName",
  // Relacoes (objetos aninhados — renderizadas em secoes proprias)
  "partner", "serviceOrder", "financialAccount", "paymentMethodRef",
  "cashAccountRef", "paymentInstrumentRef", "installments", "parentEntry",
  "childEntries", "renegotiatedTo", "invoiceMatchLine", "refundPairEntry",
  "nfseEmission", "boletos", "cardSettlements", "nfseEntradaLinks",
]);

// Mapeamento amigavel pra mostrar a origem do registro em portugues
const CREATION_VIA_LABEL: Record<string, string> = {
  MANUAL: "Manual (usuario logado)",
  IMPORT_CSV: "Importacao CSV",
  IMPORT_OFX: "Importacao OFX (extrato bancario)",
  IMPORT_NFE_XML: "Importacao NFe (XML)",
  WEBHOOK_FOCUS: "Webhook Focus NFe",
  WEBHOOK_ASAAS: "Webhook Asaas (pagamento)",
  WEBHOOK_SICREDI: "Webhook Sicredi (boleto)",
  WEBHOOK_META: "Webhook WhatsApp",
  CRON: "Sistema (job agendado)",
  CHAT_IA: "Assistente IA (wizard)",
  API_PUBLIC: "API publica (portal cliente/tecnico)",
  SYSTEM_SEED: "Sistema (seed inicial)",
  MIGRATION_BACKFILL: "Sistema (migration backfill)",
};

const ENTRY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-200" },
  CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID: { label: "Pago", color: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelado", color: "bg-slate-100 text-slate-500 border-slate-200" },
  SPLIT: { label: "Parcelado", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return String(d);
  }
}

function formatFieldName(key: string): string {
  // camelCase → "Camel Case"
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Cents$/, " (cents)")
    .replace(/Id$/, " ID")
    .replace(/At$/, " (data)");
}

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Nao";
  if (typeof val === "string" && /\d{4}-\d{2}-\d{2}T/.test(val)) {
    return formatDateTime(val);
  }
  if (typeof val === "number" && key.endsWith("Cents")) {
    return formatCurrency(val);
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

type EntryDetail = {
  entry: Record<string, any>;
  nfeImport: any;
  matchedLine: any;
  auditLog: any[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500 uppercase">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5 break-words">{children ?? "—"}</p>
    </div>
  );
}

/**
 * v1.10.79 — Helper compartilhado de download/abertura de PDF.
 * Reusa o MESMO padrao da pagina /nfe (fiscal): fetch com Bearer token → blob → window.open.
 * Usado pra DANFE (NFe) e DANFSe (NFS-e) — endpoints autenticados.
 * NUNCA usar href={url} direto em URLs do backend — perde o token de auth.
 */
async function openPdfBlob(endpoint: string, toast: (m: string, t?: "success" | "error") => void) {
  try {
    const token = getAccessToken();
    const res = await fetch(endpoint, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Erro ao gerar PDF");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      toast("Nao foi possivel abrir o PDF. Verifique o bloqueador de pop-ups.", "error");
      URL.revokeObjectURL(url);
    }
  } catch (err: any) {
    toast(err?.message || "Erro ao abrir PDF.", "error");
  }
}

export default function FinanceEntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    api.get<EntryDetail>(`/finance/entries/${params.id}/detail`)
      .then(setData)
      .catch(() => toast("Erro ao carregar detalhes", "error"))
      .finally(() => setLoading(false));
  }, [params?.id, toast]);

  if (loading) {
    return <div className="p-8 text-slate-500 text-sm">Carregando...</div>;
  }
  if (!data) {
    return <div className="p-8 text-rose-600 text-sm">Lancamento nao encontrado.</div>;
  }

  const { entry, nfeImport, matchedLine, auditLog } = data;
  const statusCfg = ENTRY_STATUS_CONFIG[entry.status] || ENTRY_STATUS_CONFIG.PENDING;
  const typeLabel = entry.type === "RECEIVABLE" ? "A Receber" : "A Pagar";
  const typeColor = entry.type === "RECEIVABLE" ? "text-green-700" : "text-blue-700";

  // Build "outros dados" — campos do entry que nao tem secao dedicada
  const otherFields = Object.entries(entry).filter(([k]) => !KNOWN_FIELDS_RENDERED.has(k));

  const isReconciled = !!entry.invoiceMatchLineId || !!matchedLine;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-xs text-slate-500 hover:text-slate-700 mb-3"
        >
          ← Voltar
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className={`text-xs font-medium ${typeColor} uppercase`}>
              {typeLabel} {entry.isInvoiceCharge && "· Encargo"}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              <span className="font-mono text-slate-500 mr-2">{entry.code}</span>
              {entry.description || "(sem descricao)"}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {entry.isInvoiceCharge && (
                <span className="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 border-purple-200">
                  Encargo de fatura
                </span>
              )}
              {isReconciled && (
                <span className="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium bg-green-50 text-green-700 border-green-200">
                  Conciliado
                </span>
              )}
              {entry.parentEntry?.status === "SPLIT" ? (
                <span className="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                  Parcela {entry.description?.match(/Parcela (\d+\/\d+)/)?.[1] || ""}
                </span>
              ) : entry.parentEntryId ? (
                <span className="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                  Renegociado
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500 uppercase">Valor liquido</p>
            <p className={`text-2xl font-bold ${typeColor}`}>{formatCurrency(entry.netCents)}</p>
            {entry.commissionCents != null && entry.commissionCents !== 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                Bruto {formatCurrency(entry.grossCents)} · Comissao {formatCurrency(entry.commissionCents)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Geral */}
      <Section title="Geral">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Código">{entry.code}</Field>
          <Field label="Tipo">{typeLabel}</Field>
          <Field label="Status">{statusCfg.label}</Field>
          <Field label="Parceiro">
            {entry.partner ? (
              <span>
                {entry.partner.name}
                {entry.partner.document && <span className="text-slate-600 text-xs ml-1">({entry.partner.document})</span>}
              </span>
            ) : "—"}
          </Field>
          <Field label="Plano de contas">
            {entry.financialAccount ? `${entry.financialAccount.code || ""} ${entry.financialAccount.name}`.trim() : "—"}
          </Field>
          <Field label="OS vinculada">
            {entry.serviceOrder ? (
              <a href={`/orders/${entry.serviceOrder.id}`} className="text-blue-600 hover:underline">
                {entry.serviceOrder.code || entry.serviceOrder.title}
              </a>
            ) : "—"}
          </Field>
          <Field label="Vencimento">{formatDate(entry.dueDate)}</Field>
          <Field label={entry.type === "RECEIVABLE" ? "Recebido em" : "Pago em"}>{formatDate(entry.paidAt)}</Field>
          <Field label="Criado em">{formatDateTime(entry.createdAt)}</Field>
        </div>
        {entry.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-medium text-slate-500 uppercase mb-1">Observacoes / log</p>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{entry.notes}</pre>
          </div>
        )}
        {entry.cancelledReason && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-medium text-rose-600 uppercase mb-1">Motivo do cancelamento</p>
            <p className="text-sm text-slate-700">
              {entry.cancelledReason} — por {entry.cancelledByName || "—"} em {formatDateTime(entry.cancelledAt)}
            </p>
          </div>
        )}
      </Section>

      {/* Pagamento — campos condicionais escondem ruido (cardholder/ciclo fatura so quando aplicaveis) */}
      <Section title="Pagamento">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Metodo">{entry.paymentMethodRef?.name || entry.paymentMethod || "—"}</Field>
          <Field label="Instrumento">
            {entry.paymentInstrumentRef ? (
              <span>
                {entry.paymentInstrumentRef.name}
                {entry.paymentInstrumentRef.cardLast4 && (
                  <span className="text-slate-600 ml-1">••{entry.paymentInstrumentRef.cardLast4}</span>
                )}
              </span>
            ) : "—"}
          </Field>
          <Field label="Conta">{entry.cashAccountRef?.name || "—"}</Field>
          {/* Cardholder so faz sentido pra RECEIVABLE recebido via cartao */}
          {entry.type === "RECEIVABLE" && entry.receivedCardLast4 && (
            <Field label="Cartão do cliente">••••{entry.receivedCardLast4} {entry.cardBrand || ""}</Field>
          )}
          {/* Ciclo de fatura so pra credito de cartao */}
          {entry.paymentInstrumentRef?.billingClosingDay && (
            <Field label="Ciclo da fatura">{formatDate(entry.cardBillingDate)}</Field>
          )}
          {/* Auto-pago so quando relevante (entry foi auto-marcada paga por configuracao do instrumento) */}
          {entry.autoMarkedPaid && (
            <Field label="Pagamento automático">Sim — debitado direto no instrumento</Field>
          )}
          {entry.checkNumber && (
            <>
              <Field label="Cheque numero">{entry.checkNumber}</Field>
              <Field label="Banco">{entry.checkBank}</Field>
              <Field label="Compensacao">{formatDate(entry.checkClearanceDate)}</Field>
            </>
          )}
        </div>
      </Section>

      {/* Documentos: NFe, NFS-e, Boleto */}
      {(nfeImport || entry.nfseEmission || (entry.boletos && entry.boletos.length > 0) || (entry.nfseEntradaLinks && entry.nfseEntradaLinks.length > 0)) && (
        <Section title="Documentos vinculados">
          {nfeImport && (
            <div className="mb-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">NFe importada (entrada)</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {nfeImport.nfeNumber && <span>N° {nfeImport.nfeNumber} </span>}
                    {nfeImport.nfeSeries && <span>Serie {nfeImport.nfeSeries} </span>}
                    · Emitida em {formatDate(nfeImport.issueDate)}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono mt-1 break-all">{nfeImport.nfeKey}</p>
                </div>
                {/* v1.10.79: Prefere SefazDocument endpoint (mesmo usado em /nfe fiscal) — quando a NFe
                    veio da SEFAZ tem sefazDocumentId. Fallback pro endpoint do NfeImport (upload manual). */}
                {(nfeImport.hasXml || nfeImport.sefazDocumentId) && (
                  <button
                    onClick={() => {
                      const endpoint = nfeImport.sefazDocumentId
                        ? `/api/nfe/sefaz/documents/${nfeImport.sefazDocumentId}/danfe`
                        : `/api/nfe/imports/${nfeImport.id}/danfe`;
                      openPdfBlob(endpoint, toast);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
                  >
                    Abrir DANFE
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-slate-500">Fornecedor:</span> {nfeImport.supplierName || "—"}</div>
                <div><span className="text-slate-500">CNPJ:</span> {nfeImport.supplierCnpj || "—"}</div>
                <div><span className="text-slate-500">Total:</span> {formatCurrency(nfeImport.totalCents)}</div>
                <div><span className="text-slate-500">Status:</span> {nfeImport.status}</div>
                {nfeImport.icmsCents != null && <div><span className="text-slate-500">ICMS:</span> {formatCurrency(nfeImport.icmsCents)}</div>}
                {nfeImport.ipiCents != null && <div><span className="text-slate-500">IPI:</span> {formatCurrency(nfeImport.ipiCents)}</div>}
                {nfeImport.pisCents != null && <div><span className="text-slate-500">PIS:</span> {formatCurrency(nfeImport.pisCents)}</div>}
                {nfeImport.cofinsCents != null && <div><span className="text-slate-500">COFINS:</span> {formatCurrency(nfeImport.cofinsCents)}</div>}
              </div>
              {nfeImport.infCpl && (
                <div className="mt-2 text-xs text-slate-600">
                  <span className="text-slate-500">Inf. Complementares:</span> {nfeImport.infCpl}
                </div>
              )}
            </div>
          )}

          {entry.nfseEmission && (
            <div className="mb-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">NFS-e emitida</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {entry.nfseEmission.nfseNumber && <span>N° {entry.nfseEmission.nfseNumber} </span>}
                    {entry.nfseEmission.rpsNumber && <span>RPS {entry.nfseEmission.rpsNumber}/{entry.nfseEmission.rpsSeries} </span>}
                    · Status: <strong>{entry.nfseEmission.status}</strong>
                  </p>
                </div>
                {/* v1.10.79: Reusa endpoint autenticado /nfse-emission/emissions/:id/pdf — mesmo
                    usado pelo menu de acao em A Receber e pela pagina /nfe/saida. */}
                {entry.nfseEmission.status === "AUTHORIZED" && (
                  <button
                    onClick={() => openPdfBlob(`/api/nfse-emission/emissions/${entry.nfseEmission.id}/pdf`, toast)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
                  >
                    Abrir DANFSe
                  </button>
                )}
              </div>
              {entry.nfseEmission.codigoVerificacao && (
                <p className="text-xs text-slate-500">Cod. Verificacao: <span className="font-mono">{entry.nfseEmission.codigoVerificacao}</span></p>
              )}
              {entry.nfseEmission.errorMessage && (
                <p className="text-xs text-rose-600 mt-1">Erro: {entry.nfseEmission.errorMessage}</p>
              )}
            </div>
          )}

          {entry.boletos && entry.boletos.length > 0 && entry.boletos.map((b: any) => (
            <div key={b.id} className="mb-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Boleto</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Nosso N° {b.nossoNumero} · {formatCurrency(b.amountCents)} · Venc. {formatDate(b.dueDate)} · Status: <strong>{b.status}</strong>
                  </p>
                  {b.linhaDigitavel && (
                    <p className="text-[11px] font-mono text-slate-600 mt-1 break-all">{b.linhaDigitavel}</p>
                  )}
                </div>
                {b.pdfUrl && (
                  <a
                    href={b.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
                  >
                    📄 Baixar Boleto
                  </a>
                )}
              </div>
            </div>
          ))}

          {entry.nfseEntradaLinks && entry.nfseEntradaLinks.length > 0 && entry.nfseEntradaLinks.map((link: any) => {
            const ne = link.nfseEntrada;
            return (
              <div key={link.id} className="mb-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0 last:mb-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">NFS-e recebida (serviço tomado)</p>
                    <p className="text-xs text-slate-500 mt-1">
                      N° {ne.numero || "—"} · {ne.prestadorRazaoSocial || "—"}
                      {ne.prestadorCnpjCpf && <span className="text-slate-600 ml-1">({ne.prestadorCnpjCpf})</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Emitida em {formatDate(ne.dataEmissao)}
                      {ne.competencia && <span> · Competencia {ne.competencia}</span>}
                      {ne.layout && <span className="text-slate-600 ml-1">({ne.layout})</span>}
                    </p>
                    {ne.codigoVerificacao && (
                      <p className="text-[11px] text-slate-600 font-mono mt-1">Cod. Verif.: {ne.codigoVerificacao}</p>
                    )}
                  </div>
                  <a
                    href={`/fiscal/servicos-tomados?id=${ne.id}`}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-300 hover:bg-blue-50 rounded-lg whitespace-nowrap"
                  >
                    Ver no Fiscal
                  </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-slate-500">Valor serviços:</span> {formatCurrency(ne.valorServicosCents)}</div>
                  {ne.valorIssCents != null && (
                    <div><span className="text-slate-500">ISS:</span> {formatCurrency(ne.valorIssCents)} {ne.issRetido && <span className="text-amber-700">(retido)</span>}</div>
                  )}
                  {ne.aliquotaIss != null && (
                    <div><span className="text-slate-500">Aliquota ISS:</span> {ne.aliquotaIss}%</div>
                  )}
                  {ne.valorLiquidoCents != null && (
                    <div><span className="text-slate-500">Valor liquido:</span> {formatCurrency(ne.valorLiquidoCents)}</div>
                  )}
                  {ne.itemListaServico && (
                    <div><span className="text-slate-500">Item LC 116:</span> {ne.itemListaServico}</div>
                  )}
                  {ne.codigoCnae && (
                    <div><span className="text-slate-500">CNAE:</span> {ne.codigoCnae}</div>
                  )}
                </div>
                {ne.discriminacao && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-medium text-slate-500 uppercase mb-1">Discriminacao do serviço</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{ne.discriminacao}</p>
                  </div>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {/* Parcelas */}
      {entry.installments && entry.installments.length > 0 && (
        <Section title={`Parcelas (${entry.installments.length}x)`}>
          <table className="w-full text-xs">
            <thead className="text-slate-500 uppercase">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Vencimento</th>
                <th className="text-right py-2">Valor</th>
                <th className="text-right py-2">Juros</th>
                <th className="text-right py-2">Total</th>
                <th className="text-center py-2">Status</th>
                <th className="text-left py-2">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {entry.installments.map((i: any) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-2">{i.installmentNumber}</td>
                  <td className="py-2">{formatDate(i.dueDate)}</td>
                  <td className="py-2 text-right">{formatCurrency(i.amountCents)}</td>
                  <td className="py-2 text-right text-amber-700">{formatCurrency(i.interestCents)}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(i.totalCents)}</td>
                  <td className="py-2 text-center">{i.status}</td>
                  <td className="py-2">{formatDate(i.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Parcelamento — esta entry e uma PARCELA (mae dividida/SPLIT) */}
      {entry.parentEntry?.status === "SPLIT" && (
        <Section title="Parcelamento">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Field label="Parcela">{entry.description?.match(/Parcela (\d+\/\d+)/)?.[1] || `1/${entry.installmentCount || "?"}`}</Field>
            <Field label="Valor desta parcela">{formatCurrency(entry.netCents)}</Field>
            <Field label="Total parcelado">{formatCurrency(entry.parentEntry.netCents)}</Field>
            <Field label="Fatura (ciclo)">{entry.cardBillingDate ? formatDate(entry.cardBillingDate) : "—"}</Field>
          </div>
          <p className="text-[11px] font-medium text-slate-500 uppercase">Lancamento original (dividido)</p>
          <a href={`/finance/entries/${entry.parentEntry.id}`} className="text-sm text-blue-600 hover:underline">
            {entry.parentEntry.code} — {entry.parentEntry.description || "(sem descricao)"} ({formatCurrency(entry.parentEntry.netCents)})
          </a>
        </Section>
      )}

      {/* Parcelamento — esta entry e o PAI dividido (SPLIT): lista as parcelas */}
      {entry.status === "SPLIT" && entry.childEntries && entry.childEntries.length > 0 && (
        <Section title={`Parcelamento — dividido em ${entry.childEntries.length} parcelas`}>
          <div className="mb-2 text-sm text-slate-600">
            Total parcelado: <span className="font-semibold text-slate-900">{formatCurrency(entry.netCents)}</span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-slate-500 uppercase">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2">Parcela</th>
                <th className="text-left py-2">Fatura (ciclo)</th>
                <th className="text-right py-2">Valor</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entry.childEntries.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <a href={`/finance/entries/${c.id}`} className="text-blue-600 hover:underline">
                      {c.description?.match(/Parcela (\d+\/\d+)/)?.[1] || c.code}
                    </a>
                  </td>
                  <td className="py-2">{c.cardBillingDate ? formatDate(c.cardBillingDate) : c.paidAt ? formatDate(c.paidAt) : "—"}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(c.netCents)}</td>
                  <td className="py-2 text-center">{ENTRY_STATUS_CONFIG[c.status]?.label || c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Renegociação (verdadeira — nao e parcelamento) */}
      {((entry.parentEntry && entry.parentEntry.status !== "SPLIT") || entry.renegotiatedTo || (entry.status !== "SPLIT" && entry.childEntries && entry.childEntries.length > 0)) && (
        <Section title="Renegociação">
          {entry.parentEntry && entry.parentEntry.status !== "SPLIT" && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase">Entry original</p>
              <a href={`/finance/entries/${entry.parentEntry.id}`} className="text-sm text-blue-600 hover:underline">
                {entry.parentEntry.code} — {entry.parentEntry.description || "(sem descricao)"} ({formatCurrency(entry.parentEntry.netCents)})
              </a>
            </div>
          )}
          {entry.renegotiatedTo && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase">Renegociada para</p>
              <a href={`/finance/entries/${entry.renegotiatedTo.id}`} className="text-sm text-blue-600 hover:underline">
                {entry.renegotiatedTo.code} — {entry.renegotiatedTo.description || "(sem descricao)"} ({formatCurrency(entry.renegotiatedTo.netCents)})
              </a>
            </div>
          )}
          {entry.status !== "SPLIT" && entry.childEntries && entry.childEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase mb-1">Entries filhas (renegociacoes desta)</p>
              <ul className="space-y-1">
                {entry.childEntries.map((c: any) => (
                  <li key={c.id} className="text-sm">
                    <a href={`/finance/entries/${c.id}`} className="text-blue-600 hover:underline">
                      {c.code}
                    </a>
                    {" — "}{c.description} ({formatCurrency(c.netCents)}, {formatDate(c.renegotiatedAt)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Card Settlements */}
      {entry.cardSettlements && entry.cardSettlements.length > 0 && (
        <Section title="Baixa de cartao">
          {entry.cardSettlements.map((s: any) => (
            <div key={s.id} className="text-xs mb-2 last:mb-0">
              <span className="font-mono text-slate-600">{s.cardBrand || s.paymentMethodCode}</span> ·
              Bruto {formatCurrency(s.grossCents)} · Taxa {formatCurrency(s.feeCents)} ·
              Liquido esperado {formatCurrency(s.expectedNetCents)} · Esperado {formatDate(s.expectedDate)} ·
              Status: <strong>{s.status}</strong>
              {s.settledAt && <span> · Pago em {formatDate(s.settledAt)}</span>}
            </div>
          ))}
        </Section>
      )}

      {/* Conciliação */}
      {(isReconciled || entry.invoiceMatchLine || matchedLine) && (
        <Section title="Conciliação bancaria">
          {entry.invoiceMatchLine && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase">Vinculada a fatura de cartao (N-pra-1)</p>
              <p className="text-sm text-slate-700">
                {entry.invoiceMatchLine.description} · {formatCurrency(Math.abs(entry.invoiceMatchLine.amountCents))} · {formatDate(entry.invoiceMatchLine.transactionDate)}
                <span className="text-slate-500 text-xs ml-2">conciliada por {entry.invoiceMatchLine.matchedByName} em {formatDateTime(entry.invoiceMatchLine.matchedAt)}</span>
              </p>
            </div>
          )}
          {matchedLine && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase">Match direto 1:1 com linha do extrato</p>
              <p className="text-sm text-slate-700">
                {matchedLine.description} · {formatCurrency(Math.abs(matchedLine.amountCents))} · {formatDate(matchedLine.transactionDate)}
                <span className="text-slate-500 text-xs ml-2">conciliada por {matchedLine.matchedByName} em {formatDateTime(matchedLine.matchedAt)}</span>
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Rastreabilidade — quem criou / alterou / excluiu (v1.10.87+ tracking universal) */}
      <Section title="Rastreabilidade">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase mb-1">Criado por</p>
            <p className="text-sm text-slate-800">
              {(entry as any).createdByName || <span className="text-slate-500">—</span>}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              em {formatDateTime(entry.createdAt)}
            </p>
            {(entry as any).createdVia && (
              <p className="text-[11px] text-slate-600 mt-0.5">
                origem: {CREATION_VIA_LABEL[(entry as any).createdVia] || (entry as any).createdVia}
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase mb-1">Ultima alteracao</p>
            <p className="text-sm text-slate-800">
              {(entry as any).updatedByName || <span className="text-slate-500">—</span>}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              em {formatDateTime(entry.updatedAt)}
            </p>
          </div>
          {entry.deletedAt && (
            <div>
              <p className="text-[11px] font-medium text-rose-600 uppercase mb-1">Excluido por</p>
              <p className="text-sm text-rose-700">
                {(entry as any).deletedByName || <span className="text-rose-500">—</span>}
              </p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                em {formatDateTime(entry.deletedAt)}
              </p>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-500 italic mt-3">
          Registros antigos (anteriores ao v1.10.87) ficam sem informacao de quem criou — mostram "—" aqui. A partir desta versao, todo lancamento novo grava automaticamente.
        </p>
      </Section>

      {/* Outros dados do banco — fallback automático (NUNCA REMOVER) */}
      {otherFields.length > 0 && (
        <Section title="Outros dados do banco">
          <p className="text-[11px] text-slate-500 italic mb-3">
            Campos do banco nao listados nas secoes acima — aparecem aqui automaticamente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {otherFields.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <span className="text-slate-500 font-medium">{formatFieldName(k)}:</span>
                <span className="text-slate-800 break-words">{formatValue(k, v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Auditoria */}
      {auditLog && auditLog.length > 0 && (
        <Section title="Auditoria">
          <ul className="space-y-2 text-xs">
            {auditLog.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                <p className="text-slate-700">
                  <strong>{a.action}</strong> por {a.actorName || a.actorType}
                  <span className="text-slate-600 ml-2">{formatDateTime(a.createdAt)}</span>
                </p>
                {(a.before || a.after) && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-slate-500 text-[11px]">ver diff</summary>
                    <pre className="mt-1 p-2 bg-slate-50 rounded text-[10px] overflow-x-auto">
                      {JSON.stringify({ before: a.before, after: a.after }, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
