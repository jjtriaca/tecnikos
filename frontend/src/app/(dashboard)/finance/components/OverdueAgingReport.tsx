"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OverdueAgingReport as OverdueAgingReportType } from "@/types/finance";

const BUCKETS = [
  { key: "0-30" as const, label: "0-30 dias", border: "border-amber-200", bg: "bg-amber-50" },
  { key: "31-60" as const, label: "31-60 dias", border: "border-orange-200", bg: "bg-orange-50" },
  { key: "61-90" as const, label: "61-90 dias", border: "border-red-200", bg: "bg-red-50" },
  { key: "90+" as const, label: "90+ dias", border: "border-red-300", bg: "bg-red-100" },
] as const;

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-2 h-3 w-16 rounded bg-slate-200" />
            <div className="mb-1 h-6 w-10 rounded bg-slate-200" />
            <div className="mb-2 h-4 w-20 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-xl border-2 border-slate-200 bg-white p-4">
        <div className="h-5 w-40 rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function OverdueAgingReport() {
  const [data, setData] = useState<OverdueAgingReportType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const report = await api.get<OverdueAgingReportType>("/finance/overdue");
        if (!cancelled) setData(report);
      } catch {
        // silently handle — component will remain in loading or show empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return null;

  const { buckets, totalOverdueCents, totalOverdueCount } = data;
  const hasOverdue = totalOverdueCount > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BUCKETS.map(({ key, label, border, bg }) => {
          const bucket = buckets[key];
          return (
            <div
              key={key}
              className={`rounded-xl border ${border} ${bg} p-4`}
            >
              <p className="text-xs font-medium text-slate-600">{label}</p>
              <p className="text-lg font-bold text-slate-900">{bucket.count}</p>
              <p className="text-sm font-semibold text-slate-700">
                {formatCurrency(bucket.totalCents)}
              </p>
              <p className="text-xs text-slate-500">
                {bucket.count === 0
                  ? "Nenhuma parcela vencida"
                  : `${bucket.count} parcela${bucket.count > 1 ? "s" : ""} vencida${bucket.count > 1 ? "s" : ""}`}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border-2 border-slate-300 bg-white p-4">
        {hasOverdue ? (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-red-600">
              Total em Atraso: {formatCurrency(totalOverdueCents)}
            </p>
            <p className="text-xs text-red-500">
              {totalOverdueCount} parcela{totalOverdueCount > 1 ? "s" : ""} vencida{totalOverdueCount > 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm font-bold text-green-600">Nenhum atraso!</p>
        )}
      </div>
    </div>
  );
}
