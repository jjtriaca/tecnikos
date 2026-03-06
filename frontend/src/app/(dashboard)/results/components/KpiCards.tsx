"use client";

import type { FinanceDashboard } from "@/types/finance";

interface KpiCardsProps {
  data: FinanceDashboard;
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function IconTrendUp() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function IconTrendDown() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  );
}

export default function KpiCards({ data }: KpiCardsProps) {
  const revenue = data.dre.revenue.totalCents;
  const costsAndExpenses = data.dre.costs.totalCents + data.dre.expenses.totalCents;
  const netResult = data.dre.netResultCents;
  const cashBalance = data.cashAccounts.reduce((s, a) => s + a.currentBalanceCents, 0);
  const margin = revenue > 0 ? Math.round((netResult / revenue) * 100) : 0;

  const cards = [
    {
      label: "Receita Bruta",
      value: formatCurrency(revenue),
      gradient: "from-emerald-500 to-emerald-600",
      icon: <IconTrendUp />,
      badge: null,
    },
    {
      label: "Custos + Despesas",
      value: formatCurrency(costsAndExpenses),
      gradient: "from-red-500 to-red-600",
      icon: <IconTrendDown />,
      badge: null,
    },
    {
      label: "Resultado Líquido",
      value: formatCurrency(netResult),
      gradient: netResult >= 0 ? "from-blue-500 to-blue-600" : "from-red-600 to-red-700",
      icon: <IconTarget />,
      badge: `${margin}% margem`,
    },
    {
      label: "Saldo em Caixa",
      value: formatCurrency(cashBalance),
      gradient: "from-violet-500 to-purple-600",
      icon: <IconWallet />,
      badge: `${data.cashAccounts.length} conta${data.cashAccounts.length !== 1 ? "s" : ""}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 text-white shadow-lg`}
        >
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                {card.icon}
              </div>
              {card.badge && (
                <span className="text-xs font-medium bg-white/20 rounded-lg px-2 py-1">
                  {card.badge}
                </span>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold truncate">{card.value}</p>
            <p className="mt-0.5 text-xs font-medium text-white/70">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
