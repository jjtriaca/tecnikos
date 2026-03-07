"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ══════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════ */

interface Apuracao {
  period: { year: number; month: number };
  taxRegime: string;
  totalNfeEntrada: number;
  totalNfseEntrada: number;
  totalNfseSaida: number;
  icms: { debito: number; credito: number; saldo: number; st: number };
  ipi: { debito: number; credito: number; saldo: number };
  pis: { debito: number; credito: number; saldo: number };
  cofins: { debito: number; credito: number; saldo: number };
  iss: { devido: number; retido: number };
  totalEntradaCents: number;
  totalSaidaCents: number;
}

interface Obligation {
  name: string;
  deadline: string;
  deadlineDate: string;
  applicable: boolean;
  description: string;
}

interface FiscalPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  totalNfeEntrada: number | null;
  totalNfseEntrada: number | null;
  totalNfseSaida: number | null;
  totalEntradaCents: number | null;
  totalSaidaCents: number | null;
  issDevidoCents: number | null;
  issRetidoCents: number | null;
  closedAt: string | null;
  closedByName: string | null;
  notes: string | null;
}

interface DashboardData {
  taxRegime: string;
  cnae: string | null;
  fiscalProfile: string | null;
  currentPeriod: {
    year: number;
    month: number;
    apuracao: Apuracao;
  };
  periods: FiscalPeriod[];
  obligations: Obligation[];
}

/* ══════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function fmtCents(cents: number | null | undefined): string {
  if (cents == null) return "R$ 0,00";
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function regimeLabel(r: string) {
  if (r === "SN") return "Simples Nacional";
  if (r === "LP") return "Lucro Presumido";
  if (r === "LR") return "Lucro Real";
  return r;
}

function statusBadge(status: string) {
  if (status === "OPEN") return { label: "Aberto", bg: "bg-green-100 text-green-700" };
  if (status === "CLOSED") return { label: "Fechado", bg: "bg-blue-100 text-blue-700" };
  if (status === "FILED") return { label: "Escriturado", bg: "bg-purple-100 text-purple-700" };
  return { label: status, bg: "bg-gray-100 text-gray-700" };
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

/* ══════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════ */

export default function FiscalDashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingPeriod, setClosingPeriod] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const result = await api.get<DashboardData>("/fiscal-periods/dashboard");
      setData(result);
    } catch {
      toast("Erro ao carregar dashboard fiscal", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleClosePeriod = async (year: number, month: number) => {
    if (!confirm(`Deseja fechar o periodo ${MONTH_NAMES[month]}/${year}? Isso calculara a apuracao dos impostos.`)) return;
    setClosingPeriod(true);
    try {
      await api.post("/fiscal-periods/close", { year, month });
      toast("Periodo fechado com sucesso");
      fetchDashboard();
    } catch {
      toast("Erro ao fechar periodo", "error");
    } finally {
      setClosingPeriod(false);
    }
  };

  const handleReopenPeriod = async (id: string) => {
    if (!confirm("Deseja reabrir este periodo fiscal?")) return;
    try {
      await api.post(`/fiscal-periods/${id}/reopen`);
      toast("Periodo reaberto");
      fetchDashboard();
    } catch {
      toast("Erro ao reabrir periodo", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-gray-500">Erro ao carregar dados fiscais.</div>;
  }

  const { currentPeriod, periods, obligations, taxRegime } = data;
  const ap = currentPeriod.apuracao;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Fiscal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Regime: <span className="font-medium text-slate-700">{regimeLabel(taxRegime)}</span>
            {data.cnae && <> | CNAE: <span className="font-medium text-slate-700">{data.cnae}</span></>}
            {data.fiscalProfile && <> | Perfil EFD: <span className="font-medium text-slate-700">{data.fiscalProfile}</span></>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Competencia Atual</p>
          <p className="text-lg font-bold text-slate-800">{MONTH_NAMES[currentPeriod.month]}/{currentPeriod.year}</p>
        </div>
      </div>

      {/* KPI Cards - Periodo Atual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">NFe Entrada</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{ap.totalNfeEntrada}</p>
          <p className="text-xs text-slate-400">notas no periodo</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">NFS-e Entrada</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{ap.totalNfseEntrada}</p>
          <p className="text-xs text-slate-400">servicos tomados</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">NFS-e Saida</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{ap.totalNfseSaida}</p>
          <p className="text-xs text-slate-400">notas emitidas</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Entradas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmtCents(ap.totalEntradaCents)}</p>
          <p className="text-xs text-slate-400">NFe + NFS-e</p>
        </div>
      </div>

      {/* Apuracao Impostos - Periodo Atual */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Apuracao — {MONTH_NAMES[currentPeriod.month]}/{currentPeriod.year}</h2>
          <button
            onClick={() => handleClosePeriod(currentPeriod.year, currentPeriod.month)}
            disabled={closingPeriod}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {closingPeriod ? "Fechando..." : "Fechar Periodo"}
          </button>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Imposto</th>
                  <th className="pb-2 font-medium text-right">Debito</th>
                  <th className="pb-2 font-medium text-right">Credito</th>
                  <th className="pb-2 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {taxRegime !== "SN" && (
                  <>
                    <tr>
                      <td className="py-2.5 font-medium text-slate-700">ICMS</td>
                      <td className="py-2.5 text-right text-red-600">{fmtCents(ap.icms.debito)}</td>
                      <td className="py-2.5 text-right text-green-600">{fmtCents(ap.icms.credito)}</td>
                      <td className={`py-2.5 text-right font-semibold ${ap.icms.saldo > 0 ? "text-red-600" : "text-green-600"}`}>
                        {fmtCents(ap.icms.saldo)}
                      </td>
                    </tr>
                    {ap.icms.st > 0 && (
                      <tr>
                        <td className="py-2.5 font-medium text-slate-700 pl-4">ICMS-ST</td>
                        <td className="py-2.5 text-right">—</td>
                        <td className="py-2.5 text-right">—</td>
                        <td className="py-2.5 text-right text-slate-600">{fmtCents(ap.icms.st)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2.5 font-medium text-slate-700">IPI</td>
                      <td className="py-2.5 text-right text-red-600">{fmtCents(ap.ipi.debito)}</td>
                      <td className="py-2.5 text-right text-green-600">{fmtCents(ap.ipi.credito)}</td>
                      <td className={`py-2.5 text-right font-semibold ${ap.ipi.saldo > 0 ? "text-red-600" : "text-green-600"}`}>
                        {fmtCents(ap.ipi.saldo)}
                      </td>
                    </tr>
                  </>
                )}
                {taxRegime !== "SN" && (
                  <>
                    <tr>
                      <td className="py-2.5 font-medium text-slate-700">PIS</td>
                      <td className="py-2.5 text-right text-red-600">{fmtCents(ap.pis.debito)}</td>
                      <td className="py-2.5 text-right text-green-600">{fmtCents(ap.pis.credito)}</td>
                      <td className={`py-2.5 text-right font-semibold ${ap.pis.saldo > 0 ? "text-red-600" : "text-green-600"}`}>
                        {fmtCents(ap.pis.saldo)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-slate-700">COFINS</td>
                      <td className="py-2.5 text-right text-red-600">{fmtCents(ap.cofins.debito)}</td>
                      <td className="py-2.5 text-right text-green-600">{fmtCents(ap.cofins.credito)}</td>
                      <td className={`py-2.5 text-right font-semibold ${ap.cofins.saldo > 0 ? "text-red-600" : "text-green-600"}`}>
                        {fmtCents(ap.cofins.saldo)}
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="py-2.5 font-medium text-slate-700">ISS Devido</td>
                  <td className="py-2.5 text-right text-red-600">{fmtCents(ap.iss.devido)}</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right font-semibold text-red-600">{fmtCents(ap.iss.devido)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-slate-700">ISS Retido (entrada)</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right text-green-600">{fmtCents(ap.iss.retido)}</td>
                  <td className="py-2.5 text-right font-semibold text-green-600">{fmtCents(ap.iss.retido)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {taxRegime === "SN" && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              No Simples Nacional, ICMS/IPI/PIS/COFINS sao recolhidos via DAS. A apuracao acima mostra os valores para fins de escrituracao e informativo.
            </p>
          )}
        </div>
      </div>

      {/* Obrigacoes Fiscais */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Obrigacoes Fiscais — {MONTH_NAMES[currentPeriod.month]}/{currentPeriod.year}</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {obligations.map((ob, i) => {
              const overdue = isOverdue(ob.deadlineDate);
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${overdue ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
                  <div>
                    <p className={`font-medium ${overdue ? "text-red-700" : "text-slate-700"}`}>{ob.name}</p>
                    <p className="text-xs text-slate-500">{ob.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}>{ob.deadline}</p>
                    {overdue && <span className="text-xs text-red-500 font-medium">VENCIDA</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historico de Periodos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Periodos Fiscais</h2>
        </div>
        <div className="p-4">
          {periods.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum periodo fiscal registrado ainda. Feche o periodo atual para iniciar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2 font-medium">Periodo</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">NFe</th>
                    <th className="pb-2 font-medium text-right">NFS-e Ent.</th>
                    <th className="pb-2 font-medium text-right">NFS-e Sai.</th>
                    <th className="pb-2 font-medium text-right">Total Entradas</th>
                    <th className="pb-2 font-medium text-right">ISS Devido</th>
                    <th className="pb-2 font-medium text-right">Fechado por</th>
                    <th className="pb-2 font-medium text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {periods.map(p => {
                    const badge = statusBadge(p.status);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-700">{MONTH_NAMES[p.month]}/{p.year}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg}`}>{badge.label}</span>
                        </td>
                        <td className="py-2.5 text-right text-slate-600">{p.totalNfeEntrada ?? "—"}</td>
                        <td className="py-2.5 text-right text-slate-600">{p.totalNfseEntrada ?? "—"}</td>
                        <td className="py-2.5 text-right text-slate-600">{p.totalNfseSaida ?? "—"}</td>
                        <td className="py-2.5 text-right text-slate-600">{fmtCents(p.totalEntradaCents)}</td>
                        <td className="py-2.5 text-right text-red-600">{fmtCents(p.issDevidoCents)}</td>
                        <td className="py-2.5 text-right text-slate-500 text-xs">{p.closedByName || "—"}</td>
                        <td className="py-2.5 text-right">
                          {p.status !== "OPEN" && (
                            <button
                              onClick={() => handleReopenPeriod(p.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Reabrir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
