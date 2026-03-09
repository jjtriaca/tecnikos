"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/api";

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
  assignedPartner: { id: string; name: string; phone: string | null } | null;
  clientPartner: { id: string; name: string } | null;
}

interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    id: string;
    code: string;
    title: string;
    scheduledStartAt: string;
    estimatedDurationMinutes: number;
  }>;
}

export interface AgendaSelection {
  technicianId: string;
  technicianName: string;
  scheduledStartAt: string;   // ISO string
  estimatedDurationMinutes: number;
}

interface AgendaSelectorProps {
  workingHours?: { start: string; end: string };
  workingDays?: number[];
  defaultDurationMinutes?: number;
  onSelect: (selection: AgendaSelection | null) => void;
  selection: AgendaSelection | null;
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
  EM_EXECUCAO: "Execucao",
  CONCLUIDA: "Concluida",
  PAUSADA: "Pausada",
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=sun
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

/* ── Duration Options ────────────────────────────────── */

const DURATION_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 horas" },
  { value: 180, label: "3 horas" },
  { value: 240, label: "4 horas" },
  { value: 480, label: "Dia inteiro" },
];

/* ── Component ───────────────────────────────────────── */

export default function AgendaSelector({
  workingHours = { start: "08:00", end: "18:00" },
  workingDays = [1, 2, 3, 4, 5],
  defaultDurationMinutes = 60,
  onSelect,
  selection,
}: AgendaSelectorProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [agendaOrders, setAgendaOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);

  // Local selection state
  const [selectedTechId, setSelectedTechId] = useState<string>(selection?.technicianId || "");
  const [selectedDate, setSelectedDate] = useState<string>(selection?.scheduledStartAt?.substring(0, 10) || "");
  const [selectedTime, setSelectedTime] = useState<string>(
    selection?.scheduledStartAt ? new Date(selection.scheduledStartAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
  );
  const [selectedDuration, setSelectedDuration] = useState<number>(selection?.estimatedDurationMinutes || defaultDurationMinutes);

  // Week days array (Mon-Sun)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${formatDate(weekStart)} - ${formatDate(end)}`;
  }, [weekStart]);

  // Fetch technicians
  useEffect(() => {
    api.get<{ data: TechnicianOption[] }>("/partners?type=TECNICO&limit=100&page=1")
      .then(res => setTechnicians(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Fetch agenda for the week
  useEffect(() => {
    const dateFrom = dateToISO(weekStart);
    const dateTo = dateToISO(addDays(weekStart, 6));
    setLoading(true);
    api.get<AgendaOrder[]>(`/service-orders/agenda?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then(res => setAgendaOrders(Array.isArray(res) ? res : []))
      .catch(() => setAgendaOrders([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  // Check conflicts when selection changes
  useEffect(() => {
    if (!selectedTechId || !selectedDate || !selectedTime) {
      setConflict(null);
      return;
    }
    const isoStart = `${selectedDate}T${selectedTime}:00`;
    const params = new URLSearchParams({
      technicianId: selectedTechId,
      scheduledStartAt: isoStart,
      durationMinutes: String(selectedDuration),
    });
    api.get<ConflictResult>(`/service-orders/check-conflicts?${params}`)
      .then(res => setConflict(res))
      .catch(() => setConflict(null));
  }, [selectedTechId, selectedDate, selectedTime, selectedDuration]);

  // Emit selection
  const emitSelection = useCallback(() => {
    if (!selectedTechId || !selectedDate || !selectedTime) {
      onSelect(null);
      return;
    }
    const tech = technicians.find(t => t.id === selectedTechId);
    onSelect({
      technicianId: selectedTechId,
      technicianName: tech?.name || "",
      scheduledStartAt: new Date(`${selectedDate}T${selectedTime}:00`).toISOString(),
      estimatedDurationMinutes: selectedDuration,
    });
  }, [selectedTechId, selectedDate, selectedTime, selectedDuration, technicians, onSelect]);

  useEffect(() => {
    emitSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTechId, selectedDate, selectedTime, selectedDuration]);

  // Navigate weeks
  const goToday = () => setWeekStart(startOfWeek(new Date()));
  const goPrev = () => setWeekStart(prev => addDays(prev, -7));
  const goNext = () => setWeekStart(prev => addDays(prev, 7));

  // Orders grouped by tech+day
  const ordersByTechDay = useMemo(() => {
    const map: Record<string, AgendaOrder[]> = {};
    for (const order of agendaOrders) {
      if (!order.assignedPartner || !order.scheduledStartAt) continue;
      const d = new Date(order.scheduledStartAt);
      const key = `${order.assignedPartner.id}_${dateToISO(d)}`;
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }
    // Sort each group by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime());
    }
    return map;
  }, [agendaOrders]);

  // Handle clicking a cell in the grid
  function handleCellClick(techId: string, day: Date) {
    setSelectedTechId(techId);
    setSelectedDate(dateToISO(day));
    if (!selectedTime) {
      setSelectedTime(workingHours.start);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="border border-teal-200 rounded-xl bg-teal-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-teal-800 flex items-center gap-2">
          <span className="text-base">📅</span> Agendamento
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={goPrev} className="p-1 rounded hover:bg-teal-100 text-teal-600 transition-colors" title="Semana anterior">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button type="button" onClick={goToday} className="px-2 py-0.5 rounded text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors">Hoje</button>
          <span className="text-xs text-teal-600 font-medium min-w-[120px] text-center">{weekLabel}</span>
          <button type="button" onClick={goNext} className="p-1 rounded hover:bg-teal-100 text-teal-600 transition-colors" title="Proxima semana">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Weekly grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-slate-400">
          <svg className="h-4 w-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando agenda...
        </div>
      ) : technicians.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400">
          Nenhum tecnico cadastrado. Cadastre tecnicos para usar o agendamento.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left py-1.5 px-2 text-slate-500 font-medium sticky left-0 bg-teal-50/80 min-w-[120px]">Tecnico</th>
                {weekDays.map((day, i) => {
                  const dayNum = day.getDay();
                  const isWorkDay = workingDays.includes(dayNum);
                  const isToday = isSameDay(day, today);
                  return (
                    <th key={i} className={`py-1.5 px-1 text-center font-medium min-w-[80px] ${
                      isToday ? "text-teal-700 bg-teal-100/60 rounded-t" :
                      isWorkDay ? "text-slate-600" : "text-slate-300"
                    }`}>
                      <div>{DAY_LABELS[dayNum]}</div>
                      <div className="text-[10px] font-normal">{formatDate(day)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {technicians.map(tech => (
                <tr key={tech.id} className="border-t border-slate-200/50">
                  <td className="py-1 px-2 text-slate-700 font-medium sticky left-0 bg-white/80 truncate max-w-[140px]" title={tech.name}>
                    {tech.name.split(" ").slice(0, 2).join(" ")}
                  </td>
                  {weekDays.map((day, di) => {
                    const dayNum = day.getDay();
                    const isWorkDay = workingDays.includes(dayNum);
                    const key = `${tech.id}_${dateToISO(day)}`;
                    const orders = ordersByTechDay[key] || [];
                    const isSelected = selectedTechId === tech.id && selectedDate === dateToISO(day);
                    const isPast = day < today;

                    return (
                      <td key={di}
                        onClick={() => !isPast && isWorkDay && handleCellClick(tech.id, day)}
                        className={`py-1 px-1 align-top min-h-[40px] transition-colors ${
                          !isWorkDay ? "bg-slate-50/50" :
                          isPast ? "bg-slate-50/30 cursor-not-allowed" :
                          isSelected ? "bg-teal-100 ring-2 ring-teal-400 ring-inset rounded" :
                          "hover:bg-teal-50 cursor-pointer"
                        }`}
                      >
                        <div className="space-y-0.5">
                          {orders.map(order => {
                            const start = new Date(order.scheduledStartAt);
                            const colors = STATUS_COLORS[order.status] || "bg-slate-100 border-slate-300 text-slate-700";
                            return (
                              <div key={order.id} className={`${colors} border rounded px-1 py-0.5 text-[10px] leading-tight truncate`}
                                title={`${order.code} - ${order.title} (${formatTime(start)} - ${order.estimatedDurationMinutes || "?"}min)`}>
                                <span className="font-semibold">{formatTime(start)}</span>
                                <span className="ml-0.5 opacity-70">{order.code}</span>
                              </div>
                            );
                          })}
                          {orders.length === 0 && isWorkDay && !isPast && (
                            <div className="h-6 flex items-center justify-center text-slate-300">
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

      {/* Selection fields */}
      <div className="border-t border-teal-200 pt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Tecnico */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Tecnico *</span>
            <select value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none">
              <option value="">Selecione...</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          {/* Data */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Data *</span>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              min={dateToISO(today)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none" />
          </label>

          {/* Hora */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Hora *</span>
            <input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none" />
          </label>

          {/* Duracao */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Duracao</span>
            <select value={selectedDuration} onChange={e => setSelectedDuration(parseInt(e.target.value))}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none">
              {DURATION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Conflict warning */}
        {conflict?.hasConflict && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <span className="font-medium">⚠️ Conflito de horario!</span>
            <span className="ml-1">
              O tecnico ja tem {conflict.conflicts.length} OS neste horario:
            </span>
            <ul className="mt-1 ml-4 list-disc text-xs">
              {conflict.conflicts.map(c => (
                <li key={c.id}>
                  {c.code} — {c.title} ({new Date(c.scheduledStartAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - {c.estimatedDurationMinutes}min)
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Selection summary */}
        {selectedTechId && selectedDate && selectedTime && (
          <div className="rounded-lg bg-teal-100/60 px-3 py-2 text-sm text-teal-800 flex items-center gap-2">
            <span>✅</span>
            <span>
              <strong>{technicians.find(t => t.id === selectedTechId)?.name}</strong>
              {" — "}
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
              {" as "}{selectedTime}
              {" ("}{DURATION_OPTIONS.find(o => o.value === selectedDuration)?.label || `${selectedDuration}min`}{")"}
            </span>
          </div>
        )}

        <p className="text-[10px] text-slate-400">
          Clique em uma celula na grade para selecionar tecnico e data, ou preencha os campos acima.
          A OS sera criada como &quot;Atribuida&quot; diretamente.
        </p>
      </div>
    </div>
  );
}
