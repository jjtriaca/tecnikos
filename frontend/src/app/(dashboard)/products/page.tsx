"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { fmtCurrency } from "@/components/ui/CurrencyInput";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import type { Product, ProductEquivalent } from "@/types/product";
import { UNIT_OPTIONS, ORIGIN_OPTIONS } from "@/types/product";
import { toTitleCase } from "@/lib/brazil-utils";

/* ── Types ────────────────────────────────────────────── */

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(cents: number | undefined | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseBRLToCents(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function centsToInputStr(cents: number | undefined | null): string {
  if (cents == null || cents === 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function computeMargin(costCents: number, salePriceCents: number): number | null {
  if (!costCents || costCents <= 0) return null;
  return ((salePriceCents - costCents) / costCents) * 100;
}

/* ── Modal Tab type ───────────────────────────────────── */

type ModalTab = "geral" | "impostos" | "margem" | "equivalentes" | "estoque" | "piscina";

const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "impostos", label: "Impostos" },
  { id: "margem", label: "Margem" },
  { id: "equivalentes", label: "Equivalentes" },
  { id: "estoque", label: "Estoque" },
  { id: "piscina", label: "🌊 Piscina" },
];

/* ── Filter definitions ───────────────────────────────── */

// Filtros dinamicos: alguns selects sao alimentados por DISTINCT do backend
// (Categoria, Marca, Tipo Piscina) — buildProductFilters monta o array com as
// opcoes carregadas. Os demais sao estaticos.
function buildProductFilters(opts: {
  categories: string[];
  brands: string[];
  poolTypes: string[];
}): FilterDefinition[] {
  const toOptions = (arr: string[]) => arr.map((v) => ({ value: v, label: v }));
  return [
    {
      key: "poolType",
      label: "Tipo (Piscina)",
      type: "select",
      options: toOptions(opts.poolTypes),
    },
    {
      key: "category",
      label: "Categoria",
      type: "select",
      options: toOptions(opts.categories),
    },
    {
      key: "brand",
      label: "Marca",
      type: "select",
      options: toOptions(opts.brands),
    },
    {
      key: "usage",
      label: "Usado em",
      type: "select",
      options: [
        { value: "sale", label: "Venda" },
        { value: "work", label: "Obra" },
        { value: "both", label: "Venda + Obra" },
      ],
    },
    {
      key: "finalidade",
      label: "Finalidade",
      type: "select",
      options: [
        { value: "USO_CONSUMO", label: "Uso/Consumo" },
        { value: "REVENDA", label: "Revenda" },
        { value: "ATIVO_IMOBILIZADO", label: "Ativo Imobilizado" },
        { value: "MATERIA_PRIMA", label: "Materia Prima" },
        { value: "MATERIAL_OBRA", label: "Material Obra" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ATIVO", label: "Ativo" },
        { value: "INATIVO", label: "Inativo" },
      ],
    },
  ];
}

/* ── Column definitions ───────────────────────────────── */

const FINALIDADE_OPTIONS = [
  { value: "USO_CONSUMO", label: "Uso/Consumo" },
  { value: "REVENDA", label: "Revenda" },
  { value: "ATIVO_IMOBILIZADO", label: "Ativo Imobilizado" },
  { value: "MATERIA_PRIMA", label: "Mat. Prima" },
  { value: "MATERIAL_OBRA", label: "Material Obra" },
];

const FINALIDADE_BADGE: Record<string, string> = {
  USO_CONSUMO: "bg-sky-50 text-sky-700 border-sky-200",
  REVENDA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ATIVO_IMOBILIZADO: "bg-purple-50 text-purple-700 border-purple-200",
  MATERIA_PRIMA: "bg-amber-50 text-amber-700 border-amber-200",
  MATERIAL_OBRA: "bg-orange-50 text-orange-700 border-orange-200",
};

function buildProductColumns(): ColumnDefinition<Product>[] {
  return [
    {
      id: "actions",
      label: "Ações",
      render: () => null as any,
    },
    {
      id: "code",
      label: "Código",
      sortable: true,
      render: (p) => (
        <span className="text-sm font-medium text-slate-900">
          {p.code || "—"}
        </span>
      ),
    },
    {
      id: "description",
      label: "Descricao",
      sortable: true,
      // Padrao Tecnikos: descricao ocupa todo o espaco disponivel da coluna.
      // Se nao couber, trunca proporcional + tooltip 'title' mostra completa no hover.
      // NUNCA usar max-w fixo (forca truncar antes da hora).
      render: (p) => (
        <span className="text-sm text-slate-900 truncate block w-full" title={p.description}>
          {p.description}
        </span>
      ),
    },
    {
      id: "finalidade",
      label: "Finalidade",
      sortable: true,
      sortKey: "finalidade",
      render: (p) => {
        const fin = p.finalidade;
        if (!fin) return <span className="text-sm text-slate-400">—</span>;
        const opt = FINALIDADE_OPTIONS.find((o) => o.value === fin);
        const badge = FINALIDADE_BADGE[fin] || "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badge}`}>
            {opt?.label || fin}
          </span>
        );
      },
    },
    {
      id: "brand",
      label: "Marca",
      sortable: true,
      render: (p) => (
        <span className="text-sm text-slate-700">{p.brand || "—"}</span>
      ),
    },
    {
      id: "unit",
      label: "Unidade",
      sortable: true,
      render: (p) => (
        <span className="text-xs font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
          {p.unit}
        </span>
      ),
    },
    {
      id: "costCents",
      label: "Custo",
      sortable: true,
      align: "right",
      render: (p) => (
        <span className="text-sm text-slate-700">{formatCurrency(p.costCents)}</span>
      ),
    },
    {
      id: "salePriceCents",
      label: "Preco Venda",
      sortable: true,
      align: "right",
      render: (p) => (
        <span className="text-sm font-semibold text-blue-700">
          {formatCurrency(p.salePriceCents)}
        </span>
      ),
    },
    {
      id: "currentStock",
      label: "Estoque",
      sortable: true,
      align: "right",
      render: (p) => {
        const isLow = p.minStock != null && p.currentStock <= p.minStock;
        return (
          <span className={`text-sm font-medium ${isLow ? "text-red-600" : "text-slate-700"}`}>
            {p.currentStock}
            {isLow && (
              <span className="ml-1 text-[10px] text-red-500 font-normal">baixo</span>
            )}
          </span>
        );
      },
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (p) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
            p.status === "ATIVO"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-slate-100 text-slate-500 border-slate-200"
          }`}
        >
          {p.status === "ATIVO" ? "Ativo" : "Inativo"}
        </span>
      ),
    },
  ];
}

/* ══════════════════════════════════════════════════════════
   EMPTY FORM STATE
   ══════════════════════════════════════════════════════════ */

interface ProductForm {
  code: string;
  barcode: string;
  description: string;
  brand: string;
  model: string;
  unit: string;
  ncm: string;
  cest: string;
  origin: string;
  category: string;
  icmsRate: string;
  ipiRate: string;
  pisRate: string;
  cofinsRate: string;
  csosn: string;
  cfop: string;
  cst: string;
  cstPis: string;
  cstCofins: string;
  costCents: string;
  salePriceCents: string;
  finalidade: string;
  minStock: string;
  maxStock: string;
  location: string;
  status: string;
  // Tipo no modulo Piscina (Cascata, Aquecedor, Conjunto de filtragem, etc.)
  // Alimenta dropdown de filtro no AutoSelectModal de orcamento.
  poolType: string;
  // Quantidade padrao ao escolher esse produto numa linha do orcamento de piscina.
  // Vazio = sem padrao (fluxo usa 1). Linha do orcamento fica amarela se qty != defaultQty.
  defaultQty: string;
  // Specs tecnicas (Modulo Piscina) — strings pra inputs, viram numero no payload
  specVazaoM3h: string;       // m³/h (filtros, bombas)
  specTuboEntradaMm: string;  // mm (todos equipamentos hidraulicos — chave do auto-select de tubos)
  specKcalHMin: string;       // kcal/h minimo (aquecedores)
  specKcalHMax: string;       // kcal/h maximo (aquecedores)
  specPotenciaCv: string;     // CV (motores)
  specVoltagem: string;       // V (eletricos)
  specAmperagem: string;      // A (eletricos)
  specBifTrif: string;        // 'Bif' | 'Trif' | '' (tipo eletrico)
  specBifTrifConta: string;   // numero — quantos espacos ocupa no quadro de distribuicao
  specTempoMontagemH: string; // horas — tempo padrao de montagem/instalacao do equipamento
}

const EMPTY_FORM: ProductForm = {
  code: "",
  barcode: "",
  description: "",
  brand: "",
  model: "",
  unit: "UN",
  ncm: "",
  cest: "",
  origin: "0",
  category: "",
  icmsRate: "",
  ipiRate: "",
  pisRate: "",
  cofinsRate: "",
  csosn: "",
  cfop: "",
  cst: "",
  cstPis: "",
  cstCofins: "",
  costCents: "",
  salePriceCents: "",
  finalidade: "",
  minStock: "",
  maxStock: "",
  location: "",
  status: "ATIVO",
  poolType: "",
  defaultQty: "1",
  specVazaoM3h: "",
  specTuboEntradaMm: "",
  specKcalHMin: "",
  specKcalHMax: "",
  specPotenciaCv: "",
  specVoltagem: "",
  specAmperagem: "",
  specBifTrif: "",
  specBifTrifConta: "",
  specTempoMontagemH: "",
};

function productToForm(p: Product): ProductForm {
  return {
    code: p.code || "",
    barcode: p.barcode || "",
    description: p.description,
    brand: p.brand || "",
    model: p.model || "",
    unit: p.unit,
    ncm: p.ncm || "",
    cest: p.cest || "",
    origin: p.origin || "0",
    category: p.category || "",
    icmsRate: p.icmsRate != null ? String(p.icmsRate) : "",
    ipiRate: p.ipiRate != null ? String(p.ipiRate) : "",
    pisRate: p.pisRate != null ? String(p.pisRate) : "",
    cofinsRate: p.cofinsRate != null ? String(p.cofinsRate) : "",
    csosn: p.csosn || "",
    cfop: p.cfop || "",
    cst: p.cst || "",
    cstPis: p.cstPis || "",
    cstCofins: p.cstCofins || "",
    costCents: centsToInputStr(p.costCents),
    salePriceCents: centsToInputStr(p.salePriceCents),
    finalidade: p.finalidade || "",
    minStock: p.minStock != null ? String(p.minStock) : "",
    maxStock: p.maxStock != null ? String(p.maxStock) : "",
    location: p.location || "",
    status: p.status,
    poolType: (p as any).poolType || "",
    defaultQty: (p as any).defaultQty != null ? String((p as any).defaultQty) : "",
    specVazaoM3h: numericSpecToStr(p.technicalSpecs?.vazaoM3h),
    specTuboEntradaMm: numericSpecToStr(p.technicalSpecs?.tuboEntradaMm),
    specKcalHMin: numericSpecToStr(p.technicalSpecs?.kcalHMin),
    specKcalHMax: numericSpecToStr(p.technicalSpecs?.kcalHMax),
    specPotenciaCv: numericSpecToStr(p.technicalSpecs?.potenciaCv),
    specVoltagem: numericSpecToStr(p.technicalSpecs?.voltagem),
    specAmperagem: numericSpecToStr(p.technicalSpecs?.amperagem),
    specBifTrif: typeof p.technicalSpecs?.bifTrif === 'string' ? p.technicalSpecs.bifTrif : "",
    specBifTrifConta: numericSpecToStr(p.technicalSpecs?.bifTrifConta),
    specTempoMontagemH: numericSpecToStr(p.technicalSpecs?.tempoMontagemH),
  };
}

function numericSpecToStr(v: unknown): string {
  if (v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

// Monta o objeto technicalSpecs a partir dos campos do form. Preserva chaves
// existentes (ex: campos seedados da planilha que nao temos no form ainda — eficiencia,
// bifTrifConta, etc) — so atualiza as que aparecem como inputs.
function buildTechnicalSpecs(f: ProductForm, existing?: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...(existing || {}) };
  const setOrUnset = (key: string, raw: string) => {
    if (raw.trim() === "") {
      delete merged[key];
    } else {
      const n = parseFloat(raw.replace(",", "."));
      if (Number.isFinite(n)) merged[key] = n;
    }
  };
  setOrUnset("vazaoM3h", f.specVazaoM3h);
  setOrUnset("tuboEntradaMm", f.specTuboEntradaMm);
  setOrUnset("kcalHMin", f.specKcalHMin);
  setOrUnset("kcalHMax", f.specKcalHMax);
  setOrUnset("potenciaCv", f.specPotenciaCv);
  setOrUnset("voltagem", f.specVoltagem);
  setOrUnset("amperagem", f.specAmperagem);
  setOrUnset("bifTrifConta", f.specBifTrifConta);
  setOrUnset("tempoMontagemH", f.specTempoMontagemH);
  // bifTrif eh string (Bif/Trif/'') — nao usa setOrUnset que so trata numeros
  if (f.specBifTrif.trim() === "") {
    delete merged.bifTrif;
  } else {
    merged.bifTrif = f.specBifTrif.trim();
  }
  return merged;
}

function formToPayload(f: ProductForm, existingSpecs?: Record<string, any>) {
  return {
    code: f.code || undefined,
    barcode: f.barcode || undefined,
    description: f.description,
    brand: f.brand || undefined,
    model: f.model || undefined,
    unit: f.unit,
    ncm: f.ncm || undefined,
    cest: f.cest || undefined,
    origin: f.origin || undefined,
    category: f.category || undefined,
    icmsRate: f.icmsRate ? parseFloat(f.icmsRate) : undefined,
    ipiRate: f.ipiRate ? parseFloat(f.ipiRate) : undefined,
    pisRate: f.pisRate ? parseFloat(f.pisRate) : undefined,
    cofinsRate: f.cofinsRate ? parseFloat(f.cofinsRate) : undefined,
    csosn: f.csosn || undefined,
    cfop: f.cfop || undefined,
    cst: f.cst || undefined,
    cstPis: f.cstPis || undefined,
    cstCofins: f.cstCofins || undefined,
    costCents: f.costCents ? parseBRLToCents(f.costCents) : undefined,
    salePriceCents: f.salePriceCents ? parseBRLToCents(f.salePriceCents) : undefined,
    finalidade: f.finalidade || undefined,
    minStock: f.minStock ? parseInt(f.minStock, 10) : undefined,
    maxStock: f.maxStock ? parseInt(f.maxStock, 10) : undefined,
    location: f.location || undefined,
    status: f.status,
    // Tipo no modulo Piscina (Cascata, Aquecedor, etc.) — campo top-level, indexado.
    // Alimenta dropdown de filtro do AutoSelectModal de orcamento de piscina.
    poolType: f.poolType.trim() || undefined,
    // Quantidade padrao no orcamento de piscina. Vazio = sem padrao (fluxo usa 1).
    defaultQty: f.defaultQty.trim() === "" ? null : parseFloat(f.defaultQty.replace(",", ".")),
    // Inclui technicalSpecs no payload. Preserva chaves existentes que nao
    // tem input no form (eficiencia, bifTrifConta, multiplicador, etc seedadas
    // da planilha) — so atualiza as chaves expostas como inputs.
    technicalSpecs: buildTechnicalSpecs(f, existingSpecs),
  };
}

/* ══════════════════════════════════════════════════════════
   ACTIONS DROPDOWN
   ══════════════════════════════════════════════════════════ */

function ActionsDropdown({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 100;
      const fitsBelow = rect.bottom + menuHeight < window.innerHeight;
      setPos({
        top: fitsBelow ? rect.bottom + 4 : rect.top - menuHeight - 4,
        left: Math.max(8, rect.right - 168),
      });
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <div ref={wrapperRef}>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          className="fixed z-50 min-w-[168px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
          style={{ top: pos.top, left: pos.left }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit(product);
            }}
            className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete(product);
            }}
            className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function ProductsPage() {
  const tp = useTableParams({ defaultSortBy: "description", defaultSortOrder: "asc" });
  const columns = buildProductColumns();
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout(
    "products-v2",
    columns,
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  // Tipos de produto Piscina ja cadastrados (alimenta datalist do dropdown
  // "Tipo (Piscina)" no formulario de cadastro).
  const [poolTypes, setPoolTypes] = useState<string[]>([]);
  // Opcoes pros filtros da lista (DISTINCT do backend).
  const [filterOptions, setFilterOptions] = useState<{ categories: string[]; brands: string[]; poolTypes: string[] }>({ categories: [], brands: [], poolTypes: [] });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("geral");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Equivalents state (within modal)
  const [equivalents, setEquivalents] = useState<ProductEquivalent[]>([]);
  const [equivLoading, setEquivLoading] = useState(false);
  const [showEquivForm, setShowEquivForm] = useState(false);
  const [equivForm, setEquivForm] = useState({
    supplierId: "",
    supplierCode: "",
    supplierDescription: "",
    lastPriceCents: "",
  });

  // Stock adjustment state (within modal)
  const [stockDelta, setStockDelta] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [adjustingStock, setAdjustingStock] = useState(false);

  const { toast } = useToast();

  /* ── Load products ──────────────────────────────────── */

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const qs = tp.buildQueryString();
      const result = await api.get<PaginatedResponse<Product>>(`/products?${qs}`);
      setProducts(result.data);
      setMeta(result.meta);
    } catch {
      toast("Erro ao carregar produtos.", "error");
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Carrega tipos ja cadastrados pra alimentar dropdown da aba Piscina.
  useEffect(() => {
    api.get<string[]>("/products/pool-types")
      .then((r) => setPoolTypes(Array.isArray(r) ? r : []))
      .catch(() => setPoolTypes([]));
  }, []);

  // Carrega opcoes pros filtros da lista (DISTINCT de category, brand, poolType).
  useEffect(() => {
    api.get<{ categories: string[]; brands: string[]; poolTypes: string[] }>("/products/filter-options")
      .then((r) => setFilterOptions(r || { categories: [], brands: [], poolTypes: [] }))
      .catch(() => setFilterOptions({ categories: [], brands: [], poolTypes: [] }));
  }, []);

  const productFilters = useMemo(() => buildProductFilters(filterOptions), [filterOptions]);

  /* ── Load equivalents for a product ─────────────────── */

  const loadEquivalents = useCallback(async (productId: string) => {
    try {
      setEquivLoading(true);
      const result = await api.get<ProductEquivalent[]>(
        `/products/${productId}/equivalents`,
      );
      setEquivalents(result);
    } catch {
      setEquivalents([]);
    } finally {
      setEquivLoading(false);
    }
  }, []);

  /* ── Open modal ─────────────────────────────────────── */

  function openNewProduct() {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setEquivalents([]);
    setModalTab("geral");
    setShowEquivForm(false);
    setStockDelta("");
    setStockReason("");
    setModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setForm(productToForm(product));
    setEquivalents(product.equivalents || []);
    setModalTab("geral");
    setShowEquivForm(false);
    setStockDelta("");
    setStockReason("");
    setModalOpen(true);
    if (product.id) {
      loadEquivalents(product.id);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setEquivalents([]);
    setShowEquivForm(false);
  }

  /* ── Save product ───────────────────────────────────── */

  async function handleSave() {
    if (!form.description.trim()) {
      toast("Descricao e obrigatoria.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form, editingProduct?.technicalSpecs);
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
        toast("Produto atualizado com sucesso!", "success");
      } else {
        await api.post("/products", payload);
        toast("Produto criado com sucesso!", "success");
      }
      closeModal();
      await loadProducts();
    } catch {
      toast("Erro ao salvar produto.", "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Add equivalent ─────────────────────────────────── */

  async function handleAddEquivalent() {
    if (!editingProduct) return;
    if (!equivForm.supplierCode.trim()) {
      toast("Código do fornecedor e obrigatório.", "error");
      return;
    }
    try {
      await api.post(`/products/${editingProduct.id}/equivalents`, {
        supplierId: equivForm.supplierId || undefined,
        supplierCode: equivForm.supplierCode,
        supplierDescription: equivForm.supplierDescription || undefined,
        lastPriceCents: equivForm.lastPriceCents
          ? parseBRLToCents(equivForm.lastPriceCents)
          : undefined,
      });
      toast("Equivalente adicionado!", "success");
      setEquivForm({ supplierId: "", supplierCode: "", supplierDescription: "", lastPriceCents: "" });
      setShowEquivForm(false);
      await loadEquivalents(editingProduct.id);
    } catch {
      toast("Erro ao adicionar equivalente.", "error");
    }
  }

  /* ── Remove equivalent ──────────────────────────────── */

  async function handleRemoveEquivalent(equivId: string) {
    if (!editingProduct) return;
    try {
      await api.del(`/products/${editingProduct.id}/equivalents/${equivId}`);
      toast("Equivalente removido.", "success");
      await loadEquivalents(editingProduct.id);
    } catch {
      toast("Erro ao remover equivalente.", "error");
    }
  }

  /* ── Adjust stock ───────────────────────────────────── */

  async function handleStockAdjust() {
    if (!editingProduct) return;
    const delta = parseInt(stockDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast("Informe uma quantidade valida (+/-).", "error");
      return;
    }
    setAdjustingStock(true);
    try {
      await api.post(`/products/${editingProduct.id}/stock`, {
        delta,
        reason: stockReason || undefined,
      });
      toast("Estoque ajustado com sucesso!", "success");
      setStockDelta("");
      setStockReason("");
      // Reload the product to get updated stock
      const updated = await api.get<Product>(`/products/${editingProduct.id}`);
      setEditingProduct(updated);
      await loadProducts();
    } catch {
      toast("Erro ao ajustar estoque.", "error");
    } finally {
      setAdjustingStock(false);
    }
  }

  /* ── Delete product ────────────────────────────────── */

  async function handleDeleteProduct(product: Product) {
    if (!confirm(`Deseja excluir o produto "${product.description}"?`)) return;
    try {
      await api.del(`/products/${product.id}`);
      toast("Produto excluido com sucesso.", "success");
      loadProducts();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao excluir produto.", "error");
    }
  }

  /* ── Computed margin ────────────────────────────────── */

  const costVal = parseBRLToCents(form.costCents);
  const saleVal = parseBRLToCents(form.salePriceCents);
  const margin = computeMargin(costVal, saleVal);

  /* ── Form field helpers ─────────────────────────────── */

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500">
            Cadastro de produtos, precos, impostos e estoque.
          </p>
        </div>
        <button
          onClick={openNewProduct}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Produto
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <FilterBar
        filters={productFilters}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por codigo, descricao, marca..."
      />

      {/* ── Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            {tp.search || Object.keys(tp.filters).length > 0
              ? "Nenhum produto encontrado com os filtros selecionados."
              : "Nenhum produto cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <table
            className="text-sm"
            style={{ tableLayout: "fixed", minWidth: "900px", width: "max-content" }}
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {orderedColumns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    index={idx}
                    columnId={col.id}
                    onReorder={reorderColumns}
                    onResize={setColumnWidth}
                    width={columnWidths[col.id]}
                    className={col.headerClassName || ""}
                  >
                    {col.sortable ? (
                      <SortableHeader
                        as="div"
                        label={col.label}
                        column={col.sortKey || col.id}
                        currentColumn={tp.sort.column}
                        currentOrder={tp.sort.order}
                        onToggle={tp.toggleSort}
                        align={col.align}
                      />
                    ) : (
                      <div
                        className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {col.label}
                      </div>
                    )}
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openEditProduct(p)}
                  className="border-b border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {orderedColumns.map((col) => {
                    const w = columnWidths[col.id];
                    const tdStyle: React.CSSProperties = w
                      ? {
                          width: `${w}px`,
                          minWidth: `${w}px`,
                          maxWidth: `${w}px`,
                          overflow: "hidden",
                        }
                      : {};
                    if (col.id === "actions") {
                      return (
                        <td key={col.id} style={tdStyle} className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center">
                            <ActionsDropdown
                              product={p}
                              onEdit={openEditProduct}
                              onDelete={handleDeleteProduct}
                            />
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.id}
                        style={tdStyle}
                        className={`py-3 px-4 ${col.className || ""} ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {col.render(p)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination meta={meta} onPageChange={tp.setPage} />

      {/* ══════════════════════════════════════════════════
         PRODUCT MODAL (Create / Edit)
         ══════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-600 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex gap-1 border-b border-slate-200 px-6 shrink-0">
              {MODAL_TABS.map((tab) => {
                // Only show equivalentes and estoque tabs when editing
                if ((tab.id === "equivalentes" || tab.id === "estoque") && !editingProduct) {
                  return null;
                }
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      modalTab === tab.id
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Barra fixa de contexto: mostra qual produto esta sendo editado pra que
                o gestor nao perca referencia ao trocar de aba. Aparece so em modo edicao
                (no modo criacao ainda nao ha description definido). */}
            {editingProduct && (
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-2.5 shrink-0">
                {editingProduct.code && (
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-slate-300 rounded px-2 py-0.5 shrink-0">
                    {editingProduct.code}
                  </span>
                )}
                <span className="text-sm font-semibold text-slate-900 truncate flex-1 min-w-0" title={editingProduct.description}>
                  {editingProduct.description}
                </span>
                {editingProduct.brand && (
                  <span className="text-xs text-slate-600 shrink-0 hidden sm:inline" title="Marca">
                    {editingProduct.brand}
                  </span>
                )}
                <span className="text-[10px] font-medium text-slate-600 bg-slate-200 rounded px-1.5 py-0.5 shrink-0">
                  {editingProduct.unit}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 border ${
                  editingProduct.status === 'ATIVO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  {editingProduct.status}
                </span>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* ── Tab: Geral ─────────────────────────── */}
              {modalTab === "geral" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={labelClass}>Código de Barras</label>
                    <input
                      type="text"
                      value={form.barcode}
                      onChange={(e) => setField("barcode", e.target.value)}
                      placeholder="EAN / GTIN"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>
                      Descricao <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      onBlur={() => setField("description", toTitleCase(form.description || ""))}
                      placeholder="Nome / descricao do produto"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Marca</label>
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                      onBlur={() => setField("brand", toTitleCase(form.brand || ""))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Modelo</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setField("model", e.target.value)}
                      onBlur={() => setField("model", toTitleCase(form.model || ""))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Unidade</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setField("unit", e.target.value)}
                      className={inputClass}
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>NCM</label>
                    <input
                      type="text"
                      value={form.ncm}
                      onChange={(e) => setField("ncm", e.target.value)}
                      placeholder="Ex: 8471.30.19"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CEST</label>
                    <input
                      type="text"
                      value={form.cest}
                      onChange={(e) => setField("cest", e.target.value)}
                      placeholder="Ex: 21.063.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Origem</label>
                    <select
                      value={form.origin}
                      onChange={(e) => setField("origin", e.target.value)}
                      className={inputClass}
                    >
                      {ORIGIN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Categoria</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setField("category", e.target.value)}
                      onBlur={() => setField("category", toTitleCase(form.category || ""))}
                      placeholder="Ex: Elétrico, Hidráulico..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Finalidade</label>
                    <select
                      value={form.finalidade}
                      onChange={(e) => setField("finalidade", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">— Selecione —</option>
                      {FINALIDADE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setField("status", e.target.value)}
                      className={inputClass}
                    >
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ── Tab: Impostos ──────────────────────── */}
              {modalTab === "impostos" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={labelClass}>ICMS %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.icmsRate}
                      onChange={(e) => setField("icmsRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>IPI %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.ipiRate}
                      onChange={(e) => setField("ipiRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>PIS %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.pisRate}
                      onChange={(e) => setField("pisRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>COFINS %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.cofinsRate}
                      onChange={(e) => setField("cofinsRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CSOSN</label>
                    <input
                      type="text"
                      value={form.csosn}
                      onChange={(e) => setField("csosn", e.target.value)}
                      placeholder="Ex: 102"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CFOP</label>
                    <input
                      type="text"
                      value={form.cfop}
                      onChange={(e) => setField("cfop", e.target.value)}
                      placeholder="Ex: 5102"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CST ICMS</label>
                    <input
                      type="text"
                      value={form.cst}
                      onChange={(e) => setField("cst", e.target.value)}
                      placeholder="Ex: 00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CST PIS</label>
                    <input
                      type="text"
                      value={form.cstPis}
                      onChange={(e) => setField("cstPis", e.target.value)}
                      placeholder="Ex: 01"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CST COFINS</label>
                    <input
                      type="text"
                      value={form.cstCofins}
                      onChange={(e) => setField("cstCofins", e.target.value)}
                      placeholder="Ex: 01"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Margem ────────────────────────── */}
              {modalTab === "margem" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Custo (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.costCents}
                        onChange={(e) => setField("costCents", e.target.value)}
                        onBlur={(e) => setField("costCents", fmtCurrency(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Preco Venda (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.salePriceCents}
                        onChange={(e) => setField("salePriceCents", e.target.value)}
                        onBlur={(e) => setField("salePriceCents", fmtCurrency(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Margem %</label>
                      <div
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                          margin != null && margin >= 0
                            ? "border-green-200 bg-green-50 text-green-700"
                            : margin != null && margin < 0
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {margin != null ? `${margin.toFixed(2)}%` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Read-only reference prices */}
                  {editingProduct &&
                    (editingProduct.lastPurchasePriceCents != null ||
                      editingProduct.averageCostCents != null) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">
                          Precos de Referencia
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {editingProduct.lastPurchasePriceCents != null && (
                            <div>
                              <span className="text-xs text-slate-500">Último Preco de Compra</span>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(editingProduct.lastPurchasePriceCents)}
                              </p>
                            </div>
                          )}
                          {editingProduct.averageCostCents != null && (
                            <div>
                              <span className="text-xs text-slate-500">Custo Medio</span>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(editingProduct.averageCostCents)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* ── Tab: Equivalentes ──────────────────── */}
              {modalTab === "equivalentes" && editingProduct && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Produtos Equivalentes
                      <span className="ml-2 text-xs font-normal text-slate-600">
                        {equivalents.length} cadastrado{equivalents.length !== 1 ? "s" : ""}
                      </span>
                    </h4>
                    <button
                      onClick={() => setShowEquivForm(!showEquivForm)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      {showEquivForm ? "Cancelar" : "+ Adicionar"}
                    </button>
                  </div>

                  {/* Inline add form */}
                  {showEquivForm && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Fornecedor (ID)</label>
                          <input
                            type="text"
                            value={equivForm.supplierId}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierId: e.target.value })
                            }
                            placeholder="ID do fornecedor"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Código <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={equivForm.supplierCode}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierCode: e.target.value })
                            }
                            placeholder="Código no fornecedor"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Descricao</label>
                          <input
                            type="text"
                            value={equivForm.supplierDescription}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierDescription: e.target.value })
                            }
                            onBlur={() =>
                              setEquivForm({ ...equivForm, supplierDescription: toTitleCase(equivForm.supplierDescription || "") })
                            }
                            placeholder="Descricao no fornecedor"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Último Preco (R$)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={equivForm.lastPriceCents}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, lastPriceCents: e.target.value })}
                            onBlur={(e) =>
                              setEquivForm({ ...equivForm, lastPriceCents: fmtCurrency(e.target.value) })
                            }
                            placeholder="0,00"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddEquivalent}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                          Salvar Equivalente
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Equivalents table */}
                  {equivLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-12 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
                        />
                      ))}
                    </div>
                  ) : equivalents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                      <p className="text-sm text-slate-600">
                        Nenhum equivalente cadastrado para este produto.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Fornecedor
                            </th>
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Código
                            </th>
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Descricao
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600">
                              Último Preco
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600">
                              Última Compra
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600 w-[60px]">
                              &nbsp;
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {equivalents.map((eq) => (
                            <tr
                              key={eq.id}
                              className="border-b border-slate-100 hover:bg-slate-100 transition-colors"
                            >
                              <td className="py-2.5 px-4 text-slate-700">
                                {eq.supplier?.name || eq.supplierId || "—"}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-900">
                                {eq.supplierCode}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {eq.supplierDescription || "—"}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-700">
                                {formatCurrency(eq.lastPriceCents)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-500">
                                {formatDate(eq.lastPurchaseDate)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => handleRemoveEquivalent(eq.id)}
                                  className="rounded p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Remover"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Estoque ───────────────────────── */}
              {modalTab === "estoque" && editingProduct && (
                <div className="space-y-6">
                  {/* Current stock info */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">
                      Estoque Atual
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                      <div>
                        <span className="text-xs text-slate-500">Quantidade</span>
                        <p className="text-2xl font-bold text-slate-900">
                          {editingProduct.currentStock}
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Estoque Minimo</label>
                        <input
                          type="number"
                          value={form.minStock}
                          onChange={(e) => setField("minStock", e.target.value)}
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Estoque Maximo</label>
                        <input
                          type="number"
                          value={form.maxStock}
                          onChange={(e) => setField("maxStock", e.target.value)}
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Localizacao</label>
                        <input
                          type="text"
                          value={form.location}
                          onChange={(e) => setField("location", e.target.value)}
                          onBlur={() => setField("location", toTitleCase(form.location || ""))}
                          placeholder="Ex: Prateleira A3"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock adjustment form */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">
                      Ajustar Estoque
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>
                          Quantidade (+/-)
                        </label>
                        <input
                          type="number"
                          value={stockDelta}
                          onChange={(e) => setStockDelta(e.target.value)}
                          placeholder="Ex: +10 ou -5"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-slate-600">
                          Positivo para entrada, negativo para saida
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Motivo</label>
                        <input
                          type="text"
                          value={stockReason}
                          onChange={(e) => setStockReason(e.target.value)}
                          placeholder="Ex: Compra fornecedor, Perda, Inventario..."
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleStockAdjust}
                        disabled={adjustingStock || !stockDelta}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {adjustingStock ? "Ajustando..." : "Confirmar Ajuste"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Piscina (specs tecnicas) ────────── */}
              {modalTab === "piscina" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
                    <p className="text-xs text-slate-700">
                      Especificacoes tecnicas usadas pelo <strong>auto-selecao do produto</strong> no orcamento de piscina.
                      Preencha apenas os campos relevantes pro tipo de produto (filtro, bomba, aquecedor, kit SPA, cascata, etc).
                      Campos em branco nao sao usados.
                    </p>
                  </div>

                  <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-5">
                    <h4 className="text-xs font-semibold text-violet-900 uppercase mb-2">
                      🏷 Tipo do produto (Piscina)
                    </h4>
                    <p className="text-[11px] text-slate-700 mb-3 leading-tight">
                      Categoria do produto no modulo Piscina (ex: <em>Cascata</em>, <em>Conjunto de filtragem</em>, <em>Aquecedor</em>,
                      <em> Tubos cascata</em>, <em>Quadro eletrico</em>, <em>Disjuntor</em>). O orcamento de piscina usa esse tipo
                      pra filtrar candidatos na auto-selecao. Digite um tipo novo livremente — ele passa a aparecer no dropdown depois.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                      <div>
                        <label className={labelClass}>Tipo</label>
                        <input
                          type="text"
                          list="poolTypeOptions"
                          value={form.poolType}
                          onChange={(e) => setField("poolType", e.target.value)}
                          placeholder="Ex: Cascata, Aquecedor, Conjunto de filtragem..."
                          className={inputClass}
                        />
                        <datalist id="poolTypeOptions">
                          {poolTypes.map((t) => <option key={t} value={t} />)}
                        </datalist>
                        {poolTypes.length > 0 && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            {poolTypes.length} tipo(s) ja cadastrado(s). Comece a digitar pra ver sugestoes.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Quantidade padrao</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.defaultQty}
                          onChange={(e) => setField("defaultQty", e.target.value)}
                          placeholder="Ex: 1 (padrao)"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[10px] text-slate-600 leading-tight">
                          Qty usada ao escolher esse produto numa linha do orcamento de piscina.
                          Vazio = sem padrao (sistema usa 1). Se operador editar a qty, a linha fica
                          <span className="bg-amber-100 text-amber-800 px-1 rounded mx-0.5">amarela</span>
                          (fora do padrao).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase mb-4">
                      ⏱ Tempo de instalacao
                    </h4>
                    <div className="max-w-sm">
                      <label className={labelClass}>Tempo padrao de montagem (horas)</label>
                      <input
                        type="number" step="0.5" min="0"
                        value={form.specTempoMontagemH}
                        onChange={(e) => setField("specTempoMontagemH", e.target.value)}
                        placeholder="Ex: 4 (filtro pequeno), 10 (aquecedor grande)"
                        className={inputClass}
                      />
                      <p className="mt-1 text-[11px] text-slate-600">
                        Tempo padrao de montagem/instalacao desse equipamento. Usado pra calcular automaticamente o servico
                        de montagem no orcamento de piscina. Equipamentos pequenos vs grandes podem ter tempos bem diferentes.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase mb-4">
                      🚿 Hidraulico — Filtros, Bombas, Aquecedores, SPA, Cascata
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Vazao (m³/h)</label>
                        <input
                          type="number" step="0.1"
                          value={form.specVazaoM3h}
                          onChange={(e) => setField("specVazaoM3h", e.target.value)}
                          placeholder="Ex: 9"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-slate-600">
                          Vazao do equipamento. Usada pra calcular tempo de filtragem da piscina.
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Tubo de entrada (mm)</label>
                        <input
                          type="number" step="1"
                          value={form.specTuboEntradaMm}
                          onChange={(e) => setField("specTuboEntradaMm", e.target.value)}
                          placeholder="Ex: 50, 60, 75"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-slate-600">
                          Diametro da conexao hidraulica. Auto-selecao de tubos usa esse campo pra escolher o tubo correto.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase mb-4">
                      🔥 Aquecimento — Bombas de calor, Solar, Trocadores
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Kcal/h minimo</label>
                        <input
                          type="number" step="100"
                          value={form.specKcalHMin}
                          onChange={(e) => setField("specKcalHMin", e.target.value)}
                          placeholder="Ex: 8000"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Kcal/h maximo</label>
                        <input
                          type="number" step="100"
                          value={form.specKcalHMax}
                          onChange={(e) => setField("specKcalHMax", e.target.value)}
                          placeholder="Ex: 20000"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase mb-4">
                      ⚡ Eletrico — Bombas, Motores, Equipamentos
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className={labelClass}>Potencia (CV)</label>
                        <input
                          type="number" step="0.1"
                          value={form.specPotenciaCv}
                          onChange={(e) => setField("specPotenciaCv", e.target.value)}
                          placeholder="Ex: 0.75"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Voltagem (V)</label>
                        <input
                          type="number" step="1"
                          value={form.specVoltagem}
                          onChange={(e) => setField("specVoltagem", e.target.value)}
                          placeholder="Ex: 220"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Amperagem (A)</label>
                        <input
                          type="number" step="0.1"
                          value={form.specAmperagem}
                          onChange={(e) => setField("specAmperagem", e.target.value)}
                          placeholder="Ex: 5.1"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Tipo eletrico</label>
                        <select
                          value={form.specBifTrif}
                          onChange={(e) => setField("specBifTrif", e.target.value)}
                          className={inputClass}
                        >
                          <option value="">— Nao se aplica —</option>
                          <option value="Bif">Bifasico (220V — 2 fases)</option>
                          <option value="Trif">Trifasico (220V/380V — 3 fases)</option>
                        </select>
                        <p className="mt-1 text-[11px] text-slate-600">
                          Influencia disjuntor, quadro de distribuicao e fiacao.
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Espacos no quadro</label>
                        <input
                          type="number" step="1" min="0"
                          value={form.specBifTrifConta}
                          onChange={(e) => setField("specBifTrifConta", e.target.value)}
                          placeholder="Ex: 2 (Bif) ou 3 (Trif)"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-slate-600">
                          Quantos modulos/espacos o disjuntor ou contactor desse equipamento ocupa no quadro. Usado pra dimensionar quadro automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 shrink-0">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingProduct ? "Salvar Alteracoes" : "Criar Produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
