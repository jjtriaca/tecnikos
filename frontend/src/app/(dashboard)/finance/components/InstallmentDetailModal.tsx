"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { FinancialInstallment, InstallmentStatus } from "@/types/finance";
import { INSTALLMENT_STATUS_CONFIG } from "@/types/finance";

/* ═══════════════════════════════════════════════════════════════
   INSTALLMENT DETAIL MODAL — View & manage installments
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  entryId: string;
  entryDescription?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatCents(cents: number): string { return currencyFmt.format(cents / 100); }
function formatDate(iso: string): string { return dateFmt.format(new Date(iso)); }
function toInputDate(iso: string): string { return new Date(iso).toISOString().slice(0, 10); }

/* ── Dropdown menu (portal) ── */
function ActionMenu({ children, items }: { children: React.ReactNode; items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(!open);
  };

  return (
    <>
      <button ref={btnRef} onClick={toggle} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
        <svg className="h-4 w-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && typeof document !== "undefined" && (
        <div ref={ref} className="fixed z-[100] min-w-[140px] bg-white rounded-xl shadow-lg border border-slate-200 py-1" style={{ top: pos.top, left: pos.left }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { setOpen(false); item.onClick(); }}
              className={`block w-full px-4 py-2 text-left text-sm ${item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function InstallmentDetailModal({ entryId, entryDescription, open, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [installments, setInstallments] = useState<FinancialInstallment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline action state
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"pay" | "cancel" | "editDate" | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [editDate, setEditDate] = useState("");

  const fetchInstallments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<FinancialInstallment[]>(`/finance/entries/${entryId}/installments`);
      setInstallments(data);
    } catch { toast("Erro ao carregar parcelas", "error"); }
    finally { setLoading(false); }
  }, [entryId, toast]);

  useEffect(() => {
    if (open && entryId) {
      fetchInstallments();
      setActionId(null);
      setActionType(null);
    }
  }, [open, entryId, fetchInstallments]);

  const resetAction = () => { setActionId(null); setActionType(null); };

  const startPay = (inst: FinancialInstallment) => {
    resetAction();
    setActionId(inst.id);
    setActionType("pay");
    setPayAmount((inst.totalCents / 100).toFixed(2).replace(".", ","));
    setPayNotes("");
  };

  const startCancel = (inst: FinancialInstallment) => {
    resetAction();
    setActionId(inst.id);
    setActionType("cancel");
    setPayNotes("");
  };

  const startEditDate = (inst: FinancialInstallment) => {
    resetAction();
    setActionId(inst.id);
    setActionType("editDate");
    setEditDate(toInputDate(inst.dueDate));
  };

  const confirmPay = async () => {
    if (!actionId) return;
    const normalized = payAmount.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed <= 0) { toast("Valor invalido", "error"); return; }
    try {
      setSubmitting(true);
      await api.patch(`/finance/installments/${actionId}/pay`, { paidAmountCents: Math.round(parsed * 100), notes: payNotes || undefined });
      toast("Parcela baixada!", "success");
      resetAction();
      await fetchInstallments();
      onSuccess();
    } catch { toast("Erro ao baixar parcela", "error"); }
    finally { setSubmitting(false); }
  };

  const confirmCancel = async () => {
    if (!actionId) return;
    try {
      setSubmitting(true);
      await api.patch(`/finance/installments/${actionId}/cancel`, { notes: payNotes || undefined });
      toast("Parcela cancelada", "success");
      resetAction();
      await fetchInstallments();
      onSuccess();
    } catch { toast("Erro ao cancelar", "error"); }
    finally { setSubmitting(false); }
  };

  const confirmEditDate = async () => {
    if (!actionId || !editDate) return;
    try {
      setSubmitting(true);
      await api.patch(`/finance/installments/${actionId}`, { dueDate: editDate });
      toast("Data atualizada!", "success");
      resetAction();
      await fetchInstallments();
      onSuccess();
    } catch { toast("Erro ao atualizar data", "error"); }
    finally { setSubmitting(false); }
  };

  const totals = installments.reduce(
    (acc, inst) => ({
      amountCents: acc.amountCents + inst.amountCents,
      interestCents: acc.interestCents + inst.interestCents,
      penaltyCents: acc.penaltyCents + inst.penaltyCents,
      totalCents: acc.totalCents + inst.totalCents,
    }),
    { amountCents: 0, interestCents: 0, penaltyCents: 0, totalCents: 0 },
  );

  const canAct = (status: InstallmentStatus) => status === "PENDING" || status === "OVERDUE";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              Parcelas{entryDescription ? ` \u2014 ${entryDescription}` : ""}
            </h2>
            <p className="text-sm text-slate-500">{installments.length} parcela{installments.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : installments.length === 0 ? (
            <div className="text-center py-16"><p className="text-sm text-slate-400">Nenhuma parcela encontrada</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-3 w-10">Ações</th>
                  <th className="px-3 py-3 w-8">#</th>
                  <th className="px-3 py-3">Vencimento</th>
                  <th className="px-3 py-3 text-right">Valor Original</th>
                  <th className="px-3 py-3 text-right">Juros</th>
                  <th className="px-3 py-3 text-right">Multa</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {installments.map((inst) => {
                  const cfg = INSTALLMENT_STATUS_CONFIG[inst.status];
                  const isActive = actionId === inst.id;

                  return (
                    <>
                      <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Ações (primeira coluna) */}
                        <td className="px-3 py-3">
                          {canAct(inst.status) ? (
                            <ActionMenu items={[
                              { label: "Baixar", onClick: () => startPay(inst) },
                              { label: "Editar data", onClick: () => startEditDate(inst) },
                              { label: "Cancelar", onClick: () => startCancel(inst), danger: true },
                            ]} children={null} />
                          ) : (
                            <span className="text-xs text-slate-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700">{inst.installmentNumber}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDate(inst.dueDate)}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{formatCents(inst.amountCents)}</td>
                        <td className={`px-3 py-3 text-right ${inst.interestCents > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCents(inst.interestCents)}</td>
                        <td className={`px-3 py-3 text-right ${inst.penaltyCents > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCents(inst.penaltyCents)}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900">{formatCents(inst.totalCents)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>

                      {/* Inline action row */}
                      {isActive && actionType === "pay" && (
                        <tr key={`${inst.id}_pay`} className="bg-green-50/50">
                          <td colSpan={8} className="px-6 py-3">
                            <div className="flex items-end gap-3">
                              <div className="flex-1 max-w-[160px]">
                                <label className="text-xs text-slate-500 mb-1 block">Valor pago</label>
                                <input type="text" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                              </div>
                              <div className="flex-1 max-w-[200px]">
                                <label className="text-xs text-slate-500 mb-1 block">Obs. (opcional)</label>
                                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                              </div>
                              <button onClick={confirmPay} disabled={submitting}
                                className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                                {submitting ? "..." : "Confirmar"}
                              </button>
                              <button onClick={resetAction} disabled={submitting}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {isActive && actionType === "editDate" && (
                        <tr key={`${inst.id}_edit`} className="bg-blue-50/50">
                          <td colSpan={8} className="px-6 py-3">
                            <div className="flex items-end gap-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Nova data de vencimento</label>
                                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                                  className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                              </div>
                              <button onClick={confirmEditDate} disabled={submitting}
                                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {submitting ? "..." : "Salvar"}
                              </button>
                              <button onClick={resetAction} disabled={submitting}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {isActive && actionType === "cancel" && (
                        <tr key={`${inst.id}_cancel`} className="bg-red-50/50">
                          <td colSpan={8} className="px-6 py-3">
                            <div className="flex items-end gap-3">
                              <div className="flex-1 max-w-[250px]">
                                <label className="text-xs text-slate-500 mb-1 block">Motivo (opcional)</label>
                                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
                              </div>
                              <button onClick={confirmCancel} disabled={submitting}
                                className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
                                {submitting ? "..." : "Confirmar cancelamento"}
                              </button>
                              <button onClick={resetAction} disabled={submitting}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Voltar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {/* Summary Footer Row */}
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                  <td className="px-3 py-3 text-slate-700" colSpan={3}>Total</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatCents(totals.amountCents)}</td>
                  <td className={`px-3 py-3 text-right ${totals.interestCents > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCents(totals.interestCents)}</td>
                  <td className={`px-3 py-3 text-right ${totals.penaltyCents > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCents(totals.penaltyCents)}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900">{formatCents(totals.totalCents)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
