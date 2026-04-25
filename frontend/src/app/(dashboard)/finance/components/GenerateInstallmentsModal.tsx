"use client";

import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { fmtCurrency, fmtPercent } from "@/components/ui/CurrencyInput";

/* ── Types ──────────────────────────────────────────────── */

interface Props {
  entryId: string;
  entryNetCents: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type InterestType = "SIMPLE" | "COMPOUND";

interface FormState {
  count: number;
  firstDueDate: string;
  intervalDays: number;
  interestType: InterestType;
  interestRateMonthly: string;
  penaltyPercent: string;
  penaltyFixedCents: string;
}

interface PreviewRow {
  number: number;
  dueDate: string;
  valueCents: number;
}

/* ── Helpers ────────────────────────────────────────────── */

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ── Component ──────────────────────────────────────────── */

export default function GenerateInstallmentsModal({
  entryId,
  entryNetCents,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    count: 2,
    firstDueDate: todayISO(),
    intervalDays: 30,
    interestType: "SIMPLE",
    interestRateMonthly: "",
    penaltyPercent: "",
    penaltyFixedCents: "",
  });

  /* ── Preview calculation ───────────────────────────────── */

  const preview = useMemo<PreviewRow[]>(() => {
    if (!form.firstDueDate || form.count < 2) return [];

    const installmentCentsBase = Math.floor(entryNetCents / form.count);
    const remainder = entryNetCents - installmentCentsBase * form.count;

    const rows: PreviewRow[] = [];
    for (let i = 0; i < form.count; i++) {
      const dueDate = addDays(form.firstDueDate, i * form.intervalDays);
      // Put the remainder (cents rounding difference) in the last installment
      const valueCents = i === form.count - 1
        ? installmentCentsBase + remainder
        : installmentCentsBase;
      rows.push({ number: i + 1, dueDate, valueCents });
    }
    return rows;
  }, [form.count, form.firstDueDate, form.intervalDays, entryNetCents]);

  const previewTotal = preview.reduce((sum, r) => sum + r.valueCents, 0);

  /* ── Field updaters ────────────────────────────────────── */

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ── Submit ────────────────────────────────────────────── */

  async function handleSubmit() {
    if (form.count < 2 || form.count > 60) {
      toast("Quantidade de parcelas deve ser entre 2 e 60.", "error");
      return;
    }
    if (!form.firstDueDate) {
      toast("Informe a data da 1a parcela.", "error");
      return;
    }
    if (form.intervalDays < 1) {
      toast("Intervalo deve ser pelo menos 1 dia.", "error");
      return;
    }

    const interestRate = form.interestRateMonthly
      ? parseFloat(form.interestRateMonthly.replace(",", "."))
      : undefined;
    const penaltyPct = form.penaltyPercent
      ? parseFloat(form.penaltyPercent.replace(",", "."))
      : undefined;
    const penaltyFixed = form.penaltyFixedCents
      ? Math.round(parseFloat(form.penaltyFixedCents.replace(",", ".")) * 100)
      : undefined;

    setSaving(true);
    try {
      await api.post(`/finance/entries/${entryId}/installments`, {
        count: form.count,
        firstDueDate: form.firstDueDate,
        intervalDays: form.intervalDays,
        interestType: form.interestType,
        interestRateMonthly: interestRate,
        penaltyPercent: penaltyPct,
        penaltyFixedCents: penaltyFixed,
      });
      toast("Parcelas geradas com sucesso!", "success");
      onSuccess();
      onClose();
    } catch {
      toast("Erro ao gerar parcelas.", "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ────────────────────────────────────────────── */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          Gerar Parcelas
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Valor total: {formatCurrency(entryNetCents)}
        </p>

        {/* ── Form Fields ────────────────────────────────── */}
        <div className="space-y-3">
          {/* Quantidade de parcelas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Quantidade de parcelas *
            </label>
            <input
              type="number"
              min={2}
              max={60}
              value={form.count}
              onChange={(e) => setField("count", Math.max(1, parseInt(e.target.value) || 2))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Data da 1a parcela */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Data da 1a parcela *
            </label>
            <input
              type="date"
              value={form.firstDueDate}
              onChange={(e) => setField("firstDueDate", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Intervalo (dias) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Intervalo (dias)
            </label>
            <input
              type="number"
              min={1}
              value={form.intervalDays}
              onChange={(e) => setField("intervalDays", Math.max(1, parseInt(e.target.value) || 30))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Tipo de juros */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tipo de juros
            </label>
            <select
              value={form.interestType}
              onChange={(e) => setField("interestType", e.target.value as InterestType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="SIMPLE">Simples</option>
              <option value="COMPOUND">Composto</option>
            </select>
          </div>

          {/* Taxa de juros mensal */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Taxa de juros mensal (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.interestRateMonthly}
              onChange={(e) => setField("interestRateMonthly", e.target.value)}
              onBlur={(e) => setField("interestRateMonthly", fmtPercent(e.target.value))}
              placeholder="Ex: 1,5"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Multa por atraso (%) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Multa por atraso (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.penaltyPercent}
              onChange={(e) => setField("penaltyPercent", e.target.value)}
              onBlur={(e) => setField("penaltyPercent", fmtPercent(e.target.value))}
              placeholder="Ex: 2,0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Multa fixa (R$) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Multa fixa (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.penaltyFixedCents}
              onChange={(e) => setField("penaltyFixedCents", e.target.value)}
              onBlur={(e) => setField("penaltyFixedCents", fmtCurrency(e.target.value))}
              placeholder="Ex: 10,00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* ── Preview Table ──────────────────────────────── */}
        {preview.length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">
              Previa das Parcelas
            </h4>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">
                        N.
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">
                        Vencimento
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr
                        key={row.number}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="py-2 px-3 text-slate-700">
                          {row.number}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {formatDateBR(row.dueDate)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {formatCurrency(row.valueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border-t border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">
                  Total ({preview.length} parcelas)
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(previewTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Buttons ────────────────────────────────────── */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Gerando..." : "Gerar Parcelas"}
          </button>
        </div>
      </div>
    </div>
  );
}
