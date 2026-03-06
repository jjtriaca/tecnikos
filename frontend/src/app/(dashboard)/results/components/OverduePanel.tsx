"use client";

import type { FinanceDashboard } from "@/types/finance";

interface OverduePanelProps {
  data: FinanceDashboard["overdue"];
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const BUCKET_LABELS: Record<string, string> = {
  "0-30": "0 - 30 dias",
  "31-60": "31 - 60 dias",
  "61-90": "61 - 90 dias",
  "90+": "90+ dias",
};

const BUCKET_COLORS: Record<string, string> = {
  "0-30": "bg-amber-400",
  "31-60": "bg-orange-500",
  "61-90": "bg-red-500",
  "90+": "bg-red-700",
};

export default function OverduePanel({ data }: OverduePanelProps) {
  const maxBucketCents = Math.max(
    ...Object.values(data.buckets).map((b) => b.totalCents),
    1
  );

  if (data.totalOverdueCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Inadimplência</h3>
        <div className="flex-1 flex items-center justify-center gap-2">
          <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-600 font-medium">Nenhum título vencido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Inadimplência</h3>
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-bold text-red-600">
            {formatCurrency(data.totalOverdueCents)}
          </span>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {Object.entries(data.buckets).map(([key, bucket]) => {
          const pct = bucket.totalCents > 0 ? (bucket.totalCents / maxBucketCents) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600">{BUCKET_LABELS[key] || key}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{bucket.count} títulos</span>
                  <span className="text-xs font-semibold text-slate-800 tabular-nums">
                    {formatCurrency(bucket.totalCents)}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BUCKET_COLORS[key] || "bg-slate-400"} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">Total vencido</span>
        <span className="text-sm font-bold text-red-600">
          {data.totalOverdueCount} título{data.totalOverdueCount !== 1 ? "s" : ""} — {formatCurrency(data.totalOverdueCents)}
        </span>
      </div>
    </div>
  );
}
