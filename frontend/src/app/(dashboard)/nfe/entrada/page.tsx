"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";

/* ── Types ─────────────────────────────────────────── */

interface PaginationMeta { total: number; page: number; limit: number; totalPages: number; }

interface NfseEntrada {
  id: string;
  numero: string | null;
  codigoVerificacao: string | null;
  dataEmissao: string | null;
  competencia: string | null;
  layout: string | null;
  prestadorId: string | null;
  prestadorCnpjCpf: string | null;
  prestadorRazaoSocial: string | null;
  prestadorIm: string | null;
  prestadorMunicipio: string | null;
  prestadorUf: string | null;
  itemListaServico: string | null;
  codigoCnae: string | null;
  discriminacao: string | null;
  valorServicosCents: number | null;
  baseCalculoCents: number | null;
  aliquotaIss: number | null;
  issRetido: boolean;
  valorIssCents: number | null;
  valorPisCents: number | null;
  valorCofinsCents: number | null;
  valorInssCents: number | null;
  valorIrCents: number | null;
  valorCsllCents: number | null;
  outrasRetCents: number | null;
  descontoIncondCents: number | null;
  valorLiquidoCents: number | null;
  codigoObra: string | null;
  art: string | null;
  focusSource: boolean;
  chaveNfse: string | null;
  situacaoFocus: string | null;
  status: string;
  createdAt: string;
  prestador: { id: string; name: string; document: string } | null;
}

/* ── Helpers ─────────────────────────────────────────── */

function fmt(cents: number | undefined | null) {
  if (cents == null) return "\u2014";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(dateStr: string | undefined | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDoc(doc: string | null | undefined) {
  if (!doc) return "\u2014";
  if (doc.length === 14) return doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

const LAYOUT_BADGE: Record<string, { label: string; cls: string }> = {
  ABRASF: { label: "ABRASF", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  NACIONAL: { label: "Nacional", cls: "bg-green-50 text-green-700 border-green-200" },
  MANUAL: { label: "Manual", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

/* ── Columns ─────────────────────────────────────────── */

function buildColumns(): ColumnDefinition<NfseEntrada>[] {
  return [
    { id: "numero", label: "Numero", sortable: true, render: (r) => <span className="font-medium text-slate-900 text-xs">{r.numero || "\u2014"}</span> },
    { id: "dataEmissao", label: "Emissao", sortable: true, render: (r) => <span className="text-xs text-slate-700">{fmtDate(r.dataEmissao)}</span> },
    { id: "competencia", label: "Compet.", sortable: true, render: (r) => <span className="text-xs text-slate-600">{r.competencia || "\u2014"}</span> },
    { id: "prestadorRazaoSocial", label: "Prestador", sortable: true, render: (r) => (
      <span className="text-xs text-slate-900 font-medium truncate block max-w-[200px]" title={r.prestadorRazaoSocial || undefined}>
        {r.prestador?.name || r.prestadorRazaoSocial || "\u2014"}
      </span>
    )},
    { id: "prestadorCnpjCpf", label: "CNPJ/CPF", sortable: false, render: (r) => <span className="text-xs text-slate-600 font-mono">{fmtDoc(r.prestadorCnpjCpf)}</span> },
    { id: "discriminacao", label: "Servico", sortable: false, render: (r) => (
      <span className="text-xs text-slate-600 truncate block max-w-[180px]" title={r.discriminacao || undefined}>{r.discriminacao || "\u2014"}</span>
    )},
    { id: "valorServicosCents", label: "Valor", sortable: true, align: "right", render: (r) => <span className="text-xs font-medium text-slate-900">{fmt(r.valorServicosCents)}</span> },
    { id: "valorIssCents", label: "ISS", sortable: true, align: "right", render: (r) => <span className="text-xs text-slate-700">{fmt(r.valorIssCents)}</span> },
    { id: "issRetido", label: "Retido", sortable: false, render: (r) => (
      r.issRetido
        ? <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">Retido</span>
        : <span className="text-xs text-slate-400">Nao</span>
    )},
    { id: "layout", label: "Origem", sortable: false, render: (r) => {
      if (r.focusSource) {
        return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">Focus NFe</span>;
      }
      const cfg = LAYOUT_BADGE[r.layout || ""] || { label: r.layout || "\u2014", cls: "bg-slate-50 text-slate-500 border-slate-200" };
      return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span>;
    }},
  ];
}

/* ── Filters ─────────────────────────────────────────── */

const FILTERS: FilterDefinition[] = [
  { key: "competencia", type: "text", label: "Competencia", placeholder: "AAAA-MM" },
  { key: "status", type: "select", label: "Status", options: [
    { value: "", label: "Ativas" },
    { value: "CANCELLED", label: "Canceladas" },
  ]},
];

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

/* ══════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════ */

export default function NfseEntradaPage() {
  const { toast } = useToast();
  const columns = buildColumns();
  const tp = useTableParams({ defaultSortBy: "createdAt", defaultSortOrder: "desc", persistKey: "nfse-entrada" });
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout("nfse-entrada", columns);

  const [entries, setEntries] = useState<NfseEntrada[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form
  const [showManual, setShowManual] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [mf, setMf] = useState(emptyForm());

  // Focus NFe sync
  const [syncing, setSyncing] = useState(false);

  /* ── Load ──────────────────────────────────────── */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const qs = tp.buildQueryString();
      const result = await api.get<{ data: NfseEntrada[]; meta: PaginationMeta }>(`/nfse-entrada?${qs}`);
      setEntries(result.data);
      setMeta(result.meta);
    } catch (err: any) {
      toast(err?.message || "Erro ao carregar NFS-e de entrada", "error");
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Upload XML ─────────────────────────────────── */

  async function handleUploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast("Somente arquivos .xml", "error");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAccessToken();
      const res = await fetch("/api/nfse-entrada/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao importar NFS-e");
      }
      toast("NFS-e importada com sucesso!");
      setShowUpload(false);
      loadData();
    } catch (err: any) {
      toast(err?.message || "Erro ao importar NFS-e", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUploadFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = "";
  }

  /* ── Sync Focus NFe ────────────────────────────── */

  async function handleSyncFocus() {
    setSyncing(true);
    try {
      const result = await api.post<{ imported: number; skipped: number; total: number; limitReached: boolean; monthlyLimit: number; usedThisMonth: number }>("/nfse-entrada/sync-focus", {});
      if (result.limitReached && result.imported === 0) {
        toast(`Limite mensal atingido (${result.usedThisMonth}/${result.monthlyLimit} importacoes)`, "error");
      } else if (result.imported > 0) {
        const limitMsg = result.limitReached ? ` (limite: ${result.usedThisMonth}/${result.monthlyLimit})` : "";
        toast(`${result.imported} NFS-e importada(s) do Focus NFe${limitMsg}`);
        loadData();
      } else if (result.total === 0) {
        toast("Nenhuma NFS-e nova encontrada no Focus NFe", "info");
      } else {
        toast(`${result.total} NFS-e verificada(s), nenhuma nova`, "info");
      }
    } catch (err: any) {
      toast(err?.message || "Erro ao sincronizar com Focus NFe", "error");
    } finally {
      setSyncing(false);
    }
  }

  /* ── Manual ─────────────────────────────────────── */

  function emptyForm() {
    return {
      numero: "", dataEmissao: "", competencia: "",
      prestadorCnpjCpf: "", prestadorRazaoSocial: "", prestadorIm: "",
      prestadorMunicipio: "", prestadorUf: "",
      itemListaServico: "", codigoCnae: "", discriminacao: "",
      valorServicos: "", baseCalculo: "", aliquotaIss: "",
      issRetido: false, valorIss: "",
      valorPis: "", valorCofins: "", valorInss: "",
      valorIr: "", valorCsll: "", outrasRet: "",
      descontoIncond: "", valorLiquido: "",
      codigoObra: "", art: "",
    };
  }

  function reaisToCents(val: string): number | undefined {
    if (!val || val.trim() === "") return undefined;
    const n = parseFloat(val.replace(",", "."));
    return isNaN(n) ? undefined : Math.round(n * 100);
  }

  async function handleSaveManual() {
    if (!mf.prestadorRazaoSocial && !mf.prestadorCnpjCpf) {
      toast("Informe ao menos o nome ou CNPJ/CPF do prestador", "error");
      return;
    }
    if (!mf.valorServicos) {
      toast("Informe o valor dos servicos", "error");
      return;
    }
    setSavingManual(true);
    try {
      await api.post("/nfse-entrada/manual", {
        numero: mf.numero || undefined,
        dataEmissao: mf.dataEmissao || undefined,
        competencia: mf.competencia || undefined,
        prestadorCnpjCpf: mf.prestadorCnpjCpf?.replace(/\D/g, "") || undefined,
        prestadorRazaoSocial: mf.prestadorRazaoSocial || undefined,
        prestadorIm: mf.prestadorIm || undefined,
        prestadorMunicipio: mf.prestadorMunicipio || undefined,
        prestadorUf: mf.prestadorUf || undefined,
        itemListaServico: mf.itemListaServico || undefined,
        codigoCnae: mf.codigoCnae || undefined,
        discriminacao: mf.discriminacao || undefined,
        valorServicosCents: reaisToCents(mf.valorServicos),
        baseCalculoCents: reaisToCents(mf.baseCalculo),
        aliquotaIss: mf.aliquotaIss ? parseFloat(mf.aliquotaIss) : undefined,
        issRetido: mf.issRetido,
        valorIssCents: reaisToCents(mf.valorIss),
        valorPisCents: reaisToCents(mf.valorPis),
        valorCofinsCents: reaisToCents(mf.valorCofins),
        valorInssCents: reaisToCents(mf.valorInss),
        valorIrCents: reaisToCents(mf.valorIr),
        valorCsllCents: reaisToCents(mf.valorCsll),
        outrasRetCents: reaisToCents(mf.outrasRet),
        descontoIncondCents: reaisToCents(mf.descontoIncond),
        valorLiquidoCents: reaisToCents(mf.valorLiquido),
        codigoObra: mf.codigoObra || undefined,
        art: mf.art || undefined,
      });
      toast("NFS-e registrada com sucesso!");
      setShowManual(false);
      setMf(emptyForm());
      loadData();
    } catch (err: any) {
      toast(err?.message || "Erro ao salvar NFS-e", "error");
    } finally {
      setSavingManual(false);
    }
  }

  /* ── Cancel ─────────────────────────────────────── */

  async function handleCancel(id: string) {
    if (!confirm("Deseja cancelar esta NFS-e de entrada?")) return;
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/nfse-entrada/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao cancelar");
      }
      toast("NFS-e cancelada");
      loadData();
    } catch (err: any) {
      toast(err?.message || "Erro ao cancelar", "error");
    }
  }

  /* ── Summary Cards ──────────────────────────────── */

  const totalServicos = entries.reduce((sum, e) => sum + (e.valorServicosCents || 0), 0);
  const totalIssRetido = entries.filter(e => e.issRetido).reduce((sum, e) => sum + (e.valorIssCents || 0), 0);

  /* ── Render ─────────────────────────────────────── */

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">NFS-e de Entrada</h1>
        <p className="text-sm text-slate-500 mt-1">Notas fiscais de servico recebidas (servicos tomados)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total de Notas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{meta.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Valor Servicos (pagina)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(totalServicos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">ISS Retido (pagina)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(totalIssRetido)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setShowUpload(!showUpload); setShowManual(false); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Importar XML
        </button>
        <button onClick={() => { setShowManual(!showManual); setShowUpload(false); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Digitacao Manual
        </button>
        <button onClick={handleSyncFocus} disabled={syncing} className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {syncing ? "Sincronizando..." : "Importar Focus NFe"}
        </button>
      </div>

      {/* Upload Area */}
      {showUpload && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Importar NFS-e via XML</h3>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"}`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <p className="text-sm text-slate-500">Processando XML...</p>
              </div>
            ) : (
              <>
                <svg className="h-10 w-10 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-slate-700 mb-1">Arraste o XML aqui ou clique para selecionar</p>
                <p className="text-xs text-slate-400">XML de NFS-e (ABRASF 2.04 ou Nacional)</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".xml" onChange={handleFileInput} className="hidden" />
        </div>
      )}

      {/* Manual Form */}
      {showManual && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Registro Manual de NFS-e de Entrada</h3>

          {/* Identificacao */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Identificacao</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            <div><label className={labelClass}>Numero NFS-e</label><input type="text" value={mf.numero} onChange={(e) => setMf({ ...mf, numero: e.target.value })} placeholder="12345" className={inputClass} /></div>
            <div><label className={labelClass}>Data Emissao</label><input type="date" value={mf.dataEmissao} onChange={(e) => setMf({ ...mf, dataEmissao: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Competencia</label><input type="month" value={mf.competencia} onChange={(e) => setMf({ ...mf, competencia: e.target.value })} className={inputClass} /></div>
          </div>

          {/* Prestador */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prestador (quem emitiu)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div><label className={labelClass}>Razao Social *</label><input type="text" value={mf.prestadorRazaoSocial} onChange={(e) => setMf({ ...mf, prestadorRazaoSocial: e.target.value })} placeholder="Nome do prestador" className={inputClass} /></div>
            <div><label className={labelClass}>CNPJ/CPF *</label><input type="text" value={mf.prestadorCnpjCpf} onChange={(e) => setMf({ ...mf, prestadorCnpjCpf: e.target.value })} placeholder="00.000.000/0000-00" className={inputClass} /></div>
            <div><label className={labelClass}>Inscricao Municipal</label><input type="text" value={mf.prestadorIm} onChange={(e) => setMf({ ...mf, prestadorIm: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Municipio (IBGE)</label><input type="text" value={mf.prestadorMunicipio} onChange={(e) => setMf({ ...mf, prestadorMunicipio: e.target.value })} placeholder="7 digitos" maxLength={7} className={inputClass} /></div>
            <div><label className={labelClass}>UF</label><input type="text" value={mf.prestadorUf} onChange={(e) => setMf({ ...mf, prestadorUf: e.target.value.toUpperCase() })} placeholder="MT" maxLength={2} className={inputClass} /></div>
          </div>

          {/* Servico */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Servico</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
            <div><label className={labelClass}>Item LC 116</label><input type="text" value={mf.itemListaServico} onChange={(e) => setMf({ ...mf, itemListaServico: e.target.value })} placeholder="7.02" className={inputClass} /></div>
            <div><label className={labelClass}>CNAE</label><input type="text" value={mf.codigoCnae} onChange={(e) => setMf({ ...mf, codigoCnae: e.target.value })} placeholder="7 digitos" className={inputClass} /></div>
          </div>
          <div className="mb-5">
            <label className={labelClass}>Discriminacao do Servico</label>
            <textarea value={mf.discriminacao} onChange={(e) => setMf({ ...mf, discriminacao: e.target.value })} rows={2} placeholder="Descricao do servico" className={inputClass + " resize-none"} />
          </div>

          {/* Valores */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Valores (R$)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div><label className={labelClass}>Valor Servicos *</label><input type="text" value={mf.valorServicos} onChange={(e) => setMf({ ...mf, valorServicos: e.target.value })} placeholder="1000.00" className={inputClass} /></div>
            <div><label className={labelClass}>Base Calculo ISS</label><input type="text" value={mf.baseCalculo} onChange={(e) => setMf({ ...mf, baseCalculo: e.target.value })} placeholder="1000.00" className={inputClass} /></div>
            <div><label className={labelClass}>Aliquota ISS (%)</label><input type="text" value={mf.aliquotaIss} onChange={(e) => setMf({ ...mf, aliquotaIss: e.target.value })} placeholder="2.00" className={inputClass} /></div>
            <div><label className={labelClass}>Valor ISS</label><input type="text" value={mf.valorIss} onChange={(e) => setMf({ ...mf, valorIss: e.target.value })} placeholder="20.00" className={inputClass} /></div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={mf.issRetido} onChange={(e) => setMf({ ...mf, issRetido: e.target.checked })} className="rounded border-slate-300" />
                ISS Retido
              </label>
            </div>
            <div><label className={labelClass}>PIS</label><input type="text" value={mf.valorPis} onChange={(e) => setMf({ ...mf, valorPis: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>COFINS</label><input type="text" value={mf.valorCofins} onChange={(e) => setMf({ ...mf, valorCofins: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>INSS</label><input type="text" value={mf.valorInss} onChange={(e) => setMf({ ...mf, valorInss: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>IR</label><input type="text" value={mf.valorIr} onChange={(e) => setMf({ ...mf, valorIr: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>CSLL</label><input type="text" value={mf.valorCsll} onChange={(e) => setMf({ ...mf, valorCsll: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>Outras Ret.</label><input type="text" value={mf.outrasRet} onChange={(e) => setMf({ ...mf, outrasRet: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>Valor Liquido</label><input type="text" value={mf.valorLiquido} onChange={(e) => setMf({ ...mf, valorLiquido: e.target.value })} placeholder="980.00" className={inputClass} /></div>
          </div>

          {/* Construcao Civil */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Construcao Civil (opcional)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div><label className={labelClass}>CNO / Codigo Obra</label><input type="text" value={mf.codigoObra} onChange={(e) => setMf({ ...mf, codigoObra: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>ART / RRT</label><input type="text" value={mf.art} onChange={(e) => setMf({ ...mf, art: e.target.value })} className={inputClass} /></div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button onClick={() => { setShowManual(false); setMf(emptyForm()); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button onClick={handleSaveManual} disabled={savingManual} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">{savingManual ? "Salvando..." : "Registrar NFS-e"}</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <FilterBar
        filters={FILTERS}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Numero, prestador, CNPJ, descricao..."
      />

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm text-slate-500">Nenhuma NFS-e de entrada encontrada</p>
            <p className="text-xs text-slate-400 mt-1">Importe um XML ou registre manualmente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: "fixed", minWidth: "900px" }}>
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
                    >
                      {col.sortable ? (
                        <SortableHeader
                          as="div"
                          label={col.label}
                          column={col.id}
                          currentColumn={tp.sort.column}
                          currentOrder={tp.sort.order}
                          onToggle={tp.toggleSort}
                          align={col.align}
                        />
                      ) : (
                        <div className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${col.align === "right" ? "text-right" : ""}`}>
                          {col.label}
                        </div>
                      )}
                    </DraggableHeader>
                  ))}
                  <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-right w-[60px]">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      {orderedColumns.map((col) => {
                        const w = columnWidths[col.id];
                        const tdStyle: React.CSSProperties = w ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden" } : {};
                        return (
                          <td key={col.id} style={tdStyle} className="py-3 px-4">
                            {col.render(entry)}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right">
                        {entry.status === "ACTIVE" && (
                          <button onClick={(e) => { e.stopPropagation(); handleCancel(entry.id); }} className="text-xs text-red-500 hover:text-red-700 transition-colors" title="Cancelar">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Expanded Detail */}
                    {expandedId === entry.id && (
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        <td colSpan={orderedColumns.length + 1} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-xs">
                            <div><p className="text-slate-400 text-[10px] uppercase">Cod. Verificacao</p><p className="text-slate-700 font-mono">{entry.codigoVerificacao || "\u2014"}</p></div>
                            <div><p className="text-slate-400 text-[10px] uppercase">Item LC 116</p><p className="text-slate-700">{entry.itemListaServico || "\u2014"}</p></div>
                            <div><p className="text-slate-400 text-[10px] uppercase">CNAE</p><p className="text-slate-700">{entry.codigoCnae || "\u2014"}</p></div>
                            <div><p className="text-slate-400 text-[10px] uppercase">IM Prestador</p><p className="text-slate-700">{entry.prestadorIm || "\u2014"}</p></div>
                            <div><p className="text-slate-400 text-[10px] uppercase">Base Calculo</p><p className="text-slate-700">{fmt(entry.baseCalculoCents)}</p></div>
                            <div><p className="text-slate-400 text-[10px] uppercase">Aliquota ISS</p><p className="text-slate-700">{entry.aliquotaIss != null ? `${entry.aliquotaIss}%` : "\u2014"}</p></div>
                            {(entry.valorPisCents || entry.valorCofinsCents || entry.valorInssCents || entry.valorIrCents || entry.valorCsllCents) ? (<>
                              <div><p className="text-slate-400 text-[10px] uppercase">PIS</p><p className="text-slate-700">{fmt(entry.valorPisCents)}</p></div>
                              <div><p className="text-slate-400 text-[10px] uppercase">COFINS</p><p className="text-slate-700">{fmt(entry.valorCofinsCents)}</p></div>
                              <div><p className="text-slate-400 text-[10px] uppercase">INSS</p><p className="text-slate-700">{fmt(entry.valorInssCents)}</p></div>
                              <div><p className="text-slate-400 text-[10px] uppercase">IR</p><p className="text-slate-700">{fmt(entry.valorIrCents)}</p></div>
                              <div><p className="text-slate-400 text-[10px] uppercase">CSLL</p><p className="text-slate-700">{fmt(entry.valorCsllCents)}</p></div>
                              <div><p className="text-slate-400 text-[10px] uppercase">Outras Ret.</p><p className="text-slate-700">{fmt(entry.outrasRetCents)}</p></div>
                            </>) : null}
                            <div><p className="text-slate-400 text-[10px] uppercase">Valor Liquido</p><p className="text-slate-900 font-semibold">{fmt(entry.valorLiquidoCents)}</p></div>
                            {entry.codigoObra && <div><p className="text-slate-400 text-[10px] uppercase">CNO Obra</p><p className="text-slate-700">{entry.codigoObra}</p></div>}
                            {entry.art && <div><p className="text-slate-400 text-[10px] uppercase">ART</p><p className="text-slate-700">{entry.art}</p></div>}
                            {entry.discriminacao && (
                              <div className="col-span-2 md:col-span-4">
                                <p className="text-slate-400 text-[10px] uppercase">Discriminacao</p>
                                <p className="text-slate-700 whitespace-pre-wrap">{entry.discriminacao}</p>
                              </div>
                            )}
                            {entry.prestador && (
                              <div className="col-span-2">
                                <p className="text-slate-400 text-[10px] uppercase">Prestador Vinculado</p>
                                <p className="text-green-700 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  {entry.prestador.name} ({fmtDoc(entry.prestador.document)})
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination meta={meta} onPageChange={tp.setPage} />
    </div>
  );
}
