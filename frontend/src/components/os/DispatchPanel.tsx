"use client";

import { useDispatch, DispatchState, DispatchConfig } from "@/contexts/DispatchContext";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("./MiniMap"), { ssr: false });

// ── Card dimensions ──
const CARD_W = 454; // ~12cm
const CASCADE_OFFSET = 40;
const GRID_GAP = 16;
const CARD_H_ESTIMATE = 380; // approximate card height with GPS section
const AUTO_GRID_THRESHOLD = 4; // auto-grid when >= this many cards

// ── Helpers ──

function getCenterStart(index: number, total?: number) {
  if (typeof window === "undefined") return { x: 200, y: 100 };
  // Auto-grid for many cards
  if (total != null && total >= AUTO_GRID_THRESHOLD) {
    return calculateGridPositions(total)[index] || { x: 200, y: 100 };
  }
  const centerX = Math.round(window.innerWidth / 2 - CARD_W / 2);
  const centerY = Math.max(40, Math.round(window.innerHeight * 0.1));
  return {
    x: centerX + index * CASCADE_OFFSET,
    y: centerY + index * CASCADE_OFFSET,
  };
}

function calculateGridPositions(count: number): { x: number; y: number }[] {
  if (typeof window === "undefined") return Array.from({ length: count }, () => ({ x: 200, y: 100 }));
  const maxCols = Math.max(1, Math.floor((window.innerWidth - 40) / (CARD_W + GRID_GAP)));
  const cols = Math.min(maxCols, count);
  const totalW = cols * CARD_W + (cols - 1) * GRID_GAP;
  const startX = Math.max(20, Math.round((window.innerWidth - totalW) / 2));
  const startY = 60;
  return Array.from({ length: count }, (_, i) => ({
    x: startX + (i % cols) * (CARD_W + GRID_GAP),
    y: startY + Math.floor(i / cols) * (CARD_H_ESTIMATE + GRID_GAP),
  }));
}

function clampPosition(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(0, Math.min(x, window.innerWidth - 80)),
    y: Math.max(0, Math.min(y, window.innerHeight - 60)),
  };
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function saveCardPosition(osId: string, x: number, y: number) {
  const existing = saveTimers.get(osId);
  if (existing) clearTimeout(existing);
  saveTimers.set(osId, setTimeout(() => {
    api.patch("/users/me/preferences", { [`dispatchPos_${osId}`]: { x, y } }).catch(() => {});
    saveTimers.delete(osId);
  }, 600));
}

function formatCurrency(cents?: number) {
  if (cents == null) return "-";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta", OFERTADA: "Ofertada", ATRIBUIDA: "Atribuida", A_CAMINHO: "A Caminho",
  EM_EXECUCAO: "Em Execucao", CONCLUIDA: "Concluida", APROVADA: "Aprovada",
  CANCELADA: "Cancelada", AJUSTE: "Ajuste", RECUSADA: "Recusada",
};

// ── WhatsApp status ──

function MessageStatus({ d }: { d: DispatchState }) {
  if (d.resending) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-blue-600">
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Reenviando...
      </span>
    );
  }
  if (d.notificationStatus === "FAILED") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-red-600">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Falhou{d.errorDetail ? `: ${d.errorDetail.substring(0, 30)}` : ""}
      </span>
    );
  }
  const wa = d.whatsappStatus?.toUpperCase();
  if (wa === "READ") return <span className="text-[11px] text-blue-600 font-medium">✓✓ Lida</span>;
  if (wa === "DELIVERED") return <span className="text-[11px] text-slate-500">✓✓ Entregue</span>;
  if (d.notificationStatus === "SENT" || wa === "SENT") return <span className="text-[11px] text-slate-500">✓ Enviada</span>;
  // No notification exists at all
  if (!d.notificationId && d.notificationStatus === "PENDING") {
    return <span className="text-[11px] text-slate-400">Sem notificação</span>;
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-amber-600">
      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Enviando...
    </span>
  );
}

// ── Technician status ──

function TechStatus({ d }: { d: DispatchState }) {
  if (d.osStatus === "RECUSADA") return <span className="text-[10px] text-red-600 font-medium"><span className="text-[7px]">❌</span> Recusou</span>;
  if (d.completedAt) return <span className="text-[10px] text-green-700 font-medium"><span className="text-[7px]">✅</span> Concluida</span>;
  if (d.startedAt) return <span className="text-[10px] text-blue-600"><span className="text-[7px]">🔧</span> Em execucao</span>;
  if (d.arrivedAt) return <span className="text-[10px] text-indigo-600"><span className="text-[7px]">📍</span> No local</span>;
  if (d.enRouteAt) return <span className="text-[10px] text-amber-600"><span className="text-[7px]">🚗</span> A caminho</span>;
  if (d.acceptedAt) return <span className="text-[10px] text-green-600"><span className="text-[7px]">✅</span> Aceito</span>;
  return <span className="text-[10px] text-slate-400"><span className="text-[7px]">⏳</span> Aguardando aceite</span>;
}

// ── Horizontal timeline ──

const TIMELINE_STEPS = [
  { key: "created", label: "Criada", icon: "📋" },
  { key: "assigned", label: "Atribuida", icon: "📌" },
  { key: "accepted", label: "Aceito", icon: "✅" },
  { key: "enRoute", label: "A caminho", icon: "🚗" },
  { key: "arrived", label: "No local", icon: "📍" },
  { key: "started", label: "Execucao", icon: "🔧" },
  { key: "completed", label: "Concluida", icon: "✔️" },
];

function HorizontalTimeline({ d }: { d: DispatchState }) {
  const activeSteps: Record<string, boolean> = {
    created: true,
    assigned: !!d.osStatus && d.osStatus !== "ABERTA",
    accepted: !!d.acceptedAt,
    enRoute: !!d.enRouteAt,
    arrived: !!d.arrivedAt,
    started: !!d.startedAt,
    completed: !!d.completedAt,
  };

  // Find current step index
  let currentIdx = 0;
  for (let i = TIMELINE_STEPS.length - 1; i >= 0; i--) {
    if (activeSteps[TIMELINE_STEPS[i].key]) { currentIdx = i; break; }
  }

  return (
    <div className="flex items-center gap-0.5">
      {TIMELINE_STEPS.map((step, i) => {
        const active = activeSteps[step.key];
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-2.5 ${active ? "bg-indigo-400" : "bg-slate-200"}`} />
            )}
            <div
              className={`flex items-center gap-0.5 rounded-full px-1 py-px ${
                isCurrent
                  ? "bg-indigo-100 ring-1 ring-indigo-300"
                  : active
                    ? "bg-indigo-50"
                    : ""
              }`}
              title={step.label}
            >
              <span className="text-[6px] leading-none">{step.icon}</span>
              {isCurrent && <span className="text-[8px] font-medium text-indigo-700">{step.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Individual floating dispatch card ──

interface FloatingCardProps {
  d: DispatchState;
  position: { x: number; y: number };
  zIndex: number;
  organizing: boolean;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
}

function FloatingCard({ d, position, zIndex, organizing, onFocus, onMove }: FloatingCardProps) {
  const { resendNotification, toggleMinimize } = useDispatch();
  // Estado para o dropdown de "Trocar tecnico" na flutuante.
  // Quando showReassign=true, carrega a lista de tecnicos ativos e exibe dropdown inline.
  // Ao selecionar, faz PUT /service-orders/:id para reatribuir e POST dispatch-notifications para reenviar WhatsApp.
  const [showReassign, setShowReassign] = useState(false);
  const [technicians, setTechnicians] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [reassigning, setReassigning] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag if clicking a button
    if ((e.target as HTMLElement).closest("button")) return;
    onFocus();
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [position, onFocus]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    if (dragRef.current.moved) {
      const c = clampPosition(dragRef.current.originX + dx, dragRef.current.originY + dy);
      onMove(c.x, c.y);
    }
  }, [onMove]);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current?.moved) saveCardPosition(d.osId, position.x, position.y);
    dragRef.current = null;
  }, [d.osId, position]);

  const isFailed = d.notificationStatus === "FAILED";
  const isComplete = !!d.completedAt;
  const headerBg = isFailed ? "bg-red-600/90" : isComplete ? "bg-green-600/90" : "bg-indigo-600/90";

  // Build address string
  const address = [d.addressText, d.neighborhood, d.city, d.state].filter(Boolean).join(", ");

  return (
    <div
      style={{
        position: "fixed", left: position.x, top: position.y, width: CARD_W, zIndex,
        transition: organizing ? "left 0.3s ease, top 0.3s ease" : undefined,
      }}
      className="flex flex-col rounded-xl shadow-2xl select-none transition-shadow hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]"
      onPointerDown={() => onFocus()}
    >
      {/* Draggable header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex items-center justify-between rounded-t-xl ${headerBg} px-3 py-1.5 text-white cursor-grab active:cursor-grabbing touch-none backdrop-blur-sm`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <svg className="h-3.5 w-3.5 shrink-0 opacity-40" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="4" cy="13" r="1.5" />
            <circle cx="10" cy="3" r="1.5" /><circle cx="10" cy="8" r="1.5" /><circle cx="10" cy="13" r="1.5" />
          </svg>
          <span className="text-xs font-bold truncate">{d.osCode || "OS"}</span>
          <span className="text-xs truncate opacity-80">{d.osTitle || ""}</span>
          {d.isUrgent && <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold">URGENTE</span>}
          {d.isReturn && <span className="ml-1 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold">RETORNO</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
          className="shrink-0 rounded p-0.5 hover:bg-white/20"
          title="Minimizar todas"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Card body */}
      <div className="rounded-b-xl bg-white/[0.93] backdrop-blur-sm border border-t-0 border-slate-200/60 overflow-hidden">

        {/* OS Info section */}
        <div className="px-3 pt-2.5 pb-2 border-b border-slate-100">
          {/* Description */}
          {d.osDescription && (
            <p className="text-[10px] text-slate-500 leading-tight mb-1.5 line-clamp-2">{d.osDescription}</p>
          )}
          {/* Grid of details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {d.clientName && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Cliente:</span>
                <span className="text-[10px] text-slate-700 truncate">{d.clientName}</span>
              </div>
            )}
            {d.createdByName && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Criado por:</span>
                <span className="text-[10px] text-slate-700 truncate">{d.createdByName}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Valor:</span>
              <span className="text-[10px] text-slate-700 font-medium">{formatCurrency(d.valueCents)}</span>
            </div>
            {d.scheduledStartAt && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Agendada:</span>
                <span className="text-[10px] text-slate-700">{formatShortDate(d.scheduledStartAt)}</span>
              </div>
            )}
            {d.deadlineAt && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Prazo:</span>
                <span className="text-[10px] text-slate-700">{formatShortDate(d.deadlineAt)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Status:</span>
              <span className="text-[10px] text-indigo-600 font-medium">{STATUS_LABELS[d.osStatus || ""] || d.osStatus || "-"}</span>
            </div>
            {d.createdAt && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Criada:</span>
                <span className="text-[10px] text-slate-700">{formatShortDate(d.createdAt)}</span>
              </div>
            )}
          </div>
          {/* Address */}
          {address && (
            <div className="mt-1.5 flex items-start gap-1">
              <svg className="h-3 w-3 shrink-0 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[10px] text-slate-500 leading-tight line-clamp-2">{address}</span>
            </div>
          )}
        </div>

        {/* Technician section */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[11px] text-slate-700 font-medium">{d.technicianName || "Tecnico"}</span>
              {d.technicianPhone && <span className="text-[10px] text-slate-400">{d.technicianPhone}</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <TechStatus d={d} />
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (showReassign) { setShowReassign(false); return; }
                  try {
                    const res = await api.get<{ data: any[] }>("/partners?type=TECNICO&status=ATIVO&limit=50");
                    setTechnicians((res.data || []).map((p: any) => ({ id: p.id, name: p.name, phone: p.phone })));
                  } catch { setTechnicians([]); }
                  setShowReassign(true);
                }}
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                  d.osStatus === "RECUSADA"
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "text-blue-600 hover:bg-blue-50"
                }`}
                title="Trocar tecnico"
              >
                {d.osStatus === "RECUSADA" ? (
                  <span className="flex items-center gap-0.5">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11l-2-2m0 0l-2 2m2-2v6" />
                    </svg>
                    Reatribuir
                  </span>
                ) : (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11l-2-2m0 0l-2 2m2-2v6" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Refusal note */}
          {d.osStatus === "RECUSADA" && d.lastNote && (
            <p className="text-[10px] text-red-500 mt-0.5 italic leading-tight line-clamp-2">
              Motivo: {d.lastNote}
            </p>
          )}

          {/* Reassign technician dropdown */}
          {showReassign && (
            <div className="mt-1.5 rounded-lg border border-blue-200 bg-blue-50/50 p-2">
              <p className="text-[10px] font-medium text-blue-700 mb-1">Trocar tecnico:</p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {technicians.filter(t => t.id !== (d as any).technicianId).map(t => (
                  <button
                    key={t.id}
                    disabled={reassigning}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setReassigning(true);
                      try {
                        // Use reassign endpoint — handles RECUSADA reset (logs, tokens, status)
                        await api.post(`/service-orders/${d.osId}/reassign`, { technicianId: t.id });
                        setShowReassign(false);
                      } catch { /* ignore */ }
                      setReassigning(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-[10px] text-slate-700 hover:bg-blue-100 transition-colors"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-slate-400">{t.phone}</span>
                  </button>
                ))}
                {technicians.filter(t => t.id !== (d as any).technicianId).length === 0 && (
                  <p className="text-[10px] text-slate-400 px-2 py-1">Nenhum outro tecnico ativo</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowReassign(false); }}
                className="mt-1 text-[9px] text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Message status section */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-[11px] text-slate-500">WhatsApp</span>
            </div>
            <MessageStatus d={d} />
          </div>
          {d.notificationStatus === "FAILED" && !d.resending && (
            <button
              onClick={(e) => { e.stopPropagation(); resendNotification(d.osId); }}
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reenviar notificacao
            </button>
          )}
        </div>

        {/* GPS Tracking section (Fase 2) */}
        <GpsSection d={d} />

      </div>
    </div>
  );
}

// ── GPS Tracking Section ──

function formatDistance(meters?: number) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatTimeAgo(isoDate?: string) {
  if (!isoDate) return null;
  const diff = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60}min`;
}

function estimateEta(distanceMeters?: number, speedMs?: number) {
  if (distanceMeters == null) return null;
  // Use actual speed if available and > 1 m/s, otherwise assume ~30 km/h (~8.3 m/s) urban avg
  const speed = (speedMs && speedMs > 1) ? speedMs : 8.3;
  const seconds = distanceMeters / speed;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `~${h}h${m > 0 ? `${m}min` : ""}`;
}

function GpsSection({ d }: { d: DispatchState }) {
  // Only show GPS section when technician is en route or later (but not completed)
  const showGps = d.enRouteAt && !d.completedAt;
  if (!showGps) return null;

  const hasDestCoords = d.destLat != null && d.destLng != null;
  const hasTechCoords = d.techLat != null && d.techLng != null;

  if (!hasDestCoords) {
    return (
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Endereco sem coordenadas
        </div>
      </div>
    );
  }

  const dist = formatDistance(d.distanceMeters);
  const eta = estimateEta(d.distanceMeters, d.techSpeed);
  const ago = formatTimeAgo(d.locationUpdatedAt);

  return (
    <div className="px-3 py-2 border-b border-slate-100">
      {/* Mini map */}
      <MiniMap
        destLat={d.destLat!}
        destLng={d.destLng!}
        techLat={d.techLat}
        techLng={d.techLng}
        techHeading={d.techHeading}
      />

      {/* Info bar below map */}
      {hasTechCoords ? (
        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          {dist && (
            <span className="flex items-center gap-0.5 text-slate-600 font-medium">
              <svg className="h-3 w-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {dist}
            </span>
          )}
          {eta && (
            <span className="flex items-center gap-0.5 text-slate-500">
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {eta}
            </span>
          )}
          {ago && (
            <span className="text-slate-400">
              {ago} atras
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1.5 text-center text-[10px] text-slate-400">
          Aguardando rastreamento...
        </div>
      )}
    </div>
  );
}

// ── Minimized tray (draggable mini-panel with OS chips) ──

const MINIMIZED_PREF_KEY = "dispatchMinimizedPos";

function MinimizedTray({ dispatches, onClick, config, onConfigChange }: {
  dispatches: DispatchState[];
  onClick: () => void;
  config: DispatchConfig;
  onConfigChange: (partial: Partial<DispatchConfig>) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const configMenuRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const loadedRef = useRef(false);

  // Close config menu on outside click
  useEffect(() => {
    if (!showConfigMenu) return;
    const handler = (e: MouseEvent) => {
      if (configMenuRef.current && !configMenuRef.current.contains(e.target as Node)) {
        setShowConfigMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showConfigMenu]);

  // Load saved position — hide until loaded to avoid flash
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const prefKey = `dispatchPos_${MINIMIZED_PREF_KEY}`;
    api.get<Record<string, any>>("/users/me/preferences").then((prefs) => {
      if (prefs?.[prefKey]?.x != null) {
        setPos(clampPosition(prefs[prefKey].x, prefs[prefKey].y));
      }
    }).catch(() => {}).finally(() => setReady(true));
  }, []);

  // Default bottom-right
  const position = pos || (typeof window !== "undefined"
    ? { x: window.innerWidth - 220, y: window.innerHeight - 80 }
    : { x: 600, y: 600 });

  const gearClickedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag if clicking on gear button or config menu
    const target = e.target as HTMLElement;
    if (target.closest("[data-dispatch-gear]") || target.closest("[data-dispatch-config]")) {
      return;
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    if (dragRef.current.moved) {
      setPos(clampPosition(dragRef.current.originX + dx, dragRef.current.originY + dy));
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current?.moved && pos) {
      saveCardPosition(MINIMIZED_PREF_KEY, pos.x, pos.y);
    }
    const wasDrag = dragRef.current?.moved;
    dragRef.current = null;
    if (!wasDrag) onClick();
  }, [pos, onClick]);

  const failedCount = dispatches.filter((d) => d.notificationStatus === "FAILED").length;

  // Status color for each OS chip
  const getChipColor = (d: DispatchState) => {
    if (d.notificationStatus === "FAILED") return "bg-red-500 text-white";
    if (d.completedAt) return "bg-green-500 text-white";
    if (d.startedAt || d.arrivedAt) return "bg-blue-500 text-white";
    if (d.acceptedAt || d.enRouteAt) return "bg-emerald-500 text-white";
    return "bg-slate-200 text-slate-700";
  };

  if (!ready) return null; // Wait for saved position to load

  return (
    <div
      style={{ position: "fixed", left: position.x, top: position.y, zIndex: 9999 }}
      className="select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="flex items-center gap-1.5 rounded-xl bg-indigo-600/90 backdrop-blur-sm px-2.5 py-1.5 shadow-lg cursor-grab active:cursor-grabbing">
        {/* Drag grip */}
        <svg className="h-3 w-3 text-white/40 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="4" cy="12" r="1.5" />
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="8" r="1.5" /><circle cx="10" cy="12" r="1.5" />
        </svg>
        {/* OS chips */}
        <div className="flex items-center gap-1 flex-wrap max-w-[300px]">
          {dispatches.map((d) => (
            <div
              key={d.osId}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold leading-none whitespace-nowrap ${getChipColor(d)}`}
              title={`${d.osCode || "OS"} — ${d.osTitle || ""} (${STATUS_LABELS[d.osStatus || ""] || d.osStatus || ""})`}
            >
              {d.osCode || "OS"}
            </div>
          ))}
        </div>
        {/* Badge */}
        <span className={`shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${failedCount > 0 ? "bg-red-500 animate-pulse" : "bg-green-500"}`}>
          {dispatches.length}
        </span>
        {/* Config gear */}
        <button
          data-dispatch-gear
          onClick={(e) => { e.stopPropagation(); setShowConfigMenu((p) => !p); }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
          title="Configuracoes do painel"
        >
          <svg className="h-3 w-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        {/* Expand arrow */}
        <svg className="h-3 w-3 text-white/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </div>

      {/* Config dropdown */}
      {showConfigMenu && (
        <div
          ref={configMenuRef}
          data-dispatch-config
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-white shadow-xl border border-slate-200 p-3 text-sm"
        >
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Comportamento do Painel</div>
          <label className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-slate-50 rounded px-1">
            <input
              type="checkbox"
              checked={config.openOnNewOS}
              onChange={(e) => onConfigChange({ openOnNewOS: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-700">Abrir ao lancar nova OS</span>
          </label>
          <label className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-slate-50 rounded px-1">
            <input
              type="checkbox"
              checked={config.openOnUpdate}
              onChange={(e) => onConfigChange({ openOnUpdate: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-700">Abrir ao atualizar status</span>
          </label>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            Sem nenhuma opcao marcada, abre somente ao clicar.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main DispatchPanel ──

type PositionMap = Record<string, { x: number; y: number }>;

export default function DispatchPanel() {
  const { dispatches, minimized, toggleMinimize, config, updateConfig } = useDispatch();
  const { user } = useAuth();

  // Only render for ADMIN/DESPACHO roles
  if (!user || !hasRole(user, "ADMIN", "DESPACHO")) return null;
  const [positions, setPositions] = useState<PositionMap>({});
  const [focusOrder, setFocusOrder] = useState<string[]>([]);
  const [organizing, setOrganizing] = useState(false);
  const prefsLoadedRef = useRef(false);

  // Load saved positions from backend
  useEffect(() => {
    if (prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;
    api.get<Record<string, any>>("/users/me/preferences").then((prefs) => {
      if (!prefs) return;
      const loaded: PositionMap = {};
      for (const [key, val] of Object.entries(prefs)) {
        if (key.startsWith("dispatchPos_") && val?.x != null && val?.y != null) {
          loaded[key.replace("dispatchPos_", "")] = clampPosition(val.x, val.y);
        }
      }
      if (Object.keys(loaded).length > 0) setPositions((prev) => ({ ...prev, ...loaded }));
    }).catch(() => {});
  }, []);

  // Auto-cascade (or auto-grid for 4+) for new dispatches
  useEffect(() => {
    setPositions((prev) => {
      const updated = { ...prev };
      let changed = false;
      const newIds: string[] = [];
      for (const d of dispatches) {
        if (!updated[d.osId]) {
          newIds.push(d.osId);
          changed = true;
        }
      }
      // If adding new cards and total >= threshold, auto-grid all cards
      if (newIds.length > 0 && dispatches.length >= AUTO_GRID_THRESHOLD) {
        const gridPos = calculateGridPositions(dispatches.length);
        dispatches.forEach((d, i) => {
          updated[d.osId] = gridPos[i];
          saveCardPosition(d.osId, gridPos[i].x, gridPos[i].y);
        });
      } else {
        // Cascade new cards
        for (const id of newIds) {
          updated[id] = getCenterStart(Object.keys(updated).length);
        }
      }
      for (const key of Object.keys(updated)) {
        if (!dispatches.some((d) => d.osId === key)) {
          delete updated[key];
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
    setFocusOrder((prev) => {
      const ids = dispatches.map((d) => d.osId);
      const cleaned = prev.filter((id) => ids.includes(id));
      const newIds = ids.filter((id) => !cleaned.includes(id));
      return newIds.length > 0 ? [...cleaned, ...newIds] : cleaned;
    });
  }, [dispatches]);

  useEffect(() => {
    const h = () => setPositions((prev) => {
      const u: PositionMap = {};
      for (const [k, v] of Object.entries(prev)) u[k] = clampPosition(v.x, v.y);
      return u;
    });
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const bringToFront = useCallback((osId: string) => {
    setFocusOrder((prev) => [...prev.filter((id) => id !== osId), osId]);
  }, []);

  const moveCard = useCallback((osId: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, [osId]: { x, y } }));
  }, []);

  // "Organizar" — redistribute all cards into grid with animation
  const handleOrganize = useCallback(() => {
    const gridPos = calculateGridPositions(dispatches.length);
    const newPositions: PositionMap = {};
    dispatches.forEach((d, i) => {
      newPositions[d.osId] = gridPos[i];
      saveCardPosition(d.osId, gridPos[i].x, gridPos[i].y);
    });
    setOrganizing(true);
    setPositions(newPositions);
    // Remove transition after animation completes so drag is instant
    setTimeout(() => setOrganizing(false), 350);
  }, [dispatches]);

  if (dispatches.length === 0) return null;

  if (minimized) {
    return <MinimizedTray dispatches={dispatches} onClick={toggleMinimize} config={config} onConfigChange={updateConfig} />;
  }

  const BASE_Z = 1000;

  return (
    <>
      {/* "Organizar" button — top-right, visible when 2+ cards */}
      {dispatches.length >= 2 && (
        <button
          onClick={handleOrganize}
          style={{ zIndex: BASE_Z + dispatches.length + 10 }}
          className="fixed top-4 right-4 flex items-center gap-1.5 rounded-lg bg-indigo-600/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-indigo-700 transition-colors"
          title="Organizar cards lado a lado"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Organizar
        </button>
      )}
      {dispatches.map((d) => {
        const pos = positions[d.osId] || getCenterStart(0);
        const z = BASE_Z + Math.max(0, focusOrder.indexOf(d.osId));
        return (
          <FloatingCard key={d.osId} d={d} position={pos} zIndex={z} organizing={organizing}
            onFocus={() => bringToFront(d.osId)} onMove={(x, y) => moveCard(d.osId, x, y)} />
        );
      })}
    </>
  );
}
