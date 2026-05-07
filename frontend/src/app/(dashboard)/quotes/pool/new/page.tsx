"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import PartnerCombobox from "@/components/PartnerCombobox";

type Partner = { id: string; name: string; document?: string | null; phone?: string | null; city?: string | null; state?: string | null };
type Template = { id: string; name: string; isDefault: boolean };
type Layout = { id: string; name: string; isDefault: boolean };

export default function NewPoolBudgetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [saving, setSaving] = useState(false);
  // Cliente selecionado (objeto completo) — pra mostrar dados na tela e auto-preencher solicitante/titulo
  const [client, setClient] = useState<Partner | null>(null);
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
    // Solicitante (quem pediu o orcamento — pode ser diferente do cliente)
    solicitante: "",
    // Pool dimensions — tipo + sections (cada linha = parte da piscina,
    // pra suportar piscinas irregulares com varias partes)
    type: "ALVENARIA",
    sections: [{ name: "Principal", length: 8, width: 4, depth: 1.5 }] as Array<{ name: string; length: number; width: number; depth: number }>,
    // Totais internos do bounding box (a piscina inteira). Default eh derivado
    // das sections, mas user pode editar pra refletir formato real (ex: piscina
    // L tem bounding maior que somatorio das partes).
    comprimentoTotal: 0,
    larguraTotal: 0,
    cantos: 0,
    perimetroExternoBorda: 0,
    perimetroParedesInternas: 0,
    // Manuais (piscineiro decide com base no projeto real). Default eh derivado
    // como sugestao no placeholder mas o user precisa preencher pra valer no
    // orcamento. 0 = nao preenchido.
    areaParedeEFundo: 0,
    radierM2: 0,
    radierEspessura: 0.20,  // metros — espessura tipica 20cm
    escavacaoM3: 0,
    // Environment (parametros pra calculo de aquecimento)
    temperaturaMediaLocal: 22,        // °C
    velocidadeVento: "MODERADO",      // BAIXO=1 | MODERADO=2 | FORTE=3
    temperaturaAguaDesejada: 30,      // °C
    capaTermica: true,                // true=SIM | false=NAO
    tipoConstrucao: "ABERTA",         // ABERTA | FECHADA
    regiaoSolar: "MT",
  });

  useEffect(() => {
    Promise.all([
      api.get<{ data: Template[] }>("/pool-budget-templates?limit=100").catch(() => ({ data: [] as Template[] })),
      api.get<{ data: Layout[] }>("/pool-print-layouts?limit=100").catch(() => ({ data: [] as Layout[] })),
    ]).then(([t, l]) => {
      setTemplates(t.data || []);
      setLayouts(l.data || []);
      // Em modo edit, defaults nao sao auto-aplicados (preserva o que ja foi salvo)
      if (!isEditMode) {
        const dt = t.data?.find((x: Template) => x.isDefault);
        const dl = l.data?.find((x: Layout) => x.isDefault);
        if (dt) setForm((f) => ({ ...f, templateId: dt.id }));
        if (dl) setForm((f) => ({ ...f, printLayoutId: dl.id }));
      }
    });
  }, [isEditMode]);

  // Modo edit: carrega dados do orcamento existente e pre-preenche form
  useEffect(() => {
    if (!editId) return;
    api.get<any>(`/pool-budgets/${editId}`)
      .then((b) => {
        setForm((f) => ({
          ...f,
          clientPartnerId: b.clientPartnerId || "",
          templateId: b.templateId || "",
          printLayoutId: b.printLayoutId || "",
          title: b.title || "",
          description: b.description || "",
          notes: b.notes || "",
          termsConditions: b.termsConditions || "",
          validityDays: b.validityDays ?? 30,
          // Dimensoes (poolDimensions json)
          type: b.poolDimensions?.type || f.type,
          sections: b.poolDimensions?.sections || f.sections,
          comprimentoTotal: b.poolDimensions?.comprimentoTotal ?? 0,
          larguraTotal: b.poolDimensions?.larguraTotal ?? 0,
          cantos: b.poolDimensions?.cantos ?? 0,
          perimetroExternoBorda: b.poolDimensions?.perimetroExternoBorda ?? 0,
          perimetroParedesInternas: b.poolDimensions?.perimetroParedesInternas ?? 0,
          areaParedeEFundo: b.poolDimensions?.areaParedeEFundo ?? 0,
          radierM2: b.poolDimensions?.radierM2 ?? 0,
          radierEspessura: b.poolDimensions?.radierEspessura ?? 0.20,
          escavacaoM3: b.poolDimensions?.escavacaoM3 ?? 0,
          // Environment
          temperaturaMediaLocal: b.environmentParams?.temperaturaMediaLocal ?? b.environmentParams?.temperatura ?? 22,
          velocidadeVento: b.environmentParams?.velocidadeVento || "MODERADO",
          temperaturaAguaDesejada: b.environmentParams?.temperaturaAguaDesejada ?? 30,
          capaTermica: typeof b.environmentParams?.capaTermica === 'boolean' ? b.environmentParams.capaTermica : true,
          tipoConstrucao: b.environmentParams?.tipoConstrucao || "ABERTA",
          regiaoSolar: b.environmentParams?.regiaoSolar || "MT",
          solicitante: (b.environmentParams as any)?.solicitante || "",
        }));
        if (b.clientPartner) setClient(b.clientPartner);
      })
      .catch((err) => toast(err?.payload?.message || "Erro ao carregar orcamento", "error"));
  }, [editId]);

  // Quando muda cliente: sugere titulo automatico (se vazio) e solicitante = nome do cliente
  function handleClientChange(p: Partner | null) {
    setClient(p);
    setForm((f) => {
      const updates: Partial<typeof f> = { clientPartnerId: p?.id || "" };
      if (p) {
        if (!f.solicitante.trim()) updates.solicitante = p.name;
        if (!f.title.trim()) {
          const main = f.sections[0] || { length: 0, width: 0 };
          updates.title = `Piscina ${main.length}×${main.width} ${f.type.toLowerCase().replace("_", "-")} — ${p.name}`;
        }
      }
      return { ...f, ...updates };
    });
  }

  // Operacoes nas linhas de dimensoes
  function updateSection(idx: number, field: "name" | "length" | "width" | "depth", value: string | number) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  }

  function addSection() {
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { name: "", length: 0, width: 0, depth: 1.5 }],
    }));
  }

  function removeSection(idx: number) {
    setForm((f) => ({
      ...f,
      sections: f.sections.length > 1 ? f.sections.filter((_, i) => i !== idx) : f.sections,
    }));
  }

  // Calculos por linha (mostrados na tabela)
  function sectionMetrics(s: { length: number; width: number; depth: number }) {
    const area = s.length * s.width;
    const perimeter = 2 * (s.length + s.width);
    const volume = area * s.depth;
    return { area, perimeter, volume };
  }

  // Totais agregados (somatorios)
  const totals = form.sections.reduce(
    (acc, s) => {
      const m = sectionMetrics(s);
      acc.area += m.area;
      acc.perimeter += m.perimeter;
      acc.volume += m.volume;
      acc.maxDepth = Math.max(acc.maxDepth, s.depth);
      return acc;
    },
    { area: 0, perimeter: 0, volume: 0, maxDepth: 0 },
  );

  // Bounding box default (caso user nao preencha): max das sections
  const bbCompr = form.comprimentoTotal || Math.max(...form.sections.map((s) => s.length), 0);
  const bbLarg = form.larguraTotal || Math.max(...form.sections.map((s) => s.width), 0);
  const cantosVal = form.cantos || 2 * (bbCompr + bbLarg);

  // Profundidade media ponderada pela area (pra calcular paredes)
  const profMedia = totals.area > 0 ? totals.volume / totals.area : 0;

  // Sugestoes derivadas (placeholder dos inputs manuais — piscineiro digita o
  // valor real do projeto, essa eh so uma referencia inicial).
  const sugAreaParedeEFundo = totals.area + 2 * (bbCompr + bbLarg) * profMedia;
  const sugRadierM2 = bbCompr * bbLarg;
  const sugEscavacaoM3 = bbCompr * bbLarg * totals.maxDepth * 1.30;

  // Valores efetivos: o que o user digitou, ou a sugestao se nao digitou
  const areaParedeEFundo = form.areaParedeEFundo || sugAreaParedeEFundo;
  const radierM2 = form.radierM2 || sugRadierM2;
  // Radier m³ = radier m² × espessura (calculado, nao editavel)
  const radierM3 = radierM2 * form.radierEspessura;
  const escavacaoM3 = form.escavacaoM3 || sugEscavacaoM3;

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
          // Suporte a piscina irregular com varias partes — cada section tem
          // length/width/depth/name proprios. Os campos length/width/depth no
          // nivel raiz sao "principais" (primeira section) pra compat com
          // formulas POOL_AREA/POOL_PERIMETER/POOL_VOLUME. As metricas REAIS
          // (area/perimeter/volume) sao somatorios das sections.
          type: form.type,
          sections: form.sections.map((s) => ({
            ...s,
            area: s.length * s.width,
            perimeter: 2 * (s.length + s.width),
            volume: s.length * s.width * s.depth,
          })),
          length: form.sections[0]?.length ?? 0,
          width: form.sections[0]?.width ?? 0,
          depth: form.sections[0]?.depth ?? 0,
          area: totals.area,
          perimeter: totals.perimeter,
          volume: totals.volume,
          maxDepth: totals.maxDepth,
          // Bounding box (totais internos) — manuais ou auto a partir das sections
          comprimentoTotal: bbCompr,
          larguraTotal: bbLarg,
          cantos: cantosVal,
          perimetroExternoBorda: form.perimetroExternoBorda || cantosVal,
          perimetroParedesInternas: form.perimetroParedesInternas || cantosVal,
          // Calculos derivados (snapshot pra impressao — piscineiro pode editar depois)
          areaParedeEFundo,
          radierM2,
          radierM3,
          escavacaoM3,
        },
        environmentParams: {
          temperaturaMediaLocal: form.temperaturaMediaLocal,
          velocidadeVento: form.velocidadeVento,
          temperaturaAguaDesejada: form.temperaturaAguaDesejada,
          capaTermica: form.capaTermica,
          tipoConstrucao: form.tipoConstrucao,
          regiaoSolar: form.regiaoSolar,
          // CAPA fields (capa do orcamento — vai pra impressao via {solicitante})
          solicitante: form.solicitante || client?.name || "",
        },
      };
      let resultId: string;
      if (editId) {
        const updated: { id: string } = await api.put(`/pool-budgets/${editId}`, payload);
        resultId = updated.id || editId;
        toast("Orcamento atualizado!", "success");
      } else {
        const created: { id: string } = await api.post("/pool-budgets", payload);
        resultId = created.id;
        toast("Orcamento criado!", "success");
      }
      router.push(`/quotes/pool/${resultId}`);
    } catch (err: any) {
      toast(err?.payload?.message || `Erro ao ${editId ? "atualizar" : "criar"} orcamento`, "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200";

  // Helper pra exibir um calculo derivado em formato consistente
  function Calc({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded bg-white border border-slate-200 px-2 py-1.5">
        <div className="text-[10px] uppercase text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800 tabular-nums">{value}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/quotes?tab=obras" className="text-xs text-slate-500 hover:text-slate-700">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? "Editar Orcamento de Obra" : "Novo Orcamento de Obra"}</h1>
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
              <PartnerCombobox
                value={form.clientPartnerId}
                onChange={handleClientChange}
                partnerType="CLIENTE"
                required
                placeholder="Buscar cliente por nome (ou criar novo)..."
              />
              {client && (
                <div className="mt-1.5 rounded bg-cyan-50 border border-cyan-200 px-2 py-1.5 text-xs text-cyan-800 space-y-0.5">
                  {client.document && <div>Documento: <span className="font-mono">{client.document}</span></div>}
                  {client.phone && <div>Telefone: <span className="font-mono">{client.phone}</span></div>}
                  {client.city && client.state && <div>Cidade: {client.city}/{client.state}</div>}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Solicitante</label>
              <input
                value={form.solicitante}
                onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
                placeholder="Quem pediu o orcamento (default: nome do cliente)"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Aparece na capa do orcamento. Pode ser diferente do cliente (ex: arquiteto, decorador).
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Titulo *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Ex: Piscina 8x4 alvenaria - Andreia Santana"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Sugerido automaticamente quando seleciona cliente — voce pode editar.
              </p>
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

          {/* Tipo (escolha primeiro porque afeta calculos e tipo de execucao) */}
          <div className="mb-4 max-w-xs">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de piscina *</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
              <option value="ALVENARIA">Alvenaria</option>
              <option value="VINIL">Vinil</option>
              <option value="FIBRA">Fibra</option>
              <option value="PRE_MOLDADA">Pre-moldada</option>
            </select>
          </div>

          {/* Tabela de partes (cada linha = uma secao da piscina, pra formatos irregulares) */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase font-semibold text-slate-600">
                  <th className="px-3 py-2 text-left w-12">#</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Comprimento (m)</th>
                  <th className="px-3 py-2 text-left">Largura (m)</th>
                  <th className="px-3 py-2 text-left">Profundidade (m)</th>
                  <th className="px-3 py-2 text-right">Area (m²)</th>
                  <th className="px-3 py-2 text-right">Volume (m³)</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {form.sections.map((s, idx) => {
                  const m = sectionMetrics(s);
                  return (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input type="text" value={s.name}
                          onChange={(e) => updateSection(idx, "name", e.target.value)}
                          placeholder="Ex: praia, degraus, spa..."
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" value={s.length}
                          onChange={(e) => updateSection(idx, "length", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" value={s.width}
                          onChange={(e) => updateSection(idx, "width", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" value={s.depth}
                          onChange={(e) => updateSection(idx, "depth", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 outline-none" />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{m.area.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800 tabular-nums">{m.volume.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        {form.sections.length > 1 && (
                          <button type="button" onClick={() => removeSection(idx)}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="Remover esta parte">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-cyan-50 border-t-2 border-cyan-200 font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right text-cyan-800 text-xs uppercase">Totais</td>
                  <td className="px-3 py-2 text-right text-cyan-800 tabular-nums">{totals.area.toFixed(2)} m²</td>
                  <td className="px-3 py-2 text-right text-cyan-800 tabular-nums">{totals.volume.toFixed(2)} m³</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={addSection}
              className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 transition">
              + Adicionar mais uma linha
            </button>
            <span className="text-xs text-slate-500">
              Perimetro total (somatorio): <strong className="text-slate-700 tabular-nums">{totals.perimeter.toFixed(2)} m</strong>
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Use multiplas linhas pra piscinas irregulares ou com niveis diferentes (ex: parte rasa + parte funda).
          </p>

          {/* Inputs amarelos (totais do bounding box + cantos + perimetros) */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Comprimento total interno (m)
              </label>
              <input type="number" step="0.01" min="0" value={form.comprimentoTotal || ""}
                onChange={(e) => setForm({ ...form, comprimentoTotal: parseFloat(e.target.value) || 0 })}
                placeholder={`auto: ${bbCompr.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
              <p className="mt-1 text-xs text-slate-400">Bounding box (formato externo)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Largura total interno (m)
              </label>
              <input type="number" step="0.01" min="0" value={form.larguraTotal || ""}
                onChange={(e) => setForm({ ...form, larguraTotal: parseFloat(e.target.value) || 0 })}
                placeholder={`auto: ${bbLarg.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
              <p className="mt-1 text-xs text-slate-400">Bounding box (formato externo)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cantos / Cantoneiras internas (m/l)
              </label>
              <input type="number" step="0.01" min="0" value={form.cantos || ""}
                onChange={(e) => setForm({ ...form, cantos: parseFloat(e.target.value) || 0 })}
                placeholder={`auto: ${cantosVal.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
              <p className="mt-1 text-xs text-slate-400">Cantoneiras internas (m/l)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Perimetro externo borda (m/l)
              </label>
              <input type="number" step="0.01" min="0" value={form.perimetroExternoBorda || ""}
                onChange={(e) => setForm({ ...form, perimetroExternoBorda: parseFloat(e.target.value) || 0 })}
                placeholder={`auto: ${cantosVal.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
              <p className="mt-1 text-xs text-slate-400">Borda corrida externa (m/l)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Perimetro paredes internas (m/l)
              </label>
              <input type="number" step="0.01" min="0" value={form.perimetroParedesInternas || ""}
                onChange={(e) => setForm({ ...form, perimetroParedesInternas: parseFloat(e.target.value) || 0 })}
                placeholder={`auto: ${cantosVal.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
              <p className="mt-1 text-xs text-slate-400">Paredes internas linear (m/l)</p>
            </div>
          </div>

          {/* Auto-calculados a partir das sections (somatorio direto, nao editavel) */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Calc label="Area total (auto)" value={`${totals.area.toFixed(2)} m²`} />
            <Calc label="Volume total (auto)" value={`${totals.volume.toFixed(2)} m³`} />
          </div>

          {/* Inputs manuais — piscineiro digita conforme projeto real */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Area parede + fundo (m²)
              </label>
              <input type="number" step="0.01" min="0" value={form.areaParedeEFundo || ""}
                onChange={(e) => setForm({ ...form, areaParedeEFundo: parseFloat(e.target.value) || 0 })}
                placeholder={`sug: ${sugAreaParedeEFundo.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Radier (m²)
              </label>
              <input type="number" step="0.01" min="0" value={form.radierM2 || ""}
                onChange={(e) => setForm({ ...form, radierM2: parseFloat(e.target.value) || 0 })}
                placeholder={`sug: ${sugRadierM2.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Espessura radier (m)
              </label>
              <input type="number" step="0.01" min="0" value={form.radierEspessura}
                onChange={(e) => setForm({ ...form, radierEspessura: parseFloat(e.target.value) || 0 })}
                placeholder="0.20"
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Radier (m³) <span className="text-slate-400 font-normal">— auto</span>
              </label>
              <input type="text" readOnly value={`${radierM3.toFixed(2)} m³`}
                title="Calculado automaticamente: Radier m² × Espessura"
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-default outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Escavacao (m³)
              </label>
              <input type="number" step="0.01" min="0" value={form.escavacaoM3 || ""}
                onChange={(e) => setForm({ ...form, escavacaoM3: parseFloat(e.target.value) || 0 })}
                placeholder={`sug: ${sugEscavacaoM3.toFixed(2)}`}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-200 outline-none" />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Sugestoes baseadas nas dimensoes — substitua pelos valores reais do projeto. Radier m³ recalcula automaticamente quando voce muda Radier m² ou Espessura.
          </p>

        </div>

        {/* Parametros de aquecimento (aba CAPA da planilha original) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Parametros de aquecimento</h3>
          <p className="text-xs text-slate-500 mb-4">Usados pra calcular kcal/h e dimensionar trocador de calor / aquecedor solar.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Temperatura media local (°C)
              </label>
              <input type="number" step="0.1" value={form.temperaturaMediaLocal}
                onChange={(e) => setForm({ ...form, temperaturaMediaLocal: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Velocidade do vento local
              </label>
              <select value={form.velocidadeVento}
                onChange={(e) => setForm({ ...form, velocidadeVento: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="BAIXO">BAIXO (1)</option>
                <option value="MODERADO">MODERADO (2)</option>
                <option value="FORTE">FORTE (3)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Temperatura agua desejada (°C)
              </label>
              <input type="number" step="0.1" value={form.temperaturaAguaDesejada}
                onChange={(e) => setForm({ ...form, temperaturaAguaDesejada: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Usa capa termica
              </label>
              <select value={form.capaTermica ? "SIM" : "NAO"}
                onChange={(e) => setForm({ ...form, capaTermica: e.target.value === "SIM" })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="SIM">SIM (1)</option>
                <option value="NAO">NAO (0)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo de construcao
              </label>
              <select value={form.tipoConstrucao}
                onChange={(e) => setForm({ ...form, tipoConstrucao: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="ABERTA">ABERTA (1)</option>
                <option value="FECHADA">FECHADA (2)</option>
              </select>
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
            {saving ? (isEditMode ? "Salvando..." : "Criando...") : (isEditMode ? "Salvar alteracoes" : "Criar orcamento")}
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
