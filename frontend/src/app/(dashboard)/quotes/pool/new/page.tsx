"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type Partner = { id: string; name: string; document?: string | null };
type Template = { id: string; name: string; isDefault: boolean };
type Layout = { id: string; name: string; isDefault: boolean };

export default function NewPoolBudgetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientPartnerId: "",
    templateId: "",
    printLayoutId: "",
    title: "",
    description: "",
    notes: "",
    termsConditions: "",
    validityDays: 30,
    discountCents: 0,
    discountPercent: 0,
    // Pool dimensions
    length: 8,
    width: 4,
    depth: 1.5,
    type: "ALVENARIA",
    hasSpa: false,
    hasCascata: false,
    hasAquecimentoSolar: false,
    // Environment
    temperatura: 28,
    capaTermica: false,
    tipoConstrucao: "ALVENARIA",
    regiaoSolar: "MT",
  });

  useEffect(() => {
    Promise.all([
      api.get<{ data: Partner[] }>("/partners?limit=200&type=CLIENTE").catch(() => ({ data: [] as Partner[] })),
      api.get<{ data: Template[] }>("/pool-budget-templates?limit=100").catch(() => ({ data: [] as Template[] })),
      api.get<{ data: Layout[] }>("/pool-print-layouts?limit=100").catch(() => ({ data: [] as Layout[] })),
    ]).then(([p, t, l]) => {
      setPartners(p.data || []);
      setTemplates(t.data || []);
      setLayouts(l.data || []);
      const dt = t.data?.find((x: Template) => x.isDefault);
      const dl = l.data?.find((x: Layout) => x.isDefault);
      if (dt) setForm((f) => ({ ...f, templateId: dt.id }));
      if (dl) setForm((f) => ({ ...f, printLayoutId: dl.id }));
    });
  }, []);

  const computedArea = form.length * form.width;
  const computedPerimeter = 2 * (form.length + form.width);
  const computedVolume = form.length * form.width * form.depth;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientPartnerId || !form.title) {
      toast("Cliente e titulo sao obrigatorios", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientPartnerId: form.clientPartnerId,
        templateId: form.templateId || undefined,
        printLayoutId: form.printLayoutId || undefined,
        title: form.title,
        description: form.description || undefined,
        notes: form.notes || undefined,
        termsConditions: form.termsConditions || undefined,
        validityDays: form.validityDays,
        discountCents: form.discountCents || undefined,
        discountPercent: form.discountPercent || undefined,
        poolDimensions: {
          length: form.length,
          width: form.width,
          depth: form.depth,
          area: computedArea,
          perimeter: computedPerimeter,
          volume: computedVolume,
          type: form.type,
          hasSpa: form.hasSpa,
          hasCascata: form.hasCascata,
          hasAquecimentoSolar: form.hasAquecimentoSolar,
        },
        environmentParams: {
          temperatura: form.temperatura,
          capaTermica: form.capaTermica,
          tipoConstrucao: form.tipoConstrucao,
          regiaoSolar: form.regiaoSolar,
        },
      };
      const created: { id: string } = await api.post("/pool-budgets", payload);
      toast("Orcamento criado!", "success");
      router.push(`/quotes/pool/${created.id}`);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao criar orcamento", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200";

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/quotes?tab=obras" className="text-xs text-slate-500 hover:text-slate-700">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Novo Orcamento de Obra</h1>
          <p className="mt-1 text-sm text-slate-500">
            Define cliente, dimensoes da piscina e (opcionalmente) um template para gerar items automaticamente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente + Titulo */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Dados Principais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
              <select
                value={form.clientPartnerId}
                onChange={(e) => setForm({ ...form, clientPartnerId: e.target.value })}
                required
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.document ? `(${p.document})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titulo *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Ex: Piscina 8x4 alvenaria - Andreia Santana"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Template (opcional)</label>
              <select
                value={form.templateId}
                onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                className={inputClass}
              >
                <option value="">Sem template (items manuais)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isDefault ? "(padrao)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Layout de impressao</label>
              <select
                value={form.printLayoutId}
                onChange={(e) => setForm({ ...form, printLayoutId: e.target.value })}
                className={inputClass}
              >
                <option value="">Padrao</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.isDefault ? "(padrao)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="Resumo curto que vai no cabecalho do orcamento."
              />
            </div>
          </div>
        </div>

        {/* Dimensoes da Piscina */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Dimensoes da Piscina</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Comprimento (m)</label>
              <input type="number" step="0.01" value={form.length}
                onChange={(e) => setForm({ ...form, length: parseFloat(e.target.value) || 0 })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Largura (m)</label>
              <input type="number" step="0.01" value={form.width}
                onChange={(e) => setForm({ ...form, width: parseFloat(e.target.value) || 0 })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Profundidade (m)</label>
              <input type="number" step="0.01" value={form.depth}
                onChange={(e) => setForm({ ...form, depth: parseFloat(e.target.value) || 0 })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
                <option value="ALVENARIA">Alvenaria</option>
                <option value="VINIL">Vinil</option>
                <option value="FIBRA">Fibra</option>
                <option value="PRE_MOLDADA">Pre-moldada</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-cyan-50 border border-cyan-200 px-3 py-1 text-cyan-700">
              Area: <strong>{computedArea.toFixed(2)} m²</strong>
            </span>
            <span className="rounded-full bg-cyan-50 border border-cyan-200 px-3 py-1 text-cyan-700">
              Perimetro: <strong>{computedPerimeter.toFixed(2)} m</strong>
            </span>
            <span className="rounded-full bg-cyan-50 border border-cyan-200 px-3 py-1 text-cyan-700">
              Volume: <strong>{computedVolume.toFixed(2)} m³</strong>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.hasSpa} onChange={(e) => setForm({ ...form, hasSpa: e.target.checked })} />
              Tem SPA
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.hasCascata} onChange={(e) => setForm({ ...form, hasCascata: e.target.checked })} />
              Tem Cascata
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.hasAquecimentoSolar} onChange={(e) => setForm({ ...form, hasAquecimentoSolar: e.target.checked })} />
              Aquecimento Solar
            </label>
          </div>
        </div>

        {/* Validade + Desconto */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Validade e Desconto</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Validade (dias)</label>
              <input type="number" min="1" value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: parseInt(e.target.value) || 30 })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Desconto (R$)</label>
              <input type="number" step="0.01" value={form.discountCents / 100}
                onChange={(e) => setForm({ ...form, discountCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Desconto (%)</label>
              <input type="number" step="0.1" min="0" max="100" value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
                className={inputClass} />
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Observacoes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notas internas (nao visivel ao cliente)</label>
              <textarea rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Termos e condicoes (visivel ao cliente)</label>
              <textarea rows={3} value={form.termsConditions}
                onChange={(e) => setForm({ ...form, termsConditions: e.target.value })}
                className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? "Criando..." : "Criar orcamento"}
          </button>
          <Link
            href="/quotes?tab=obras"
            className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
