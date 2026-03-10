"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface UsageData {
  usedThisMonth: number;
  maxOsPerMonth: number;
  isUnlimited: boolean;
  percentage: number;
  daysLeft: number;
}

function getBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 90) return "bg-red-400";
  if (pct >= 80) return "bg-amber-400";
  return "bg-blue-500";
}

function getTextColor(pct: number): string {
  if (pct >= 90) return "text-red-400";
  if (pct >= 80) return "text-amber-400";
  return "text-slate-400";
}

export default function UsageBar({ collapsed }: { collapsed: boolean }) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get("/service-orders/usage")
      .then((data: UsageData) => { if (mounted) setUsage(data); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!usage || usage.isUnlimited) return null;

  const { usedThisMonth, maxOsPerMonth, percentage } = usage;
  const barColor = getBarColor(percentage);
  const textColor = getTextColor(percentage);

  if (collapsed) {
    return (
      <div className="px-3 mb-2" title={`${usedThisMonth}/${maxOsPerMonth} OS (${percentage}%)`}>
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-lg bg-white/5 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-400">OS este mes</span>
        <span className={`text-[11px] font-semibold ${textColor}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          {usedThisMonth} / {maxOsPerMonth}
        </span>
        <span className="text-[10px] text-slate-500">
          {usage.daysLeft}d restantes
        </span>
      </div>
      {percentage >= 80 && (
        <p className={`mt-1 text-[10px] ${percentage >= 100 ? "text-red-400" : "text-amber-400"}`}>
          {percentage >= 100
            ? "Limite atingido! Contrate mais OS."
            : percentage >= 90
              ? "Quase no limite. Considere upgrade."
              : "Atencao: 80% do limite utilizado."}
        </p>
      )}
    </div>
  );
}
