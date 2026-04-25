"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { exportToCSV, fmtMoney, type ExportColumn } from "@/lib/export-utils";

type FinanceData = {
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  totalCount: number;
  confirmedCount: number;
  byMonth: { month: string; gross: number; commission: number; net: number; count: number }[];
  byTechnician: { id: string; name: string; gross: number; commission: number; net: number; count: number }[];
  ledgers: any[];
};

type OrdersData = {
  total: number;
  totalValue: number;
  overdue: number;
  byStatus: { status: string; count: number }[];
  byDay: { day: string; count: number }[];
};

type TechData = {
  id: string;
  name: string;
  phone: string;
  rating: number;
  status: string;
  totalOs: number;
  completedOs: number;
  totalValue: number;
  completionRate: number;
}[];

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta", OFERTADA: "Ofertada", ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em Execução", CONCLUIDA: "Concluída", APROVADA: "Aprovada",
  AJUSTE: "Ajuste", CANCELADA: "Cancelada", RECUSADA: "Recusada",
};

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "#eab308", OFERTADA: "#f97316", ATRIBUIDA: "#3b82f6",
  EM_EXECUCAO: "#6366f1", CONCLUIDA: "#22c55e", APROVADA: "#10b981",
  AJUSTE: "#f59e0b", CANCELADA: "#94a3b8", RECUSADA: "#ef4444",
};

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TABS = ["Financeiro", "Ordens de Serviço", "Técnicos"];

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [orders, setOrders] = useState<OrdersData | null>(null);
  const [techs, setTechs] = useState<TechData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const qs = [dateFrom && `from=${dateFrom}`, dateTo && `to=${dateTo}`].filter(Boolean).join("&");
      const [f, o, t] = await Promise.all([
        api.get<FinanceData>(`/reports/finance${qs ? `?${qs}` : ""}`),
        api.get<OrdersData>(`/reports/orders${qs ? `?${qs}` : ""}`),
        api.get<TechData>("/reports/technicians"),
      ]);
      setFinance(f);
      setOrders(o);
      setTechs(t);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleFilter() {
    loadData();
  }

  function handleExportReport() {
    const date = new Date().toISOString().slice(0, 10);
    if (tab === 0 && finance) {
      // Financeiro por mês
      type MonthRow = { month: string; gross: number; commission: number; net: number; count: number };
      const cols: ExportColumn<MonthRow>[] = [
        { header: "Mês", value: (r) => r.month },
        { header: "Receita Bruta (R$)", value: (r) => (r.gross / 100).toFixed(2).replace(".", ",") },
        { header: "Comissão (R$)", value: (r) => (r.commission / 100).toFixed(2).replace(".", ",") },
        { header: "Repasse Líquido (R$)", value: (r) => (r.net / 100).toFixed(2).replace(".", ",") },
        { header: "Qtd OS", value: (r) => r.count },
      ];
      exportToCSV(finance.byMonth, cols, `relatorio-financeiro-${date}.csv`);
    } else if (tab === 1 && orders) {
      // OS por status
      type StatusRow = { status: string; count: number };
      const cols: ExportColumn<StatusRow>[] = [
        { header: "Status", value: (r) => STATUS_LABELS[r.status] || r.status },
        { header: "Quantidade", value: (r) => r.count },
      ];
      exportToCSV(orders.byStatus, cols, `relatorio-ordens-${date}.csv`);
    } else if (tab === 2 && techs) {
      // Técnicos
      type TechRow = { name: string; totalOs: number; completedOs: number; totalValue: number; rating: number; completionRate: number };
      const cols: ExportColumn<TechRow>[] = [
        { header: "Técnico", value: (r) => r.name },
        { header: "Total OS", value: (r) => r.totalOs },
        { header: "Concluídas", value: (r) => r.completedOs },
        { header: "Valor Total (R$)", value: (r) => (r.totalValue / 100).toFixed(2).replace(".", ",") },
        { header: "Rating", value: (r) => r.rating?.toFixed(1) || "0" },
        { header: "Taxa Conclusão (%)", value: (r) => (r.completionRate * 100).toFixed(0) },
      ];
      exportToCSV(techs as any, cols, `relatorio-tecnicos-${date}.csv`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500">Relatórios operacionais e financeiros do seu negócio.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReport}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Exportar CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Imprimir / PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            PDF
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="text-xs text-slate-500">De</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="block rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Até</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="block rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
        </div>
        <button onClick={handleFilter} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
          Filtrar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === i ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Tab 0: Financeiro ── */}
          {tab === 0 && finance && (
            <div>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard label="Receita Bruta" value={formatCurrency(finance.totalGross)} color="blue" />
                <SummaryCard label="Comissões" value={formatCurrency(finance.totalCommission)} color="amber" />
                <SummaryCard label="Repasse Líquido" value={formatCurrency(finance.totalNet)} color="green" />
                <SummaryCard label="OS Confirmadas" value={String(finance.confirmedCount)} color="emerald" />
              </div>

              {/* By Technician */}
              {finance.byTechnician.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Receita por Técnico</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2">Técnico</th>
                        <th className="text-right py-2">Bruto</th>
                        <th className="text-right py-2">Comissão</th>
                        <th className="text-right py-2">Líquido</th>
                        <th className="text-right py-2">OS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finance.byTechnician.map((t) => (
                        <tr key={t.id} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-800">{t.name}</td>
                          <td className="py-2 text-right text-slate-600">{formatCurrency(t.gross)}</td>
                          <td className="py-2 text-right text-amber-600">{formatCurrency(t.commission)}</td>
                          <td className="py-2 text-right text-green-600 font-medium">{formatCurrency(t.net)}</td>
                          <td className="py-2 text-right text-slate-500">{t.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* By Month */}
              {finance.byMonth.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Receita por Mês</h3>
                  <div className="space-y-2">
                    {finance.byMonth.map((m) => (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-slate-500">{m.month}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                            style={{ width: `${Math.min(100, (m.gross / Math.max(...finance.byMonth.map((x) => x.gross))) * 100)}%` }}
                          />
                        </div>
                        <span className="w-28 text-right text-xs font-medium text-slate-700">{formatCurrency(m.gross)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 1: OS ── */}
          {tab === 1 && orders && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard label="Total de OS" value={String(orders.total)} color="blue" />
                <SummaryCard label="Valor Total" value={formatCurrency(orders.totalValue)} color="green" />
                <SummaryCard label="Atrasadas" value={String(orders.overdue)} color="red" />
                <SummaryCard label="Status" value={`${orders.byStatus.length} tipos`} color="slate" />
              </div>

              {/* Status distribution */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribuição por Status</h3>
                <div className="space-y-2">
                  {orders.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-slate-600">{STATUS_LABELS[s.status] || s.status}</span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (s.count / orders.total) * 100)}%`,
                            backgroundColor: STATUS_COLORS[s.status] || "#94a3b8",
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-medium text-slate-700">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By day */}
              {orders.byDay.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">OS por Dia (últimos registros)</h3>
                  <div className="flex gap-1 items-end h-32">
                    {orders.byDay.slice(-30).map((d) => {
                      const max = Math.max(...orders.byDay.map((x) => x.count));
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center" title={`${d.day}: ${d.count} OS`}>
                          <div
                            className="w-full bg-blue-400 rounded-t min-h-[2px]"
                            style={{ height: `${(d.count / max) * 100}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{orders.byDay[Math.max(0, orders.byDay.length - 30)]?.day}</span>
                    <span>{orders.byDay[orders.byDay.length - 1]?.day}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 2: Técnicos ── */}
          {tab === 2 && techs && (
            <div>
              {techs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
                  Nenhum técnico cadastrado.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-3 px-4 text-left font-medium text-slate-600">#</th>
                        <th className="py-3 px-4 text-left font-medium text-slate-600">Técnico</th>
                        <th className="py-3 px-4 text-right font-medium text-slate-600">Rating</th>
                        <th className="py-3 px-4 text-right font-medium text-slate-600">OS Total</th>
                        <th className="py-3 px-4 text-right font-medium text-slate-600">Concluídas</th>
                        <th className="py-3 px-4 text-right font-medium text-slate-600">Taxa</th>
                        <th className="py-3 px-4 text-right font-medium text-slate-600">Valor Total</th>
                        <th className="py-3 px-4 text-center font-medium text-slate-600"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {techs.map((t, idx) => (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-100">
                          <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800">{t.name}</p>
                            <p className="text-xs text-slate-400">{t.status === "ATIVO" ? "Ativo" : "Inativo"}</p>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-yellow-500">★</span> {t.rating.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">{t.totalOs}</td>
                          <td className="py-3 px-4 text-right text-green-600 font-medium">{t.completedOs}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              t.completionRate >= 80 ? "bg-green-100 text-green-700" :
                              t.completionRate >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            }`}>
                              {t.completionRate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-800">{formatCurrency(t.totalValue)}</td>
                          <td className="py-3 px-4 text-center">
                            <a href={`/reports/technician?tech=${t.id}`}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                              Detalhes
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.slate}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}
