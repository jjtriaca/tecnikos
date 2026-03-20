"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { techApi } from "@/contexts/TechAuthContext";
import PhotoUpload from "@/components/Upload/PhotoUpload";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type Attachment = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  url: string;
  stepOrder?: number | null;
  createdAt: string;
};

type ServiceOrder = {
  id: string;
  title: string;
  description?: string;
  addressText: string;
  lat: number;
  lng: number;
  status: string;
  valueCents: number;
  deadlineAt: string;
  createdAt: string;
  workflowTemplateId?: string | null;
};

// V1
type WorkflowStep = {
  order: number;
  name: string;
  icon: string;
  requirePhoto: boolean;
  requireNote: boolean;
  completed: boolean;
  completedAt?: string;
  note?: string;
  photoUrl?: string;
};

type WorkflowProgressV1 = {
  templateId: string;
  templateName: string;
  version?: number;
  totalSteps: number;
  completedSteps: number;
  currentStep: WorkflowStep | null;
  steps: WorkflowStep[];
  isComplete: boolean;
};

// V2
type BlockProgress = {
  id: string;
  type: string;
  name: string;
  icon: string;
  config: Record<string, any>;
  next: string | null;
  yesBranch?: string | null;
  noBranch?: string | null;
  completed: boolean;
  completedAt?: string;
  note?: string;
  photoUrl?: string;
  responseData?: any;
};

type WorkflowProgressV2 = {
  templateId: string;
  templateName: string;
  version: number;
  totalBlocks: number;
  completedBlocks: number;
  currentBlock: BlockProgress | null;
  executionPath: BlockProgress[];
  isComplete: boolean;
};

type WorkflowProgress = WorkflowProgressV1 | WorkflowProgressV2;

function isV2(wf: WorkflowProgress): wf is WorkflowProgressV2 {
  return wf.version === 2;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const STATUS_LABELS: Record<string, string> = {
  ATRIBUIDA: "Pendente",
  A_CAMINHO: "A Caminho",
  EM_EXECUCAO: "Em Execucao",
  CONCLUIDA: "Concluida",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
  OFERTADA: "Ofertada",
  ABERTA: "Aberta",
  RECUSADA: "Recusada",
};

const STATUS_BADGE: Record<string, string> = {
  ATRIBUIDA: "bg-amber-100 text-amber-800",
  A_CAMINHO: "bg-indigo-100 text-indigo-800",
  EM_EXECUCAO: "bg-blue-100 text-blue-800",
  CONCLUIDA: "bg-green-100 text-green-800",
  APROVADA: "bg-emerald-100 text-emerald-800",
  AJUSTE: "bg-red-100 text-red-800",
  OFERTADA: "bg-orange-100 text-orange-800",
  ABERTA: "bg-yellow-100 text-yellow-800",
  RECUSADA: "bg-red-100 text-red-800",
};

/* Block types hidden from step list (flow control) */
const HIDDEN_TYPES = new Set(["START", "END"]);
/* Block types auto-completed by the engine (STATUS manual is NOT auto) */
const AUTO_TYPES = new Set(["NOTIFY", "ALERT"]);
/* Check if block is auto-completed (STATUS only if transitionMode is not manual) */
function isAutoBlock(block: any): boolean {
  if (AUTO_TYPES.has(block.type)) return true;
  if (block.type === "STATUS" && block.config?.transitionMode !== "manual") return true;
  return false;
}

/* Pause reason categories */
const PAUSE_REASONS = [
  { id: "meal_break", label: "Horario de refeicao", icon: "🍽️" },
  { id: "end_of_day", label: "Fim do expediente", icon: "🌙" },
  { id: "fetch_materials", label: "Buscar materiais", icon: "📦" },
  { id: "weather", label: "Condicoes climaticas", icon: "🌧️" },
  { id: "waiting_client", label: "Aguardando cliente", icon: "👤" },
  { id: "waiting_access", label: "Aguardando acesso", icon: "🔑" },
  { id: "personal", label: "Motivo pessoal", icon: "🏠" },
  { id: "other", label: "Outro motivo", icon: "📝" },
];

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Calculate distance between two coords in meters */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function TechOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowProgress | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // V1 state
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  // V2 state
  const [v2Note, setV2Note] = useState("");
  const [v2Answer, setV2Answer] = useState<string>("");
  const [v2CheckedItems, setV2CheckedItems] = useState<string[]>([]);
  const [v2GpsCoords, setV2GpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [v2GpsLoading, setV2GpsLoading] = useState(false);
  const [v2FormFields, setV2FormFields] = useState<Record<string, string>>({});

  // GPS tracking state (status-based A_CAMINHO tracking)
  const [trackingActive, setTrackingActive] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);

  // GPS block continuous tracking state
  const [v2GpsTracking, setV2GpsTracking] = useState(false);
  const v2GpsWatchRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Pause state
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseNote, setPauseNote] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    try {
      const data = await techApi<ServiceOrder>(`/service-orders/${id}`);
      setOrder(data);
      try {
        const wf = await techApi<WorkflowProgress>(`/service-orders/${id}/workflow`);
        setWorkflow(wf);
      } catch {
        setWorkflow(null);
      }
      try {
        const atts = await techApi<Attachment[]>(`/service-orders/${id}/attachments`);
        setAttachments(atts);
      } catch {
        setAttachments([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Reset V2 form state when workflow changes
  const currentBlockId = workflow && isV2(workflow) ? workflow.currentBlock?.id : null;
  useEffect(() => {
    setV2Note("");
    setV2Answer("");
    setV2CheckedItems([]);
    setV2GpsCoords(null);
    setV2FormFields({});
    // Stop continuous GPS tracking from previous block
    if (v2GpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(v2GpsWatchRef.current);
      v2GpsWatchRef.current = null;
      setV2GpsTracking(false);
    }
  }, [currentBlockId]);

  // GPS block: auto-capture when config.auto is true
  useEffect(() => {
    if (!workflow || !isV2(workflow) || !workflow.currentBlock) return;
    const block = workflow.currentBlock;
    if (block.type !== "GPS") return;
    const cfg = block.config || {};
    if (cfg.auto && !v2GpsCoords && navigator.geolocation) {
      setV2GpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setV2GpsLoading(false);
        },
        () => {
          setV2GpsLoading(false);
        },
        { enableHighAccuracy: cfg.highAccuracy !== false, timeout: 15000 }
      );
    }
  }, [currentBlockId]);

  // GPS tracking: update distance calculation
  useEffect(() => {
    if (currentPosition && order?.lat && order?.lng) {
      const dist = haversineDistance(currentPosition.lat, currentPosition.lng, order.lat, order.lng);
      setDistanceToTarget(dist);
    }
  }, [currentPosition, order?.lat, order?.lng]);

  // Cleanup GPS tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (v2GpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(v2GpsWatchRef.current);
      }
    };
  }, []);

  /* ── GPS Tracking ── */
  function startGpsTracking() {
    if (!navigator.geolocation) {
      alert("GPS nao disponivel neste dispositivo");
      return;
    }
    setTrackingActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Error — try to continue
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  function stopGpsTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
  }

  /* ── Status transitions ── */
  async function handleStatusChange(nextStatus: string) {
    if (!order) return;
    setActing(true);
    try {
      await techApi(`/service-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      // Start tracking when going A_CAMINHO
      if (nextStatus === "A_CAMINHO") {
        startGpsTracking();
      }
      // Stop tracking when arriving
      if (nextStatus === "EM_EXECUCAO") {
        stopGpsTracking();
      }

      await loadOrder();
    } catch {
      alert("Erro ao atualizar status");
    } finally {
      setActing(false);
    }
  }

  /* ── Pause/Resume ── */
  function handlePause() {
    if (!pauseReason) return;
    setIsPaused(true);
    setPausedAt(new Date().toISOString());
    setShowPauseModal(false);
    setPauseNote("");
  }

  function handleResume() {
    setIsPaused(false);
    setPausedAt(null);
    setPauseReason("");
  }

  /* ── V1 advance ── */
  async function handleAdvanceStepV1() {
    if (!order) return;
    setActing(true);
    try {
      const body: Record<string, string> = {};
      if (noteText.trim()) body.note = noteText.trim();
      const wf = await techApi<WorkflowProgress>(
        `/service-orders/${order.id}/workflow/advance`,
        { method: "POST", body: JSON.stringify(body) }
      );
      setWorkflow(wf);
      setNoteText("");
      setShowNoteInput(false);
      await loadOrder();
    } catch (err: any) {
      alert(err?.message || "Erro ao avancar passo");
    } finally {
      setActing(false);
    }
  }

  /* ── V2 advance ── */
  async function handleAdvanceBlockV2() {
    if (!order || !workflow || !isV2(workflow) || !workflow.currentBlock) return;
    setActing(true);

    const block = workflow.currentBlock;
    const body: Record<string, any> = { blockId: block.id };

    switch (block.type) {
      case "STEP":
        if (v2Note.trim()) body.note = v2Note.trim();
        break;
      case "NOTE":
        body.note = v2Note.trim();
        break;
      case "PHOTO": {
        const stepPhotos = attachments.filter((a) => a.type === "WORKFLOW_STEP");
        const lastPhoto = stepPhotos[stepPhotos.length - 1];
        if (lastPhoto) body.photoUrl = lastPhoto.url;
        break;
      }
      case "GPS":
        if (v2GpsCoords) {
          body.responseData = { lat: v2GpsCoords.lat, lng: v2GpsCoords.lng };
        }
        break;
      case "QUESTION":
        body.responseData = { answer: v2Answer };
        break;
      case "CHECKLIST":
        body.responseData = { checkedItems: v2CheckedItems };
        break;
      case "CONDITION":
        body.responseData = { answer: v2Answer };
        break;
      case "ACTION_BUTTONS":
        body.responseData = { buttonId: v2Answer };
        break;
      case "SIGNATURE": {
        const sigPhotos = attachments.filter((a) => a.type === "WORKFLOW_STEP");
        const lastSig = sigPhotos[sigPhotos.length - 1];
        if (lastSig) body.photoUrl = lastSig.url;
        break;
      }
      case "FORM":
        body.responseData = { fields: v2FormFields };
        break;
    }

    try {
      const wf = await techApi<WorkflowProgress>(
        `/service-orders/${order.id}/workflow/advance`,
        { method: "POST", body: JSON.stringify(body) }
      );
      setWorkflow(wf);
      await loadOrder();
    } catch (err: any) {
      alert(err?.message || "Erro ao avancar bloco");
    } finally {
      setActing(false);
    }
  }

  /* ── GPS capture (respects block config) ── */
  function handleCaptureGps(gpsConfig?: Record<string, any>) {
    if (!navigator.geolocation) {
      alert("GPS nao disponivel neste dispositivo");
      return;
    }
    const cfg = gpsConfig || {};
    const highAccuracy = cfg.highAccuracy !== false;

    if (cfg.trackingMode === "continuous") {
      // Start continuous tracking
      if (v2GpsWatchRef.current !== null) return; // already tracking
      setV2GpsTracking(true);
      setV2GpsLoading(true);
      v2GpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setV2GpsLoading(false);
        },
        () => {
          setV2GpsLoading(false);
        },
        { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: (cfg.intervalSeconds || 30) * 1000 }
      );
    } else {
      // Single capture (pontual)
      setV2GpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setV2GpsLoading(false);
        },
        () => {
          alert("Erro ao capturar localizacao. Verifique as permissoes.");
          setV2GpsLoading(false);
        },
        { enableHighAccuracy: highAccuracy, timeout: 15000 }
      );
    }
  }

  function handleStopGpsTracking() {
    if (v2GpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(v2GpsWatchRef.current);
      v2GpsWatchRef.current = null;
    }
    setV2GpsTracking(false);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-400">Ordem de servico nao encontrada.</p>
        <button onClick={() => router.push("/tech/orders")} className="mt-3 text-sm font-medium text-blue-600">
          Voltar
        </button>
      </div>
    );
  }

  const isOverdue = new Date(order.deadlineAt) < new Date() && !["CONCLUIDA", "APROVADA", "CANCELADA"].includes(order.status);
  const hasWorkflow = !!workflow;
  const isV2Workflow = hasWorkflow && isV2(workflow);
  const canAct = ["ATRIBUIDA", "A_CAMINHO", "EM_EXECUCAO", "AJUSTE"].includes(order.status);

  return (
    <div className="pb-6">
      {/* Back button */}
      <button onClick={() => router.push("/tech/orders")} className="flex items-center gap-1 text-xs text-slate-500 mb-3">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      {/* Title + Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[order.status] || "bg-slate-100 text-slate-600"}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
          {isOverdue && (
            <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Atrasada</span>
          )}
          {isPaused && (
            <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 animate-pulse">Pausado</span>
          )}
        </div>
        <h1 className="text-lg font-bold text-slate-900">{order.title}</h1>
      </div>

      {/* GPS Tracking Banner */}
      {trackingActive && distanceToTarget !== null && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 p-4 mb-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/70">Distancia ate o local</p>
              <p className="text-2xl font-bold">{formatDistance(distanceToTarget)}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse mb-1" />
              <span className="text-[10px] text-white/70">GPS ativo</span>
            </div>
          </div>
          {distanceToTarget < 200 && (
            <div className="mt-3 rounded-xl bg-white/20 px-3 py-2 text-center">
              <p className="text-xs font-semibold">Voce esta proximo! Clique em &quot;Cheguei&quot; ao chegar.</p>
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
        {order.description && <p className="text-sm text-slate-600 mb-3">{order.description}</p>}
        <div className="space-y-2.5">
          <InfoRow icon="location" color="blue" label="Endereco" value={order.addressText} />
          <InfoRow icon="money" color="green" label="Valor" value={formatCurrency(order.valueCents)} bold />
          <InfoRow icon="clock" color={isOverdue ? "red" : "slate"} label="Prazo"
            value={new Date(order.deadlineAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            bold={isOverdue}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          ACTION BUTTONS (Smart flow)
          ═══════════════════════════════════════════ */}

      {/* ATRIBUIDA: Accept + Go */}
      {order.status === "ATRIBUIDA" && (
        <div className="space-y-2 mb-4">
          <button
            onClick={() => handleStatusChange("A_CAMINHO")}
            disabled={acting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            <span className="text-xl">🚗</span>
            {acting ? "Atualizando..." : "Estou a Caminho"}
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-3 text-sm font-semibold text-blue-700 active:bg-blue-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Abrir Navegacao GPS
          </a>
        </div>
      )}

      {/* A_CAMINHO: Arrived button */}
      {order.status === "A_CAMINHO" && (
        <div className="space-y-2 mb-4">
          <button
            onClick={() => handleStatusChange("EM_EXECUCAO")}
            disabled={acting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            <span className="text-xl">📍</span>
            {acting ? "Registrando..." : "Cheguei no Local"}
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-3 text-sm font-semibold text-blue-700 active:bg-blue-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Continuar Navegacao
          </a>
        </div>
      )}

      {/* EM_EXECUCAO: Workflow or Finalize */}
      {order.status === "EM_EXECUCAO" && !hasWorkflow && !isPaused && (
        <div className="space-y-2 mb-4">
          <button
            onClick={() => handleStatusChange("CONCLUIDA")}
            disabled={acting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            <span className="text-xl">✅</span>
            {acting ? "Finalizando..." : "Finalizar Servico"}
          </button>
        </div>
      )}

      {/* AJUSTE: Retry */}
      {order.status === "AJUSTE" && (
        <div className="space-y-2 mb-4">
          <div className="rounded-2xl bg-red-50 border border-red-200 p-3 mb-2">
            <p className="text-xs font-semibold text-red-700">Ajuste solicitado pelo gestor</p>
            <p className="text-[11px] text-red-600 mt-1">Verifique as orientacoes e retome o servico.</p>
          </div>
          <button
            onClick={() => handleStatusChange("EM_EXECUCAO")}
            disabled={acting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            <span className="text-xl">🔄</span>
            {acting ? "Retomando..." : "Retomar Servico"}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PAUSE / RESUME (during execution)
          ═══════════════════════════════════════════ */}

      {order.status === "EM_EXECUCAO" && (
        <>
          {isPaused ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⏸️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Execucao Pausada</p>
                  <p className="text-[11px] text-amber-600">
                    {PAUSE_REASONS.find(r => r.id === pauseReason)?.label || pauseReason}
                    {pausedAt && ` - desde ${new Date(pausedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResume}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-3 text-sm font-bold text-white shadow active:scale-[0.98] transition-all"
              >
                <span>▶️</span> Retomar Execucao
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPauseModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-semibold text-amber-700 mb-4 active:bg-amber-100 transition-colors"
            >
              <span>⏸️</span> Pausar Execucao
            </button>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════
          V2 WORKFLOW
          ═══════════════════════════════════════════ */}
      {isV2Workflow && !workflow.isComplete && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Fluxo: {workflow.templateName}
            <span className="ml-auto text-xs font-normal text-slate-400">
              {workflow.completedBlocks}/{workflow.totalBlocks}
            </span>
          </h3>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-slate-100 mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${workflow.totalBlocks > 0 ? (workflow.completedBlocks / workflow.totalBlocks) * 100 : 0}%` }}
            />
          </div>

          {/* Execution path (block list) */}
          <div className="space-y-2">
            {workflow.executionPath
              .filter((b) => !HIDDEN_TYPES.has(b.type))
              .map((block) => {
                const isCurrent = workflow.currentBlock?.id === block.id;
                const isAuto = isAutoBlock(block);
                return (
                  <div
                    key={block.id}
                    className={`rounded-xl border p-3 transition-all ${
                      block.completed
                        ? "border-green-200 bg-green-50"
                        : isCurrent
                          ? "border-blue-300 bg-blue-50 shadow-sm"
                          : "border-slate-100 bg-slate-50 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg flex-shrink-0 ${
                        block.completed ? "bg-green-100" : isCurrent ? "bg-blue-100" : "bg-slate-100"
                      }`}>
                        {block.completed ? "✅" : block.icon || "📌"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          block.completed ? "text-green-800" : isCurrent ? "text-blue-800" : "text-slate-500"
                        }`}>
                          {block.name}
                          {isAuto && <span className="ml-1 text-[10px] text-slate-400">(auto)</span>}
                        </p>
                        {block.completed && block.completedAt && (
                          <p className="text-[11px] text-green-600">
                            {new Date(block.completedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        {block.completed && block.note && (
                          <p className="text-[11px] text-green-700 mt-0.5 truncate">📝 {block.note}</p>
                        )}
                        {block.completed && block.responseData?.answer && (
                          <p className="text-[11px] text-green-700 mt-0.5">💬 {block.responseData.answer}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Current block action area */}
          {workflow.currentBlock && canAct && !isPaused && (
            <V2BlockAction
              block={workflow.currentBlock}
              order={order}
              acting={acting}
              attachments={attachments}
              setAttachments={setAttachments}
              v2Note={v2Note}
              setV2Note={setV2Note}
              v2Answer={v2Answer}
              setV2Answer={setV2Answer}
              v2CheckedItems={v2CheckedItems}
              setV2CheckedItems={setV2CheckedItems}
              v2GpsCoords={v2GpsCoords}
              v2GpsLoading={v2GpsLoading}
              handleCaptureGps={handleCaptureGps}
              v2GpsTracking={v2GpsTracking}
              handleStopGpsTracking={handleStopGpsTracking}
              v2FormFields={v2FormFields}
              setV2FormFields={setV2FormFields}
              onAdvance={handleAdvanceBlockV2}
            />
          )}
        </div>
      )}

      {/* V2 workflow complete */}
      {isV2Workflow && workflow.isComplete && (
        <WorkflowComplete
          name={workflow.templateName}
          blocks={workflow.executionPath.filter((b) => !HIDDEN_TYPES.has(b.type))}
        />
      )}

      {/* ═══════════════════════════════════════════
          V1 WORKFLOW (legacy)
          ═══════════════════════════════════════════ */}
      {hasWorkflow && !isV2Workflow && !workflow.isComplete && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Fluxo: {(workflow as WorkflowProgressV1).templateName}
            <span className="ml-auto text-xs font-normal text-slate-400">
              {(workflow as WorkflowProgressV1).completedSteps}/{(workflow as WorkflowProgressV1).totalSteps}
            </span>
          </h3>

          <div className="h-2 rounded-full bg-slate-100 mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${((workflow as WorkflowProgressV1).completedSteps / (workflow as WorkflowProgressV1).totalSteps) * 100}%` }}
            />
          </div>

          <div className="space-y-2">
            {(workflow as WorkflowProgressV1).steps.map((step, idx) => {
              const isCurrent = !step.completed && idx === (workflow as WorkflowProgressV1).completedSteps;
              return (
                <div key={step.order} className={`rounded-xl border p-3 transition-all ${
                  step.completed ? "border-green-200 bg-green-50" : isCurrent ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-100 bg-slate-50 opacity-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg flex-shrink-0 ${
                      step.completed ? "bg-green-100" : isCurrent ? "bg-blue-100" : "bg-slate-100"
                    }`}>
                      {step.completed ? "✅" : step.icon || "📌"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${step.completed ? "text-green-800" : isCurrent ? "text-blue-800" : "text-slate-500"}`}>
                        {step.name}
                      </p>
                      {step.completed && step.completedAt && (
                        <p className="text-[11px] text-green-600">
                          {new Date(step.completedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {step.completed && step.note && (
                        <p className="text-[11px] text-green-700 mt-0.5 truncate">📝 {step.note}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">{idx + 1}/{(workflow as WorkflowProgressV1).totalSteps}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* V1 current step action */}
          {(workflow as WorkflowProgressV1).currentStep && canAct && !isPaused && (
            <div className="mt-4 space-y-2">
              {((workflow as WorkflowProgressV1).currentStep!.requireNote || showNoteInput) && (
                <textarea
                  placeholder={(workflow as WorkflowProgressV1).currentStep!.requireNote ? "Observacao obrigatoria..." : "Observacao (opcional)..."}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                />
              )}
              {!showNoteInput && !(workflow as WorkflowProgressV1).currentStep!.requireNote && (
                <button onClick={() => setShowNoteInput(true)} className="text-xs text-slate-400 hover:text-slate-600">
                  + Adicionar observacao
                </button>
              )}
              {(workflow as WorkflowProgressV1).currentStep!.requirePhoto && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium text-slate-600 mb-2">📷 Foto obrigatoria para este passo</p>
                  <PhotoUpload
                    orderId={order.id}
                    type="WORKFLOW_STEP"
                    stepOrder={(workflow as WorkflowProgressV1).currentStep!.order}
                    attachments={attachments}
                    onUpload={(att) => setAttachments((prev) => [...prev, att])}
                    apiFetch={techApi}
                    label="Tirar foto"
                  />
                </div>
              )}
              <button
                onClick={handleAdvanceStepV1}
                disabled={acting || ((workflow as WorkflowProgressV1).currentStep!.requireNote && !noteText.trim())}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                <span className="text-xl">{(workflow as WorkflowProgressV1).currentStep!.icon || "▶️"}</span>
                {acting ? "Avancando..." : (workflow as WorkflowProgressV1).currentStep!.name}
              </button>
            </div>
          )}
        </div>
      )}

      {/* V1 workflow complete */}
      {hasWorkflow && !isV2Workflow && workflow.isComplete && (
        <WorkflowComplete
          name={(workflow as WorkflowProgressV1).templateName}
          blocks={(workflow as WorkflowProgressV1).steps.map(s => ({
            id: String(s.order),
            name: s.name,
            completedAt: s.completedAt,
          }))}
        />
      )}

      {/* ── Photos (Antes / Depois) ── */}
      {["EM_EXECUCAO", "CONCLUIDA", "APROVADA", "AJUSTE", "ATRIBUIDA", "A_CAMINHO"].includes(order.status) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">📷 Fotos</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Antes</p>
              <PhotoUpload
                orderId={order.id}
                type="ANTES"
                attachments={attachments}
                onUpload={(att) => setAttachments((prev) => [...prev, att])}
                apiFetch={techApi}
                label="Foto antes"
                disabled={["CONCLUIDA", "APROVADA"].includes(order.status)}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Depois</p>
              <PhotoUpload
                orderId={order.id}
                type="DEPOIS"
                attachments={attachments}
                onUpload={(att) => setAttachments((prev) => [...prev, att])}
                apiFetch={techApi}
                label="Foto depois"
                disabled={["CONCLUIDA", "APROVADA"].includes(order.status)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completed state */}
      {(order.status === "CONCLUIDA" || order.status === "APROVADA") && (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm font-semibold text-green-800">
            Servico {order.status === "APROVADA" ? "aprovado" : "concluido"}!
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PAUSE MODAL
          ═══════════════════════════════════════════ */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in" onClick={() => setShowPauseModal(false)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl p-5 pb-8 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Pausar Execucao</h3>
              <button onClick={() => setShowPauseModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">Selecione o motivo da pausa:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PAUSE_REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setPauseReason(r.id)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                    pauseReason === r.id
                      ? "border-amber-400 bg-amber-50 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg">{r.icon}</span>
                  <span className={`text-xs font-medium ${pauseReason === r.id ? "text-amber-800" : "text-slate-600"}`}>
                    {r.label}
                  </span>
                </button>
              ))}
            </div>

            {pauseReason === "other" && (
              <textarea
                value={pauseNote}
                onChange={e => setPauseNote(e.target.value)}
                placeholder="Descreva o motivo..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none mb-4"
              />
            )}

            <button
              onClick={handlePause}
              disabled={!pauseReason || (pauseReason === "other" && !pauseNote.trim())}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-bold text-white shadow disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              ⏸️ Confirmar Pausa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function InfoRow({ icon, color, label, value, bold }: { icon: string; color: string; label: string; value: string; bold?: boolean }) {
  const iconMap: Record<string, React.ReactNode> = {
    location: <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
    money: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  };
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-500",
    green: "bg-green-50 text-green-500",
    red: "bg-red-50 text-red-500",
    slate: "bg-slate-50 text-slate-500",
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0 ${colorMap[color]}`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          {iconMap[icon]}
        </svg>
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-sm ${bold ? "font-bold" : "font-medium"} ${color === "red" ? "text-red-600" : "text-slate-800"}`}>{value}</p>
      </div>
    </div>
  );
}

function WorkflowComplete({ name, blocks }: { name: string; blocks: { id: string; name: string; completedAt?: string }[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Fluxo: {name}</h3>
      <div className="h-2 rounded-full bg-green-200 mb-3">
        <div className="h-full rounded-full bg-green-500 w-full" />
      </div>
      <div className="space-y-1.5">
        {blocks.map((block) => (
          <div key={block.id} className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50/50 px-3 py-2">
            <span className="text-sm">✅</span>
            <span className="text-xs font-medium text-green-800 flex-1">{block.name}</span>
            {block.completedAt && (
              <span className="text-[10px] text-green-500">
                {new Date(block.completedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   V2 BLOCK ACTION COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function V2BlockAction({
  block, order, acting, attachments, setAttachments,
  v2Note, setV2Note, v2Answer, setV2Answer,
  v2CheckedItems, setV2CheckedItems,
  v2GpsCoords, v2GpsLoading, handleCaptureGps,
  v2GpsTracking, handleStopGpsTracking,
  v2FormFields, setV2FormFields, onAdvance,
}: {
  block: BlockProgress;
  order: ServiceOrder;
  acting: boolean;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  v2Note: string;
  setV2Note: (s: string) => void;
  v2Answer: string;
  setV2Answer: (s: string) => void;
  v2CheckedItems: string[];
  setV2CheckedItems: React.Dispatch<React.SetStateAction<string[]>>;
  v2GpsCoords: { lat: number; lng: number } | null;
  v2GpsLoading: boolean;
  handleCaptureGps: (gpsConfig?: Record<string, any>) => void;
  v2GpsTracking: boolean;
  handleStopGpsTracking: () => void;
  v2FormFields: Record<string, string>;
  setV2FormFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAdvance: () => void;
}) {
  const c = block.config || {};

  function isDisabled(): boolean {
    if (acting) return true;
    switch (block.type) {
      case "STEP":
        if (c.requireNote && !v2Note.trim()) return true;
        return false;
      case "NOTE":
        return c.required !== false && !v2Note.trim();
      case "PHOTO":
        return !attachments.some((a) => a.type === "WORKFLOW_STEP");
      case "GPS":
        return !v2GpsCoords;
      case "QUESTION":
        return !v2Answer;
      case "CHECKLIST":
        return v2CheckedItems.length === 0;
      case "CONDITION":
        return !v2Answer;
      case "ACTION_BUTTONS":
        return !v2Answer;
      case "SIGNATURE":
        return !attachments.some((a) => a.type === "WORKFLOW_STEP");
      case "FORM":
        if (c.fields) return c.fields.some((f: any) => f.required && !v2FormFields[f.name]?.trim());
        return false;
      default:
        return false;
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <span className="text-base">{block.icon}</span>
          {block.name}
        </p>

        {/* STEP */}
        {block.type === "STEP" && (
          <div className="space-y-2">
            {c.description && <p className="text-xs text-slate-600">{c.description}</p>}
            {c.requirePhoto && (
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-[11px] font-medium text-slate-500 mb-1">📷 Foto obrigatoria</p>
                <PhotoUpload orderId={order.id} type="WORKFLOW_STEP" attachments={attachments}
                  onUpload={(att) => setAttachments((prev) => [...prev, att])} apiFetch={techApi} label="Tirar foto" />
              </div>
            )}
            <textarea placeholder={c.requireNote ? "Observacao obrigatoria..." : "Observacao (opcional)..."}
              value={v2Note} onChange={(e) => setV2Note(e.target.value)} rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          </div>
        )}

        {/* PHOTO */}
        {block.type === "PHOTO" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">{c.label || "Tire uma foto"}{c.minPhotos > 1 ? ` (minimo ${c.minPhotos} fotos)` : ""}</p>
            <PhotoUpload orderId={order.id} type="WORKFLOW_STEP" attachments={attachments}
              onUpload={(att) => setAttachments((prev) => [...prev, att])} apiFetch={techApi} label="📸 Tirar foto" />
          </div>
        )}

        {/* NOTE */}
        {block.type === "NOTE" && (
          <textarea placeholder={c.placeholder || "Digite sua observacao..."} value={v2Note}
            onChange={(e) => setV2Note(e.target.value)} rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
        )}

        {/* STATUS manual — botao customizado para o tecnico confirmar mudanca de status */}
        {block.type === "STATUS" && c.transitionMode === "manual" && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-xs text-blue-600 mb-2">Confirme para mudar o status da OS</p>
            <div className="text-sm font-bold text-blue-800">{c.targetStatus}</div>
          </div>
        )}

        {/* GPS */}
        {block.type === "GPS" && (
          <div className="space-y-2">
            {/* Config info badges */}
            <div className="flex flex-wrap gap-1">
              {c.highAccuracy !== false && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Alta precisao</span>
              )}
              {c.trackingMode === "continuous" && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                  Rastreamento continuo{c.intervalSeconds ? ` (${c.intervalSeconds}s)` : ""}
                </span>
              )}
              {c.auto && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Captura automatica</span>
              )}
            </div>

            {/* Tracking active banner */}
            {v2GpsTracking && (
              <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-indigo-700">Rastreamento ativo</span>
                </div>
                <button onClick={handleStopGpsTracking} className="text-[10px] font-medium text-red-500 hover:text-red-700">Parar</button>
              </div>
            )}

            {/* Capture/Start button */}
            {!v2GpsTracking && !c.auto && (
              <button onClick={() => handleCaptureGps(c)} disabled={v2GpsLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white py-2.5 text-sm font-medium text-blue-700 active:bg-blue-50">
                {v2GpsLoading ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />Capturando...</>
                ) : (
                  <>{c.trackingMode === "continuous" ? "📍 Iniciar rastreamento" : "📍 Registrar localizacao"}</>
                )}
              </button>
            )}
            {c.auto && !v2GpsCoords && v2GpsLoading && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Capturando automaticamente...
              </div>
            )}

            {v2GpsCoords && (
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                ✅ Lat: {v2GpsCoords.lat.toFixed(6)}, Lng: {v2GpsCoords.lng.toFixed(6)}
              </p>
            )}
          </div>
        )}

        {/* QUESTION */}
        {block.type === "QUESTION" && (
          <div className="space-y-2">
            {c.question && <p className="text-sm font-medium text-slate-700">{c.question}</p>}
            <div className="space-y-1.5">
              {(c.options || ["Sim", "Nao"]).map((opt: string) => (
                <button key={opt} onClick={() => setV2Answer(opt)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                    v2Answer === opt ? "border-blue-400 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    v2Answer === opt ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  }`}>
                    {v2Answer === opt && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CHECKLIST */}
        {block.type === "CHECKLIST" && (
          <div className="space-y-1.5">
            {(c.items || []).map((item: string) => {
              const checked = v2CheckedItems.includes(item);
              return (
                <button key={item} onClick={() => setV2CheckedItems((prev) => checked ? prev.filter((i) => i !== item) : [...prev, item])}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                    checked ? "border-green-300 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-700"
                  }`}>
                  <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 border-2 ${
                    checked ? "border-green-500 bg-green-500" : "border-slate-300"
                  }`}>
                    {checked && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  {item}
                </button>
              );
            })}
          </div>
        )}

        {/* CONDITION */}
        {block.type === "CONDITION" && (
          <div className="space-y-2">
            {c.question && <p className="text-sm font-medium text-slate-700">{c.question}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setV2Answer("SIM")}
                className={`rounded-lg border py-3 text-sm font-bold transition-all ${v2Answer === "SIM" ? "border-green-400 bg-green-100 text-green-800" : "border-slate-200 bg-white text-slate-600"}`}>
                ✅ Sim
              </button>
              <button onClick={() => setV2Answer("NAO")}
                className={`rounded-lg border py-3 text-sm font-bold transition-all ${v2Answer === "NAO" ? "border-red-400 bg-red-100 text-red-800" : "border-slate-200 bg-white text-slate-600"}`}>
                ❌ Nao
              </button>
            </div>
          </div>
        )}

        {/* ACTION_BUTTONS */}
        {block.type === "ACTION_BUTTONS" && (() => {
          const buttons: { id: string; label: string; color: string; icon?: string }[] = c.buttons || [];
          const COLOR_MAP: Record<string, { selected: string; normal: string; full: string }> = {
            green: { selected: "border-green-400 bg-green-100 text-green-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-green-50", full: "bg-gradient-to-r from-green-500 to-green-600 text-white" },
            red: { selected: "border-red-400 bg-red-100 text-red-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-red-50", full: "bg-gradient-to-r from-red-500 to-red-600 text-white" },
            blue: { selected: "border-blue-400 bg-blue-100 text-blue-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-blue-50", full: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
            yellow: { selected: "border-yellow-400 bg-yellow-100 text-yellow-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-yellow-50", full: "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white" },
            slate: { selected: "border-slate-400 bg-slate-200 text-slate-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50", full: "bg-gradient-to-r from-slate-500 to-slate-600 text-white" },
          };
          // Single button = simple confirm action (auto-select on render)
          if (buttons.length === 1) {
            const btn = buttons[0];
            const colors = COLOR_MAP[btn.color] || COLOR_MAP.green;
            // Auto-set answer so submit is enabled
            if (v2Answer !== btn.id) setTimeout(() => setV2Answer(btn.id), 0);
            return (
              <div className="space-y-2">
                {c.title && <p className="text-sm font-medium text-slate-700">{c.title}</p>}
                <div className={`rounded-xl py-4 text-center text-base font-bold shadow-md ${colors.full}`}>
                  {btn.icon ? `${btn.icon} ` : ""}{btn.label}
                </div>
                <p className="text-[11px] text-slate-400 text-center">Clique em "Confirmar" abaixo para continuar</p>
              </div>
            );
          }
          // Multiple buttons = choice
          return (
            <div className="space-y-2">
              {c.title && <p className="text-sm font-medium text-slate-700">{c.title}</p>}
              <div className={`grid gap-2 ${buttons.length === 2 ? "grid-cols-2" : buttons.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {buttons.map((btn) => {
                  const colors = COLOR_MAP[btn.color] || COLOR_MAP.slate;
                  const isSelected = v2Answer === btn.id;
                  return (
                    <button
                      key={btn.id}
                      onClick={() => setV2Answer(btn.id)}
                      className={`rounded-lg border py-3 text-sm font-bold transition-all ${isSelected ? colors.selected : colors.normal}`}
                    >
                      {btn.icon ? `${btn.icon} ` : ""}{btn.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* SIGNATURE */}
        {block.type === "SIGNATURE" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">{c.label || "Assinatura digital"}</p>
            <PhotoUpload orderId={order.id} type="WORKFLOW_STEP" attachments={attachments}
              onUpload={(att) => setAttachments((prev) => [...prev, att])} apiFetch={techApi} label="✍️ Capturar assinatura" />
          </div>
        )}

        {/* FORM */}
        {block.type === "FORM" && c.fields && (
          <div className="space-y-2">
            {(c.fields as any[]).map((field: any) => (
              <div key={field.name}>
                <label className="text-xs font-medium text-slate-600">
                  {field.name}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === "select" ? (
                  <select value={v2FormFields[field.name] || ""} onChange={(e) => setV2FormFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 mt-1">
                    <option value="">Selecione...</option>
                    {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input type={field.type === "number" ? "number" : "text"} value={v2FormFields[field.name] || ""}
                    onChange={(e) => setV2FormFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 mt-1" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advance button */}
      <button onClick={onAdvance} disabled={isDisabled()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all">
        <span className="text-xl">{block.icon || "▶️"}</span>
        {acting ? "Avancando..." : (block.type === "STATUS" && c.buttonLabel ? c.buttonLabel : `Confirmar: ${block.name}`)}
      </button>
    </div>
  );
}
