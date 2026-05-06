"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

type BudgetItem = {
  id: string;
  poolSection: string;
  sortOrder: number;
  cellRef: string | null; // Endereco estavel (L1, L2, ...) usado em formulas de outros items
  slotName: string | null; // Rotulo do papel da linha (ex: "Capa Termica", "Bomba Aquecimento")
  description: string;
  unit: string;
  qty: number;
  qtyCalculated: number | null;
  formulaExpr: string | null;
  unitPriceCents: number;
  totalCents: number;
  isAutoCalculated: boolean;
  isExtra: boolean;
  notes: string | null;
  catalogConfigId: string | null;
  productId?: string | null;
  serviceId?: string | null;
  product?: { id: string; code: string | null; description: string } | null;
  service?: { id: string; code: string | null; name: string } | null;
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
  taxesPercent: number | null;
  taxesCents: number;
  totalCents: number;
  startDate: string | null;
  endDate: string | null;
  estimatedDurationDays: number | null;
  equipmentWarranty: string | null;
  workWarranty: string | null;
  paymentTerms: string | null;
  earlyPaymentDiscountPct: number | null;
  sectionOrder: string[];
  paymentTermId: string | null;
  paymentTerm: PoolPaymentTerm | null;
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

type PoolPaymentTermPart = {
  label: string;
  percent: number;
  count: number;
  intervalDays: number;
  firstOffsetDays: number;
};
type PoolPaymentTerm = {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  structure: PoolPaymentTermPart[];
};

type CatalogConfig = {
  id: string;
  poolSection: string;
  product: { id: string; code?: string | null; description: string; brand?: string | null; salePriceCents: number; unit: string; technicalSpecs?: Record<string, any> | null } | null;
  service: { id: string; code?: string | null; name: string; priceCents: number; unit: string; technicalSpecs?: Record<string, any> | null } | null;
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

// Ordem das etapas — espelha aba "Linear" da planilha original (CONSTRUCAO
// primeiro, depois sistemas auxiliares, por ultimo execucao/outros).
const SECTION_ORDER: string[] = [
  "CONSTRUCAO", "BORDA_CALCADA", "FILTRO", "CASCATA", "SPA",
  "AQUECIMENTO", "ILUMINACAO", "CASA_MAQUINAS", "DISPOSITIVOS",
  "ACIONAMENTOS", "EXECUCAO", "OUTROS",
];

// Heuristica: item com serviceId vinculado OU unidade hora = SERVICO,
// senao PRODUTO. Usado pra calcular Total Servicos vs Total Produtos por etapa.
function isServicoItem(item: BudgetItem): boolean {
  if (item.serviceId || item.service) return true;
  if (item.productId || item.product) return false;
  // Item livre sem catalogo: usa unidade como heuristica (h, hr, hora)
  return /^h(or)?a?s?$/i.test((item.unit || "").trim());
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  ENVIADO: { label: "Enviado", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  APROVADO: { label: "Aprovado", cls: "bg-green-100 text-green-700 border-green-300" },
  REJEITADO: { label: "Rejeitado", cls: "bg-red-100 text-red-700 border-red-300" },
  CANCELADO: { label: "Cancelado", cls: "bg-slate-200 text-slate-500 border-slate-400" },
  EXPIRADO: { label: "Expirado", cls: "bg-orange-100 text-orange-700 border-orange-300" },
};

// ─────────────────────────────────────────────────────────
// Gera parcelas a partir de PoolPaymentTerm + totalCents + startDate.
// - Cada parte: valorCents = round(total × percent/100), distribuido em `count` parcelas.
// - Parcela base = floor(partCents / count); ultima parcela do bloco recebe o resto pra
//   somar exato. Diferenca total final tambem cai na ultima parcela geral (sistema autoritativo).
// - Data: startDate + firstOffsetDays + k × intervalDays.
// ─────────────────────────────────────────────────────────
function generateInstallments(
  term: PoolPaymentTerm | null,
  totalCents: number,
  startDate: Date | null,
): Array<{ idx: number; date: Date; cents: number; label: string }> {
  if (!term || totalCents <= 0) return [];
  const result: Array<{ idx: number; date: Date; cents: number; label: string }> = [];
  const baseStart = startDate ?? new Date();
  let allocated = 0;
  let idx = 0;
  for (const part of term.structure) {
    const partCents = Math.round((totalCents * part.percent) / 100);
    const baseAmount = Math.floor(partCents / part.count);
    const remainder = partCents - baseAmount * part.count;
    for (let k = 0; k < part.count; k++) {
      const amount = baseAmount + (k === part.count - 1 ? remainder : 0);
      const due = new Date(baseStart);
      due.setUTCDate(due.getUTCDate() + part.firstOffsetDays + k * part.intervalDays);
      idx++;
      result.push({ idx, date: due, cents: amount, label: part.label });
      allocated += amount;
    }
  }
  const diff = totalCents - allocated;
  if (diff !== 0 && result.length > 0) {
    result[result.length - 1].cents += diff;
  }
  return result;
}

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
  const [paymentTerms, setPaymentTerms] = useState<PoolPaymentTerm[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addSection, setAddSection] = useState<string | null>(null);
  // Etapas adicionadas manualmente que ainda nao tem items (pra UI ja ter card vazio)
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<null | "approve" | "reject" | "cancel" | "delete">(null);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

  function toggleSection(section: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }
  function collapseAll() {
    setCollapsedSections(new Set(SECTION_ORDER));
  }
  function expandAll() {
    setCollapsedSections(new Set());
  }

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
    // Carrega catalogo paginado (limit max do backend = 100, cabem ~220 items)
    (async () => {
      try {
        const all: CatalogConfig[] = [];
        let page = 1;
        for (let i = 0; i < 10; i++) {
          const r = await api.get<{ data: CatalogConfig[]; meta?: { total: number } }>(
            `/pool-catalog-config?limit=100&page=${page}`,
          );
          const batch = r.data || [];
          all.push(...batch);
          if (batch.length < 100) break;
          page++;
        }
        setCatalog(all);
      } catch {
        setCatalog([]);
      }
    })();
    api.get<PoolPaymentTerm[]>("/pool-payment-terms")
      .then((r) => setPaymentTerms(r || []))
      .catch(() => setPaymentTerms([]));
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

  async function moveItem(item: BudgetItem, dir: -1 | 1) {
    if (!budget) return;
    const sectionItems = (budget.items.filter((i) => i.poolSection === item.poolSection) || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sectionItems.findIndex((i) => i.id === item.id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sectionItems.length) return;
    const a = sectionItems[idx];
    const b = sectionItems[newIdx];
    try {
      // Troca direta dos sortOrder. Em caso de empate (sortOrder iguais), aplica delta.
      const newA = b.sortOrder === a.sortOrder ? a.sortOrder + dir : b.sortOrder;
      const newB = b.sortOrder === a.sortOrder ? b.sortOrder - dir : a.sortOrder;
      await Promise.all([
        api.put(`/pool-budgets/items/${a.id}`, { sortOrder: newA }),
        api.put(`/pool-budgets/items/${b.id}`, { sortOrder: newB }),
      ]);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao mover linha", "error");
    }
  }

  async function updateBudget(patch: Record<string, any>) {
    try {
      await api.put(`/pool-budgets/${id}`, patch);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao atualizar orcamento", "error");
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
          {!isLocked && budget.items.length > 0 && (
            <button
              onClick={() => setShowSaveAsTemplate(true)}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              title="Salva todos os items + impostos/desconto/garantias/forma pagto como modelo"
            >
              💾 Salvar como modelo
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

      {/* Etapas — cada secao em um card separado, com totais no rodape (espelha aba Linear da planilha) */}
      {(() => {
        // Ordem efetiva: usa sectionOrder do budget se preenchido, senao default. Inclui extras nao listadas no fim.
        const orderBase = budget.sectionOrder && budget.sectionOrder.length > 0 ? budget.sectionOrder : SECTION_ORDER;
        const allWithItems = [...new Set([...orderBase, ...SECTION_ORDER, ...extraSections])];
        const presentSections = allWithItems.filter(
          (sec) => itemsBySection[sec]?.length > 0 || extraSections.includes(sec),
        );

        async function moveSection(section: string, dir: -1 | 1) {
          const idx = presentSections.indexOf(section);
          if (idx < 0) return;
          const newIdx = idx + dir;
          if (newIdx < 0 || newIdx >= presentSections.length) return;
          const next = [...presentSections];
          [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
          await updateBudget({ sectionOrder: next });
        }
        if (presentSections.length === 0) {
          return (
            <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-12 text-center">
              <p className="text-sm text-slate-600 mb-4">
                Orçamento vazio. Voce pode adicionar etapas manualmente ou carregar o template padrao com todas as etapas e linhas.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Aplicar template Linear (Padrao Juliano)?\n\nVai criar 125 items distribuidos em 12 etapas baseados na planilha original. Os valores e quantidades sao SUGESTOES — voce edita depois.")) return;
                  try {
                    const res = await api.post<{ itemsCreated: number; unmappedSections: string[] }>(
                      `/pool-budgets/${id}/apply-linear`, {},
                    );
                    toast(`Template aplicado: ${res.itemsCreated} linhas criadas.`, "success");
                    if (res.unmappedSections.length > 0) {
                      toast(`Etapas nao mapeadas: ${res.unmappedSections.join(", ")}`, "info");
                    }
                    await load();
                  } catch (err: any) {
                    toast(err?.payload?.message || "Erro ao aplicar template", "error");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 shadow-sm"
              >
                Carregar template Linear (Padrao Juliano)
              </button>
              <p className="text-xs text-slate-400 mt-4">
                Ou use os botoes &ldquo;+ Adicionar etapa&rdquo; abaixo pra montar manualmente.
              </p>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="flex justify-end gap-2 -mb-2">
              <button type="button" onClick={collapseAll}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50"
                title="Minimizar todas as etapas">
                Minimizar todas
              </button>
              <button type="button" onClick={expandAll}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50"
                title="Expandir todas as etapas">
                Expandir todas
              </button>
            </div>
            {presentSections.map((section) => {
              const items = itemsBySection[section] || [];
              const totProdutos = items.filter((it) => !isServicoItem(it)).reduce((s, it) => s + it.totalCents, 0);
              const totServicos = items.filter((it) => isServicoItem(it)).reduce((s, it) => s + it.totalCents, 0);
              const totEtapa = totProdutos + totServicos;
              const isCollapsed = collapsedSections.has(section);
              return (
                <div key={section} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-cyan-50">
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      className="flex items-center gap-2 text-sm font-semibold text-cyan-900 uppercase tracking-wide hover:text-cyan-700"
                      title={isCollapsed ? "Expandir etapa" : "Minimizar etapa"}
                    >
                      <span className="inline-flex w-4 justify-center text-xs">{isCollapsed ? "▶" : "▼"}</span>
                      Etapa: {SECTION_LABEL[section] || section}
                      {isCollapsed && <span className="ml-2 normal-case font-normal text-xs text-slate-600 tabular-nums">— {fmtCurrency(totEtapa)}</span>}
                    </button>
                    <div className="flex items-center gap-2">
                      {!isLocked && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => moveSection(section, -1)}
                            disabled={presentSections.indexOf(section) === 0}
                            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover etapa pra cima"
                          >▲</button>
                          <button
                            onClick={() => moveSection(section, 1)}
                            disabled={presentSections.indexOf(section) === presentSections.length - 1}
                            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover etapa pra baixo"
                          >▼</button>
                        </div>
                      )}
                      <span className="text-xs text-slate-500">{items.length} linha{items.length !== 1 ? "s" : ""}</span>
                      {!isLocked && (
                        <button
                          onClick={() => { setAddSection(section); setShowAdd(true); }}
                          className="rounded bg-cyan-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
                          title="Adicionar linha nesta etapa"
                        >
                          + Linha
                        </button>
                      )}
                    </div>
                  </div>
                  {isCollapsed ? null : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-100">
                        <th className="text-left px-3 py-1.5 w-20" title="Sequencia atual + Endereco estavel da linha (LX) usado em formulas">Seq · Ref</th>
                        <th className="text-left px-3 py-1.5 w-56">Item</th>
                        <th className="text-left px-3 py-1.5">Descricao</th>
                        <th className="text-center px-2 py-1.5 w-16">Un</th>
                        <th className="text-center px-2 py-1.5 w-20">Qtd</th>
                        <th className="text-right px-3 py-1.5 w-28">Valor un.</th>
                        <th className="text-right px-3 py-1.5 w-28">Valor total</th>
                        <th className="w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-xs text-slate-400 py-6">
                            Etapa vazia — clique em &ldquo;+ Linha&rdquo; pra adicionar items.
                          </td>
                        </tr>
                      ) : items.map((it, idx) => (
                        <ItemRow key={it.id} item={it} seq={idx + 1} locked={isLocked}
                          isFirst={idx === 0}
                          isLast={idx === items.length - 1}
                          dimensions={budget.poolDimensions}
                          dias={budget.estimatedDurationDays ?? 0}
                          allItems={budget.items}
                          catalog={catalog}
                          onUpdate={(patch) => updateItem(it.id, patch)}
                          onRemove={() => removeItem(it.id)}
                          onMove={(dir) => moveItem(it, dir)}
                        />
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr className="text-xs">
                        <td colSpan={6} className="px-3 py-1.5 text-right text-slate-600 uppercase font-medium tracking-wide">Total Produtos</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(totProdutos)}</td>
                        <td />
                      </tr>
                      <tr className="text-xs">
                        <td colSpan={6} className="px-3 py-1.5 text-right text-slate-600 uppercase font-medium tracking-wide">Total Servicos</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(totServicos)}</td>
                        <td />
                      </tr>
                      <tr className="text-sm font-semibold bg-cyan-100 border-t border-cyan-200">
                        <td colSpan={6} className="px-3 py-2 text-right text-cyan-900 uppercase tracking-wide">Total {SECTION_LABEL[section] || section}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-cyan-900">{fmtCurrency(totEtapa)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  )}
                </div>
              );
            })}

            {/* Adicionar nova etapa */}
            {!isLocked && (() => {
              const availableSections = SECTION_ORDER.filter((s) => !presentSections.includes(s));
              if (availableSections.length === 0) return null;
              return (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-slate-500">+ Adicionar etapa:</span>
                  {availableSections.map((s) => (
                    <button key={s} type="button"
                      onClick={() => setExtraSections((prev) => [...prev, s])}
                      className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                    >
                      {SECTION_LABEL[s] || s}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Bloco de totais + prazo + condicoes (espelha rodape da aba Linear da planilha) */}
      <BudgetSummaryBlock
        budget={budget}
        locked={budget.status === "APROVADO"}
        paymentTerms={paymentTerms}
        onUpdate={updateBudget}
      />

      {/* Modal adicionar item */}
      {showAdd && (
        <AddItemModal
          catalog={catalog}
          defaultSection={addSection}
          onClose={() => { setShowAdd(false); setAddSection(null); }}
          onSubmit={(p) => { addItem(p); setAddSection(null); }}
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

      {showSaveAsTemplate && (
        <SaveAsTemplateModal
          budgetId={id}
          itemsCount={budget.items.length}
          currentTemplateId={budget.template?.id}
          onClose={() => setShowSaveAsTemplate(false)}
          onSaved={(name, mode) => {
            setShowSaveAsTemplate(false);
            toast(
              mode === "update"
                ? `Modelo "${name}" atualizado. Orcamentos novos vao usar a versao atualizada.`
                : `Modelo "${name}" criado. Use ao criar novo orcamento.`,
              "success",
            );
          }}
        />
      )}
    </div>
  );
}

function ItemRow({ item, seq, locked, isFirst, isLast, dimensions, dias, allItems, catalog, onUpdate, onRemove, onMove }: {
  item: BudgetItem;
  seq?: number;
  locked: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  dimensions?: any;
  dias?: number;
  allItems?: BudgetItem[];
  catalog?: CatalogConfig[];
  onUpdate: (patch: Partial<BudgetItem> & { formulaExpr?: string | null }) => void;
  onRemove: () => void;
  onMove?: (dir: -1 | 1) => void;
}) {
  const [qty, setQty] = useState(item.qty);
  const [showFormula, setShowFormula] = useState(false);
  const [showCatalogPick, setShowCatalogPick] = useState(false);
  const [price, setPrice] = useState((item.unitPriceCents / 100).toFixed(2));
  const [desc, setDesc] = useState(item.description);
  const [slot, setSlot] = useState(item.slotName || "");

  function commit() {
    const newQty = parseFloat(String(qty)) || 0;
    const newPrice = Math.round(parseFloat(price.replace(",", ".")) * 100) || 0;
    const patch: Partial<BudgetItem> = {};
    if (newQty !== item.qty) patch.qty = newQty;
    if (newPrice !== item.unitPriceCents) patch.unitPriceCents = newPrice;
    if (desc !== item.description) patch.description = desc;
    if ((slot || null) !== (item.slotName || null)) patch.slotName = slot || null;
    if (Object.keys(patch).length > 0) onUpdate(patch);
  }

  return (
    <>
    <tr className="border-b border-slate-100 hover:bg-slate-50 last:border-b-0">
      <td className="px-3 py-1.5 text-xs font-mono tabular-nums whitespace-nowrap">
        <span className="text-slate-700 font-semibold">{seq ?? ""}</span>
        {item.cellRef && (
          <span className="ml-1 text-[10px] font-bold text-amber-900 bg-amber-200 border border-amber-400 rounded px-1.5 py-0.5"
            title="Endereco da linha (use em formulas: qty(LX), total(LX))">{item.cellRef}</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        {locked ? (
          <span className="text-sm font-medium text-slate-700">{item.slotName || ""}</span>
        ) : (
          <input
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            onBlur={commit}
            placeholder="ex: Capa Termica"
            className="w-full rounded border border-transparent px-1 py-0.5 text-sm font-medium hover:border-slate-300 focus:border-cyan-500 outline-none placeholder:font-normal placeholder:text-slate-300"
          />
        )}
      </td>
      <td className="px-3 py-1.5">
        {(() => {
          const isLinkedToCatalog = !!(item.productId || item.serviceId);
          if (locked) {
            return <span className="text-sm text-slate-700">{item.description}</span>;
          }
          return (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowCatalogPick(true)}
                className="text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 rounded p-1 text-xs flex-shrink-0"
                title={isLinkedToCatalog ? "Trocar produto/servico (catalogo)" : "Buscar no catalogo"}>
                🔍
              </button>
              {isLinkedToCatalog ? (
                <span
                  className="flex-1 px-1 py-0.5 text-sm text-slate-700 truncate cursor-pointer hover:underline"
                  title="Vinculado ao catalogo. Clique pra trocar."
                  onClick={() => setShowCatalogPick(true)}
                >{item.description}</span>
              ) : (
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onBlur={commit}
                  placeholder="(sem item) — clique na lupa pra escolher"
                  className="flex-1 rounded border border-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-cyan-500 outline-none placeholder:text-slate-300 placeholder:italic"
                />
              )}
            </div>
          );
        })()}
        {item.isAutoCalculated && <span className="ml-2 text-[10px] text-cyan-600">auto</span>}
        {item.isExtra && <span className="ml-2 text-[10px] text-orange-600">extra</span>}
      </td>
      <td className="px-2 py-1.5 text-center text-xs text-slate-500">{item.unit}</td>
      <td className="px-2 py-1.5 text-center">
        {locked ? (
          <span className="text-sm tabular-nums">{item.qty}</span>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button type="button" onClick={() => setShowFormula(true)}
              className={"text-[10px] font-bold px-1 rounded border " + (item.formulaExpr ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-300")}
              title={item.formulaExpr ? `Formula: ${item.formulaExpr}` : "Configurar formula automatica"}
            >fx</button>
            {item.formulaExpr ? (
              <span className="text-sm tabular-nums text-cyan-700 font-medium" title={`= ${item.formulaExpr}`}>{item.qty}</span>
            ) : (
              <input type="number" step="0.01" value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                onBlur={commit}
                className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center text-sm tabular-nums" />
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-1.5 text-right">
        {locked ? <span className="text-sm tabular-nums">{fmtCurrency(item.unitPriceCents)}</span> : (
          <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commit}
            className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right text-sm tabular-nums" />
        )}
      </td>
      <td className="px-3 py-1.5 text-right font-medium text-slate-800 tabular-nums">{fmtCurrency(item.totalCents)}</td>
      <td className="px-2 py-1.5">
        {!locked && (
          <div className="flex items-center justify-end gap-1">
            {onMove && (
              <>
                <button onClick={() => onMove(-1)} disabled={isFirst}
                  className="text-slate-400 hover:text-slate-700 text-[10px] disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Mover linha pra cima">▲</button>
                <button onClick={() => onMove(1)} disabled={isLast}
                  className="text-slate-400 hover:text-slate-700 text-[10px] disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Mover linha pra baixo">▼</button>
              </>
            )}
            <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs ml-1"
              title="Remover linha">✕</button>
          </div>
        )}
      </td>
    </tr>
    {showFormula && (
      <FormulaModal
        initialExpr={item.formulaExpr || ""}
        dimensions={dimensions}
        dias={dias}
        itemDescription={item.description}
        itemUnit={item.unit}
        itemCellRef={item.cellRef}
        otherItems={(allItems ?? [])
          .filter((x) => x.cellRef && x.id !== item.id)
          .map((x) => ({
            cellRef: x.cellRef!,
            description: x.description,
            qty: x.qty,
            total: x.totalCents / 100,
            unitPrice: x.unitPriceCents / 100,
          }))}
        onClose={() => setShowFormula(false)}
        onSave={(expr) => { setShowFormula(false); onUpdate({ formulaExpr: expr }); }}
        onClear={() => { setShowFormula(false); onUpdate({ formulaExpr: "" }); }}
      />
    )}
    {showCatalogPick && catalog && (
      <CatalogPickModal
        catalog={catalog}
        currentSection={item.poolSection}
        onClose={() => setShowCatalogPick(false)}
        onPick={(cfg) => {
          setShowCatalogPick(false);
          const newDesc = cfg.product?.description || cfg.service?.name || item.description;
          const newUnit = cfg.product?.unit || cfg.service?.unit || item.unit;
          const newPriceCents = cfg.product?.salePriceCents ?? cfg.service?.priceCents ?? item.unitPriceCents;
          onUpdate({
            catalogConfigId: cfg.id,
            productId: cfg.product?.id ?? null,
            serviceId: cfg.service?.id ?? null,
            description: newDesc,
            unit: newUnit,
            unitPriceCents: newPriceCents,
          } as any);
          setDesc(newDesc);
        }}
      />
    )}
    </>
  );
}

function AddItemModal({ catalog, defaultSection, onClose, onSubmit }: {
  catalog: CatalogConfig[];
  defaultSection?: string | null;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [mode, setMode] = useState<"catalog" | "free">("catalog");
  const [catalogConfigId, setCatalogConfigId] = useState("");
  const [section, setSection] = useState(defaultSection || "OUTROS");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("UN");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("0,00");
  const [search, setSearch] = useState("");
  const [showAllSections, setShowAllSections] = useState(false);

  // Filtra catalogo: busca por descricao/marca/code/specs + secao
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q.length > 0 ? q.split(/\s+/) : [];
    return catalog.filter((c) => {
      // Filtra por secao se nao "mostrar todas"
      if (!showAllSections && defaultSection && c.poolSection !== defaultSection) return false;
      if (tokens.length === 0) return true;
      const haystack = [
        c.product?.code, c.product?.description, c.product?.brand,
        c.service?.code, c.service?.name,
        SECTION_LABEL[c.poolSection],
        ...(c.product?.technicalSpecs ? Object.values(c.product.technicalSpecs).map(String) : []),
        ...(c.service?.technicalSpecs ? Object.values(c.service.technicalSpecs).map(String) : []),
      ].filter(Boolean).join(" ").toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [catalog, search, defaultSection, showAllSections]);

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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600">Item do catalogo</label>
                {defaultSection && (
                  <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={showAllSections}
                      onChange={(e) => setShowAllSections(e.target.checked)}
                      className="h-3 w-3" />
                    Buscar em todas as etapas
                  </label>
                )}
              </div>
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                  placeholder="Buscar por descricao, marca, codigo, voltagem, vazao..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm focus:border-cyan-500 outline-none" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
                {search && (
                  <button type="button" onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm">✕</button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                {filteredCatalog.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-6">
                    {search ? "Nenhum item encontrado" : "Catalogo vazio"}
                  </div>
                ) : filteredCatalog.slice(0, 200).map((c) => {
                  const isProduct = !!c.product;
                  const item = c.product ?? c.service!;
                  const name = c.product?.description || c.service?.name || "";
                  const code = c.product?.code || c.service?.code;
                  const priceCents = c.product?.salePriceCents ?? c.service?.priceCents ?? 0;
                  const itemUnit = c.product?.unit || c.service?.unit || "UN";
                  const specs = c.product?.technicalSpecs || c.service?.technicalSpecs || null;
                  const specBadges: string[] = [];
                  if (specs) {
                    if (specs.voltagem) specBadges.push(`${specs.voltagem}V`);
                    if (specs.amperagem) specBadges.push(`${specs.amperagem}A`);
                    if (specs.potenciaCv) specBadges.push(`${specs.potenciaCv}cv`);
                    if (specs.potenciaWatts) specBadges.push(`${specs.potenciaWatts}W`);
                    if (specs.vazaoM3h) specBadges.push(`${specs.vazaoM3h}m³/h`);
                    if (specs.pesoKg) specBadges.push(`${specs.pesoKg}kg`);
                    if (specs.eficiencia) specBadges.push(`${specs.eficiencia}%ef`);
                    if (specs.kcalHMax) specBadges.push(`${specs.kcalHMax}kcal/h`);
                  }
                  const isSelected = catalogConfigId === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => handleCatalogPick(c.id)}
                      className={`w-full text-left px-3 py-2 hover:bg-cyan-50 transition ${isSelected ? "bg-cyan-100" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isProduct ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {isProduct ? "PROD" : "SERV"}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">{code}</span>
                            <span className="text-[9px] text-slate-500">{SECTION_LABEL[c.poolSection]}</span>
                          </div>
                          <div className="text-sm font-medium text-slate-900 mt-0.5">{name}</div>
                          {(c.product?.brand || specBadges.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {c.product?.brand && (
                                <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{c.product.brand}</span>
                              )}
                              {specBadges.map((b, i) => (
                                <span key={i} className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded font-mono">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900 tabular-nums">{fmtCurrency(priceCents)}</div>
                          <div className="text-[10px] text-slate-500">/ {itemUnit}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredCatalog.length > 200 && (
                <div className="text-[10px] text-slate-500 text-center">
                  Mostrando 200 de {filteredCatalog.length}. Refine a busca.
                </div>
              )}
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

// ─────────────────────────────────────────────────────────
// BudgetSummaryBlock — espelha o rodape da aba Linear da planilha
// 4 linhas de totais (Subtotal, Impostos, Desconto, Total Geral) + prazo + condicoes.
// Impostos e Desconto sao em %, valores calculados pelo backend.
// ─────────────────────────────────────────────────────────
function BudgetSummaryBlock({ budget, locked, paymentTerms, onUpdate }: {
  budget: Budget;
  locked: boolean;
  paymentTerms: PoolPaymentTerm[];
  onUpdate: (patch: Record<string, any>) => void;
}) {
  const [taxesPct, setTaxesPct] = useState<string>(budget.taxesPercent?.toString().replace(".", ",") ?? "");
  const [discPct, setDiscPct] = useState<string>(budget.discountPercent?.toString().replace(".", ",") ?? "");
  const [startDate, setStartDate] = useState<string>(budget.startDate ? budget.startDate.slice(0, 10) : "");
  const [eqWarranty, setEqWarranty] = useState<string>(budget.equipmentWarranty ?? "");
  const [workWarranty, setWorkWarranty] = useState<string>(budget.workWarranty ?? "");
  // texto livre legado — mantido pra exibir orcamentos antigos no modo locked, nao mais editavel
  const [earlyPct, setEarlyPct] = useState<string>(budget.earlyPaymentDiscountPct?.toString().replace(".", ",") ?? "");

  function parsePct(v: string): number | undefined {
    const n = parseFloat(v.replace(",", "."));
    return isNaN(n) ? undefined : n;
  }

  function commitTaxes() {
    const v = parsePct(taxesPct);
    if (v !== budget.taxesPercent) onUpdate({ taxesPercent: v ?? 0 });
  }
  function commitDiscount() {
    const v = parsePct(discPct);
    if (v !== budget.discountPercent) onUpdate({ discountPercent: v ?? 0 });
  }
  function commitStartDate() {
    const v = startDate || undefined;
    const cur = budget.startDate ? budget.startDate.slice(0, 10) : "";
    if ((v || "") !== cur) onUpdate({ startDate: v });
  }
  function commitEarly() {
    const v = parsePct(earlyPct);
    if (v !== budget.earlyPaymentDiscountPct) onUpdate({ earlyPaymentDiscountPct: v ?? 0 });
  }
  function commitText(field: string, value: string, current: string | null) {
    if (value !== (current ?? "")) onUpdate({ [field]: value || undefined });
  }

  const inputCls = "w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm focus:border-cyan-500 outline-none";
  const lockedValueCls = "text-sm text-slate-700";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* TOTAIS — espelha o bloco laranja da planilha (SUBTOTAL/IMPOSTOS/DESCONTO%/TOTAL GERAL) */}
      <div className="rounded-xl border-2 border-orange-500 bg-orange-100 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-orange-300">
              <td className="px-4 py-2.5 font-semibold text-slate-900 text-right">SUBTOTAL:</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900 w-44">R$ {(budget.subtotalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr className="border-b border-orange-300">
              <td className="px-4 py-2.5 font-semibold text-slate-900 text-right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  IMPOSTOS
                  {locked ? (
                    <span className="text-xs font-medium text-slate-700">({budget.taxesPercent ? `${budget.taxesPercent}%` : "0%"})</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-700">
                      (
                      <input type="text" value={taxesPct} onChange={(e) => setTaxesPct(e.target.value)} onBlur={commitTaxes}
                        placeholder="0" className="w-12 rounded border border-orange-400 bg-white px-1 py-0 text-xs text-right text-slate-900 font-semibold" />
                      %)
                    </span>
                  )}
                  :
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900 w-44">R$ {(budget.taxesCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr className="border-b border-orange-300">
              <td className="px-4 py-2.5 font-semibold text-slate-900 text-right">DESCONTO %:</td>
              <td className="px-4 py-2.5 text-right tabular-nums w-44">
                {locked ? (
                  <span className="font-bold text-slate-900">{budget.discountPercent ? `${budget.discountPercent.toString().replace(".", ",")}%` : "0,00%"}</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    <input type="text" value={discPct} onChange={(e) => setDiscPct(e.target.value)} onBlur={commitDiscount}
                      placeholder="0,00" className="w-16 rounded border border-orange-400 bg-white px-1.5 py-0.5 text-right text-sm tabular-nums font-bold text-slate-900" />
                    <span className="font-bold text-slate-900">%</span>
                  </span>
                )}
              </td>
            </tr>
            <tr className="bg-orange-300">
              <td className="px-4 py-3 font-bold text-slate-900 text-right text-base">TOTAL GERAL:</td>
              <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-slate-900 w-44">
                R$ {(budget.totalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
        {/* Parcelas auto-calculadas a partir da forma de pagamento + totalCents + startDate */}
        <BudgetInstallments
          paymentTerm={budget.paymentTerm}
          totalCents={budget.totalCents}
          startDate={budget.startDate ? new Date(budget.startDate) : null}
        />
      </div>

      {/* PRAZO + CONDICOES */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Condicoes gerais da proposta</div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Previsao de inicio</label>
              {locked ? (
                <div className={lockedValueCls}>{budget.startDate ? new Date(budget.startDate).toLocaleDateString("pt-BR") : "—"}</div>
              ) : (
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onBlur={commitStartDate}
                  className={inputCls} />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Previsao de termino (auto)</label>
              <div className={lockedValueCls}>
                {budget.endDate
                  ? `${new Date(budget.endDate).toLocaleDateString("pt-BR")} (${budget.estimatedDurationDays}d)`
                  : budget.estimatedDurationDays
                    ? `+${budget.estimatedDurationDays}d`
                    : "—"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Calculado por items com unit h/dia (8h por dia)</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Garantia dos equipamentos</label>
            {locked ? <div className={lockedValueCls}>{budget.equipmentWarranty || "—"}</div> : (
              <input value={eqWarranty} onChange={(e) => setEqWarranty(e.target.value)}
                onBlur={() => commitText("equipmentWarranty", eqWarranty, budget.equipmentWarranty)}
                placeholder="De acordo com a garantia do fabricante" className={inputCls} />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Garantia da obra</label>
            {locked ? <div className={lockedValueCls}>{budget.workWarranty || "—"}</div> : (
              <input value={workWarranty} onChange={(e) => setWorkWarranty(e.target.value)}
                onBlur={() => commitText("workWarranty", workWarranty, budget.workWarranty)}
                placeholder="5 anos" className={inputCls} />
            )}
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
              <span>Forma de pagamento</span>
              {!locked && (
                <a href="/quotes/pool/payment-terms" target="_blank" rel="noopener"
                  className="text-cyan-600 hover:text-cyan-800 text-[10px]" title="Cadastrar/editar formas">
                  Gerenciar →
                </a>
              )}
            </label>
            {locked ? (
              <div className={lockedValueCls}>{budget.paymentTerm?.name || budget.paymentTerms || "—"}</div>
            ) : (
              <select value={budget.paymentTermId ?? ""} onChange={(e) => onUpdate({ paymentTermId: e.target.value || null })}
                className={inputCls}>
                <option value="">Selecione...</option>
                {paymentTerms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " ★" : ""}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desconto pra pagamento antecipado (%)</label>
            {locked ? (
              <div className={lockedValueCls}>{budget.earlyPaymentDiscountPct ? `${budget.earlyPaymentDiscountPct}%` : "—"}</div>
            ) : (
              <input type="text" value={earlyPct} onChange={(e) => setEarlyPct(e.target.value)} onBlur={commitEarly}
                placeholder="5,00" className={inputCls} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BudgetInstallments — parcelas geradas a partir do PaymentTerm.
// Layout: 1 coluna ate 6 parcelas, 2 colunas acima de 6 (compacta lista longa).
// Soma das parcelas == totalCents (a ultima ajusta o resto pra exato).
// ─────────────────────────────────────────────────────────
function BudgetInstallments({ paymentTerm, totalCents, startDate }: {
  paymentTerm: PoolPaymentTerm | null;
  totalCents: number;
  startDate: Date | null;
}) {
  if (!paymentTerm || totalCents <= 0) {
    return (
      <div className="px-4 py-3 text-xs text-slate-600 border-t border-orange-300 bg-orange-50">
        Selecione uma forma de pagamento{!startDate ? " e uma data de inicio" : ""} pra gerar as parcelas automaticamente.
      </div>
    );
  }
  if (!startDate) {
    return (
      <div className="px-4 py-3 text-xs text-slate-600 border-t border-orange-300 bg-orange-50">
        Defina a Previsao de inicio (em Condicoes Gerais) pra calcular as datas das parcelas.
      </div>
    );
  }
  const installments = generateInstallments(paymentTerm, totalCents, startDate);
  const useTwoCols = installments.length > 6;
  const sumCents = installments.reduce((s, i) => s + i.cents, 0);
  const ok = sumCents === totalCents;
  return (
    <div className="border-t-2 border-orange-400 bg-orange-50">
      <div className="px-4 py-2 bg-orange-200/60 text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center justify-between">
        <span>Parcelas — {paymentTerm.name}</span>
        <span className={"text-[10px] normal-case font-medium " + (ok ? "text-green-700" : "text-red-700")}>
          {installments.length} parc. · soma R$ {(sumCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className={useTwoCols ? "grid grid-cols-2 gap-x-4" : ""}>
        {installments.map((p) => (
          <div key={p.idx} className="flex items-center gap-2 px-4 py-1 text-xs border-b border-orange-200 last:border-b-0 odd:bg-orange-100/40">
            <span className="font-mono text-slate-500 w-7 text-right">{String(p.idx).padStart(2, "0")}.</span>
            <span className="text-slate-700 w-20 tabular-nums">{p.date.toLocaleDateString("pt-BR")}</span>
            <span className="flex-1 truncate text-slate-500">{p.label}</span>
            <span className="font-semibold text-slate-900 tabular-nums">R$ {(p.cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────
// FormulaModal — editor de expressao pra auto-calcular qty.
// Avaliador local (deve casar com backend formula-eval.ts).
// Variaveis: length, width, depth, area, perimeter, volume, dias.
// Funcoes: ceil(x), floor(x), round(x), min(a,b), max(a,b).
// Referencias: qty(LX), total(LX), unitPrice(LX) -> outras linhas via cellRef.
// ─────────────────────────────────────────────────────────
const FORMULA_VARS = ['length', 'width', 'depth', 'area', 'perimeter', 'volume', 'dias'] as const;
const FORMULA_FUNCTIONS = ['ceil', 'floor', 'round', 'min', 'max'] as const;
const CELL_REF_FUNCTIONS = ['qty', 'total', 'unitPrice'] as const;

type CellRefDataLocal = { qty: number; total: number; unitPrice: number };

function evalLocal(
  expr: string,
  vars: Record<string, number>,
  cellRefs: Map<string, CellRefDataLocal> = new Map(),
): { ok: boolean; value?: number; error?: string } {
  if (!expr.trim()) return { ok: false, error: 'vazia' };
  let s = expr;
  // Substitui chamadas a cellRef ANTES das vars (evita confundir 'L1' com identifier solto)
  for (const fn of CELL_REF_FUNCTIONS) {
    s = s.replace(
      new RegExp('\\b' + fn + '\\s*\\(\\s*(L\\d+)\\s*\\)', 'g'),
      (_m, ref: string) => {
        const data = cellRefs.get(ref);
        if (!data) throw new Error('linha ' + ref + ' nao existe');
        return '(' + (Number(data[fn as keyof CellRefDataLocal]) || 0) + ')';
      },
    );
  }
  for (const k of FORMULA_VARS) {
    s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), '(' + (vars[k] || 0) + ')');
  }
  // Remove nomes de funcoes whitelisted antes de validar identifiers
  const fnPattern = new RegExp('\\b(' + FORMULA_FUNCTIONS.join('|') + ')\\b', 'g');
  const stripped = s.replace(fnPattern, '');
  if (/[a-zA-Z_]/.test(stripped)) return { ok: false, error: 'variavel ou funcao desconhecida' };
  if (!/^[\d.\s+\-*/(),]*$/.test(stripped)) return { ok: false, error: 'caracter invalido' };
  try {
    // eslint-disable-next-line no-new-func
    const r = Function('ceil', 'floor', 'round', 'min', 'max',
      '"use strict"; return (' + s + ');',
    )(Math.ceil, Math.floor, Math.round, Math.min, Math.max);
    if (typeof r !== 'number' || !isFinite(r)) return { ok: false, error: 'resultado invalido' };
    return { ok: true, value: r };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'sintaxe invalida' };
  }
}

type FormulaRecipe = { label: string; expr: string; hint: string };

const FORMULA_RECIPES_PISCINA: FormulaRecipe[] = [
  { label: "Area da piscina", expr: "area", hint: "Liner, capa termica, manta - geralmente 1× area" },
  { label: "Area × 2 (capa termica)", expr: "area * 2", hint: "Capa em 2 camadas" },
  { label: "Volume da piscina", expr: "volume", hint: "Bombas, tratamento por m3" },
  { label: "Perimetro (borda)", expr: "perimeter", hint: "Borda corrida em metros lineares" },
  { label: "Borda + 10%", expr: "perimeter * 1.1", hint: "Margem de seguranca/perda" },
  { label: "Caixa 18kg (impermeabilizante)", expr: "ceil(area * 0.5 / 18)", hint: "0.5 kg/m2 - arredonda pra cima" },
  { label: "Saco cimento 50kg", expr: "ceil(volume * 350 / 50)", hint: "350 kg/m3 de concreto - arredonda pra cima" },
  { label: "Tijolos por m2 (12u/m2)", expr: "ceil(area * 12)", hint: "Considera 12 tijolos por m2" },
  { label: "Diaria por dia de obra", expr: "dias", hint: "Quantidade = nº de dias da obra (auto)" },
  { label: "Diaria × 2 (2 funcionarios)", expr: "dias * 2", hint: "2 pessoas trabalhando juntas" },
  { label: "Diaria - 2 dias (sem inicio/fim)", expr: "max(0, dias - 2)", hint: "Exclui prep e finalizacao" },
  { label: "30% sobre total da linha L7", expr: "total(L7) * 0.3", hint: "Ex: comissao/margem sobre outra linha" },
  { label: "Mesma quantidade da linha L5", expr: "qty(L5)", hint: "Espelha qty de outra linha (parafuso casa com furo)" },
];

const FORMULA_FN_HELP: Record<typeof FORMULA_FUNCTIONS[number], string> = {
  ceil: "Arredonda PRA CIMA (50.1 → 51, 49.9 → 50). Usar pra embalagens fechadas.",
  floor: "Arredonda PRA BAIXO (50.9 → 50). Pouco usado em compras (perde material).",
  round: "Arredondamento normal (50.4 → 50, 50.5 → 51).",
  min: "Menor entre 2 valores: min(area, 100). Limita maximo.",
  max: "Maior entre 2 valores: max(area, 10). Garante minimo.",
};

type OtherItemForModal = { cellRef: string; description: string; qty: number; total: number; unitPrice: number };

function FormulaModal({ initialExpr, dimensions, dias, itemDescription, itemUnit, itemCellRef, otherItems, onClose, onSave, onClear }: {
  initialExpr: string;
  dimensions: any;
  dias?: number;
  itemDescription?: string;
  itemUnit?: string;
  itemCellRef?: string | null;
  otherItems?: OtherItemForModal[];
  onClose: () => void;
  onSave: (expr: string) => void;
  onClear: () => void;
}) {
  const [expr, setExpr] = useState(initialExpr);
  const inputRef = useRef<HTMLInputElement>(null);

  const vars: Record<string, number> = {
    length: Number(dimensions?.length) || 0,
    width: Number(dimensions?.width) || 0,
    depth: Number(dimensions?.depth) || 0,
    area: Number(dimensions?.area) || 0,
    perimeter: Number(dimensions?.perimeter) || 0,
    volume: Number(dimensions?.volume) || 0,
    dias: Number(dias) || 0,
  };
  const cellRefMap = new Map<string, CellRefDataLocal>();
  for (const o of otherItems ?? []) {
    if (o.cellRef && o.cellRef !== itemCellRef) {
      cellRefMap.set(o.cellRef, { qty: o.qty, total: o.total, unitPrice: o.unitPrice });
    }
  }
  const VAR_GROUPS: Record<string, { label: string; vars: string[] }> = {
    dimensoes: {
      label: "Dimensoes da piscina",
      vars: ["length", "width", "depth", "area", "perimeter", "volume"],
    },
    tempo: {
      label: "Tempo / Prazo",
      vars: ["dias"],
    },
  };
  const VAR_DESCRIPTIONS: Record<string, string> = {
    length: "Comprimento (m)",
    width: "Largura (m)",
    depth: "Profundidade (m)",
    area: "Area da piscina (m²)",
    perimeter: "Perimetro / borda (m)",
    volume: "Volume (m³)",
    dias: "Duracao estimada da obra (dias)",
  };

  const result = evalLocal(expr, vars, cellRefMap);

  function insert(text: string) {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? expr.length;
      const end = el.selectionEnd ?? expr.length;
      const next = expr.slice(0, start) + text + expr.slice(end);
      setExpr(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
      });
    } else {
      setExpr((p) => (p + (p.endsWith(" ") || p === "" ? "" : " ") + text).trim());
    }
  }

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-violet-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Formula automatica de quantidade</h3>
                {itemDescription && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Linha: <span className="font-medium text-slate-800">{itemDescription}</span>
                    {itemUnit && <span className="text-slate-500"> · unidade: {itemUnit}</span>}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Expressao + preview */}
              <div className="rounded-lg border-2 border-cyan-200 bg-cyan-50/50 p-4">
                <label className="block text-xs font-bold uppercase tracking-wide text-cyan-900 mb-2">Expressao</label>
                <input ref={inputRef} value={expr} onChange={(e) => setExpr(e.target.value)} autoFocus
                  placeholder="Ex: ceil(area * 0.5 / 18)"
                  className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-base font-mono focus:border-cyan-500 outline-none" />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm">
                    {result.ok ? (
                      <span className="text-green-700">
                        = <span className="text-2xl font-extrabold tabular-nums text-green-800">{result.value!.toFixed(4).replace(/\.?0+$/, "")}</span>
                        <span className="text-xs text-slate-500 ml-2">resultado da quantidade</span>
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium">⚠ {result.error}</span>
                    )}
                  </div>
                  {expr && (
                    <button type="button" onClick={() => setExpr("")}
                      className="text-xs text-slate-500 hover:text-slate-800">limpar</button>
                  )}
                </div>
              </div>

              {/* Receitas prontas */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  ⚡ Receitas prontas (clique pra usar)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {FORMULA_RECIPES_PISCINA.map((r) => (
                    <button key={r.label} type="button" onClick={() => setExpr(r.expr)}
                      className="text-left rounded border border-slate-200 hover:border-amber-400 hover:bg-amber-50 px-3 py-1.5 group">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-amber-900">{r.label}</div>
                      <div className="font-mono text-[11px] text-cyan-700">{r.expr}</div>
                      <div className="text-[10px] text-slate-500">{r.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Variaveis */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  📐 Variaveis (clique pra inserir no cursor)
                </div>
                {Object.entries(VAR_GROUPS).map(([key, group]) => (
                  <div key={key} className="mb-2">
                    <div className="text-[11px] font-medium text-slate-600 mb-1">{group.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.vars.map((k) => (
                        <button key={k} type="button" onClick={() => insert(k)}
                          title={VAR_DESCRIPTIONS[k]}
                          className="inline-flex items-center gap-2 text-xs rounded border-2 border-cyan-200 bg-white hover:bg-cyan-50 hover:border-cyan-400 px-2.5 py-1.5 transition">
                          <span className="font-mono font-bold text-cyan-700">{k}</span>
                          <span className="text-slate-500 text-[10px]">{VAR_DESCRIPTIONS[k]}</span>
                          <span className="font-mono text-slate-900 font-bold tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">{vars[k]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Funcoes */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  🧮 Funcoes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {FORMULA_FUNCTIONS.map((fn) => (
                    <button key={fn} type="button" onClick={() => insert(fn + "(")}
                      className="text-left rounded border border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 px-3 py-1.5">
                      <span className="font-mono font-bold text-violet-800">{fn}(...)</span>
                      <div className="text-[11px] text-slate-600 mt-0.5">{FORMULA_FN_HELP[fn]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Outras linhas (referencias) */}
              {otherItems && otherItems.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                    🔗 Referencias a outras linhas
                  </div>
                  <div className="text-[11px] text-slate-600 mb-2">
                    Use <code className="bg-slate-100 px-1 rounded">qty(LX)</code> pra puxar a quantidade,{" "}
                    <code className="bg-slate-100 px-1 rounded">total(LX)</code> pro valor total em R$,{" "}
                    <code className="bg-slate-100 px-1 rounded">unitPrice(LX)</code> pro preco unitario.
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {otherItems
                      .filter((o) => o.cellRef && o.cellRef !== itemCellRef)
                      .map((o) => (
                        <div key={o.cellRef} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-amber-50 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-mono font-bold text-amber-700 mr-2">{o.cellRef}</span>
                            <span className="text-slate-800 truncate">{o.description}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap">
                            qty {o.qty} · R$ {o.total.toFixed(2)}
                          </div>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => insert(`qty(${o.cellRef})`)}
                              className="rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800"
                              title={`Insere qty(${o.cellRef}) — quantidade da linha`}>qty</button>
                            <button type="button" onClick={() => insert(`total(${o.cellRef})`)}
                              className="rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800"
                              title={`Insere total(${o.cellRef}) — total em R$ da linha`}>total</button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Operadores e sintaxe */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <div className="text-[11px] font-semibold text-slate-700 mb-1">Sintaxe</div>
                <div className="text-[11px] text-slate-600 leading-relaxed space-y-1">
                  <div>Operadores: <code className="bg-white border border-slate-300 px-1.5 rounded">+ − × ÷ ( )</code> · Decimal so com <code className="bg-white border border-slate-300 px-1.5 rounded">.</code> (ponto) · Virgula = separador de funcao</div>
                  <div className="text-slate-500">Ex: <code className="bg-white border border-slate-300 px-1.5 rounded">area * 1.05</code> (5% margem) · <code className="bg-white border border-slate-300 px-1.5 rounded">ceil(volume / 18)</code> · <code className="bg-white border border-slate-300 px-1.5 rounded">max(perimeter, 10)</code></div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
              <button type="button" onClick={onClear}
                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">
                🗑 Remover formula
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button>
                <button type="button" disabled={!result.ok} onClick={() => onSave(expr)}
                  className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  ✓ Aplicar formula
                </button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}


// ─────────────────────────────────────────────────────────
// SaveAsTemplateModal — captura snapshot do orcamento atual e cria PoolBudgetTemplate.
// ─────────────────────────────────────────────────────────
type ExistingTemplate = { id: string; name: string; description?: string | null; isDefault: boolean; updatedAt?: string };

function SaveAsTemplateModal({ budgetId, itemsCount, currentTemplateId, onClose, onSaved }: {
  budgetId: string;
  itemsCount: number;
  currentTemplateId?: string | null;
  onClose: () => void;
  onSaved: (name: string, mode: "new" | "update") => void;
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ExistingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [mode, setMode] = useState<"new" | "update">(currentTemplateId ? "update" : "new");
  const [updateTemplateId, setUpdateTemplateId] = useState<string>(currentTemplateId ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<ExistingTemplate[] | { data: ExistingTemplate[] }>("/pool-budget-templates")
      .then((r) => {
        const list = Array.isArray(r) ? r : (r as any)?.data ?? [];
        setTemplates(list);
        // Se nao ha modelos, forca modo "new"
        if (list.length === 0) setMode("new");
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // Quando seleciona modelo pra atualizar, pre-popula nome/descricao
  useEffect(() => {
    if (mode === "update" && updateTemplateId) {
      const t = templates.find((x) => x.id === updateTemplateId);
      if (t) {
        setName(t.name);
        setDescription(t.description ?? "");
        setIsDefault(t.isDefault);
      }
    }
  }, [updateTemplateId, mode, templates]);

  const selectedTemplate = mode === "update" ? templates.find((t) => t.id === updateTemplateId) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "new" && !name.trim()) { toast("Nome obrigatorio", "error"); return; }
    if (mode === "update" && !updateTemplateId) { toast("Selecione um modelo pra atualizar", "error"); return; }
    if (mode === "update" && !confirm(`Sobrescrever o modelo "${selectedTemplate?.name}" com o estado atual deste orcamento? Os ${itemsCount} items + defaults atuais vao SUBSTITUIR o conteudo do modelo.`)) return;
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim() || undefined,
        description: description || undefined,
        isDefault,
      };
      if (mode === "update") payload.templateId = updateTemplateId;
      await api.post(`/pool-budgets/${budgetId}/save-as-template`, payload);
      onSaved(name.trim() || selectedTemplate?.name || "modelo", mode);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao salvar modelo", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Salvar como modelo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1">
          <button type="button" onClick={() => setMode("new")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${mode === "new" ? "bg-white shadow text-indigo-700" : "text-slate-600 hover:text-slate-900"}`}>
            Novo modelo
          </button>
          <button type="button" onClick={() => setMode("update")} disabled={templates.length === 0}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${mode === "update" ? "bg-white shadow text-orange-700" : "text-slate-600 hover:text-slate-900"} disabled:opacity-40 disabled:cursor-not-allowed`}>
            Atualizar existente
          </button>
        </div>

        <p className="text-xs text-slate-600">
          Captura {itemsCount} item{itemsCount !== 1 ? "s" : ""} (etapas/formulas/precos) + impostos, desconto, garantias e forma de pagamento.
          {mode === "update"
            ? <span className="text-orange-700 font-medium"> O conteudo do modelo selecionado vai ser SUBSTITUIDO.</span>
            : <span className="text-slate-500"> Proximo orcamento criado com este modelo ja vem populado.</span>}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === "update" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo a atualizar</label>
              <select value={updateTemplateId} onChange={(e) => setUpdateTemplateId(e.target.value)} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">{loadingTemplates ? "Carregando..." : "Selecione um modelo..."}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.isDefault ? " ★" : ""}{currentTemplateId === t.id ? " (modelo deste orcamento)" : ""}
                  </option>
                ))}
              </select>
              {selectedTemplate?.description && (
                <div className="mt-1 text-[11px] text-slate-500 italic">{selectedTemplate.description}</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nome do modelo {mode === "update" && <span className="text-slate-400">(opcional — mantem o atual se vazio)</span>}
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              required={mode === "new"}
              autoFocus={mode === "new"}
              placeholder={mode === "new" ? "Ex: Padrao Juliano Azul" : selectedTemplate?.name}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descricao (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas internas sobre quando usar este modelo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Marcar como padrao (auto-selecionado em novos orcamentos)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${mode === "update" ? "bg-orange-600 hover:bg-orange-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
              {saving ? "Salvando..." : (mode === "update" ? "Sobrescrever modelo" : "Criar novo modelo")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────
// CatalogPickModal — busca produto/serviço pra trocar item de uma linha existente
// ─────────────────────────────────────────────────────────
function CatalogPickModal({ catalog, currentSection, onClose, onPick }: {
  catalog: CatalogConfig[];
  currentSection?: string;
  onClose: () => void;
  onPick: (cfg: CatalogConfig) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q.length > 0 ? q.split(/\s+/) : [];
    return catalog.filter((c) => {
      if (!showAll && currentSection && c.poolSection !== currentSection) return false;
      if (tokens.length === 0) return true;
      const haystack = [
        c.product?.code, c.product?.description, c.product?.brand,
        c.service?.code, c.service?.name,
        SECTION_LABEL[c.poolSection],
        ...(c.product?.technicalSpecs ? Object.values(c.product.technicalSpecs).map(String) : []),
        ...(c.service?.technicalSpecs ? Object.values(c.service.technicalSpecs).map(String) : []),
      ].filter(Boolean).join(" ").toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [catalog, search, currentSection, showAll]);

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">Buscar item do catalogo</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-2 overflow-hidden flex flex-col flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
                {currentSection && (
                  <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-3 w-3" />
                    Buscar em todas as etapas
                  </label>
                )}
              </div>
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                  placeholder="Buscar por descricao, marca, codigo, voltagem, vazao..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm focus:border-cyan-500 outline-none" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
                {search && (
                  <button type="button" onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm">✕</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                {filtered.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-6">
                    {search ? "Nenhum item encontrado" : "Catalogo vazio"}
                  </div>
                ) : filtered.slice(0, 200).map((c) => {
                  const isProduct = !!c.product;
                  const name = c.product?.description || c.service?.name || "";
                  const code = c.product?.code || c.service?.code;
                  const priceCents = c.product?.salePriceCents ?? c.service?.priceCents ?? 0;
                  const itemUnit = c.product?.unit || c.service?.unit || "UN";
                  const specs = c.product?.technicalSpecs || c.service?.technicalSpecs || null;
                  const specBadges: string[] = [];
                  if (specs) {
                    if (specs.voltagem) specBadges.push(`${specs.voltagem}V`);
                    if (specs.amperagem) specBadges.push(`${specs.amperagem}A`);
                    if (specs.potenciaCv) specBadges.push(`${specs.potenciaCv}cv`);
                    if (specs.potenciaWatts) specBadges.push(`${specs.potenciaWatts}W`);
                    if (specs.vazaoM3h) specBadges.push(`${specs.vazaoM3h}m³/h`);
                    if (specs.pesoKg) specBadges.push(`${specs.pesoKg}kg`);
                    if (specs.eficiencia) specBadges.push(`${specs.eficiencia}%ef`);
                  }
                  return (
                    <button key={c.id} type="button" onClick={() => onPick(c)}
                      className="w-full text-left px-3 py-2 hover:bg-cyan-50 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isProduct ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {isProduct ? "PROD" : "SERV"}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">{code}</span>
                            <span className="text-[9px] text-slate-500">{SECTION_LABEL[c.poolSection]}</span>
                          </div>
                          <div className="text-sm font-medium text-slate-900 mt-0.5">{name}</div>
                          {(c.product?.brand || specBadges.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {c.product?.brand && (
                                <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{c.product.brand}</span>
                              )}
                              {specBadges.map((b, i) => (
                                <span key={i} className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded font-mono">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900 tabular-nums">{fmtCurrency(priceCents)}</div>
                          <div className="text-[10px] text-slate-500">/ {itemUnit}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
