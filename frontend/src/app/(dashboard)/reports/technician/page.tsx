"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { exportToCSV, fmtMoney, type ExportColumn } from "@/lib/export-utils";

type TechReport = {
  technician: {
    id: string; name: string; phone: string;
    rating: number; status: string; specializations: string[];
  } | null;
  summary: {
    totalOs: number; totalMinutes: number; totalNetMinutes: number;
    totalTravelMinutes: number; totalPauseMinutes: number; totalOvertimeMinutes: number;
    totalValueCents: number; totalCommissionCents: number; avgScore: number;
  };
  byService: { serviceName: string; count: number; minutes: number; commissionCents: number }[];
  rows: {
    id: string; code: string; title: string; status: string; serviceName: string;
    date: string; enRouteAt: string | null; startedAt: string | null; completedAt: string | null;
    totalMinutes: number; travelMinutes: number; executionMinutes: number;
    pauseMinutes: number; netMinutes: number; overtimeMinutes: number; pauseCount: number;
    valueCents: number; commissionCents: number;
    isReturn: boolean; isEvaluation: boolean;
  }[];
};

type TechOption = { id: string; name: string };

function fmtTime(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtHour(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function TechnicianReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Filters
  const [technicians, setTechnicians] = useState<TechOption[]>([]);
  const [selectedTech, setSelectedTech] = useState(searchParams.get("tech") || "");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Data
  const [report, setReport] = useState<TechReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOsValue, setShowOsValue] = useState(false); // toggle coluna Valor OS — default OFF

  const [autoLoaded, setAutoLoaded] = useState(false);

  // Load technicians list from reports endpoint (same as Técnicos tab)
  useEffect(() => {
    api.get<any[]>("/reports/technicians").then((techs) => {
      const list = (techs || []).map((t: any) => ({ id: t.id, name: t.name }));
      setTechnicians(list);
      if (list.length > 0 && !selectedTech) setSelectedTech(list[0].id);
    }).catch(() => {});
  }, []);

  // Auto-generate when pre-selected from query param
  useEffect(() => {
    if (selectedTech && technicians.length > 0 && !autoLoaded && !report) {
      setAutoLoaded(true);
      handleGenerate();
    }
  }, [selectedTech, technicians]);

  function handleGenerate() {
    if (!selectedTech) { toast("Selecione um tecnico", "error"); return; }
    setLoading(true);
    api.get<TechReport>(`/reports/technician-detail?technicianId=${selectedTech}&from=${dateFrom}&to=${dateTo}`)
      .then(setReport)
      .catch(() => toast("Erro ao gerar relatorio", "error"))
      .finally(() => setLoading(false));
  }

  function handleExportCSV() {
    if (!report?.rows.length) return;
    const cols: ExportColumn[] = [
      { header: "Codigo", value: (r: any) => r.code },
      { header: "Titulo", value: (r: any) => r.title },
      { header: "Servico", value: (r: any) => r.serviceName },
      { header: "Data", value: (r: any) => fmtDate(r.completedAt) },
      { header: "A caminho", value: (r: any) => fmtHour(r.enRouteAt) },
      { header: "Inicio", value: (r: any) => fmtHour(r.startedAt) },
      { header: "Conclusao", value: (r: any) => fmtHour(r.completedAt) },
      { header: "Tempo total", value: (r: any) => fmtTime(r.totalMinutes) },
      { header: "Pausas", value: (r: any) => fmtTime(r.pauseMinutes) },
      { header: "Tempo liquido", value: (r: any) => fmtTime(r.netMinutes) },
      { header: "Fora expediente", value: (r: any) => fmtTime(r.overtimeMinutes) },
      ...(showOsValue ? [
        { header: "Valor OS", value: (r: any) => fmtMoney(r.valueCents) },
      ] : []),
      { header: "Comissao", value: (r: any) => fmtMoney(r.commissionCents) },
    ];
    exportToCSV(report.rows, cols, `relatorio-tecnico-${report.technician?.name || "tech"}`);
  }

  const s = report?.summary;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/reports")}
            className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-slate-800">Relatorio do Tecnico</h1>
        </div>
        {report?.rows.length ? (
          <button onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
            📥 CSV
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tecnico</label>
            <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 outline-none">
              <option value="">Selecione...</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ate</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
          </div>
          <button onClick={handleGenerate} disabled={loading || !selectedTech}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "Gerando..." : "Gerar"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <>
          {/* Tech info */}
          {report.technician && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                  {report.technician.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{report.technician.name}</p>
                  <p className="text-xs text-slate-500">
                    {report.technician.phone || ""}
                    {report.technician.specializations.length > 0 && (
                      <span className="ml-2">{report.technician.specializations.join(", ")}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{s?.totalOs || 0}</p>
              <p className="text-[11px] text-slate-500">OS Concluidas</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{fmtTime(s?.totalNetMinutes || 0)}</p>
              <p className="text-[11px] text-slate-500">Tempo Liquido</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{fmtMoney(s?.totalCommissionCents || 0)}</p>
              <p className="text-[11px] text-slate-500">Comissao Total</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">⭐ {s?.avgScore?.toFixed(1) || "—"}</p>
              <p className="text-[11px] text-slate-500">Avaliacao Media</p>
            </div>
          </div>

          {/* Time breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-sm font-semibold text-slate-700">{fmtTime(s?.totalTravelMinutes || 0)}</p>
              <p className="text-[10px] text-slate-400">Deslocamento</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-sm font-semibold text-slate-700">{fmtTime((s?.totalNetMinutes || 0) - (s?.totalTravelMinutes || 0))}</p>
              <p className="text-[10px] text-slate-400">Execucao</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-sm font-semibold text-slate-700">{fmtTime(s?.totalPauseMinutes || 0)}</p>
              <p className="text-[10px] text-slate-400">Pausas</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-center">
              <p className="text-sm font-semibold text-amber-700">{fmtTime(s?.totalOvertimeMinutes || 0)}</p>
              <p className="text-[10px] text-amber-500">Fora expediente</p>
            </div>
          </div>

          {/* By service breakdown */}
          {report.byService.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Por Servico</h3>
              <div className="space-y-1.5">
                {report.byService.map((svc, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-slate-700 truncate">{svc.serviceName}</span>
                    <span className="text-xs text-slate-500 w-12 text-right">{svc.count} OS</span>
                    <span className="text-xs text-slate-500 w-16 text-right">{fmtTime(svc.minutes)}</span>
                    <span className="text-xs font-medium text-green-600 w-20 text-right">{fmtMoney(svc.commissionCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detail table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-6">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalhamento por OS</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                    <th className="px-3 py-2 text-left font-medium">Codigo</th>
                    <th className="px-3 py-2 text-left font-medium">Titulo</th>
                    <th className="px-3 py-2 text-left font-medium">Servico</th>
                    <th className="px-3 py-2 text-center font-medium">Data</th>
                    <th className="px-3 py-2 text-center font-medium">A caminho</th>
                    <th className="px-3 py-2 text-center font-medium">Inicio</th>
                    <th className="px-3 py-2 text-center font-medium">Conclusao</th>
                    <th className="px-3 py-2 text-center font-medium">Tempo</th>
                    <th className="px-3 py-2 text-center font-medium">Pausas</th>
                    <th className="px-3 py-2 text-center font-medium">Fora Exp.</th>
                    <th className="px-3 py-2 text-right font-medium">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={showOsValue} onChange={e => setShowOsValue(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3 w-3" />
                        <span className={showOsValue ? "" : "text-slate-300"}>Valor OS</span>
                      </label>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Comissao</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-400">Nenhuma OS encontrada no periodo</td></tr>
                  ) : report.rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-100">
                      <td className="px-3 py-2 text-xs font-mono text-slate-600">{r.code}</td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-[150px]">{r.title}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[120px]">{r.serviceName}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{fmtDate(r.completedAt)}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{fmtHour(r.enRouteAt)}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{fmtHour(r.startedAt)}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{fmtHour(r.completedAt)}</td>
                      <td className="px-3 py-2 text-center text-xs font-medium text-slate-700">{fmtTime(r.netMinutes)}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-400">
                        {r.pauseMinutes > 0 ? fmtTime(r.pauseMinutes) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-amber-600">
                        {r.overtimeMinutes > 0 ? fmtTime(r.overtimeMinutes) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-600">{showOsValue ? fmtMoney(r.valueCents) : "—"}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-green-600">{fmtMoney(r.commissionCents)}</td>
                    </tr>
                  ))}
                </tbody>
                {report.rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-xs">
                      <td colSpan={7} className="px-3 py-2 text-slate-600">TOTAL ({report.rows.length} OS)</td>
                      <td className="px-3 py-2 text-center text-slate-700">{fmtTime(s?.totalNetMinutes || 0)}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{fmtTime(s?.totalPauseMinutes || 0)}</td>
                      <td className="px-3 py-2 text-center text-amber-600">{fmtTime(s?.totalOvertimeMinutes || 0)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{showOsValue ? fmtMoney(s?.totalValueCents || 0) : "—"}</td>
                      <td className="px-3 py-2 text-right text-green-600">{fmtMoney(s?.totalCommissionCents || 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
