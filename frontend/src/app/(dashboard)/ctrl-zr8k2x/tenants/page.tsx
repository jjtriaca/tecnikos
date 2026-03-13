"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

type TenantStatus = "PENDING_VERIFICATION" | "PENDING_PAYMENT" | "ACTIVE" | "BLOCKED" | "CANCELLED" | "SUSPENDED";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  schemaName: string;
  cnpj: string | null;
  status: TenantStatus;
  isMaster: boolean;
  maxUsers: number;
  maxOsPerMonth: number;
  responsibleName: string | null;
  responsibleEmail: string | null;
  plan: { id: string; name: string; priceCents: number } | null;
  blockedAt: string | null;
  blockReason: string | null;
  createdAt: string;
}

interface VerificationData {
  sessionId: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    cnpj: string | null;
    responsibleName: string | null;
    responsibleEmail: string | null;
    responsiblePhone: string | null;
    plan: { name: string } | null;
  };
  cnpjCardUrl: string | null;
  docFrontUrl: string | null;
  docBackUrl: string | null;
  selfieCloseUrl: string | null;
  selfieMediumUrl: string | null;
  uploadedCount: number;
  uploadComplete: boolean;
  reviewStatus: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  expiresAt: string;
}

const STATUS_MAP: Record<TenantStatus, { label: string; color: string }> = {
  PENDING_VERIFICATION: { label: "Verificação", color: "bg-yellow-100 text-yellow-700" },
  PENDING_PAYMENT: { label: "Pagamento", color: "bg-orange-100 text-orange-700" },
  ACTIVE: { label: "Ativo", color: "bg-green-100 text-green-700" },
  BLOCKED: { label: "Bloqueado", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelado", color: "bg-slate-100 text-slate-500" },
  SUSPENDED: { label: "Suspenso", color: "bg-purple-100 text-purple-700" },
};

const DOC_LABELS: Record<string, string> = {
  cnpjCardUrl: "Cartao CNPJ",
  docFrontUrl: "Documento (Frente)",
  docBackUrl: "Documento (Verso)",
  selfieCloseUrl: "Selfie 1",
  selfieMediumUrl: "Selfie 2",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TenantsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TenantStatus | "ALL">("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal state for creating tenant
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ slug: "", name: "", cnpj: "", responsibleName: "", responsibleEmail: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  // Verification review modal
  const [verifyModal, setVerifyModal] = useState<{ tenantId: string } | null>(null);
  const [verifyData, setVerifyData] = useState<VerificationData | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyAction, setVerifyAction] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Fullscreen image viewer
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  // Pending verification count
  const pendingCount = tenants.filter((t) => t.status === "PENDING_VERIFICATION").length;

  const loadTenants = useCallback(async () => {
    try {
      const params = filter !== "ALL" ? `?status=${filter}` : "";
      const data = await api.get<Tenant[]>(`/admin/tenants${params}`);
      setTenants(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) { router.replace("/dashboard"); return; }
    loadTenants();
  }, [user, router, loadTenants]);

  // Load verification data when modal opens
  useEffect(() => {
    if (!verifyModal) { setVerifyData(null); return; }
    setVerifyLoading(true);
    setShowRejectForm(false);
    setRejectReason("");
    api.get<VerificationData>(`/admin/tenants/${verifyModal.tenantId}/verification`)
      .then((data) => setVerifyData(data))
      .catch(() => setVerifyData(null))
      .finally(() => setVerifyLoading(false));
  }, [verifyModal]);

  async function handleAction(id: string, action: string, body?: Record<string, string>) {
    setActionLoading(id);
    try {
      await api.patch(`/admin/tenants/${id}/${action}`, body);
      await loadTenants();
    } catch (err: any) {
      alert(err.message || "Erro ao executar ação");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await api.post("/admin/tenants", createForm);
      setShowCreate(false);
      setCreateForm({ slug: "", name: "", cnpj: "", responsibleName: "", responsibleEmail: "" });
      await loadTenants();
    } catch (err: any) {
      setCreateError(err.message || "Erro ao criar tenant");
    }
  }

  async function handleApprove() {
    if (!verifyModal) return;
    setVerifyAction(true);
    try {
      await api.post(`/admin/tenants/${verifyModal.tenantId}/approve-verification`, { reviewedBy: "Juliano" });
      setVerifyModal(null);
      await loadTenants();
    } catch (err: any) {
      alert(err.message || "Erro ao aprovar");
    } finally {
      setVerifyAction(false);
    }
  }

  async function handleReject() {
    if (!verifyModal || !rejectReason.trim()) return;
    setVerifyAction(true);
    try {
      await api.post(`/admin/tenants/${verifyModal.tenantId}/reject-verification`, {
        reason: rejectReason.trim(),
        reviewedBy: "Juliano",
      });
      setVerifyModal(null);
      await loadTenants();
    } catch (err: any) {
      alert(err.message || "Erro ao rejeitar");
    } finally {
      setVerifyAction(false);
    }
  }

  function getDocUrl(url: string | null) {
    if (!url) return null;
    // URLs are relative paths like /uploads/verification/...
    return `/api${url.startsWith("/") ? "" : "/"}${url}`;
  }

  function isPdf(url: string | null) {
    return url?.toLowerCase().endsWith(".pdf");
  }

  const filtered = filter === "ALL" ? tenants : tenants.filter((t) => t.status === filter);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500">{tenants.length} empresa{tenants.length !== 1 ? "s" : ""} cadastrada{tenants.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button
              onClick={() => setFilter("PENDING_VERIFICATION")}
              className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Nova Empresa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", "ACTIVE", "PENDING_VERIFICATION", "PENDING_PAYMENT", "BLOCKED", "SUSPENDED", "CANCELLED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "ALL" ? "Todos" : STATUS_MAP[s].label}
            {s === "PENDING_VERIFICATION" && pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-400 text-white w-4 h-4 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
          Nenhuma empresa encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Empresa</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Subdomínio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Plano</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Responsável</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Desde</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {t.name}
                      {t.isMaster && (
                        <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                          MASTER
                        </span>
                      )}
                    </div>
                    {t.cnpj && <div className="text-xs text-slate-400">{t.cnpj}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs text-blue-600">{t.slug}.tecnikos.com.br</code>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.plan ? (
                      <div>
                        <span className="font-medium">{t.plan.name}</span>
                        <span className="ml-1 text-xs text-slate-400">{formatBRL(t.plan.priceCents)}/mês</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_MAP[t.status].color}`}>
                      {STATUS_MAP[t.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.responsibleName || "—"}
                    {t.responsibleEmail && <div className="text-xs text-slate-400">{t.responsibleEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Issue invoice button - only for ACTIVE tenants */}
                      {t.status === "ACTIVE" && (
                        <button
                          onClick={() => router.push(`/ctrl-zr8k2x/invoices?tenantId=${t.id}`)}
                          className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          title="Emitir Nota Fiscal"
                        >
                          Emitir NF
                        </button>
                      )}
                      {/* Verification review button — always visible (admin can review docs at any time) */}
                      {t.status !== "CANCELLED" && !t.isMaster && (
                        <button
                          onClick={() => setVerifyModal({ tenantId: t.id })}
                          className={`rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 border ${
                            t.status === "PENDING_VERIFICATION"
                              ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                          }`}
                        >
                          {t.status === "PENDING_VERIFICATION" ? "Verificar Docs" : "Ver Docs"}
                        </button>
                      )}
                      {t.status !== "ACTIVE" && t.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleAction(t.id, "activate")}
                          disabled={actionLoading === t.id}
                          className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          Ativar
                        </button>
                      )}
                      {t.status === "ACTIVE" && !t.isMaster && (
                        <button
                          onClick={() => {
                            const reason = prompt("Motivo do bloqueio:");
                            if (reason) handleAction(t.id, "block", { reason });
                          }}
                          disabled={actionLoading === t.id}
                          className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Bloquear
                        </button>
                      )}
                      {t.status !== "CANCELLED" && !t.isMaster && (
                        <button
                          onClick={() => {
                            if (confirm(`Cancelar a empresa "${t.name}"? Isso desativará o acesso.`)) {
                              handleAction(t.id, "cancel");
                            }
                          }}
                          disabled={actionLoading === t.id}
                          className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Nova Empresa</h2>
            <p className="mb-4 text-xs text-slate-500">Provisionar uma nova empresa no sistema</p>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Subdomínio *</label>
                <div className="flex items-center">
                  <input
                    className="h-9 flex-1 rounded-l-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    placeholder="nome-empresa"
                    required
                  />
                  <span className="h-9 rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-2 text-xs text-slate-400 leading-9">
                    .tecnikos.com.br
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Nome da Empresa *</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Empresa LTDA"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">CNPJ</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={createForm.cnpj}
                  onChange={(e) => setCreateForm({ ...createForm, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Responsável</label>
                  <input
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={createForm.responsibleName}
                    onChange={(e) => setCreateForm({ ...createForm, responsibleName: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                  <input
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    type="email"
                    value={createForm.responsibleEmail}
                    onChange={(e) => setCreateForm({ ...createForm, responsibleEmail: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>
              </div>

              {createError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Criar e Provisionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Review Modal */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !verifyAction && setVerifyModal(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {verifyLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
              </div>
            ) : !verifyData ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">Nenhuma verificacao encontrada para este tenant.</p>
                <button onClick={() => setVerifyModal(null)} className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="border-b border-slate-200 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Verificacao de Documentos</h2>
                      <p className="text-sm text-slate-500 mt-1">{verifyData.tenant.name}</p>
                    </div>
                    <button onClick={() => !verifyAction && setVerifyModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Tenant info */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-slate-400">CNPJ</span>
                      <p className="font-medium text-slate-700">{verifyData.tenant.cnpj || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Responsavel</span>
                      <p className="font-medium text-slate-700">{verifyData.tenant.responsibleName || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Email</span>
                      <p className="font-medium text-slate-700">{verifyData.tenant.responsibleEmail || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Plano</span>
                      <p className="font-medium text-slate-700">{verifyData.tenant.plan?.name || "—"}</p>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className={`rounded-full px-2.5 py-1 font-medium ${
                      verifyData.reviewStatus === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                      verifyData.reviewStatus === "APPROVED" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {verifyData.reviewStatus === "PENDING" ? "Pendente" : verifyData.reviewStatus === "APPROVED" ? "Aprovado" : "Rejeitado"}
                    </span>
                    <span className="text-slate-400">
                      {verifyData.uploadedCount}/6 documentos enviados
                    </span>
                    <span className="text-slate-400">
                      Criado em {formatDateTime(verifyData.createdAt)}
                    </span>
                    <span className="text-slate-400">
                      Expira em {formatDateTime(verifyData.expiresAt)}
                    </span>
                  </div>
                </div>

                {/* Documents Grid */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Documentos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(["cnpjCardUrl", "docFrontUrl", "docBackUrl", "selfieCloseUrl", "selfieMediumUrl"] as const).map((key) => {
                      const url = verifyData[key];
                      const docUrl = getDocUrl(url);
                      const isDocPdf = isPdf(url);
                      return (
                        <div key={key} className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                            <span className="text-xs font-medium text-slate-600">{DOC_LABELS[key]}</span>
                          </div>
                          {docUrl ? (
                            <button
                              onClick={() => {
                                if (isDocPdf) {
                                  window.open(docUrl, "_blank");
                                } else {
                                  setFullscreenImg(docUrl);
                                }
                              }}
                              className="w-full aspect-[4/3] bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors relative group"
                            >
                              {isDocPdf ? (
                                <div className="flex flex-col items-center gap-2 text-slate-500">
                                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                  </svg>
                                  <span className="text-xs">PDF — Clique para abrir</span>
                                </div>
                              ) : (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={docUrl}
                                    alt={DOC_LABELS[key]}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                                    </svg>
                                  </div>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="w-full aspect-[4/3] bg-slate-50 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-1 text-slate-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                </svg>
                                <span className="text-xs">Nao enviado</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                {verifyData.reviewStatus === "PENDING" && (
                  <div className="border-t border-slate-200 p-6">
                    {!showRejectForm ? (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setShowRejectForm(true)}
                          disabled={verifyAction}
                          className="rounded-xl border border-red-200 bg-red-50 px-6 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          Rejeitar
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={verifyAction || !verifyData.uploadComplete}
                          className="rounded-xl bg-green-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {verifyAction ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                          Aprovar e Ativar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700">Motivo da rejeicao *</label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Descreva o motivo da rejeição. O responsável receberá este texto por email."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 resize-none h-20"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                            disabled={verifyAction}
                            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleReject}
                            disabled={verifyAction || !rejectReason.trim()}
                            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                          >
                            {verifyAction && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                            Confirmar Rejeicao
                          </button>
                        </div>
                      </div>
                    )}

                    {!verifyData.uploadComplete && (
                      <p className="mt-3 text-xs text-amber-600">
                        O responsavel ainda nao enviou todos os documentos ({verifyData.uploadedCount}/6).
                        Voce pode aprovar somente quando todos forem enviados.
                      </p>
                    )}
                  </div>
                )}

                {/* Already reviewed */}
                {verifyData.reviewStatus !== "PENDING" && (
                  <div className="border-t border-slate-200 p-6">
                    <div className={`rounded-xl p-4 ${verifyData.reviewStatus === "APPROVED" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                      <p className={`text-sm font-medium ${verifyData.reviewStatus === "APPROVED" ? "text-green-700" : "text-red-700"}`}>
                        {verifyData.reviewStatus === "APPROVED" ? "Aprovado" : "Rejeitado"}
                        {verifyData.reviewedBy && ` por ${verifyData.reviewedBy}`}
                        {verifyData.reviewedAt && ` em ${formatDateTime(verifyData.reviewedAt)}`}
                      </p>
                      {verifyData.rejectionReason && (
                        <p className="text-sm text-red-600 mt-1">Motivo: {verifyData.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 cursor-pointer"
          onClick={() => setFullscreenImg(null)}
        >
          <button
            onClick={() => setFullscreenImg(null)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenImg}
            alt="Documento"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
