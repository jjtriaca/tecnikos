"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { techApi } from "@/contexts/TechAuthContext";

type Row = {
  id: string; code: string; title: string; serviceName: string;
  date: string; enRouteAt: string | null; startedAt: string | null; completedAt: string | null;
  totalMinutes: number; travelMinutes: number; executionMinutes: number;
  pauseMinutes: number; netMinutes: number; overtimeMinutes: number;
};

type Report = {
  technician: { name: string } | null;
  summary: {
    totalOs: number; totalNetMinutes: number;
    totalTravelMinutes: number; totalPauseMinutes: number;
    totalOvertimeMinutes: number; avgScore: number;
  };
  rows: Row[];
};

function fmtTime(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
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

export default function TechReportPage() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const data = await techApi<Report>(`/reports/my-services?from=${dateFrom}&to=${dateTo}`);
      setReport(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const s = report?.summary;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push("/tech/orders")} className="text-slate-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-800">Meus Servicos</h1>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-[10px] text-slate-500 mb-0.5">De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-slate-500 mb-0.5">Ate</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all">
          {loading ? "Gerando..." : "Gerar Relatorio"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-xl font-bold text-slate-800">{s?.totalOs || 0}</p>
              <p className="text-[10px] text-slate-500">OS Concluidas</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{fmtTime(s?.totalNetMinutes || 0)}</p>
              <p className="text-[10px] text-slate-500">Tempo Liquido</p>
            </div>
          </div>

          {/* Time breakdown */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-xs font-semibold text-slate-700">{fmtTime(s?.totalTravelMinutes || 0)}</p>
              <p className="text-[9px] text-slate-400">Desloc.</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-xs font-semibold text-slate-700">{fmtTime(s?.totalPauseMinutes || 0)}</p>
              <p className="text-[9px] text-slate-400">Pausas</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-center">
              <p className="text-xs font-semibold text-amber-700">{fmtTime(s?.totalOvertimeMinutes || 0)}</p>
              <p className="text-[9px] text-amber-500">Fora exp.</p>
            </div>
          </div>

          {/* OS list (card-based for mobile) */}
          {report.rows.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">Nenhuma OS no periodo</div>
          ) : (
            <div className="space-y-2">
              {report.rows.map(r => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-400">{r.code}</span>
                    <span className="text-[10px] text-slate-400">{fmtDate(r.completedAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate mb-1">{r.title}</p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{r.serviceName}</p>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-slate-500">🚗 {fmtHour(r.enRouteAt)}</span>
                    <span className="text-slate-500">▶ {fmtHour(r.startedAt)}</span>
                    <span className="text-slate-500">✓ {fmtHour(r.completedAt)}</span>
                    <span className="ml-auto font-semibold text-blue-600">{fmtTime(r.netMinutes)}</span>
                  </div>
                  {r.pauseMinutes > 0 && (
                    <p className="text-[9px] text-slate-400 mt-1">Pausas: {fmtTime(r.pauseMinutes)}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Total footer */}
          {report.rows.length > 0 && (
            <div className="mt-3 rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
              <p className="text-xs text-blue-700 font-semibold">
                Total: {report.rows.length} OS · {fmtTime(s?.totalNetMinutes || 0)} trabalhados
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
