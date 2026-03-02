"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ===================================================================
   RENEGOTIATION MODAL — Cancel current entry and create a new one
   with updated terms (installments, interest, penalties)
   =================================================================== */

interface Props {
  entryId: string;
  entryDescription?: string;
  entryNetCents: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** Format a number as BRL currency string (e.g. "1.234,56") */
function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Parse a pt-BR currency string ("1.234,56") to cents */
function parseCurrencyToCents(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export default function RenegotiationModal({
  entryId,
  entryDescription,
  entryNetCents,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { toast } = useToast();

  // Form state
  const [newAmount, setNewAmount] = useState(() => formatBRL(entryNetCents / 100));
  const [installment, setInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [intervalDays, setIntervalDays] = useState(30);
  const [interestType, setInterestType] = useState<"SIMPLE" | "COMPOUND">("SIMPLE");
  const [interestRate, setInterestRate] = useState("");
  const [penaltyPercent, setPenaltyPercent] = useState("");
  const [penaltyFixed, setPenaltyFixed] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newAmountCents = parseCurrencyToCents(newAmount);
    if (newAmountCents <= 0) {
      toast("Informe um valor válido", "error");
      return;
    }

    if (installment && installmentCount < 2) {
      toast("A quantidade de parcelas deve ser no mínimo 2", "error");
      return;
    }

    if (installment && !firstDueDate) {
      toast("Informe a data da 1ª parcela", "error");
      return;
    }

    const body: Record<string, unknown> = {
      newAmountCents,
    };

    if (installment) {
      body.installmentCount = installmentCount;
      body.firstDueDate = firstDueDate;
      body.intervalDays = intervalDays;
    }

    const rate = interestRate ? Number(interestRate.replace(",", ".")) : undefined;
    if (rate !== undefined && !isNaN(rate) && rate > 0) {
      body.interestRateMonthly = rate;
      body.interestType = interestType;
    }

    const pPercent = penaltyPercent ? Number(penaltyPercent.replace(",", ".")) : undefined;
    if (pPercent !== undefined && !isNaN(pPercent) && pPercent > 0) {
      body.penaltyPercent = pPercent;
    }

    const pFixedCents = penaltyFixed ? parseCurrencyToCents(penaltyFixed) : undefined;
    if (pFixedCents !== undefined && pFixedCents > 0) {
      body.penaltyFixedCents = pFixedCents;
    }

    if (notes.trim()) {
      body.notes = notes.trim();
    }

    try {
      setSubmitting(true);
      await api.post(`/finance/entries/${entryId}/renegotiate`, body);
      toast("Renegociação realizada com sucesso", "success");
      onSuccess();
      onClose();
    } catch {
      toast("Erro ao renegociar lançamento", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* Shared input class */
  const inputClass =
    "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 truncate pr-4">
            Renegociar &mdash; {entryDescription || "Lançamento"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <svg
              className="h-5 w-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning banner */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 shrink-0 mt-0.5 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span>
                A renegociação cancela o lançamento atual e cria um novo com as condições
                definidas abaixo.
              </span>
            </div>
          </div>

          {/* Novo valor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Novo valor (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0,00"
              className={inputClass}
              required
            />
          </div>

          {/* Parcelar toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={installment}
              onChange={(e) => setInstallment(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-slate-700">Parcelar?</span>
          </label>

          {/* Installment fields */}
          {installment && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantidade de parcelas
                </label>
                <input
                  type="number"
                  min={2}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data da 1ª parcela
                </label>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Intervalo (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Tipo de juros */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tipo de juros
            </label>
            <select
              value={interestType}
              onChange={(e) => setInterestType(e.target.value as "SIMPLE" | "COMPOUND")}
              className={inputClass}
            >
              <option value="SIMPLE">Simples</option>
              <option value="COMPOUND">Composto</option>
            </select>
          </div>

          {/* Taxa de juros mensal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Taxa de juros mensal (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          {/* Multa por atraso */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Multa por atraso (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={penaltyPercent}
              onChange={(e) => setPenaltyPercent(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          {/* Multa fixa */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Multa fixa (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={penaltyFixed}
              onChange={(e) => setPenaltyFixed(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalhes sobre a renegociação..."
              className={inputClass + " resize-none"}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Renegociando..." : "Renegociar"}
          </button>
        </div>
      </div>
    </div>
  );
}
