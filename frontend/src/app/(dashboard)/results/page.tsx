"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { FinanceDashboard } from "@/types/finance";
import AccountsTab from "../finance/components/AccountsTab";
import DreReport from "../finance/components/DreReport";
import PeriodSelector from "./components/PeriodSelector";
import KpiCards from "./components/KpiCards";
import DreSummary from "./components/DreSummary";
import CashFlowChart from "./components/CashFlowChart";
import OverduePanel from "./components/OverduePanel";
import TopAccountsChart from "./components/TopAccountsChart";
import CashBalances from "./components/CashBalances";

type TabId = "dashboard" | "dre" | "plano";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "dre", label: "DRE" },
  { id: "plano", label: "Plano de Contas" },
];

function getMonthRange(): [string, string] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [dateFrom, setDateFrom] = useState(() => getMonthRange()[0]);
  const [dateTo, setDateTo] = useState(() => getMonthRange()[1]);
  const [data, setData] = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const result = await api.get<FinanceDashboard>(
        `/finance/dashboard?dateFrom=${from}&dateTo=${to}`
      );
      setData(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "dashboard") {
      loadDashboard(dateFrom, dateTo);
    }
  }, [activeTab, dateFrom, dateTo, loadDashboard]);

  function handlePeriodChange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resultados</h1>
          <p className="text-sm text-slate-500">
            Dashboard financeiro, DRE e plano de contas.
          </p>
        </div>
        {activeTab === "dashboard" && (
          <PeriodSelector
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={handlePeriodChange}
          />
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && (
        <DashboardContent data={data} loading={loading} onViewDre={() => setActiveTab("dre")} />
      )}
      {activeTab === "dre" && <DreReport />}
      {activeTab === "plano" && <AccountsTab />}
    </div>
  );
}

/* ── Dashboard Content ──────────────────────────────── */

function DashboardContent({
  data,
  loading,
  onViewDre,
}: {
  data: FinanceDashboard | null;
  loading: boolean;
  onViewDre: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        {/* KPI skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 h-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="lg:col-span-7 h-64 animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 h-48 animate-pulse rounded-2xl bg-slate-200" />
          <div className="lg:col-span-7 h-48 animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Erro ao carregar dados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KpiCards data={data} />

      {/* DRE Summary + Cash Flow Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <DreSummary data={data} onViewFull={onViewDre} />
        </div>
        <div className="lg:col-span-7">
          <CashFlowChart data={data.cashFlow} />
        </div>
      </div>

      {/* Overdue + Top Accounts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <OverduePanel data={data.overdue} />
        </div>
        <div className="lg:col-span-7">
          <TopAccountsChart data={data.topAccounts} />
        </div>
      </div>

      {/* Cash Balances + Card Settlements Alert */}
      <CashBalances data={data.cashAccounts} pendingCards={data.cardSettlements} />
    </div>
  );
}
