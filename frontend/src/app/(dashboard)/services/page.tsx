"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import ConfirmModal from "@/components/ui/ConfirmModal";

/* ── Types ────────────────────────────────────────────── */

interface Service {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  unit: string;
  priceCents: number | null;
  commissionBps: number | null;
  defaultQty: number | null;
  checklists: {
    toolsPpe?: string[];
    materials?: string[];
    initialCheck?: string[];
    finalCheck?: string[];
    custom?: string[];
  } | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRLToCents(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

const CHECKLIST_CLASSES = [
  { key: "toolsPpe" as const, label: "Ferramentas e EPI", icon: "🔧", placeholder: "Ex: Chave de fenda, Multímetro, Luvas isolantes..." },
  { key: "materials" as const, label: "Materiais", icon: "📦", placeholder: "Ex: Cabo 2.5mm, Disjuntor 20A, Fita isolante..." },
  { key: "initialCheck" as const, label: "Verificação Inicial", icon: "📋", placeholder: "Ex: Local energizado?, Risco de queda?, Cliente presente?..." },
  { key: "finalCheck" as const, label: "Verificação Final", icon: "✅", placeholder: "Ex: Área limpa?, Equipamentos testados?, Cliente assinou?..." },
  { key: "custom" as const, label: "Personalizado", icon: "📝", placeholder: "Ex: Item específico do serviço, Verificação extra..." },
];

const UNIT_OPTIONS = [
  { value: "SV", label: "Serviço (SV)" },
  { value: "HR", label: "Hora (HR)" },
  { value: "UN", label: "Unidade (UN)" },
  { value: "DI", label: "Diária (DI)" },
  { value: "MT", label: "Metro (MT)" },
  { value: "M2", label: "Metro² (M2)" },
];

/* ── Filters ──────────────────────────────────────────── */

const SERVICE_FILTERS: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Ativo" },
      { value: "inactive", label: "Inativo" },
    ],
  },
];

/* ── Columns ──────────────────────────────────────────── */

const SERVICE_COLUMNS: ColumnDefinition<Service>[] = [
  {
    id: "actions",
    label: "Acoes",
    render: () => null as any,
  },
  {
    id: "code",
    label: "Código",
    sortable: true,
    render: (s) => (
      <span className="text-sm font-mono text-slate-600">{s.code || "—"}</span>
    ),
  },
  {
    id: "name",
    label: "Nome",
    sortable: true,
    render: (s) => (
      <span className="text-sm font-medium text-slate-900" title={s.name}>
        {s.name}
      </span>
    ),
  },
  {
    id: "description",
    label: "Descrição",
    render: (s) => (
      <span className="text-sm text-slate-500 truncate block" title={s.description || ""}>
        {s.description || "—"}
      </span>
    ),
  },
  {
    id: "unit",
    label: "Unidade",
    render: (s) => {
      const opt = UNIT_OPTIONS.find((u) => u.value === s.unit);
      return <span className="text-sm text-slate-600">{opt?.label || s.unit}</span>;
    },
  },
  {
    id: "priceCents",
    label: "Preço",
    sortable: true,
    align: "right",
    render: (s) => (
      <span className="text-sm font-semibold text-green-700">{formatCurrency(s.priceCents)}</span>
    ),
  },
  {
    id: "commissionBps",
    label: "Comissão",
    sortable: true,
    align: "right",
    render: (s) => (
      <span className="text-sm text-slate-600">
        {s.commissionBps != null ? `${(s.commissionBps / 100).toFixed(1)}%` : "—"}
      </span>
    ),
  },
  {
    id: "defaultQty",
    label: "Qtd Padrão",
    align: "center",
    render: (s) => (
      <span className="text-sm text-slate-600">{s.defaultQty ?? "—"}</span>
    ),
  },
  {
    id: "category",
    label: "Categoria",
    sortable: true,
    render: (s) => (
      <span className="text-sm text-slate-500">{s.category || "—"}</span>
    ),
  },
  {
    id: "isActive",
    label: "Status",
    render: (s) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          s.isActive
            ? "bg-green-100 text-green-700 border border-green-200"
            : "bg-slate-100 text-slate-500 border border-slate-200"
        }`}
      >
        {s.isActive ? "Ativo" : "Inativo"}
      </span>
    ),
  },
];

/* ── Empty form ───────────────────────────────────────── */

const EMPTY_FORM = {
  code: "",
  name: "",
  description: "",
  unit: "SV",
  priceCents: "",
  commissionBps: "",
  defaultQty: "",
  checklists: { toolsPpe: [] as string[], materials: [] as string[], initialCheck: [] as string[], finalCheck: [] as string[], custom: [] as string[] },
  category: "",
  isActive: true,
};

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function ServicesPage() {
  const { toast } = useToast();

  // Table state
  const tp = useTableParams({ persistKey: "services-list" });
  const { orderedColumns: columns, reorderColumns: onReorder, setColumnWidth: onResize, columnWidths } = useTableLayout("services-v2", SERVICE_COLUMNS);

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  // Load services
  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tp.buildQueryString();
      const res = await api.get<PaginatedResponse<Service>>(`/services?${qs}`);
      setServices(res.data);
      setMeta(res.meta);
    } catch {
      toast("Erro ao carregar serviços.", "error");
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString, toast]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Load categories for filter
  useEffect(() => {
    api.get<string[]>("/services/categories").then(setCategories).catch(() => {});
  }, []);

  // Dynamic filters with categories
  const dynamicFilters: FilterDefinition[] = [
    ...SERVICE_FILTERS,
    ...(categories.length > 0
      ? [
          {
            key: "category",
            label: "Categoria",
            type: "select" as const,
            options: categories.map((c) => ({ value: c, label: c })),
          },
        ]
      : []),
  ];

  // Form handlers
  function openNewForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(service: Service) {
    setEditingId(service.id);
    setFormData({
      code: service.code || "",
      name: service.name,
      description: service.description || "",
      unit: service.unit,
      priceCents: service.priceCents != null ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
      commissionBps: service.commissionBps != null ? (service.commissionBps / 100).toFixed(1).replace(".", ",") : "",
      defaultQty: service.defaultQty != null ? String(service.defaultQty) : "",
      checklists: {
        toolsPpe: service.checklists?.toolsPpe || [],
        materials: service.checklists?.materials || [],
        initialCheck: service.checklists?.initialCheck || [],
        finalCheck: service.checklists?.finalCheck || [],
        custom: service.checklists?.custom || [],
      },
      category: service.category || "",
      isActive: service.isActive,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast("Nome é obrigatório.", "error");
      return;
    }
    setSaving(true);
    try {
      const commPct = formData.commissionBps ? parseFloat(formData.commissionBps.replace(",", ".")) : null;
      const payload = {
        code: formData.code || undefined,
        name: formData.name,
        description: formData.description || undefined,
        unit: formData.unit,
        priceCents: formData.priceCents ? parseBRLToCents(formData.priceCents) : undefined,
        commissionBps: commPct != null && !isNaN(commPct) ? Math.round(commPct * 100) : undefined,
        defaultQty: formData.defaultQty ? parseInt(formData.defaultQty) || undefined : undefined,
        checklists: {
          toolsPpe: formData.checklists.toolsPpe.filter(Boolean),
          materials: formData.checklists.materials.filter(Boolean),
          initialCheck: formData.checklists.initialCheck.filter(Boolean),
          finalCheck: formData.checklists.finalCheck.filter(Boolean),
          custom: formData.checklists.custom.filter(Boolean),
        },
        category: formData.category || undefined,
        isActive: formData.isActive,
      };

      if (editingId) {
        await api.patch(`/services/${editingId}`, payload);
        toast("Serviço atualizado!", "success");
      } else {
        await api.post("/services", payload);
        toast("Serviço criado!", "success");
      }
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setEditingId(null);
      await loadServices();
    } catch {
      toast("Erro ao salvar serviço.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDuplicate(service: Service) {
    setEditingId(null);
    setFormData({
      code: "",
      name: `${service.name} (cópia)`,
      description: service.description || "",
      unit: service.unit,
      priceCents: service.priceCents != null ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
      commissionBps: service.commissionBps != null ? (service.commissionBps / 100).toFixed(1).replace(".", ",") : "",
      defaultQty: service.defaultQty != null ? String(service.defaultQty) : "",
      checklists: {
        toolsPpe: [...(service.checklists?.toolsPpe || [])],
        materials: [...(service.checklists?.materials || [])],
        initialCheck: [...(service.checklists?.initialCheck || [])],
        finalCheck: [...(service.checklists?.finalCheck || [])],
        custom: [...(service.checklists?.custom || [])],
      },
      category: service.category || "",
      isActive: true,
    });
    setShowForm(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.del(`/services/${deleteTarget.id}`);
      toast("Serviço removido.", "success");
      setDeleteTarget(null);
      await loadServices();
    } catch {
      toast("Erro ao remover serviço.", "error");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Serviços</h1>
          <p className="text-sm text-slate-500">Cadastro de serviços prestados.</p>
        </div>
        <button
          onClick={openNewForm}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          + Novo Serviço
        </button>
      </div>

      {/* Filters */}
      <FilterBar
        filters={dynamicFilters}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por nome, código..."
      />

      {/* Form modal */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            {editingId ? "Editar Serviço" : "Novo Serviço"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Instalação de ar-condicionado"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Descrição detalhada do serviço..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unidade</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Preço (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.priceCents}
                onChange={(e) => setFormData({ ...formData, priceCents: e.target.value })}
                placeholder="Ex: 350,00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Comissão (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.commissionBps}
                onChange={(e) => setFormData({ ...formData, commissionBps: e.target.value })}
                placeholder="Ex: 10,0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Qtd Padrão</label>
              <input
                type="number"
                min={1}
                value={formData.defaultQty}
                onChange={(e) => setFormData({ ...formData, defaultQty: e.target.value })}
                placeholder="Ex: 2"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Quantidade inicial ao adicionar na OS</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Refrigeração"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Ativo
                </label>
              </div>
            )}
          </div>

          {/* Checklists editor — 4 classes fixas */}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <label className="text-xs font-medium text-slate-600 mb-2 block">Checklists do Serviço</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHECKLIST_CLASSES.map((cls) => {
                const items = formData.checklists[cls.key];
                return (
                  <div key={cls.key} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {cls.icon} {cls.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {items.length} {items.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <div>
                      {items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-1 mb-0.5">
                          <span className="text-slate-300 text-[10px] mt-1.5">{itemIdx + 1}.</span>
                          <textarea
                            value={item}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[itemIdx] = e.target.value;
                              setFormData({ ...formData, checklists: { ...formData.checklists, [cls.key]: updated } });
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                            rows={1}
                            placeholder={cls.placeholder}
                            className="flex-1 min-w-0 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-none overflow-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = items.filter((_, i) => i !== itemIdx);
                              setFormData({ ...formData, checklists: { ...formData.checklists, [cls.key]: updated } });
                            }}
                            className="text-red-300 hover:text-red-500 text-[10px] flex-shrink-0 mt-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, checklists: { ...formData.checklists, [cls.key]: [...items, ""] } });
                      }}
                      className="text-[10px] text-blue-500 hover:text-blue-700 mt-1"
                    >
                      + Adicionar item
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); setEditingId(null); }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    columnId={col.id}
                    index={idx}
                    width={columnWidths[col.id]}
                    onReorder={onReorder}
                    onResize={onResize}
                  >
                    {col.sortable ? (
                      <SortableHeader
                        label={col.label}
                        column={col.id}
                        currentColumn={tp.sort.column}
                        currentOrder={tp.sort.order}
                        onToggle={tp.toggleSort}
                      />
                    ) : (
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {col.label}
                      </span>
                    )}
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                    Nenhum serviço encontrado.
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEditForm(service)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className="px-4 py-3 whitespace-nowrap"
                        style={{ width: columnWidths[col.id], textAlign: col.id === "actions" ? "center" : col.align || "left" }}
                      >
                        {col.id === "actions" ? (
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditForm(service); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              title="Editar"
                            >
                              Editar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicate(service); }}
                              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                              title="Duplicar"
                            >
                              Duplicar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(service); }}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                              title="Excluir"
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          col.render(service)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        meta={meta}
        onPageChange={(p) => tp.setPage(p)}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Serviço"
        message={`Deseja excluir o serviço "${deleteTarget?.name}"?`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
