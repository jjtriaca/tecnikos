"use client";

import type { FinanceDashboard } from "@/types/finance";

interface DreSummaryProps {
  data: FinanceDashboard;
  onViewFull: () => void;
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function DreSummary({ data, onViewFull }: DreSummaryProps) {
  const { dre } = data;

  const lines = [
    { label: "RECEITAS", value: dre.revenue.totalCents, bold: false, indent: false },
    { label: "(-) CUSTOS DE SERVIÇO", value: -dre.costs.totalCents, bold: false, indent: true },
    { label: "= LUCRO BRUTO", value: dre.grossProfitCents, bold: true, indent: false, highlight: true },
    { label: "(-) DESPESAS", value: -dre.expenses.totalCents, bold: false, indent: true },
    { label: "= RESULTADO LÍQUIDO", value: dre.netResultCents, bold: true, indent: false, highlight: true },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">DRE Resumido</h3>
        <button
          onClick={onViewFull}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Ver DRE completo
        </button>
      </div>
      <div className="space-y-2 flex-1">
        {lines.map((line) => {
          const isPositive = line.value >= 0;
          return (
            <div
              key={line.label}
              className={`flex items-center justify-between py-1.5 ${
                line.highlight ? "border-t border-slate-100 pt-2" : ""
              } ${line.indent ? "pl-2" : ""}`}
            >
              <span
                className={`text-xs ${
                  line.bold ? "font-bold text-slate-900" : "font-medium text-slate-600"
                }`}
              >
                {line.label}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  line.bold
                    ? isPositive
                      ? "font-bold text-green-700"
                      : "font-bold text-red-700"
                    : "font-medium text-slate-800"
                }`}
              >
                {formatCurrency(Math.abs(line.value))}
              </span>
            </div>
          );
        })}
      </div>

      {/* Receivables/Payables summary */}
      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-2.5">
          <p className="text-[10px] font-medium text-green-600 uppercase">A Receber</p>
          <p className="text-sm font-bold text-green-800 mt-0.5">
            {formatCurrency(data.summary.receivables.totalCents)}
          </p>
          <p className="text-[10px] text-green-600">{data.summary.receivables.totalCount} títulos</p>
        </div>
        <div className="rounded-xl bg-red-50 p-2.5">
          <p className="text-[10px] font-medium text-red-600 uppercase">A Pagar</p>
          <p className="text-sm font-bold text-red-800 mt-0.5">
            {formatCurrency(data.summary.payables.totalCents)}
          </p>
          <p className="text-[10px] text-red-600">{data.summary.payables.totalCount} títulos</p>
        </div>
      </div>
    </div>
  );
}
