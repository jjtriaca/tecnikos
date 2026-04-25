"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ══════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════ */

interface LivroEntradaItem {
  id: string;
  dataEmissao: string | null;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  emitenteCnpj: string | null;
  emitenteRazaoSocial: string | null;
  cfop: string | null;
  valorTotalCents: number | null;
  baseIcmsCents: number | null;
  icmsCents: number | null;
  icmsStCents: number | null;
  ipiCents: number | null;
  pisCents: number | null;
  cofinsCents: number | null;
  freteCents: number | null;
  seguroCents: number | null;
  descontoCents: number | null;
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

function fmtCnpj(cnpj: string | null) {
  if (!cnpj) return "—";
  if (cnpj.length === 14) return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return cnpj;
}

/* ══════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════ */

export default function LivroEntradasPage() {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<LivroEntradaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<LivroEntradaItem[]>(`/fiscal-periods/livro-entradas?year=${year}&month=${month}`);
      setItems(result);
    } catch {
      toast("Erro ao carregar livro de entradas", "error");
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
    valor: acc.valor + (it.valorTotalCents || 0),
    baseIcms: acc.baseIcms + (it.baseIcmsCents || 0),
    icms: acc.icms + (it.icmsCents || 0),
    icmsSt: acc.icmsSt + (it.icmsStCents || 0),
    ipi: acc.ipi + (it.ipiCents || 0),
    pis: acc.pis + (it.pisCents || 0),
    cofins: acc.cofins + (it.cofinsCents || 0),
    frete: acc.frete + (it.freteCents || 0),
    desconto: acc.desconto + (it.descontoCents || 0),
  }), { valor: 0, baseIcms: 0, icms: 0, icmsSt: 0, ipi: 0, pis: 0, cofins: 0, frete: 0, desconto: 0 });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Livro de Entradas</h1>
          <p className="text-sm text-slate-500 mt-1">NFe de entrada importadas — Registro de Entradas de Mercadorias</p>
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
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Notas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Valor Total</p>
          <p className="text-lg font-bold text-green-600 mt-1">R$ {fmtCents(totals.valor)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">ICMS</p>
          <p className="text-lg font-bold text-blue-600 mt-1">R$ {fmtCents(totals.icms)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">IPI</p>
          <p className="text-lg font-bold text-orange-600 mt-1">R$ {fmtCents(totals.ipi)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">PIS + COFINS</p>
          <p className="text-lg font-bold text-purple-600 mt-1">R$ {fmtCents(totals.pis + totals.cofins)}</p>
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
            <p className="text-lg font-medium">Nenhuma NFe de entrada encontrada</p>
            <p className="text-sm mt-1">Importe NFe em NFe Entrada para popular este livro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Numero</th>
                  <th className="px-4 py-3 font-medium">Emitente</th>
                  <th className="px-4 py-3 font-medium">CNPJ</th>
                  <th className="px-4 py-3 font-medium">CFOP</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Total</th>
                  <th className="px-4 py-3 font-medium text-right">BC ICMS</th>
                  <th className="px-4 py-3 font-medium text-right">ICMS</th>
                  <th className="px-4 py-3 font-medium text-right">ICMS-ST</th>
                  <th className="px-4 py-3 font-medium text-right">IPI</th>
                  <th className="px-4 py-3 font-medium text-right">PIS</th>
                  <th className="px-4 py-3 font-medium text-right">COFINS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-slate-100">
                    <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-slate-700">{fmtDate(it.dataEmissao)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{it.numero || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate">{it.emitenteRazaoSocial || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{fmtCnpj(it.emitenteCnpj)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.cfop || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtCents(it.valorTotalCents)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmtCents(it.baseIcmsCents)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">{fmtCents(it.icmsCents)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmtCents(it.icmsStCents)}</td>
                    <td className="px-4 py-2.5 text-right text-orange-600">{fmtCents(it.ipiCents)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{fmtCents(it.pisCents)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{fmtCents(it.cofinsCents)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-800">
                  <td className="px-4 py-3" colSpan={6}>TOTAIS</td>
                  <td className="px-4 py-3 text-right">{fmtCents(totals.valor)}</td>
                  <td className="px-4 py-3 text-right">{fmtCents(totals.baseIcms)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{fmtCents(totals.icms)}</td>
                  <td className="px-4 py-3 text-right">{fmtCents(totals.icmsSt)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{fmtCents(totals.ipi)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{fmtCents(totals.pis)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{fmtCents(totals.cofins)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
