"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface ForeignAccessEntry {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  isp: string;
  accessCount: number;
  events: string[];
  lastSeen: string;
}

interface Access24h {
  period: string;
  totalEvents: number;
  externalEvents: number;
  internalEvents: number;
  uniqueIps: number;
  externalUniqueIps: number;
  uniqueSessions: number;
  foreignAccess: ForeignAccessEntry[];
  foreignCount: number;
  brazilAccess: ForeignAccessEntry[];
  brazilCount: number;
  hasForeignAccess: boolean;
}

interface SaasMetrics {
  totalTenants: number;
  activeTenants: number;
  blockedTenants: number;
  cancelledTenants: number;
  pendingAttempts: number;
  planDistribution: { id: string; name: string; priceCents: number; tenantCount: number }[];
  mrrCents: number;
}

interface IpEntry {
  ip: string;
  count: number;
  isInternal: boolean;
  lastUa: string;
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
  // New fields
  internalPageviews: number;
  externalPageviews: number;
  internalSessions: number;
  externalSessions: number;
  externalConversion: number;
  uniqueIps: number;
  ipBreakdown: IpEntry[];
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// ─── Tooltip Component ──────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-flex ml-1" ref={ref}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold hover:bg-blue-200 hover:text-blue-700 transition-colors cursor-help"
        aria-label="Informacao"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-slate-800 text-white text-[11px] leading-relaxed p-3 shadow-xl pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-800" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function SaasDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [analytics, setAnalytics] = useState<SaasAnalytics | null>(null);
  const [access24h, setAccess24h] = useState<Access24h | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIps, setShowIps] = useState(false);
  const [showForeign, setShowForeign] = useState(false);
  const [showBrazil, setShowBrazil] = useState(false);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) {
      router.replace("/dashboard");
      return;
    }
    Promise.all([
      api.get<SaasMetrics>("/admin/tenants/metrics/overview"),
      api.get<SaasAnalytics>("/admin/tenants/analytics/overview?days=30"),
      api.get<Access24h>("/admin/tenants/analytics/access-24h"),
    ])
      .then(([m, a, acc]) => { setMetrics(m); setAnalytics(a); setAccess24h(acc); })
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
    { label: "Total Empresas", value: metrics.totalTenants, color: "bg-blue-500", tooltip: "Numero total de empresas cadastradas na plataforma (incluindo inativas e canceladas)" },
    { label: "Ativas", value: metrics.activeTenants, color: "bg-green-500", tooltip: "Empresas com acesso ativo ao sistema — estao usando o Tecnikos agora" },
    { label: "Bloqueadas", value: metrics.blockedTenants, color: "bg-red-500", tooltip: "Empresas bloqueadas pelo admin (ex: inadimplencia, uso indevido)" },
    { label: "Canceladas", value: metrics.cancelledTenants, color: "bg-slate-400", tooltip: "Empresas que cancelaram a assinatura ou foram canceladas" },
  ];

  // Funnel data
  const funnelSteps = analytics ? [
    { label: "Visitantes", value: analytics.externalPageviews || analytics.landingViews, color: "bg-slate-500", tooltip: "Pageviews reais na landing page (excluindo bots e acessos internos)" },
    { label: "Clique Signup", value: analytics.clickSignup + analytics.clickPlan, color: "bg-blue-400", tooltip: "Visitantes que clicaram em 'Comecar Agora' ou num plano especifico na landing" },
    { label: "Plano", value: analytics.signupStarts, color: "bg-blue-500", tooltip: "Tentativas unicas de cadastro iniciadas (SignupAttempt)" },
    { label: "Empresa", value: analytics.signupStep2, color: "bg-blue-600", tooltip: "Preencheram dados da empresa: CNPJ, nome, contato (Step 2)" },
    { label: "Verificacao", value: analytics.signupStep3, color: "bg-indigo-500", tooltip: "Enviaram documentos para verificacao de identidade (Step 3)" },
    { label: "Pagamento", value: analytics.signupStep4, color: "bg-indigo-600", tooltip: "Chegaram na etapa de pagamento ou usaram voucher (Step 4)" },
    { label: "Concluido", value: analytics.signupComplete, color: "bg-green-500", tooltip: "Empresas que completaram TODO o processo e foram ativadas (Tenant ACTIVE)" },
  ] : [];
  const funnelMax = funnelSteps.length > 0 ? Math.max(...funnelSteps.map((s) => s.value), 1) : 1;

  // Daily views chart
  const dailyMax = analytics?.dailyViews?.length ? Math.max(...analytics.dailyViews.map((d) => d.count), 1) : 1;

  // Device totals (external only)
  const deviceTotal = analytics ? (analytics.devices.Desktop + analytics.devices.Mobile + analytics.devices.Tablet) || 1 : 1;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Painel SaaS</h1>
        <p className="text-sm text-slate-500">Visao geral de todas as empresas e planos</p>
      </div>

      {/* ── Security: Access 24h + Foreign Alert ── */}
      {access24h && (
        <div className="space-y-4">
          {/* Access 24h summary + Foreign alert */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total accesses 24h */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs text-slate-500">Acessos 24h</span>
                <Tooltip text="Total de eventos registrados nas ultimas 24 horas (pageviews, cliques, signups). Inclui internos e externos." />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{access24h.externalEvents}</p>
              <p className="text-[10px] text-slate-400">{access24h.totalEvents} total ({access24h.internalEvents} internos)</p>
            </div>

            {/* Unique IPs 24h */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-xs text-slate-500">IPs Unicos 24h</span>
                <Tooltip text="Enderecos IP unicos que acessaram o sistema nas ultimas 24 horas (excluindo bots e servidor)." />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{access24h.externalUniqueIps}</p>
              <p className="text-[10px] text-slate-400">{access24h.uniqueSessions} sessoes</p>
            </div>

            {/* Brazil accesses */}
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">🇧🇷</span>
                <span className="text-xs text-green-700">Brasil</span>
                <Tooltip text="IPs unicos do Brasil que acessaram nas ultimas 24 horas. Estes sao os acessos esperados." />
              </div>
              <p className="mt-1 text-2xl font-bold text-green-700">{access24h.brazilCount}</p>
              <p className="text-[10px] text-green-600">IPs brasileiros</p>
            </div>

            {/* Foreign accesses */}
            <div className={`rounded-xl border p-4 ${
              access24h.hasForeignAccess
                ? "border-red-300 bg-red-50"
                : "border-green-200 bg-green-50/50"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{access24h.hasForeignAccess ? "⚠️" : "✅"}</span>
                <span className={`text-xs ${access24h.hasForeignAccess ? "text-red-700" : "text-green-700"}`}>
                  Fora do Brasil
                </span>
                <Tooltip text="IPs de fora do Brasil que acessaram nas ultimas 24 horas. Acessos internacionais podem indicar tentativas de invasao, scanners ou bots." />
              </div>
              <p className={`mt-1 text-2xl font-bold ${access24h.hasForeignAccess ? "text-red-700" : "text-green-700"}`}>
                {access24h.foreignCount}
              </p>
              <p className={`text-[10px] ${access24h.hasForeignAccess ? "text-red-600" : "text-green-600"}`}>
                {access24h.hasForeignAccess ? "IPs estrangeiros detectados" : "Nenhum acesso estrangeiro"}
              </p>
            </div>
          </div>

          {/* Foreign access alert banner */}
          {access24h.hasForeignAccess && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    Acessos de fora do Brasil nas ultimas 24h
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Foram detectados <strong>{access24h.foreignCount}</strong> IP(s) de fora do Brasil acessando o sistema.
                    Isso pode indicar scanners de vulnerabilidade, tentativas de invasao ou bots automatizados.
                    Os IPs estao bloqueados automaticamente pelo firewall (fail2ban) ao tentar acessar recursos suspeitos.
                  </p>

                  {/* Foreign IP table */}
                  <button
                    onClick={() => setShowForeign(!showForeign)}
                    className="mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline"
                  >
                    {showForeign ? "Ocultar detalhes" : `Ver ${access24h.foreignCount} IP(s) estrangeiro(s)`}
                  </button>

                  {showForeign && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-red-400">
                            <th className="pb-2 font-medium">IP</th>
                            <th className="pb-2 font-medium">Pais</th>
                            <th className="pb-2 font-medium">Cidade</th>
                            <th className="pb-2 font-medium">ISP</th>
                            <th className="pb-2 font-medium">Acessos</th>
                            <th className="pb-2 font-medium">Eventos</th>
                            <th className="pb-2 font-medium">Ultimo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {access24h.foreignAccess.map((f) => (
                            <tr key={f.ip} className="border-t border-red-100">
                              <td className="py-1.5 font-mono text-red-700">{f.ip}</td>
                              <td className="py-1.5 text-red-700">
                                <span className="font-medium">{f.countryCode}</span>
                                <span className="text-red-500 ml-1">{f.country}</span>
                              </td>
                              <td className="py-1.5 text-red-600">{f.city || "—"}{f.region ? `, ${f.region}` : ""}</td>
                              <td className="py-1.5 text-red-500 max-w-[150px] truncate" title={f.isp}>{f.isp || "—"}</td>
                              <td className="py-1.5 font-bold text-red-700">{f.accessCount}</td>
                              <td className="py-1.5 text-red-500">{f.events.join(", ")}</td>
                              <td className="py-1.5 text-red-500">{new Date(f.lastSeen).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Brazil IP details (collapsible) */}
          {access24h.brazilCount > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setShowBrazil(!showBrazil)}
                className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🇧🇷</span>
                  <h3 className="text-sm font-semibold text-slate-700">Acessos do Brasil (24h)</h3>
                  <span className="text-[10px] text-slate-400">Top 10 IPs</span>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showBrazil ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showBrazil && (
                <div className="border-t border-slate-100 p-5 pt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="pb-2 font-medium">IP</th>
                          <th className="pb-2 font-medium">Cidade</th>
                          <th className="pb-2 font-medium">Estado</th>
                          <th className="pb-2 font-medium">ISP</th>
                          <th className="pb-2 font-medium">Acessos</th>
                          <th className="pb-2 font-medium">Eventos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {access24h.brazilAccess.map((b) => (
                          <tr key={b.ip} className="border-t border-slate-50">
                            <td className="py-1.5 font-mono text-slate-600">{b.ip}</td>
                            <td className="py-1.5 text-slate-600">{b.city || "—"}</td>
                            <td className="py-1.5 text-slate-500">{b.region || "—"}</td>
                            <td className="py-1.5 text-slate-400 max-w-[150px] truncate" title={b.isp}>{b.isp || "—"}</td>
                            <td className="py-1.5 font-bold text-slate-700">{b.accessCount}</td>
                            <td className="py-1.5 text-slate-400">{b.events.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${kpi.color}`} />
              <span className="text-xs text-slate-500">{kpi.label}</span>
              <Tooltip text={kpi.tooltip} />
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
            <Tooltip text="Receita Recorrente Mensal: soma do valor mensal de todas as assinaturas ativas. Indica quanto o Tecnikos fatura por mes." />
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
              <Tooltip text="Tentativas de cadastro que ainda nao foram revisadas. Podem ser desistencias, erros ou tentativas incompletas." />
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
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Analytics (ultimos {analytics.period} dias)
              <Tooltip text="Todas as metricas abaixo sao dos ultimos 30 dias. Acessos de bots (Google, Bing, etc) e do servidor sao filtrados automaticamente." />
            </h2>
            <p className="text-xs text-slate-400 mb-4">Dados de visitantes, signup e conversao</p>
          </div>

          {/* Internal vs External Alert */}
          {analytics.internalPageviews > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Acessos internos detectados</p>
                  <p className="text-xs text-amber-700 mt-1">
                    De {analytics.landingViews} pageviews totais, <strong>{analytics.internalPageviews}</strong> sao internos
                    (servidor, bots, ferramentas) e <strong>{analytics.externalPageviews}</strong> sao de visitantes reais.
                    O funil abaixo mostra apenas visitantes reais.
                  </p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-amber-700">
                      Sessoes: <strong>{analytics.externalSessions}</strong> reais / <strong>{analytics.internalSessions}</strong> internas
                    </span>
                    <span className="text-amber-700">
                      IPs unicos: <strong>{analytics.uniqueIps}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analytics KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Visitantes Reais</span>
                <Tooltip text="Sessoes unicas de visitantes reais (excluindo bots e acessos internos). Cada visitante tem um ID anonimo no browser." />
              </div>
              <p className="text-2xl font-bold text-slate-900">{analytics.externalSessions || analytics.uniqueVisitors}</p>
              <p className="text-[10px] text-slate-400">{analytics.externalPageviews || analytics.landingViews} pageviews reais</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Signups Iniciados</span>
                <Tooltip text="Tentativas unicas de cadastro (SignupAttempt). Cada tentativa e uma pessoa diferente que iniciou o processo de cadastro." />
              </div>
              <p className="text-2xl font-bold text-slate-900">{analytics.signupStarts}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Conversoes</span>
                <Tooltip text="Empresas que completaram TODO o processo: cadastro, documentos, verificacao e ativacao. Somente tenants com status ACTIVE." />
              </div>
              <p className="text-2xl font-bold text-green-600">{analytics.signupComplete}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Taxa de Conversao</span>
                <Tooltip text="Percentual de visitantes reais que completaram o cadastro. Calculado como: conversoes / visitantes reais x 100." />
              </div>
              <p className="text-2xl font-bold text-blue-600">{analytics.externalConversion || analytics.conversionRate}%</p>
            </div>
          </div>

          {/* Funnel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-1 mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Funil de Conversao</h3>
              <Tooltip text="Mostra quantos visitantes passaram por cada etapa do cadastro. O % vermelho indica a perda entre etapas. Ideal: menos que 50% de perda por etapa." />
            </div>
            <div className="space-y-2">
              {funnelSteps.map((step, i) => {
                const pct = (step.value / funnelMax) * 100;
                const dropoff = i > 0 && funnelSteps[i - 1].value > 0
                  ? Math.round((1 - step.value / funnelSteps[i - 1].value) * 100)
                  : 0;
                return (
                  <div key={step.label} className="flex items-center gap-3 group">
                    <span className="text-xs text-slate-500 w-24 text-right flex-shrink-0 flex items-center justify-end gap-1">
                      {step.label}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip text={step.tooltip} />
                      </span>
                    </span>
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
              <div className="flex items-center gap-1 mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Visitas por Dia</h3>
                <Tooltip text="Pageviews diarios na landing page (inclui todos os acessos). Cada barra representa um dia." />
              </div>
              {analytics.dailyViews.length === 0 ? (
                <p className="text-xs text-slate-400">Sem dados no periodo.</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {analytics.dailyViews.map((d) => {
                    const h = (d.count / dailyMax) * 100;
                    const dateStr = new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${dateStr}: ${d.count} pageviews`}>
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
                <div className="flex items-center gap-1 mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Dispositivos</h3>
                  <Tooltip text="Tipo de dispositivo dos visitantes reais (bots excluidos). Baseado no User-Agent do navegador." />
                </div>
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
                  <div className="flex items-center gap-1 mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Top Rejeicoes</h3>
                    <Tooltip text="Motivos mais comuns de rejeicao na verificacao de documentos. Indica onde os candidatos tem mais dificuldade." />
                  </div>
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
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-slate-500">Rejeitados</span>
                <Tooltip text="Tentativas de cadastro que foram rejeitadas na verificacao de documentos." />
              </div>
              <p className="text-xl font-bold text-red-500">{analytics.signupRejected}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-slate-500">Cliques em Planos</span>
                <Tooltip text="Visitantes que clicaram num plano especifico na landing page (ex: 'Escolher Essencial')." />
              </div>
              <p className="text-xl font-bold text-slate-900">{analytics.clickPlan}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-slate-500">Cliques CTA</span>
                <Tooltip text="Visitantes que clicaram no botao principal 'Comecar Agora' no topo da landing page." />
              </div>
              <p className="text-xl font-bold text-slate-900">{analytics.clickSignup}</p>
            </div>
          </div>

          {/* IP Breakdown (collapsible) */}
          {analytics.ipBreakdown && analytics.ipBreakdown.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setShowIps(!showIps)}
                className="w-full p-5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">Detalhes por IP</h3>
                  <Tooltip text="Mostra os IPs que mais acessaram a landing page. IPs marcados como 'interno' sao do servidor, bots ou ferramentas de automacao. Util para verificar se os acessos sao reais." />
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showIps ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showIps && (
                <div className="border-t border-slate-100 p-5 pt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="pb-2 font-medium">IP</th>
                          <th className="pb-2 font-medium">Acessos</th>
                          <th className="pb-2 font-medium">Tipo</th>
                          <th className="pb-2 font-medium">User-Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.ipBreakdown.map((ip) => (
                          <tr key={ip.ip} className={`border-t border-slate-50 ${ip.isInternal ? "bg-amber-50/50" : ""}`}>
                            <td className="py-1.5 font-mono text-slate-600">{ip.ip}</td>
                            <td className="py-1.5 font-bold text-slate-700">{ip.count}</td>
                            <td className="py-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                ip.isInternal
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}>
                                {ip.isInternal ? "Interno" : "Visitante"}
                              </span>
                            </td>
                            <td className="py-1.5 text-slate-400 max-w-[300px] truncate" title={ip.lastUa}>
                              {ip.lastUa || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Plan Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-1 mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Distribuicao por Plano</h2>
          <Tooltip text="Quantas empresas ativas estao em cada plano. Mostra o valor mensal de cada plano." />
        </div>
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
        <button onClick={() => router.push("/ctrl-zr8k2x/invoices")}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
          <div className="text-sm font-semibold text-slate-700">Notas Fiscais</div>
          <p className="mt-1 text-xs text-slate-400">Emitir e gerenciar NFS-e</p>
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
