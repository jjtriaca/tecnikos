"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PartnerCombobox from "@/components/PartnerCombobox";

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

// ─────────────────────────────────────────────────────────
// useColumnWidths — persiste larguras das colunas em localStorage por usuario.
// Aceita defaults inicialmente; substitui pelos persistidos quando montar.
// ─────────────────────────────────────────────────────────
const COL_WIDTHS_KEY = "pool-budget-col-widths-v1";
type PoolBudgetColKey = "seq" | "item" | "desc" | "un" | "qty" | "valorUn" | "valorTotal" | "actions";
const DEFAULT_COL_WIDTHS: Record<PoolBudgetColKey, number> = {
  seq: 80, item: 224, desc: 320, un: 64, qty: 80, valorUn: 112, valorTotal: 112, actions: 80,
};
function useColumnWidths() {
  const [widths, setWidths] = useState<Record<PoolBudgetColKey, number>>(DEFAULT_COL_WIDTHS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COL_WIDTHS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setWidths({ ...DEFAULT_COL_WIDTHS, ...parsed });
      }
    } catch {}
  }, []);
  function setWidth(key: PoolBudgetColKey, w: number) {
    setWidths((prev) => {
      const next = { ...prev, [key]: Math.max(40, Math.round(w)) };
      try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function reset() {
    setWidths(DEFAULT_COL_WIDTHS);
    try { localStorage.removeItem(COL_WIDTHS_KEY); } catch {}
  }
  return { widths, setWidth, reset };
}

// Componente <th> com handle de drag pra resize
function ResizableTh({ colKey, width, setWidth, className, children, ...rest }: {
  colKey: PoolBudgetColKey;
  width: number;
  setWidth: (k: PoolBudgetColKey, w: number) => void;
  className?: string;
  children?: React.ReactNode;
  title?: string;
}) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    function onMove(ev: MouseEvent) {
      setWidth(colKey, startW + (ev.clientX - startX));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }
  return (
    <th style={{ width, position: "relative" }} className={className} {...rest}>
      {children}
      <span
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-cyan-400/60"
        title="Arraste pra ajustar a largura"
      />
    </th>
  );
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
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const { widths: colWidths, setWidth: setColWidth, reset: resetColWidths } = useColumnWidths();

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
      {/* Header sticky com gradient + colapsavel */}
      <div className="sticky top-0 z-30 -mx-6 -mt-6 px-6 pt-4 pb-3 bg-gradient-to-br from-cyan-50 via-white to-blue-50 border-b border-cyan-100 shadow-sm backdrop-blur-sm">
        {/* Linha topo: voltar + botao colapsar + status + acoes */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/quotes?tab=obras" className="text-xs text-slate-500 hover:text-cyan-700 inline-flex items-center gap-1">
            ← Voltar pra Obras
          </Link>
          <div className="flex flex-wrap items-center gap-1.5">
            {budget.project && (
              <Link href={`/quotes/pool/projects/${budget.project.id}`}
                className="rounded-md border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100">
                Ver obra
              </Link>
            )}
            {!isLocked && (budget.status === "RASCUNHO" || budget.status === "ENVIADO") && (
              <button onClick={() => setConfirmAction("approve")}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">
                ✓ Aprovar
              </button>
            )}
            {!isLocked && (
              <button onClick={() => setConfirmAction("reject")}
                className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                Rejeitar
              </button>
            )}
            {budget.status !== "CANCELADO" && (
              <button onClick={() => setConfirmAction("cancel")}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
            )}
            {budget.status === "RASCUNHO" && (
              <button onClick={() => setConfirmAction("delete")}
                className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                Excluir
              </button>
            )}
            {!isLocked && budget.items.length > 0 && (
              <button onClick={() => setShowSaveAsTemplate(true)}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                title="Salva todos os items + impostos/desconto/garantias/forma pagto como modelo">
                💾 Salvar modelo
              </button>
            )}
            <button onClick={() => setHeaderCollapsed((v) => !v)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              title={headerCollapsed ? "Expandir cabecalho" : "Colapsar cabecalho (mantem visivel ao rolar)"}>
              {headerCollapsed ? "▼" : "▲"}
            </button>
          </div>
        </div>

        {/* Versao colapsada: 1 linha compacta */}
        {headerCollapsed ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base font-bold text-slate-900 truncate">{budget.title}</span>
              <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.cls}`}>{status.label}</span>
            </div>
            <span className="text-xs text-slate-500">
              <span className="font-mono">{budget.code || "—"}</span> · {budget.clientPartner?.name}
            </span>
            <span className="ml-auto flex items-center gap-3 text-xs">
              <span className="text-slate-500">📐 {budget.poolDimensions?.length}×{budget.poolDimensions?.width}×{budget.poolDimensions?.depth}m</span>
              <span className="text-slate-500">📋 {budget.items.length} items</span>
              <span className="font-bold text-emerald-700">💰 {fmtCurrency(budget.totalCents)}</span>
            </span>
          </div>
        ) : (
          <>
            {/* Versao expandida: titulo + cards bonitos */}
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{budget.title}</h1>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                  {!isLocked && (
                    <Link href={`/quotes/pool/new?edit=${budget.id}`}
                      className="text-[11px] text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 px-2 py-0.5 rounded border border-slate-200"
                      title="Editar tudo (cliente, dimensoes, capa, validade)">
                      ✏️ Editar dados
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-mono text-slate-600">{budget.code || "—"}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  Cliente: <strong className="text-slate-700">{budget.clientPartner?.name}</strong>
                </p>
              </div>
            </div>

            {/* 4 cards profissionais */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Valor total — destaque com gradient */}
              <div className="relative rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 overflow-hidden shadow-sm">
                <div className="absolute -top-2 -right-2 text-3xl opacity-10">💰</div>
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Valor total</div>
                  <div className="mt-0.5 text-xl md:text-2xl font-extrabold text-emerald-900 tabular-nums">{fmtCurrency(budget.totalCents)}</div>
                  <div className="text-[10px] text-emerald-700/70">Subtotal: {fmtCurrency(budget.subtotalCents)}</div>
                </div>
              </div>

              {/* Dimensoes — clicavel */}
              <div onClick={() => !isLocked && router.push(`/quotes/pool/new?edit=${budget.id}`)}
                className={"relative rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 overflow-hidden shadow-sm transition " +
                  (!isLocked ? "cursor-pointer hover:border-cyan-400 hover:shadow" : "")}
                title={!isLocked ? "Clique pra editar dimensoes" : ""}>
                <div className="absolute -top-2 -right-2 text-3xl opacity-10">📐</div>
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700 flex items-center justify-between">
                    Dimensoes da Piscina
                    {!isLocked && <span className="text-[10px] text-cyan-600/60 normal-case">✏️</span>}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-cyan-900 tabular-nums">
                    {budget.poolDimensions?.length}×{budget.poolDimensions?.width}×{budget.poolDimensions?.depth} m
                  </div>
                  <div className="text-[10px] text-cyan-700/70 tabular-nums">
                    Area {budget.poolDimensions?.area?.toFixed(1)} m² · Vol {budget.poolDimensions?.volume?.toFixed(1)} m³
                  </div>
                </div>
              </div>

              {/* Validade — clicavel */}
              <div onClick={() => !isLocked && router.push(`/quotes/pool/new?edit=${budget.id}`)}
                className={"relative rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3 overflow-hidden shadow-sm transition " +
                  (!isLocked ? "cursor-pointer hover:border-amber-400 hover:shadow" : "")}
                title={!isLocked ? "Clique pra editar validade" : ""}>
                <div className="absolute -top-2 -right-2 text-3xl opacity-10">📅</div>
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 flex items-center justify-between">
                    Validade
                    {!isLocked && <span className="text-[10px] text-amber-600/60 normal-case">✏️</span>}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-amber-900 tabular-nums">{budget.validityDays} dias</div>
                  {budget.expiresAt && (
                    <div className="text-[10px] text-amber-700/70">Expira {new Date(budget.expiresAt).toLocaleDateString("pt-BR")}</div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="relative rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-3 overflow-hidden shadow-sm">
                <div className="absolute -top-2 -right-2 text-3xl opacity-10">📋</div>
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Items</div>
                  <div className="mt-0.5 text-xl md:text-2xl font-extrabold text-violet-900 tabular-nums">{budget.items.length}</div>
                  <div className="text-[10px] text-violet-700/70">em {Object.keys(itemsBySection).length} secoes</div>
                </div>
              </div>
            </div>
          </>
        )}
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
                  <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-100">
                        <ResizableTh colKey="seq" width={colWidths.seq} setWidth={setColWidth}
                          className="text-left px-3 py-1.5"
                          title="Sequencia atual + Endereco estavel da linha (LX) usado em formulas">Seq · Ref</ResizableTh>
                        <ResizableTh colKey="item" width={colWidths.item} setWidth={setColWidth}
                          className="text-left px-3 py-1.5">Item</ResizableTh>
                        <ResizableTh colKey="desc" width={colWidths.desc} setWidth={setColWidth}
                          className="text-left px-3 py-1.5">Descricao</ResizableTh>
                        <ResizableTh colKey="un" width={colWidths.un} setWidth={setColWidth}
                          className="text-center px-2 py-1.5">Un</ResizableTh>
                        <ResizableTh colKey="qty" width={colWidths.qty} setWidth={setColWidth}
                          className="text-center px-2 py-1.5">Qtd</ResizableTh>
                        <ResizableTh colKey="valorUn" width={colWidths.valorUn} setWidth={setColWidth}
                          className="text-right px-3 py-1.5">Valor un.</ResizableTh>
                        <ResizableTh colKey="valorTotal" width={colWidths.valorTotal} setWidth={setColWidth}
                          className="text-right px-3 py-1.5">Valor total</ResizableTh>
                        <ResizableTh colKey="actions" width={colWidths.actions} setWidth={setColWidth} className=""></ResizableTh>
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
                          environmentParams={budget.environmentParams}
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
        onManagePaymentTerms={() => setShowPaymentTerms(true)}
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

      {showEditHeader && (
        <EditBudgetHeaderModal
          budget={budget}
          onClose={() => setShowEditHeader(false)}
          onSaved={async () => { setShowEditHeader(false); await load(); }}
        />
      )}

      {showPaymentTerms && (
        <PaymentTermsModal
          onClose={async () => {
            setShowPaymentTerms(false);
            // recarrega a lista de termos no pai pra refletir mudancas
            try {
              const r = await api.get<PoolPaymentTerm[]>("/pool-payment-terms");
              setPaymentTerms(r || []);
            } catch {}
          }}
        />
      )}

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

function ItemRow({ item, seq, locked, isFirst, isLast, dimensions, environmentParams, dias, allItems, catalog, onUpdate, onRemove, onMove }: {
  item: BudgetItem;
  seq?: number;
  locked: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  dimensions?: any;
  environmentParams?: any;
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
        {locked ? (
          <span className="text-sm text-slate-700">{item.description}</span>
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setShowCatalogPick(true)}
              className="text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 rounded p-1 text-xs flex-shrink-0"
              title="Buscar no catalogo">
              🔍
            </button>
            <span
              onClick={() => setShowCatalogPick(true)}
              title="Clique pra escolher/trocar item do catalogo"
              className={
                "flex-1 px-1 py-0.5 text-sm truncate cursor-pointer hover:bg-cyan-50 rounded " +
                (item.description ? "text-slate-700 hover:underline" : "text-slate-300 italic")
              }>
              {item.description || "(sem item) — clique pra escolher"}
            </span>
          </div>
        )}
        {item.isAutoCalculated && <span className="ml-2 text-[10px] text-cyan-600">auto</span>}
        {item.isExtra && <span className="ml-2 text-[10px] text-orange-600">extra</span>}
      </td>
      <td className="px-2 py-1.5 text-center text-xs text-slate-500">{item.unit}</td>
      <td className="px-2 py-1.5 text-center">
        {locked ? (
          <div className="flex flex-col items-center">
            <span className="text-sm tabular-nums">{item.qty}</span>
            {item.formulaExpr && (
              <span className="text-[9px] font-mono text-cyan-600 truncate max-w-full" title={`= ${item.formulaExpr}`}>= {item.formulaExpr}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <div className="inline-flex items-center gap-1">
              <button type="button" onClick={() => setShowFormula(true)}
                className={"text-[10px] font-bold px-1 rounded border " + (item.formulaExpr ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-300")}
                title={item.formulaExpr ? `Editar formula (atual: ${item.formulaExpr})` : "Configurar formula automatica"}
              >fx</button>
              {item.formulaExpr ? (
                <button type="button" onClick={() => setShowFormula(true)}
                  className="text-sm tabular-nums text-cyan-700 font-medium hover:underline"
                  title="Clique pra editar a formula">{item.qty}</button>
              ) : (
                <input type="number" step="0.01" value={qty}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                  onBlur={commit}
                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center text-sm tabular-nums" />
              )}
            </div>
            {item.formulaExpr && (
              <button type="button" onClick={() => setShowFormula(true)}
                className="text-[9px] font-mono text-cyan-600 hover:text-cyan-800 hover:underline truncate max-w-full"
                title={`Clique pra editar (formula atual: ${item.formulaExpr})`}>
                = {item.formulaExpr}
              </button>
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
        environmentParams={environmentParams}
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
          setPrice((newPriceCents / 100).toFixed(2));
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
function BudgetSummaryBlock({ budget, locked, paymentTerms, onUpdate, onManagePaymentTerms }: {
  budget: Budget;
  locked: boolean;
  paymentTerms: PoolPaymentTerm[];
  onUpdate: (patch: Record<string, any>) => void;
  onManagePaymentTerms?: () => void;
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
              {!locked && onManagePaymentTerms && (
                <button type="button" onClick={onManagePaymentTerms}
                  className="text-cyan-600 hover:text-cyan-800 text-[10px]" title="Cadastrar/editar formas">
                  Gerenciar →
                </button>
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
const FORMULA_VARS = [
  'length', 'width', 'depth', 'area', 'perimeter', 'volume',
  'cantos', 'perimExterno', 'perimInterno',
  'dias',
  'tempLocal', 'tempAgua', 'vento', 'capa', 'construcao',
] as const;
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

function FormulaModal({ initialExpr, dimensions, environmentParams, dias, itemDescription, itemUnit, itemCellRef, otherItems, onClose, onSave, onClear }: {
  initialExpr: string;
  dimensions: any;
  environmentParams?: any;
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

  // Mapeia strings -> numero (mesma logica do backend)
  const ventoNum = (() => {
    const v = environmentParams?.velocidadeVento;
    if (typeof v === 'number') return v;
    const m: Record<string, number> = { BAIXO: 1, MODERADO: 2, FORTE: 3 };
    return m[String(v || '').toUpperCase()] ?? 0;
  })();
  const capaNum = (() => {
    const v = environmentParams?.capaTermica;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    return ['SIM', 'S', '1'].includes(String(v || '').toUpperCase()) ? 1 : 0;
  })();
  const construcaoNum = (() => {
    const v = environmentParams?.tipoConstrucao;
    if (typeof v === 'number') return v;
    const m: Record<string, number> = { ABERTA: 1, FECHADA: 2 };
    return m[String(v || '').toUpperCase()] ?? 0;
  })();

  const vars: Record<string, number> = {
    length: Number(dimensions?.length) || 0,
    width: Number(dimensions?.width) || 0,
    depth: Number(dimensions?.depth) || 0,
    area: Number(dimensions?.area) || 0,
    perimeter: Number(dimensions?.perimeter) || 0,
    volume: Number(dimensions?.volume) || 0,
    cantos: Number(dimensions?.cantos) || 0,
    perimExterno: Number(dimensions?.perimetroExternoBorda) || 0,
    perimInterno: Number(dimensions?.perimetroParedesInternas) || 0,
    dias: Number(dias) || 0,
    tempLocal: Number(environmentParams?.temperaturaMediaLocal ?? environmentParams?.temperatura) || 0,
    tempAgua: Number(environmentParams?.temperaturaAguaDesejada) || 0,
    vento: ventoNum,
    capa: capaNum,
    construcao: construcaoNum,
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
      vars: ["length", "width", "depth", "area", "perimeter", "volume", "cantos", "perimExterno", "perimInterno"],
    },
    tempo: {
      label: "Tempo / Prazo",
      vars: ["dias"],
    },
    aquecimento: {
      label: "Aquecimento / Capa (aba CAPA da planilha)",
      vars: ["tempLocal", "tempAgua", "vento", "capa", "construcao"],
    },
  };
  const VAR_DESCRIPTIONS: Record<string, string> = {
    length: "Comprimento (m)",
    width: "Largura (m)",
    depth: "Profundidade (m)",
    area: "Area da piscina (m²)",
    perimeter: "Perimetro / borda (m)",
    volume: "Volume (m³)",
    cantos: "Cantoneiras internas (m/l)",
    perimExterno: "Perimetro externo borda (m/l)",
    perimInterno: "Perimetro paredes internas (m/l)",
    dias: "Duracao estimada da obra (dias)",
    tempLocal: "Temperatura media local (°C)",
    tempAgua: "Temperatura agua desejada (°C)",
    vento: "Velocidade vento (1=BAIXO, 2=MODERADO, 3=FORTE)",
    capa: "Capa termica (1=SIM, 0=NAO)",
    construcao: "Tipo construcao (1=ABERTA, 2=FECHADA)",
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
          <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
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
              {/* Expressao + preview com substituicao das variaveis */}
              <div className="rounded-lg border-2 border-cyan-200 bg-cyan-50/50 p-4">
                <label className="block text-xs font-bold uppercase tracking-wide text-cyan-900 mb-2">
                  Expressao <span className="text-[10px] text-slate-500 normal-case font-normal">(editavel — digite livre se entender da sintaxe)</span>
                </label>
                <input ref={inputRef} value={expr} onChange={(e) => setExpr(e.target.value)} autoFocus
                  placeholder="Ex: ceil(area * 0.5 / 18)"
                  className={"w-full rounded-lg border-2 bg-white px-3 py-2 text-base font-mono outline-none " + (expr.trim() && !result.ok ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-cyan-500")} />
                <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    {result.ok ? (
                      <span className="text-green-700">
                        = <span className="text-2xl font-extrabold tabular-nums text-green-800">{result.value!.toFixed(4).replace(/\.?0+$/, "")}</span>
                        <span className="text-xs text-slate-500 ml-2">resultado da quantidade</span>
                      </span>
                    ) : expr.trim() ? (
                      <span className="text-red-600 font-medium">⚠ Formula invalida: {result.error}. Conserte ou clique em &ldquo;Remover formula&rdquo; pra usar quantidade manual.</span>
                    ) : (
                      <span className="text-slate-500 italic">Use uma receita pronta abaixo, ou digite a formula direto.</span>
                    )}
                  </div>
                  {expr && (
                    <button type="button" onClick={() => setExpr("")}
                      className="text-xs text-slate-500 hover:text-slate-800">limpar</button>
                  )}
                </div>
                {expr.trim() && result.ok && (() => {
                  // Preview da expressao com variaveis SUBSTITUIDAS pelos valores reais.
                  // Util pro gestor entender exatamente o que esta sendo calculado.
                  let expanded = expr;
                  for (const fn of CELL_REF_FUNCTIONS) {
                    expanded = expanded.replace(
                      new RegExp('\\b' + fn + '\\s*\\(\\s*(L\\d+)\\s*\\)', 'g'),
                      (_m, ref: string) => {
                        const data = cellRefMap.get(ref);
                        return data ? String(Number(data[fn as keyof CellRefDataLocal]).toFixed(2).replace(/\.?0+$/, "")) : `${fn}(${ref})`;
                      },
                    );
                  }
                  for (const k of FORMULA_VARS) {
                    expanded = expanded.replace(new RegExp('\\b' + k + '\\b', 'g'), String(vars[k] ?? 0));
                  }
                  if (expanded === expr) return null;
                  return (
                    <div className="mt-2 pt-2 border-t border-cyan-200 text-[11px] text-slate-600">
                      <span className="font-medium text-slate-700">Avaliacao:</span>{" "}
                      <code className="font-mono text-cyan-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">{expanded}</code>{" "}
                      <span className="text-slate-500">→ {result.value!.toFixed(4).replace(/\.?0+$/, "")}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Receitas prontas — padrao card unificado */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  ⚡ Receitas prontas (clique pra usar)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                  {FORMULA_RECIPES_PISCINA.map((r) => (
                    <button key={r.label} type="button" onClick={() => setExpr(r.expr)}
                      className="text-left rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-3 py-1.5 transition group">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-cyan-900">{r.label}</div>
                      <div className="font-mono text-[11px] text-cyan-700">{r.expr}</div>
                      <div className="text-[10px] text-slate-500">{r.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Variaveis — mesmo card unificado */}
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
                          className="inline-flex items-center gap-2 text-xs rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-2.5 py-1.5 transition">
                          <span className="font-mono font-bold text-cyan-700">{k}</span>
                          <span className="text-slate-500 text-[10px]">{VAR_DESCRIPTIONS[k]}</span>
                          <span className="font-mono text-slate-900 font-bold tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">{vars[k]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Funcoes — mesmo card unificado */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  🧮 Funcoes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                  {FORMULA_FUNCTIONS.map((fn) => (
                    <button key={fn} type="button" onClick={() => insert(fn + "(")}
                      className="text-left rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-3 py-1.5 transition group">
                      <span className="font-mono font-bold text-cyan-700 group-hover:text-cyan-900">{fn}(...)</span>
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
                        <div key={o.cellRef} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-cyan-50 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-mono font-bold text-cyan-700 mr-2">{o.cellRef}</span>
                            <span className="text-slate-800 truncate">{o.description}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap">
                            qty {o.qty} · R$ {o.total.toFixed(2)}
                          </div>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => insert(`qty(${o.cellRef})`)}
                              className="rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-1.5 py-0.5 font-mono text-[10px] text-cyan-700 transition"
                              title={`Insere qty(${o.cellRef}) — quantidade da linha`}>qty</button>
                            <button type="button" onClick={() => insert(`total(${o.cellRef})`)}
                              className="rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-1.5 py-0.5 font-mono text-[10px] text-cyan-700 transition"
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


// EditBudgetHeaderModal
function EditBudgetHeaderModal({ budget, onClose, onSaved }: {
  budget: Budget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(budget.title);
  const [clientPartnerId, setClientPartnerId] = useState(budget.clientPartner?.id || "");
  const [validityDays, setValidityDays] = useState(budget.validityDays);
  const [length, setLength] = useState<number>(Number(budget.poolDimensions?.length) || 0);
  const [width, setWidth] = useState<number>(Number(budget.poolDimensions?.width) || 0);
  const [depth, setDepth] = useState<number>(Number(budget.poolDimensions?.depth) || 0);
  const [perimeter, setPerimeter] = useState<number>(Number(budget.poolDimensions?.perimeter) || 0);
  const [saving, setSaving] = useState(false);

  const area = length * width;
  const volume = length * width * depth;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast("Titulo obrigatorio", "error"); return; }
    if (!clientPartnerId) { toast("Cliente obrigatorio", "error"); return; }
    setSaving(true);
    try {
      const newDimensions = {
        ...(budget.poolDimensions || {}),
        length, width, depth,
        area, volume,
        perimeter: perimeter || 2 * (length + width),
      };
      await api.put(`/pool-budgets/${budget.id}`, {
        title: title.trim(),
        clientPartnerId,
        validityDays,
        poolDimensions: newDimensions,
      });
      toast("Dados atualizados", "success");
      onSaved();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Editar dados do orcamento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titulo</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
            <PartnerCombobox
              value={clientPartnerId}
              onChange={(p) => setClientPartnerId(p?.id || "")}
              partnerType="CLIENTE"
              placeholder="Buscar cliente por nome..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dimensoes da piscina</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-500">Comprimento (m)</span>
                <input type="number" step="0.01" value={length} onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Largura (m)</span>
                <input type="number" step="0.01" value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Profundidade (m)</span>
                <input type="number" step="0.01" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value) || 0)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 rounded px-2 py-1.5">
                <span className="text-[10px] text-slate-500">Area (m²)</span>
                <div className="font-semibold tabular-nums">{area.toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 rounded px-2 py-1.5">
                <span className="text-[10px] text-slate-500">Volume (m³)</span>
                <div className="font-semibold tabular-nums">{volume.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Perimetro (m)</span>
                <input type="number" step="0.01" value={perimeter}
                  onChange={(e) => setPerimeter(parseFloat(e.target.value) || 0)}
                  placeholder={String((2 * (length + width)).toFixed(2))}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Area = comprimento × largura · Volume = area × profundidade · Perimetro padrao = 2×(comp+larg)
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Validade (dias)</label>
            <input type="number" min={1} value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// PaymentTermsModal — popup inline pra gerenciar formas de pagamento de obra
// (substitui o link "Gerenciar →" que abria nova aba)
type PartLite = { label: string; percent: number; count: number; intervalDays: number; firstOffsetDays: number };
type TermLite = { id: string; name: string; isActive: boolean; isDefault: boolean; structure: PartLite[] };
const PMT_EMPTY_PART: PartLite = { label: "Parcela", percent: 100, count: 1, intervalDays: 0, firstOffsetDays: 0 };

function PaymentTermsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<TermLite[]>([]);
  const [editing, setEditing] = useState<TermLite | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const r = await api.get<TermLite[]>("/pool-payment-terms");
      setItems(r || []);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar formas", "error");
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

  function describe(t: TermLite) {
    return t.structure.map(p => `${p.percent}% ${p.count > 1 ? `${p.count}x` : ""} ${p.label}`).join(" + ");
  }

  if (showForm) {
    return (
      <PaymentTermFormModal
        initial={editing}
        onCancel={() => { setShowForm(false); setEditing(null); }}
        onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Formas de pagamento de obra</h2>
            <p className="text-xs text-slate-500 mt-0.5">Estrutura de parcelas usada nos orcamentos do modulo Piscina.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        <div className="flex justify-end">
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">
            + Nova forma
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5">Nome</th>
                <th className="text-left px-4 py-2.5">Estrutura</th>
                <th className="text-center px-3 py-2.5 w-16">Padrao</th>
                <th className="text-center px-3 py-2.5 w-16">Ativa</th>
                <th className="px-3 py-2.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-8">Nenhuma forma cadastrada</td></tr>
              ) : items.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-2 text-slate-600 text-xs">{describe(t)}</td>
                  <td className="px-3 py-2 text-center">{t.isDefault ? <span className="text-amber-500">★</span> : ""}</td>
                  <td className="px-3 py-2 text-center">{t.isActive ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => { setEditing(t); setShowForm(true); }}
                      className="text-cyan-600 hover:text-cyan-800 text-xs mr-3">Editar</button>
                    <button onClick={() => remove(t.id)} className="text-red-500 hover:text-red-700 text-xs">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function PaymentTermFormModal({ initial, onCancel, onSaved }: {
  initial: TermLite | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [parts, setParts] = useState<PartLite[]>(initial?.structure ?? [{ ...PMT_EMPTY_PART }]);
  const [saving, setSaving] = useState(false);

  const totalPct = parts.reduce((s, p) => s + (Number(p.percent) || 0), 0);
  function updatePart(idx: number, patch: Partial<PartLite>) {
    setParts(parts.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function addPart() { setParts([...parts, { ...PMT_EMPTY_PART, percent: Math.max(0, 100 - totalPct) }]); }
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
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{initial ? "Editar" : "Nova"} forma de pagamento</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
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
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
