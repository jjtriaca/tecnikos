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
};

const STATUS_LABELS: Record<string, string> = {
  ATRIBUIDA: "Pendente",
  EM_EXECUCAO: "Em Andamento",
  CONCLUIDA: "Concluída",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  ATRIBUIDA: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", dot: "bg-amber-500" },
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

  // Group by status
  const groups = [
    { key: "ATRIBUIDA", label: "Pendentes", orders: orders.filter((o) => o.status === "ATRIBUIDA") },
    { key: "EM_EXECUCAO", label: "Em Andamento", orders: orders.filter((o) => o.status === "EM_EXECUCAO") },
    { key: "AJUSTE", label: "Ajustes Necessários", orders: orders.filter((o) => o.status === "AJUSTE") },
    { key: "CONCLUIDA", label: "Concluídas Hoje", orders: orders.filter((o) => o.status === "CONCLUIDA" && new Date(o.createdAt).toDateString() === new Date().toDateString()) },
    { key: "APROVADA", label: "Aprovadas", orders: orders.filter((o) => o.status === "APROVADA").slice(0, 5) },
  ].filter((g) => g.orders.length > 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Minhas OS</h1>
        <p className="text-xs text-slate-500">
          {orders.length} ordem{orders.length !== 1 ? "ns" : ""} atribuída{orders.length !== 1 ? "s" : ""}
        </p>
      </div>

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
