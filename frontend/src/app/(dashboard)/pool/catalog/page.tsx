"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type CatalogConfig = {
  id: string;
  productId: string | null;
  serviceId: string | null;
  poolSection: string;
  displayOrder: number;
  poolFormula: any;
  poolCondition: any;
  technicalSpecs: any;
  isActive: boolean;
  product: { id: string; description: string; salePriceCents: number; unit: string } | null;
  service: { id: string; name: string; priceCents: number; unit: string } | null;
};
type Product = { id: string; description: string; salePriceCents: number; unit: string };
type Service = { id: string; name: string; priceCents: number; unit: string };

const SECTION_LABEL: Record<string, string> = {
  CONSTRUCAO: "Construcao", FILTRO: "Filtro", CASCATA: "Cascata", SPA: "SPA",
  AQUECIMENTO: "Aquecimento", ILUMINACAO: "Iluminacao", CASA_MAQUINAS: "Casa de Maquinas",
  DISPOSITIVOS: "Dispositivos", ACIONAMENTOS: "Acionamentos", BORDA_CALCADA: "Borda/Calcada",
  EXECUCAO: "Execucao", OUTROS: "Outros",
};

const FORMULA_BASIS: Record<string, string> = {
  POOL_AREA: "Area da piscina (m²)",
  POOL_PERIMETER: "Perimetro (m)",
  POOL_VOLUME: "Volume (m³)",
  WALL_AREA: "Area de paredes (m²)",
  TILE_AREA: "Area de revestimento (m²)",
  FIXED: "Quantidade fixa",
};

function fmtCurrency(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PoolCatalogPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogConfig[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CatalogConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CatalogConfig[] }>("/pool-catalog-config?limit=200");
      setItems(res.data || []);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar catalogo", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    api.get<{ data: Product[] }>("/products?limit=500").then((r) => setProducts(r.data || [])).catch(() => {});
    api.get<{ data: Service[] }>("/services?limit=500").then((r) => setServices(r.data || [])).catch(() => {});
  }, [load]);

  async function save(payload: any, id?: string) {
    try {
      if (id) await api.put(`/pool-catalog-config/${id}`, payload);
      else await api.post(`/pool-catalog-config`, payload);
      toast(id ? "Atualizado" : "Adicionado ao catalogo Piscina", "success");
      setShowAdd(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao salvar", "error");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este item do catalogo Piscina?\n(Nao remove o produto/servico do cadastro principal.)")) return;
    try {
      await api.del(`/pool-catalog-config/${id}`);
      toast("Removido", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  const filtered = filter ? items.filter((i) => i.poolSection === filter) : items;
  const grouped: Record<string, CatalogConfig[]> = {};
  filtered.forEach((i) => {
    if (!grouped[i.poolSection]) grouped[i.poolSection] = [];
    grouped[i.poolSection].push(i);
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-700">← Configuracoes</Link>
          <h1 className="text-2xl font-bold text-slate-900">Catalogo Piscina</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vincula produtos e servicos do cadastro principal a secoes de piscina, com formulas de calculo automatico de quantidade.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowAdd(true); }}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
          + Adicionar item
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilter("")}
          className={`rounded-full px-3 py-1 text-xs ${!filter ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          Todas ({items.length})
        </button>
        {Object.entries(SECTION_LABEL).map(([k, v]) => {
          const count = items.filter((i) => i.poolSection === k).length;
          if (count === 0) return null;
          return (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-xs ${filter === k ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {v} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-xl border border-dashed border-slate-300 bg-white">
          Nenhum item no catalogo Piscina. Clique em &quot;Adicionar item&quot; pra comecar.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([section, list]) => (
            <div key={section} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">{SECTION_LABEL[section] || section}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="text-left px-4 py-2">Item (Produto/Servico)</th>
                    <th className="text-left px-4 py-2 w-44">Formula</th>
                    <th className="text-right px-4 py-2 w-32">Preco</th>
                    <th className="text-center px-4 py-2 w-20">Ativo</th>
                    <th className="px-4 py-2 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const f = c.poolFormula as any;
                    const formulaLabel = f?.basis ? `${FORMULA_BASIS[f.basis] || f.basis}${f.factor ? ` × ${f.factor}` : ""}` : "—";
                    const itemName = c.product?.description || c.service?.name || "(sem nome)";
                    const itemPrice = c.product?.salePriceCents ?? c.service?.priceCents ?? 0;
                    const itemUnit = c.product?.unit || c.service?.unit || "UN";
                    return (
                      <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-slate-900">{itemName}</div>
                          <div className="text-xs text-slate-400">
                            {c.product ? "Produto" : "Servico"} • {itemUnit}
                            {c.poolCondition && (c.poolCondition as any)?.requires && (
                              <span className="ml-2 text-orange-600">requer: {((c.poolCondition as any).requires || []).join(", ")}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">{formulaLabel}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{fmtCurrency(itemPrice)}</td>
                        <td className="px-4 py-2 text-center">
                          {c.isActive ? <span className="text-green-600">●</span> : <span className="text-slate-400">○</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => { setEditing(c); setShowAdd(true); }} className="text-xs text-cyan-600 hover:text-cyan-800 mr-2">
                            Editar
                          </button>
                          <button onClick={() => remove(c.id)} className="text-xs text-red-500 hover:text-red-700">
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <CatalogForm
          editing={editing}
          products={products}
          services={services}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSubmit={(payload) => save(payload, editing?.id)}
        />
      )}
    </div>
  );
}

function CatalogForm({ editing, products, services, onClose, onSubmit }: {
  editing: CatalogConfig | null;
  products: Product[];
  services: Service[];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [kind, setKind] = useState<"product" | "service">(editing?.serviceId ? "service" : "product");
  const [productId, setProductId] = useState(editing?.productId || "");
  const [serviceId, setServiceId] = useState(editing?.serviceId || "");
  const [poolSection, setPoolSection] = useState(editing?.poolSection || "CONSTRUCAO");
  const [displayOrder, setDisplayOrder] = useState(editing?.displayOrder || 0);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const ef = editing?.poolFormula as any;
  const [basis, setBasis] = useState(ef?.basis || "FIXED");
  const [factor, setFactor] = useState(ef?.factor !== undefined ? String(ef.factor) : "1");
  const [minQty, setMinQty] = useState(ef?.minQty !== undefined ? String(ef.minQty) : "");

  const ec = editing?.poolCondition as any;
  const [requires, setRequires] = useState((ec?.requires || []).join(","));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      poolSection,
      displayOrder,
      isActive,
    };
    if (kind === "product") {
      payload.productId = productId;
      payload.serviceId = null;
    } else {
      payload.serviceId = serviceId;
      payload.productId = null;
    }

    if (basis === "FIXED") {
      payload.poolFormula = { basis: "FIXED", value: parseFloat(factor) || 1 };
    } else {
      const f: any = { basis, factor: parseFloat(factor) || 1 };
      if (minQty) f.minQty = parseFloat(minQty);
      payload.poolFormula = f;
    }

    if (requires.trim()) {
      payload.poolCondition = { requires: requires.split(",").map((s) => s.trim()).filter(Boolean) };
    } else {
      payload.poolCondition = null;
    }

    onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {editing ? "Editar item do catalogo" : "Novo item do catalogo"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!editing && (
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setKind("product")}
                className={`px-3 py-1.5 rounded text-sm ${kind === "product" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                Produto
              </button>
              <button type="button" onClick={() => setKind("service")}
                className={`px-3 py-1.5 rounded text-sm ${kind === "service" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                Servico
              </button>
            </div>
          )}
          {kind === "product" ? (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Produto *</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required disabled={!!editing}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {products.map((p) => (<option key={p.id} value={p.id}>{p.description}</option>))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Servico *</label>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required disabled={!!editing}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Secao *</label>
              <select value={poolSection} onChange={(e) => setPoolSection(e.target.value)} required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                {Object.entries(SECTION_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Ordem</label>
              <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-700 mb-2">Formula de calculo da quantidade</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Base</label>
                <select value={basis} onChange={(e) => setBasis(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs">
                  {Object.entries(FORMULA_BASIS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">{basis === "FIXED" ? "Valor" : "Fator (×)"}</label>
                <input type="number" step="0.001" value={factor} onChange={(e) => setFactor(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Qtd minima</label>
                <input type="number" step="0.01" value={minQty} onChange={(e) => setMinQty(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ex: para 0,15 m³ de concreto por m² → base = Area, fator = 0.15
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Requer caracteristicas</label>
            <input value={requires} onChange={(e) => setRequires(e.target.value)}
              placeholder="Ex: AQUECIMENTO_SOLAR (separado por virgula). Vazio = sempre incluir."
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Ativo
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
              {editing ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
