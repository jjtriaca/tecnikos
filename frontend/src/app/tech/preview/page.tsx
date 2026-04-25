"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Types ── */

type FieldKey = "osCode" | "status" | "description" | "address" | "value" | "deadline" | "attachments" | "client" | "clientPhone" | "siteContact" | "companyPhone" | "creator" | "commission";

type TechPortalConfig = {
  showAddress?: boolean; showValue?: boolean; showDeadline?: boolean;
  showDescription?: boolean; showClient?: boolean; showClientPhone?: boolean;
  showOsCode?: boolean; showCommission?: boolean; showAttachments?: boolean;
  showStatus?: boolean; showSiteContact?: boolean; showCompanyPhone?: boolean;
  showCreator?: boolean;
  fieldOrder?: FieldKey[];
  companyPhoneLabel?: string; commissionLabel?: string; customMessage?: string;
};

type BlockDef = {
  id: string; type: string; name: string; icon: string;
  config: Record<string, any>; next: string | null;
  branches?: Record<string, string | null>;
};

/* ── Mock data ── */

const MOCK_ORDER = {
  code: "OS-00028",
  title: "Troca de Filtro e Bomba",
  description: "Troca de filtro e bomba da piscina residencial",
  status: "OFERTADA",
  addressText: "Rua Exemplo, 123 - Centro, Primavera do Leste/MT",
  deadlineAt: new Date().toISOString(),
  valueCents: 36000,
  clientName: "Joao da Silva",
  clientPhone: "(66) 99999-0000",
  siteContact: "Maria - (66) 98888-0000",
  companyPhone: "(66) 3521-0000",
  createdByName: "Juliano Triaca",
  commissionCents: 5400,
};

const STATUS_LABELS: Record<string, string> = {
  ATRIBUIDA: "Pendente", A_CAMINHO: "A Caminho", EM_EXECUCAO: "Em Execucao",
  CONCLUIDA: "Concluida", APROVADA: "Aprovada", AJUSTE: "Ajuste",
  OFERTADA: "Ofertada", ABERTA: "Aberta", RECUSADA: "Recusada",
};

const STATUS_BADGE: Record<string, string> = {
  ATRIBUIDA: "bg-amber-100 text-amber-800", A_CAMINHO: "bg-indigo-100 text-indigo-800",
  EM_EXECUCAO: "bg-blue-100 text-blue-800", CONCLUIDA: "bg-green-100 text-green-800",
  OFERTADA: "bg-orange-100 text-orange-800", ABERTA: "bg-yellow-100 text-yellow-800",
};

const DEFAULT_FIELD_ORDER: FieldKey[] = ["osCode", "status", "description", "client", "clientPhone", "siteContact", "address", "value", "deadline", "commission", "companyPhone", "creator", "attachments"];

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/* ── InfoRow (same style as real tech page) ── */

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
    blue: "bg-blue-50 text-blue-500", green: "bg-green-50 text-green-500",
    red: "bg-red-50 text-red-500", slate: "bg-slate-50 text-slate-500",
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

/* ── Interactive Block Renderer ── */

function LiveBlockAction({ block, onAdvance }: { block: BlockDef; onAdvance: (answer?: string) => void }) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const c = block.config || {};

  const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    green: { bg: "bg-gradient-to-r from-green-500 to-emerald-600", text: "text-white" },
    red: { bg: "bg-gradient-to-r from-red-500 to-rose-600", text: "text-white" },
    blue: { bg: "bg-gradient-to-r from-blue-500 to-indigo-600", text: "text-white" },
    orange: { bg: "bg-gradient-to-r from-orange-500 to-amber-600", text: "text-white" },
    yellow: { bg: "bg-gradient-to-r from-yellow-500 to-amber-500", text: "text-white" },
    purple: { bg: "bg-gradient-to-r from-purple-500 to-violet-600", text: "text-white" },
    slate: { bg: "bg-gradient-to-r from-slate-500 to-slate-600", text: "text-white" },
  };

  switch (block.type) {
    case "ACTION_BUTTONS": {
      const buttons = c.buttons || [{ id: "1", label: "Confirmar", color: "green", icon: "✅" }];
      return (
        <div className="space-y-2">
          {c.title && <p className="text-sm font-medium text-slate-700 text-center">{c.title}</p>}
          {buttons.map((btn: any) => {
            const colors = COLOR_MAP[btn.color] || COLOR_MAP.blue;
            return (
              <button
                key={btn.id}
                onClick={() => onAdvance(btn.id)}
                className={`w-full rounded-2xl ${colors.bg} py-4 text-base font-bold ${colors.text} shadow-lg active:scale-[0.98] transition-all`}
              >
                {btn.icon ? `${btn.icon} ` : ""}{btn.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "STEP":
      return (
        <div className="space-y-3">
          {c.description && <p className="text-sm text-slate-600">{c.description}</p>}
          {c.requirePhoto && (
            <div className="rounded-xl border-2 border-dashed border-slate-300 py-6 text-center">
              <span className="text-2xl">📸</span>
              <p className="text-xs text-slate-400 mt-1">Tirar foto</p>
            </div>
          )}
          {c.requireNote && (
            <textarea
              placeholder="Observacao..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
            />
          )}
          <button
            onClick={() => onAdvance()}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all"
          >
            ✅ Confirmar
          </button>
        </div>
      );
    case "PHOTO":
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{c.label || "Registrar foto"}</p>
          <div className="rounded-xl border-2 border-dashed border-slate-300 py-8 text-center">
            <span className="text-3xl">📸</span>
            <p className="text-xs text-slate-400 mt-2">Tirar foto{c.minPhotos > 1 ? ` (min ${c.minPhotos})` : ""}</p>
          </div>
          <button onClick={() => onAdvance()} className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all">
            📸 Enviar
          </button>
        </div>
      );
    case "NOTE":
      return (
        <div className="space-y-3">
          <textarea
            placeholder={c.placeholder || "Escreva uma observacao..."}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
          />
          <button onClick={() => onAdvance()} className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all">
            📝 Enviar
          </button>
        </div>
      );
    case "GPS":
      return (
        <button onClick={() => onAdvance()} className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all">
          📍 Registrar Localizacao
        </button>
      );
    case "QUESTION": {
      const options = c.options || ["Sim", "Nao"];
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">{c.question || "Pergunta?"}</p>
          <div className="space-y-2">
            {options.map((opt: string, i: number) => (
              <button
                key={i}
                onClick={() => { setSelectedAnswer(opt); onAdvance(opt); }}
                className={`w-full rounded-xl border py-3 text-sm font-semibold transition-all ${selectedAnswer === opt ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "CHECKLIST": {
      const items: string[] = c.items || ["Item 1", "Item 2"];
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            {items.map((item, i) => {
              const checked = checkedItems.has(i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = new Set(checkedItems);
                    checked ? next.delete(i) : next.add(i);
                    setCheckedItems(next);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${checked ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-green-500 bg-green-500" : "border-slate-300"}`}>
                    {checked && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className={`text-sm ${checked ? "text-green-800 line-through" : "text-slate-600"}`}>{item}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => onAdvance()} className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all">
            ☑️ Confirmar
          </button>
        </div>
      );
    }
    case "SIGNATURE":
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{c.label || "Assinatura digital"}</p>
          <div className="rounded-xl border-2 border-dashed border-slate-300 py-10 text-center bg-white">
            <span className="text-3xl">✍️</span>
            <p className="text-xs text-slate-400 mt-2">Toque para assinar</p>
          </div>
          <button onClick={() => onAdvance()} className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all">
            ✍️ Confirmar Assinatura
          </button>
        </div>
      );
    case "FORM": {
      const fields = c.fields || [{ name: "Campo", type: "text" }];
      return (
        <div className="space-y-3">
          {fields.map((f: any, i: number) => (
            <div key={i}>
              <label className="text-xs text-slate-500 mb-1 block">{f.name}{f.required ? " *" : ""}</label>
              {f.type === "select" ? (
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400">
                  <option>Selecione...</option>
                  {(f.options || []).map((o: string) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="Digite..." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
              )}
            </div>
          ))}
          <button onClick={() => onAdvance()} className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all">
            📋 Enviar
          </button>
        </div>
      );
    }
    default:
      return null;
  }
}

/* ── Auto Block Visual ── */

function AutoBlockVisual({ block }: { block: BlockDef }) {
  const c = block.config || {};
  switch (block.type) {
    case "DELAY": {
      const minutes = c.minutes || 5;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeLabel = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ""}` : `${mins} min`;
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center space-y-3">
          <div className="text-3xl">⏳</div>
          <p className="text-sm font-semibold text-amber-700">Aguardando...</p>
          <div className="inline-block rounded-full bg-amber-100 px-4 py-1.5">
            <span className="text-base font-bold text-amber-800 font-mono">{timeLabel}</span>
          </div>
          <p className="text-xs text-amber-500">Transicao automatica apos o tempo</p>
        </div>
      );
    }
    case "STATUS": {
      const newStatus = c.status || "EM_EXECUCAO";
      const labels: Record<string, string> = { ABERTA: "Aberta", OFERTADA: "Ofertada", ATRIBUIDA: "Atribuida", A_CAMINHO: "A Caminho", EM_EXECUCAO: "Em Execucao", CONCLUIDA: "Concluida" };
      return (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-6 text-center space-y-3">
          <div className="text-3xl">🔄</div>
          <p className="text-sm font-semibold text-blue-700">Mudanca de status</p>
          <div className="inline-block rounded-full bg-blue-100 px-4 py-1.5">
            <span className="text-base font-bold text-blue-800">{labels[newStatus] || newStatus}</span>
          </div>
          <p className="text-xs text-blue-500">Automatico</p>
        </div>
      );
    }
    case "NOTIFY": {
      const recipients = c.recipients || [];
      const first = recipients[0];
      const channel = first?.channel === "WHATSAPP" ? "WhatsApp" : first?.channel === "EMAIL" ? "E-mail" : first?.channel === "PUSH" ? "Push" : "Notificacao";
      return (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-6 text-center space-y-3">
          <div className="text-3xl">📨</div>
          <p className="text-sm font-semibold text-green-700">Notificacao enviada</p>
          <div className="inline-block rounded-full bg-green-100 px-4 py-1.5">
            <span className="text-base font-bold text-green-800">{channel}</span>
          </div>
          <p className="text-xs text-green-500">Automatico</p>
        </div>
      );
    }
    case "APPROVAL":
      return (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-6 text-center space-y-3">
          <div className="text-3xl">👨‍💼</div>
          <p className="text-sm font-semibold text-purple-700">Aguardando aprovacao</p>
          <p className="text-xs text-purple-500">O gestor precisa aprovar</p>
        </div>
      );
    default:
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center space-y-3">
          <div className="text-3xl">{block.icon || "⚙️"}</div>
          <p className="text-sm font-semibold text-slate-700">{block.name}</p>
          <p className="text-xs text-slate-500">Automatico</p>
        </div>
      );
  }
}

/* ── Main Preview Page ── */

const INTERACTIVE_TYPES = new Set(["STEP", "PHOTO", "NOTE", "GPS", "QUESTION", "CHECKLIST", "SIGNATURE", "FORM", "MATERIALS", "ACTION_BUTTONS", "ARRIVAL_QUESTION"]);

export default function TechPreviewPage() {
  const [config, setConfig] = useState<TechPortalConfig>({});
  const [blocks, setBlocks] = useState<BlockDef[]>([]);
  const [workflowName, setWorkflowName] = useState("Fluxo");
  const [stepIdx, setStepIdx] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

  // Walk chain to get all blocks except START/END
  const allBlocks: BlockDef[] = (() => {
    const result: BlockDef[] = [];
    const start = blocks.find(b => b.type === "START");
    if (!start) return result;
    let currentId: string | null = start.next;
    const visited = new Set<string>();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const b = blocks.find(bl => bl.id === currentId);
      if (!b || b.type === "END") break;
      result.push(b);
      currentId = b.next;
    }
    return result;
  })();

  const currentBlock = allBlocks[stepIdx] || null;
  const isInteractive = currentBlock ? INTERACTIVE_TYPES.has(currentBlock.type) : false;

  const handleAdvance = useCallback((answer?: string) => {
    if (currentBlock) {
      setCompletedBlocks(prev => new Set(prev).add(currentBlock.id));
    }
    // Auto-advance through auto blocks
    let next = stepIdx + 1;
    while (next < allBlocks.length && !INTERACTIVE_TYPES.has(allBlocks[next].type)) {
      setCompletedBlocks(prev => new Set(prev).add(allBlocks[next].id));
      next++;
    }
    if (next < allBlocks.length) {
      setStepIdx(next);
    }
    // Notify parent
    window.parent.postMessage({ type: "PREVIEW_BLOCK_CLICKED", blockId: currentBlock?.id, answer }, "*");
  }, [stepIdx, allBlocks, currentBlock]);

  // Listen for messages from parent
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "PREVIEW_UPDATE") {
        if (d.config) setConfig(d.config);
        if (d.blocks) {
          // Only reset step/completed if blocks actually changed
          setBlocks((prev: BlockDef[]) => {
            const prevIds = prev.map(b => b.id).join(",");
            const newIds = (d.blocks as BlockDef[]).map((b: BlockDef) => b.id).join(",");
            if (prevIds !== newIds) {
              setStepIdx(0);
              setCompletedBlocks(new Set());
            }
            return d.blocks;
          });
        }
        if (d.workflowName) setWorkflowName(d.workflowName);
      }
      if (d.type === "PREVIEW_STEP" && typeof d.stepIdx === "number") {
        setStepIdx(d.stepIdx);
      }
      if (d.type === "PREVIEW_RESET") {
        setStepIdx(0);
        setCompletedBlocks(new Set());
      }
    };
    window.addEventListener("message", handler);
    // Signal ready
    window.parent.postMessage({ type: "PREVIEW_READY" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  // Config values
  const showOsCode = config.showOsCode !== false;
  const showStatus = config.showStatus !== false;
  const showDescription = config.showDescription !== false;
  const showClient = config.showClient === true;
  const showClientPhone = config.showClientPhone === true;
  const showSiteContact = config.showSiteContact !== false;
  const showAddress = config.showAddress !== false;
  const showValue = config.showValue !== false;
  const showDeadline = config.showDeadline !== false;
  const showCommission = config.showCommission === true;
  const showCompanyPhone = config.showCompanyPhone !== false;
  const showCreator = config.showCreator === true;
  const showAttachments = config.showAttachments !== false;
  const companyPhoneLabel = config.companyPhoneLabel || "Escritorio";
  const commissionLabel = config.commissionLabel || "Comissao";
  const customMessage = config.customMessage || "";
  const fieldOrder = config.fieldOrder || DEFAULT_FIELD_ORDER;

  // Render a field by key
  function renderField(key: FieldKey) {
    switch (key) {
      case "osCode": return showOsCode ? <p key={key} className="text-xs font-mono text-slate-500 mb-2">🔢 {MOCK_ORDER.code}</p> : null;
      case "status": return null; // rendered above
      case "description": return showDescription ? <p key={key} className="text-sm text-slate-600 mb-3">{MOCK_ORDER.description}</p> : null;
      case "client": return showClient ? <InfoRow key={key} icon="user" color="blue" label="Cliente" value={MOCK_ORDER.clientName} /> : null;
      case "clientPhone": return showClientPhone ? <InfoRow key={key} icon="phone" color="blue" label="Telefone" value={MOCK_ORDER.clientPhone} /> : null;
      case "siteContact": return showSiteContact ? <InfoRow key={key} icon="home" color="blue" label="Contato no local" value={MOCK_ORDER.siteContact} /> : null;
      case "address": return showAddress ? <InfoRow key={key} icon="location" color="blue" label="Endereco" value={MOCK_ORDER.addressText} /> : null;
      case "value": return showValue ? <InfoRow key={key} icon="money" color="green" label="Valor" value={formatCurrency(MOCK_ORDER.valueCents)} bold /> : null;
      case "deadline": return showDeadline ? <InfoRow key={key} icon="clock" color="slate" label="Prazo" value={new Date(MOCK_ORDER.deadlineAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} /> : null;
      case "commission": return showCommission ? <InfoRow key={key} icon="money" color="green" label={commissionLabel} value={formatCurrency(MOCK_ORDER.commissionCents)} bold /> : null;
      case "companyPhone": return showCompanyPhone ? <InfoRow key={key} icon="building" color="slate" label={companyPhoneLabel} value={MOCK_ORDER.companyPhone} /> : null;
      case "creator": return showCreator ? <InfoRow key={key} icon="pencil" color="slate" label="Criado por" value={MOCK_ORDER.createdByName} /> : null;
      case "attachments":
        return showAttachments ? (
          <div key={key} className="flex gap-2 mt-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center">
                <span className="text-lg text-slate-400">📷</span>
              </div>
            ))}
          </div>
        ) : null;
      default: return null;
    }
  }

  // Interactive block count for progress
  const interactiveOnly = allBlocks.filter(b => INTERACTIVE_TYPES.has(b.type));
  const iCompleted = interactiveOnly.filter(b => completedBlocks.has(b.id)).length;
  const iTotal = interactiveOnly.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-800">Tecnikos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-slate-500">PREVIEW</span>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-4 pb-20">
        {/* Back */}
        <button className="flex items-center gap-1 text-xs text-slate-500 mb-3">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>

        {/* Title + Status */}
        <div className="mb-4">
          {showStatus && (
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[MOCK_ORDER.status] || "bg-slate-100 text-slate-600"}`}>
                {STATUS_LABELS[MOCK_ORDER.status] || MOCK_ORDER.status}
              </span>
            </div>
          )}
          <h1 className="text-lg font-bold text-slate-900">{MOCK_ORDER.title}</h1>
        </div>

        {/* Custom message */}
        {customMessage && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 mb-4">
            <p className="text-sm text-blue-700 leading-relaxed">{customMessage}</p>
          </div>
        )}

        {/* Info Card — fields rendered in fieldOrder */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
          {fieldOrder.filter(k => k === "osCode" || k === "description").map(renderField)}
          <div className="space-y-2.5">
            {fieldOrder.filter(k => k !== "osCode" && k !== "description" && k !== "status").map(renderField)}
          </div>
        </div>

        {/* Workflow section */}
        {allBlocks.length > 0 && (
          <div className="mb-4">
            {iTotal > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Fluxo: {workflowName}
                  <span className="ml-auto text-xs font-normal text-slate-400">{iCompleted}/{iTotal}</span>
                </h3>
                <div className="h-2 rounded-full bg-slate-100 mb-4 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                    style={{ width: `${iTotal > 0 ? (iCompleted / iTotal) * 100 : 0}%` }} />
                </div>
              </>
            )}

            {/* Current block */}
            {currentBlock && (
              isInteractive ? (
                <LiveBlockAction block={currentBlock} onAdvance={handleAdvance} />
              ) : (
                <AutoBlockVisual block={currentBlock} />
              )
            )}

            {/* Completed blocks summary */}
            {completedBlocks.size > 0 && (
              <div className="mt-3 space-y-1.5">
                {allBlocks.filter(b => completedBlocks.has(b.id) && INTERACTIVE_TYPES.has(b.type)).map(b => (
                  <div key={b.id} className="rounded-xl border border-green-200 bg-green-50 p-2.5 flex items-center gap-2">
                    <span>✅</span>
                    <span className="text-xs font-medium text-green-800">{b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-0.5">
          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[10px] font-medium text-blue-600">Minhas OS</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] text-slate-400">Perfil</span>
        </div>
      </nav>
    </div>
  );
}
