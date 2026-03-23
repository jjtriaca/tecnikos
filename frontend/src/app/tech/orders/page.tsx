"use client";

import { useEffect, useState } from "react";
import { techApi } from "@/contexts/TechAuthContext";
import Link from "next/link";

type ServiceOrder = {
  id: string;
  title: string;
  description?: string;
  addressText: string;
  status: string;
  valueCents: number;
  deadlineAt: string;
  createdAt: string;
  completedAt?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Aguardando Aceite",
  ATRIBUIDA: "Pendente",
  A_CAMINHO: "A Caminho",
  EM_EXECUCAO: "Em Andamento",
  CONCLUIDA: "Concluída",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  ABERTA: { bg: "bg-slate-50 border-slate-200", text: "text-slate-800", dot: "bg-slate-500" },
  OFERTADA: { bg: "bg-purple-50 border-purple-200", text: "text-purple-800", dot: "bg-purple-500" },
  ATRIBUIDA: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", dot: "bg-amber-500" },
  A_CAMINHO: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-800", dot: "bg-indigo-500" },
  EM_EXECUCAO: { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", dot: "bg-blue-500" },
  CONCLUIDA: { bg: "bg-green-50 border-green-200", text: "text-green-800", dot: "bg-green-500" },
  APROVADA: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", dot: "bg-emerald-500" },
  AJUSTE: { bg: "bg-red-50 border-red-200", text: "text-red-800", dot: "bg-red-500" },
};

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isOverdue(order: ServiceOrder) {
  return new Date(order.deadlineAt) < new Date() && !["CONCLUIDA", "APROVADA", "CANCELADA"].includes(order.status);
}

export default function TechOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await techApi<{ data: ServiceOrder[]; total: number }>("/service-orders?limit=100");
        setOrders(Array.isArray(res) ? res : (res.data || []));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // WorkDay state
  const [workDayActive, setWorkDayActive] = useState(false);
  const [workDayStartedAt, setWorkDayStartedAt] = useState<string | null>(null);
  const [workDayLoading, setWorkDayLoading] = useState(false);
  const [cltEnabled, setCltEnabled] = useState(false);

  useEffect(() => {
    // Check if CLT is enabled
    techApi<any>("/companies/system-config").then((cfg) => {
      if (cfg?.clt?.enabled) {
        setCltEnabled(true);
        // Only fetch workday if CLT enabled
        techApi<any>("/workday/today").then((res) => {
          if (res?.isActive) {
            setWorkDayActive(true);
            setWorkDayStartedAt(res.workDay?.startedAt);
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  async function toggleWorkDay() {
    setWorkDayLoading(true);
    try {
      if (workDayActive) {
        await techApi("/workday/end", { method: "POST", body: JSON.stringify({}) });
        setWorkDayActive(false);
        setWorkDayStartedAt(null);
      } else {
        const wd = await techApi<any>("/workday/start", { method: "POST", body: JSON.stringify({}) });
        setWorkDayActive(true);
        setWorkDayStartedAt(wd?.startedAt);
      }
    } catch {
    } finally {
      setWorkDayLoading(false);
    }
  }

  // Group by status
  const groups = [
    { key: "ABERTA", label: "Abertas", orders: orders.filter((o) => o.status === "ABERTA") },
    { key: "OFERTADA", label: "Aguardando Aceite", orders: orders.filter((o) => o.status === "OFERTADA") },
    { key: "ATRIBUIDA", label: "Pendentes", orders: orders.filter((o) => o.status === "ATRIBUIDA") },
    { key: "A_CAMINHO", label: "A Caminho", orders: orders.filter((o) => o.status === "A_CAMINHO") },
    { key: "EM_EXECUCAO", label: "Em Andamento", orders: orders.filter((o) => o.status === "EM_EXECUCAO") },
    { key: "AJUSTE", label: "Ajustes Necessários", orders: orders.filter((o) => o.status === "AJUSTE") },
    { key: "CONCLUIDA", label: "Concluídas Hoje", orders: orders.filter((o) => o.status === "CONCLUIDA" && o.completedAt && new Date(o.completedAt).toDateString() === new Date().toDateString()) },
    { key: "APROVADA", label: "Aprovadas", orders: orders.filter((o) => o.status === "APROVADA").slice(0, 5) },
  ].filter((g) => g.orders.length > 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Minhas OS</h1>
          <p className="text-xs text-slate-500">
            {orders.length} ordem{orders.length !== 1 ? "ns" : ""} atribuída{orders.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a href="/tech/report"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          📊 Relatorio
        </a>
      </div>

      {/* WorkDay card — only when CLT enabled */}
      {cltEnabled && <div className={`rounded-xl border p-3 mb-4 flex items-center justify-between ${
        workDayActive ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{workDayActive ? "🟢" : "⚪"}</span>
          <div>
            <p className="text-xs font-semibold text-slate-700">
              {workDayActive ? "Jornada ativa" : "Jornada nao iniciada"}
            </p>
            {workDayActive && workDayStartedAt && (
              <p className="text-[10px] text-slate-500">
                Inicio: {new Date(workDayStartedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
        <button onClick={toggleWorkDay} disabled={workDayLoading}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
            workDayActive
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}>
          {workDayLoading ? "..." : workDayActive ? "Encerrar" : "Iniciar Jornada"}
        </button>
      </div>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-5xl mb-4 opacity-30">📋</div>
          <p className="text-sm text-slate-400">Nenhuma OS atribuída a você.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const cfg = STATUS_CONFIG[group.key] || STATUS_CONFIG.ATRIBUIDA;
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                  <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {group.label} ({group.orders.length})
                  </h2>
                </div>

                <div className="space-y-2">
                  {group.orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/tech/orders/${order.id}`}
                      className={`block rounded-2xl border p-4 transition-all active:scale-[0.98] ${cfg.bg}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {order.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {order.addressText}
                          </p>
                        </div>
                        <span className="ml-2 text-sm font-bold text-slate-700 flex-shrink-0">
                          {formatCurrency(order.valueCents)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3">
                        <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                        {isOverdue(order) && (
                          <span className="rounded-lg bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            Atrasada
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto">
                          Prazo: {new Date(order.deadlineAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
