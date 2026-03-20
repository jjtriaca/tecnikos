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

export default function TechPortalPreview({ config, onChange, onClose, workflowId, workflowName, triggerLabel, onSave }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeKey = useRef(0);

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
    if (!previewToken) return; // no iframe to reload yet

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave();
        // Reload iframe by changing key
        iframeKey.current += 1;
        setPreviewToken(t => t); // force re-render
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

  const iframeSrc = previewToken ? `/tech/os/${previewToken}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex gap-5 bg-white rounded-2xl shadow-2xl p-5 max-w-[850px] w-full mx-4 max-h-[90vh]">
        {/* Left: Controls */}
        <div className="w-60 shrink-0 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800">Portal do Tecnico</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
          </div>
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

          {/* Saving indicator */}
          {saving && (
            <div className="mt-1 flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[9px] text-blue-500">Salvando...</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-3 w-full rounded-lg bg-blue-600 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition-colors shrink-0"
          >
            Concluir
          </button>
        </div>

        {/* Right: Phone Emulator */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Phone frame */}
          <div className="w-[280px] h-[560px] rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 overflow-hidden shadow-2xl flex flex-col relative">
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
                    <div className="text-4xl">&#x1F4F1;</div>
                    <p className="text-sm font-semibold text-slate-700 text-center">Emulador do Portal</p>
                    <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      Crie uma OS de teste para visualizar exatamente o que o tecnico vera no celular.
                    </p>
                    <button
                      onClick={createPreviewOs}
                      disabled={!workflowId}
                      className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                      Criar {triggerLabel}
                    </button>
                    {!workflowId && (
                      <p className="text-[9px] text-amber-500">Salve o fluxo primeiro</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Status below phone */}
          {previewToken && (
            <div className="flex items-center gap-2 mt-3">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-[9px] text-slate-400">OS de preview ativa</span>
              <button
                onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                className="text-[9px] text-blue-500 hover:text-blue-700 underline ml-2"
              >
                Recarregar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
