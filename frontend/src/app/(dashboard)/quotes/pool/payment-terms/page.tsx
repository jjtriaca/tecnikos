"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type Part = {
  label: string;
  percent: number;
  count: number;
  intervalDays: number;
  firstOffsetDays: number;
};
type Term = {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  structure: Part[];
};

const EMPTY_PART: Part = { label: "Parcela", percent: 100, count: 1, intervalDays: 0, firstOffsetDays: 0 };

export default function PoolPaymentTermsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Term | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Term[]>("/pool-payment-terms");
      setItems(r || []);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar formas de pagamento", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Excluir esta forma de pagamento?")) return;
    try {
      await api.del(`/pool-payment-terms/${id}`);
      toast("Forma removida", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  function describe(t: Term): string {
    return t.structure.map((p) => `${p.percent}% ${p.count > 1 ? `${p.count}x` : ""} ${p.label}`).join(" + ");
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Formas de pagamento de obra</h1>
          <p className="text-sm text-slate-600 mt-1">
            Estrutura de parcelas usada nos orcamentos do modulo Piscina. Distinto dos metodos de pagamento financeiros (Pix/Cartao/etc).
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          + Nova forma
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Carregando…</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5">Nome</th>
                <th className="text-left px-4 py-2.5">Estrutura</th>
                <th className="text-center px-3 py-2.5 w-20">Padrao</th>
                <th className="text-center px-3 py-2.5 w-20">Ativa</th>
                <th className="px-3 py-2.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-8">Nenhuma forma cadastrada</td></tr>
              ) : items.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{describe(t)}</td>
                  <td className="px-3 py-2.5 text-center">{t.isDefault ? <span className="text-amber-500">★</span> : ""}</td>
                  <td className="px-3 py-2.5 text-center">{t.isActive ? "✓" : "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => { setEditing(t); setShowForm(true); }}
                      className="text-cyan-600 hover:text-cyan-800 text-xs mr-3">Editar</button>
                    <button onClick={() => remove(t.id)} className="text-red-500 hover:text-red-700 text-xs">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PaymentTermForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function PaymentTermForm({ initial, onClose, onSaved }: {
  initial: Term | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [parts, setParts] = useState<Part[]>(initial?.structure ?? [{ ...EMPTY_PART }]);
  const [saving, setSaving] = useState(false);

  const totalPct = parts.reduce((s, p) => s + (Number(p.percent) || 0), 0);

  function updatePart(idx: number, patch: Partial<Part>) {
    setParts(parts.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function addPart() { setParts([...parts, { ...EMPTY_PART, percent: Math.max(0, 100 - totalPct) }]); }
  function removePart(idx: number) { setParts(parts.filter((_, i) => i !== idx)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Math.abs(totalPct - 100) > 0.001) {
      toast(`Soma dos percents deve ser 100. Atual: ${totalPct.toFixed(2)}`, "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { name, isActive, isDefault, structure: parts };
      if (initial) await api.put(`/pool-payment-terms/${initial.id}`, payload);
      else await api.post("/pool-payment-terms", payload);
      toast(`Forma ${initial ? "atualizada" : "criada"}`, "success");
      onSaved();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{initial ? "Editar" : "Nova"} forma de pagamento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Ex: 33% Entrada + 10x quinzenal"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Marcar como padrao
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Ativa
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Partes da estrutura</label>
              <button type="button" onClick={addPart}
                className="text-xs rounded bg-slate-100 hover:bg-slate-200 px-2 py-1">+ Parte</button>
            </div>
            <div className="space-y-2">
              {parts.map((p, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2 border border-slate-200">
                  <input value={p.label} onChange={(e) => updatePart(idx, { label: e.target.value })}
                    placeholder="Rotulo (ex: Entrada)" className="col-span-3 rounded border border-slate-200 px-2 py-1 text-xs" />
                  <div className="col-span-2 flex items-center gap-1">
                    <input type="number" step="0.01" value={p.percent} onChange={(e) => updatePart(idx, { percent: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right" />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <input type="number" min={1} value={p.count} onChange={(e) => updatePart(idx, { count: parseInt(e.target.value) || 1 })}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right" />
                    <span className="text-xs text-slate-500">x</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <input type="number" min={0} value={p.intervalDays} onChange={(e) => updatePart(idx, { intervalDays: parseInt(e.target.value) || 0 })}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right" />
                    <span className="text-xs text-slate-500">d entre</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <input type="number" min={0} value={p.firstOffsetDays} onChange={(e) => updatePart(idx, { firstOffsetDays: parseInt(e.target.value) || 0 })}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right" />
                    <span className="text-xs text-slate-500">d 1a</span>
                  </div>
                  <button type="button" onClick={() => removePart(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Soma: <span className={Math.abs(totalPct - 100) > 0.001 ? "text-red-600 font-bold" : "text-green-700 font-bold"}>{totalPct.toFixed(2)}%</span>
              {" — "}deve totalizar 100%
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
