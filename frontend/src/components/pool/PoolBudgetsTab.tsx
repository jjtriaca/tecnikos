"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type PoolBudget = {
  id: string;
  code: string | null;
  title: string;
  status: string;
  totalCents: number;
  createdAt: string;
  clientPartner: { id: string; name: string };
  _count: { items: number };
};

type PoolProject = {
  id: string;
  code: string | null;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
  progressPercent: number;
  budget: { id: string; code: string | null; title: string; totalCents: number };
  customer: { id: string; name: string };
  _count?: { stages: number; entries: number; photos: number };
};

const STATUS_BUDGET: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  ENVIADO: { label: "Enviado", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  APROVADO: { label: "Aprovado", cls: "bg-green-100 text-green-700 border-green-300" },
  REJEITADO: { label: "Rejeitado", cls: "bg-red-100 text-red-700 border-red-300" },
  CANCELADO: { label: "Cancelado", cls: "bg-slate-200 text-slate-500 border-slate-400" },
  EXPIRADO: { label: "Expirado", cls: "bg-orange-100 text-orange-700 border-orange-300" },
};

const STATUS_PROJECT: Record<string, { label: string; cls: string }> = {
  PLANEJADA: { label: "Planejada", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  PAUSADA: { label: "Pausada", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  CONCLUIDA: { label: "Concluida", cls: "bg-green-100 text-green-700 border-green-300" },
  CANCELADA: { label: "Cancelada", cls: "bg-red-100 text-red-700 border-red-300" },
};

function fmtCurrency(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("pt-BR") : "—";
}

export default function PoolBudgetsTab() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<"orcamentos" | "obras">("orcamentos");
  const [budgets, setBudgets] = useState<PoolBudget[]>([]);
  const [projects, setProjects] = useState<PoolProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      if (subTab === "orcamentos") {
        const res = await api.get<{ data: PoolBudget[] }>(`/pool-budgets?${params.toString()}`);
        setBudgets(res.data || []);
      } else {
        const res = await api.get<{ data: PoolProject[] }>(`/pool-projects?${params.toString()}`);
        setProjects(res.data || []);
      }
    } catch (err: any) {
      const msg = err?.payload?.message || "Erro ao carregar dados de Piscina";
      if (String(msg).includes("não está ativo")) {
        toast("Modulo Piscina nao esta ativo. Ative em Configuracoes.", "error");
      } else {
        toast(msg, "error");
      }
    } finally {
      setLoading(false);
    }
  }, [subTab, search, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => { setSubTab("orcamentos"); setStatusFilter(""); }}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              subTab === "orcamentos" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Orcamentos
          </button>
          <button
            type="button"
            onClick={() => { setSubTab("obras"); setStatusFilter(""); }}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              subTab === "obras" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Obras
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={subTab === "orcamentos" ? "Buscar por codigo, titulo..." : "Buscar..."}
            className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          >
            <option value="">Todos os status</option>
            {Object.entries(subTab === "orcamentos" ? STATUS_BUDGET : STATUS_PROJECT).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <th className="px-4 py-3 text-left">Codigo</th>
              <th className="px-4 py-3 text-left">{subTab === "orcamentos" ? "Titulo" : "Orcamento"}</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-left">Status</th>
              {subTab === "obras" && <th className="px-4 py-3 text-left">Progresso</th>}
              <th className="px-4 py-3 text-left">{subTab === "obras" ? "Inicio" : "Criado em"}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={subTab === "obras" ? 8 : 7} className="py-16 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : subTab === "orcamentos" ? (
              budgets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    Nenhum orcamento de piscina ainda. Clique em &quot;Novo Orcamento de Obra&quot; pra comecar.
                  </td>
                </tr>
              ) : (
                budgets.map((b) => {
                  const st = STATUS_BUDGET[b.status] || { label: b.status, cls: "" };
                  return (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-100 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.code || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/quotes/pool/${b.id}`} className="font-medium text-slate-900 hover:text-cyan-600">
                          {b.title}
                        </Link>
                        <div className="text-xs text-slate-400">{b._count.items} item{b._count.items !== 1 ? "s" : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{b.clientPartner?.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtCurrency(b.totalCents)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(b.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/quotes/pool/${b.id}`} className="text-xs font-medium text-cyan-600 hover:text-cyan-800">
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )
            ) : (
              projects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    Nenhuma obra ainda. Aprove um orcamento pra gerar a obra automaticamente.
                  </td>
                </tr>
              ) : (
                projects.map((p) => {
                  const st = STATUS_PROJECT[p.status] || { label: p.status, cls: "" };
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-100 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.code || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/quotes/pool/projects/${p.id}`} className="font-medium text-slate-900 hover:text-cyan-600">
                          {p.budget?.title || "(sem titulo)"}
                        </Link>
                        <div className="text-xs text-slate-400 font-mono">{p.budget?.code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.customer?.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtCurrency(p.budget?.totalCents || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, p.progressPercent)}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{Math.round(p.progressPercent)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(p.startDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/quotes/pool/projects/${p.id}`} className="text-xs font-medium text-cyan-600 hover:text-cyan-800">
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
