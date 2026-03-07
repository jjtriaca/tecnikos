"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ══════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════ */

interface ServicoTomadoItem {
  id: string;
  dataEmissao: string | null;
  numero: string | null;
  competencia: string | null;
  prestadorCnpjCpf: string | null;
  prestadorRazaoSocial: string | null;
  prestadorMunicipio: string | null;
  itemListaServico: string | null;
  discriminacao: string | null;
  valorServicosCents: number | null;
  baseCalculoCents: number | null;
  aliquotaIss: number | null;
  issRetido: boolean;
  valorIssCents: number | null;
  valorPisCents: number | null;
  valorCofinsCents: number | null;
  valorInssCents: number | null;
  valorIrCents: number | null;
  valorCsllCents: number | null;
  valorLiquidoCents: number | null;
}

/* ══════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function fmtCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  if (cents === 0) return "—";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtCnpjCpf(doc: string | null) {
  if (!doc) return "—";
  if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

function fmtAliquota(aliq: number | null) {
  if (aliq == null) return "—";
  return `${aliq.toFixed(2)}%`;
}

/* ══════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════ */

export default function ServicosTomadosPage() {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<ServicoTomadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<ServicoTomadoItem[]>(`/fiscal-periods/servicos-tomados?year=${year}&month=${month}`);
      setItems(result);
    } catch {
      toast("Erro ao carregar servicos tomados", "error");
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Totals
  const totals = items.reduce((acc, it) => ({
    valorServicos: acc.valorServicos + (it.valorServicosCents || 0),
    baseCalculo: acc.baseCalculo + (it.baseCalculoCents || 0),
    iss: acc.iss + (it.valorIssCents || 0),
    issRetido: acc.issRetido + (it.issRetido ? (it.valorIssCents || 0) : 0),
    pis: acc.pis + (it.valorPisCents || 0),
    cofins: acc.cofins + (it.valorCofinsCents || 0),
    inss: acc.inss + (it.valorInssCents || 0),
    ir: acc.ir + (it.valorIrCents || 0),
    csll: acc.csll + (it.valorCsllCents || 0),
    liquido: acc.liquido + (it.valorLiquidoCents || 0),
  }), { valorServicos: 0, baseCalculo: 0, iss: 0, issRetido: 0, pis: 0, cofins: 0, inss: 0, ir: 0, csll: 0, liquido: 0 });

  const totalRetencoes = totals.pis + totals.cofins + totals.inss + totals.ir + totals.csll + totals.issRetido;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Servicos Tomados</h1>
          <p className="text-sm text-slate-500 mt-1">NFS-e de entrada — Livro de Registro de Servicos Tomados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-bold text-slate-800 min-w-[180px] text-center">{MONTH_NAMES[month]}/{year}</span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total NFS-e</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Valor Servicos</p>
          <p className="text-lg font-bold text-green-600 mt-1">R$ {fmtCents(totals.valorServicos)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">ISS Retido</p>
          <p className="text-lg font-bold text-blue-600 mt-1">R$ {fmtCents(totals.issRetido)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Retencoes</p>
          <p className="text-lg font-bold text-red-600 mt-1">R$ {fmtCents(totalRetencoes)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Valor Liquido</p>
          <p className="text-lg font-bold text-slate-800 mt-1">R$ {fmtCents(totals.liquido)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-lg font-medium">Nenhuma NFS-e de entrada encontrada</p>
            <p className="text-sm mt-1">Importe NFS-e em NFS-e Entrada para popular este livro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-medium w-8"></th>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">NFS-e</th>
                  <th className="px-4 py-3 font-medium">Prestador</th>
                  <th className="px-4 py-3 font-medium">CNPJ/CPF</th>
                  <th className="px-4 py-3 font-medium">Item LC 116</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Servico</th>
                  <th className="px-4 py-3 font-medium text-right">Aliq. ISS</th>
                  <th className="px-4 py-3 font-medium text-right">ISS</th>
                  <th className="px-4 py-3 font-medium text-center">Retido</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Liquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((it, idx) => (
                  <>
                    <tr key={it.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}>
                      <td className="px-4 py-2.5">
                        <svg className={`h-4 w-4 text-slate-400 transition-transform ${expandedId === it.id ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-slate-700">{fmtDate(it.dataEmissao)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{it.numero || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate">{it.prestadorRazaoSocial || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{fmtCnpjCpf(it.prestadorCnpjCpf)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{it.itemListaServico || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtCents(it.valorServicosCents)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmtAliquota(it.aliquotaIss)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-600">{fmtCents(it.valorIssCents)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {it.issRetido ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Sim</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Nao</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtCents(it.valorLiquidoCents)}</td>
                    </tr>
                    {/* Expanded Detail */}
                    {expandedId === it.id && (
                      <tr key={`${it.id}-detail`} className="bg-slate-50">
                        <td colSpan={12} className="px-8 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Discriminacao</p>
                              <p className="text-slate-700 text-xs">{it.discriminacao || "—"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Municipio Prestacao</p>
                              <p className="text-slate-700">{it.prestadorMunicipio || "—"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Base de Calculo</p>
                              <p className="text-slate-700">R$ {fmtCents(it.baseCalculoCents)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Competencia</p>
                              <p className="text-slate-700">{it.competencia || "—"}</p>
                            </div>
                          </div>
                          {/* Retencoes federais */}
                          {(it.valorPisCents || it.valorCofinsCents || it.valorInssCents || it.valorIrCents || it.valorCsllCents) ? (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <p className="text-xs text-slate-500 mb-2 font-medium">Retencoes Federais</p>
                              <div className="flex flex-wrap gap-4 text-sm">
                                {it.valorPisCents ? <div><span className="text-slate-500">PIS:</span> <span className="text-purple-600 font-medium">R$ {fmtCents(it.valorPisCents)}</span></div> : null}
                                {it.valorCofinsCents ? <div><span className="text-slate-500">COFINS:</span> <span className="text-purple-600 font-medium">R$ {fmtCents(it.valorCofinsCents)}</span></div> : null}
                                {it.valorInssCents ? <div><span className="text-slate-500">INSS:</span> <span className="text-orange-600 font-medium">R$ {fmtCents(it.valorInssCents)}</span></div> : null}
                                {it.valorIrCents ? <div><span className="text-slate-500">IR:</span> <span className="text-red-600 font-medium">R$ {fmtCents(it.valorIrCents)}</span></div> : null}
                                {it.valorCsllCents ? <div><span className="text-slate-500">CSLL:</span> <span className="text-red-600 font-medium">R$ {fmtCents(it.valorCsllCents)}</span></div> : null}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-800">
                  <td className="px-4 py-3" colSpan={7}>TOTAIS</td>
                  <td className="px-4 py-3 text-right">{fmtCents(totals.valorServicos)}</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right text-blue-600">{fmtCents(totals.iss)}</td>
                  <td className="px-4 py-3 text-center text-xs text-blue-600">{fmtCents(totals.issRetido)}</td>
                  <td className="px-4 py-3 text-right">{fmtCents(totals.liquido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
