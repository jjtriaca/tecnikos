"use client";

import { useEffect, useState, useCallback } from "react";
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

type ModalTab = "geral" | "impostos" | "margem" | "equivalentes" | "estoque";

const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "impostos", label: "Impostos" },
  { id: "margem", label: "Margem" },
  { id: "equivalentes", label: "Equivalentes" },
  { id: "estoque", label: "Estoque" },
];

/* ── Filter definitions ───────────────────────────────── */

const PRODUCT_FILTERS: FilterDefinition[] = [
  {
    key: "category",
    label: "Categoria",
    type: "text",
    placeholder: "Filtrar categoria...",
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
      label: "Codigo",
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
      render: (p) => (
        <span className="text-sm text-slate-900 truncate block max-w-[220px]">
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
  };
}

function formToPayload(f: ProductForm) {
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
  };
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
      const payload = formToPayload(form);
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
      toast("Codigo do fornecedor e obrigatorio.", "error");
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
        filters={PRODUCT_FILTERS}
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
          <p className="text-sm text-slate-400">
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
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
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
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditProduct(p);
                              }}
                              className="rounded p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(p);
                              }}
                              className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
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
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* ── Tab: Geral ─────────────────────────── */}
              {modalTab === "geral" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={labelClass}>Codigo de Barras</label>
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
                      placeholder="Ex: Eletrico, Hidraulico..."
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
                              <span className="text-xs text-slate-500">Ultimo Preco de Compra</span>
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
                      <span className="ml-2 text-xs font-normal text-slate-400">
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
                            Codigo <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={equivForm.supplierCode}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierCode: e.target.value })
                            }
                            placeholder="Codigo no fornecedor"
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
                          <label className={labelClass}>Ultimo Preco (R$)</label>
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
                      <p className="text-sm text-slate-400">
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
                              Codigo
                            </th>
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Descricao
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600">
                              Ultimo Preco
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600">
                              Ultima Compra
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
                              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
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
                                  className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                        <p className="mt-1 text-[11px] text-slate-400">
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
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 shrink-0">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
