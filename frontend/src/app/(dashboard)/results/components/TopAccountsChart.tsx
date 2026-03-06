"use client";

interface TopAccountsChartProps {
  data: { code: string; name: string; totalCents: number; percentage: number }[];
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function TopAccountsChart({ data }: TopAccountsChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Top Receitas por Categoria</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Sem dados no período</p>
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.totalCents), 1);

  const BAR_COLORS = [
    "bg-blue-500",
    "bg-blue-400",
    "bg-blue-300",
    "bg-sky-400",
    "bg-sky-300",
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Top Receitas por Categoria</h3>
      <div className="space-y-3 flex-1">
        {data.map((item, i) => {
          const pct = (item.totalCents / maxVal) * 100;
          return (
            <div key={item.code}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-700 font-medium truncate max-w-[60%]">
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{item.percentage}%</span>
                  <span className="text-xs font-semibold text-slate-800 tabular-nums">
                    {formatCurrency(item.totalCents)}
                  </span>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[i] || "bg-blue-400"} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
