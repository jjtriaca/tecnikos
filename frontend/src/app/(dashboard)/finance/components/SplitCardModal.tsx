"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ── Types ──────────────────────────────────────────────── */

interface Props {
  entryId: string;
  entryNetCents: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanRow {
  parcela: number;
  valorCents: number;
  cardBillingDate: string; // ISO
}

interface DryRunResult {
  dryRun: true;
  paiCode: string;
  paiNetCents: number;
  cashAccountId: string;
  saldoNetCents: number;
  parcelas: PlanRow[];
}

/* ── Helpers ────────────────────────────────────────────── */

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtFatura(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/* ── Component ──────────────────────────────────────────── */

export default function SplitCardModal({
  entryId,
  entryNetCents,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [count, setCount] = useState(2);
  const [plan, setPlan] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(
    async (n: number) => {
      if (n < 2) {
        setPlan(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<DryRunResult>(`/finance/entries/${entryId}/split-card`, {
          count: n,
          dryRun: true,
        });
        setPlan(res);
      } catch (err: any) {
        setError(err?.message || "Nao foi possivel simular a divisao.");
        setPlan(null);
      } finally {
        setLoading(false);
      }
    },
    [entryId],
  );

  useEffect(() => {
    if (open) {
      setCount(2);
      loadPreview(2);
    } else {
      setPlan(null);
      setError(null);
    }
  }, [open, loadPreview]);

  function changeCount(n: number) {
    const v = Math.max(2, Math.min(36, n || 2));
    setCount(v);
    loadPreview(v);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      await api.post(`/finance/entries/${entryId}/split-card`, { count });
      toast(`Lancamento dividido em ${count} parcelas de cartao.`, "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err?.message || "Erro ao dividir o lancamento.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const total = plan ? plan.parcelas.reduce((s, p) => s + p.valorCents, 0) : 0;
  const saldoOk = plan ? plan.saldoNetCents === 0 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Dividir em parcelas de cartao</h3>
        <p className="text-sm text-slate-600 mb-1">Valor total: {fmtBRL(entryNetCents)}</p>
        <p className="text-xs text-slate-500 mb-4">
          Cria 1 lancamento PAGO por ciclo de fatura (cada parcela cai na fatura certa para
          conciliacao). O valor total e o saldo NAO mudam — so a distribuicao por fatura. O
          lancamento original vira &quot;Dividido&quot; e sai dos relatorios.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Numero de parcelas *
          </label>
          <input
            type="number"
            min={2}
            max={36}
            value={count}
            onChange={(e) => changeCount(parseInt(e.target.value) || 2)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {loading && <p className="text-sm text-slate-500">Simulando...</p>}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {plan && !loading && (
          <div>
            <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Previa</h4>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">
                        Parcela
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">
                        Fatura (ciclo)
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.parcelas.map((p) => (
                      <tr key={p.parcela} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-2 px-3 text-slate-700">
                          {p.parcela}/{plan.parcelas.length}
                        </td>
                        <td className="py-2 px-3 text-slate-700">{fmtFatura(p.cardBillingDate)}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {fmtBRL(p.valorCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border-t border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">
                  Total ({plan.parcelas.length} parcelas)
                </span>
                <span className="text-sm font-bold text-slate-900">{fmtBRL(total)}</span>
              </div>
            </div>

            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                saldoOk
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {saldoOk
                ? "Impacto no saldo: R$ 0,00 (inalterado). Divisao segura."
                : `ATENCAO: impacto no saldo de ${fmtBRL(
                    plan.saldoNetCents,
                  )} — divisao bloqueada por seguranca.`}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || loading || !plan || !saldoOk}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Dividindo..." : "Confirmar divisao"}
          </button>
        </div>
      </div>
    </div>
  );
}
