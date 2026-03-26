"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { CARD_BRANDS, CARD_TYPES } from "@/types/finance";
import type { CardFeeRate } from "@/types/finance";

type FeeFormData = {
  id?: string;
  description: string;
  brand: string;
  type: string;
  installmentFrom: number;
  installmentTo: number;
  feePercent: string;
  receivingDays: string;
};

export default function CardFeeRatesTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<CardFeeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FeeFormData | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CardFeeRate[]>("/finance/card-fee-rates");
      setRates(data);
    } catch {
      toast("Erro ao carregar taxas.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadRates(); }, [loadRates]);

  // Group by brand
  const byBrand = useMemo(() => {
    const map = new Map<string, CardFeeRate[]>();
    for (const r of rates) {
      const brand = r.brand;
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand)!.push(r);
    }
    // Sort within each brand: CREDITO before DEBITO, then by installmentFrom
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.type !== b.type) return a.type === "CREDITO" ? -1 : 1;
        return a.installmentFrom - b.installmentFrom;
      });
    }
    return map;
  }, [rates]);

  function openNew() {
    setForm({
      description: "",
      brand: CARD_BRANDS[0],
      type: "CREDITO",
      installmentFrom: 1,
      installmentTo: 1,
      feePercent: "",
      receivingDays: "30",
    });
  }

  function openEdit(r: CardFeeRate) {
    setForm({
      id: r.id,
      description: r.description || "",
      brand: r.brand,
      type: r.type,
      installmentFrom: r.installmentFrom,
      installmentTo: r.installmentTo,
      feePercent: String(r.feePercent),
      receivingDays: String(r.receivingDays),
    });
  }

  async function save() {
    if (!form) return;
    if (!form.description.trim()) { toast("Informe a descricao.", "error"); return; }
    const fee = parseFloat(form.feePercent);
    if (isNaN(fee) || fee < 0 || fee > 100) { toast("Taxa invalida (0-100).", "error"); return; }
    const days = parseInt(form.receivingDays);
    if (isNaN(days) || days < 0) { toast("Dias de recebimento invalidos.", "error"); return; }

    setSaving(true);
    try {
      if (form.id) {
        await api.patch(`/finance/card-fee-rates/${form.id}`, {
          description: form.description.trim(),
          feePercent: fee,
          receivingDays: days,
        });
        toast("Taxa atualizada!", "success");
      } else {
        await api.post("/finance/card-fee-rates", {
          description: form.description.trim(),
          brand: form.brand,
          type: form.type,
          installmentFrom: form.installmentFrom,
          installmentTo: form.installmentTo,
          feePercent: fee,
          receivingDays: days,
        });
        toast("Taxa criada!", "success");
      }
      setForm(null);
      loadRates();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta taxa?")) return;
    try {
      await api.del(`/finance/card-fee-rates/${id}`);
      toast("Taxa removida.", "success");
      loadRates();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Erro ao remover.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Taxas de Cartao</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure as taxas por bandeira, tipo (credito/debito) e faixa de parcelas.
          </p>
        </div>
        <button onClick={openNew}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
          + Nova Taxa
        </button>
      </div>

      {/* Form */}
      {form && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h5 className="text-xs font-semibold text-blue-800 mb-3">
            {form.id ? "Editar Taxa" : "Nova Taxa"}
          </h5>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Descricao *</label>
              <input type="text" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Visa Credito 1x, Mastercard Debito a vista..."
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Bandeira</label>
                <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                  disabled={!!form.id}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white disabled:bg-slate-100">
                  {CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  disabled={!!form.id}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white disabled:bg-slate-100">
                  {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Parcelas De</label>
                <input type="number" min={1} max={48} value={form.installmentFrom}
                  onChange={e => setForm({ ...form, installmentFrom: parseInt(e.target.value) || 1 })}
                  disabled={!!form.id}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Parcelas Ate</label>
                <input type="number" min={1} max={48} value={form.installmentTo}
                  onChange={e => setForm({ ...form, installmentTo: parseInt(e.target.value) || 1 })}
                  disabled={!!form.id}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Taxa (%)</label>
                <input type="text" inputMode="decimal" value={form.feePercent}
                  onChange={e => setForm({ ...form, feePercent: e.target.value })}
                  placeholder="ex: 2.49"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Dias Receb.</label>
                <input type="number" min={0} value={form.receivingDays}
                  onChange={e => setForm({ ...form, receivingDays: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setForm(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Salvando..." : form.id ? "Atualizar" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhuma taxa cadastrada.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em &quot;+ Nova Taxa&quot; para configurar as taxas de cartao da empresa.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...byBrand.entries()].map(([brand, brandRates]) => (
            <div key={brand}>
              <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                {brand}
              </h5>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Descricao</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Tipo</th>
                      <th className="py-2 px-3 text-center font-medium text-slate-600">Parcelas</th>
                      <th className="py-2 px-3 text-right font-medium text-slate-600">Taxa (%)</th>
                      <th className="py-2 px-3 text-right font-medium text-slate-600">Dias</th>
                      <th className="py-2 px-3 text-center font-medium text-slate-600">Status</th>
                      <th className="py-2 px-3 text-center font-medium text-slate-600">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandRates.map(r => (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-800 font-medium">{r.description || "-"}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.type === "CREDITO"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          }`}>
                            {r.type === "CREDITO" ? "Credito" : "Debito"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700">
                          {r.installmentFrom === r.installmentTo
                            ? `${r.installmentFrom}x`
                            : `${r.installmentFrom}x - ${r.installmentTo}x`}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-800">{r.feePercent.toFixed(2)}%</td>
                        <td className="py-2 px-3 text-right text-slate-600">{r.receivingDays}d</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-block w-2 h-2 rounded-full ${r.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEdit(r)}
                              className="text-blue-600 hover:text-blue-800 font-medium">
                              Editar
                            </button>
                            <button onClick={() => remove(r.id)}
                              className="text-red-500 hover:text-red-700 font-medium">
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
