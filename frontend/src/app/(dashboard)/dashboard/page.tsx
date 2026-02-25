"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import Link from "next/link";

/* ── Types ───────────────────────────────────────────── */

type ServiceOrder = {
  id: string;
  title: string;
  description?: string;
  addressText: string;
  status: string;
  valueCents: number;
  deadlineAt: string;
  createdAt: string;
  assignedPartner?: { id: string; name: string; phone: string } | null;
};

type DashboardStats = {
  total: number;
  byStatus: Record<string, number>;
  overdue: number;
  completedToday: number;
};

type FinanceSummary = {
  totalGrossCents: number;
  totalCommissionCents: number;
  totalNetCents: number;
  confirmedCount: number;
  pendingOs: { id: string; title: string; valueCents: number; status: string }[];
};

type OrdersReport = {
  total: number;
  totalValue: number;
  overdue: number;
  byStatus: { status: string; count: number }[];
  byDay: { day: string; count: number }[];
};

type TechPerformance = {
  id: string;
  name: string;
  phone: string;
  rating: number;
  status: string;
  totalOs: number;
  completedOs: number;
  totalValue: number;
  completionRate: number;
};

/* ── Constants ───────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Ofertada",
  ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDA: "Concluída",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
  CANCELADA: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-yellow-500",
  OFERTADA: "bg-orange-400",
  ATRIBUIDA: "bg-blue-400",
  EM_EXECUCAO: "bg-blue-600",
  CONCLUIDA: "bg-green-500",
  APROVADA: "bg-emerald-600",
  AJUSTE: "bg-amber-500",
  CANCELADA: "bg-slate-400",
};

const STATUS_BADGE: Record<string, string> = {
  ABERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  OFERTADA: "bg-orange-100 text-orange-800 border-orange-200",
  ATRIBUIDA: "bg-blue-100 text-blue-800 border-blue-200",
  EM_EXECUCAO: "bg-blue-100 text-blue-800 border-blue-200",
  CONCLUIDA: "bg-green-100 text-green-800 border-green-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AJUSTE: "bg-amber-100 text-amber-800 border-amber-200",
  CANCELADA: "bg-slate-100 text-slate-600 border-slate-200",
};

/* ── Helpers ─────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function isOverdue(order: ServiceOrder) {
  return (
    new Date(order.deadlineAt) < new Date() &&
    !["CONCLUIDA", "APROVADA", "CANCELADA"].includes(order.status)
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/* ── SVG Icons ───────────────────────────────────────── */

function IconClipboard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function IconWarning({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconBolt({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconCheck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconClock({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconMoney({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconTrendUp({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function IconUsers({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function IconPlus({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconStar({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function IconArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconWallet({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  );
}

/* ── Mini Sparkline chart (pure SVG) ─────────────────── */

function Sparkline({ data, color = "#3b82f6", height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data.map((v, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const areaPoints = [...points, `${w},${height}`, `0,${height}`];

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(" ")} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Main Page Component ─────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<ServiceOrder[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [ordersReport, setOrdersReport] = useState<OrdersReport | null>(null);
  const [topTechs, setTopTechs] = useState<TechPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Fetch all data in parallel — individual failures don't break the whole dashboard
        const results = await Promise.allSettled([
          api.get<DashboardStats>("/service-orders/stats"),
          api.get<{ data: ServiceOrder[]; meta: any }>("/service-orders?limit=5&sortBy=createdAt&sortOrder=desc"),
          api.get<FinanceSummary>("/finance/summary"),
          api.get<OrdersReport>("/reports/orders"),
          api.get<TechPerformance[]>("/reports/technicians"),
        ]);

        if (cancelled) return;

        if (results[0].status === "fulfilled") setStats(results[0].value);
        if (results[1].status === "fulfilled") setRecentOrders(results[1].value.data);
        if (results[2].status === "fulfilled") setFinanceSummary(results[2].value);
        if (results[3].status === "fulfilled") setOrdersReport(results[3].value);
        if (results[4].status === "fulfilled") setTopTechs(results[4].value.slice(0, 5));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Last 14 days sparkline data
  const sparklineData = useMemo(() => {
    if (!ordersReport?.byDay?.length) return [];
    const now = new Date();
    const days: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = ordersReport.byDay.find((bd) => bd.day === key);
      days.push(found?.count || 0);
    }
    return days;
  }, [ordersReport]);

  const activeOrders = stats
    ? (stats.byStatus?.ATRIBUIDA ?? 0) + (stats.byStatus?.EM_EXECUCAO ?? 0)
    : 0;
  const openOrders = stats
    ? (stats.byStatus?.ABERTA ?? 0) + (stats.byStatus?.OFERTADA ?? 0)
    : 0;

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ──── Header + Quick Actions ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200"
          >
            <IconPlus className="h-4 w-4" />
            Nova OS
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <IconTrendUp className="h-4 w-4" />
            Relatórios
          </Link>
        </div>
      </div>

      {/* ──── KPI Cards (Top Row) ──── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Card: Total OS */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 p-5 text-white shadow-lg">
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <IconClipboard />
                </div>
                {sparklineData.length > 0 && (
                  <div className="w-20 opacity-70">
                    <Sparkline data={sparklineData} color="#94a3b8" height={28} />
                  </div>
                )}
              </div>
              <p className="mt-3 text-3xl font-bold">{stats?.total ?? 0}</p>
              <p className="mt-0.5 text-xs font-medium text-white/70">Total de OS</p>
            </div>
          </div>

          {/* Card: Em Execução */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <IconBolt />
                </div>
                <span className="text-xs font-medium bg-white/20 rounded-lg px-2 py-1">
                  +{openOrders} abertas
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold">{activeOrders}</p>
              <p className="mt-0.5 text-xs font-medium text-white/70">Em Execução</p>
            </div>
          </div>

          {/* Card: Concluídas Hoje */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <IconCheck />
                </div>
                {stats?.overdue ? (
                  <span className="text-xs font-semibold bg-red-500/80 rounded-lg px-2 py-1 flex items-center gap-1">
                    <IconClock className="h-3 w-3" />
                    {stats.overdue} atrasadas
                  </span>
                ) : (
                  <span className="text-xs font-medium bg-white/20 rounded-lg px-2 py-1">
                    Sem atrasos
                  </span>
                )}
              </div>
              <p className="mt-3 text-3xl font-bold">{stats?.completedToday ?? 0}</p>
              <p className="mt-0.5 text-xs font-medium text-white/70">Concluídas Hoje</p>
            </div>
          </div>

          {/* Card: Receita Total */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white shadow-lg">
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <IconMoney />
                </div>
                {financeSummary && financeSummary.pendingOs.length > 0 && (
                  <Link
                    href="/finance"
                    className="text-xs font-semibold bg-amber-400/90 text-amber-900 rounded-lg px-2 py-1 hover:bg-amber-400 transition-colors"
                  >
                    {financeSummary.pendingOs.length} pendentes
                  </Link>
                )}
              </div>
              <p className="mt-3 text-2xl font-bold">
                {financeSummary ? formatCurrency(financeSummary.totalGrossCents) : "R$ 0,00"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-white/70">Receita Bruta</p>
            </div>
          </div>
        </div>
      )}

      {/* ──── Finance Mini-Cards ──── */}
      {!loading && financeSummary && financeSummary.totalGrossCents > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50">
                <IconMoney className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Receita Bruta</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(financeSummary.totalGrossCents)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <IconWallet className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Comissões</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(financeSummary.totalCommissionCents)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <IconTrendUp className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Repasse Líquido</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(financeSummary.totalNetCents)}</p>
          </div>
        </div>
      )}

      {/* ──── Middle Row: Status + Activity Chart ──── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Status Distribution */}
        {stats && stats.total > 0 && (
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-slate-800">
                  Distribuição por Status
                </h3>
                <span className="text-xs text-slate-400">{stats.total} total</span>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.byStatus)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const pct = Math.round((count / stats.total) * 100);
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status] || "bg-slate-400"}`} />
                            <span className="text-xs font-medium text-slate-600">
                              {STATUS_LABELS[status] || status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">{pct}%</span>
                            <span className="text-xs font-bold text-slate-800 w-6 text-right">
                              {count}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${STATUS_COLORS[status] || "bg-slate-400"} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Activity Chart (last 14 days) */}
        <div className={stats && stats.total > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-slate-800">
                OS Criadas (últimos 14 dias)
              </h3>
              <Link href="/reports" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Ver relatório completo
              </Link>
            </div>
            {sparklineData.length > 0 && sparklineData.some(v => v > 0) ? (
              <div>
                <div className="mb-2">
                  <Sparkline data={sparklineData} color="#3b82f6" height={120} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
                  {(() => {
                    const labels: string[] = [];
                    for (let i = 13; i >= 0; i--) {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      labels.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
                    }
                    // Show only every other label to prevent overcrowding
                    return labels.map((label, idx) => (
                      <span key={idx} className={idx % 2 !== 0 ? "hidden sm:inline" : ""}>
                        {label}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <IconClipboard className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs">Nenhuma OS criada nos últimos 14 dias</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ──── Bottom Row: Recent Orders + Top Partners ──── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Orders */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Últimas Ordens de Serviço
              </h3>
              <Link
                href="/orders"
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Ver todas
                <IconArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="p-10 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 mb-3">
                  <IconClipboard className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  Nenhuma ordem de serviço encontrada.
                </p>
                <Link
                  href="/orders/new"
                  className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Criar primeira OS
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                          isOverdue(order)
                            ? "bg-red-500 ring-2 ring-red-200"
                            : STATUS_COLORS[order.status] || "bg-slate-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {order.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {order.addressText}
                          {order.assignedPartner && ` — ${order.assignedPartner.name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                          STATUS_BADGE[order.status] || "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      <span className="text-xs text-slate-400 w-10 text-right hidden sm:block">
                        {formatDate(order.deadlineAt)}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 w-20 text-right">
                        {formatCurrency(order.valueCents)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Partners */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Top Parceiros
              </h3>
              <Link
                href="/partners"
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Ver todos
                <IconArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : topTechs.length === 0 ? (
              <div className="p-10 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 mb-3">
                  <IconUsers className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">Nenhum parceiro cadastrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topTechs.map((tech, index) => (
                  <div
                    key={tech.id}
                    className="flex items-center gap-3 px-6 py-3.5"
                  >
                    {/* Rank badge */}
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                      index === 0 ? "bg-amber-100 text-amber-700" :
                      index === 1 ? "bg-slate-100 text-slate-600" :
                      index === 2 ? "bg-orange-50 text-orange-600" :
                      "bg-slate-50 text-slate-400"
                    }`}>
                      {index + 1}
                    </div>

                    {/* Avatar circle */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold flex-shrink-0">
                      {tech.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{tech.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <IconStar className="h-3 w-3 text-amber-400" />
                          <span className="text-[11px] text-slate-500">{tech.rating?.toFixed(1) || "0.0"}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">|</span>
                        <span className="text-[11px] text-slate-500">{tech.completedOs} concluídas</span>
                      </div>
                    </div>

                    {/* Completion rate */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-800">{tech.completionRate}%</p>
                      <p className="text-[10px] text-slate-400">conclusão</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ──── Pending Financial Confirmations ──── */}
      {!loading && financeSummary && financeSummary.pendingOs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <IconWarning className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-amber-800">
                OS Aguardando Confirmação Financeira ({financeSummary.pendingOs.length})
              </h3>
            </div>
            <Link
              href="/finance"
              className="flex items-center gap-1 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-300 transition-colors"
            >
              Ir para Financeiro
              <IconArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-amber-200">
            {financeSummary.pendingOs.slice(0, 3).map((os) => (
              <Link
                key={os.id}
                href={`/orders/${os.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-amber-100/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-900 truncate">{os.title}</p>
                  <p className="text-[11px] text-amber-600">
                    {STATUS_LABELS[os.status] || os.status}
                  </p>
                </div>
                <span className="text-sm font-bold text-amber-800 flex-shrink-0 ml-4">
                  {formatCurrency(os.valueCents)}
                </span>
              </Link>
            ))}
            {financeSummary.pendingOs.length > 3 && (
              <div className="px-6 py-2.5 text-center">
                <Link href="/finance" className="text-xs font-medium text-amber-700 hover:text-amber-800">
                  + {financeSummary.pendingOs.length - 3} mais pendentes
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
