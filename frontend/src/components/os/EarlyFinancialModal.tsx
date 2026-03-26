"use client";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type PostableAccount = { id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } };
type PaymentMethodPM = { id: string; code: string; name: string; isActive: boolean; requiresBrand: boolean; feePercent?: number | null; receivingDays?: number | null; sortOrder: number };
type CardFeeRateItem = { id: string; description: string; brand: string; type: string; installmentFrom: number; installmentTo: number; feePercent: number; receivingDays: number; isActive: boolean };

type EntryPreview = {
  type: "RECEIVABLE" | "PAYABLE";
  partnerName: string | null;
  description: string;
  grossCents: number;
  netCents: number;
  commissionBps: number;
  commissionCents: number;
  alreadyLaunched: boolean;
  existingCode?: string;
  available: boolean;
};

type PreviewData = {
  osCode: string;
  osTitle: string;
  clientName: string | null;
  techName: string | null;
  entries: EntryPreview[];
};

type Props = {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onLaunched: () => void;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EarlyFinancialModal({ open, orderId, onClose, onLaunched }: Props) {
  const { toast } = useToast() as { toast: (msg: string, type?: string) => void };
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [postableAccounts, setPostableAccounts] = useState<PostableAccount[]>([]);
  const [activePMs, setActivePMs] = useState<PaymentMethodPM[]>([]);
  const [cardFeeRates, setCardFeeRates] = useState<CardFeeRateItem[]>([]);
  const [error, setError] = useState("");

  // Form state
  const [launchReceivable, setLaunchReceivable] = useState(false);
  const [launchPayable, setLaunchPayable] = useState(false);
  const [receivableDue, setReceivableDue] = useState(todayStr());
  const [payableDue, setPayableDue] = useState(todayStr());
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [payableAccountId, setPayableAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedCardRateId, setSelectedCardRateId] = useState("");

  // Card logic
  const selectedPM = useMemo(() => activePMs.find(p => p.code === paymentMethod), [paymentMethod, activePMs]);
  const isCardPayment = !!selectedPM?.requiresBrand;
  const cardType = useMemo(() => {
    if (!selectedPM?.requiresBrand) return "";
    const text = (selectedPM.code + " " + selectedPM.name).toUpperCase();
    return (text.includes("DEBIT") || text.includes("DÉBITO") || text.includes("DEBITO")) ? "DEBITO" : "CREDITO";
  }, [selectedPM]);
  const filteredCardRates = useMemo(() => {
    if (!cardType) return [];
    return cardFeeRates.filter(r => r.type === cardType && r.isActive);
  }, [cardType, cardFeeRates]);
  const selectedCardRate = useMemo(() => {
    if (!selectedCardRateId) return null;
    return cardFeeRates.find(r => r.id === selectedCardRateId) || null;
  }, [selectedCardRateId, cardFeeRates]);

  // Fee calculation
  const recGross = preview?.entries.find(e => e.type === "RECEIVABLE")?.grossCents || 0;
  const feeCents = selectedCardRate ? Math.round(recGross * selectedCardRate.feePercent / 100) : 0;
  const netAfterFee = recGross - feeCents;
  const installmentCount = selectedCardRate ? (selectedCardRate.installmentTo || 1) : 1;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setLaunchReceivable(false);
    setLaunchPayable(false);
    setReceivableDue(todayStr());
    setPayableDue(todayStr());
    setPaymentMethod("");
    setSelectedCardRateId("");

    Promise.all([
      api.get<PreviewData>(`/service-orders/${orderId}/early-financial-preview`),
      api.get<PostableAccount[]>("/finance/accounts/postable").catch(() => []),
      api.get<PaymentMethodPM[]>("/finance/payment-methods/active").catch(() => []),
      api.get<CardFeeRateItem[]>("/finance/card-fee-rates").catch(() => []),
    ]).then(([data, accounts, pms, rates]) => {
      setPreview(data);
      setPostableAccounts(accounts);
      setActivePMs(pms);
      setCardFeeRates(rates);
      // Auto-select defaults
      const recDefault = accounts.find(a => a.code === "1100");
      const payDefault = accounts.find(a => a.code === "2100");
      setReceivableAccountId(recDefault?.id || "");
      setPayableAccountId(payDefault?.id || "");
      // Auto-select first payment method
      if (pms.length > 0) setPaymentMethod(pms[0].code);
      // Auto-check available entries
      const recEntry = data.entries.find(e => e.type === "RECEIVABLE");
      const payEntry = data.entries.find(e => e.type === "PAYABLE");
      if (recEntry?.available) setLaunchReceivable(true);
      if (payEntry?.available) setLaunchPayable(true);
    }).catch((err: any) => {
      setError(err?.message || "Erro ao carregar preview");
    }).finally(() => setLoading(false));
  }, [open, orderId]);

  // Reset card selection when payment method changes
  useEffect(() => { setSelectedCardRateId(""); }, [paymentMethod]);

  if (!open) return null;

  const recEntry = preview?.entries.find(e => e.type === "RECEIVABLE");
  const payEntryRaw = preview?.entries.find(e => e.type === "PAYABLE");
  const payEntry = payEntryRaw && payEntryRaw.netCents > 0 ? payEntryRaw : null; // Hide if zero
  const needsCard = isCardPayment && !selectedCardRateId;
  const canSubmit = (launchReceivable || launchPayable) && !submitting && !loading && paymentMethod && !needsCard;

  async function handleLaunch() {
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/service-orders/${orderId}/early-financial`, {
        launchReceivable,
        launchPayable,
        receivableDueDate: launchReceivable ? receivableDue : undefined,
        payableDueDate: launchPayable ? payableDue : undefined,
        receivableAccountId: launchReceivable ? (receivableAccountId || undefined) : undefined,
        payableAccountId: launchPayable ? (payableAccountId || undefined) : undefined,
        paymentMethod,
        cardBrand: isCardPayment && selectedCardRate ? selectedCardRate.brand : undefined,
        cardFeeRateId: isCardPayment ? selectedCardRateId : undefined,
        installmentCount: isCardPayment && selectedCardRate ? installmentCount : undefined,
      });
      toast("Lancamento antecipado realizado com sucesso!", "success");
      onLaunched();
    } catch (err: any) {
      setError(err?.message || "Erro ao lancar financeiro");
    } finally {
      setSubmitting(false);
    }
  }

  function renderAccountSelect(value: string, onChange: (v: string) => void) {
    const grouped = new Map<string, PostableAccount[]>();
    for (const acc of postableAccounts) {
      const parentName = acc.parent?.name || "Outros";
      if (!grouped.has(parentName)) grouped.set(parentName, []);
      grouped.get(parentName)!.push(acc);
    }
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-300 flex-1">
        <option value="">Sem categoria</option>
        {Array.from(grouped.entries()).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Lancamento Financeiro Antecipado</h3>
            {preview && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {preview.osCode} — {preview.osTitle}
                {preview.clientName && <> | Cliente: {preview.clientName}</>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* Loading */}
          {loading && (
            <div className="text-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Calculando...</p>
            </div>
          )}

          {/* Entries */}
          {preview && !loading && (
            <>
              {/* RECEIVABLE */}
              {recEntry && (
                <div className={`rounded-lg border p-3 transition-colors ${
                  recEntry.alreadyLaunched
                    ? "border-slate-200 bg-slate-50 opacity-60"
                    : launchReceivable
                      ? "border-green-300 bg-green-50"
                      : "border-slate-200 bg-white"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {recEntry.alreadyLaunched ? (
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Ja lancado ({recEntry.existingCode})
                        </span>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={launchReceivable}
                            onChange={e => setLaunchReceivable(e.target.checked)}
                            className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            A Receber
                          </span>
                        </label>
                      )}
                      <span className="text-xs text-slate-600">{recEntry.partnerName}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{formatBRL(recEntry.grossCents)}</span>
                  </div>

                  {!recEntry.alreadyLaunched && launchReceivable && (
                    <div className="flex flex-col gap-1.5 mt-2 pl-6">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-500 w-10">Venc:</label>
                        <input type="date" value={receivableDue} onChange={e => setReceivableDue(e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-300 flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-500 w-10">Categ:</label>
                        {renderAccountSelect(receivableAccountId, setReceivableAccountId)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAYABLE */}
              {payEntry && (
                <div className={`rounded-lg border p-3 transition-colors ${
                  payEntry.alreadyLaunched
                    ? "border-slate-200 bg-slate-50 opacity-60"
                    : launchPayable
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {payEntry.alreadyLaunched ? (
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Ja lancado ({payEntry.existingCode})
                        </span>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={launchPayable}
                            onChange={e => setLaunchPayable(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            A Pagar
                          </span>
                        </label>
                      )}
                      <span className="text-xs text-slate-600">{payEntry.partnerName}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{formatBRL(payEntry.netCents)}</span>
                  </div>

                  {!payEntry.alreadyLaunched && launchPayable && (
                    <div className="flex flex-col gap-1.5 mt-2 pl-6">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-500 w-10">Venc:</label>
                        <input type="date" value={payableDue} onChange={e => setPayableDue(e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-300 flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-500 w-10">Categ:</label>
                        {renderAccountSelect(payableAccountId, setPayableAccountId)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment method + Card selection */}
              {(launchReceivable || launchPayable) && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  {/* Payment method */}
                  <div>
                    <label className="text-xs text-slate-600 font-medium">Forma de pagamento *</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 mt-1">
                      <option value="">Selecione...</option>
                      {activePMs.map(m => (
                        <option key={m.code} value={m.code}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Card selection — only for card payments */}
                  {isCardPayment && (
                    <div>
                      <label className="text-xs text-slate-600 font-medium">Cartao *</label>
                      {filteredCardRates.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 mt-1">
                          <p className="font-medium">Nenhuma taxa cadastrada para {cardType === "DEBITO" ? "debito" : "credito"}.</p>
                          <p className="mt-0.5">Cadastre as taxas em Financeiro &gt; Cadastros &gt; Taxas de Cartao.</p>
                        </div>
                      ) : (
                        <select value={selectedCardRateId} onChange={e => setSelectedCardRateId(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 mt-1">
                          <option value="">Selecione o cartao...</option>
                          {filteredCardRates.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.description || `${r.brand} ${r.type === "CREDITO" ? "Credito" : "Debito"} ${r.installmentFrom === r.installmentTo ? `${r.installmentFrom}x` : `${r.installmentFrom}-${r.installmentTo}x`}`}
                              {` — ${r.feePercent.toFixed(2)}%`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Fee preview for selected card */}
                  {isCardPayment && selectedCardRate && recEntry && launchReceivable && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400">Bandeira</span>
                          <p className="font-medium text-slate-700">{selectedCardRate.brand}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">Parcelas</span>
                          <p className="font-medium text-slate-700">{installmentCount}x</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">Taxa</span>
                          <p className="font-medium text-red-600">{selectedCardRate.feePercent.toFixed(2)}%</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">Recebimento</span>
                          <p className="font-medium text-slate-700">{selectedCardRate.receivingDays}d/parcela</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400">Bruto</span>
                          <p className="font-medium text-slate-700">{formatBRL(recGross)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">Taxa</span>
                          <p className="font-medium text-red-600">- {formatBRL(feeCents)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">Liquido</span>
                          <p className="font-medium text-green-700">{formatBRL(netAfterFee)}</p>
                        </div>
                      </div>
                      {installmentCount > 1 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <span className="text-[10px] text-slate-400">Previsao de recebimento:</span>
                          <div className="mt-1 space-y-0.5">
                            {Array.from({ length: installmentCount }).map((_, i) => {
                              const parcGross = i < installmentCount - 1
                                ? Math.floor(recGross / installmentCount)
                                : recGross - Math.floor(recGross / installmentCount) * (installmentCount - 1);
                              const parcFee = i < installmentCount - 1
                                ? Math.floor(feeCents / installmentCount)
                                : feeCents - Math.floor(feeCents / installmentCount) * (installmentCount - 1);
                              const days = (i + 1) * selectedCardRate.receivingDays;
                              return (
                                <div key={i} className="flex justify-between text-[10px]">
                                  <span className="text-slate-500">Parcela {i + 1} — {days} dias</span>
                                  <span className="text-slate-700 font-medium">{formatBRL(parcGross - parcFee)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* No entries available */}
              {!recEntry && !payEntry && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs text-slate-500">Nenhum lancamento disponivel para esta OS.</p>
                  <p className="text-[10px] text-slate-400 mt-1">A OS precisa ter cliente e/ou tecnico atribuido.</p>
                </div>
              )}

              {/* All already launched */}
              {recEntry?.alreadyLaunched && payEntry?.alreadyLaunched && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                  <p className="text-xs text-green-700 font-medium">Todos os lancamentos ja foram realizados.</p>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Fechar
          </button>
          <button onClick={handleLaunch} disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
            {submitting ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Lancando...</>
            ) : (
              <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" /></svg>Lancar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
