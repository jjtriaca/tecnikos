"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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

const STATUS_MAP: Record<TenantStatus, { label: string; color: string }> = {
  PENDING_VERIFICATION: { label: "Verificação", color: "bg-yellow-100 text-yellow-700" },
  PENDING_PAYMENT: { label: "Pagamento", color: "bg-orange-100 text-orange-700" },
  ACTIVE: { label: "Ativo", color: "bg-green-100 text-green-700" },
  BLOCKED: { label: "Bloqueado", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelado", color: "bg-slate-100 text-slate-500" },
  SUSPENDED: { label: "Suspenso", color: "bg-purple-100 text-purple-700" },
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

  const filtered = filter === "ALL" ? tenants : tenants.filter((t) => t.status === filter);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500">{tenants.length} empresa{tenants.length !== 1 ? "s" : ""} cadastrada{tenants.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nova Empresa
        </button>
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
    </div>
  );
}
