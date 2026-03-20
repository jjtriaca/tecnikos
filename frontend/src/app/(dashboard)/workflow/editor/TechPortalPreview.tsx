"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

/* ── Field definitions ── */

type FieldKey = "osCode" | "status" | "description" | "address" | "value" | "deadline" | "attachments" | "client" | "clientPhone" | "siteContact" | "companyPhone" | "creator" | "commission";

interface FieldDef {
  key: FieldKey;
  label: string;
  icon: string;
  defaultEnabled: boolean;
  editableLabel?: boolean;
}

const ALL_FIELDS: FieldDef[] = [
  { key: "osCode", label: "Codigo da OS", icon: "\u{1F522}", defaultEnabled: true },
  { key: "status", label: "Status", icon: "\u{1F3F7}\uFE0F", defaultEnabled: true },
  { key: "description", label: "Descricao", icon: "\u{1F4DD}", defaultEnabled: true },
  { key: "client", label: "Nome do cliente", icon: "\u{1F464}", defaultEnabled: false },
  { key: "clientPhone", label: "Telefone do cliente", icon: "\u{1F4DE}", defaultEnabled: false },
  { key: "siteContact", label: "Contato no local", icon: "\u{1F3E0}", defaultEnabled: true },
  { key: "address", label: "Endereco", icon: "\u{1F4CD}", defaultEnabled: true },
  { key: "value", label: "Valor", icon: "\u{1F4B0}", defaultEnabled: true },
  { key: "deadline", label: "Prazo", icon: "\u{1F550}", defaultEnabled: true },
  { key: "commission", label: "Comissao do tecnico", icon: "\u{1F4B5}", defaultEnabled: false, editableLabel: true },
  { key: "companyPhone", label: "Telefone do escritorio", icon: "\u{1F3E2}", defaultEnabled: true, editableLabel: true },
  { key: "creator", label: "Criado por", icon: "\u270D\uFE0F", defaultEnabled: false },
  { key: "attachments", label: "Anexos / Fotos", icon: "\u{1F4F7}", defaultEnabled: true },
];

const DEFAULT_ORDER: FieldKey[] = ALL_FIELDS.map(f => f.key);

/* ── Config type ── */

export interface TechPortalConfig {
  showAddress: boolean;
  showValue: boolean;
  showDeadline: boolean;
  showDescription: boolean;
  showClient: boolean;
  showClientPhone: boolean;
  showOsCode: boolean;
  showCommission: boolean;
  showAttachments: boolean;
  showStatus: boolean;
  showSiteContact: boolean;
  showCompanyPhone: boolean;
  showCreator: boolean;
  fieldOrder: FieldKey[];
  companyPhoneLabel: string;
  commissionLabel: string;
  customMessage: string;
}

export const DEFAULT_TECH_PORTAL_CONFIG: TechPortalConfig = {
  showAddress: true,
  showValue: true,
  showDeadline: true,
  showDescription: true,
  showClient: false,
  showClientPhone: false,
  showOsCode: true,
  showCommission: false,
  showAttachments: true,
  showStatus: true,
  showSiteContact: true,
  showCompanyPhone: true,
  showCreator: false,
  fieldOrder: DEFAULT_ORDER,
  companyPhoneLabel: "Escritorio",
  commissionLabel: "Comissao",
  customMessage: "",
};

/* ── Toggle key mapping ── */

const TOGGLE_KEY_MAP: Record<FieldKey, keyof TechPortalConfig> = {
  osCode: "showOsCode",
  status: "showStatus",
  description: "showDescription",
  address: "showAddress",
  value: "showValue",
  deadline: "showDeadline",
  attachments: "showAttachments",
  client: "showClient",
  clientPhone: "showClientPhone",
  siteContact: "showSiteContact",
  companyPhone: "showCompanyPhone",
  creator: "showCreator",
  commission: "showCommission",
};

/* ── Position persistence ── */

const PREF_KEY = "emulatorPos";
const EXPANDED_KEY = "emulatorExpanded";

function clampPosition(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(0, Math.min(x, window.innerWidth - 80)),
    y: Math.max(0, Math.min(y, window.innerHeight - 60)),
  };
}

let posTimer: ReturnType<typeof setTimeout> | null = null;
function savePosition(x: number, y: number) {
  if (posTimer) clearTimeout(posTimer);
  posTimer = setTimeout(() => {
    api.patch("/users/me/preferences", { [PREF_KEY]: { x, y } }).catch(() => {});
    posTimer = null;
  }, 600);
}

function saveExpanded(expanded: boolean) {
  api.patch("/users/me/preferences", { [EXPANDED_KEY]: expanded }).catch(() => {});
}

function loadSavedState(): { pos: { x: number; y: number } | null; expanded: boolean } {
  try {
    const raw = localStorage.getItem("userPreferences");
    if (!raw) return { pos: null, expanded: true };
    const prefs = JSON.parse(raw);
    const pos = prefs[PREF_KEY] ? clampPosition(prefs[PREF_KEY].x, prefs[PREF_KEY].y) : null;
    const expanded = prefs[EXPANDED_KEY] !== false; // default expanded
    return { pos, expanded };
  } catch {
    return { pos: null, expanded: true };
  }
}

/* ── Props ── */

interface Props {
  config: TechPortalConfig;
  onChange: (config: TechPortalConfig) => void;
  onClose: () => void;
  workflowId: string | null;
  workflowName: string;
  triggerLabel: string;
  /** Called to save workflow before iframe reload */
  onSave: () => Promise<void>;
}

/* ── Arrow buttons ── */
function MoveBtn({ direction, onClick }: { direction: "up" | "down"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-3.5 w-3.5 flex items-center justify-center rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
      title={direction === "up" ? "Mover para cima" : "Mover para baixo"}
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        {direction === "up"
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />}
      </svg>
    </button>
  );
}

/* ── Component ── */

interface EmulatorOs {
  serviceOrderId: string;
  token: string | null;
  code: string;
  title: string;
  status: string;
  techName: string | null;
  channel: string | null;
}

// Dimensions
const PHONE_W = 280;
const PHONE_H = 560;
const CONTROLS_W = 230;
const CARD_GAP = 16;
const CARD_PAD = 16;
const EXPANDED_W = CONTROLS_W + PHONE_W + CARD_GAP + CARD_PAD * 2;
const COLLAPSED_W = PHONE_W + CARD_PAD * 2;
const HEADER_H = 32;

export default function TechPortalPreview({ config, onChange, onClose, workflowId, workflowName, triggerLabel, onSave }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeKey = useRef(0);
  const [emulatorOsList, setEmulatorOsList] = useState<EmulatorOs[]>([]);
  const [showOsList, setShowOsList] = useState(false);
  const [loadingOsList, setLoadingOsList] = useState(false);
  const [usingRealOs, setUsingRealOs] = useState(false);
  const [previewOsId, setPreviewOsId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Floating / drag state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 100, y: 60 });
  const [expanded, setExpanded] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  // Load saved position + expanded state on mount
  useEffect(() => {
    const { pos, expanded: exp } = loadSavedState();
    if (pos) setPosition(pos);
    else {
      // Default: right side of the screen
      const x = Math.max(20, window.innerWidth - EXPANDED_W - 40);
      const y = 60;
      setPosition({ x, y });
    }
    setExpanded(exp);
  }, []);

  // Clamp on window resize
  useEffect(() => {
    const onResize = () => setPosition(p => clampPosition(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const update = (key: keyof TechPortalConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  // Ensure fieldOrder has all keys (migration safety)
  const fieldOrder: FieldKey[] = config.fieldOrder?.length === ALL_FIELDS.length
    ? config.fieldOrder
    : DEFAULT_ORDER;

  const orderedFields = fieldOrder.map(key => ALL_FIELDS.find(f => f.key === key)!).filter(Boolean);

  const moveField = (key: FieldKey, direction: "up" | "down") => {
    const arr = [...fieldOrder];
    const idx = arr.indexOf(key);
    if (direction === "up" && idx > 0) {
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    } else if (direction === "down" && idx < arr.length - 1) {
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
    }
    update("fieldOrder", arr);
  };

  const isEnabled = (key: FieldKey) => config[TOGGLE_KEY_MAP[key]] as boolean;
  const toggleField = (key: FieldKey) => update(TOGGLE_KEY_MAP[key], !isEnabled(key));

  // Load OS list for this workflow
  const loadEmulatorOs = useCallback(async () => {
    if (!workflowId) return;
    setLoadingOsList(true);
    try {
      const res = await api.get<EmulatorOs[]>(`/workflows/${workflowId}/emulator-os`);
      setEmulatorOsList(res);
      setShowOsList(true);
    } catch {
      setError("Erro ao buscar OS do workflow");
    } finally {
      setLoadingOsList(false);
    }
  }, [workflowId]);

  const selectEmulatorOs = (os: EmulatorOs) => {
    setPreviewOsId(os.serviceOrderId);
    setUsingRealOs(true);
    setShowOsList(false);
    if (os.token) {
      setPreviewToken(os.token);
    } else {
      // No valid token — need to reset first to create one
      resetOsAndLoad(os.serviceOrderId);
    }
  };

  // Reset any OS (preview or real) back to OFERTADA and reload
  const resetOsAndLoad = useCallback(async (osId?: string) => {
    const targetOsId = osId || previewOsId;
    if (!workflowId || !targetOsId) return;
    setResetting(true);
    try {
      await onSave();
      const res = await api.post<{ token: string; serviceOrderId: string }>(`/workflows/${workflowId}/reset-preview`, { serviceOrderId: targetOsId });
      setPreviewToken(res.token);
      setPreviewOsId(res.serviceOrderId);
      iframeKey.current += 1;
    } catch (err: any) {
      setError(err?.message || "Erro ao resetar OS");
    } finally {
      setResetting(false);
    }
  }, [workflowId, previewOsId, onSave]);

  // Create preview OS
  const createPreviewOs = useCallback(async () => {
    if (!workflowId) {
      setError("Salve o fluxo primeiro para criar uma OS de preview");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; serviceOrderId: string }>(`/workflows/${workflowId}/preview-os`, { triggerLabel });
      setPreviewToken(res.token);
      setPreviewOsId(res.serviceOrderId);
    } catch (err: any) {
      setError(err?.message || "Erro ao criar OS de preview");
    } finally {
      setLoading(false);
    }
  }, [workflowId, triggerLabel]);

  // Auto-save + reload iframe on config change (debounced)
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!previewToken) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave();
        iframeKey.current += 1;
        setPreviewToken(t => t);
        iframeRef.current?.contentWindow?.location.reload();
      } catch {
        // silent
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, previewToken]);

  /* ── Drag handlers ── */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
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
      const c = clampPosition(dragRef.current.originX + dx, dragRef.current.originY + dy);
      setPosition(c);
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current?.moved) savePosition(position.x, position.y);
    dragRef.current = null;
  }, [position]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    saveExpanded(next);
  };

  const toggleMinimized = () => setMinimized(m => !m);

  const iframeSrc = previewToken ? `/tech/os/${previewToken}` : "";
  const cardW = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: cardW,
        zIndex: 1200,
        transition: "width 0.25s ease",
      }}
      className="flex flex-col rounded-xl shadow-2xl select-none"
    >
      {/* ── Draggable header ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex items-center justify-between rounded-t-xl bg-indigo-600/90 px-3 text-white cursor-grab active:cursor-grabbing touch-none backdrop-blur-sm"
        style={{ height: HEADER_H }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Grip dots */}
          <svg className="h-3.5 w-3.5 shrink-0 opacity-40" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="4" cy="13" r="1.5" />
            <circle cx="10" cy="3" r="1.5" /><circle cx="10" cy="8" r="1.5" /><circle cx="10" cy="13" r="1.5" />
          </svg>
          <span className="text-[11px] font-bold truncate">Emulador</span>
          {saving && (
            <span className="flex items-center gap-1 ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300 animate-pulse" />
              <span className="text-[9px] opacity-70">Salvando...</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {/* Expand/Collapse controls toggle */}
          <button
            onClick={toggleExpanded}
            className="shrink-0 rounded p-0.5 hover:bg-white/20"
            title={expanded ? "Recolher painel" : "Expandir painel"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {expanded
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />}
            </svg>
          </button>
          {/* Minimize (hide body) */}
          <button
            onClick={toggleMinimized}
            className="shrink-0 rounded p-0.5 hover:bg-white/20"
            title={minimized ? "Expandir" : "Minimizar"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {minimized
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
            </svg>
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="shrink-0 rounded p-0.5 hover:bg-white/20"
            title="Fechar"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body (hidden when minimized) ── */}
      {!minimized && (
        <div
          className="rounded-b-xl bg-white/[0.96] backdrop-blur-sm border border-t-0 border-slate-200/60 overflow-hidden"
          style={{ transition: "height 0.25s ease" }}
        >
          <div className="flex" style={{ gap: CARD_GAP, padding: CARD_PAD }}>
            {/* Left: Controls (visible when expanded) */}
            {expanded && (
              <div className="shrink-0 flex flex-col overflow-y-auto" style={{ width: CONTROLS_W, maxHeight: PHONE_H }}>
                <p className="text-[9px] text-slate-400 mb-2">Configure os campos visiveis. Mudancas sao salvas e refletidas no celular.</p>

                {/* Reorderable field list */}
                <div className="space-y-px border rounded-lg border-slate-200 p-1.5">
                  {orderedFields.map((field) => {
                    const enabled = isEnabled(field.key);
                    const labelKey = field.key === "companyPhone" ? "companyPhoneLabel" : field.key === "commission" ? "commissionLabel" : null;
                    const currentLabel = labelKey ? (config[labelKey] as string) || "" : "";
                    return (
                      <div
                        key={field.key}
                        className={`flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${enabled ? "bg-white" : "bg-slate-50 opacity-60"}`}
                      >
                        <div className="flex flex-col">
                          <MoveBtn direction="up" onClick={() => moveField(field.key, "up")} />
                          <MoveBtn direction="down" onClick={() => moveField(field.key, "down")} />
                        </div>
                        <span className="text-[9px] w-3.5 text-center">{field.icon}</span>
                        {field.editableLabel && enabled && labelKey ? (
                          <input
                            value={currentLabel}
                            onChange={(e) => update(labelKey, e.target.value)}
                            placeholder={field.label}
                            className="flex-1 min-w-0 rounded border border-dashed border-slate-300 bg-transparent px-1 py-px text-[10px] text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-blue-50/50"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-700 flex-1 truncate">{field.label}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleField(field.key)}
                          className={`relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors ${enabled ? "bg-blue-500" : "bg-slate-200"}`}
                        >
                          <span className={`pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform mt-px ${enabled ? "translate-x-2.5" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Custom message */}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <label className="block text-[9px] text-slate-500 mb-0.5">Mensagem personalizada</label>
                  <textarea
                    value={config.customMessage}
                    onChange={(e) => update("customMessage", e.target.value)}
                    placeholder="Ex: Lembre-se de usar EPI..."
                    rows={2}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-[10px] text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Right: Phone Emulator */}
            <div className="flex flex-col items-center">
              {/* Phone frame */}
              <div
                className="rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 overflow-hidden shadow-2xl flex flex-col relative"
                style={{ width: PHONE_W, height: PHONE_H }}
              >
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-2xl z-10" />

                {previewToken ? (
                  <iframe
                    ref={iframeRef}
                    key={iframeKey.current}
                    src={iframeSrc}
                    className="w-full h-full border-0 bg-slate-50 rounded-[2rem]"
                    title="Preview do portal do tecnico"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-50 rounded-[2rem] flex flex-col items-center justify-center px-6 gap-4">
                    {loading ? (
                      <>
                        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                        <p className="text-xs text-slate-400">Criando OS de preview...</p>
                      </>
                    ) : error ? (
                      <>
                        <div className="text-3xl">&#x26A0;&#xFE0F;</div>
                        <p className="text-xs text-red-500 text-center">{error}</p>
                        <button
                          onClick={createPreviewOs}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Tentar novamente
                        </button>
                      </>
                    ) : (
                      <>
                        {showOsList ? (
                          /* OS selection list */
                          <div className="w-full h-full flex flex-col px-3 pt-8 pb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-700">Selecionar OS</p>
                              <button onClick={() => setShowOsList(false)} className="text-[10px] text-slate-400 hover:text-slate-600">&larr; Voltar</button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1.5">
                              {emulatorOsList.length === 0 ? (
                                <p className="text-[10px] text-slate-400 text-center mt-8">Nenhuma OS encontrada para este workflow</p>
                              ) : (
                                emulatorOsList.map((os) => {
                                  const isTerminal = ["RECUSADA", "CANCELADA", "CONCLUIDA", "APROVADA"].includes(os.status);
                                  return (
                                    <button
                                      key={os.serviceOrderId}
                                      onClick={() => selectEmulatorOs(os)}
                                      className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono font-bold text-blue-600">{os.code}</span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${isTerminal ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"}`}>{os.status}</span>
                                      </div>
                                      <p className="text-[10px] text-slate-600 truncate mt-0.5">{os.title}</p>
                                      {os.techName && <p className="text-[9px] text-slate-400 mt-0.5">{os.techName}</p>}
                                      {isTerminal && <p className="text-[9px] text-amber-500 mt-0.5">Sera reiniciada ao selecionar</p>}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Default empty state */
                          <>
                            <div className="text-4xl">&#x1F4F1;</div>
                            <p className="text-sm font-semibold text-slate-700 text-center">Emulador do Portal</p>
                            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                              Crie uma OS de teste ou use uma OS real para visualizar o portal do tecnico.
                            </p>
                            <button
                              onClick={createPreviewOs}
                              disabled={!workflowId}
                              className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                            >
                              Criar {triggerLabel}
                            </button>
                            <button
                              onClick={loadEmulatorOs}
                              disabled={loadingOsList}
                              className="rounded-xl border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-50"
                            >
                              {loadingOsList ? "Carregando..." : "Usar OS existente"}
                            </button>
                            {!workflowId && (
                              <p className="text-[9px] text-amber-500">Salve o fluxo primeiro</p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Status below phone */}
              {previewToken && (
                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${usingRealOs ? "bg-amber-500" : "bg-green-500"}`} />
                    <span className="text-[9px] text-slate-400">{usingRealOs ? "OS real" : "Preview"}</span>
                    <button
                      onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                      className="text-[9px] text-blue-500 hover:text-blue-700 underline ml-1"
                    >
                      Recarregar
                    </button>
                    <button
                      onClick={() => { setPreviewToken(null); setUsingRealOs(false); setPreviewOsId(null); setShowOsList(false); }}
                      className="text-[9px] text-slate-400 hover:text-slate-600 underline ml-1"
                    >
                      Trocar
                    </button>
                  </div>
                  {/* Reset button */}
                  {previewOsId && (
                    <button
                      onClick={() => resetOsAndLoad()}
                      disabled={resetting}
                      className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      {resetting ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                          Reiniciando...
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reiniciar fluxo
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
