"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import FilterBar from "@/components/ui/FilterBar";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { useTableParams } from "@/hooks/useTableParams";
import type { FilterDefinition } from "@/lib/types/table";
import PartnerTable, { type Partner } from "./components/PartnerTable";
import PartnerForm from "./components/PartnerForm";
import SpecializationsTab, { type Specialization } from "./components/SpecializationsTab";
import ImportCSVModal from "./components/ImportCSVModal";
import { exportToCSV, fmtDate, fmtStatus, type ExportColumn } from "@/lib/export-utils";

type MainTab = "parceiros" | "especializacoes";
type FilterTab = "ALL" | "CLIENTE" | "FORNECEDOR" | "TECNICO";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "CLIENTE", label: "Clientes" },
  { key: "FORNECEDOR", label: "Fornecedores" },
  { key: "TECNICO", label: "Técnicos" },
];

const PARTNER_FILTERS: FilterDefinition[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "Status",
    options: [
      { value: "ATIVO", label: "Ativo" },
      { value: "INATIVO", label: "Inativo" },
      { value: "EM_TREINAMENTO", label: "Em Treinamento" },
    ],
  },
  {
    key: "personType",
    label: "Tipo Pessoa",
    type: "select",
    placeholder: "Tipo Pessoa",
    options: [
      { value: "PF", label: "Pessoa Física" },
      { value: "PJ", label: "Pessoa Jurídica" },
    ],
  },
];

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

export default function PartnersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const tp = useTableParams({ defaultSortBy: "name", defaultSortOrder: "asc" });

  const [mainTab, setMainTab] = useState<MainTab>("parceiros");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const canEdit = user?.role === "ADMIN" || user?.role === "DESPACHO";
  const isAdmin = user?.role === "ADMIN";

  /* ---- data loading ---- */

  const loadPartners = useCallback(async () => {
    try {
      const params = new URLSearchParams(tp.buildQueryString());
      if (filterTab !== "ALL") params.set("type", filterTab);
      const result = await api.get<PaginatedResponse<Partner>>(`/partners?${params.toString()}`);
      setPartners(result.data);
      setMeta(result.meta);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filterTab, tp.buildQueryString]);

  const loadSpecializations = useCallback(async () => {
    try {
      const res = await api.get<any>("/specializations");
      setSpecializations(Array.isArray(res) ? res : res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPartners();
    loadSpecializations();
  }, [loadPartners, loadSpecializations]);

  /* ---- handlers ---- */

  function handleEdit(p: Partner) {
    setEditingPartner(p);
    setShowForm(true);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditingPartner(null);
    loadPartners();
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingPartner(null);
  }

  function openDeleteModal(id: string, name: string) {
    setDeleteTarget({ id, name });
    setShowConfirmModal(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setShowConfirmModal(false);
    try {
      await api.del(`/partners/${deleteTarget.id}`);
      toast("Parceiro excluído.", "success");
      await loadPartners();
    } catch { toast("Erro ao excluir parceiro.", "error"); }
    finally { setDeleteTarget(null); }
  }

  function handleFilterChange(tab: FilterTab) {
    setFilterTab(tab);
    tp.setPage(1);
    setLoading(true);
  }

  /* ---- render ---- */

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parceiros</h1>
          <p className="text-sm text-slate-500">
            Cadastro unificado de clientes, fornecedores e técnicos
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setMainTab("parceiros")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            mainTab === "parceiros"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Parceiros
        </button>
        <button
          onClick={() => setMainTab("especializacoes")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            mainTab === "especializacoes"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Especializações
        </button>
      </div>

      {/* TAB: PARCEIROS */}
      {mainTab === "parceiros" && (
        <>
          {/* Sub-header: type tabs + new button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleFilterChange(tab.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterTab === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!partners.length) { toast("Nenhum dado para exportar", "error"); return; }
                  const cols: ExportColumn<Partner>[] = [
                    { header: "Nome", value: (r) => r.name },
                    { header: "Nome Fantasia", value: (r) => r.tradeName || "" },
                    { header: "Tipo Pessoa", value: (r) => r.personType },
                    { header: "Tipos", value: (r) => r.partnerTypes.join(", ") },
                    { header: "Documento", value: (r) => r.document || "" },
                    { header: "Telefone", value: (r) => r.phone || "" },
                    { header: "Email", value: (r) => r.email || "" },
                    { header: "Status", value: (r) => fmtStatus(r.status) },
                    { header: "Rating", value: (r) => r.rating?.toFixed(1) || "" },
                    { header: "Cidade", value: (r) => r.city || "" },
                    { header: "UF", value: (r) => r.state || "" },
                    { header: "Especializações", value: (r) => r.specializations?.map((s) => s.specialization.name).join(", ") || "" },
                    { header: "Cadastrado em", value: (r) => fmtDate(r.createdAt) },
                  ];
                  const date = new Date().toISOString().slice(0, 10);
                  exportToCSV(partners, cols, `parceiros-${date}.csv`);
                  toast("CSV exportado com sucesso!", "success");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                title="Exportar CSV"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV
              </button>
              {canEdit && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                  title="Importar CSV"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Importar
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => { setEditingPartner(null); setShowForm(true); }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  + Novo Parceiro
                </button>
              )}
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <PartnerForm
              editingPartner={editingPartner}
              specializations={specializations}
              onSaved={handleFormSaved}
              onCancel={handleFormCancel}
              onGoToSpecs={() => setMainTab("especializacoes")}
            />
          )}

          {/* Filter Bar */}
          <FilterBar
            filters={PARTNER_FILTERS}
            values={tp.filters}
            onChange={tp.setFilter}
            onReset={tp.resetFilters}
            search={tp.search}
            onSearchChange={tp.setSearch}
            searchPlaceholder="Buscar por nome, documento, email ou telefone..."
          />

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
              {tp.search || Object.keys(tp.filters).length > 0
                ? "Nenhum parceiro encontrado para esses filtros."
                : "Nenhum parceiro cadastrado. Clique em + Novo Parceiro para começar."}
            </div>
          ) : (
            <>
              <PartnerTable
                partners={partners}
                canEdit={canEdit}
                onEdit={handleEdit}
                onDelete={openDeleteModal}
                sort={tp.sort}
                onToggleSort={tp.toggleSort}
              />
              <Pagination meta={meta} onPageChange={tp.setPage} />
            </>
          )}
        </>
      )}

      {/* TAB: ESPECIALIZAÇÕES */}
      {mainTab === "especializacoes" && (
        <SpecializationsTab
          specializations={specializations}
          isAdmin={isAdmin}
          onReload={loadSpecializations}
          onBackToPartners={() => setMainTab("parceiros")}
        />
      )}

      {/* Confirm delete modal */}
      <ConfirmModal
        open={showConfirmModal}
        title="Excluir Parceiro"
        message={`Tem certeza que deseja excluir o parceiro "${deleteTarget?.name}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setShowConfirmModal(false); setDeleteTarget(null); }}
        variant="danger"
      />

      {/* Import CSV modal */}
      <ImportCSVModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => { toast("Parceiros importados com sucesso!", "success"); loadPartners(); }}
      />
    </div>
  );
}
