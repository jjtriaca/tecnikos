"use client";

import { useCallback, useEffect, useState } from "react";
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

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCents(cents: number): string {
  return currencyFmt.format(cents / 100);
}

function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export default function InstallmentDetailModal({
  entryId,
  entryDescription,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [installments, setInstallments] = useState<FinancialInstallment[]>([]);
  const [loading, setLoading] = useState(false);

  // Inline pay state: which installment id is being paid
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Cancel confirmation state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");

  const fetchInstallments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<FinancialInstallment[]>(
        `/finance/entries/${entryId}/installments`,
      );
      setInstallments(data);
    } catch {
      toast("Erro ao carregar parcelas", "error");
    } finally {
      setLoading(false);
    }
  }, [entryId, toast]);

  useEffect(() => {
    if (open && entryId) {
      fetchInstallments();
      // Reset inline states when reopening
      setPayingId(null);
      setCancellingId(null);
    }
  }, [open, entryId, fetchInstallments]);

  /* ── Pay handler ─────────────────────────────────────── */
  const startPay = (inst: FinancialInstallment) => {
    setCancellingId(null);
    setPayingId(inst.id);
    setPayAmount((inst.totalCents / 100).toFixed(2).replace(".", ","));
    setPayNotes("");
  };

  const confirmPay = async () => {
    if (!payingId) return;

    // Parse "1.234,56" or "1234,56" or "1234.56"
    const normalized = payAmount.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed <= 0) {
      toast("Valor inválido", "error");
      return;
    }

    const paidAmountCents = Math.round(parsed * 100);

    try {
      setSubmitting(true);
      await api.patch(`/finance/installments/${payingId}/pay`, {
        paidAmountCents,
        notes: payNotes || undefined,
      });
      toast("Parcela baixada com sucesso", "success");
      setPayingId(null);
      await fetchInstallments();
      onSuccess();
    } catch {
      toast("Erro ao baixar parcela", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Cancel handler ──────────────────────────────────── */
  const startCancel = (inst: FinancialInstallment) => {
    setPayingId(null);
    setCancellingId(inst.id);
    setCancelNotes("");
  };

  const confirmCancel = async () => {
    if (!cancellingId) return;

    try {
      setSubmitting(true);
      await api.patch(`/finance/installments/${cancellingId}/cancel`, {
        notes: cancelNotes || undefined,
      });
      toast("Parcela cancelada", "success");
      setCancellingId(null);
      await fetchInstallments();
      onSuccess();
    } catch {
      toast("Erro ao cancelar parcela", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Summary totals ──────────────────────────────────── */
  const totals = installments.reduce(
    (acc, inst) => ({
      amountCents: acc.amountCents + inst.amountCents,
      interestCents: acc.interestCents + inst.interestCents,
      penaltyCents: acc.penaltyCents + inst.penaltyCents,
      totalCents: acc.totalCents + inst.totalCents,
    }),
    { amountCents: 0, interestCents: 0, penaltyCents: 0, totalCents: 0 },
  );

  const canAct = (status: InstallmentStatus) =>
    status === "PENDING" || status === "OVERDUE";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              Parcelas{entryDescription ? ` \u2014 ${entryDescription}` : ""}
            </h2>
            <p className="text-sm text-slate-500">
              {installments.length} parcela{installments.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg
              className="h-5 w-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : installments.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-slate-400">
                Nenhuma parcela encontrada
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor Original</th>
                  <th className="px-4 py-3 text-right">Juros</th>
                  <th className="px-4 py-3 text-right">Multa</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {installments.map((inst) => {
                  const cfg = INSTALLMENT_STATUS_CONFIG[inst.status];
                  const isPaying = payingId === inst.id;
                  const isCancelling = cancellingId === inst.id;

                  return (
                    <tr
                      key={inst.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* # */}
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {inst.installmentNumber}
                      </td>

                      {/* Vencimento */}
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(inst.dueDate)}
                      </td>

                      {/* Valor Original */}
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCents(inst.amountCents)}
                      </td>

                      {/* Juros */}
                      <td
                        className={`px-4 py-3 text-right ${
                          inst.interestCents > 0
                            ? "text-red-600"
                            : "text-slate-400"
                        }`}
                      >
                        {formatCents(inst.interestCents)}
                      </td>

                      {/* Multa */}
                      <td
                        className={`px-4 py-3 text-right ${
                          inst.penaltyCents > 0
                            ? "text-red-600"
                            : "text-slate-400"
                        }`}
                      >
                        {formatCents(inst.penaltyCents)}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatCents(inst.totalCents)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}
                        >
                          {cfg.label}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        {canAct(inst.status) ? (
                          <div className="flex flex-col items-center gap-1">
                            {/* ── Inline Pay ─── */}
                            {isPaying ? (
                              <div className="flex flex-col gap-1.5 w-full min-w-[180px]">
                                <input
                                  type="text"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  placeholder="Valor pago"
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                                <input
                                  type="text"
                                  value={payNotes}
                                  onChange={(e) => setPayNotes(e.target.value)}
                                  placeholder="Obs. (opcional)"
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={confirmPay}
                                    disabled={submitting}
                                    className="flex-1 px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                                  >
                                    {submitting ? "..." : "Confirmar"}
                                  </button>
                                  <button
                                    onClick={() => setPayingId(null)}
                                    disabled={submitting}
                                    className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : isCancelling ? (
                              /* ── Inline Cancel Confirm ─── */
                              <div className="flex flex-col gap-1.5 w-full min-w-[180px]">
                                <input
                                  type="text"
                                  value={cancelNotes}
                                  onChange={(e) =>
                                    setCancelNotes(e.target.value)
                                  }
                                  placeholder="Motivo (opcional)"
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={confirmCancel}
                                    disabled={submitting}
                                    className="flex-1 px-2 py-1 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                                  >
                                    {submitting ? "..." : "Confirmar"}
                                  </button>
                                  <button
                                    onClick={() => setCancellingId(null)}
                                    disabled={submitting}
                                    className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                  >
                                    Voltar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Action Buttons ─── */
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startPay(inst)}
                                  className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                                >
                                  Baixar
                                </button>
                                <button
                                  onClick={() => startCancel(inst)}
                                  className="px-3 py-1 text-red-600 text-xs font-medium hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* ── Summary Footer Row ─────────────────── */}
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-slate-700" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCents(totals.amountCents)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      totals.interestCents > 0
                        ? "text-red-600"
                        : "text-slate-400"
                    }`}
                  >
                    {formatCents(totals.interestCents)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      totals.penaltyCents > 0
                        ? "text-red-600"
                        : "text-slate-400"
                    }`}
                  >
                    {formatCents(totals.penaltyCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {formatCents(totals.totalCents)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
