"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface SignupAttempt {
  id: string;
  status: string;
  slug: string | null;
  companyName: string | null;
  cnpj: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  responsiblePhone: string | null;
  planId: string | null;
  planName: string | null;
  billingCycle: string | null;
  cnpjData: Record<string, unknown> | null;
  verificationResult: Record<string, unknown> | null;
  rejectionReasons: string[];
  lastStep: number;
  lastError: string | null;
  completedAt: string | null;
  criticism: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  readAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STEP_NAMES: Record<number, string> = { 1: "Plano", 2: "Dados", 3: "Documentos", 4: "Pagamento", 5: "Concluido" };
const STEP_COLORS: Record<number, string> = { 1: "bg-slate-100 text-slate-600", 2: "bg-blue-100 text-blue-700", 3: "bg-purple-100 text-purple-700", 4: "bg-amber-100 text-amber-700", 5: "bg-green-100 text-green-700" };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function SignupAttemptsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<SignupAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SignupAttempt | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    setLoading(true);
    api.get<{ items: SignupAttempt[]; total: number }>(`/admin/tenants/signup-attempts/list?status=${statusFilter}&page=${page}&limit=20`)
      .then((data) => { setItems(data.items); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  function openDetail(attempt: SignupAttempt) {
    // Fetch fresh data (marks as read)
    api.get<SignupAttempt>(`/admin/tenants/signup-attempts/${attempt.id}`)
      .then((data) => {
        setSelected(data);
        setAdminNotes(data.adminNotes || "");
        // Update list item readAt
        setItems((prev) => prev.map((i) => i.id === data.id ? { ...i, readAt: data.readAt || new Date().toISOString() } : i));
      })
      .catch(() => {});
  }

  async function saveAttempt(status?: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (status) body.status = status;
      if (adminNotes !== (selected.adminNotes || "")) body.adminNotes = adminNotes;
      const updated = await api.patch<SignupAttempt>(`/admin/tenants/signup-attempts/${selected.id}`, body);
      setSelected(updated);
      setItems((prev) => prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
    } catch {}
    finally { setSaving(false); }
  }

  const totalPages = Math.ceil(total / 20);
  const statuses = [
    { value: "ALL", label: "Todos" },
    { value: "PENDING", label: "Pendentes" },
    { value: "REVIEWED", label: "Revisados" },
    { value: "DISMISSED", label: "Descartados" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tentativas de Cadastro</h1>
        <p className="text-sm text-slate-500">Tentativas rejeitadas e feedback dos usuarios</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {statuses.map((s) => (
          <button key={s.value} onClick={() => { setStatusFilter(s.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{total} resultado{total !== 1 ? "s" : ""}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">Nenhuma tentativa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((attempt) => (
            <button key={attempt.id} onClick={() => openDetail(attempt)}
              className={`w-full text-left rounded-xl border p-4 transition-colors hover:bg-slate-50 ${
                !attempt.readAt ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-white"
              }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!attempt.readAt && <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {attempt.companyName || attempt.slug || "Sem nome"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      attempt.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                      attempt.status === "REVIEWED" ? "bg-green-100 text-green-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {attempt.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STEP_COLORS[attempt.lastStep] || "bg-slate-100 text-slate-500"}`}>
                      {attempt.completedAt ? "Concluido" : `Step ${attempt.lastStep} — ${STEP_NAMES[attempt.lastStep] || "?"}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {attempt.cnpj && <span className="text-xs text-slate-500">{attempt.cnpj}</span>}
                    {attempt.responsibleName && <span className="text-xs text-slate-400">{attempt.responsibleName}</span>}
                    {attempt.planName && <span className="text-xs text-slate-400">{attempt.planName}</span>}
                  </div>
                  {attempt.lastError && !attempt.completedAt && (
                    <p className="text-[10px] text-red-500 mt-1 truncate max-w-md">Erro: {attempt.lastError}</p>
                  )}
                  {attempt.rejectionReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {attempt.rejectionReasons.slice(0, 3).map((r, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-[10px]">{r}</span>
                      ))}
                      {attempt.rejectionReasons.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{attempt.rejectionReasons.length - 3}</span>
                      )}
                    </div>
                  )}
                  {attempt.criticism && (
                    <p className="text-xs text-slate-500 mt-1 truncate max-w-md italic">"{attempt.criticism}"</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0 ml-3">{timeAgo(attempt.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-600 disabled:opacity-40">Anterior</button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-600 disabled:opacity-40">Proximo</button>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.companyName || selected.slug || "Tentativa"}</h2>
                <p className="text-xs text-slate-400">{new Date(selected.createdAt).toLocaleString("pt-BR")}</p>
              </div>
              <button onClick={() => setSelected(null)} className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  selected.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                  selected.status === "REVIEWED" ? "bg-green-100 text-green-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {selected.status}
                </span>
                {selected.status !== "REVIEWED" && (
                  <button onClick={() => saveAttempt("REVIEWED")} disabled={saving}
                    className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                    Marcar como revisado
                  </button>
                )}
                {selected.status !== "DISMISSED" && (
                  <button onClick={() => saveAttempt("DISMISSED")} disabled={saving}
                    className="px-3 py-1 rounded-lg bg-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-300 disabled:opacity-50">
                    Descartar
                  </button>
                )}
              </div>

              {/* Progress / Step tracking */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-2">Progresso do Cadastro</span>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        selected.completedAt && s <= 5 ? "bg-green-500 text-white" :
                        s < selected.lastStep ? "bg-blue-500 text-white" :
                        s === selected.lastStep ? (selected.lastError && !selected.completedAt ? "bg-red-500 text-white" : "bg-blue-500 text-white") :
                        "bg-slate-200 text-slate-400"
                      }`}>
                        {selected.completedAt && s <= 5 ? "✓" : s}
                      </div>
                      {s < 5 && <div className={`h-0.5 w-6 ${
                        selected.completedAt ? "bg-green-400" :
                        s < selected.lastStep ? "bg-blue-400" : "bg-slate-200"
                      }`} />}
                    </div>
                  ))}
                  <span className="ml-3 text-xs text-slate-600 font-medium">
                    {selected.completedAt ? "Cadastro concluído" : `Parou em: ${STEP_NAMES[selected.lastStep] || "?"} (Step ${selected.lastStep})`}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-center" style={{ minWidth: 32 }}>{STEP_NAMES[s]}</span>
                  ))}
                </div>
                {selected.lastError && !selected.completedAt && (
                  <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <span className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Erro no Step {selected.lastStep}</span>
                    <p className="text-xs text-red-700 mt-0.5">{selected.lastError}</p>
                  </div>
                )}
                {selected.completedAt && (
                  <p className="text-xs text-green-600 mt-1">Concluído em {new Date(selected.completedAt).toLocaleString("pt-BR")}</p>
                )}
              </div>

              {/* Company info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Empresa</span>
                  <p className="text-sm text-slate-900">{selected.companyName || "-"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">CNPJ</span>
                  <p className="text-sm text-slate-900">{selected.cnpj || "-"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Subdominio</span>
                  <p className="text-sm text-slate-900">{selected.slug ? `${selected.slug}.tecnikos.com.br` : "-"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Plano</span>
                  <p className="text-sm text-slate-900">{selected.planName || "-"} {selected.billingCycle ? `(${selected.billingCycle})` : ""}</p>
                </div>
              </div>

              {/* Responsible */}
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-2">Responsavel</span>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-xs text-slate-400">Nome</span><p className="text-slate-900">{selected.responsibleName || "-"}</p></div>
                  <div><span className="text-xs text-slate-400">Email</span><p className="text-slate-900">{selected.responsibleEmail || "-"}</p></div>
                  <div><span className="text-xs text-slate-400">Telefone</span><p className="text-slate-900">{selected.responsiblePhone || "-"}</p></div>
                </div>
              </div>

              {/* Rejection reasons */}
              {selected.rejectionReasons.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-2">Motivos da Rejeicao</span>
                  <div className="space-y-1">
                    {selected.rejectionReasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="mt-0.5 text-red-400">•</span> {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Criticism */}
              {selected.criticism && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <span className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold block mb-1">Mensagem do Usuario</span>
                  <p className="text-sm text-amber-900 italic">"{selected.criticism}"</p>
                </div>
              )}

              {/* CNPJ Data */}
              {selected.cnpjData && (
                <details className="group">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-400 font-semibold hover:text-slate-600">
                    Dados CNPJ (expandir)
                  </summary>
                  <pre className="mt-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700 overflow-x-auto max-h-48">
                    {JSON.stringify(selected.cnpjData, null, 2)}
                  </pre>
                </details>
              )}

              {/* Verification Result */}
              {selected.verificationResult && (
                <details className="group">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-400 font-semibold hover:text-slate-600">
                    Resultado da Verificacao (expandir)
                  </summary>
                  <pre className="mt-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700 overflow-x-auto max-h-48">
                    {JSON.stringify(selected.verificationResult, null, 2)}
                  </pre>
                </details>
              )}

              {/* IP / User Agent */}
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                <div>IP: {selected.ipAddress || "-"}</div>
                <div className="truncate" title={selected.userAgent || ""}>UA: {selected.userAgent || "-"}</div>
              </div>

              {/* Admin Notes */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">Notas do Admin</span>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione notas internas sobre esta tentativa..."
                />
                <button onClick={() => saveAttempt()} disabled={saving || adminNotes === (selected.adminNotes || "")}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar notas"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
