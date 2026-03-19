"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import type { AgendaOrder, TechnicianOption } from "@/types/agenda";

/* ── Helpers ──────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-yellow-50 border-yellow-300 text-yellow-800",
  OFERTADA: "bg-orange-50 border-orange-300 text-orange-800",
  ATRIBUIDA: "bg-blue-50 border-blue-300 text-blue-800",
  A_CAMINHO: "bg-indigo-50 border-indigo-300 text-indigo-800",
  EM_EXECUCAO: "bg-purple-50 border-purple-300 text-purple-800",
  CONCLUIDA: "bg-green-50 border-green-300 text-green-800",
  APROVADA: "bg-emerald-50 border-emerald-300 text-emerald-800",
  PAUSADA: "bg-amber-50 border-amber-300 text-amber-800",
  CANCELADA: "bg-slate-100 border-slate-300 text-slate-500",
  RECUSADA: "bg-red-50 border-red-300 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Ofertada",
  ATRIBUIDA: "Atribuida",
  A_CAMINHO: "A caminho",
  EM_EXECUCAO: "Em execucao",
  CONCLUIDA: "Concluida",
  APROVADA: "Aprovada",
  PAUSADA: "Pausada",
  CANCELADA: "Cancelada",
  RECUSADA: "Recusada",
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${MONTH_LABELS[d.getMonth()]}`;
}

function formatDateRange(from: Date, to: Date): string {
  const fromMonth = MONTH_LABELS[from.getMonth()];
  const toMonth = MONTH_LABELS[to.getMonth()];
  if (fromMonth === toMonth && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} - ${to.getDate()} ${toMonth} ${to.getFullYear()}`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} ${fromMonth} - ${to.getDate()} ${toMonth} ${to.getFullYear()}`;
  }
  return `${from.getDate()} ${fromMonth} ${from.getFullYear()} - ${to.getDate()} ${toMonth} ${to.getFullYear()}`;
}

function isPast(d: Date, today: Date): boolean {
  return d < today && !isSameDay(d, today);
}

/* ── Component ────────────────────────────────────────── */

export default function AgendaView() {
  const todayRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [centerDate, setCenterDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [orders, setOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTechId, setFilterTechId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 11 days: 5 before + today + 5 after
  const days = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => addDays(centerDate, i - 5));
  }, [centerDate]);

  const dateFrom = days[0];
  const dateTo = days[10];

  // Fetch technicians
  useEffect(() => {
    api.get<{ data: TechnicianOption[] }>("/partners?type=TECNICO&limit=200&page=1")
      .then((res) => setTechnicians(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Fetch agenda
  useEffect(() => {
    setLoading(true);
    const from = dateToISO(dateFrom);
    const to = dateToISO(dateTo);
    api.get<AgendaOrder[]>(`/service-orders/agenda?dateFrom=${from}&dateTo=${to}`)
      .then((res) => setOrders(Array.isArray(res) ? res : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [centerDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to today column on mount / center change
  useEffect(() => {
    if (!loading && todayRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [loading, centerDate]);

  // Navigation
  const goBack = () => setCenterDate((prev) => addDays(prev, -5));
  const goForward = () => setCenterDate((prev) => addDays(prev, 5));
  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCenterDate(d);
  };

  // Group orders by day
  const ordersByDay = useMemo(() => {
    const map: Record<string, AgendaOrder[]> = {};
    for (const order of orders) {
      if (!order.scheduledStartAt) continue;
      if (filterTechId && order.assignedPartner?.id !== filterTechId) continue;
      if (filterStatus && order.status !== filterStatus) continue;
      const key = dateToISO(new Date(order.scheduledStartAt));
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    // Sort each day by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime());
    }
    return map;
  }, [orders, filterTechId, filterStatus]);

  // Stats
  const totalFiltered = useMemo(() => {
    return Object.values(ordersByDay).reduce((sum, arr) => sum + arr.length, 0);
  }, [ordersByDay]);

  const techsWithOrders = useMemo(() => {
    const set = new Set<string>();
    for (const arr of Object.values(ordersByDay)) {
      for (const o of arr) {
        if (o.assignedPartner) set.add(o.assignedPartner.id);
      }
    }
    return set.size;
  }, [ordersByDay]);

  return (
    <div className="space-y-4">
      {/* Navigation + Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={goBack} title="5 dias antes"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button type="button" onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">
              Hoje
            </button>
            <button type="button" onClick={goForward} title="5 dias depois"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-slate-800 ml-2">
              {formatDateRange(dateFrom, dateTo)}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{totalFiltered} OS agendadas</span>
            <span>{techsWithOrders} {techsWithOrders === 1 ? "tecnico" : "tecnicos"}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Tecnico:</span>
            <select value={filterTechId} onChange={(e) => setFilterTechId(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none">
              <option value="">Todos</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Status:</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Day Columns Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <svg className="h-5 w-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Carregando agenda...
          </div>
        ) : (
          <div ref={scrollContainerRef} className="overflow-x-auto">
            <div className="flex min-w-max">
              {days.map((day, i) => {
                const isToday_ = isSameDay(day, today);
                const dayKey = dateToISO(day);
                const dayOrders = ordersByDay[dayKey] || [];
                const dayNum = day.getDay();
                const isWeekend = dayNum === 0 || dayNum === 6;
                const isPastDay = isPast(day, today);

                return (
                  <div
                    key={i}
                    ref={isToday_ ? todayRef : undefined}
                    className={`flex-1 min-w-[140px] border-r border-slate-100 last:border-r-0 ${
                      isToday_
                        ? "bg-blue-50/50"
                        : isPastDay
                          ? "bg-slate-50/40"
                          : isWeekend
                            ? "bg-slate-50/20"
                            : ""
                    }`}
                  >
                    {/* Day Header */}
                    <div className={`sticky top-0 px-2 py-2.5 text-center border-b ${
                      isToday_
                        ? "border-blue-400 bg-blue-100/70"
                        : "border-slate-200 bg-slate-50/80"
                    }`}>
                      <div className={`text-sm font-semibold ${
                        isToday_ ? "text-blue-700" : isWeekend ? "text-slate-400" : "text-slate-600"
                      }`}>
                        {DAY_LABELS[dayNum]}
                      </div>
                      <div className={`text-xs ${isToday_ ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                        {formatDateShort(day)}
                      </div>
                      {isToday_ && (
                        <div className="mt-0.5 text-[9px] font-bold text-blue-600 uppercase tracking-wider">Hoje</div>
                      )}
                      {dayOrders.length > 0 && (
                        <div className={`mt-1 text-[10px] font-medium ${
                          isToday_ ? "text-blue-500" : "text-slate-400"
                        }`}>
                          {dayOrders.length} OS
                        </div>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="p-1.5 space-y-1.5 min-h-[120px]">
                      {dayOrders.length === 0 ? (
                        <div className="flex items-center justify-center h-[100px] text-[10px] text-slate-300">
                          —
                        </div>
                      ) : (
                        dayOrders.map((order) => {
                          const start = new Date(order.scheduledStartAt);
                          const colors = STATUS_COLORS[order.status] || "bg-slate-100 border-slate-300 text-slate-700";
                          return (
                            <Link
                              key={order.id}
                              href={`/orders/${order.id}`}
                              className={`${colors} border rounded-lg px-2 py-1.5 block hover:shadow-md transition-shadow cursor-pointer`}
                              title={`${order.code} — ${order.title}\n${formatTime(start)}${order.estimatedDurationMinutes ? ` (${order.estimatedDurationMinutes}min)` : ""}\nTecnico: ${order.assignedPartner?.name || "—"}\nCliente: ${order.clientPartner?.name || "—"}\n${order.addressText || ""}`}
                            >
                              {/* Time + Duration */}
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="font-bold">{formatTime(start)}</span>
                                {order.estimatedDurationMinutes && (
                                  <span className="opacity-50 text-[9px]">{order.estimatedDurationMinutes}min</span>
                                )}
                              </div>

                              {/* Code */}
                              <div className="text-[10px] font-semibold mt-0.5 truncate font-mono">
                                {order.code}
                              </div>

                              {/* Technician */}
                              {order.assignedPartner && (
                                <div className="text-[10px] truncate mt-0.5 flex items-center gap-1">
                                  <svg className="w-2.5 h-2.5 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="truncate">{order.assignedPartner.name}</span>
                                </div>
                              )}

                              {/* Client */}
                              {order.clientPartner && (
                                <div className="text-[10px] truncate opacity-70 mt-0.5">
                                  {order.clientPartner.name}
                                </div>
                              )}

                              {/* City */}
                              {order.city && (
                                <div className="text-[9px] truncate opacity-50 mt-0.5">
                                  {order.neighborhood ? `${order.neighborhood}, ` : ""}{order.city}
                                </div>
                              )}

                              {/* Status badge */}
                              <div className="mt-1">
                                <span className="text-[8px] font-semibold uppercase tracking-wider opacity-70">
                                  {STATUS_LABELS[order.status] || order.status}
                                </span>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-medium mr-1">Legenda:</span>
          {Object.entries(STATUS_COLORS).filter(([k]) => k !== "CANCELADA").map(([status, colors]) => (
            <div key={status} className={`${colors} border rounded px-2 py-0.5 text-[10px] font-medium`}>
              {STATUS_LABELS[status] || status}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
