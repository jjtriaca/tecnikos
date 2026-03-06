"use client";

import Link from "next/link";
import type { FinanceDashboard } from "@/types/finance";

interface CashBalancesProps {
  data: FinanceDashboard["cashAccounts"];
  pendingCards: FinanceDashboard["cardSettlements"];
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function IconBank() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  );
}

export default function CashBalances({ data, pendingCards }: CashBalancesProps) {
  const totalBalance = data.reduce((s, a) => s + a.currentBalanceCents, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Saldos por Conta</h3>
        <span className="text-xs text-slate-400">
          Total: <span className={`font-semibold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totalBalance)}
          </span>
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Nenhuma conta cadastrada</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <IconBank />
                </div>
                <span className="text-xs font-medium text-slate-600 truncate">{account.name}</span>
              </div>
              <p
                className={`text-sm font-bold tabular-nums ${
                  account.currentBalanceCents >= 0 ? "text-slate-900" : "text-red-600"
                }`}
              >
                {formatCurrency(account.currentBalanceCents)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Card Settlements Alert */}
      {pendingCards.pending.count > 0 && (
        <Link
          href="/finance?tab=cartoes"
          className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 hover:bg-amber-100 transition-colors"
        >
          <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-medium text-amber-700">
            {pendingCards.pending.count} baixa{pendingCards.pending.count !== 1 ? "s" : ""} de cartão pendente{pendingCards.pending.count !== 1 ? "s" : ""} ({formatCurrency(pendingCards.pending.totalGross)})
          </span>
          <svg className="h-3.5 w-3.5 text-amber-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
