"use client";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";

type PostableAccount = { id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } };

type FinancialPreview = {
  type: "RECEIVABLE" | "PAYABLE";
  partnerName: string | null;
  description: string;
  grossCents: number;
  netCents: number;
};

type Props = {
  open: boolean;
  orderId: string;
  score: number;
  comment: string;
  onClose: () => void;
  onApproved: () => void;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function ApprovalConfirmModal({ open, orderId, score, comment, onClose, onApproved }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{
    entries: FinancialPreview[];
    osTitle: string;
    osCode: string;
  } | null>(null);
  const [receivableDue, setReceivableDue] = useState(defaultDueDate());
  const [payableDue, setPayableDue] = useState(defaultDueDate());
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [payableAccountId, setPayableAccountId] = useState("");
  const [postableAccounts, setPostableAccounts] = useState<PostableAccount[]>([]);
  const [error, setError] = useState("");
  const [financialOnApproval, setFinancialOnApproval] = useState(true);

  // Checkboxes for optional financial launch
  const [launchReceivable, setLaunchReceivable] = useState(false);
  const [launchPayable, setLaunchPayable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    Promise.all([
      api.get(`/service-orders/${orderId}/finalize-preview`),
      api.get<PostableAccount[]>("/finance/accounts/postable").catch(() => []),
      api.get<any>("/companies/system-config").catch(() => null),
    ]).then(([data, accounts, cfg]: [any, PostableAccount[], any]) => {
      setPreview(data);
      setReceivableDue(defaultDueDate());
      setPayableDue(defaultDueDate());
      setPostableAccounts(accounts);
      const autoLaunch = cfg?.os?.financialOnApproval !== false;
      setFinancialOnApproval(autoLaunch);
      // Auto-select defaults: 1100 = Receita de Servicos, 2100 = Mao de Obra
      const recDefault = accounts.find(a => a.code === "1100");
      const payDefault = accounts.find(a => a.code === "2100");
      setReceivableAccountId(recDefault?.id || "");
      setPayableAccountId(payDefault?.id || "");
      // If optional mode, auto-check available entries
      if (!autoLaunch) {
        const recEntry = data?.entries?.find((e: any) => e.type === "RECEIVABLE" && e.grossCents > 0);
        const payEntry = data?.entries?.find((e: any) => e.type === "PAYABLE" && e.netCents > 0);
        setLaunchReceivable(!!recEntry);
        setLaunchPayable(!!payEntry);
      }
    }).catch((err: any) => {
      setError(err?.message || "Erro ao carregar preview");
    }).finally(() => setLoading(false));
  }, [open, orderId]);

  if (!open) return null;

  const recEntry = preview?.entries?.find(e => e.type === "RECEIVABLE");
  const payEntryRaw = preview?.entries?.find(e => e.type === "PAYABLE");
  // Hide payable with zero value
  const payEntry = payEntryRaw && payEntryRaw.netCents > 0 ? payEntryRaw : null;
  const noFinancial = !recEntry && !payEntry;

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const body: any = {
        score,
        comment: comment || undefined,
      };

      if (financialOnApproval) {
        // Auto-launch: always send due dates/accounts
        body.receivableDueDate = receivableDue || undefined;
        body.payableDueDate = payableDue || undefined;
        body.receivableAccountId = receivableAccountId || undefined;
        body.payableAccountId = payableAccountId || undefined;
      } else {
        // Optional: send skipFinancial flag or selective launch flags
        body.skipReceivable = !launchReceivable;
        body.skipPayable = !launchPayable;
        if (launchReceivable) {
          body.receivableDueDate = receivableDue || undefined;
          body.receivableAccountId = receivableAccountId || undefined;
        }
        if (launchPayable) {
          body.payableDueDate = payableDue || undefined;
          body.payableAccountId = payableAccountId || undefined;
        }
      }

      await api.post(`/service-orders/${orderId}/approve-and-finalize`, body);
      onApproved();
    } catch (err: any) {
      setError(err?.message || "Erro ao aprovar");
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
        className="text-xs border border-slate-200 rounded px-2 py-0.5 bg-white focus:outline-none focus:border-blue-300 flex-1">
        <option value="">Sem categoria</option>
        {Array.from(grouped.entries()).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </optgroup>
        ))}
      </select>
    );
  }

  function renderEntry(entry: FinancialPreview, isOptional: boolean, checked: boolean, onCheck: (v: boolean) => void, dueValue: string, onDueChange: (v: string) => void, accountValue: string, onAccountChange: (v: string) => void) {
    const isRec = entry.type === "RECEIVABLE";
    const colorBorder = isRec ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50";
    const colorBorderChecked = isRec ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50";
    const colorBorderUnchecked = "border-slate-200 bg-white";
    const displayValue = isRec ? entry.grossCents : entry.netCents;

    return (
      <div className={`rounded-lg border p-3 transition-colors ${
        isOptional
          ? (checked ? colorBorderChecked : colorBorderUnchecked)
          : colorBorder
      }`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {isOptional ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)}
                  className={`rounded border-slate-300 ${isRec ? "text-green-600 focus:ring-green-500" : "text-blue-600 focus:ring-blue-500"}`} />
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  isRec ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {isRec ? "A Receber" : "A Pagar"}
                </span>
              </label>
            ) : (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isRec ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}>
                {isRec ? "A Receber" : "A Pagar"}
              </span>
            )}
            <span className="text-xs text-slate-600">{entry.partnerName}</span>
          </div>
          <span className="text-sm font-semibold text-slate-800">{formatBRL(displayValue)}</span>
        </div>
        {/* Due date + Category — show when checked (optional) or always (auto) */}
        {(!isOptional || checked) && (
          <div className="flex flex-col gap-1.5 mt-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 w-10">Venc:</label>
              <input type="date" value={dueValue} onChange={e => onDueChange(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-0.5 bg-white focus:outline-none focus:border-blue-300 flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 w-10">Categ:</label>
              {renderAccountSelect(accountValue, onAccountChange)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">Confirmar Aprovação</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Score */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} className={`h-5 w-5 ${s <= score ? "text-yellow-400" : "text-slate-200"}`}
                  fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-medium text-slate-600">{score}/5</span>
          </div>
          {comment && (
            <p className="text-xs text-slate-500 italic">&ldquo;{comment}&rdquo;</p>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Calculando...</p>
            </div>
          )}

          {/* Financial Preview */}
          {preview && !loading && (
            <>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Lançamentos Financeiros
                  {!financialOnApproval && (
                    <span className="ml-1 text-amber-500 normal-case font-normal">(opcional — marque os que deseja lançar)</span>
                  )}
                </p>

                {noFinancial ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Nenhum lançamento (serviço sem valor)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recEntry && recEntry.grossCents > 0 && renderEntry(
                      recEntry,
                      !financialOnApproval,
                      financialOnApproval ? true : launchReceivable,
                      setLaunchReceivable,
                      receivableDue,
                      setReceivableDue,
                      receivableAccountId,
                      setReceivableAccountId,
                    )}
                    {payEntry && renderEntry(
                      payEntry,
                      !financialOnApproval,
                      financialOnApproval ? true : launchPayable,
                      setLaunchPayable,
                      payableDue,
                      setPayableDue,
                      payableAccountId,
                      setPayableAccountId,
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={submitting || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
            {submitting ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Aprovando...</>
            ) : "Confirmar Aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}
