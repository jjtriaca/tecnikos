"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface DreAccountRow {
  id: string;
  code: string;
  name: string;
  totalCents: number;
}

interface DreGroup {
  id: string;
  code: string;
  name: string;
  totalCents: number;
  children: DreAccountRow[];
}

interface DreSection {
  groups: DreGroup[];
  uncategorizedCents?: number;
  totalCents: number;
}

interface PaymentByMethod {
  code: string;
  name: string;
  receivableCents: number;
  payableCents: number;
  netCents: number;
  count: number;
}

interface PaymentByInstrument {
  id: string;
  name: string;
  methodName: string;
  receivableCents: number;
  payableCents: number;
  netCents: number;
  count: number;
}

interface PaymentBreakdown {
  byMethod: PaymentByMethod[];
  byInstrument: PaymentByInstrument[];
  noMethodCents: { receivableCents: number; payableCents: number; count: number };
}

interface DreData {
  period: { dateFrom: string; dateTo: string };
  revenue: DreSection;
  costs: DreSection;
  expenses: DreSection;
  grossProfitCents: number;
  netResultCents: number;
  paymentBreakdown?: PaymentBreakdown;
  generatedAt: string;
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type PaymentView = "none" | "byMethod" | "byInstrument";

export default function DreReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DreData | null>(null);
  const [paymentView, setPaymentView] = useState<PaymentView>("none");

  // Default period: current month
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDayStr);

  async function generate() {
    if (!dateFrom || !dateTo) {
      toast("Informe o periodo.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await api.get<DreData>(`/finance/reports/dre?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setData(result);
    } catch {
      toast("Erro ao gerar DRE.", "error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(title: string, section: DreSection, colorClass: string, sign: string) {
    return (
      <div className="mb-4">
        <div className={`flex justify-between items-center py-2 px-3 rounded-t-lg ${colorClass} font-semibold text-sm`}>
          <span>{title}</span>
          <span>{sign}{fmt(section.totalCents)}</span>
        </div>
        <div className="border border-t-0 rounded-b-lg divide-y divide-slate-100">
          {section.groups.map((group) => (
            <div key={group.id}>
              <div className="flex justify-between items-center py-1.5 px-3 bg-slate-50 text-xs font-medium text-slate-700">
                <span>{group.code} {group.name}</span>
                <span>{fmt(group.totalCents)}</span>
              </div>
              {group.children.map((child) => (
                <div key={child.id} className="flex justify-between items-center py-1 px-3 pl-8 text-xs text-slate-600">
                  <span>{child.code} {child.name}</span>
                  <span>{fmt(child.totalCents)}</span>
                </div>
              ))}
            </div>
          ))}
          {(section.uncategorizedCents ?? 0) > 0 && (
            <div className="flex justify-between items-center py-1.5 px-3 text-xs text-slate-500 italic">
              <span>Sem categoria</span>
              <span>{fmt(section.uncategorizedCents!)}</span>
            </div>
          )}
          {section.groups.length === 0 && (section.uncategorizedCents ?? 0) === 0 && (
            <div className="py-2 px-3 text-xs text-slate-400 text-center">Nenhum lancamento no periodo</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ate</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="pt-5">
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Gerando..." : "Gerar DRE"}
          </button>
        </div>
      </div>

      {data && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Demonstrativo de Resultado (DRE)</h2>
            <p className="text-xs text-slate-500">
              Periodo: {new Date(data.period.dateFrom).toLocaleDateString("pt-BR")} a{" "}
              {new Date(data.period.dateTo).toLocaleDateString("pt-BR")}
            </p>
          </div>

          {renderSection("RECEITAS", data.revenue, "bg-green-100 text-green-800", "")}
          {renderSection("(-) CUSTOS DE SERVICO", data.costs, "bg-amber-100 text-amber-800", "-")}

          {/* Gross Profit */}
          <div className="flex justify-between items-center py-2 px-4 rounded-lg bg-blue-50 border border-blue-200 font-bold text-sm text-blue-800">
            <span>= LUCRO BRUTO</span>
            <span className={data.grossProfitCents >= 0 ? "text-green-700" : "text-red-700"}>
              {fmt(data.grossProfitCents)}
            </span>
          </div>

          {renderSection("(-) DESPESAS", data.expenses, "bg-red-100 text-red-800", "-")}

          {/* Net Result */}
          <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-slate-800 font-bold text-base text-white">
            <span>= RESULTADO LIQUIDO</span>
            <span className={data.netResultCents >= 0 ? "text-green-400" : "text-red-400"}>
              {fmt(data.netResultCents)}
            </span>
          </div>

          {/* Payment Breakdown Toggle */}
          <div className="mt-4 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Agrupar por pagamento:</label>
            <select
              value={paymentView}
              onChange={(e) => setPaymentView(e.target.value as PaymentView)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="none">Nenhum</option>
              <option value="byMethod">Por forma de pagamento</option>
              <option value="byInstrument">Por instrumento</option>
            </select>
          </div>

          {/* Payment by Method */}
          {paymentView === "byMethod" && data.paymentBreakdown && (
            <div className="mt-3">
              <div className="flex justify-between items-center py-2 px-3 rounded-t-lg bg-indigo-100 text-indigo-800 font-semibold text-sm">
                <span>DETALHAMENTO POR FORMA DE PAGAMENTO</span>
                <span>{data.paymentBreakdown.byMethod.length} forma(s)</span>
              </div>
              <div className="border border-t-0 rounded-b-lg divide-y divide-slate-100">
                <div className="grid grid-cols-5 gap-2 py-1.5 px-3 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase">
                  <span className="col-span-2">Forma</span>
                  <span className="text-right">Recebido</span>
                  <span className="text-right">Pago</span>
                  <span className="text-right">Saldo</span>
                </div>
                {data.paymentBreakdown.byMethod.map((item) => (
                  <div key={item.code} className="grid grid-cols-5 gap-2 py-1.5 px-3 text-xs text-slate-700">
                    <span className="col-span-2 font-medium">{item.name} <span className="text-slate-400">({item.count})</span></span>
                    <span className="text-right text-green-700">{fmt(item.receivableCents)}</span>
                    <span className="text-right text-red-700">{fmt(item.payableCents)}</span>
                    <span className={`text-right font-medium ${item.netCents >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(item.netCents)}</span>
                  </div>
                ))}
                {data.paymentBreakdown.noMethodCents.count > 0 && (
                  <div className="grid grid-cols-5 gap-2 py-1.5 px-3 text-xs text-slate-500 italic">
                    <span className="col-span-2">Sem forma definida ({data.paymentBreakdown.noMethodCents.count})</span>
                    <span className="text-right">{fmt(data.paymentBreakdown.noMethodCents.receivableCents)}</span>
                    <span className="text-right">{fmt(data.paymentBreakdown.noMethodCents.payableCents)}</span>
                    <span className="text-right">{fmt(data.paymentBreakdown.noMethodCents.receivableCents - data.paymentBreakdown.noMethodCents.payableCents)}</span>
                  </div>
                )}
                {data.paymentBreakdown.byMethod.length === 0 && data.paymentBreakdown.noMethodCents.count === 0 && (
                  <div className="py-2 px-3 text-xs text-slate-400 text-center">Nenhum dado no periodo</div>
                )}
              </div>
            </div>
          )}

          {/* Payment by Instrument */}
          {paymentView === "byInstrument" && data.paymentBreakdown && (
            <div className="mt-3">
              <div className="flex justify-between items-center py-2 px-3 rounded-t-lg bg-violet-100 text-violet-800 font-semibold text-sm">
                <span>DETALHAMENTO POR INSTRUMENTO</span>
                <span>{data.paymentBreakdown.byInstrument.length} instrumento(s)</span>
              </div>
              <div className="border border-t-0 rounded-b-lg divide-y divide-slate-100">
                <div className="grid grid-cols-6 gap-2 py-1.5 px-3 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase">
                  <span className="col-span-2">Instrumento</span>
                  <span>Tipo</span>
                  <span className="text-right">Recebido</span>
                  <span className="text-right">Pago</span>
                  <span className="text-right">Saldo</span>
                </div>
                {data.paymentBreakdown.byInstrument.map((item) => (
                  <div key={item.id} className="grid grid-cols-6 gap-2 py-1.5 px-3 text-xs text-slate-700">
                    <span className="col-span-2 font-medium">{item.name} <span className="text-slate-400">({item.count})</span></span>
                    <span className="text-slate-500">{item.methodName}</span>
                    <span className="text-right text-green-700">{fmt(item.receivableCents)}</span>
                    <span className="text-right text-red-700">{fmt(item.payableCents)}</span>
                    <span className={`text-right font-medium ${item.netCents >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(item.netCents)}</span>
                  </div>
                ))}
                {data.paymentBreakdown.byInstrument.length === 0 && (
                  <div className="py-2 px-3 text-xs text-slate-400 text-center">
                    Nenhum instrumento associado no periodo. Cadastre instrumentos na aba &quot;Instrumentos&quot;.
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 text-right mt-2">
            Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}
