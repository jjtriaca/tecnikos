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
  pendingAttempts: number;
  planDistribution: { id: string; name: string; priceCents: number; tenantCount: number }[];
  mrrCents: number;
}

interface SaasAnalytics {
  period: number;
  landingViews: number;
  signupStarts: number;
  signupStep2: number;
  signupStep3: number;
  signupStep4: number;
  signupComplete: number;
  signupRejected: number;
  clickSignup: number;
  clickPlan: number;
  uniqueVisitors: number;
  conversionRate: number;
  dailyViews: { date: string; count: number }[];
  topReasons: { reason: string; count: number }[];
  devices: { Desktop: number; Mobile: number; Tablet: number };
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function SaasDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [analytics, setAnalytics] = useState<SaasAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) {
      router.replace("/dashboard");
      return;
    }
    Promise.all([
      api.get<SaasMetrics>("/admin/tenants/metrics/overview"),
      api.get<SaasAnalytics>("/admin/tenants/analytics/overview?days=30"),
    ])
      .then(([m, a]) => { setMetrics(m); setAnalytics(a); })
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
        <p className="text-sm text-slate-500">Nao foi possivel carregar metricas.</p>
      </div>
    );
  }

  const kpis = [
    { label: "Total Empresas", value: metrics.totalTenants, color: "bg-blue-500" },
    { label: "Ativas", value: metrics.activeTenants, color: "bg-green-500" },
    { label: "Bloqueadas", value: metrics.blockedTenants, color: "bg-red-500" },
    { label: "Canceladas", value: metrics.cancelledTenants, color: "bg-slate-400" },
  ];

  // Funnel data
  const funnelSteps = analytics ? [
    { label: "Visitantes", value: analytics.landingViews, color: "bg-slate-500" },
    { label: "Clique Signup", value: analytics.clickSignup + analytics.clickPlan, color: "bg-blue-400" },
    { label: "Plano", value: analytics.signupStarts, color: "bg-blue-500" },
    { label: "Empresa", value: analytics.signupStep2, color: "bg-blue-600" },
    { label: "Verificacao", value: analytics.signupStep3, color: "bg-indigo-500" },
    { label: "Pagamento", value: analytics.signupStep4, color: "bg-indigo-600" },
    { label: "Concluido", value: analytics.signupComplete, color: "bg-green-500" },
  ] : [];
  const funnelMax = funnelSteps.length > 0 ? Math.max(...funnelSteps.map((s) => s.value), 1) : 1;

  // Daily views chart
  const dailyMax = analytics?.dailyViews?.length ? Math.max(...analytics.dailyViews.map((d) => d.count), 1) : 1;

  // Device totals
  const deviceTotal = analytics ? (analytics.devices.Desktop + analytics.devices.Mobile + analytics.devices.Tablet) || 1 : 1;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Painel SaaS</h1>
        <p className="text-sm text-slate-500">Visao geral de todas as empresas e planos</p>
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

      {/* MRR + Pending */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-sm font-medium text-blue-700">MRR</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-blue-900">{formatBRL(metrics.mrrCents)}</p>
        </div>

        {metrics.pendingAttempts > 0 && (
          <button onClick={() => router.push("/ctrl-zr8k2x/signup-attempts")}
            className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 text-left hover:shadow-md transition-all">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <span className="text-sm font-medium text-amber-700">Tentativas Pendentes</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-amber-900">{metrics.pendingAttempts}</p>
            <p className="text-xs text-amber-600 mt-1">Clique para revisar</p>
          </button>
        )}
      </div>

      {/* Analytics Section */}
      {analytics && (
        <>
          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Analytics (ultimos {analytics.period} dias)</h2>
            <p className="text-xs text-slate-400 mb-4">Dados de visitantes, signup e conversao</p>
          </div>

          {/* Analytics KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs text-slate-500">Visitantes</span>
              <p className="text-2xl font-bold text-slate-900">{analytics.uniqueVisitors}</p>
              <p className="text-[10px] text-slate-400">{analytics.landingViews} pageviews</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs text-slate-500">Signups Iniciados</span>
              <p className="text-2xl font-bold text-slate-900">{analytics.signupStarts}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs text-slate-500">Conversoes</span>
              <p className="text-2xl font-bold text-green-600">{analytics.signupComplete}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs text-slate-500">Taxa de Conversao</span>
              <p className="text-2xl font-bold text-blue-600">{analytics.conversionRate}%</p>
            </div>
          </div>

          {/* Funnel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Funil de Conversao</h3>
            <div className="space-y-2">
              {funnelSteps.map((step, i) => {
                const pct = (step.value / funnelMax) * 100;
                const dropoff = i > 0 && funnelSteps[i - 1].value > 0
                  ? Math.round((1 - step.value / funnelSteps[i - 1].value) * 100)
                  : 0;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-24 text-right flex-shrink-0">{step.label}</span>
                    <div className="flex-1 h-6 bg-slate-50 rounded overflow-hidden relative">
                      <div className={`h-full ${step.color} rounded transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-10 text-right">{step.value}</span>
                    {i > 0 && dropoff > 0 && (
                      <span className="text-[10px] text-red-400 w-12">-{dropoff}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Views Chart + Devices + Rejections */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Daily Views */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Visitas por Dia</h3>
              {analytics.dailyViews.length === 0 ? (
                <p className="text-xs text-slate-400">Sem dados no periodo.</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {analytics.dailyViews.map((d) => {
                    const h = (d.count / dailyMax) * 100;
                    const dateStr = new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${dateStr}: ${d.count}`}>
                        <span className="text-[9px] text-slate-400">{d.count}</span>
                        <div className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                          style={{ height: `${Math.max(h, 3)}%` }} />
                        <span className="text-[8px] text-slate-400 rotate-[-45deg] origin-top-left whitespace-nowrap">{dateStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Devices + Top Rejections */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Dispositivos</h3>
                {[
                  { label: "Desktop", value: analytics.devices.Desktop, color: "bg-blue-500" },
                  { label: "Mobile", value: analytics.devices.Mobile, color: "bg-green-500" },
                  { label: "Tablet", value: analytics.devices.Tablet, color: "bg-amber-500" },
                ].map((d) => (
                  <div key={d.label} className="flex items-center gap-2 mb-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${d.color}`} />
                    <span className="text-xs text-slate-600 flex-1">{d.label}</span>
                    <span className="text-xs font-bold text-slate-700">{d.value}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-right">{Math.round((d.value / deviceTotal) * 100)}%</span>
                  </div>
                ))}
              </div>

              {analytics.topReasons.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Rejeicoes</h3>
                  {analytics.topReasons.map((r) => (
                    <div key={r.reason} className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-600 truncate flex-1 mr-2">{r.reason}</span>
                      <span className="text-xs font-bold text-red-600">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Extra stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <span className="text-xs text-slate-500">Rejeitados</span>
              <p className="text-xl font-bold text-red-500">{analytics.signupRejected}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <span className="text-xs text-slate-500">Cliques em Planos</span>
              <p className="text-xl font-bold text-slate-900">{analytics.clickPlan}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <span className="text-xs text-slate-500">Cliques CTA</span>
              <p className="text-xl font-bold text-slate-900">{analytics.clickSignup}</p>
            </div>
          </div>
        </>
      )}

      {/* Plan Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Distribuicao por Plano</h2>
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
                      {plan.tenantCount} empresa{plan.tenantCount !== 1 ? "s" : ""} · {formatBRL(plan.priceCents)}/mes
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <button onClick={() => router.push("/ctrl-zr8k2x/tenants")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
          <div className="text-sm font-semibold text-slate-700">Gerenciar Empresas</div>
          <p className="mt-1 text-xs text-slate-400">Ver, ativar, bloquear empresas</p>
        </button>
        <button onClick={() => router.push("/ctrl-zr8k2x/plans")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
          <div className="text-sm font-semibold text-slate-700">Gerenciar Planos</div>
          <p className="mt-1 text-xs text-slate-400">Criar e editar planos</p>
        </button>
        <button onClick={() => router.push("/ctrl-zr8k2x/promotions")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
          <div className="text-sm font-semibold text-slate-700">Promocoes</div>
          <p className="mt-1 text-xs text-slate-400">Configurar descontos e codigos</p>
        </button>
        <button onClick={() => router.push("/ctrl-zr8k2x/signup-attempts")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
          <div className="text-sm font-semibold text-slate-700">Tentativas de Cadastro</div>
          <p className="mt-1 text-xs text-slate-400">Revisar rejeicoes e feedback</p>
        </button>
      </div>
    </div>
  );
}
