"use client";

import { useMemo, useState } from "react";
import type { CashFlowDay } from "@/types/finance";

interface CashFlowChartProps {
  data: CashFlowDay[];
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatShortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export default function CashFlowChart({ data }: CashFlowChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!data.length) return null;

    const maxVal = Math.max(
      ...data.map((d) => Math.max(d.receivableCents, d.payableCents)),
      1
    );

    const W = 500;
    const H = 200;
    const PAD_X = 0;
    const PAD_Y = 10;
    const chartW = W - PAD_X * 2;
    const chartH = H - PAD_Y * 2;

    const getX = (i: number) =>
      data.length === 1 ? chartW / 2 + PAD_X : PAD_X + (i / (data.length - 1)) * chartW;
    const getY = (v: number) =>
      PAD_Y + chartH - (v / maxVal) * chartH;

    const recPoints = data.map((d, i) => `${getX(i)},${getY(d.receivableCents)}`);
    const payPoints = data.map((d, i) => `${getX(i)},${getY(d.payableCents)}`);

    const recArea = [...recPoints, `${getX(data.length - 1)},${H}`, `${getX(0)},${H}`];
    const payArea = [...payPoints, `${getX(data.length - 1)},${H}`, `${getX(0)},${H}`];

    // X-axis labels (show ~6 labels)
    const step = Math.max(1, Math.floor(data.length / 6));
    const xLabels: { x: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += step) {
      xLabels.push({ x: getX(i), label: formatShortDate(data[i].date) });
    }
    // Always include last
    if (data.length > 1 && (data.length - 1) % step !== 0) {
      xLabels.push({ x: getX(data.length - 1), label: formatShortDate(data[data.length - 1].date) });
    }

    // Y-axis labels (4 levels)
    const yLabels: { y: number; label: string }[] = [];
    for (let i = 0; i <= 3; i++) {
      const val = (maxVal / 3) * (3 - i);
      yLabels.push({ y: getY(val), label: formatCurrency(val) });
    }

    return { W, H, recPoints, payPoints, recArea, payArea, xLabels, yLabels, getX };
  }, [data]);

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Fluxo de Caixa</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Sem movimentações no período</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Fluxo de Caixa</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-slate-500">Receitas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded-full bg-red-400" />
            <span className="text-[10px] text-slate-500">Despesas</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-[200px]">
        {chartData && (
          <svg
            viewBox={`0 0 ${chartData.W} ${chartData.H + 20}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="grad-rec" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="grad-pay" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {chartData.yLabels.map((yl, i) => (
              <line
                key={i}
                x1="0"
                y1={yl.y}
                x2={chartData.W}
                y2={yl.y}
                stroke="#e2e8f0"
                strokeWidth="0.5"
                strokeDasharray="4,4"
              />
            ))}

            {/* Areas */}
            <polygon points={chartData.recArea.join(" ")} fill="url(#grad-rec)" />
            <polygon points={chartData.payArea.join(" ")} fill="url(#grad-pay)" />

            {/* Lines */}
            <polyline
              points={chartData.recPoints.join(" ")}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={chartData.payPoints.join(" ")}
              fill="none"
              stroke="#f87171"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover areas */}
            {data.map((_, i) => (
              <rect
                key={i}
                x={chartData.getX(i) - (chartData.W / data.length / 2)}
                y="0"
                width={chartData.W / data.length}
                height={chartData.H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            ))}

            {/* Hover indicator */}
            {hoverIdx !== null && (
              <>
                <line
                  x1={chartData.getX(hoverIdx)}
                  y1="0"
                  x2={chartData.getX(hoverIdx)}
                  y2={chartData.H}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <circle
                  cx={chartData.getX(hoverIdx)}
                  cy={parseFloat(chartData.recPoints[hoverIdx].split(",")[1])}
                  r="4"
                  fill="#10b981"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle
                  cx={chartData.getX(hoverIdx)}
                  cy={parseFloat(chartData.payPoints[hoverIdx].split(",")[1])}
                  r="4"
                  fill="#f87171"
                  stroke="white"
                  strokeWidth="2"
                />
              </>
            )}

            {/* X-axis labels */}
            {chartData.xLabels.map((xl, i) => (
              <text
                key={i}
                x={xl.x}
                y={chartData.H + 14}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize="9"
              >
                {xl.label}
              </text>
            ))}
          </svg>
        )}

        {/* Tooltip */}
        {hoverIdx !== null && (
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-2 pointer-events-none">
            <p className="text-[10px] font-medium text-slate-500">{formatShortDate(data[hoverIdx].date)}</p>
            <p className="text-xs text-emerald-600 font-medium">
              Rec: {formatCurrency(data[hoverIdx].receivableCents)}
            </p>
            <p className="text-xs text-red-500 font-medium">
              Desp: {formatCurrency(data[hoverIdx].payableCents)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
