"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface SaasMetrics {
  totalTenants: number;
  activeTenants: number;
  blockedTenants: number;
  cancelledTenants: number;
  planDistribution: { id: string; name: string; priceCents: number; tenantCount: number }[];
  mrrCents: number;
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function SaasDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) {
      router.replace("/dashboard");
      return;
    }
    api.get<SaasMetrics>("/admin/tenants/metrics/overview")
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Não foi possível carregar métricas.</p>
      </div>
    );
  }

  const kpis = [
    { label: "Total Empresas", value: metrics.totalTenants, color: "bg-blue-500" },
    { label: "Ativas", value: metrics.activeTenants, color: "bg-green-500" },
    { label: "Bloqueadas", value: metrics.blockedTenants, color: "bg-red-500" },
    { label: "Canceladas", value: metrics.cancelledTenants, color: "bg-slate-400" },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Painel SaaS</h1>
        <p className="text-sm text-slate-500">Visão geral de todas as empresas e planos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${kpi.color}`} />
              <span className="text-xs text-slate-500">{kpi.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* MRR Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-sm font-medium text-blue-700">Receita Mensal Recorrente (MRR)</span>
        </div>
        <p className="mt-2 text-3xl font-bold text-blue-900">{formatBRL(metrics.mrrCents)}</p>
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Distribuição por Plano</h2>
        {metrics.planDistribution.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum plano cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {metrics.planDistribution.map((plan) => {
              const pct = metrics.totalTenants > 0 ? (plan.tenantCount / metrics.totalTenants) * 100 : 0;
              return (
                <div key={plan.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{plan.name}</span>
                    <span className="text-slate-500">
                      {plan.tenantCount} empresa{plan.tenantCount !== 1 ? "s" : ""} · {formatBRL(plan.priceCents)}/mês
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          onClick={() => router.push("/saas/tenants")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="text-sm font-semibold text-slate-700">Gerenciar Empresas</div>
          <p className="mt-1 text-xs text-slate-400">Ver, ativar, bloquear empresas</p>
        </button>
        <button
          onClick={() => router.push("/saas/plans")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="text-sm font-semibold text-slate-700">Gerenciar Planos</div>
          <p className="mt-1 text-xs text-slate-400">Criar e editar planos</p>
        </button>
        <button
          onClick={() => router.push("/saas/promotions")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="text-sm font-semibold text-slate-700">Promoções</div>
          <p className="mt-1 text-xs text-slate-400">Configurar descontos e códigos</p>
        </button>
      </div>
    </div>
  );
}
