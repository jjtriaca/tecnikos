"use client";

import { useState, useCallback, useEffect } from "react";
import { type Block, type CatalogEntry, createBlock, createDefaultWorkflow, insertBlockAfter, removeBlock, findBlock, findStartBlock, countUserBlocks, parseWorkflowSteps } from "@/types/workflow-blocks";
import WorkflowPalette from "./WorkflowPalette";
import WorkflowCanvas from "./WorkflowCanvas";
import WorkflowProperties from "./WorkflowProperties";
import WorkflowTemplates from "./WorkflowTemplates";
import { api } from "@/lib/api";

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
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!workflowId && !initialSteps);
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [insertVia, setInsertVia] = useState<"next" | "yesBranch" | "noBranch">("next");

  const selectedBlock = selectedBlockId ? findBlock(blocks, selectedBlockId) || null : null;
  const blockCount = countUserBlocks(blocks);

  // Handle adding a block from the palette
  const handleAddBlock = useCallback((entry: CatalogEntry) => {
    const newBlock = createBlock(entry.type);

    if (insertAfterId) {
      // Insert at specific position
      setBlocks((prev) => insertBlockAfter([...prev], insertAfterId, newBlock, insertVia));
      setInsertAfterId(null);
    } else {
      // Insert before END
      const endBlock = blocks.find(b => b.type === "END");
      if (!endBlock) return;

      // Find the block that points to END
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

  // Handle inserting at a specific position (from + button on canvas)
  const handleInsertAfter = useCallback((afterBlockId: string, via: "next" | "yesBranch" | "noBranch" = "next") => {
    setInsertAfterId(afterBlockId);
    setInsertVia(via);
    // Visual feedback: palette highlights
  }, []);

  // Handle block selection
  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    setInsertAfterId(null); // clear insert mode
  }, []);

  // Handle block deletion
  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks((prev) => removeBlock([...prev], id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }, [selectedBlockId]);

  // Handle block property change
  const handleBlockChange = useCallback((updated: Block) => {
    setBlocks((prev) => prev.map(b => b.id === updated.id ? updated : b));
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateBlocks: Block[]) => {
    setBlocks(templateBlocks);
    setShowTemplates(false);
    setSelectedBlockId(null);
  }, []);

  // Validation
  function validate(): string | null {
    if (!name.trim()) return "Informe um nome para o fluxo";
    if (blockCount === 0) return "Adicione pelo menos um bloco ao fluxo";

    // Check for empty configs
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

  // Save
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
        steps: { version: 2, blocks },
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
      if (e.key === "Delete" && selectedBlockId) {
        const b = findBlock(blocks, selectedBlockId);
        if (b && b.type !== "START" && b.type !== "END") {
          handleDeleteBlock(selectedBlockId);
        }
      }
      if (e.key === "Escape") {
        setSelectedBlockId(null);
        setInsertAfterId(null);
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
