"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

/* ── Types ───────────────────────────────────────────── */

interface TechnicianOption {
  id: string;
  name: string;
  phone: string | null;
}

interface AgendaOrder {
  id: string;
  code: string;
  title: string;
  status: string;
  scheduledStartAt: string;
  estimatedDurationMinutes: number | null;
  valueCents: number | null;
  addressText: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  assignedPartner: { id: string; name: string; phone: string | null } | null;
  clientPartner: { id: string; name: string } | null;
}

/* ── Helpers ──────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-yellow-100 border-yellow-300 text-yellow-800",
  OFERTADA: "bg-orange-100 border-orange-300 text-orange-800",
  ATRIBUIDA: "bg-blue-100 border-blue-300 text-blue-800",
  A_CAMINHO: "bg-indigo-100 border-indigo-300 text-indigo-800",
  EM_EXECUCAO: "bg-purple-100 border-purple-300 text-purple-800",
  CONCLUIDA: "bg-green-100 border-green-300 text-green-800",
  PAUSADA: "bg-amber-100 border-amber-300 text-amber-800",
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Ofertada",
  ATRIBUIDA: "Atribuida",
  A_CAMINHO: "A caminho",
  EM_EXECUCAO: "Em execucao",
  CONCLUIDA: "Concluida",
  PAUSADA: "Pausada",
  CANCELADA: "Cancelada",
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const DAY_LABELS_FULL = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${MONTH_LABELS[d.getMonth()]}`;
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/* ── Page Component ──────────────────────────────────── */

export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [agendaOrders, setAgendaOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTechId, setFilterTechId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const startMonth = MONTH_LABELS[weekStart.getMonth()];
    const endMonth = MONTH_LABELS[end.getMonth()];
    if (startMonth === endMonth) {
      return `${weekStart.getDate()} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }, [weekStart]);

  // Fetch technicians
  useEffect(() => {
    api.get<{ data: TechnicianOption[] }>("/partners?type=TECNICO&limit=200&page=1")
      .then(res => setTechnicians(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Fetch agenda
  useEffect(() => {
    const dateFrom = dateToISO(weekStart);
    const dateTo = dateToISO(addDays(weekStart, 6));
    setLoading(true);
    api.get<AgendaOrder[]>(`/service-orders/agenda?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then(res => setAgendaOrders(Array.isArray(res) ? res : []))
      .catch(() => setAgendaOrders([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  // Navigation
  const goToday = () => setWeekStart(startOfWeek(new Date()));
  const goPrev = () => setWeekStart(prev => addDays(prev, -7));
  const goNext = () => setWeekStart(prev => addDays(prev, 7));

  // Filter technicians
  const visibleTechs = useMemo(() => {
    if (!filterTechId) return technicians;
    return technicians.filter(t => t.id === filterTechId);
  }, [technicians, filterTechId]);

  // Orders grouped by tech+day
  const ordersByTechDay = useMemo(() => {
    const map: Record<string, AgendaOrder[]> = {};
    for (const order of agendaOrders) {
      if (!order.assignedPartner || !order.scheduledStartAt) continue;
      if (filterStatus && order.status !== filterStatus) continue;
      const d = new Date(order.scheduledStartAt);
      const key = `${order.assignedPartner.id}_${dateToISO(d)}`;
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime());
    }
    return map;
  }, [agendaOrders, filterStatus]);

  // Unscheduled orders (no scheduledStartAt but assigned)
  const unscheduledOrders = useMemo(() => {
    return agendaOrders.filter(o => !o.scheduledStartAt);
  }, [agendaOrders]);

  // Stats
  const stats = useMemo(() => {
    const total = agendaOrders.length;
    const byStatus: Record<string, number> = {};
    for (const o of agendaOrders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    }
    const techsWithOrders = new Set(agendaOrders.filter(o => o.assignedPartner).map(o => o.assignedPartner!.id)).size;
    return { total, byStatus, techsWithOrders };
  }, [agendaOrders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visao semanal dos servicos agendados</p>
        </div>
        <Link href="/orders/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova OS
        </Link>
      </div>

      {/* Week Navigation + Stats */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={goPrev} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Semana anterior">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" onClick={goToday} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">Hoje</button>
            <button type="button" onClick={goNext} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Proxima semana">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            <h2 className="text-lg font-semibold text-slate-800 ml-2">{weekLabel}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{stats.total} OS agendadas</span>
            <span className="text-slate-500">{stats.techsWithOrders} tecnicos</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Tecnico:</span>
            <select value={filterTechId} onChange={e => setFilterTechId(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none">
              <option value="">Todos</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Status:</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            <svg className="h-5 w-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Carregando agenda...
          </div>
        ) : visibleTechs.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            Nenhum tecnico encontrado. Cadastre tecnicos para visualizar a agenda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left py-2.5 px-3 text-slate-600 font-semibold sticky left-0 bg-slate-50/80 z-10 min-w-[150px] border-b border-slate-200">
                    Tecnico
                  </th>
                  {weekDays.map((day, i) => {
                    const dayNum = day.getDay();
                    const isToday_ = isSameDay(day, today);
                    return (
                      <th key={i} className={`py-2.5 px-2 text-center font-semibold min-w-[120px] border-b border-slate-200 ${
                        isToday_ ? "text-blue-700 bg-blue-50/60" : "text-slate-600"
                      }`}>
                        <div className="text-sm">{DAY_LABELS[dayNum]}</div>
                        <div className="text-[10px] font-normal text-slate-400">{formatDate(day)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleTechs.map(tech => (
                  <tr key={tech.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                    <td className="py-2 px-3 text-slate-700 font-medium sticky left-0 bg-white z-10 border-r border-slate-100">
                      <div className="truncate max-w-[140px]" title={tech.name}>
                        {tech.name}
                      </div>
                      {tech.phone && (
                        <div className="text-[10px] text-slate-400 truncate">{tech.phone}</div>
                      )}
                    </td>
                    {weekDays.map((day, di) => {
                      const isToday_ = isSameDay(day, today);
                      const key = `${tech.id}_${dateToISO(day)}`;
                      const orders = ordersByTechDay[key] || [];

                      return (
                        <td key={di} className={`py-1.5 px-1 align-top ${
                          isToday_ ? "bg-blue-50/30" : ""
                        }`}>
                          <div className="space-y-1 min-h-[32px]">
                            {orders.map(order => {
                              const start = new Date(order.scheduledStartAt);
                              const colors = STATUS_COLORS[order.status] || "bg-slate-100 border-slate-300 text-slate-700";
                              return (
                                <Link key={order.id} href={`/orders/${order.id}`}
                                  className={`${colors} border rounded-md px-1.5 py-1 text-[10px] leading-tight block hover:shadow-sm transition-shadow cursor-pointer`}
                                  title={`${order.code} - ${order.title}\n${formatTime(start)} - ${order.estimatedDurationMinutes || "?"}min\n${order.clientPartner?.name || ""}\n${order.addressText || ""}`}>
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold">{formatTime(start)}</span>
                                    <span className="opacity-60">{order.estimatedDurationMinutes ? `${order.estimatedDurationMinutes}m` : ""}</span>
                                  </div>
                                  <div className="truncate font-medium">{order.code}</div>
                                  {order.clientPartner && (
                                    <div className="truncate opacity-70">{order.clientPartner.name}</div>
                                  )}
                                  {order.city && (
                                    <div className="truncate opacity-50">{order.neighborhood ? `${order.neighborhood}, ` : ""}{order.city}</div>
                                  )}
                                </Link>
                              );
                            })}
                            {orders.length === 0 && (
                              <div className="h-8 flex items-center justify-center text-slate-200">
                                <span className="text-[10px]">—</span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs text-slate-500 font-medium">Legenda:</span>
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className={`${colors} border rounded px-2 py-0.5 text-[10px] font-medium`}>
              {STATUS_LABELS[status] || status}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
