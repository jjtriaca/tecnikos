"use client";

import { type Block, getCatalogEntry, findStartBlock, findBlock } from "@/types/workflow-blocks";

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
  customMessage: "",
};

interface Props {
  config: TechPortalConfig;
  onChange: (config: TechPortalConfig) => void;
  onClose: () => void;
  blocks: Block[];
  workflowName: string;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-0.5 cursor-pointer group">
      <span className="text-[11px] text-slate-600 group-hover:text-slate-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border border-transparent transition-colors ${checked ? "bg-blue-500" : "bg-slate-200"}`}
      >
        <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform mt-px ${checked ? "translate-x-3" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

/** Walk the main chain to get blocks the tech would see */
function getVisibleBlocks(blocks: Block[]): { name: string; type: string; icon: string; isInteractive: boolean }[] {
  const INTERACTIVE = new Set(["STEP", "PHOTO", "NOTE", "GPS", "QUESTION", "CHECKLIST", "SIGNATURE", "FORM", "CONDITION", "ACTION_BUTTONS", "ARRIVAL_QUESTION"]);
  const HIDDEN = new Set(["START", "END"]);
  const result: { name: string; type: string; icon: string; isInteractive: boolean }[] = [];
  const start = findStartBlock(blocks);
  if (!start) return result;

  let currentId: string | null = start.next;
  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const b = findBlock(blocks, currentId);
    if (!b || b.type === "END") break;
    if (!HIDDEN.has(b.type)) {
      const entry = getCatalogEntry(b.type);
      result.push({
        name: b.name || entry?.name || b.type,
        type: b.type,
        icon: entry?.icon || "⚙️",
        isInteractive: INTERACTIVE.has(b.type),
      });
    }
    currentId = b.next;
  }
  return result;
}

function InfoItem({ icon, label, value, visible }: { icon: string; label: string; value: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[7px]">{icon}</span>
      <span className="text-[7px] text-slate-400">{label}:</span>
      <span className="text-[8px] font-medium text-slate-700">{value}</span>
    </div>
  );
}

export default function TechPortalPreview({ config, onChange, onClose, blocks, workflowName }: Props) {
  const update = (key: keyof TechPortalConfig, value: boolean | string) => {
    onChange({ ...config, [key]: value });
  };

  const visibleBlocks = getVisibleBlocks(blocks);
  const interactiveCount = visibleBlocks.filter(b => b.isInteractive).length;
  const hasAnyInfo = config.showAddress || config.showValue || config.showDeadline || config.showDescription || config.showClient || config.showClientPhone || config.showOsCode || config.showCommission || config.showSiteContact || config.showCompanyPhone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex gap-5 bg-white rounded-2xl shadow-2xl p-5 max-w-[720px] w-full mx-4">
        {/* Left: Controls */}
        <div className="w-56 shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800">Portal do Tecnico</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
          </div>
          <p className="text-[9px] text-slate-400 mb-3">Informacoes visiveis ao tecnico pelo link.</p>

          <div className="space-y-px">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dados da OS</p>
            <Toggle label="Codigo da OS" checked={config.showOsCode} onChange={(v) => update("showOsCode", v)} />
            <Toggle label="Status" checked={config.showStatus} onChange={(v) => update("showStatus", v)} />
            <Toggle label="Descricao" checked={config.showDescription} onChange={(v) => update("showDescription", v)} />
            <Toggle label="Endereco" checked={config.showAddress} onChange={(v) => update("showAddress", v)} />
            <Toggle label="Valor" checked={config.showValue} onChange={(v) => update("showValue", v)} />
            <Toggle label="Prazo" checked={config.showDeadline} onChange={(v) => update("showDeadline", v)} />
            <Toggle label="Anexos" checked={config.showAttachments} onChange={(v) => update("showAttachments", v)} />
          </div>

          <div className="space-y-px mt-2 pt-2 border-t border-slate-100">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente / Contato</p>
            <Toggle label="Nome do cliente" checked={config.showClient} onChange={(v) => update("showClient", v)} />
            <Toggle label="Telefone do cliente" checked={config.showClientPhone} onChange={(v) => update("showClientPhone", v)} />
            <Toggle label="Contato no local" checked={config.showSiteContact} onChange={(v) => update("showSiteContact", v)} />
          </div>

          <div className="space-y-px mt-2 pt-2 border-t border-slate-100">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Empresa</p>
            <Toggle label="Telefone do escritorio" checked={config.showCompanyPhone} onChange={(v) => update("showCompanyPhone", v)} />
          </div>

          <div className="space-y-px mt-2 pt-2 border-t border-slate-100">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Financeiro</p>
            <Toggle label="Comissao do tecnico" checked={config.showCommission} onChange={(v) => update("showCommission", v)} />
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100">
            <label className="block text-[10px] text-slate-500 mb-1">Mensagem personalizada</label>
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
            className="mt-3 w-full rounded-lg bg-blue-600 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Concluir
          </button>
        </div>

        {/* Right: Phone Preview */}
        <div className="flex-1 flex justify-center">
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
              {/* Status badge + Title */}
              <div>
                {config.showStatus && (
                  <span className="inline-block rounded-full bg-orange-100 text-orange-700 px-1.5 py-px text-[7px] font-semibold mb-0.5">Ofertada</span>
                )}
                <h2 className="text-[11px] font-bold text-slate-800 leading-tight">
                  {config.showOsCode && <span className="text-slate-400 font-normal">OS-00028 </span>}
                  Troca de Filtro
                </h2>
              </div>

              {/* Custom message */}
              {config.customMessage && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-2 py-1.5">
                  <p className="text-[8px] text-blue-700 leading-relaxed">{config.customMessage}</p>
                </div>
              )}

              {/* Info card */}
              {hasAnyInfo && (
                <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm space-y-1">
                  <InfoItem icon="👤" label="Cliente" value="Joao da Silva" visible={config.showClient} />
                  <InfoItem icon="📞" label="Telefone" value="(66) 99999-0000" visible={config.showClientPhone} />
                  <InfoItem icon="🏠" label="Contato no local" value="Maria - (66) 98888-0000" visible={config.showSiteContact} />
                  <InfoItem icon="🏢" label="Escritorio" value="(66) 3521-0000" visible={config.showCompanyPhone} />
                  {config.showDescription && (
                    <p className="text-[8px] text-slate-500 leading-relaxed">Troca de filtro e bomba da piscina</p>
                  )}
                  <InfoItem icon="📍" label="Endereco" value="Rua Exemplo, 123 - Centro" visible={config.showAddress} />
                  <InfoItem icon="💰" label="Valor" value="R$ 360,00" visible={config.showValue} />
                  <InfoItem icon="🕐" label="Prazo" value="19/03/2026" visible={config.showDeadline} />
                  {config.showCommission && (
                    <div className="flex items-center gap-1.5 pt-0.5 border-t border-slate-100">
                      <span className="text-[7px]">💵</span>
                      <span className="text-[7px] text-green-600 font-semibold">Comissao: R$ 54,00 (15%)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments */}
              {config.showAttachments && (
                <div className="flex gap-1">
                  {[1, 2].map(i => (
                    <div key={i} className="h-8 w-8 rounded bg-slate-200 flex items-center justify-center">
                      <span className="text-[7px] text-slate-400">📷</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Workflow steps - from actual blocks */}
              {visibleBlocks.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] text-slate-400">Fluxo: {workflowName || "Sem nome"}</span>
                    <span className="text-[7px] text-slate-300 ml-auto">0/{interactiveCount}</span>
                  </div>
                  {visibleBlocks.map((vb, i) => {
                    const isAuto = !vb.isInteractive;
                    return (
                      <div
                        key={i}
                        className={`rounded-md border px-2 py-1 flex items-center gap-1.5 ${
                          isAuto
                            ? "border-green-200 bg-green-50"
                            : i === visibleBlocks.findIndex(b => b.isInteractive)
                              ? "border-orange-200 bg-orange-50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className="text-[8px]">
                          {isAuto ? "✅" : i === visibleBlocks.findIndex(b => b.isInteractive) ? "🎯" : "⬜"}
                        </span>
                        <span className={`text-[8px] font-medium ${
                          isAuto ? "text-green-700" : i === visibleBlocks.findIndex(b => b.isInteractive) ? "text-orange-700" : "text-slate-500"
                        }`}>
                          {vb.name}
                        </span>
                        {isAuto && <span className="text-[6px] text-green-500 ml-auto italic">auto</span>}
                      </div>
                    );
                  })}
                </div>
              )}
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
        </div>
      </div>
    </div>
  );
}
