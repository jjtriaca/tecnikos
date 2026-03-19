"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  name: string;
  maxUsers: number;
  maxOsPerMonth: number;
  priceCents: number;
  priceYearlyCents: number | null;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  description: string | null;
  maxTechnicians: number;
  maxAiMessages: number;
  maxNfseImports: number;
  supportLevel: string;
  allModulesIncluded: boolean;
  tenantCount?: number;
}

const SUPPORT_LEVELS = [
  { value: "EMAIL", label: "E-mail" },
  { value: "EMAIL_CHAT", label: "E-mail + Chat" },
  { value: "PRIORITY", label: "Prioritário" },
];

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function centsToDisplay(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function displayToCents(display: string): number {
  if (!display) return 0;
  const clean = display.replace(/[^\d,]/g, "").replace(",", ".");
  return Math.round(parseFloat(clean || "0") * 100);
}

function supportLabel(level: string) {
  return SUPPORT_LEVELS.find(s => s.value === level)?.label || level;
}

export default function PlansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", maxUsers: 5, maxOsPerMonth: 100,
    priceDisplay: "", priceYearlyDisplay: "",
    features: "", description: "", sortOrder: 0,
    maxTechnicians: 0, maxAiMessages: 0, maxNfseImports: 0,
    supportLevel: "EMAIL", allModulesIncluded: true,
  });
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      const data = await api.get<Plan[]>("/admin/tenants/plans/list");
      setPlans(data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) { router.replace("/dashboard"); return; }
    loadPlans();
  }, [user, router, loadPlans]);

  function openCreate() {
    setEditingId(null);
    setForm({
      name: "", maxUsers: 5, maxOsPerMonth: 100,
      priceDisplay: "", priceYearlyDisplay: "",
      features: "", description: "", sortOrder: 0,
      maxTechnicians: 0, maxAiMessages: 0, maxNfseImports: 0,
      supportLevel: "EMAIL", allModulesIncluded: true,
    });
    setError(null);
    setShowForm(true);
  }

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      maxUsers: plan.maxUsers,
      maxOsPerMonth: plan.maxOsPerMonth,
      priceDisplay: centsToDisplay(plan.priceCents),
      priceYearlyDisplay: centsToDisplay(plan.priceYearlyCents || 0),
      features: (plan.features || []).join("\n"),
      description: plan.description || "",
      sortOrder: plan.sortOrder,
      maxTechnicians: plan.maxTechnicians ?? 0,
      maxAiMessages: plan.maxAiMessages ?? 0,
      maxNfseImports: plan.maxNfseImports ?? 0,
      supportLevel: plan.supportLevel || "EMAIL",
      allModulesIncluded: plan.allModulesIncluded ?? true,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const priceCents = displayToCents(form.priceDisplay);
      const priceYearlyCents = displayToCents(form.priceYearlyDisplay);
      const { priceDisplay, priceYearlyDisplay, ...rest } = form;
      const payload = {
        ...rest,
        priceCents,
        priceYearlyCents: priceYearlyCents || undefined,
        features: form.features.split("\n").map(f => f.trim()).filter(Boolean),
      };
      if (editingId) {
        await api.put(`/admin/tenants/plans/${editingId}`, payload);
      } else {
        await api.post("/admin/tenants/plans", payload);
      }
      setShowForm(false);
      await loadPlans();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar plano");
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Desativar este plano?")) return;
    await api.del(`/admin/tenants/plans/${id}`);
    await loadPlans();
  }

  async function handleReactivate(id: string) {
    await api.put(`/admin/tenants/plans/${id}`, { isActive: true });
    await loadPlans();
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Planos</h1>
          <p className="text-sm text-slate-500">Configure os planos disponíveis para contratação</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novo Plano
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-400">Nenhum plano cadastrado.</p>
          <button onClick={openCreate} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Criar primeiro plano
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 transition-colors ${
                plan.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{plan.name}</h3>
                  {plan.description && <p className="mt-0.5 text-xs text-slate-500">{plan.description}</p>}
                  {(plan.tenantCount ?? 0) > 0 && (
                    <p className="mt-0.5 text-[10px] text-blue-600 font-medium">{plan.tenantCount} tenant{plan.tenantCount !== 1 ? "s" : ""} usando</p>
                  )}
                </div>
                {!plan.isActive && (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">INATIVO</span>
                )}
              </div>

              <div className="mt-4">
                <div className="text-3xl font-bold text-slate-900">
                  {formatBRL(plan.priceCents)}
                  <span className="text-sm font-normal text-slate-400">/mês</span>
                </div>
                {plan.priceYearlyCents && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    ou {formatBRL(plan.priceYearlyCents)}/ano ({formatBRL(plan.priceYearlyCents / 12)}/mês)
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <FeatureRow label={`Até ${plan.maxUsers} usuário${plan.maxUsers !== 1 ? "s" : ""}`} />
                <FeatureRow label={plan.maxOsPerMonth === 0 ? "OS ilimitadas" : `${plan.maxOsPerMonth} OS/mês`} />
                <FeatureRow label={plan.maxTechnicians === 0 ? "Técnicos ilimitados" : `${plan.maxTechnicians} técnico${plan.maxTechnicians !== 1 ? "s" : ""}`} />
                <FeatureRow label={plan.maxAiMessages === 0 ? "Mensagens IA ilimitadas" : `${plan.maxAiMessages} msgs IA/mês`} />
                <FeatureRow label={`Suporte: ${supportLabel(plan.supportLevel)}`} />
                <FeatureRow label={plan.allModulesIncluded ? "Todos os módulos" : "Módulos básicos"} />
              </div>

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => openEdit(plan)}
                  className="flex-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Editar
                </button>
                {plan.isActive ? (
                  <button
                    onClick={() => handleDeactivate(plan.id)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Desativar
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(plan.id)}
                    className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-100"
                  >
                    Reativar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-ons gerenciados em /ctrl-zr8k2x/addons */}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar Plano" : "Novo Plano"}</h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Nome *</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Profissional"
                  required
                />
              </div>

              {/* Preços */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Preço mensal (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.priceDisplay}
                    onChange={(e) => setForm({ ...form, priceDisplay: e.target.value.replace(/[^\d,]/g, "") })}
                    placeholder="99,00"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Preço anual (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.priceYearlyDisplay}
                    onChange={(e) => setForm({ ...form, priceYearlyDisplay: e.target.value.replace(/[^\d,]/g, "") })}
                    placeholder="999,00"
                  />
                </div>
              </div>

              {/* Limites */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Limites do Plano</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Máx. Usuários *</label>
                    <input
                      type="number"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      value={form.maxUsers}
                      onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 1 })}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Máx. OS/mês (0=ilimitado)</label>
                    <input
                      type="number"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      value={form.maxOsPerMonth}
                      onChange={(e) => setForm({ ...form, maxOsPerMonth: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Máx. Técnicos (0=ilimitado)</label>
                    <input
                      type="number"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      value={form.maxTechnicians}
                      onChange={(e) => setForm({ ...form, maxTechnicians: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Msgs IA/mês (0=ilimitado)</label>
                    <input
                      type="number"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      value={form.maxAiMessages}
                      onChange={(e) => setForm({ ...form, maxAiMessages: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Features do plano */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Features</h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nível de Suporte</label>
                  <select
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                    value={form.supportLevel}
                    onChange={(e) => setForm({ ...form, supportLevel: e.target.value })}
                  >
                    {SUPPORT_LEVELS.map(sl => (
                      <option key={sl.value} value={sl.value}>{sl.label}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allModulesIncluded}
                    onChange={(e) => setForm({ ...form, allModulesIncluded: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Todos os módulos inclusos</span>
                </label>
              </div>

              {/* Descrição e features texto livre (landing page) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição para landing page"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Features extras (landing page, uma por linha)</label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  rows={2}
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  placeholder={"Relatórios avançados\nIntegração WhatsApp"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Ordem de exibição</label>
                <input
                  type="number"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {editingId ? "Salvar" : "Criar Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg className="h-4 w-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      {label}
    </div>
  );
}
