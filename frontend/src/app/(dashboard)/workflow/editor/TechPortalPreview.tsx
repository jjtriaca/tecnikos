"use client";

import { useState } from "react";
import { type Block, getCatalogEntry, findStartBlock, findBlock } from "@/types/workflow-blocks";

/* ── Field definitions ── */

type FieldKey = "osCode" | "status" | "description" | "address" | "value" | "deadline" | "attachments" | "client" | "clientPhone" | "siteContact" | "companyPhone" | "creator" | "commission";

interface FieldDef {
  key: FieldKey;
  label: string;
  icon: string;
  previewLabel: string;
  previewValue: string;
  defaultEnabled: boolean;
  editableLabel?: boolean; // label can be customized
}

const ALL_FIELDS: FieldDef[] = [
  { key: "osCode", label: "Codigo da OS", icon: "🔢", previewLabel: "", previewValue: "OS-00028", defaultEnabled: true },
  { key: "status", label: "Status", icon: "🏷️", previewLabel: "", previewValue: "Ofertada", defaultEnabled: true },
  { key: "description", label: "Descricao", icon: "📝", previewLabel: "", previewValue: "Troca de filtro e bomba da piscina", defaultEnabled: true },
  { key: "client", label: "Nome do cliente", icon: "👤", previewLabel: "Cliente", previewValue: "Joao da Silva", defaultEnabled: false },
  { key: "clientPhone", label: "Telefone do cliente", icon: "📞", previewLabel: "Telefone", previewValue: "(66) 99999-0000", defaultEnabled: false },
  { key: "siteContact", label: "Contato no local", icon: "🏠", previewLabel: "Contato", previewValue: "Maria - (66) 98888-0000", defaultEnabled: true },
  { key: "address", label: "Endereco", icon: "📍", previewLabel: "Endereco", previewValue: "Rua Exemplo, 123 - Centro", defaultEnabled: true },
  { key: "value", label: "Valor", icon: "💰", previewLabel: "Valor", previewValue: "R$ 360,00", defaultEnabled: true },
  { key: "deadline", label: "Prazo", icon: "🕐", previewLabel: "Prazo", previewValue: "19/03/2026", defaultEnabled: true },
  { key: "commission", label: "Comissao do tecnico", icon: "💵", previewLabel: "Comissao", previewValue: "R$ 54,00", defaultEnabled: false, editableLabel: true },
  { key: "companyPhone", label: "Telefone do escritorio", icon: "🏢", previewLabel: "Escritorio", previewValue: "(66) 3521-0000", defaultEnabled: true, editableLabel: true },
  { key: "creator", label: "Criado por", icon: "✍️", previewLabel: "Criado por", previewValue: "Juliano Triaca", defaultEnabled: false },
  { key: "attachments", label: "Anexos / Fotos", icon: "📷", previewLabel: "", previewValue: "", defaultEnabled: true },
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
  blocks: Block[];
  workflowName: string;
}

/** Walk the main chain to get interactive blocks the tech would see */
function getInteractiveBlocks(blocks: Block[]): Block[] {
  const INTERACTIVE = new Set(["STEP", "PHOTO", "NOTE", "GPS", "QUESTION", "CHECKLIST", "SIGNATURE", "FORM", "ACTION_BUTTONS", "ARRIVAL_QUESTION"]);
  const result: Block[] = [];
  const start = findStartBlock(blocks);
  if (!start) return result;
  let currentId: string | null = start.next;
  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const b = findBlock(blocks, currentId);
    if (!b || b.type === "END") break;
    if (INTERACTIVE.has(b.type)) result.push(b);
    currentId = b.next;
  }
  return result;
}

/** Render a single interactive block as the tech would see it */
function BlockPreview({ block }: { block: Block }) {
  const c = block.config || {};
  const entry = getCatalogEntry(block.type);
  const icon = entry?.icon || "⚙️";

  switch (block.type) {
    case "ACTION_BUTTONS": {
      const buttons = c.buttons || [{ id: "1", label: "Confirmar", color: "green", icon: "✅" }];
      const colorMap: Record<string, string> = {
        green: "from-green-500 to-emerald-600",
        blue: "from-blue-500 to-indigo-600",
        red: "from-red-500 to-rose-600",
        orange: "from-orange-500 to-amber-600",
        yellow: "from-yellow-500 to-amber-500",
        purple: "from-purple-500 to-violet-600",
        slate: "from-slate-500 to-slate-600",
      };
      return (
        <div className="space-y-1">
          {c.title && <p className="text-[8px] font-medium text-slate-600 text-center">{c.title}</p>}
          {buttons.map((btn: any) => (
            <div key={btn.id} className={`rounded-lg bg-gradient-to-r ${colorMap[btn.color] || colorMap.blue} py-1.5 text-center shadow-sm`}>
              <span className="text-[9px] font-bold text-white">{btn.icon} {btn.label}</span>
            </div>
          ))}
        </div>
      );
    }
    case "STEP":
      return (
        <div className="space-y-1">
          <p className="text-[8px] text-slate-600">{c.description || block.name}</p>
          {c.requirePhoto && <div className="rounded border border-dashed border-slate-300 py-1.5 text-center"><span className="text-[7px] text-slate-400">📸 Tirar foto</span></div>}
          {c.requireNote && <div className="rounded border border-slate-200 px-1.5 py-1"><span className="text-[7px] text-slate-400">Observacao...</span></div>}
          <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 py-1.5 text-center shadow-sm">
            <span className="text-[9px] font-bold text-white">✅ Confirmar</span>
          </div>
        </div>
      );
    case "PHOTO":
      return (
        <div className="space-y-1">
          <p className="text-[8px] text-slate-600">{c.label || "Registrar foto"}</p>
          <div className="rounded-lg border-2 border-dashed border-slate-300 py-4 text-center">
            <span className="text-lg">📸</span>
            <p className="text-[7px] text-slate-400 mt-0.5">Tirar foto{c.minPhotos > 1 ? ` (min ${c.minPhotos})` : ""}</p>
          </div>
        </div>
      );
    case "NOTE":
      return (
        <div className="space-y-1">
          <div className="rounded border border-slate-200 px-2 py-2">
            <span className="text-[7px] text-slate-400">{c.placeholder || "Escreva uma observacao..."}</span>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 py-1.5 text-center shadow-sm">
            <span className="text-[9px] font-bold text-white">📝 Enviar</span>
          </div>
        </div>
      );
    case "GPS":
      return (
        <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 py-2 text-center shadow-sm">
          <span className="text-[9px] font-bold text-white">📍 Registrar Localizacao</span>
        </div>
      );
    case "QUESTION": {
      const options = c.options || ["Sim", "Nao"];
      return (
        <div className="space-y-1">
          <p className="text-[8px] font-medium text-slate-700">{c.question || "Pergunta?"}</p>
          {options.map((opt: string, i: number) => (
            <div key={i} className="rounded-lg border border-slate-200 py-1.5 text-center hover:bg-slate-50">
              <span className="text-[8px] font-medium text-slate-600">{opt}</span>
            </div>
          ))}
        </div>
      );
    }
    case "CHECKLIST": {
      const items = c.items || ["Item 1", "Item 2"];
      return (
        <div className="space-y-1">
          {items.map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1">
              <div className="h-2.5 w-2.5 rounded border border-slate-300 shrink-0" />
              <span className="text-[8px] text-slate-600">{item}</span>
            </div>
          ))}
          <div className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 py-1.5 text-center shadow-sm">
            <span className="text-[9px] font-bold text-white">☑️ Confirmar</span>
          </div>
        </div>
      );
    }
    case "SIGNATURE":
      return (
        <div className="space-y-1">
          <p className="text-[8px] text-slate-600">{c.label || "Assinatura digital"}</p>
          <div className="rounded-lg border-2 border-dashed border-slate-300 py-4 text-center">
            <span className="text-lg">✍️</span>
            <p className="text-[7px] text-slate-400 mt-0.5">Toque para assinar</p>
          </div>
        </div>
      );
    case "FORM": {
      const fields = c.fields || [{ name: "Campo", type: "text" }];
      return (
        <div className="space-y-1">
          {fields.map((f: any, i: number) => (
            <div key={i}>
              <span className="text-[7px] text-slate-500">{f.name}</span>
              <div className="rounded border border-slate-200 px-1.5 py-1 mt-px">
                <span className="text-[7px] text-slate-400">{f.type === "select" ? (f.options?.[0] || "Selecione...") : "Digite..."}</span>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 py-1.5 text-center shadow-sm">
            <span className="text-[9px] font-bold text-white">📋 Enviar</span>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold text-white">{icon} {block.name}</span>
        </div>
      );
  }
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

export default function TechPortalPreview({ config, onChange, onClose, blocks, workflowName }: Props) {
  const [stepIdx, setStepIdx] = useState(0);

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

  const interactiveBlocks = getInteractiveBlocks(blocks);
  const currentStep = interactiveBlocks[stepIdx] || null;
  const totalSteps = interactiveBlocks.length;

  // Get enabled fields in order for preview
  const enabledFields = orderedFields.filter(f => isEnabled(f.key));

  const companyLabel = config.companyPhoneLabel || "Escritorio";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex gap-5 bg-white rounded-2xl shadow-2xl p-5 max-w-[850px] w-full mx-4 max-h-[90vh]">
        {/* Left: Controls */}
        <div className="w-60 shrink-0 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800">Portal do Tecnico</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
          </div>
          <p className="text-[9px] text-slate-400 mb-2">Arraste os campos para reordenar. A ordem aqui reflete na tela do tecnico.</p>

          {/* Reorderable field list */}
          <div className="space-y-px border rounded-lg border-slate-200 p-1.5">
            {orderedFields.map((field, idx) => {
              const enabled = isEnabled(field.key);
              const labelKey = field.key === "companyPhone" ? "companyPhoneLabel" : field.key === "commission" ? "commissionLabel" : null;
              const currentLabel = labelKey ? (config[labelKey] as string) || "" : "";
              return (
                <div
                  key={field.key}
                  className={`flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${enabled ? "bg-white" : "bg-slate-50 opacity-60"}`}
                >
                  {/* Arrows */}
                  <div className="flex flex-col">
                    <MoveBtn direction="up" onClick={() => moveField(field.key, "up")} />
                    <MoveBtn direction="down" onClick={() => moveField(field.key, "down")} />
                  </div>
                  {/* Icon */}
                  <span className="text-[9px] w-3.5 text-center">{field.icon}</span>
                  {/* Label — editable input or static text */}
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
                  {/* Toggle */}
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

          <button
            onClick={onClose}
            className="mt-3 w-full rounded-lg bg-blue-600 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition-colors shrink-0"
          >
            Concluir
          </button>
        </div>

        {/* Right: Phone Preview with external navigation arrows */}
        <div className="flex-1 flex flex-col items-center pt-2">
          <div className="flex items-center gap-3">
            {/* Left arrow — outside phone */}
            <button
              type="button"
              onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0 || totalSteps === 0}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-20 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 transition-colors shadow-sm shrink-0"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>

            {/* Phone */}
            <div className="w-[260px] h-[520px] rounded-[2rem] border-[5px] border-slate-800 bg-slate-50 overflow-hidden shadow-xl flex flex-col">
              {/* Status bar */}
              <div className="bg-slate-800 px-4 py-0.5 flex items-center justify-between">
                <span className="text-[7px] text-white/60">20:30</span>
                <div className="w-16 h-3 rounded-full bg-slate-700" />
                <div className="flex gap-0.5">
                  <svg className="h-2 w-2 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 18c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6z"/></svg>
                  <svg className="h-2 w-2 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                </div>
              </div>

              {/* App header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 flex items-center gap-2">
                <svg className="h-3 w-3 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                <span className="text-[9px] font-semibold text-white">Tecnikos</span>
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400" />
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-2">
                {/* Title */}
                <h2 className="text-[11px] font-bold text-slate-800 leading-tight">Troca de Filtro</h2>

                {/* Custom message */}
                {config.customMessage && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 px-2 py-1.5">
                    <p className="text-[8px] text-blue-700 leading-relaxed">{config.customMessage}</p>
                  </div>
                )}

                {/* Fields in order */}
                {enabledFields.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm space-y-1">
                    {enabledFields.map(field => {
                      if (field.key === "osCode") {
                        return <div key={field.key} className="flex items-center gap-1.5"><span className="text-[7px]">🔢</span><span className="text-[8px] font-mono text-slate-600">OS-00028</span></div>;
                      }
                      if (field.key === "status") {
                        return <div key={field.key}><span className="inline-block rounded-full bg-orange-100 text-orange-700 px-1.5 py-px text-[7px] font-semibold">Ofertada</span></div>;
                      }
                      if (field.key === "description") {
                        return <p key={field.key} className="text-[8px] text-slate-500 leading-relaxed">{field.previewValue}</p>;
                      }
                      if (field.key === "commission") {
                        const commLabel = config.commissionLabel || "Comissao";
                        return (
                          <div key={field.key} className="flex items-center gap-1.5 pt-0.5 border-t border-slate-100">
                            <span className="text-[7px]">💵</span>
                            <span className="text-[7px] text-slate-400">{commLabel}:</span>
                            <span className="text-[8px] font-semibold text-green-600">R$ 54,00</span>
                          </div>
                        );
                      }
                      if (field.key === "attachments") {
                        return (
                          <div key={field.key} className="flex gap-1 pt-0.5">
                            {[1, 2].map(i => (
                              <div key={i} className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center">
                                <span className="text-[7px] text-slate-400">📷</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      const lbl = field.key === "companyPhone" ? companyLabel : field.previewLabel;
                      return (
                        <div key={field.key} className="flex items-center gap-1.5">
                          <span className="text-[7px]">{field.icon}</span>
                          <span className="text-[7px] text-slate-400">{lbl}:</span>
                          <span className="text-[8px] font-medium text-slate-700">{field.previewValue}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Interactive block preview */}
                {currentStep && <BlockPreview block={currentStep} />}
              </div>

              {/* Bottom nav */}
              <div className="bg-white border-t border-slate-200 px-4 py-1.5 flex justify-around">
                <div className="flex flex-col items-center gap-0.5">
                  <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15" />
                  </svg>
                  <span className="text-[6px] text-blue-600 font-medium">Minhas OS</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                  </svg>
                  <span className="text-[6px] text-slate-400">Perfil</span>
                </div>
              </div>
            </div>

            {/* Right arrow — outside phone */}
            <button
              type="button"
              onClick={() => setStepIdx(Math.min(totalSteps - 1, stepIdx + 1))}
              disabled={stepIdx >= totalSteps - 1 || totalSteps === 0}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-20 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 transition-colors shadow-sm shrink-0"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>

          {/* Step indicator below phone */}
          {totalSteps > 0 && (
            <div className="flex flex-col items-center gap-1 mt-2">
              <div className="flex gap-1">
                {interactiveBlocks.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStepIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === stepIdx ? "w-5 bg-blue-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                  />
                ))}
              </div>
              <span className="text-[9px] text-slate-400">
                {currentStep ? (currentStep.name || getCatalogEntry(currentStep.type)?.name) : ""} ({stepIdx + 1}/{totalSteps})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
