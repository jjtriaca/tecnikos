"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

type BudgetItem = {
  id: string;
  poolSection: string;
  sortOrder: number;
  description: string;
  unit: string;
  qty: number;
  qtyCalculated: number | null;
  unitPriceCents: number;
  totalCents: number;
  isAutoCalculated: boolean;
  isExtra: boolean;
  notes: string | null;
  catalogConfigId: string | null;
};

type Budget = {
  id: string;
  code: string | null;
  status: string;
  title: string;
  description: string | null;
  notes: string | null;
  termsConditions: string | null;
  poolDimensions: any;
  environmentParams: any;
  validityDays: number;
  expiresAt: string | null;
  subtotalCents: number;
  discountCents: number | null;
  discountPercent: number | null;
  taxesCents: number;
  totalCents: number;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
  clientPartner: { id: string; name: string; document?: string | null; phone?: string | null; email?: string | null };
  items: BudgetItem[];
  template?: { id: string; name: string };
  printLayout?: { id: string; name: string };
  project?: { id: string; code: string | null; status: string };
};

type CatalogConfig = {
  id: string;
  poolSection: string;
  product: { id: string; description: string; salePriceCents: number; unit: string } | null;
  service: { id: string; name: string; priceCents: number; unit: string } | null;
};

const SECTION_LABEL: Record<string, string> = {
  CONSTRUCAO: "Construcao",
  FILTRO: "Filtro",
  CASCATA: "Cascata",
  SPA: "SPA",
  AQUECIMENTO: "Aquecimento",
  ILUMINACAO: "Iluminacao",
  CASA_MAQUINAS: "Casa de Maquinas",
  DISPOSITIVOS: "Dispositivos",
  ACIONAMENTOS: "Acionamentos",
  BORDA_CALCADA: "Borda/Calcada",
  EXECUCAO: "Execucao",
  OUTROS: "Outros",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  ENVIADO: { label: "Enviado", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  APROVADO: { label: "Aprovado", cls: "bg-green-100 text-green-700 border-green-300" },
  REJEITADO: { label: "Rejeitado", cls: "bg-red-100 text-red-700 border-red-300" },
  CANCELADO: { label: "Cancelado", cls: "bg-slate-200 text-slate-500 border-slate-400" },
  EXPIRADO: { label: "Expirado", cls: "bg-orange-100 text-orange-700 border-orange-300" },
};

function fmtCurrency(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PoolBudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogConfig[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "approve" | "reject" | "cancel" | "delete">(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Budget>(`/pool-budgets/${id}`);
      setBudget(data);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar orcamento", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ data: CatalogConfig[] }>("/pool-catalog-config?limit=200")
      .then((r) => setCatalog(r.data || []))
      .catch(() => setCatalog([]));
  }, []);

  const isLocked = budget?.status === "APROVADO" || budget?.status === "CANCELADO";
  const itemsBySection = useMemo(() => {
    const grouped: Record<string, BudgetItem[]> = {};
    budget?.items.forEach((it) => {
      if (!grouped[it.poolSection]) grouped[it.poolSection] = [];
      grouped[it.poolSection].push(it);
    });
    return grouped;
  }, [budget]);

  async function updateItem(itemId: string, patch: Partial<BudgetItem>) {
    try {
      await api.put(`/pool-budgets/items/${itemId}`, patch);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao atualizar item", "error");
    }
  }

  async function removeItem(itemId: string) {
    if (!confirm("Remover este item?")) return;
    try {
      await api.del(`/pool-budgets/items/${itemId}`);
      toast("Item removido", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function addItem(payload: any) {
    try {
      await api.post(`/pool-budgets/${id}/items`, payload);
      toast("Item adicionado", "success");
      setShowAdd(false);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao adicionar", "error");
    }
  }

  async function performAction(reason?: string) {
    if (!confirmAction) return;
    try {
      if (confirmAction === "approve") {
        await api.post(`/pool-budgets/${id}/approve`, {});
        toast("Orcamento aprovado! Obra criada automaticamente.", "success");
      } else if (confirmAction === "reject") {
        await api.post(`/pool-budgets/${id}/reject`, { reason });
        toast("Orcamento rejeitado", "success");
      } else if (confirmAction === "cancel") {
        await api.post(`/pool-budgets/${id}/cancel`, { reason });
        toast("Orcamento cancelado", "success");
      } else if (confirmAction === "delete") {
        await api.del(`/pool-budgets/${id}`);
        toast("Orcamento removido", "success");
        router.push("/quotes?tab=obras");
        return;
      }
      setConfirmAction(null);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
      setConfirmAction(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-400">Carregando...</div>;
  }
  if (!budget) {
    return <div className="p-6 text-slate-400">Orcamento nao encontrado.</div>;
  }
  const status = STATUS_BADGE[budget.status] || { label: budget.status, cls: "" };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/quotes?tab=obras" className="text-xs text-slate-500 hover:text-slate-700">
            ← Voltar pra Obras
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-slate-900">{budget.title}</h1>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{budget.code || "—"}</span> • Cliente: <strong>{budget.clientPartner?.name}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {budget.project && (
            <Link
              href={`/quotes/pool/projects/${budget.project.id}`}
              className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
            >
              Ver obra ({budget.project.code || budget.project.status})
            </Link>
          )}
          {!isLocked && (budget.status === "RASCUNHO" || budget.status === "ENVIADO") && (
            <button
              onClick={() => setConfirmAction("approve")}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Aprovar
            </button>
          )}
          {!isLocked && (
            <button
              onClick={() => setConfirmAction("reject")}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Rejeitar
            </button>
          )}
          {budget.status !== "CANCELADO" && (
            <button
              onClick={() => setConfirmAction("cancel")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
          {budget.status === "RASCUNHO" && (
            <button
              onClick={() => setConfirmAction("delete")}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Valor total</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{fmtCurrency(budget.totalCents)}</div>
          <div className="mt-1 text-xs text-slate-400">Subtotal: {fmtCurrency(budget.subtotalCents)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Dimensoes</div>
          <div className="mt-1 text-sm text-slate-700">
            {budget.poolDimensions?.length}m × {budget.poolDimensions?.width}m × {budget.poolDimensions?.depth}m
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Area {budget.poolDimensions?.area?.toFixed(1)} m² • Volume {budget.poolDimensions?.volume?.toFixed(1)} m³
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Validade</div>
          <div className="mt-1 text-sm text-slate-700">{budget.validityDays} dias</div>
          {budget.expiresAt && <div className="mt-1 text-xs text-slate-400">Expira em {new Date(budget.expiresAt).toLocaleDateString("pt-BR")}</div>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Items</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{budget.items.length}</div>
          <div className="mt-1 text-xs text-slate-400">Em {Object.keys(itemsBySection).length} secoes</div>
        </div>
      </div>

      {/* Items por secao */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Items do Orcamento</h3>
          {!isLocked && (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
            >
              + Adicionar item
            </button>
          )}
        </div>
        {budget.items.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            Nenhum item ainda. Adicione manualmente ou crie um orcamento com template.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(itemsBySection).map(([section, items]) => {
              const sectionTotal = items.reduce((s, it) => s + it.totalCents, 0);
              return (
                <div key={section} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase text-slate-500">
                      {SECTION_LABEL[section] || section}
                    </h4>
                    <span className="text-xs text-slate-500">{fmtCurrency(sectionTotal)}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="text-left py-1">Descricao</th>
                        <th className="text-center py-1 w-20">Qtd</th>
                        <th className="text-center py-1 w-20">Un</th>
                        <th className="text-right py-1 w-32">Preco un.</th>
                        <th className="text-right py-1 w-32">Total</th>
                        <th className="w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <ItemRow key={it.id} item={it} locked={isLocked}
                          onUpdate={(patch) => updateItem(it.id, patch)}
                          onRemove={() => removeItem(it.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal adicionar item */}
      {showAdd && (
        <AddItemModal
          catalog={catalog}
          onClose={() => setShowAdd(false)}
          onSubmit={addItem}
        />
      )}

      {/* Modal confirmacao de acao */}
      <ConfirmModal
        open={!!confirmAction}
        title={
          confirmAction === "approve" ? "Aprovar orcamento" :
          confirmAction === "reject" ? "Rejeitar orcamento" :
          confirmAction === "cancel" ? "Cancelar orcamento" :
          confirmAction === "delete" ? "Excluir orcamento" : ""
        }
        message={
          confirmAction === "approve" ? "Apos aprovado, uma obra sera criada automaticamente. Confirma?" :
          confirmAction === "reject" ? "Informe o motivo da rejeicao." :
          confirmAction === "cancel" ? "Cancela este orcamento? Informe o motivo." :
          confirmAction === "delete" ? "Esta acao nao pode ser desfeita." : ""
        }
        confirmLabel={confirmAction === "approve" ? "Aprovar" : confirmAction === "delete" ? "Excluir" : "Confirmar"}
        variant={confirmAction === "delete" ? "danger" : "default"}
        reasonRequired={confirmAction === "reject" || confirmAction === "cancel"}
        reasonPlaceholder="Motivo..."
        onConfirm={() => performAction()}
        onConfirmWithReason={(r) => performAction(r)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function ItemRow({ item, locked, onUpdate, onRemove }: {
  item: BudgetItem;
  locked: boolean;
  onUpdate: (patch: Partial<BudgetItem>) => void;
  onRemove: () => void;
}) {
  const [qty, setQty] = useState(item.qty);
  const [price, setPrice] = useState((item.unitPriceCents / 100).toFixed(2));
  const [desc, setDesc] = useState(item.description);

  function commit() {
    const newQty = parseFloat(String(qty)) || 0;
    const newPrice = Math.round(parseFloat(price.replace(",", ".")) * 100) || 0;
    const patch: Partial<BudgetItem> = {};
    if (newQty !== item.qty) patch.qty = newQty;
    if (newPrice !== item.unitPriceCents) patch.unitPriceCents = newPrice;
    if (desc !== item.description) patch.description = desc;
    if (Object.keys(patch).length > 0) onUpdate(patch);
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="py-2 pr-2">
        {locked ? (
          <span className="text-sm text-slate-700">{item.description}</span>
        ) : (
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={commit}
            className="w-full rounded border border-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-cyan-500 outline-none"
          />
        )}
        {item.isAutoCalculated && <span className="ml-2 text-[10px] text-cyan-600">auto</span>}
        {item.isExtra && <span className="ml-2 text-[10px] text-orange-600">extra</span>}
      </td>
      <td className="py-2 text-center">
        {locked ? <span>{item.qty}</span> : (
          <input type="number" step="0.01" value={qty}
            onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
            onBlur={commit}
            className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center text-sm" />
        )}
      </td>
      <td className="py-2 text-center text-xs text-slate-500">{item.unit}</td>
      <td className="py-2 text-right">
        {locked ? <span>{fmtCurrency(item.unitPriceCents)}</span> : (
          <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commit}
            className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right text-sm" />
        )}
      </td>
      <td className="py-2 text-right font-medium text-slate-800">{fmtCurrency(item.totalCents)}</td>
      <td className="py-2 text-right">
        {!locked && (
          <button onClick={onRemove} className="text-red-500 hover:text-red-700 text-xs">
            Remover
          </button>
        )}
      </td>
    </tr>
  );
}

function AddItemModal({ catalog, onClose, onSubmit }: {
  catalog: CatalogConfig[];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [mode, setMode] = useState<"catalog" | "free">("catalog");
  const [catalogConfigId, setCatalogConfigId] = useState("");
  const [section, setSection] = useState("OUTROS");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("UN");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("0,00");

  function handleCatalogPick(id: string) {
    setCatalogConfigId(id);
    const cfg = catalog.find((c) => c.id === id);
    if (!cfg) return;
    setSection(cfg.poolSection);
    if (cfg.product) {
      setDescription(cfg.product.description);
      setUnit(cfg.product.unit);
      setUnitPrice((cfg.product.salePriceCents / 100).toFixed(2).replace(".", ","));
    } else if (cfg.service) {
      setDescription(cfg.service.name);
      setUnit(cfg.service.unit);
      setUnitPrice((cfg.service.priceCents / 100).toFixed(2).replace(".", ","));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cfg = catalog.find((c) => c.id === catalogConfigId);
    onSubmit({
      catalogConfigId: mode === "catalog" ? catalogConfigId || undefined : undefined,
      productId: mode === "catalog" ? cfg?.product?.id : undefined,
      serviceId: mode === "catalog" ? cfg?.service?.id : undefined,
      poolSection: section,
      description,
      unit,
      qty,
      unitPriceCents: Math.round(parseFloat(unitPrice.replace(",", ".")) * 100),
      isExtra: true,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Adicionar item</h3>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setMode("catalog")}
            className={`px-3 py-1.5 rounded text-sm ${mode === "catalog" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            Do catalogo
          </button>
          <button type="button" onClick={() => setMode("free")}
            className={`px-3 py-1.5 rounded text-sm ${mode === "free" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            Livre (manual)
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "catalog" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Item do catalogo</label>
              <select value={catalogConfigId} onChange={(e) => handleCatalogPick(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{SECTION_LABEL[c.poolSection]}] {c.product?.description || c.service?.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Secao</label>
              <select value={section} onChange={(e) => setSection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {Object.entries(SECTION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unidade</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descricao *</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade</label>
              <input type="number" step="0.01" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Preco unitario (R$)</label>
              <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
