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
  code?: string;
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
  createdByName?: string | null;
  contactPersonName?: string | null;
  clientPartner?: { id: string; name: string; phone?: string } | null;
  assignedPartner?: { id: string; name: string; phone?: string } | null;
  company?: { phone?: string } | null;
  ledger?: { commissionCents: number; commissionBps: number } | null;
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

type TechPortalConfig = {
  showAddress?: boolean;
  showValue?: boolean;
  showDeadline?: boolean;
  showDescription?: boolean;
  showClient?: boolean;
  showClientPhone?: boolean;
  showOsCode?: boolean;
  showCommission?: boolean;
  showAttachments?: boolean;
  showStatus?: boolean;
  showSiteContact?: boolean;
  showCompanyPhone?: boolean;
  showCreator?: boolean;
  fieldOrder?: string[];
  companyPhoneLabel?: string;
  commissionLabel?: string;
  customMessage?: string;
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
  techPortalConfig?: TechPortalConfig | null;
};


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

/* Block types that the technician interacts with */
const INTERACTIVE_TYPES = new Set(["STEP", "PHOTO", "NOTE", "GPS", "QUESTION", "CHECKLIST", "SIGNATURE", "FORM", "ACTION_BUTTONS", "ARRIVAL_QUESTION"]);

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* ── Shared INFO styling maps (used by INFO blocks, TerminalScreen, post-workflow) ── */

const INFO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800" },
  green: { bg: "bg-green-50", border: "border-green-300", text: "text-green-800" },
  red: { bg: "bg-red-50", border: "border-red-300", text: "text-red-800" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-800" },
  slate: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-800" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-800" },
  orange: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800" },
};

const FONT_SIZES: Record<string, { title: string; body: string; icon: string }> = {
  sm: { title: "text-sm", body: "text-xs", icon: "text-lg" },
  md: { title: "text-base", body: "text-sm", icon: "text-2xl" },
  lg: { title: "text-lg", body: "text-base", icon: "text-3xl" },
};

const BOX_SIZES: Record<string, string> = {
  compact: "p-2.5 rounded-lg",
  normal: "p-4 rounded-xl",
  large: "p-6 rounded-2xl",
};

// Button color map — shared by ACTION_BUTTONS and confirmButton rendering
const BUTTON_COLORS: Record<string, { selected: string; normal: string; full: string }> = {
  green: { selected: "border-green-400 bg-green-100 text-green-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-green-50", full: "bg-gradient-to-r from-green-500 to-green-600 text-white" },
  red: { selected: "border-red-400 bg-red-100 text-red-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-red-50", full: "bg-gradient-to-r from-red-500 to-red-600 text-white" },
  blue: { selected: "border-blue-400 bg-blue-100 text-blue-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-blue-50", full: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
  yellow: { selected: "border-yellow-400 bg-yellow-100 text-yellow-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-yellow-50", full: "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white" },
  slate: { selected: "border-slate-400 bg-slate-200 text-slate-800", normal: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50", full: "bg-gradient-to-r from-slate-500 to-slate-600 text-white" },
};

function getInfoStyle(color?: string, fontSize?: string, boxSize?: string) {
  return {
    ic: INFO_COLORS[color || "blue"] || INFO_COLORS.blue,
    fs: FONT_SIZES[fontSize || "md"] || FONT_SIZES.md,
    bs: BOX_SIZES[boxSize || "normal"] || BOX_SIZES.normal,
  };
}

/** Resolve template variables like {titulo}, {codigo}, {endereco} etc */
function resolveVars(text: string, order: ServiceOrder | null): string {
  if (!text || !order) return text;
  const fmtC = (cents?: number) => cents != null ? (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";
  const fmtD = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
  return text
    .replace(/\{titulo\}/g, order.title || "-")
    .replace(/\{codigo\}/g, order.code || "-")
    .replace(/\{nome_cliente\}/g, (order as any).clientPartnerName || (order as any).clientName || "-")
    .replace(/\{telefone_cliente\}/g, (order as any).clientPhone || "-")
    .replace(/\{contato_local\}/g, order.contactPersonName || "-")
    .replace(/\{endereco\}/g, order.addressText || "-")
    .replace(/\{tecnico\}/g, (order as any).technicianName || (order as any).assignedPartnerName || "-")
    .replace(/\{valor\}/g, fmtC(order.valueCents))
    .replace(/\{data_agendamento\}/g, fmtD(order.deadlineAt || (order as any).scheduledStartAt))
    .replace(/\{empresa\}/g, (order as any).companyName || "-")
    .replace(/\{telefone_empresa\}/g, (order as any).companyPhone || "-")
    .replace(/\{status\}/g, order.status || "-")
    .replace(/\{descricao\}/g, order.description || "-");
}

/** Render an INFO-style card (used by INFO blocks, TerminalScreen, post-workflow, ACTION_BUTTONS info panel) */
function InfoCard({ config, order, name, className }: { config: any; order: ServiceOrder | null; name?: string; className?: string }) {
  const c = config || {};
  const { ic, fs, bs } = getInfoStyle(c.color, c.fontSize, c.boxSize);
  return (
    <div className={`border-2 ${ic.border} ${ic.bg} ${bs} ${className || ""}`}>
      {c.title && (
        <div className={`flex items-center gap-2 ${c.boxSize === "compact" ? "mb-1" : "mb-2"}`}>
          <span className={fs.icon}>{c.icon || "ℹ️"}</span>
          <span className={`${fs.title} font-bold ${ic.text}`}>{resolveVars(c.title || name || "", order)}</span>
        </div>
      )}
      {c.message && (
        <p className={`${fs.body} ${ic.text} opacity-80 whitespace-pre-line leading-relaxed`}>
          {resolveVars(c.message, order)}
        </p>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function TechOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowProgressV2 | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // V2 state
  const [v2Note, setV2Note] = useState("");
  const [v2Answer, _setV2Answer] = useState<string>("");
  const v2AnswerRef = useRef(v2Answer);
  const setV2Answer = (val: string) => { v2AnswerRef.current = val; _setV2Answer(val); };
  const [v2CheckedItems, setV2CheckedItems] = useState<string[]>([]);
  const [v2GpsCoords, setV2GpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [v2GpsLoading, setV2GpsLoading] = useState(false);
  const [v2GpsDenied, setV2GpsDenied] = useState(false);
  const [v2FormFields, setV2FormFields] = useState<Record<string, string>>({});


  // GPS block continuous tracking state
  const [v2GpsTracking, setV2GpsTracking] = useState(false);
  const v2GpsWatchRef = useRef<number | null>(null);

  // Proximity tracking state
  const [proximityDistance, setProximityDistance] = useState<number | null>(null);
  const proximityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proximityWatchRef = useRef<number | null>(null);
  const proximityAdvancedRef = useRef<string | null>(null);

  // Post-workflow INFO display (client-side timer for INFO+DELAY combos)
  const [postInfo, setPostInfo] = useState<{ info: any; hideAfterMs: number; blankAfterMs: number } | null>(null);
  const [postInfoPhase, setPostInfoPhase] = useState<"info" | "blank" | "done">("done");


  const loadOrder = useCallback(async () => {
    try {
      const data = await techApi<ServiceOrder>(`/service-orders/${id}`);
      setOrder(data);
      try {
        const wf = await techApi<WorkflowProgressV2>(`/service-orders/${id}/workflow`);
        setWorkflow(wf);
      } catch {
        setWorkflow((prev) => prev);
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
  const currentBlockId = workflow?.currentBlock?.id ?? null;
  useEffect(() => {
    setV2Note("");
    setV2Answer("");
    setV2CheckedItems([]);
    setV2GpsCoords(null);
    setV2GpsDenied(false);
    setV2FormFields({});
    // Stop continuous GPS tracking from previous block
    if (v2GpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(v2GpsWatchRef.current);
      v2GpsWatchRef.current = null;
      setV2GpsTracking(false);
    }
  }, [currentBlockId]);

  // Post-workflow INFO timer: when workflow completes with INFO+DELAY pattern, show info then blank
  useEffect(() => {
    if (!workflow || !workflow.isComplete) {
      if (postInfoPhase !== "done") { setPostInfoPhase("done"); setPostInfo(null); }
      return;
    }
    const path = workflow.executionPath;
    // Find last INFO block and subsequent DELAY blocks
    let lastInfoIdx = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].type === "INFO") { lastInfoIdx = i; break; }
    }
    if (lastInfoIdx < 0) return; // No INFO in path
    // Calculate delay durations after INFO
    const delaysAfterInfo: number[] = [];
    for (let i = lastInfoIdx + 1; i < path.length; i++) {
      if (path[i].type === "DELAY") {
        const cfg = path[i].config || {};
        const dur = cfg.duration ?? cfg.minutes ?? 0;
        const unit = cfg.unit || "minutes";
        const ms = unit === "seconds" ? dur * 1000 : unit === "hours" ? dur * 3600000 : unit === "days" ? dur * 86400000 : dur * 60000;
        delaysAfterInfo.push(ms);
      }
    }
    if (delaysAfterInfo.length === 0) return; // No DELAY after INFO

    const infoBlock = path[lastInfoIdx];
    const hideAfterMs = delaysAfterInfo[0] || 3000; // First delay = time to show info
    const blankAfterMs = delaysAfterInfo.length > 1 ? delaysAfterInfo[1] : 0; // Second delay = blank time

    setPostInfo({ info: infoBlock, hideAfterMs, blankAfterMs });
    setPostInfoPhase("info");

    // Timer 1: hide info after first delay
    const t1 = setTimeout(() => {
      if (blankAfterMs > 0) {
        setPostInfoPhase("blank");
        // Timer 2: after blank period, mark as done (will show link expired)
        const t2 = setTimeout(() => setPostInfoPhase("done"), blankAfterMs);
        return () => clearTimeout(t2);
      } else {
        setPostInfoPhase("done");
      }
    }, hideAfterMs);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.isComplete]);

  // GPS block: always auto-capture when block is reached (retries every 3s if denied)
  const gpsAutoAdvancedRef = useRef<string | null>(null);
  const gpsRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!workflow || !workflow.currentBlock) return;
    const block = workflow.currentBlock;
    if (block.type !== "GPS") return;
    const cfg = block.config || {};
    if (v2GpsCoords) return;
    if (cfg.trackingMode === "continuous") return; // continuous starts via watchPosition below
    if (!navigator.geolocation) { setV2GpsDenied(true); return; }

    const tryCapture = () => {
      setV2GpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setV2GpsLoading(false);
          setV2GpsDenied(false);
          if (gpsRetryRef.current) { clearInterval(gpsRetryRef.current); gpsRetryRef.current = null; }
        },
        () => {
          setV2GpsLoading(false);
          setV2GpsDenied(true);
          if (!gpsRetryRef.current) {
            gpsRetryRef.current = setInterval(() => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setV2GpsLoading(false);
                  setV2GpsDenied(false);
                  if (gpsRetryRef.current) { clearInterval(gpsRetryRef.current); gpsRetryRef.current = null; }
                },
                () => {},
                { enableHighAccuracy: cfg.highAccuracy !== false, timeout: 10000 }
              );
            }, 3000);
          }
        },
        { enableHighAccuracy: cfg.highAccuracy !== false, timeout: 15000 }
      );
    };
    tryCapture();

    return () => {
      if (gpsRetryRef.current) { clearInterval(gpsRetryRef.current); gpsRetryRef.current = null; }
    };
  }, [currentBlockId]);

  // GPS: auto-start continuous tracking when block is reached
  useEffect(() => {
    if (!workflow?.currentBlock) return;
    const block = workflow.currentBlock;
    if (block.type !== "GPS") return;
    const cfg = block.config || {};
    if (cfg.trackingMode !== "continuous") return;
    if (v2GpsWatchRef.current !== null) return; // already tracking
    if (!navigator.geolocation) { setV2GpsDenied(true); return; }
    setV2GpsTracking(true);
    setV2GpsLoading(true);
    v2GpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setV2GpsLoading(false);
        setV2GpsDenied(false);
      },
      () => { setV2GpsLoading(false); setV2GpsDenied(true); },
      { enableHighAccuracy: cfg.highAccuracy !== false, timeout: 15000, maximumAge: (cfg.intervalSeconds || 30) * 1000 }
    );
  }, [currentBlockId]);

  // GPS pontual: auto-advance once coords are captured
  useEffect(() => {
    if (!workflow?.currentBlock) return;
    const block = workflow.currentBlock;
    if (block.type !== "GPS") return;
    const cfg = block.config || {};
    if (cfg.trackingMode === "continuous") return; // continuous needs manual stop
    if (v2GpsCoords && gpsAutoAdvancedRef.current !== block.id) {
      gpsAutoAdvancedRef.current = block.id;
      setTimeout(() => handleAdvanceBlockV2(), 300);
    }
  }, [v2GpsCoords, currentBlockId]);


  // PROXIMITY_TRIGGER: auto-start tracking when block is reached
  useEffect(() => {
    if (!workflow?.currentBlock || !order) return;
    const block = workflow.currentBlock;
    if (block.type !== "PROXIMITY_TRIGGER") return;
    if (proximityAdvancedRef.current === block.id) return;
    if (!navigator.geolocation) { setV2GpsDenied(true); return; }

    const cfg = block.config || {};
    const intervalMs = (cfg.trackingIntervalSeconds || 30) * 1000;

    // Start watching position
    setV2GpsLoading(true);
    setV2GpsDenied(false);

    const sendPosition = async (lat: number, lng: number, accuracy?: number, speed?: number, heading?: number) => {
      try {
        const result = await techApi<{ distanceMeters: number | null; proximityReached: boolean; radiusMeters: number }>(
          `/service-orders/${order.id}/workflow/position`,
          { method: "POST", body: JSON.stringify({ lat, lng, accuracy, speed, heading }) }
        );
        if (result.distanceMeters != null) setProximityDistance(result.distanceMeters);
        if (result.proximityReached) {
          proximityAdvancedRef.current = block.id;
          // Reload workflow (block was auto-advanced by backend)
          setTimeout(async () => {
            try {
              const wf = await techApi<WorkflowProgressV2>(`/service-orders/${order.id}/workflow`);
              setWorkflow(wf);
              await loadOrder();
            } catch { /* ignore */ }
          }, 500);
        }
      } catch { /* ignore send errors */ }
    };

    let lastSentAt = 0;
    proximityWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setV2GpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setV2GpsLoading(false);
        setV2GpsDenied(false);
        const now = Date.now();
        if (now - lastSentAt >= intervalMs) {
          lastSentAt = now;
          sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed ?? undefined, pos.coords.heading ?? undefined);
        }
      },
      () => { setV2GpsLoading(false); setV2GpsDenied(true); },
      { enableHighAccuracy: cfg.requireHighAccuracy !== false, timeout: 15000, maximumAge: intervalMs }
    );

    // Also send immediately on first position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastSentAt = Date.now();
        sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed ?? undefined, pos.coords.heading ?? undefined);
      },
      () => {},
      { enableHighAccuracy: cfg.requireHighAccuracy !== false, timeout: 10000 }
    );

    return () => {
      if (proximityWatchRef.current !== null) {
        navigator.geolocation.clearWatch(proximityWatchRef.current);
        proximityWatchRef.current = null;
      }
    };
  }, [currentBlockId]);

  // Cleanup GPS tracking on unmount
  useEffect(() => {
    return () => {
      if (v2GpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(v2GpsWatchRef.current);
      }
      if (proximityWatchRef.current !== null) {
        navigator.geolocation.clearWatch(proximityWatchRef.current);
      }
    };
  }, []);



  /* ── V2 advance ── */
  async function handleAdvanceBlockV2() {
    if (!order || !workflow || !workflow.currentBlock) return;
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
        body.responseData = { answer: v2AnswerRef.current };
        break;
      case "CHECKLIST":
        body.responseData = { checkedItems: v2CheckedItems };
        break;
      case "CONDITION":
        body.responseData = { answer: v2AnswerRef.current };
        break;
      case "ACTION_BUTTONS":
        body.responseData = { buttonId: v2AnswerRef.current };
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
      case "ARRIVAL_QUESTION":
        body.responseData = { selectedMinutes: parseInt(v2AnswerRef.current) || 0 };
        break;
    }

    try {
      const wf = await techApi<WorkflowProgressV2>(
        `/service-orders/${order.id}/workflow/advance`,
        { method: "POST", body: JSON.stringify(body) }
      );

      setWorkflow(wf);
      // Reset V2 input state for the new block
      setV2Note("");
      _setV2Answer("");
      v2AnswerRef.current = "";
      setV2CheckedItems([]);
      setV2GpsCoords(null);
      setV2FormFields({});
      await loadOrder();
    } catch (err: any) {
      alert(err?.message || "Erro ao avancar bloco");
    } finally {
      setActing(false);
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
  // Allow action if status is interactive OR if workflow still has a pending block (e.g. INFO after RECUSADA)
  const hasCurrentBlock = hasWorkflow && !!workflow.currentBlock;
  const canAct = ["ABERTA", "OFERTADA", "ATRIBUIDA", "A_CAMINHO", "EM_EXECUCAO", "AJUSTE"].includes(order.status) || hasCurrentBlock;

  // Tech portal visibility config (defaults to show all)
  const portalCfg: TechPortalConfig = workflow?.techPortalConfig || {};
  const showAddress = portalCfg.showAddress !== false;
  const showValue = portalCfg.showValue !== false;
  const showDeadline = portalCfg.showDeadline !== false;
  const showDescription = portalCfg.showDescription !== false;
  const showClient = portalCfg.showClient === true;
  const showClientPhone = portalCfg.showClientPhone === true;
  const showOsCode = portalCfg.showOsCode !== false;
  const showCommission = portalCfg.showCommission === true;
  const showStatusBadge = portalCfg.showStatus !== false;
  const showSiteContact = portalCfg.showSiteContact !== false;
  const showCompanyPhone = portalCfg.showCompanyPhone !== false;
  const showCreator = portalCfg.showCreator === true;
  const companyPhoneLabel = portalCfg.companyPhoneLabel || "Escritorio";
  const commissionLabel = portalCfg.commissionLabel || "Comissao";
  const customMessage = portalCfg.customMessage || "";

  // When workflow is complete and status is terminal → show finished screen
  const isTerminalComplete = hasWorkflow && workflow.isComplete && ["RECUSADA", "CONCLUIDA", "APROVADA", "CANCELADA"].includes(order.status);

  if (isTerminalComplete) {
    // Check for INFO+DELAY pattern for timed display
    const path = workflow.executionPath || [];
    let lastInfoIdx = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].type === "INFO") { lastInfoIdx = i; break; }
    }
    // Find delays after INFO to calculate display time
    let showInfoMs = 0;
    let blankMs = 0;
    if (lastInfoIdx >= 0) {
      const delaysAfter: number[] = [];
      for (let i = lastInfoIdx + 1; i < path.length; i++) {
        if (path[i].type === "DELAY") {
          const cfg = path[i].config || {};
          const dur = cfg.duration ?? cfg.minutes ?? 0;
          const unit = cfg.unit || "minutes";
          const ms = unit === "seconds" ? dur * 1000 : unit === "hours" ? dur * 3600000 : unit === "days" ? dur * 86400000 : dur * 60000;
          delaysAfter.push(ms);
        }
      }
      showInfoMs = delaysAfter[0] || 0;
      blankMs = delaysAfter.length > 1 ? delaysAfter[1] : 0;
    }

    return <TerminalScreen order={order} infoBlock={lastInfoIdx >= 0 ? path[lastInfoIdx] : null} showInfoMs={showInfoMs} blankMs={blankMs} />;
  }

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
        {showStatusBadge && (
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[order.status] || "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
            {isOverdue && (
              <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Atrasada</span>
            )}
          </div>
        )}
        <h1 className="text-lg font-bold text-slate-900">{order.title}</h1>
      </div>


      {/* Custom message from workflow */}
      {customMessage && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 mb-4">
          <p className="text-sm text-blue-700 leading-relaxed">{customMessage}</p>
        </div>
      )}

      {/* Info Card — hidden during post-workflow blank phase */}
      <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4 ${postInfoPhase === "blank" ? "hidden" : ""}`}>
        {showOsCode && order.code && <p className="text-xs font-mono text-slate-500 mb-2">🔢 {order.code}</p>}
        {showDescription && order.description && <p className="text-sm text-slate-600 mb-3">{order.description}</p>}
        <div className="space-y-2.5">
          {showClient && order.clientPartner?.name && <InfoRow icon="user" color="blue" label="Cliente" value={order.clientPartner.name} />}
          {showClientPhone && order.clientPartner?.phone && <InfoRow icon="phone" color="blue" label="Telefone" value={order.clientPartner.phone} />}
          {showSiteContact && order.contactPersonName && (
            <InfoRow icon="home" color="blue" label="Contato no local" value={order.contactPersonName} />
          )}
          {showAddress && <InfoRow icon="location" color="blue" label="Endereco" value={order.addressText} />}
          {showValue && <InfoRow icon="money" color="green" label="Valor" value={formatCurrency(order.valueCents)} bold />}
          {showDeadline && (
            <InfoRow icon="clock" color={isOverdue ? "red" : "slate"} label="Prazo"
              value={new Date(order.deadlineAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              bold={isOverdue}
            />
          )}
          {showCommission && order.ledger?.commissionCents != null && order.ledger.commissionCents > 0 && (
            <InfoRow icon="money" color="green" label={commissionLabel} value={formatCurrency(order.ledger.commissionCents)} bold />
          )}
          {showCompanyPhone && order.company?.phone && <InfoRow icon="building" color="slate" label={companyPhoneLabel} value={order.company.phone} />}
          {showCreator && order.createdByName && <InfoRow icon="pencil" color="slate" label="Criado por" value={order.createdByName} />}
        </div>
      </div>

      {/* Legacy action buttons, photos, pause — REMOVED. All controlled by workflow blocks. */}

      {/* ═══════════════════════════════════════════
          V2 WORKFLOW
          ═══════════════════════════════════════════ */}
      {hasWorkflow && !workflow.isComplete && (() => {
        const interactiveOnly = workflow.executionPath.filter((b) => INTERACTIVE_TYPES.has(b.type));
        const iTotal = interactiveOnly.length;
        const iCompleted = interactiveOnly.filter((b) => b.completed).length;
        return (
        <div className="mb-4">
          {/* Workflow internals (progress bar, completed blocks) hidden from tech view */}

          {/* Show INFO blocks that were auto-completed — visible while workflow continues */}
          {workflow.executionPath.filter((b) => b.type === "INFO" && b.completed).slice(-1).map((infoBlock) => (
              <InfoCard key={infoBlock.id} config={infoBlock.config} order={order} name={infoBlock.name} className="mb-3" />
          ))}

          {/* Current block action area */}
          {workflow.currentBlock && canAct && (
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
              v2GpsDenied={v2GpsDenied}
              v2GpsTracking={v2GpsTracking}
              handleStopGpsTracking={handleStopGpsTracking}
              v2FormFields={v2FormFields}
              setV2FormFields={setV2FormFields}
              onAdvance={handleAdvanceBlockV2}
              proximityDistance={proximityDistance}
            />
          )}
        </div>
        ); })()}

      {/* V2 workflow complete — with post-info animation */}
      {hasWorkflow && workflow.isComplete && (() => {
        // Post-workflow INFO+DELAY: show info card with timer
        if (postInfo && postInfoPhase === "info") {
          return (
            <div className="mb-4">
              <InfoCard config={postInfo.info.config} order={order} name={postInfo.info.name} />
            </div>
          );
        }
        // Blank phase: show nothing (white screen)
        if (postInfo && postInfoPhase === "blank") {
          return <div className="mb-4" />;
        }
        // Normal complete (no INFO+DELAY pattern, or done phase)
        return (
          <WorkflowComplete
            name={workflow.templateName}
            blocks={workflow.executionPath.filter((b) => INTERACTIVE_TYPES.has(b.type))}
          />
        );
      })()}
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
    user: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />,
    phone: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />,
    building: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />,
    pencil: <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />,
    home: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />,
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

function TerminalScreen({ order, infoBlock, showInfoMs, blankMs }: { order: ServiceOrder; infoBlock: any | null; showInfoMs: number; blankMs: number }) {
  const [phase, setPhase] = useState<"info" | "blank" | "done">(infoBlock && showInfoMs > 0 ? "info" : "done");

  useEffect(() => {
    if (!infoBlock || showInfoMs <= 0) { setPhase("done"); return; }
    const t1 = setTimeout(() => {
      if (blankMs > 0) {
        setPhase("blank");
        const t2 = setTimeout(() => setPhase("done"), blankMs);
        return () => clearTimeout(t2);
      }
      setPhase("done");
    }, showInfoMs);
    return () => clearTimeout(t1);
  }, [infoBlock, showInfoMs, blankMs]);

  // Phase "info": show INFO card
  if (phase === "info" && infoBlock) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <InfoCard config={infoBlock.config} order={order} name={infoBlock.name} className="w-full max-w-sm" />
      </div>
    );
  }

  // Phase "blank" or "done": empty screen
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <span className="text-2xl">✅</span>
        </div>
        <p className="text-sm font-medium text-slate-600">Ordem de serviço finalizada</p>
        <p className="text-xs text-slate-400 mt-1">Não há mais ações pendentes</p>
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
  v2GpsCoords, v2GpsLoading, v2GpsDenied,
  v2GpsTracking, handleStopGpsTracking,
  v2FormFields, setV2FormFields, onAdvance,
  proximityDistance,
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
  v2GpsDenied: boolean;
  v2GpsTracking: boolean;
  handleStopGpsTracking: () => void;
  v2FormFields: Record<string, string>;
  setV2FormFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAdvance: () => void;
  proximityDistance: number | null;
}) {
  const c = block.config || {};

  function isDisabled(): boolean {
    if (acting) return true;
    switch (block.type) {
      case "STEP":
        if (c.requireNote && !v2Note.trim()) return true;
        return false;
      case "NOTE": {
        const noteText = v2Note.trim();
        if (c.required !== false && !noteText) return true;
        if (noteText && c.minChars && noteText.length < c.minChars) return true;
        if (noteText && c.maxChars && noteText.length > c.maxChars) return true;
        return false;
      }
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
      case "ARRIVAL_QUESTION":
        return !v2Answer;
      case "FORM":
        if (c.fields) return c.fields.some((f: any) => f.required && !v2FormFields[f.name]?.trim());
        return false;
      default:
        return false;
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className={`rounded-xl border p-3 ${block.type === "ACTION_BUTTONS" ? "border-transparent bg-transparent p-0" : "border-blue-200 bg-blue-50/50"}`}>
        {block.type !== "ACTION_BUTTONS" && (
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <span className="text-base">{block.icon}</span>
          {block.name}
        </p>
        )}

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
          <div>
            <textarea placeholder={c.placeholder || "Digite sua observacao..."} value={v2Note}
              onChange={(e) => {
                if (c.maxChars && e.target.value.length > c.maxChars) return;
                setV2Note(e.target.value);
              }} rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
            {(c.minChars || c.maxChars) && (
              <div className={`text-right text-[10px] mt-0.5 ${
                c.minChars && v2Note.trim().length < c.minChars ? "text-red-500" :
                c.maxChars && v2Note.trim().length > c.maxChars * 0.9 ? "text-amber-500" : "text-slate-400"
              }`}>
                {v2Note.trim().length}{c.minChars ? `/${c.minChars} min` : ""}{c.maxChars ? ` · ${c.maxChars} max` : ""}
              </div>
            )}
          </div>
        )}

        {/* STATUS manual — botao customizado para o tecnico confirmar mudanca de status */}
        {block.type === "STATUS" && c.transitionMode === "manual" && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-xs text-blue-600 mb-2">Confirme para mudar o status da OS</p>
            <div className="text-sm font-bold text-blue-800">{c.targetStatus}</div>
          </div>
        )}

        {/* GPS — auto-captures on block entry, no manual button */}
        {block.type === "GPS" && (
          <div className="space-y-2">
            {/* GPS denied/disabled warning */}
            {v2GpsDenied && !v2GpsCoords && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-3">
                <span className="text-lg">📍</span>
                <div>
                  <p className="text-sm font-bold text-red-700">GPS desativado</p>
                  <p className="text-xs text-red-600">Ative a localizacao nas configuracoes do celular. O fluxo continuara automaticamente.</p>
                </div>
                <div className="ml-auto h-3 w-3 rounded-full bg-red-400 animate-pulse" />
              </div>
            )}

            {/* Tracking active banner (continuous mode) */}
            {v2GpsTracking && (
              <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-indigo-700">Rastreamento ativo</span>
                </div>
                <button onClick={handleStopGpsTracking} className="text-[10px] font-medium text-red-500 hover:text-red-700">Parar</button>
              </div>
            )}

            {/* Capturing indicator */}
            {!v2GpsCoords && v2GpsLoading && !v2GpsDenied && (
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

        {/* PROXIMITY_TRIGGER — auto-tracking with distance display */}
        {block.type === "PROXIMITY_TRIGGER" && (
          <div className="space-y-3">
            {/* GPS denied warning */}
            {v2GpsDenied && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-3">
                <span className="text-lg">📍</span>
                <div>
                  <p className="text-sm font-bold text-red-700">GPS desativado</p>
                  <p className="text-xs text-red-600">Ative a localizacao nas configuracoes do celular para o rastreamento funcionar.</p>
                </div>
                <div className="ml-auto h-3 w-3 rounded-full bg-red-400 animate-pulse" />
              </div>
            )}

            {/* Tracking active */}
            {!v2GpsDenied && (
              <div className="rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-bold text-rose-800">📡 Rastreamento ativo</span>
                </div>

                {v2GpsLoading && !v2GpsCoords && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-rose-600">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
                    Obtendo localizacao...
                  </div>
                )}

                {proximityDistance != null && (
                  <div className="text-center">
                    <div className="text-3xl font-black text-rose-700">
                      {proximityDistance >= 1000
                        ? `${(proximityDistance / 1000).toFixed(1)} km`
                        : `${proximityDistance} m`}
                    </div>
                    <p className="text-xs text-rose-500 mt-1">do destino</p>
                    <div className="mt-2 h-2 bg-rose-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-green-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.max(5, Math.min(100, 100 - (proximityDistance / ((c.radiusMeters || 50) * 10)) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Raio de ativacao: {c.radiusMeters || 50}m — avanca automaticamente ao chegar
                    </p>
                  </div>
                )}

                {v2GpsCoords && proximityDistance == null && (
                  <p className="text-xs text-rose-600 text-center">
                    Posicao capturada. Calculando distancia...
                  </p>
                )}

                {/* Manual "Cheguei" fallback button */}
                <button
                  onClick={onAdvance}
                  disabled={acting}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:from-green-600 hover:to-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {acting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>📍 Cheguei</>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Use se o GPS nao detectar sua chegada automaticamente
                </p>
              </div>
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

        {/* CONDITION — direct action (click submits immediately, no confirm) */}
        {block.type === "CONDITION" && (
          <div className="space-y-2">
            {c.question && <p className="text-sm font-medium text-slate-700">{c.question}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button disabled={acting}
                onClick={() => { setV2Answer("SIM"); setTimeout(() => onAdvance(), 50); }}
                className="rounded-xl py-4 text-base font-bold shadow-md transition-all active:scale-[0.97] disabled:opacity-50 bg-gradient-to-r from-green-500 to-green-600 text-white">
                ✅ Sim
              </button>
              <button disabled={acting}
                onClick={() => { setV2Answer("NAO"); setTimeout(() => onAdvance(), 50); }}
                className="rounded-xl py-4 text-base font-bold shadow-md transition-all active:scale-[0.97] disabled:opacity-50 bg-gradient-to-r from-red-500 to-red-600 text-white">
                ❌ Não
              </button>
            </div>
          </div>
        )}

        {/* ACTION_BUTTONS */}
        {block.type === "ACTION_BUTTONS" && (() => {
          const buttons: { id: string; label: string; color: string; icon?: string }[] = c.buttons || [];
          // Button size classes
          const BTN_SIZE_MAP: Record<string, { py: string; text: string }> = {
            sm: { py: "py-2", text: "text-sm" },
            md: { py: "py-4", text: "text-base" },
            lg: { py: "py-6", text: "text-lg" },
          };
          const bs = BTN_SIZE_MAP[c.buttonSize || "md"] || BTN_SIZE_MAP.md;
          // Embedded info panel rendering
          const ip = c.infoPanel;
          const renderInfoPanel = () => {
            if (!ip?.enabled) return null;
            return <InfoCard config={{ ...ip, fontSize: ip.fontSize || "sm", boxSize: ip.boxSize || "compact" }} order={order} />;
          };
          // Single button = direct action (click submits immediately, no separate confirm)
          if (buttons.length === 1) {
            const btn = buttons[0];
            const colors = BUTTON_COLORS[btn.color] || BUTTON_COLORS.green;
            return (
              <div className="space-y-2">
                {c.title && <p className="text-sm font-medium text-slate-700">{c.title}</p>}
                {ip?.enabled && ip.position === "before" && renderInfoPanel()}
                <button
                  disabled={acting}
                  onClick={() => { setV2Answer(btn.id); setTimeout(() => onAdvance(), 50); }}
                  className={`w-full rounded-xl ${bs.py} text-center ${bs.text} font-bold shadow-md transition-all active:scale-[0.97] disabled:opacity-50 ${colors.full}`}
                >
                  {btn.icon ? `${btn.icon} ` : ""}{btn.label}
                </button>
                {ip?.enabled && ip.position === "after" && renderInfoPanel()}
              </div>
            );
          }
          // Multiple buttons = direct action (click submits immediately)
          return (
            <div className="space-y-2">
              {c.title && <p className="text-sm font-medium text-slate-700">{c.title}</p>}
              {ip?.enabled && ip.position === "before" && renderInfoPanel()}
              <div className={`grid gap-3 ${buttons.length === 2 ? "grid-cols-2" : buttons.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {buttons.map((btn) => {
                  const colors = BUTTON_COLORS[btn.color] || BUTTON_COLORS.green;
                  return (
                    <button
                      key={btn.id}
                      disabled={acting}
                      onClick={() => { setV2Answer(btn.id); setTimeout(() => onAdvance(), 50); }}
                      className={`rounded-xl ${bs.py} ${bs.text} font-bold shadow-md transition-all active:scale-[0.97] disabled:opacity-50 ${colors.full}`}
                    >
                      {btn.icon ? `${btn.icon} ` : ""}{btn.label}
                    </button>
                  );
                })}
              </div>
              {ip?.enabled && ip.position === "after" && renderInfoPanel()}
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

        {/* INFO — Visual informational block (auto-advances after viewing) */}
        {block.type === "INFO" && (
          <InfoCard config={c} order={order} name={block.name} />
        )}

        {/* ARRIVAL_QUESTION — tempo estimado de chegada */}
        {block.type === "ARRIVAL_QUESTION" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{c.question || "Em quantos minutos voce chega no local?"}</p>
            <div className="grid grid-cols-3 gap-2">
              {(c.options || [10, 20, 30, 45, 60]).map((min: number) => (
                <button key={min} onClick={() => setV2Answer(String(min))}
                  className={`rounded-lg border py-3 text-sm font-bold transition-all ${
                    v2Answer === String(min) ? "border-blue-400 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                  {min} min
                </button>
              ))}
            </div>
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

      {/* Advance button — driven by block config, hidden for auto-advance types */}
      {!["ACTION_BUTTONS", "CONDITION", "GPS", "PROXIMITY_TRIGGER"].includes(block.type) && (() => {
        // STATUS with buttonLabel uses its own label; others use confirmButton from config
        const cb = c.confirmButton || {};
        const label = block.type === "STATUS" && c.buttonLabel ? c.buttonLabel : (cb.label || "Confirmar");
        const icon = block.type === "STATUS" && c.buttonLabel ? (block.icon || "▶️") : (cb.icon || block.icon || "▶️");
        const color = cb.color || "blue";
        const colors = BUTTON_COLORS[color] || BUTTON_COLORS.blue;
        return (
          <button onClick={onAdvance} disabled={isDisabled()}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all ${colors.full}`}>
            <span className="text-xl">{icon}</span>
            {acting ? "Avancando..." : label}
          </button>
        );
      })()}
    </div>
  );
}
