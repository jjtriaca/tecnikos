"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type Stage = {
  id: string;
  poolSection: string;
  name: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  sortOrder: number;
};

type Entry = {
  id: string;
  date: string;
  supplierName: string | null;
  description: string;
  qty: number | null;
  unitPriceCents: number | null;
  totalCents: number;
  type: string;
  paymentMethod: string | null;
  invoiceNumber: string | null;
  reflectsInFinance: boolean;
  financialEntryId: string | null;
  notes: string | null;
};

type Photo = {
  id: string;
  fileUrl: string;
  caption: string | null;
  takenAt: string | null;
  uploadedAt: string;
};

type Project = {
  id: string;
  code: string | null;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  progressPercent: number;
  budget: { id: string; code: string | null; title: string; totalCents: number };
  customer: { id: string; name: string; phone?: string | null; email?: string | null };
  stages: Stage[];
  entries: Entry[];
  photos: Photo[];
};

const SECTION_LABEL: Record<string, string> = {
  CONSTRUCAO: "Construcao", FILTRO: "Filtro", CASCATA: "Cascata", SPA: "SPA",
  AQUECIMENTO: "Aquecimento", ILUMINACAO: "Iluminacao", CASA_MAQUINAS: "Casa de Maquinas",
  DISPOSITIVOS: "Dispositivos", ACIONAMENTOS: "Acionamentos", BORDA_CALCADA: "Borda/Calcada",
  EXECUCAO: "Execucao", OUTROS: "Outros",
};

const STAGE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-slate-100 text-slate-700" },
  EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-100 text-blue-700" },
  CONCLUIDA: { label: "Concluida", cls: "bg-green-100 text-green-700" },
  BLOQUEADA: { label: "Bloqueada", cls: "bg-red-100 text-red-700" },
};

const PROJECT_STATUS: Record<string, { label: string; cls: string }> = {
  PLANEJADA: { label: "Planejada", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  PAUSADA: { label: "Pausada", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  CONCLUIDA: { label: "Concluida", cls: "bg-green-100 text-green-700 border-green-300" },
  CANCELADA: { label: "Cancelada", cls: "bg-red-100 text-red-700 border-red-300" },
};

const ENTRY_TYPE: Record<string, string> = {
  MATERIAL: "Material", SERVICO: "Servico", SUBEMPREITADA: "Subempreitada",
  FRETE: "Frete", OUTRO: "Outro",
};

function fmtCurrency(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("pt-BR") : "—";
}

export default function PoolProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"etapas" | "lancamentos" | "fotos">("etapas");
  const [showAddStage, setShowAddStage] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Project>(`/pool-projects/${id}`);
      setProject(data);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar obra", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  async function updateProject(patch: Partial<Project>) {
    try {
      await api.put(`/pool-projects/${id}`, patch);
      toast("Obra atualizada", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function updateStage(stageId: string, patch: Partial<Stage>) {
    try {
      await api.put(`/pool-projects/stages/${stageId}`, patch);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function removeStage(stageId: string) {
    if (!confirm("Remover esta etapa?")) return;
    try {
      await api.del(`/pool-projects/stages/${stageId}`);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function addStage(payload: any) {
    try {
      await api.post(`/pool-projects/${id}/stages`, payload);
      setShowAddStage(false);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function addEntry(payload: any) {
    try {
      await api.post(`/pool-projects/${id}/entries`, payload);
      setShowAddEntry(false);
      toast("Lancamento adicionado", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function removeEntry(entryId: string) {
    if (!confirm("Remover este lancamento? Se vinculado ao Financeiro, sera cancelado tambem.")) return;
    try {
      await api.del(`/pool-projects/entries/${entryId}`);
      toast("Lancamento removido", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function handleUploadPhoto(file: File) {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getAccessToken();
      const res = await fetch(`/api/pool-projects/${id}/photos/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha no upload");
      }
      toast("Foto enviada", "success");
      await load();
    } catch (err: any) {
      toast(err.message || "Erro ao enviar foto", "error");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removePhoto(photoId: string) {
    if (!confirm("Remover esta foto?")) return;
    try {
      await api.del(`/pool-projects/photos/${photoId}`);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Carregando...</div>;
  if (!project) return <div className="p-6 text-slate-400">Obra nao encontrada.</div>;
  const status = PROJECT_STATUS[project.status] || { label: project.status, cls: "" };

  const totalGastos = project.entries.reduce((s, e) => s + e.totalCents, 0);
  const orcamentoTotal = project.budget?.totalCents || 0;
  const percentGasto = orcamentoTotal > 0 ? (totalGastos / orcamentoTotal) * 100 : 0;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/quotes?tab=obras" className="text-xs text-slate-500 hover:text-slate-700">
            ← Voltar pra Obras
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-slate-900">{project.budget.title}</h1>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{project.code || "—"}</span> • Cliente: <strong>{project.customer?.name}</strong> • Orcamento: <Link href={`/quotes/pool/${project.budget.id}`} className="text-cyan-600 hover:underline">{project.budget.code}</Link>
          </p>
        </div>
        <select
          value={project.status}
          onChange={(e) => updateProject({ status: e.target.value } as any)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {Object.entries(PROJECT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Orcamento</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{fmtCurrency(orcamentoTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Gasto ate agora</div>
          <div className="mt-1 text-xl font-bold text-orange-600">{fmtCurrency(totalGastos)}</div>
          <div className="mt-0.5 text-xs text-slate-400">{percentGasto.toFixed(1)}% do orcamento</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Saldo</div>
          <div className={`mt-1 text-xl font-bold ${orcamentoTotal - totalGastos >= 0 ? "text-green-600" : "text-red-600"}`}>
            {fmtCurrency(orcamentoTotal - totalGastos)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Progresso</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, project.progressPercent)}%` }} />
            </div>
            <span className="text-sm font-medium">{Math.round(project.progressPercent)}%</span>
          </div>
        </div>
      </div>

      {/* Datas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Inicio</div>
            <input type="date"
              value={project.startDate ? project.startDate.split("T")[0] : ""}
              onChange={(e) => updateProject({ startDate: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null } as any)}
              className="mt-1 rounded border border-slate-300 px-2 py-1" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Previsao de termino</div>
            <input type="date"
              value={project.expectedEndDate ? project.expectedEndDate.split("T")[0] : ""}
              onChange={(e) => updateProject({ expectedEndDate: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null } as any)}
              className="mt-1 rounded border border-slate-300 px-2 py-1" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Termino real</div>
            <input type="date"
              value={project.actualEndDate ? project.actualEndDate.split("T")[0] : ""}
              onChange={(e) => updateProject({ actualEndDate: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null } as any)}
              className="mt-1 rounded border border-slate-300 px-2 py-1" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {(["etapas", "lancamentos", "fotos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                tab === t ? "border-cyan-500 text-cyan-600" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {t === "etapas" ? `Etapas (${project.stages.length})` :
               t === "lancamentos" ? `Lancamentos (${project.entries.length})` :
               `Fotos (${project.photos.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === "etapas" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddStage(true)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700">
              + Nova etapa
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {project.stages.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Nenhuma etapa ainda.</div>
            ) : project.stages.map((s) => {
              const st = STAGE_STATUS[s.status] || { label: s.status, cls: "" };
              return (
                <div key={s.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{s.name}</span>
                      <span className="text-[10px] uppercase text-slate-400">{SECTION_LABEL[s.poolSection] || s.poolSection}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.plannedStart && `Previsto: ${fmtDate(s.plannedStart)} → ${fmtDate(s.plannedEnd)}`}
                      {s.startedAt && ` • Iniciada: ${fmtDate(s.startedAt)}`}
                      {s.completedAt && ` • Concluida: ${fmtDate(s.completedAt)}`}
                    </div>
                  </div>
                  <select
                    value={s.status}
                    onChange={(e) => updateStage(s.id, { status: e.target.value } as any)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {Object.entries(STAGE_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <button onClick={() => removeStage(s.id)} className="text-red-500 hover:text-red-700 text-xs">
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "lancamentos" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddEntry(true)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700">
              + Novo lancamento
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Descricao</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Pagto</th>
                  <th className="px-3 py-2 text-left">NF</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Financeiro?</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {project.entries.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-400">Nenhum lancamento ainda.</td></tr>
                ) : project.entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2 text-slate-900">{e.description}</td>
                    <td className="px-3 py-2 text-slate-700">{e.supplierName || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{ENTRY_TYPE[e.type] || e.type}</td>
                    <td className="px-3 py-2 text-slate-700">{e.paymentMethod || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{e.invoiceNumber || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtCurrency(e.totalCents)}</td>
                    <td className="px-3 py-2 text-center">
                      {e.reflectsInFinance ? (
                        <span className="text-xs text-green-700">✓ Sim</span>
                      ) : (
                        <span className="text-xs text-slate-400">Nao</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeEntry(e.id)} className="text-red-500 hover:text-red-700 text-xs">
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {project.entries.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">Total gasto</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">{fmtCurrency(totalGastos)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === "fotos" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <label className={`rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700 cursor-pointer ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
              {uploadingPhoto ? "Enviando..." : "+ Enviar foto"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={false}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadPhoto(f);
                }}
              />
            </label>
          </div>
          {project.photos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 rounded-xl border border-dashed border-slate-300 bg-white">
              Nenhuma foto enviada ainda.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {project.photos.map((p) => (
                <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <img src={p.fileUrl.startsWith("/uploads") ? `/api${p.fileUrl}` : p.fileUrl}
                       alt={p.caption || "Foto"} className="w-full h-40 object-cover" />
                  <div className="p-2 text-xs">
                    <div className="text-slate-700 truncate">{p.caption || "(sem legenda)"}</div>
                    <div className="text-slate-400">{fmtDate(p.takenAt || p.uploadedAt)}</div>
                  </div>
                  <button onClick={() => removePhoto(p.id)}
                    className="absolute top-2 right-2 rounded-full bg-red-600 text-white text-xs h-7 w-7 opacity-0 group-hover:opacity-100 transition">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal nova etapa */}
      {showAddStage && (
        <SimpleModal title="Nova etapa" onClose={() => setShowAddStage(false)} onSubmit={addStage}>
          {(values, setValues) => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Nome *</label>
                  <input value={values.name || ""} onChange={(e) => setValues({ ...values, name: e.target.value })}
                    required className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Secao</label>
                  <select value={values.poolSection || "EXECUCAO"} onChange={(e) => setValues({ ...values, poolSection: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                    {Object.entries(SECTION_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Inicio previsto</label>
                  <input type="date" value={values.plannedStart || ""} onChange={(e) => setValues({ ...values, plannedStart: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Termino previsto</label>
                  <input type="date" value={values.plannedEnd || ""} onChange={(e) => setValues({ ...values, plannedEnd: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs text-slate-600 mb-1">Notas</label>
                <textarea value={values.notes || ""} rows={2} onChange={(e) => setValues({ ...values, notes: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </>
          )}
        </SimpleModal>
      )}

      {/* Modal novo lancamento */}
      {showAddEntry && (
        <SimpleModal title="Novo lancamento" onClose={() => setShowAddEntry(false)}
          initial={{ date: new Date().toISOString().split("T")[0], type: "MATERIAL", reflectsInFinance: false }}
          onSubmit={(v) => addEntry({
            ...v,
            date: new Date(v.date + "T12:00:00").toISOString(),
            qty: v.qty ? parseFloat(v.qty) : undefined,
            unitPriceCents: v.unitPrice ? Math.round(parseFloat(v.unitPrice.replace(",", ".")) * 100) : undefined,
            totalCents: Math.round(parseFloat((v.totalValue || "0").replace(",", ".")) * 100),
          })}
        >
          {(values, setValues) => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Data *</label>
                  <input type="date" value={values.date || ""} required onChange={(e) => setValues({ ...values, date: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Tipo</label>
                  <select value={values.type || "MATERIAL"} onChange={(e) => setValues({ ...values, type: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                    {Object.entries(ENTRY_TYPE).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">Descricao *</label>
                  <input value={values.description || ""} required onChange={(e) => setValues({ ...values, description: e.target.value })}
                    placeholder="Ex: Cimento ABC, 5 sacos" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">Fornecedor</label>
                  <input value={values.supplierName || ""} onChange={(e) => setValues({ ...values, supplierName: e.target.value })}
                    placeholder="Nome do fornecedor (texto livre)" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Qtd</label>
                  <input type="number" step="0.01" value={values.qty || ""} onChange={(e) => setValues({ ...values, qty: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Preco un. (R$)</label>
                  <input value={values.unitPrice || ""} onChange={(e) => setValues({ ...values, unitPrice: e.target.value })}
                    placeholder="0,00" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">Valor total *</label>
                  <input value={values.totalValue || ""} required onChange={(e) => setValues({ ...values, totalValue: e.target.value })}
                    placeholder="0,00" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Pagamento</label>
                  <input value={values.paymentMethod || ""} onChange={(e) => setValues({ ...values, paymentMethod: e.target.value })}
                    placeholder="PIX, Dinheiro, Boleto..." className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">N° Nota Fiscal</label>
                  <input value={values.invoiceNumber || ""} onChange={(e) => setValues({ ...values, invoiceNumber: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={!!values.reflectsInFinance}
                      onChange={(e) => setValues({ ...values, reflectsInFinance: e.target.checked })} />
                    Refletir no Financeiro geral (cria FinancialEntry PAYABLE)
                  </label>
                </div>
              </div>
            </>
          )}
        </SimpleModal>
      )}
    </div>
  );
}

function SimpleModal({ title, onClose, onSubmit, children, initial }: {
  title: string;
  onClose: () => void;
  onSubmit: (values: any) => void;
  children: (values: any, setValues: (v: any) => void) => React.ReactNode;
  initial?: any;
}) {
  const [values, setValues] = useState<any>(initial || {});
  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
        <form onSubmit={handle} className="space-y-3">
          {children(values, setValues)}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
