"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PartnerCombobox from "@/components/PartnerCombobox";

type AutoSelectRule = {
  filterPoolType?: string | null;
  filterCategoria?: string | null;
  filterDescription?: string | null;
  where?: string | null;
  orderBy?: string | null;
  manualSelection?: boolean | null;
  // Vincula esse item a uma linha especifica (ex: tubo SPA aponta pra L39 do
  // Kit SPA). Quando preenchido, sibling* vem so dessa linha — elimina
  // ambiguidade. Opcional — sem ele, fallback pra siblings genericos da etapa.
  linkedCellRef?: string | null;
  indicator?: {
    label: string;
    expr: string;
    unit?: string | null;
    levels: { max: number; label: string; color: string }[];
  } | null;
};

type BudgetItem = {
  id: string;
  poolSection: string;
  sortOrder: number;
  cellRef: string | null; // Endereço estavel (L1, L2, ...) usado em formulas de outros items
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
  autoSelectRule?: AutoSelectRule | null;
  manualUnlink?: boolean;
  previousQty?: number | null;
  // Calculados em runtime no findOne — nao persistidos:
  indicatorLabel?: string | null;
  indicatorColor?: string | null;
  indicatorValue?: number | null;
  indicatorUnit?: string | null;
  product?: { id: string; code: string | null; description: string; technicalSpecs?: Record<string, unknown> | null } | null;
  service?: { id: string; code: string | null; name: string; technicalSpecs?: Record<string, unknown> | null } | null;
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
  product: { id: string; code?: string | null; description: string; brand?: string | null; salePriceCents: number; unit: string; technicalSpecs?: Record<string, any> | null; poolType?: string | null } | null;
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
// senao PRODUTO. Usado pra calcular Total Serviços vs Total Produtos por etapa.
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

// Formata valor do indicador de eficiencia da auto-selecao.
// Pra unit='h' converte decimal em "Xh Ymin" (ex: 3.67 -> "3h 40min"). Outras
// unidades (kcal/m³h, A, mm, etc) usam decimal padrao com 2 casas.
function formatIndicatorValue(value: number | null | undefined, unit: string | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const u = (unit || '').toLowerCase().trim();
  if (u === 'h' && value > 0) {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}min`;
  }
  const formatted = value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
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
    return <div className="p-6 text-slate-600">Carregando...</div>;
  }
  if (!budget) {
    return <div className="p-6 text-slate-600">Orcamento nao encontrado.</div>;
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

        {/* Versão colapsada: 1 linha compacta */}
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
            {/* Versão expandida: titulo + cards bonitos */}
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
              <p className="text-xs text-slate-600 mt-4">
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
                          title="Sequencia atual + Endereço estavel da linha (LX) usado em formulas">Seq · Ref</ResizableTh>
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
                          <td colSpan={8} className="text-center text-xs text-slate-600 py-6">
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
                        <td colSpan={6} className="px-3 py-1.5 text-right text-slate-600 uppercase font-medium tracking-wide">Total Serviços</td>
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
          confirmAction === "approve" ? "Após aprovado, uma obra sera criada automaticamente. Confirma?" :
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
  const [showAutoSelect, setShowAutoSelect] = useState(false);
  const [showCatalogPick, setShowCatalogPick] = useState(false);
  const [price, setPrice] = useState((item.unitPriceCents / 100).toFixed(2));
  const [desc, setDesc] = useState(item.description);
  const [slot, setSlot] = useState(item.slotName || "");

  // Sibling vars (v1.10.99+) — pra preview do modal de auto-selecao em items
  // com regra cross-line (ex: tubo le tuboEntradaMm do filtro da mesma etapa).
  // Modo preferido: linkedCellRef da regra (vinculo explicito a uma linha).
  // Fallback: outros items da mesma etapa, excluindo o proprio.
  const siblingVars = useMemo(() => {
    const out: Record<string, number> = {};
    if (!allItems) return out;
    const linkedCellRef = item.autoSelectRule?.linkedCellRef;
    if (linkedCellRef && linkedCellRef.trim()) {
      const target = allItems.find((sib) => sib.cellRef === linkedCellRef.trim());
      const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (specs) {
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          out[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
        }
      }
      return out;
    }
    for (const sib of allItems) {
      if (sib.id === item.id) continue;
      if (sib.poolSection !== item.poolSection) continue;
      const specs = (sib.product?.technicalSpecs ?? sib.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (!specs) continue;
      for (const [k, raw] of Object.entries(specs)) {
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
        if (out[siblingKey] === undefined) {
          out[siblingKey] = n;
        }
      }
    }
    return out;
  }, [allItems, item.id, item.poolSection, item.autoSelectRule]);

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
            title="Endereço da linha (use em formulas: qty(LX), total(LX))">{item.cellRef}</span>
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
              className="text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 rounded p-1 text-xs flex-shrink-0"
              title="Buscar no catalogo">
              🔍
            </button>
            <button type="button" onClick={() => setShowAutoSelect(true)}
              className={"text-[11px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 " + (item.autoSelectRule ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-300")}
              title={item.autoSelectRule ? "Editar auto-selecao do produto" : "Configurar auto-selecao do produto"}
            >✨</button>
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
        {/* Faixa de eficiencia da auto-selecao do produto. Recalcula automaticamente
            se o gestor trocar o produto manualmente — o valor reflete o produto atual,
            nao o que a regra originalmente escolheria. */}
        {item.indicatorLabel && item.autoSelectRule?.indicator && (
          <div className={
            "mt-1 px-2 py-1 rounded text-[11px] font-medium border flex items-center gap-2 flex-wrap " +
            (item.indicatorColor === 'emerald' ? "bg-emerald-50 border-emerald-400 text-emerald-800" :
             item.indicatorColor === 'green' ? "bg-green-50 border-green-300 text-green-800" :
             item.indicatorColor === 'blue' ? "bg-blue-50 border-blue-300 text-blue-800" :
             item.indicatorColor === 'yellow' ? "bg-yellow-50 border-yellow-300 text-yellow-800" :
             item.indicatorColor === 'orange' ? "bg-orange-50 border-orange-300 text-orange-800" :
             item.indicatorColor === 'red' ? "bg-red-50 border-red-300 text-red-800" :
             "bg-slate-50 border-slate-300 text-slate-700")
          }>
            <span className="font-bold uppercase tracking-wide">{item.indicatorLabel}</span>
            <span className="opacity-60">·</span>
            <span>
              {item.autoSelectRule.indicator.label}: <span className="font-semibold tabular-nums">{formatIndicatorValue(item.indicatorValue, item.indicatorUnit)}</span>
            </span>
          </div>
        )}
        {/* Badge/botao da selecao automatica — quando item tem autoSelectRule.
            manualUnlink=true: vira botao "Voltar pra selecao automatica" (laranja).
            manualUnlink=false: badge cinza informativo. */}
        {item.autoSelectRule && (item.autoSelectRule.where || item.autoSelectRule.filterPoolType || item.autoSelectRule.filterDescription || item.autoSelectRule.filterCategoria) && (
          item.manualUnlink ? (
            <button type="button"
              onClick={() => onUpdate({ manualUnlink: false } as any)}
              title="Clique pra voltar a selecao automatica — o sistema vai reaplicar a regra e escolher o produto otimo. Sua escolha manual sera substituida."
              className="mt-1 text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-500 text-orange-800 transition cursor-pointer font-medium">
              ↩ Voltar pra selecao automatica
            </button>
          ) : (
            <span className="mt-1 text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600"
              title="Produto escolhido automaticamente pela regra de auto-selecao. Se voce trocar manualmente, vira botao 'Voltar pra selecao automatica'.">
              ✨ selecao automatica
            </span>
          )
        )}
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
                title={item.formulaExpr ? `Editar formula (atual: ${item.formulaExpr})` : "Configurar formula automática"}
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
            {/* Indicador antigo removido — agora aparece como faixa colorida na coluna DESCRICAO (mais visivel) */}
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
                  className="text-slate-600 hover:text-slate-700 text-[10px] disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Mover linha pra cima">▲</button>
                <button onClick={() => onMove(1)} disabled={isLast}
                  className="text-slate-600 hover:text-slate-700 text-[10px] disabled:opacity-20 disabled:cursor-not-allowed"
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
        itemPoolSection={item.poolSection}
        productSpecs={(item.product?.technicalSpecs ?? item.service?.technicalSpecs) as Record<string, unknown> | null | undefined}
        productName={item.product?.description ?? item.service?.name ?? null}
        otherItems={(allItems ?? [])
          .filter((x) => x.cellRef && x.id !== item.id)
          .map((x) => ({
            cellRef: x.cellRef!,
            description: x.description,
            poolSection: x.poolSection,
            qty: x.qty,
            total: x.totalCents / 100,
            unitPrice: x.unitPriceCents / 100,
            // Enriquecido com technicalSpecs do produto/servico vinculado —
            // permite preview do prod(LX, "key") avaliar com valor real.
            productSpecs: (x.product?.technicalSpecs ?? x.service?.technicalSpecs ?? null) as Record<string, any> | null,
          }))}
        siblingVars={siblingVars}
        onClose={() => setShowFormula(false)}
        onSave={(expr) => { setShowFormula(false); onUpdate({ formulaExpr: expr }); }}
        onClear={() => { setShowFormula(false); onUpdate({ formulaExpr: "" }); }}
      />
    )}
    {showAutoSelect && catalog && (
      <AutoSelectModal
        initialRule={item.autoSelectRule || null}
        catalog={catalog}
        dimensions={dimensions}
        environmentParams={environmentParams}
        siblingVars={siblingVars}
        sectionItems={(allItems || [])
          .filter((it) => it.poolSection === item.poolSection && it.id !== item.id)
          .map((it) => ({
            id: it.id,
            cellRef: it.cellRef,
            description: it.description,
            linked: !!(it.productId || it.serviceId),
            specs: (it.product?.technicalSpecs ?? it.service?.technicalSpecs) || null,
          }))}
        itemDescription={item.description}
        currentProductName={item.product?.description ?? item.service?.name ?? null}
        onClose={() => setShowAutoSelect(false)}
        // 'Aplicar regra' salva a regra E limpa productId/serviceId pra forcar
        // o recalc backend rodar auto-selecao com a regra nova. Sem isso o user
        // precisaria limpar manualmente o produto da linha — confuso.
        onSave={(rule) => {
          setShowAutoSelect(false);
          onUpdate({ autoSelectRule: rule, productId: null, serviceId: null } as any);
        }}
        onClear={() => { setShowAutoSelect(false); onUpdate({ autoSelectRule: null } as any); }}
      />
    )}
    {showCatalogPick && catalog && (
      <CatalogPickModal
        catalog={catalog}
        currentSection={item.poolSection}
        autoSelectRule={item.autoSelectRule}
        dimensions={dimensions}
        environmentParams={environmentParams}
        siblingVars={siblingVars}
        onClose={() => setShowCatalogPick(false)}
        onPick={(cfg) => {
          setShowCatalogPick(false);
          const cfgDesc = (cfg.product?.description || cfg.service?.name || '').trim().toLowerCase();
          // "Sem Produto" — pode vir como sentinel __NONE__ ou como o Product real.
          // Marca manualUnlink=true pra que o auto-select pule esse item (regra
          // ativa nao re-escolheria outro produto sobrescrevendo a intencao).
          // Zera qty (linha "Sem Produto" nao tem o que comprar) e salva snapshot
          // em previousQty pra restaurar quando o operador re-escolher um produto.
          if (cfg.id === '__NONE__' || cfgDesc === 'sem produto') {
            onUpdate({
              catalogConfigId: cfg.id === '__NONE__' ? null : cfg.id,
              productId: cfg.product?.id ?? null,
              serviceId: cfg.service?.id ?? null,
              description: 'Sem Produto',
              unit: cfg.product?.unit || '',
              unitPriceCents: cfg.product?.salePriceCents ?? 0,
              qty: 0,
              previousQty: item.qty,
              manualUnlink: true,
            } as any);
            setQty(0);
            setDesc('Sem Produto');
            setPrice(((cfg.product?.salePriceCents ?? 0) / 100).toFixed(2));
            return;
          }
          // Re-escolha de produto: limpa manualUnlink pra que o auto-select volte
          // a operar normalmente. Se a linha estava em estado Sem Produto com
          // snapshot, restaura a qty anterior (operador nao perde trabalho).
          const newDesc = cfg.product?.description || cfg.service?.name || item.description;
          const newUnit = cfg.product?.unit || cfg.service?.unit || item.unit;
          const newPriceCents = cfg.product?.salePriceCents ?? cfg.service?.priceCents ?? item.unitPriceCents;
          const restoredQty = (item.manualUnlink && typeof item.previousQty === 'number')
            ? item.previousQty
            : undefined;
          onUpdate({
            catalogConfigId: cfg.id,
            productId: cfg.product?.id ?? null,
            serviceId: cfg.service?.id ?? null,
            description: newDesc,
            unit: newUnit,
            unitPriceCents: newPriceCents,
            ...(restoredQty !== undefined ? { qty: restoredQty } : {}),
            previousQty: null,
            manualUnlink: false,
          } as any);
          setDesc(newDesc);
          setPrice((newPriceCents / 100).toFixed(2));
          if (restoredQty !== undefined) setQty(restoredQty);
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">🔍</span>
                {search && (
                  <button type="button" onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm">✕</button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                {filteredCatalog.length === 0 ? (
                  <div className="text-center text-xs text-slate-600 py-6">
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
                            <span className="text-[9px] font-mono text-slate-600">{code}</span>
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
              <div className="text-[10px] text-slate-600 mt-0.5">Calculado por items com unit h/dia (8h por dia)</div>
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
  // Dimensoes basicas (primeira section)
  'length', 'width', 'depth',
  // Metricas agregadas (somatorio das sections)
  'area', 'perimeter', 'volume',
  // Bounding box (envelope externo)
  'cantos', 'perimExterno', 'perimInterno',
  // Areas extras
  'areaParedeEFundo',
  // Radier
  'radierM2', 'radierEspessura', 'radierM3',
  // Escavacao
  'escavacao',
  // Prazo
  'dias',
  // Aquecimento
  'tempLocal', 'tempAgua', 'vento', 'capa', 'construcao',
] as const;
const FORMULA_FUNCTIONS = ['ceil', 'floor', 'round', 'min', 'max'] as const;
const CELL_REF_FUNCTIONS = ['qty', 'total', 'unitPrice'] as const;
// Variaveis dinamicas: areaSec1, areaSec2, ..., volumeSec1, volumeSec2, ...
// (uma por section da piscina, em ordem). Suporta numero arbitrario de sections.
const SECTION_VAR_PATTERN = /\b(areaSec|volumeSec)(\d+)\b/g;

type CellRefDataLocal = { qty: number; total: number; unitPrice: number };

function evalLocal(
  expr: string,
  vars: Record<string, number>,
  cellRefs: Map<string, CellRefDataLocal> = new Map(),
  cellRefProductSpecs: Map<string, Record<string, any>> = new Map(),
): { ok: boolean; value?: number; error?: string } {
  if (!expr.trim()) return { ok: false, error: 'vazia' };
  // Aceita decimal com virgula (padrao BR) — auto-converte "0,1" -> "0.1".
  // So matcha digito-virgula-digito SEM espaco; "min(x, 10)" mantem virgula como separador.
  let s = expr.replace(/(\d),(\d)/g, '$1.$2');
  // Substitui chamadas a cellRef ANTES das vars (evita confundir 'L1' com identifier solto).
  // NUNCA jogar throw daqui: evalLocal roda durante render do FormulaModal e exception escaparia
  // o try/catch (que so cobre o Function eval), quebrando o componente com error boundary global.
  let cellRefError: string | null = null;
  for (const fn of CELL_REF_FUNCTIONS) {
    s = s.replace(
      new RegExp('\\b' + fn + '\\s*\\(\\s*(L\\d+)\\s*\\)', 'g'),
      (_m, ref: string) => {
        const data = cellRefs.get(ref);
        if (!data) {
          if (!cellRefError) cellRefError = 'linha ' + ref + ' nao existe (ou e a propria linha em edicao)';
          return '0';
        }
        return '(' + (Number(data[fn as keyof CellRefDataLocal]) || 0) + ')';
      },
    );
  }
  if (cellRefError) return { ok: false, error: cellRefError };
  // prod(LX, "key") — busca spec do produto vinculado a linha. Se disponivel,
  // mostra o valor real no preview (em vez de 0). Caso a linha nao tenha
  // produto/spec, retorna 0 (mesmo comportamento que o backend).
  s = s.replace(/\bprod\s*\(\s*(L\d+)\s*,\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g, (_m, ref: string, key: string) => {
    const specs = cellRefProductSpecs.get(ref);
    const v = specs ? Number(specs[key] ?? 0) : 0;
    return '(' + (Number.isFinite(v) ? v : 0) + ')';
  });
  s = s.replace(/\bsum\s*\(\s*"[a-zA-Z_][a-zA-Z0-9_]*"\s*(?:,\s*"[^"]*"\s*)?\)/g, '(0)');
  // Substitui areaSecN / volumeSecN dinamicamente (uma por section)
  s = s.replace(SECTION_VAR_PATTERN, (_m, prefix: string, num: string) => {
    const key = prefix + num;
    return '(' + (vars[key] || 0) + ')';
  });
  for (const k of FORMULA_VARS) {
    s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), '(' + (vars[k] || 0) + ')');
  }
  // Variaveis dinamicas adicionais (productSpecs etc) — qualquer chave nao whitelisted em vars
  const allowedSet = new Set<string>(FORMULA_VARS as readonly string[]);
  for (const [key, val] of Object.entries(vars)) {
    if (val == null) continue;
    if (allowedSet.has(key)) continue;
    if (/^(areaSec|volumeSec)\d+$/.test(key)) continue;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    s = s.replace(new RegExp('\\b' + key + '\\b', 'g'), '(' + (Number(val) || 0) + ')');
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

type FormulaRecipe = {
  label: string;
  expr: string;
  hint: string;
  // Quando true, ao clicar a receita o modal pede pro operador escolher uma
  // linha da mesma etapa. A expressao final substitui o placeholder `LREF`
  // pelo cellRef escolhido (ex: prod(LREF, "tempoMontagemH") -> prod(L40, "tempoMontagemH")).
  // Mais robusto que usar siblingXxx — funciona em qualquer etapa, sem ambiguidade.
  needsLineRef?: boolean;
};

const FORMULA_RECIPES_PISCINA: FormulaRecipe[] = [
  // ── Area / superficie (somatorio das sections) ──
  { label: "Area da piscina (m²)", expr: "area", hint: "Superficie d'agua — liner, manta, tratamento de superficie" },
  // ── Volume d'agua ──
  { label: "Volume d'agua (m³)", expr: "volume", hint: "Bombas, tratamento por m³, dimensionar filtro" },
  // ── Borda externa (perimetro real, nao soma de sections) ──
  { label: "Borda externa (m/l)", expr: "perimExterno", hint: "Parede externa, borda corrida — usa o perimetro do bounding box" },
  { label: "Borda externa + 10% perda", expr: "perimExterno * 1.1", hint: "Margem de seguranca pra recortes" },
  { label: "Cantoneira interna (m/l)", expr: "cantos", hint: "Cantoneiras internas — usa valor digitado em Dimensoes" },
  { label: "Parede interna (m/l)", expr: "perimInterno", hint: "Paredes internas (degraus, divisorias)" },
  // ── Parede + fundo (impermeabilizacao, pintura, azulejo) ──
  { label: "Impermeabilizante caixa 18kg", expr: "ceil(areaParedeEFundo * 0.5 / 18)", hint: "0.5 kg/m² em parede+fundo, arredonda pra cima" },
  // ── Radier (concreto do fundo) ──
  { label: "Radier — concreto (m³)", expr: "radierM3", hint: "Volume de concreto = radier m² × espessura" },
  // ── Escavacao ──
  { label: "Escavacao (m³)", expr: "escavacao", hint: "Volume de terra removida" },
  // ── Diarias ──
  { label: "Diaria por dia de obra", expr: "dias", hint: "Quantidade = nº de dias da obra (auto)" },
  // ── Tempo de montagem do equipamento (precisa apontar pra linha) ──
  // expr usa placeholder LREF; ao clicar, modal pede a linha do equipamento
  // principal e substitui LREF pelo cellRef escolhido. Mais robusto que sibling*
  // (que dependia da ordem dos items na etapa).
  { label: "⏱ Tempo de montagem do equipamento (h)", expr: 'prod(LREF, "tempoMontagemH")', hint: "Le tempoMontagemH (horas) do cadastro do produto vinculado a uma linha especifica (filtro, aquecedor, kit cascata/SPA). Clique pra escolher a linha.", needsLineRef: true },
  // ── Produto vinculado (technicalSpecs do cadastro) ──
  { label: "Sacos por consumo (parede+fundo) — CIMA", expr: "ceil(consumoKgM2 * areaParedeEFundo / pesoKg)", hint: "Argamassa, cimentcola, cimento, impermeabilizante: aplica em paredes + fundo (areaParedeEFundo). Ceil = sempre completa o saco." },
  { label: "Sacos por consumo (parede+fundo) — NORMAL", expr: "round(consumoKgM2 * areaParedeEFundo / pesoKg)", hint: "Igual a anterior, arredondamento normal (50.4→50, 50.5→51)" },
  { label: "Sacos por consumo (so fundo / superficie d'agua)", expr: "ceil(consumoKgM2 * area / pesoKg)", hint: "Quando o material so vai na area da agua (ex: liner). Use areaParedeEFundo pra revestimento de parede+fundo." },
  { label: "Consumo total em Kg (parede+fundo)", expr: "consumoKgM2 * areaParedeEFundo", hint: "Quantos Kg do material no total — antes de dividir por saco" },
  // ── Referencias entre linhas ──
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

type OtherItemForModal = { cellRef: string; description: string; poolSection: string; qty: number; total: number; unitPrice: number; productSpecs?: Record<string, any> | null };

function FormulaModal({ initialExpr, dimensions, environmentParams, dias, itemDescription, itemUnit, itemCellRef, itemPoolSection, productSpecs, productName, otherItems, siblingVars, onClose, onSave, onClear }: {
  initialExpr: string;
  dimensions: any;
  environmentParams?: any;
  dias?: number;
  itemDescription?: string;
  itemUnit?: string;
  itemCellRef?: string | null;
  itemPoolSection?: string;
  productSpecs?: Record<string, unknown> | null;
  productName?: string | null;
  otherItems?: OtherItemForModal[];
  // v1.11.09: vars 'sibling*' calculadas dos outros items da mesma etapa
  // (mesmo padrao do AutoSelectModal/CatalogPickModal). Permite formulas como
  // 'siblingTempoMontagemH' pra calcular qty a partir do equipamento da etapa.
  siblingVars?: Record<string, number>;
  onClose: () => void;
  onSave: (expr: string) => void;
  onClear: () => void;
}) {
  const [expr, setExpr] = useState(initialExpr);
  const inputRef = useRef<HTMLInputElement>(null);
  // Quando o usuario clica numa receita que precisa de linha (needsLineRef),
  // guarda o template aqui e mostra picker de linha logo abaixo.
  const [pendingRecipe, setPendingRecipe] = useState<FormulaRecipe | null>(null);
  // Multi-select: linhas selecionadas no picker. Ao aplicar, gera soma de
  // prod(LA, "key") + prod(LB, "key") + ... (multiplos equipamentos).
  const [pendingLineRefs, setPendingLineRefs] = useState<Set<string>>(new Set());

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

  const radierM2Val = Number(dimensions?.radierM2) || 0;
  const radierEspVal = Number(dimensions?.radierEspessura) || 0;
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
    areaParedeEFundo: Number(dimensions?.areaParedeEFundo) || 0,
    radierM2: radierM2Val,
    radierEspessura: radierEspVal,
    radierM3: Number(dimensions?.radierM3) || (radierM2Val * radierEspVal) || 0,
    escavacao: Number(dimensions?.escavacaoM3) || 0,
    dias: Number(dias) || 0,
    tempLocal: Number(environmentParams?.temperaturaMediaLocal ?? environmentParams?.temperatura) || 0,
    tempAgua: Number(environmentParams?.temperaturaAguaDesejada) || 0,
    vento: ventoNum,
    capa: capaNum,
    construcao: construcaoNum,
    // Merge das sibling vars (technicalSpecs dos outros items da mesma poolSection).
    // Permite formulas como 'siblingTempoMontagemH', 'siblingVazaoM3h', etc.
    ...(siblingVars || {}),
  };
  // Variaveis individuais por section (areaSec1, volumeSec1, areaSec2, ...).
  // Auto-deriva area/volume de length×width×depth quando section so tem dimensoes.
  const sectionsList: Array<{ idx: number; name: string; area: number; volume: number }> = [];
  if (Array.isArray(dimensions?.sections)) {
    dimensions.sections.forEach((s: any, idx: number) => {
      let area = Number(s?.area) || 0;
      if (!area && s?.length && s?.width) area = Number(s.length) * Number(s.width);
      let volume = Number(s?.volume) || 0;
      if (!volume && s?.length && s?.width && s?.depth) volume = Number(s.length) * Number(s.width) * Number(s.depth);
      const i = idx + 1;
      vars[`areaSec${i}`] = area;
      vars[`volumeSec${i}`] = volume;
      sectionsList.push({ idx: i, name: String(s?.name || `Section ${i}`), area, volume });
    });
  }
  // Especificacoes tecnicas do produto/serviço vinculado (Json livre — pesoKg, consumoKgM2, vazaoM3h, ...)
  const productSpecsList: Array<{ key: string; value: number }> = [];
  if (productSpecs && typeof productSpecs === 'object') {
    for (const [k, v] of Object.entries(productSpecs)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      vars[k] = n;
      productSpecsList.push({ key: k, value: n });
    }
    productSpecsList.sort((a, b) => a.key.localeCompare(b.key));
  }
  const cellRefMap = new Map<string, CellRefDataLocal>();
  // Map de cellRef -> productSpecs do produto/servico vinculado.
  // Usado pelo evalLocal pra avaliar prod(LX, "key") com valor real no preview.
  const cellRefProductSpecs = new Map<string, Record<string, any>>();
  for (const o of otherItems ?? []) {
    if (o.cellRef && o.cellRef !== itemCellRef) {
      cellRefMap.set(o.cellRef, { qty: o.qty, total: o.total, unitPrice: o.unitPrice });
      if (o.productSpecs) cellRefProductSpecs.set(o.cellRef, o.productSpecs);
    }
  }
  const VAR_GROUPS: Record<string, { label: string; vars: string[] }> = {
    dimensoes: {
      label: "Dimensoes basicas (1ª section)",
      vars: ["length", "width", "depth"],
    },
    aggregadas: {
      label: "Metricas agregadas (somatorio das sections)",
      vars: ["area", "volume", "perimeter"],
    },
    boundingBox: {
      label: "Bounding box / borda (manuais em Dimensoes)",
      vars: ["perimExterno", "cantos", "perimInterno"],
    },
    paredeFundo: {
      label: "Parede + fundo (impermeabilizacao, pintura, azulejo)",
      vars: ["areaParedeEFundo"],
    },
    radier: {
      label: "Radier (concreto do fundo)",
      vars: ["radierM2", "radierEspessura", "radierM3"],
    },
    escavacao: {
      label: "Escavacao",
      vars: ["escavacao"],
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
    length: "Comprimento 1ª section (m)",
    width: "Largura 1ª section (m)",
    depth: "Profundidade 1ª section (m)",
    area: "Area total — somatorio das sections (m²)",
    perimeter: "Perimetro — SOMA dos perimetros das sections (m). Pra borda real use perimExterno",
    volume: "Volume total — somatorio das sections (m³)",
    cantos: "Cantoneiras internas (m/l) — bounding box",
    perimExterno: "Perimetro externo / borda real (m/l) — use pra parede externa",
    perimInterno: "Perimetro paredes internas (m/l) — divisorias internas",
    areaParedeEFundo: "Area parede + fundo (m²) — impermeabilizante, pintura, azulejo",
    radierM2: "Radier — area (m²)",
    radierEspessura: "Radier — espessura (m)",
    radierM3: "Radier — volume concreto (m³) = m² × espessura",
    escavacao: "Escavacao (m³) — volume de terra removida",
    dias: "Duracao estimada da obra (dias)",
    tempLocal: "Temperatura media local (°C)",
    tempAgua: "Temperatura agua desejada (°C)",
    vento: "Velocidade vento (1=BAIXO, 2=MODERADO, 3=FORTE)",
    capa: "Capa termica (1=SIM, 0=NAO)",
    construcao: "Tipo construcao (1=ABERTA, 2=FECHADA)",
  };

  const result = evalLocal(expr, vars, cellRefMap, cellRefProductSpecs);

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
                <h3 className="text-lg font-bold text-slate-900">Formula automática de quantidade</h3>
                {itemDescription && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Linha: <span className="font-medium text-slate-800">{itemDescription}</span>
                    {itemUnit && <span className="text-slate-500"> · unidade: {itemUnit}</span>}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>

            {/* Expressao FIXA (nao rola) — sempre visivel enquanto o usuario explora variaveis/receitas abaixo */}
            <div className="px-6 pt-4 pb-4 border-b border-slate-100 bg-white shrink-0">
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
                  // Aplica mesma normalizacao de virgula→ponto pra consistencia visual.
                  let expanded = expr.replace(/(\d),(\d)/g, '$1.$2');
                  for (const fn of CELL_REF_FUNCTIONS) {
                    expanded = expanded.replace(
                      new RegExp('\\b' + fn + '\\s*\\(\\s*(L\\d+)\\s*\\)', 'g'),
                      (_m, ref: string) => {
                        const data = cellRefMap.get(ref);
                        return data ? String(Number(data[fn as keyof CellRefDataLocal]).toFixed(2).replace(/\.?0+$/, "")) : `${fn}(${ref})`;
                      },
                    );
                  }
                  // Substitui areaSecN / volumeSecN pelos valores reais
                  expanded = expanded.replace(SECTION_VAR_PATTERN, (_m, prefix: string, num: string) => {
                    const key = prefix + num;
                    return String(vars[key] ?? 0);
                  });
                  for (const k of FORMULA_VARS) {
                    expanded = expanded.replace(new RegExp('\\b' + k + '\\b', 'g'), String(vars[k] ?? 0));
                  }
                  // Vars dinamicas (productSpecs etc)
                  const allowedSetExp = new Set<string>(FORMULA_VARS as readonly string[]);
                  for (const [key, val] of Object.entries(vars)) {
                    if (val == null) continue;
                    if (allowedSetExp.has(key)) continue;
                    if (/^(areaSec|volumeSec)\d+$/.test(key)) continue;
                    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
                    expanded = expanded.replace(new RegExp('\\b' + key + '\\b', 'g'), String(val));
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
            </div>

            {/* Area scrollavel — accordions colapsaveis pra ficar limpo */}
            <div className="overflow-y-auto px-6 py-4 space-y-2">
              {/* Receitas — DEFAULT EXPANDIDO */}
              <details open className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700">⚡ Receitas prontas <span className="text-slate-600 font-normal normal-case">— {FORMULA_RECIPES_PISCINA.length} disponiveis</span></span>
                  <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {FORMULA_RECIPES_PISCINA.map((r) => (
                    <button key={r.label} type="button" onClick={() => {
                      if (r.needsLineRef) {
                        setPendingRecipe(r);
                        setPendingLineRefs(new Set());
                      } else {
                        setExpr(r.expr);
                        setPendingRecipe(null);
                        setPendingLineRefs(new Set());
                      }
                    }}
                      className="text-left rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-3 py-1.5 transition group/r">
                      <div className="text-xs font-semibold text-slate-800 group-hover/r:text-cyan-900">
                        {r.label}
                        {r.needsLineRef && <span className="ml-1 text-[9px] font-normal text-violet-700">(escolha a linha)</span>}
                      </div>
                      <div className="font-mono text-[11px] text-cyan-700">{r.expr}</div>
                      <div className="text-[10px] text-slate-500">{r.hint}</div>
                    </button>
                  ))}
                </div>
                {/* Picker de linhas (multi-select) — aparece quando o usuario clica numa
                    receita com needsLineRef. Lista linhas da MESMA etapa do item atual com
                    cellRef. Operador escolhe UMA ou VARIAS linhas — gera prod(LX, "key")
                    ou soma prod(LA, "key") + prod(LB, "key") + ... pra varios equipamentos. */}
                {pendingRecipe && (
                  <div className="mx-4 mb-3 rounded-lg border-2 border-violet-300 bg-violet-50 p-3">
                    <div className="text-xs font-bold text-violet-900 mb-1">
                      🔗 Escolha as linhas (1 ou mais) {pendingLineRefs.size > 0 && <span className="text-violet-700">— {pendingLineRefs.size} selecionada(s)</span>}
                    </div>
                    <div className="text-[11px] text-violet-800 mb-2 leading-tight">
                      Marque os equipamentos que entram nesta formula. Se escolher varios, a soma vira
                      <code className="bg-white px-1 rounded ml-1">{pendingRecipe.expr.replace('LREF', 'LA')} + {pendingRecipe.expr.replace('LREF', 'LB')} + ...</code>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(() => {
                        const sameSec = (otherItems || []).filter((o) => o.cellRef && itemPoolSection && o.poolSection === itemPoolSection);
                        const list = sameSec.length > 0 ? sameSec : (otherItems || []).filter((o) => o.cellRef);
                        if (list.length === 0) {
                          return <div className="text-[11px] text-amber-700 italic">Nenhuma outra linha disponivel.</div>;
                        }
                        return list.map((o) => {
                          const specs = o.productSpecs as Record<string, any> | null | undefined;
                          // Detecta a chave da spec usada na expressao da receita (ex: "tempoMontagemH")
                          const m = pendingRecipe.expr.match(/"([a-zA-Z_][a-zA-Z0-9_]*)"/);
                          const specKey = m ? m[1] : null;
                          const specVal = specKey && specs ? Number(specs[specKey]) : null;
                          const hasSpec = specVal !== null && Number.isFinite(specVal);
                          const checked = pendingLineRefs.has(o.cellRef);
                          return (
                            <label key={o.cellRef}
                              className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer transition ${
                                checked ? 'bg-violet-100 border-violet-500' : 'bg-white border-violet-200 hover:border-violet-400 hover:bg-violet-50'
                              }`}>
                              <input type="checkbox" checked={checked}
                                onChange={(e) => {
                                  setPendingLineRefs((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(o.cellRef);
                                    else next.delete(o.cellRef);
                                    return next;
                                  });
                                }}
                                className="h-3.5 w-3.5 accent-violet-600" />
                              <span className="font-mono text-[10px] text-violet-700">{o.cellRef}</span>
                              <span className="text-xs text-slate-800 flex-1">{o.description}</span>
                              {hasSpec && (
                                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {specKey}={specVal}
                                </span>
                              )}
                              {specKey && !hasSpec && (
                                <span className="text-[10px] text-amber-700">sem {specKey}</span>
                              )}
                              <span className="text-[10px] text-slate-500">({SECTION_LABEL[o.poolSection] || o.poolSection})</span>
                            </label>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" disabled={pendingLineRefs.size === 0}
                        onClick={() => {
                          const refs = Array.from(pendingLineRefs);
                          // Gera prod(LA, "key") + prod(LB, "key") + ... pra cada linha selecionada
                          const finalExpr = refs.map((r) => pendingRecipe.expr.replace(/\bLREF\b/g, r)).join(' + ');
                          setExpr(finalExpr);
                          setPendingRecipe(null);
                          setPendingLineRefs(new Set());
                        }}
                        className="rounded bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1 text-xs font-semibold">
                        Aplicar {pendingLineRefs.size > 0 && `(${pendingLineRefs.size})`}
                      </button>
                      <button type="button" onClick={() => { setPendingRecipe(null); setPendingLineRefs(new Set()); }}
                        className="text-[10px] text-violet-700 hover:text-violet-900 underline">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </details>

              {/* Variaveis — DEFAULT FECHADO */}
              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                    📐 Variaveis disponiveis
                    <span className="text-slate-600 font-normal normal-case ml-1">
                      — clique pra inserir no cursor
                      {productSpecsList.length > 0 && <span className="text-cyan-700"> · {productSpecsList.length} do produto vinculado</span>}
                    </span>
                  </span>
                  <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-2.5">
                  {/* Produto vinculado — destaque no topo se houver */}
                  {productSpecsList.length > 0 && (
                    <div>
                      <div className="text-[11px] font-medium text-cyan-800 mb-1">
                        Produto vinculado{productName ? `: ${productName}` : ""} ({productSpecsList.length} campos)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {productSpecsList.map(({ key, value }) => (
                          <button key={key} type="button" onClick={() => insert(key)}
                            title={`${key} = ${value} (de technicalSpecs do cadastro)`}
                            className="inline-flex items-center gap-2 text-xs rounded border border-cyan-200 bg-cyan-50 hover:border-cyan-500 hover:bg-cyan-100 px-2.5 py-1.5 transition">
                            <span className="font-mono font-bold text-cyan-800">{key}</span>
                            <span className="font-mono text-slate-900 font-bold tabular-nums bg-white px-1.5 py-0.5 rounded">{value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Grupos estaticos */}
                  {Object.entries(VAR_GROUPS).map(([key, group]) => (
                    <div key={key}>
                      <div className="text-[11px] font-medium text-slate-600 mb-1">{group.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.vars.map((k) => (
                          <button key={k} type="button" onClick={() => insert(k)}
                            title={VAR_DESCRIPTIONS[k]}
                            className="inline-flex items-center gap-2 text-xs rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-2.5 py-1.5 transition">
                            <span className="font-mono font-bold text-cyan-700">{k}</span>
                            <span className="font-mono text-slate-900 font-bold tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">{vars[k]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Sections (dinamico) */}
                  {sectionsList.length > 0 && (
                    <>
                      <div>
                        <div className="text-[11px] font-medium text-slate-600 mb-1">
                          Area de cada section ({sectionsList.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sectionsList.map((s) => {
                            const k = `areaSec${s.idx}`;
                            return (
                              <button key={k} type="button" onClick={() => insert(k)}
                                title={`Area da section ${s.idx} — ${s.name}`}
                                className="inline-flex items-center gap-2 text-xs rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-2.5 py-1.5 transition">
                                <span className="font-mono font-bold text-cyan-700">{k}</span>
                                <span className="text-slate-500 text-[10px]">{s.name}</span>
                                <span className="font-mono text-slate-900 font-bold tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">{s.area.toFixed(2)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-600 mb-1">Volume de cada section</div>
                        <div className="flex flex-wrap gap-1.5">
                          {sectionsList.map((s) => {
                            const k = `volumeSec${s.idx}`;
                            return (
                              <button key={k} type="button" onClick={() => insert(k)}
                                title={`Volume da section ${s.idx} — ${s.name}`}
                                className="inline-flex items-center gap-2 text-xs rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-2.5 py-1.5 transition">
                                <span className="font-mono font-bold text-cyan-700">{k}</span>
                                <span className="text-slate-500 text-[10px]">{s.name}</span>
                                <span className="font-mono text-slate-900 font-bold tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">{s.volume.toFixed(2)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </details>

              {/* Funcoes — DEFAULT FECHADO */}
              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                    🧮 Funcoes <span className="text-slate-600 font-normal normal-case">— {FORMULA_FUNCTIONS.join(" · ")}</span>
                  </span>
                  <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {FORMULA_FUNCTIONS.map((fn) => (
                    <button key={fn} type="button" onClick={() => insert(fn + "(")}
                      className="text-left rounded border border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 px-3 py-1.5 transition group/f">
                      <span className="font-mono font-bold text-cyan-700 group-hover/f:text-cyan-900">{fn}(...)</span>
                      <div className="text-[11px] text-slate-600 mt-0.5">{FORMULA_FN_HELP[fn]}</div>
                    </button>
                  ))}
                </div>
              </details>

              {/* Outras linhas — DEFAULT FECHADO */}
              {otherItems && otherItems.length > 0 && (
                <details className="group rounded-lg border border-slate-200 bg-white">
                  <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      🔗 Outras linhas <span className="text-slate-600 font-normal normal-case">— {otherItems.filter(o => o.cellRef !== itemCellRef).length} disponiveis · qty(LX) / total(LX) / unitPrice(LX)</span>
                    </span>
                    <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-4 pb-3 pt-1">
                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {otherItems
                        .filter((o) => o.cellRef && o.cellRef !== itemCellRef)
                        .map((o) => (
                          <div key={o.cellRef} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-cyan-50 text-xs">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="font-mono font-bold text-cyan-700 shrink-0">{o.cellRef}</span>
                              <span className="text-[9px] font-medium uppercase tracking-wide text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                                {SECTION_LABEL[o.poolSection] || o.poolSection}
                              </span>
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
                </details>
              )}

              {/* Sintaxe — nota inline compacta */}
              <div className="text-[11px] text-slate-500 px-1 pt-1">
                Operadores: <code className="bg-white border border-slate-300 px-1 rounded">+ − × ÷ ( )</code> · Decimal: <code className="bg-white border border-slate-300 px-1 rounded">0.1</code> ou <code className="bg-white border border-slate-300 px-1 rounded">0,1</code> · Use <code className="bg-white border border-slate-300 px-1 rounded">( )</code> pra controlar precedencia.
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
// AutoSelectModal — configura regra de auto-selecao do produto/serviço baseada
// em variaveis da piscina + technicalSpecs do candidato. Mesmo padrao visual do
// FormulaModal: cards/accordions, preview avaliado, sintaxe inline no fim.
// ─────────────────────────────────────────────────────────
const ORDER_BY_PRESETS: Array<{ value: string; label: string }> = [
  { value: 'priceCents asc', label: 'Mais barato primeiro' },
  { value: 'priceCents desc', label: 'Mais caro primeiro' },
  { value: 'vazaoM3h desc', label: 'Maior vazao primeiro' },
  { value: 'vazaoM3h asc', label: 'Menor vazao primeiro' },
  { value: 'kcalHMax desc', label: 'Maior aquecimento primeiro' },
];

// Templates completos de auto-selecao — clique em 1 e popula filterCategoria+where+orderBy+indicator
const AUTOSELECT_TEMPLATES: Array<{ icon: string; label: string; description: string; rule: AutoSelectRule }> = [
  {
    icon: '🌊',
    label: 'Filtro de piscina (vazao = volume / 3.7)',
    description: 'Conjunto Filtrante cuja vazao atende vazaoIdeal = volume / 3.7. Escolhe o filtro de menor vazao que cumpra (logica fiel ao macro VBA da planilha original). Indicador 5 niveis baseado em tempo de ciclo.',
    rule: {
      filterCategoria: null,
      filterDescription: 'Conjunto Filtrante',
      where: 'vazaoM3h >= volume / 3.7',
      orderBy: 'vazaoM3h asc',
      indicator: {
        label: 'Tempo de filtragem',
        expr: 'volume / vazaoM3h',
        unit: 'h',
        levels: [
          { max: 3, label: 'Excelente', color: 'emerald' },
          { max: 4, label: 'Otimo', color: 'green' },
          { max: 6, label: 'Bom', color: 'yellow' },
          { max: 8, label: 'Regular', color: 'orange' },
          { max: 999, label: 'Pessimo', color: 'red' },
        ],
      },
    },
  },
  {
    icon: '🔥',
    label: 'Aquecedor por Kcal/h (~600 kcal/m³h)',
    description: 'Aquecedor (bomba de calor, solar ou trocador) com capacidade Kcal/h suficiente pra aquecer o volume da piscina. Indicador 5 niveis baseado em kcalH por m³.',
    rule: {
      filterCategoria: null,
      filterDescription: 'Aquecedor',
      where: 'kcalHMax >= volume * 600',
      orderBy: 'priceCents asc',
      indicator: {
        label: 'Capacidade aquec.',
        expr: 'kcalHMax / volume',
        unit: 'kcal/m³h',
        levels: [
          { max: 400, label: 'Subdim.', color: 'red' },
          { max: 600, label: 'Justo', color: 'orange' },
          { max: 900, label: 'Adequado', color: 'yellow' },
          { max: 1500, label: 'Bom', color: 'green' },
          { max: 99999, label: 'Excelente', color: 'emerald' },
        ],
      },
    },
  },
  // 3 templates de tubo — mesma logica matematica, filterDescription distinto pra
  // garantir que o auto-select pegue o tipo de tubo certo (filtragem nao deve
  // pegar tubo de cascata mesmo que ambos tenham tuboEntradaMm igual).
  // Templates de tubo: usam prod(LREF, "tuboEntradaMm") como placeholder.
  // O usuario precisa substituir LREF pela linha do equipamento principal
  // (filtro/cascata/SPA) usando o botao "Inserir referencia a linha" do where.
  {
    icon: '🚿',
    label: 'Tubo (mesmo diametro do equipamento — escolha a linha)',
    description: 'Tubos com diametro = tuboEntradaMm do equipamento principal de outra linha (filtro/cascata/SPA). Apos aplicar, edite o where pra apontar a linha certa (ex: prod(L3, "tuboEntradaMm")). Funciona em qualquer etapa.',
    rule: {
      filterCategoria: null,
      filterDescription: 'tubo',
      where: 'tuboEntradaMm >= prod(LREF, "tuboEntradaMm")',
      orderBy: 'tuboEntradaMm asc',
      indicator: {
        label: 'Compatibilidade tubo',
        expr: 'tuboEntradaMm - prod(LREF, "tuboEntradaMm")',
        unit: 'mm',
        levels: [
          { max: -0.01, label: 'Incompativel (tubo menor)', color: 'red' },
          { max: 0, label: 'Compativel', color: 'emerald' },
          { max: 999, label: 'Maior que necessario', color: 'yellow' },
        ],
      },
    },
  },
  {
    icon: '💦',
    label: 'Cascata (operador escolhe)',
    description: 'Filtra candidatos pelo Tipo "Cascata" no catalogo, mas NAO escolhe automaticamente. O operador clica em 🔍 e escolhe a cascata desejada na lista pre-filtrada. Ideal pra item estetico sem criterio objetivo. Salva no template sem produto pre-selecionado.',
    rule: {
      filterPoolType: 'Cascata',
      filterCategoria: null,
      filterDescription: null,
      where: null,
      orderBy: null,
      manualSelection: true,
      indicator: null,
    },
  },
  {
    icon: '💦',
    label: 'Kit Cascata (mais barato disponivel)',
    description: 'Kit Cascata Inox De Embutir. Escolhe o mais barato do catalogo. Para selecao baseada em largura especifica da borda, edite o criterio.',
    rule: {
      filterCategoria: null,
      filterDescription: 'Kit Cascata',
      where: '',
      orderBy: 'priceCents asc',
      indicator: null,
    },
  },
  {
    icon: '🛁',
    label: 'Kit SPA (mais barato disponivel)',
    description: 'Kit Spa com hidromassagem. Escolhe o mais barato do catalogo. Para selecao baseada em numero de jatos ou capacidade, edite o criterio.',
    rule: {
      filterCategoria: null,
      filterDescription: 'Kit Spa',
      where: '',
      orderBy: 'priceCents asc',
      indicator: null,
    },
  },
  {
    icon: '⚡',
    label: 'Disjuntor geral por amperagem total',
    description: 'Soma amperagem de todas as linhas eletricas × 1.25 (fator de potencia)',
    rule: {
      filterCategoria: null,
      filterDescription: 'disjuntor',
      where: 'amperagem >= sum("amperagem") * 1.25',
      orderBy: 'amperagem asc',
      indicator: {
        label: 'Carga total',
        expr: 'sum("amperagem") * 1.25',
        unit: 'A',
        levels: [
          { max: 1000, label: 'OK', color: 'green' },
        ],
      },
    },
  },
  {
    icon: '🔌',
    label: 'Quadro por soma de espacos',
    description: 'Quadro de distribuicao com numero de polos >= soma de bifTrifConta (espacos) dos equipamentos eletricos. Eh independente do tipo (Bif/Trif) — modulos de automacao podem ser Bif e ainda ocupar varios espacos.',
    rule: {
      filterCategoria: null,
      filterDescription: 'quadro distr',
      where: 'polos >= sum("bifTrifConta")',
      orderBy: 'polos asc',
      indicator: {
        label: 'Espacos usados',
        expr: 'sum("bifTrifConta")',
        unit: '',
        levels: [
          { max: 999, label: 'OK', color: 'green' },
        ],
      },
    },
  },
  {
    icon: '💡',
    label: 'Fonte de iluminacao por potencia total',
    description: 'Fonte 12V que aguenta a soma da potencia (W) dos refletores',
    rule: {
      filterCategoria: null,
      filterDescription: 'fonte',
      where: 'amperagem >= sum("potenciaWatts") / 12',
      orderBy: 'amperagem asc',
      indicator: {
        label: 'A carga ilum',
        expr: 'sum("potenciaWatts") / 12',
        unit: 'A',
        levels: [
          { max: 999, label: 'OK', color: 'green' },
        ],
      },
    },
  },
];

const INDICATOR_TEMPLATES: Array<{ label: string; preset: { label: string; expr: string; unit: string; levels: { max: number; label: string; color: string }[] } }> = [
  {
    label: 'Tempo de filtragem (volume / vazaoM3h)',
    preset: {
      label: 'Tempo de filtragem',
      expr: 'volume / vazaoM3h',
      unit: 'h',
      levels: [
        { max: 4, label: 'Excelente', color: 'green' },
        { max: 8, label: 'Bom', color: 'yellow' },
        { max: 999, label: 'Ruim', color: 'red' },
      ],
    },
  },
  {
    label: 'Aquecimento (kcalHMax / volume)',
    preset: {
      label: 'Aquecimento',
      expr: 'kcalHMax / volume',
      unit: 'kcal/m³h',
      levels: [
        { max: 200, label: 'Insuficiente', color: 'red' },
        { max: 500, label: 'Adequado', color: 'yellow' },
        { max: 9999, label: 'Excelente', color: 'green' },
      ],
    },
  },
];

function AutoSelectModal({
  initialRule,
  catalog,
  dimensions,
  environmentParams,
  siblingVars,
  itemDescription,
  currentProductName,
  sectionItems,
  onClose,
  onSave,
  onClear,
}: {
  initialRule: AutoSelectRule | null;
  catalog: CatalogConfig[];
  dimensions: any;
  environmentParams?: any;
  // Vars 'sibling*' calculadas dos outros items da mesma etapa — replica
  // backend pra preview do modal mostrar candidatos certos quando regra
  // referencia o equipamento da linha vizinha (ex: tubo usa siblingTuboMm).
  siblingVars?: Record<string, number>;
  // Items da mesma etapa (sem o atual) — usado pra diagnosticar siblings
  // ausentes E alimentar dropdown "Equipamento principal (linha)".
  sectionItems?: { id: string; cellRef: string | null; description: string; linked: boolean; specs: Record<string, any> | null }[];
  itemDescription?: string;
  currentProductName?: string | null;
  onClose: () => void;
  onSave: (rule: AutoSelectRule) => void;
  onClear: () => void;
}) {
  const [filterPoolType, setFilterPoolType] = useState(initialRule?.filterPoolType || '');
  const [filterCategoria, setFilterCategoria] = useState(initialRule?.filterCategoria || '');
  const [filterDescription, setFilterDescription] = useState(initialRule?.filterDescription || '');
  const [where, setWhere] = useState(initialRule?.where || '');
  const [orderBy, setOrderBy] = useState(initialRule?.orderBy || 'priceCents asc');
  const [manualSelection, setManualSelection] = useState(!!initialRule?.manualSelection);
  const [linkedCellRef, setLinkedCellRef] = useState(initialRule?.linkedCellRef || '');
  const [hasIndicator, setHasIndicator] = useState(!!initialRule?.indicator);
  const [indLabel, setIndLabel] = useState(initialRule?.indicator?.label || '');
  const [indExpr, setIndExpr] = useState(initialRule?.indicator?.expr || '');
  const [indUnit, setIndUnit] = useState(initialRule?.indicator?.unit || '');
  const [indLevels, setIndLevels] = useState<{ max: number; label: string; color: string }[]>(
    initialRule?.indicator?.levels || [
      { max: 4, label: 'Excelente', color: 'green' },
      { max: 8, label: 'Bom', color: 'yellow' },
      { max: 999, label: 'Ruim', color: 'red' },
    ]
  );

  // Tipos unicos extraidos do catalogo (Product.poolType — campo top-level).
  // Preferido sobre categoriaPlanilha (legado em technicalSpecs).
  const poolTypes = useMemo(() => {
    const set = new Set<string>();
    for (const c of catalog) {
      const t = c.product?.poolType;
      if (t && typeof t === 'string' && t.trim()) set.add(t);
    }
    return Array.from(set).sort();
  }, [catalog]);

  // Categorias legadas — so aparece dropdown se houver valor ja cadastrado (compat).
  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const c of catalog) {
      const cat = (c.product?.technicalSpecs as any)?.categoriaPlanilha
                ?? (c.service?.technicalSpecs as any)?.categoriaPlanilha;
      if (cat && typeof cat === 'string') set.add(cat);
    }
    return Array.from(set).sort();
  }, [catalog]);

  // Sibling vars dinamicas: se linkedCellRef definido, pega specs da linha vinculada
  // (modo explicito). Caso contrario, usa siblingVars genericos passados pelo pai.
  const effectiveSiblingVars = useMemo(() => {
    if (!linkedCellRef.trim() || !sectionItems) return siblingVars || {};
    const target = sectionItems.find((it) => it.cellRef === linkedCellRef.trim());
    if (!target?.specs) return {};
    const out: Record<string, number> = {};
    for (const [k, raw] of Object.entries(target.specs)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      out[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
    }
    return out;
  }, [linkedCellRef, sectionItems, siblingVars]);

  // Vars do orcamento (mesma lista de FORMULA_VARS, computada das dimensoes)
  const dimVars = useMemo(() => {
    const v: Record<string, number> = {
      length: Number(dimensions?.length) || 0,
      width: Number(dimensions?.width) || 0,
      depth: Number(dimensions?.depth) || 0,
      area: Number(dimensions?.area) || 0,
      perimeter: Number(dimensions?.perimeter) || 0,
      volume: Number(dimensions?.volume) || 0,
      cantos: Number(dimensions?.cantos) || 0,
      perimExterno: Number(dimensions?.perimetroExternoBorda) || 0,
      perimInterno: Number(dimensions?.perimetroParedesInternas) || 0,
      areaParedeEFundo: Number(dimensions?.areaParedeEFundo) || 0,
      radierM2: Number(dimensions?.radierM2) || 0,
      radierEspessura: Number(dimensions?.radierEspessura) || 0,
      radierM3: Number(dimensions?.radierM3) || 0,
      escavacao: Number(dimensions?.escavacaoM3) || 0,
      tempLocal: Number(environmentParams?.temperaturaMediaLocal ?? environmentParams?.temperatura) || 0,
      tempAgua: Number(environmentParams?.temperaturaAguaDesejada) || 0,
      // Sibling vars resolvidas: linkedCellRef se definido, senao siblingVars genericos.
      ...effectiveSiblingVars,
    };
    return v;
  }, [dimensions, environmentParams, effectiveSiblingVars]);

  // Map cellRef -> specs do produto vinculado, alimenta substituicao de prod(LX, "spec") nas regras
  const cellRefSpecs = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const s of sectionItems || []) {
      if (s.cellRef && s.specs) m.set(s.cellRef, s.specs);
    }
    return m;
  }, [sectionItems]);

  // Avalia condicao boolean (mesmo padrao do evalLocal mas retornando boolean)
  function evalCondition(expr: string, vars: Record<string, number>): boolean {
    if (!expr.trim()) return true;
    let s = expr.replace(/(\d),(\d)/g, '$1.$2');
    // prod(LX, "spec") — substitui pela spec real do produto da linha referenciada
    s = s.replace(/\bprod\s*\(\s*(L\d+)\s*,\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g, (_m, ref: string, key: string) => {
      const specs = cellRefSpecs.get(ref);
      const v = specs ? Number(specs[key] ?? 0) : 0;
      return '(' + (Number.isFinite(v) ? v : 0) + ')';
    });
    s = s.replace(SECTION_VAR_PATTERN, (_m, prefix: string, num: string) => '(' + (vars[prefix + num] || 0) + ')');
    for (const k of FORMULA_VARS) {
      s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), '(' + (vars[k] || 0) + ')');
    }
    const allowedSet = new Set<string>(FORMULA_VARS as readonly string[]);
    for (const [key, val] of Object.entries(vars)) {
      if (val == null) continue;
      if (allowedSet.has(key)) continue;
      if (/^(areaSec|volumeSec)\d+$/.test(key)) continue;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
      s = s.replace(new RegExp('\\b' + key + '\\b', 'g'), '(' + (Number(val) || 0) + ')');
    }
    const fnPattern = new RegExp('\\b(' + FORMULA_FUNCTIONS.join('|') + ')\\b', 'g');
    const stripped = s.replace(fnPattern, '');
    if (/[a-zA-Z_]/.test(stripped)) return false;
    if (!/^[\d.\s+\-*/(),<>=!&|]*$/.test(stripped)) return false;
    try {
      const fn = Function('ceil', 'floor', 'round', 'min', 'max', '"use strict"; return (' + s + ');');
      return !!fn(Math.ceil, Math.floor, Math.round, Math.min, Math.max);
    } catch { return false; }
  }

  function evalNumber(expr: string, vars: Record<string, number>): number {
    if (!expr.trim()) return NaN;
    // Pre-substitui prod(LX, "spec") pelo valor real antes de delegar pro evalLocal
    let e = expr;
    e = e.replace(/\bprod\s*\(\s*(L\d+)\s*,\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g, (_m, ref: string, key: string) => {
      const specs = cellRefSpecs.get(ref);
      const v = specs ? Number(specs[key] ?? 0) : 0;
      return '(' + (Number.isFinite(v) ? v : 0) + ')';
    });
    const r = evalLocal(e, vars);
    return r.ok ? r.value! : NaN;
  }

  // Preview: lista todos os candidatos avaliados, marca o selecionado
  const preview = useMemo(() => {
    const items = catalog.map((c) => ({
      cfg: c,
      desc: c.product?.description || c.service?.name || '',
      priceCents: c.product?.salePriceCents ?? c.service?.priceCents ?? 0,
      specs: ((c.product?.technicalSpecs ?? c.service?.technicalSpecs) || {}) as Record<string, any>,
      type: c.product ? 'product' : 'service' as 'product' | 'service',
      kind: c.product ? 'Produto' : 'Serviço',
    }));
    // Normalizacao remove acentos (NFD + strip combining marks) pra que
    // 'conexoes' matcha 'conexões' e vice-versa.
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const filtered1 = items.filter((c) => {
      if (filterPoolType.trim()) {
        const t = c.cfg.product?.poolType || '';
        if (!t || norm(String(t)) !== norm(filterPoolType.trim())) return false;
      }
      if (filterCategoria.trim() && norm(String(c.specs.categoriaPlanilha || '')) !== norm(filterCategoria.trim())) return false;
      if (filterDescription.trim() && !norm(c.desc).includes(norm(filterDescription.trim()))) return false;
      return true;
    });
    const filtered2 = filtered1.map((c) => {
      const specVars: Record<string, number> = {};
      for (const [k, v] of Object.entries(c.specs)) {
        const n = Number(v);
        if (Number.isFinite(n)) specVars[k] = n;
      }
      const merged = { ...dimVars, ...specVars };
      const passes = evalCondition(where, merged);
      return { ...c, merged, passes };
    });
    // Ordena: somente os que passam, depois aplica orderBy
    const passing = filtered2.filter((c) => c.passes);
    const m = orderBy.trim().match(/^(.+?)\s+(asc|desc)$/i);
    const orderExpr = m ? m[1].trim() : orderBy.trim();
    const dir = m && m[2].toLowerCase() === 'desc' ? -1 : 1;
    const sorted = [...passing].sort((a, b) => {
      const va = evalNumber(orderExpr, { ...a.merged, priceCents: a.priceCents, salePriceCents: a.priceCents });
      const vb = evalNumber(orderExpr, { ...b.merged, priceCents: b.priceCents, salePriceCents: b.priceCents });
      const aa = Number.isFinite(va) ? va : Number.MAX_SAFE_INTEGER;
      const bb = Number.isFinite(vb) ? vb : Number.MAX_SAFE_INTEGER;
      return (aa - bb) * dir;
    });
    return { all: filtered2, selected: sorted[0] || null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, filterPoolType, filterCategoria, filterDescription, where, orderBy, dimVars]);

  // Indicator preview: avalia a expressao no contexto do candidato selecionado
  const indicatorPreview = useMemo(() => {
    if (!hasIndicator || !indExpr.trim() || !preview.selected) return null;
    const v = evalNumber(indExpr, preview.selected.merged);
    if (!Number.isFinite(v)) return null;
    const sorted = [...indLevels].sort((a, b) => a.max - b.max);
    const matched = sorted.find((l) => v <= l.max);
    return { value: v, label: matched?.label || '', color: matched?.color || 'slate' };
  }, [hasIndicator, indExpr, indLevels, preview.selected]);

  function applyTemplate(t: typeof INDICATOR_TEMPLATES[number]) {
    setHasIndicator(true);
    setIndLabel(t.preset.label);
    setIndExpr(t.preset.expr);
    setIndUnit(t.preset.unit);
    setIndLevels(t.preset.levels);
  }

  function handleSave() {
    const rule: AutoSelectRule = {
      filterPoolType: filterPoolType.trim() || null,
      filterCategoria: filterCategoria.trim() || null,
      filterDescription: filterDescription.trim() || null,
      where: where.trim() || null,
      orderBy: orderBy.trim() || null,
      manualSelection: manualSelection || null,
      linkedCellRef: linkedCellRef.trim() || null,
      indicator: hasIndicator && indLabel.trim() && indExpr.trim()
        ? { label: indLabel.trim(), expr: indExpr.trim(), unit: indUnit.trim() || null, levels: indLevels }
        : null,
    };
    onSave(rule);
  }

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-cyan-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">✨ Auto-selecao do produto</h3>
                {itemDescription && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Linha: <span className="font-medium text-slate-800">{itemDescription}</span>
                    {currentProductName && <span className="text-slate-500"> · vinculado: {currentProductName}</span>}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0">
              <div className="rounded-lg border-2 border-violet-200 bg-violet-50/50 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-violet-900 mb-1">Resultado da auto-selecao</div>
                {preview.selected ? (
                  <div className="text-sm">
                    <span className="font-medium text-slate-900">{preview.selected.kind}: {preview.selected.desc}</span>
                    <span className="text-slate-500 ml-2">R$ {(preview.selected.priceCents / 100).toFixed(2)}</span>
                    {indicatorPreview && (
                      <span className={"ml-2 text-[10px] font-medium px-2 py-0.5 rounded border " +
                        (indicatorPreview.color === 'emerald' ? "bg-emerald-50 border-emerald-400 text-emerald-800" :
                         indicatorPreview.color === 'green' ? "bg-green-50 border-green-300 text-green-800" :
                         indicatorPreview.color === 'blue' ? "bg-blue-50 border-blue-300 text-blue-800" :
                         indicatorPreview.color === 'yellow' ? "bg-yellow-50 border-yellow-300 text-yellow-800" :
                         indicatorPreview.color === 'orange' ? "bg-orange-50 border-orange-300 text-orange-800" :
                         indicatorPreview.color === 'red' ? "bg-red-50 border-red-300 text-red-800" :
                         "bg-slate-50 border-slate-300 text-slate-700")}>
                        {indLabel}: {indicatorPreview.value.toFixed(2)}{indUnit} → {indicatorPreview.label}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">⚠ Nenhum candidato passa nos filtros + criterio. Ajuste a regra.</div>
                )}
              </div>
              {/* Diagnostico: vars 'sibling*' calculadas pelos outros items da mesma etapa.
                  Util pra entender por que uma regra com siblingTuboMm/siblingVazaoM3h falha
                  (ex: equipamento principal nao vinculado ou sem technicalSpecs). */}
              {siblingVars && Object.keys(siblingVars).length > 0 && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  <span className="font-semibold uppercase text-slate-600 mr-2">Vars desta etapa:</span>
                  {Object.entries(siblingVars).map(([k, v]) => (
                    <span key={k} className="inline-block mr-3">
                      <code className="text-slate-900">{k}</code>=<span className="font-mono">{v}</span>
                    </span>
                  ))}
                </div>
              )}
              {/* Diagnostico especifico: detecta siblings necessarias (regex em where + indicator.expr)
                  e mostra exatamente o que falta — linhas SEM vinculo ou com produto sem o campo.
                  Substitui o aviso generico que so dizia "nenhum equipamento vinculado". */}
              {(() => {
                const exprText = `${where} ${hasIndicator ? indExpr : ''}`;
                const matches = Array.from(exprText.matchAll(/\bsibling([A-Z][A-Za-z0-9_]*)\b/g));
                if (matches.length === 0) return null;
                const needed = Array.from(new Map(matches.map((m) => [m[0], { full: m[0], specKey: m[1].charAt(0).toLowerCase() + m[1].slice(1) }])).values());
                const missing = needed.filter((n) => !siblingVars || siblingVars[n.full] === undefined);
                if (missing.length === 0) return null;

                const sectionItemsArr = sectionItems || [];
                const unlinked = sectionItemsArr.filter((it) => !it.linked);
                return (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 space-y-1.5">
                    <div className="font-semibold text-amber-900">⚠ Variavel(is) ausente(s) nesta etapa:</div>
                    {missing.map((m) => {
                      const linkedWithoutField = sectionItemsArr.filter((it) => it.linked && (!it.specs || !Number.isFinite(Number(it.specs[m.specKey]))));
                      return (
                        <div key={m.full} className="pl-2 border-l-2 border-amber-400">
                          <div className="font-medium"><code className="text-amber-900">{m.full}</code> (campo <code>{m.specKey}</code>)</div>
                          {unlinked.length > 0 && (
                            <div className="text-amber-800">
                              Linhas SEM produto vinculado nesta etapa: {unlinked.slice(0, 3).map((it) => `"${it.description}"`).join(', ')}{unlinked.length > 3 ? ` e mais ${unlinked.length - 3}` : ''}. Clique em 🔍 nessa linha pra vincular.
                            </div>
                          )}
                          {unlinked.length === 0 && linkedWithoutField.length > 0 && (
                            <div className="text-amber-800">
                              Produtos vinculados sem o campo <code>{m.specKey}</code>: {linkedWithoutField.slice(0, 3).map((it) => `"${it.description}"`).join(', ')}. Preencha em Cadastros &gt; Produtos &gt; Aba Piscina.
                            </div>
                          )}
                          {unlinked.length === 0 && linkedWithoutField.length === 0 && (
                            <div className="text-amber-800">Nenhum item da etapa tem esse campo. Adicione um produto principal (filtro/aquecedor/cascata/SPA) com <code>{m.specKey}</code> preenchido.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-2">
              {/* TEMPLATES PRONTOS — clique pra preencher tudo de uma vez */}
              <details open className="group rounded-lg border border-violet-300 bg-violet-50/30">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-900">⚡ Templates prontos <span className="text-violet-700 font-normal normal-case">— clique pra usar uma regra ja configurada</span></span>
                  <span className="text-violet-700 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {AUTOSELECT_TEMPLATES.map((t) => (
                    <button key={t.label} type="button" onClick={() => {
                      setFilterPoolType(t.rule.filterPoolType || '');
                      setFilterCategoria(t.rule.filterCategoria || '');
                      setFilterDescription(t.rule.filterDescription || '');
                      setWhere(t.rule.where || '');
                      setOrderBy(t.rule.orderBy || 'priceCents asc');
                      setManualSelection(!!t.rule.manualSelection);
                      if (t.rule.indicator) {
                        setHasIndicator(true);
                        setIndLabel(t.rule.indicator.label);
                        setIndExpr(t.rule.indicator.expr);
                        setIndUnit(t.rule.indicator.unit || '');
                        // Clone profundo dos levels — array do template eh shared, sem clone qualquer
                        // edicao via UI no state mutaria o template tambem (causa visual estranho ao trocar templates).
                        setIndLevels(t.rule.indicator.levels.map((l) => ({ ...l })));
                      } else {
                        // Template sem indicator desativa o anterior pra UI ficar consistente com a regra aplicada
                        setHasIndicator(false);
                      }
                    }} className="text-left rounded border border-violet-300 bg-white hover:border-violet-500 hover:bg-violet-50 px-3 py-2 transition">
                      <div className="text-sm font-semibold text-violet-900">{t.icon} {t.label}</div>
                      <div className="text-[11px] text-slate-700 mt-0.5">{t.description}</div>
                    </button>
                  ))}
                </div>
              </details>

              {/* CANDIDATOS */}
              <details open className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">🎯 Candidatos <span className="text-slate-600 font-normal normal-case">— de qual catalogo buscar</span></span>
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-800 mb-1">
                      Tipo (Piscina) <span className="text-slate-500 font-normal">— preferido</span>
                    </label>
                    <select value={filterPoolType} onChange={(e) => setFilterPoolType(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                      <option value="">— Sem filtro de tipo —</option>
                      {poolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {poolTypes.length === 0 && (
                      <p className="text-[10px] text-amber-700 mt-1">
                        Nenhum produto com Tipo cadastrado. Defina o Tipo na aba Piscina do cadastro do produto pra alimentar este dropdown.
                      </p>
                    )}
                  </div>
                  {(filterCategoria || categorias.length > 0) && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Categoria (legado) <span className="text-slate-500 font-normal">— prefira usar Tipo acima</span>
                      </label>
                      <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700">
                        <option value="">— Sem filtro de categoria —</option>
                        {categorias.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-800 mb-1">Descricao contendo (opcional, case-insensitive)</label>
                    <input type="text" value={filterDescription} onChange={(e) => setFilterDescription(e.target.value)}
                      placeholder="Ex: filtro, aquecedor"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                  </div>
                  {/* Chavinha "Apenas filtrar" — usuario escolhe na mao, engine nao auto-vincula */}
                  <label className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={manualSelection}
                      onChange={(e) => setManualSelection(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-amber-600" />
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Apenas filtrar — nao escolher automaticamente</div>
                      <div className="text-[11px] text-amber-800 leading-tight">
                        Ideal pra items esteticos (cascata, refletor, revestimento) sem criterio objetivo. O catalogo so mostra
                        candidatos do tipo, mas o operador escolhe na mao. Salva no template sem produto pre-selecionado.
                      </div>
                    </div>
                  </label>

                </div>
              </details>

              {/* CRITERIO */}
              <details open className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">🔍 Criterio <span className="text-slate-600 font-normal normal-case">— condicao com vars do orcamento + specs do candidato</span></span>
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-2">
                  <input id="autoselect-where-input" type="text" value={where} onChange={(e) => setWhere(e.target.value)}
                    placeholder='Ex: vazaoM3h * 1 >= volume * 0.25  |  tuboEntradaMm >= prod(L3, "tuboEntradaMm")'
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono text-slate-900" />
                  <div className="flex items-center gap-2 flex-wrap">
                    {(sectionItems || []).filter((it) => it.linked && it.cellRef).length > 0 && (
                      <details className="relative">
                        <summary className="cursor-pointer list-none rounded border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800 px-2 py-1 text-[11px] font-semibold transition">
                          📐 Inserir prod(L?, "spec") — referencia a linha
                        </summary>
                        <div className="absolute top-full left-0 mt-1 z-10 rounded-lg border border-violet-300 bg-white shadow-lg p-2 min-w-[280px] max-h-60 overflow-y-auto">
                          <div className="text-[10px] text-violet-900 font-semibold mb-1">Clique numa linha pra inserir:</div>
                          {(sectionItems || []).filter((it) => it.linked && it.cellRef).map((it) => {
                            const specs = (it.specs as Record<string, any>) || {};
                            const numKeys = Object.keys(specs).filter((k) => Number.isFinite(Number(specs[k])));
                            return (
                              <div key={it.cellRef} className="mb-1.5 last:mb-0">
                                <div className="text-[10px] font-semibold text-slate-700 mb-0.5">
                                  <code className="text-violet-700">{it.cellRef}</code> — {it.description}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {numKeys.length === 0 ? (
                                    <span className="text-[10px] text-amber-700 italic">sem specs numericas</span>
                                  ) : numKeys.map((k) => (
                                    <button key={k} type="button"
                                      onClick={() => {
                                        const insert = `prod(${it.cellRef}, "${k}")`;
                                        const input = document.getElementById('autoselect-where-input') as HTMLInputElement | null;
                                        if (input && document.activeElement === input) {
                                          const start = input.selectionStart ?? where.length;
                                          const end = input.selectionEnd ?? where.length;
                                          const next = where.slice(0, start) + insert + where.slice(end);
                                          setWhere(next);
                                          requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + insert.length, start + insert.length); });
                                        } else {
                                          setWhere((p) => (p + (p.endsWith(' ') || p === '' ? '' : ' ') + insert).trim());
                                        }
                                      }}
                                      className="text-[10px] font-mono bg-slate-100 hover:bg-violet-100 hover:text-violet-900 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                      {k}={specs[k]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-700 leading-snug">
                    Vars: orcamento (volume, area, areaParedeEFundo, dias, ...) + technicalSpecs do candidato (vazaoM3h, kcalHMin, tuboEntradaMm, ...).
                    Pra ler spec de outra linha: <code className="bg-slate-100 px-1 rounded">prod(L3, "tuboEntradaMm")</code> (use o botao acima).
                    Operadores: <code className="bg-slate-100 px-1 rounded text-slate-900">+ − × ÷ ( ) &gt;= &lt;= &gt; &lt; == != &amp;&amp; ||</code>
                  </div>
                </div>
              </details>

              {/* ORDEM */}
              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">📊 Ordem <span className="text-slate-600 font-normal normal-case">— em caso de empate, qual escolher</span></span>
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-2">
                  <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                    {ORDER_BY_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.value})</option>)}
                  </select>
                  <input type="text" value={orderBy} onChange={(e) => setOrderBy(e.target.value)}
                    placeholder="OU customizado: ex: priceCents asc"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono text-slate-900" />
                </div>
              </details>

              {/* INDICATOR */}
              <details open={hasIndicator} className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">🎨 Indicador <span className="text-slate-600 font-normal normal-case">— badge visivel na linha</span></span>
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={hasIndicator} onChange={(e) => setHasIndicator(e.target.checked)} />
                    Mostrar indicador na linha
                  </label>
                  {hasIndicator && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {INDICATOR_TEMPLATES.map((t) => (
                          <button key={t.label} type="button" onClick={() => applyTemplate(t)}
                            className="text-[11px] font-medium rounded border border-violet-400 bg-violet-50 hover:bg-violet-100 px-2 py-1 text-violet-800">
                            ⚡ {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-800 mb-1">Label</label>
                          <input type="text" value={indLabel} onChange={(e) => setIndLabel(e.target.value)}
                            placeholder="Ex: Tempo de filtragem"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] font-medium text-slate-800 mb-1">Calculo</label>
                          <input type="text" value={indExpr} onChange={(e) => setIndExpr(e.target.value)}
                            placeholder="Ex: volume / vazaoM3h"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono text-slate-900" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-800 mb-1">Unidade</label>
                        <input type="text" value={indUnit} onChange={(e) => setIndUnit(e.target.value)}
                          placeholder="Ex: h, kcal/m³h"
                          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900" />
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-800 mb-1">Niveis (avalia em ordem; primeiro que value &lt;= max ganha)</div>
                        {indLevels.map((lvl, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-1">
                            <select value={lvl.color} onChange={(e) => {
                              const v = [...indLevels]; v[idx] = { ...v[idx], color: e.target.value }; setIndLevels(v);
                            }} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900">
                              <option value="emerald">💚 Verde escuro</option>
                              <option value="green">🟢 Verde</option>
                              <option value="blue">🔵 Azul</option>
                              <option value="yellow">🟡 Amarelo</option>
                              <option value="orange">🟠 Laranja</option>
                              <option value="red">🔴 Vermelho</option>
                            </select>
                            <span className="text-[11px] font-medium text-slate-700">ate</span>
                            <input type="number" value={lvl.max} step="0.01" onChange={(e) => {
                              const v = [...indLevels]; v[idx] = { ...v[idx], max: parseFloat(e.target.value) || 0 }; setIndLevels(v);
                            }} className="w-24 rounded border border-slate-300 px-2 py-1 text-sm tabular-nums text-slate-900" />
                            <input type="text" value={lvl.label} placeholder="Label" onChange={(e) => {
                              const v = [...indLevels]; v[idx] = { ...v[idx], label: e.target.value }; setIndLevels(v);
                            }} className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900" />
                            <button type="button" onClick={() => setIndLevels(indLevels.filter((_, i) => i !== idx))}
                              className="text-red-600 hover:text-red-800 text-sm font-bold">✕</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setIndLevels([...indLevels, { max: 0, label: '', color: 'slate' }])}
                          className="text-xs font-medium text-violet-700 hover:text-violet-900 hover:underline">+ adicionar nivel</button>
                      </div>
                    </>
                  )}
                </div>
              </details>

              {/* CANDIDATOS AVALIADOS */}
              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">👁 Preview <span className="text-slate-600 font-normal normal-case">({preview.all.length} candidatos avaliados)</span></span>
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-3 pt-1 max-h-60 overflow-y-auto">
                  {preview.all.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">Nenhum candidato bate com os filtros (categoria/descricao). Ajuste.</div>
                  ) : (
                    <div className="text-xs space-y-1">
                      {preview.all.map((c) => (
                        <div key={c.cfg.id} className={"flex items-center justify-between gap-2 px-2 py-1 rounded " + (c.passes ? "" : "opacity-50")}>
                          <span className="shrink-0">{c.passes ? "✓" : "🚫"}</span>
                          <span className="flex-1 truncate">{c.kind}: {c.desc}</span>
                          <span className="text-slate-500 tabular-nums">R$ {(c.priceCents / 100).toFixed(2)}</span>
                          {preview.selected?.cfg.id === c.cfg.id && <span className="text-[10px] font-bold text-violet-700">SELECIONADO</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </div>

            <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
              <button type="button" onClick={onClear}
                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">
                🗑 Remover regra
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button>
                <button type="button" onClick={handleSave}
                  className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700">
                  ✓ Aplicar regra
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
    if (mode === "new" && !name.trim()) { toast("Nome obrigatório", "error"); return; }
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
              Nome do modelo {mode === "update" && <span className="text-slate-600">(opcional — mantem o atual se vazio)</span>}
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
function CatalogPickModal({ catalog, currentSection, autoSelectRule, dimensions, environmentParams, siblingVars, onClose, onPick }: {
  catalog: CatalogConfig[];
  currentSection?: string;
  // v1.11.06: quando linha tem regra de auto-selecao, oferece checkbox 'Apenas
  // os que passam na regra' (default ON) — usuario nao precisa filtrar manualmente.
  autoSelectRule?: AutoSelectRule | null;
  dimensions?: any;
  environmentParams?: any;
  siblingVars?: Record<string, number>;
  onClose: () => void;
  onPick: (cfg: CatalogConfig) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(true);
  const hasRule = !!(autoSelectRule && (autoSelectRule.where || autoSelectRule.filterPoolType || autoSelectRule.filterCategoria || autoSelectRule.filterDescription));
  // Default OFF — mostra todos os candidatos do catalog. Usuario marca o checkbox
  // se quiser filtrar pelos que passam na regra (where + filterDescription).
  // O filterPoolType continua aplicado SEMPRE (filtro de tipo nao bloqueia, agrupa).
  const [filterByRule, setFilterByRule] = useState(false);

  // Vars do orcamento (dim) + ambiente + siblings — mesma logica do AutoSelectModal,
  // permite avaliar where da regra contra cada candidato pra mostrar so os que passam.
  const ruleVars = useMemo(() => {
    const v: Record<string, number> = {
      length: Number(dimensions?.length) || 0,
      width: Number(dimensions?.width) || 0,
      depth: Number(dimensions?.depth) || 0,
      area: Number(dimensions?.area) || 0,
      perimeter: Number(dimensions?.perimeter) || 0,
      volume: Number(dimensions?.volume) || 0,
      cantos: Number(dimensions?.cantos) || 0,
      perimExterno: Number(dimensions?.perimetroExternoBorda) || 0,
      perimInterno: Number(dimensions?.perimetroParedesInternas) || 0,
      areaParedeEFundo: Number(dimensions?.areaParedeEFundo) || 0,
      radierM2: Number(dimensions?.radierM2) || 0,
      radierEspessura: Number(dimensions?.radierEspessura) || 0,
      radierM3: Number(dimensions?.radierM3) || 0,
      escavacao: Number(dimensions?.escavacaoM3) || 0,
      tempLocal: Number(environmentParams?.temperaturaMediaLocal ?? environmentParams?.temperatura) || 0,
      tempAgua: Number(environmentParams?.temperaturaAguaDesejada) || 0,
      ...(siblingVars || {}),
    };
    return v;
  }, [dimensions, environmentParams, siblingVars]);

  // Avalia where + filterPoolType + filterCategoria + filterDescription da regra contra 1 candidato.
  function matchesRule(c: CatalogConfig): boolean {
    if (!autoSelectRule) return true;
    const desc = c.product?.description || c.service?.name || '';
    const specs = (c.product?.technicalSpecs || c.service?.technicalSpecs || {}) as Record<string, any>;
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (autoSelectRule.filterPoolType && autoSelectRule.filterPoolType.trim()) {
      const t = c.product?.poolType;
      if (!t || norm(String(t)) !== norm(autoSelectRule.filterPoolType.trim())) return false;
    }
    if (autoSelectRule.filterCategoria && autoSelectRule.filterCategoria.trim()) {
      const cat = specs.categoriaPlanilha;
      if (!cat || norm(String(cat)) !== norm(autoSelectRule.filterCategoria.trim())) return false;
    }
    if (autoSelectRule.filterDescription && autoSelectRule.filterDescription.trim()) {
      if (!norm(desc).includes(norm(autoSelectRule.filterDescription.trim()))) return false;
    }
    if (autoSelectRule.where && autoSelectRule.where.trim()) {
      const specVars: Record<string, number> = {};
      for (const [k, raw] of Object.entries(specs)) {
        const n = Number(raw);
        if (Number.isFinite(n)) specVars[k] = n;
      }
      const merged = { ...ruleVars, ...specVars };
      let s = autoSelectRule.where.replace(/(\d),(\d)/g, '$1.$2');
      for (const [k, val] of Object.entries(merged)) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
        const n = Number(val) || 0;
        s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), '(' + n + ')');
      }
      const stripped = s.replace(/\b(ceil|floor|round|min|max)\b/g, '');
      if (/[a-zA-Z_]/.test(stripped)) return false;
      if (!/^[\d.\s+\-*/(),<>=!&|]*$/.test(stripped)) return false;
      try {
        const fn = Function('ceil', 'floor', 'round', 'min', 'max', '"use strict"; return (' + s + ');');
        return !!fn(Math.ceil, Math.floor, Math.round, Math.min, Math.max);
      } catch { return false; }
    }
    return true;
  }

  // Localiza o Product "Sem Produto" universal no catalog (alimenta o botao
  // virtual do topo). Se existe, o botao usa esse cfg real (com productId,
  // preco 0, etc) — evita duplicacao na lista filtrada abaixo.
  const semProdutoCfg = useMemo(() => {
    return catalog.find((c) => c.product && (c.product.description || '').trim().toLowerCase() === 'sem produto') || null;
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q.length > 0 ? q.split(/\s+/) : [];
    return catalog.filter((c) => {
      // Sempre exclui o Sem Produto da lista filtrada — aparece so como botao virtual no topo
      if (semProdutoCfg && c.id === semProdutoCfg.id) return false;
      if (!showAll && currentSection && c.poolSection !== currentSection) return false;
      if (filterByRule && hasRule && !matchesRule(c)) return false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, search, currentSection, showAll, filterByRule, hasRule, ruleVars, autoSelectRule, semProdutoCfg]);

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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-slate-600">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
                <div className="flex items-center gap-3 flex-wrap">
                  {hasRule && (
                    <label className="text-[10px] text-violet-700 flex items-center gap-1 cursor-pointer font-medium" title="Aplica filtros + criterio da regra de auto-selecao desta linha. Desmarque pra ver todos os produtos do catalogo.">
                      <input type="checkbox" checked={filterByRule} onChange={(e) => setFilterByRule(e.target.checked)} className="h-3 w-3" />
                      ✨ Apenas que passam na regra desta linha
                    </label>
                  )}
                  {currentSection && (
                    <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-3 w-3" />
                      Buscar em todas as etapas
                    </label>
                  )}
                </div>
              </div>
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                  placeholder="Buscar por descricao, marca, codigo, voltagem, vazao..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm focus:border-cyan-500 outline-none" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">🔍</span>
                {search && (
                  <button type="button" onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm">✕</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                {/* Opcao "Sem Produto" SEMPRE visivel no topo — independe de busca/filtros.
                    Quando o Product "Sem Produto" existe no catalogo (caso comum), usa-o
                    como vinculo real (preco 0, unit padrao). Quando nao existe (fallback),
                    envia sentinel __NONE__ que apenas remove vinculos. */}
                <button
                  type="button"
                  onClick={() => onPick(semProdutoCfg || { id: '__NONE__', poolSection: '' as any, product: null, service: null })}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 bg-slate-50 transition border-b border-slate-200"
                  title="Vincula ao Product 'Sem Produto' do cadastro — todos os valores ja sao 0, qualquer formula que dependa do produto retorna 0 naturalmente."
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">UNIVERSAL</span>
                    <span className="text-sm font-medium text-slate-700">🚫 Sem Produto</span>
                    <span className="text-[10px] text-slate-500">
                      {semProdutoCfg ? 'aparece sempre no topo, independente do filtro' : 'cadastro nao encontrado — desvincula a linha'}
                    </span>
                  </div>
                </button>
                {filtered.length === 0 ? (
                  <div className="text-center text-xs text-slate-600 py-6">
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
                            <span className="text-[9px] font-mono text-slate-600">{code}</span>
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
    if (!title.trim()) { toast("Titulo obrigatório", "error"); return; }
    if (!clientPartnerId) { toast("Cliente obrigatório", "error"); return; }
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
                <tr><td colSpan={5} className="text-center text-sm text-slate-600 py-8">Nenhuma forma cadastrada</td></tr>
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
