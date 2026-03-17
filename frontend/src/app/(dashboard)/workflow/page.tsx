"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import WorkflowVisualEditor from "./editor/WorkflowVisualEditor";

/* ═══════════════════════════════════════════════════════════════
   FLUXO DE ATENDIMENTO — Editor Visual de Blocos
   Lista de workflows + editor visual completo.
   ═══════════════════════════════════════════════════════════════ */

/* ── API Types ────────────────────────────────────────────── */

type WorkflowFull = {
  id: string;
  name: string;
  steps: any;
  isActive: boolean;
  createdAt: string;
};

type WorkflowListItem = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

/* ── Page ──────────────────────────────────────────────────── */

export default function WorkflowPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  /* ── State ─────────────────────────────────────────────── */
  const [view, setView] = useState<"list" | "editor">("list");
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ name: string; steps: any; isActive: boolean } | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Drag-and-drop reorder
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  /* ── Load workflows ────────────────────────────────────── */
  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: WorkflowListItem[]; meta: any }>("/workflows?limit=100");
      setWorkflows(res.data ?? []);
    } catch {
      toast("Erro ao carregar fluxos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  /* ── Actions ───────────────────────────────────────────── */

  const handleNew = () => {
    setEditingId(null);
    setEditingData(null);
    setView("editor");
  };

  const handleEdit = async (wf: WorkflowListItem) => {
    try {
      setLoading(true);
      const full = await api.get<WorkflowFull>(`/workflows/${wf.id}`);
      setEditingId(full.id);
      setEditingData({ name: full.name, steps: full.steps, isActive: full.isActive });
      setView("editor");
    } catch {
      toast("Erro ao carregar fluxo", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (wf: WorkflowListItem) => {
    try {
      const full = await api.get<WorkflowFull>(`/workflows/${wf.id}`);
      await api.post("/workflows", {
        name: `${full.name} (copia)`,
        steps: full.steps,
      });
      toast("Fluxo duplicado com sucesso!", "success");
      loadWorkflows();
    } catch {
      toast("Erro ao duplicar fluxo", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.del(`/workflows/${deleteId}`);
      toast("Fluxo excluido", "success");
      setDeleteId(null);
      loadWorkflows();
    } catch {
      toast("Erro ao excluir fluxo", "error");
    }
  };

  const handleToggleActive = async (wf: WorkflowListItem) => {
    try {
      await api.put(`/workflows/${wf.id}`, { isActive: !wf.isActive });
      setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, isActive: !wf.isActive } : w));
      toast(wf.isActive ? "Fluxo desativado" : "Fluxo ativado", "success");
    } catch {
      toast("Erro ao alterar status do fluxo", "error");
    }
  };

  const handleEditorBack = () => {
    setView("list");
    setEditingId(null);
    setEditingData(null);
  };

  const handleEditorSaved = () => {
    setView("list");
    setEditingId(null);
    setEditingData(null);
    loadWorkflows();
    toast("Fluxo salvo com sucesso!", "success");
  };

  /* ── Drag-and-drop reorder ──────────────────────────────── */

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    const oldList = [...workflows];
    const dragIndex = oldList.findIndex(w => w.id === dragId);
    const targetIndex = oldList.findIndex(w => w.id === targetId);
    if (dragIndex < 0 || targetIndex < 0) return;

    const [moved] = oldList.splice(dragIndex, 1);
    oldList.splice(targetIndex, 0, moved);

    setWorkflows(oldList);
    setDragId(null);
    setDragOverId(null);

    try {
      await api.patch("/workflows/reorder", { orderedIds: oldList.map(w => w.id) });
    } catch {
      toast("Erro ao reordenar fluxos", "error");
      loadWorkflows();
    }
  };

  /* ── Render: VISUAL EDITOR ──────────────────────────────── */

  if (view === "editor") {
    return (
      <WorkflowVisualEditor
        workflowId={editingId}
        initialName={editingData?.name}
        initialSteps={editingData?.steps}
        initialIsActive={editingData?.isActive}
        onBack={handleEditorBack}
        onSaved={handleEditorSaved}
      />
    );
  }

  /* ── Render: LIST ──────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fluxo de Atendimento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure as etapas do atendimento com o editor visual de blocos
          </p>
        </div>
        <button onClick={handleNew}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
          + Novo Fluxo
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && workflows.length === 0 && (
        <div className="text-center py-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
          <span className="text-4xl block mb-3">📋</span>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Nenhum fluxo criado</h3>
          <p className="text-sm text-slate-500 mb-4">Crie seu primeiro fluxo de atendimento</p>
          <button onClick={handleNew}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
            + Criar Fluxo
          </button>
        </div>
      )}

      {/* Workflow cards */}
      {!loading && workflows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(wf => (
            <div
              key={wf.id}
              draggable
              onDragStart={(e) => handleDragStart(e, wf.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, wf.id)}
              onDrop={(e) => handleDrop(e, wf.id)}
              className={`bg-white rounded-xl border hover:shadow-md transition-all overflow-hidden group cursor-grab active:cursor-grabbing ${
                wf.isActive ? "border-slate-200" : "border-slate-200 opacity-60"
              } ${dragOverId === wf.id && dragId !== wf.id ? "ring-2 ring-blue-400 scale-[1.02]" : ""}`}
            >
              {/* Color bar */}
              <div className={`h-1.5 ${wf.isActive ? "bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" : "bg-slate-300"}`} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Drag handle */}
                    <span className="text-slate-300 group-hover:text-slate-400 shrink-0 select-none" title="Arraste para reordenar">&#x2807;</span>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-bold truncate ${wf.isActive ? "text-slate-800" : "text-slate-400"}`}>{wf.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Criado em {new Date(wf.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {/* Toggle ativo/inativo */}
                    <button
                      onClick={() => handleToggleActive(wf)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${wf.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                      title={wf.isActive ? "Desativar fluxo" : "Ativar fluxo"}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${wf.isActive ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                    </button>
                  </div>
                </div>

                {!wf.isActive && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-0.5 mb-2 inline-block">Inativo</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 pt-3 border-t border-slate-100">
                  <button onClick={() => handleEdit(wf)}
                    className="flex-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg py-2 transition-colors">
                    Editar
                  </button>
                  <button onClick={() => handleDuplicate(wf)}
                    className="flex-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded-lg py-2 transition-colors">
                    Duplicar
                  </button>
                  <button onClick={() => setDeleteId(wf.id)}
                    className="flex-1 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg py-2 transition-colors">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <ConfirmModal
          open
          title="Excluir fluxo"
          message="Tem certeza que deseja excluir este fluxo? Esta acao nao pode ser desfeita."
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
