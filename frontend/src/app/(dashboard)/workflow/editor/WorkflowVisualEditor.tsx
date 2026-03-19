"use client";

import { useState, useCallback, useEffect } from "react";
import { type Block, type CatalogEntry, createBlock, createDefaultWorkflow, insertBlockAfter, removeBlock, findBlock, findStartBlock, countUserBlocks, parseWorkflowSteps } from "@/types/workflow-blocks";
import WorkflowPalette from "./WorkflowPalette";
import WorkflowCanvas from "./WorkflowCanvas";
import WorkflowProperties from "./WorkflowProperties";
import WorkflowTemplates from "./WorkflowTemplates";
import { api } from "@/lib/api";
import { TRIGGER_OPTIONS, type TriggerDefinition } from "@/types/stage-config";

/* ── Trigger helpers ── */

function parseTriggerFromSteps(steps: any): TriggerDefinition {
  if (!steps?.trigger) return TRIGGER_OPTIONS[0];
  const t = steps.trigger;
  // Match by triggerId first, then by entity+event
  const byId = TRIGGER_OPTIONS.find(o => o.id === t.triggerId);
  if (byId) return byId;
  const byEntityEvent = TRIGGER_OPTIONS.find(o => o.entity === t.entity && o.event === t.event);
  if (byEntityEvent) return byEntityEvent;
  return TRIGGER_OPTIONS[0];
}

interface Props {
  workflowId: string | null; // null = new
  initialName?: string;
  initialSteps?: any; // V1 or V2 from DB
  initialIsActive?: boolean;
  onBack: () => void;
  onSaved: () => void;
}

export default function WorkflowVisualEditor({ workflowId, initialName, initialSteps, initialIsActive, onBack, onSaved }: Props) {
  const [name, setName] = useState(initialName || "");
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (initialSteps) {
      const parsed = parseWorkflowSteps(initialSteps);
      return parsed.blocks;
    }
    return createDefaultWorkflow();
  });
  const [trigger, setTrigger] = useState<TriggerDefinition>(() => parseTriggerFromSteps(initialSteps));
  const [showTriggerSelector, setShowTriggerSelector] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!workflowId && !initialSteps);
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [insertVia, setInsertVia] = useState<"next" | "yesBranch" | "noBranch">("next");

  const selectedBlock = selectedBlockId ? findBlock(blocks, selectedBlockId) || null : null;
  const blockCount = countUserBlocks(blocks);

  // Group triggers for display
  const osTriggers = TRIGGER_OPTIONS.filter(t => t.entity === "SERVICE_ORDER");
  const quoteTriggers = TRIGGER_OPTIONS.filter(t => t.entity === "QUOTE");
  const partnerTriggers = TRIGGER_OPTIONS.filter(t => t.entity === "PARTNER");

  // Handle adding a block from the palette
  const handleAddBlock = useCallback((entry: CatalogEntry) => {
    const newBlock = createBlock(entry.type);

    if (insertAfterId) {
      setBlocks((prev) => insertBlockAfter([...prev], insertAfterId, newBlock, insertVia));
      setInsertAfterId(null);
    } else {
      const endBlock = blocks.find(b => b.type === "END");
      if (!endBlock) return;

      let parentBlock: Block | undefined;
      for (const b of blocks) {
        if (b.next === endBlock.id) { parentBlock = b; break; }
      }

      if (parentBlock) {
        setBlocks((prev) => insertBlockAfter([...prev], parentBlock!.id, newBlock));
      }
    }

    setSelectedBlockId(newBlock.id);
  }, [blocks, insertAfterId, insertVia]);

  const handleInsertAfter = useCallback((afterBlockId: string, via: "next" | "yesBranch" | "noBranch" = "next") => {
    setInsertAfterId(afterBlockId);
    setInsertVia(via);
  }, []);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    setInsertAfterId(null);
  }, []);

  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks((prev) => removeBlock([...prev], id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }, [selectedBlockId]);

  const handleBlockChange = useCallback((updated: Block) => {
    setBlocks((prev) => prev.map(b => b.id === updated.id ? updated : b));
  }, []);

  const handleTemplateSelect = useCallback((templateBlocks: Block[]) => {
    setBlocks(templateBlocks);
    setShowTemplates(false);
    setSelectedBlockId(null);
  }, []);

  // Validation
  function validate(): string | null {
    if (!name.trim()) return "Informe um nome para o fluxo";
    if (blockCount === 0) return "Adicione pelo menos um bloco ao fluxo";

    for (const b of blocks) {
      if (b.type === "CHECKLIST" && (!b.config.items || b.config.items.length === 0)) {
        return `Bloco "${b.name}" precisa de pelo menos 1 item no checklist`;
      }
      if (b.type === "QUESTION" && !b.config.question) {
        return `Bloco "${b.name}" precisa de uma pergunta`;
      }
      if (b.type === "CONDITION" && !b.config.question) {
        return `Bloco "${b.name}" precisa de uma condicao definida`;
      }
      if (b.type === "NOTIFY") {
        const recipients = b.config.recipients;
        if (!recipients || recipients.length === 0) {
          return `Bloco "${b.name}" precisa de pelo menos 1 destinatario`;
        }
        for (const r of recipients) {
          if (!r.message) return `Bloco "${b.name}" tem destinatario sem mensagem`;
        }
      }
    }
    return null;
  }

  // Save — include trigger in steps payload
  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        steps: {
          version: 2,
          blocks,
          trigger: {
            entity: trigger.entity,
            event: trigger.event,
            triggerId: trigger.id,
          },
        },
        isActive: initialIsActive ?? true,
      };

      if (workflowId) {
        await api.put(`/workflows/${workflowId}`, payload);
      } else {
        await api.post("/workflows", payload);
      }

      setSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar workflow");
    } finally {
      setSaving(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "Delete" && selectedBlockId) {
        const b = findBlock(blocks, selectedBlockId);
        if (b && b.type !== "START" && b.type !== "END") {
          handleDeleteBlock(selectedBlockId);
        }
      }
      if (e.key === "Escape") {
        setSelectedBlockId(null);
        setInsertAfterId(null);
        setShowTriggerSelector(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedBlockId, blocks, handleDeleteBlock]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Voltar
        </button>

        <div className="h-5 w-px bg-slate-200" />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do fluxo..."
          className="flex-1 rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-slate-700 placeholder-slate-300 outline-none hover:border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
        />

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 tabular-nums">{blockCount} blocos</span>

          <button
            onClick={() => setShowTemplates(true)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Modelos
          </button>

          {error && (
            <span className="text-[10px] text-red-500 max-w-48 truncate">{error}</span>
          )}

          {success && (
            <span className="text-[10px] text-green-600 font-medium">Salvo!</span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </div>

      {/* Trigger Selector Bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quando:</span>
        <button
          onClick={() => setShowTriggerSelector(!showTriggerSelector)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 transition-colors shadow-sm"
        >
          <span className="text-sm">{trigger.icon}</span>
          <span>{trigger.label}</span>
          <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showTriggerSelector ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="text-[10px] text-slate-400 italic">{trigger.description}</span>
      </div>

      {/* Trigger dropdown */}
      {showTriggerSelector && (
        <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="max-w-2xl space-y-3">
            {/* OS triggers */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ordens de Servico</p>
              <div className="flex flex-wrap gap-1.5">
                {osTriggers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTrigger(t); setShowTriggerSelector(false); }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      trigger.id === t.id
                        ? "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/30"
                    }`}
                  >
                    <span className="text-sm">{t.icon}</span>
                    <span>{t.label}</span>
                    {trigger.id === t.id && <span className="text-blue-500 text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Quote triggers */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Orcamentos</p>
              <div className="flex flex-wrap gap-1.5">
                {quoteTriggers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTrigger(t); setShowTriggerSelector(false); }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      trigger.id === t.id
                        ? "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/30"
                    }`}
                  >
                    <span className="text-sm">{t.icon}</span>
                    <span>{t.label}</span>
                    {trigger.id === t.id && <span className="text-blue-500 text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Partner triggers */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Parceiros (Onboarding)</p>
              <div className="flex flex-wrap gap-1.5">
                {partnerTriggers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTrigger(t); setShowTriggerSelector(false); }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      trigger.id === t.id
                        ? "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/30"
                    }`}
                  >
                    <span className="text-sm">{t.icon}</span>
                    <span>{t.label}</span>
                    {trigger.id === t.id && <span className="text-blue-500 text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insert mode indicator */}
      {insertAfterId && (
        <div className="flex items-center justify-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-1.5">
          <span className="text-xs text-blue-600 font-medium">Clique em um bloco da paleta para inserir nesta posicao</span>
          <button
            onClick={() => setInsertAfterId(null)}
            className="text-xs text-blue-400 hover:text-blue-600 underline"
          >Cancelar</button>
        </div>
      )}

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        <WorkflowPalette onAddBlock={handleAddBlock} />
        <WorkflowCanvas
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={handleSelectBlock}
          onDeleteBlock={handleDeleteBlock}
          onInsertAfter={handleInsertAfter}
        />
        <WorkflowProperties
          block={selectedBlock}
          onChange={handleBlockChange}
        />
      </div>

      {/* Template modal */}
      {showTemplates && (
        <WorkflowTemplates
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}

    </div>
  );
}
