"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import dynamic from "next/dynamic";

const CanvasBuilder = dynamic(() => import("./components/CanvasBuilder"), { ssr: false });

import TemplateGallery from "./components/TemplateGallery";
import SimulationModal from "./components/SimulationModal";
import ExecutionTimeline from "./components/ExecutionTimeline";

import {
  type EntityType,
  type TriggerDef,
  type ConditionDef,
  type ConditionNode,
  type BranchDef,
  type ActionDef,
  type AutomationRuleData,
  type ActionTypeDef,
  type ConditionFieldDef,
  ENTITY_OPTIONS,
  ENTITY_EVENTS,
  ENTITY_FIELDS,
  OPERATORS_BY_FIELD_TYPE,
  ACTION_TYPES,
  CATEGORY_COLORS,
  getActionsForEntity,
  getOperatorsForField,
  getFieldDef,
  getActionDef,
  describeTrigger,
  describeActions,
  countActionsInTree,
} from "@/types/automation-blocks";

/* ═══════════════════════════════════════════════════════════════
   AUTOMATION BUILDER PAGE
   Vista lista + builder com encaixe lógico obrigatório
   ═══════════════════════════════════════════════════════════════ */

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: TriggerDef;
  actions: ActionDef[];
  layout?: any;
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
}

interface PaginatedResponse {
  data: AutomationRule[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function AutomationPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  /* ── View State ─────────────────────────────────────────── */
  const [view, setView] = useState<"list" | "builder">("list");
  const [builderMode, setBuilderMode] = useState<"form" | "canvas">("form");
  const [loading, setLoading] = useState(true);

  /* ── List State ─────────────────────────────────────────── */
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  /* ── Template / Simulation / Timeline State ──────────────── */
  const [showTemplates, setShowTemplates] = useState(false);
  const [simulateRule, setSimulateRule] = useState<AutomationRule | null>(null);
  const [timelineRule, setTimelineRule] = useState<AutomationRule | null>(null);

  /* ── Builder State ──────────────────────────────────────── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Trigger
  const [triggerEntity, setTriggerEntity] = useState<EntityType>("SERVICE_ORDER");
  const [triggerEvent, setTriggerEvent] = useState("");

  // Conditions
  const [conditionMode, setConditionMode] = useState<'simple' | 'advanced'>('simple');
  const [conditions, setConditions] = useState<ConditionNode[]>([]);

  // Actions
  const [actions, setActions] = useState<ActionDef[]>([]);

  // Canvas layout
  const [ruleLayout, setRuleLayout] = useState<any>(null);

  const [saving, setSaving] = useState(false);

  /* ── Load Rules ─────────────────────────────────────────── */
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<PaginatedResponse>("/automations?limit=100");
      setRules(res.data);
    } catch {
      toast("Erro ao carregar automações", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  /* ── Builder Reset ──────────────────────────────────────── */
  const resetBuilder = () => {
    setEditingId(null);
    setRuleName("");
    setRuleDesc("");
    setIsActive(true);
    setTriggerEntity("SERVICE_ORDER");
    setTriggerEvent("");
    setConditionMode('simple');
    setConditions([]);
    setActions([]);
    setRuleLayout(null);
    setBuilderMode("form");
  };

  const openNewBuilder = () => {
    resetBuilder();
    setView("builder");
  };

  const openEditBuilder = (rule: AutomationRule) => {
    setEditingId(rule.id);
    setRuleName(rule.name);
    setRuleDesc(rule.description || "");
    setIsActive(rule.isActive);
    setTriggerEntity(rule.trigger.entity);
    setTriggerEvent(rule.trigger.event);
    setConditionMode(rule.trigger.conditionMode || 'simple');
    setConditions(rule.trigger.conditions || []);
    setActions(rule.actions || []);
    setRuleLayout((rule as any).layout || null);
    setBuilderMode("form");
    setView("builder");
  };

  /* ── Save ───────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!ruleName.trim()) {
      toast("Nome da automação é obrigatório", "error");
      return;
    }
    if (!triggerEvent) {
      toast("Selecione o evento gatilho", "error");
      return;
    }
    const treeActionCount = conditionMode === 'advanced' ? countActionsInTree(conditions) : 0;
    if (actions.length === 0 && treeActionCount === 0) {
      toast("Adicione pelo menos uma ação", "error");
      return;
    }

    const payload: any = {
      name: ruleName.trim(),
      description: ruleDesc.trim() || undefined,
      isActive,
      trigger: {
        entity: triggerEntity,
        event: triggerEvent,
        conditionMode,
        conditions: conditions.length > 0 ? conditions : undefined,
      },
      actions,
      layout: ruleLayout || undefined,
    };

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/automations/${editingId}`, payload);
        toast("Automação atualizada!", "success");
      } else {
        await api.post("/automations", payload);
        toast("Automação criada!", "success");
      }
      setView("list");
      resetBuilder();
      loadRules();
    } catch {
      toast("Erro ao salvar automação", "error");
    } finally {
      setSaving(false);
    }
  };

  /** Save from canvas mode */
  const handleCanvasSave = async (trigger: TriggerDef, canvasActions: ActionDef[], layout: any) => {
    if (!ruleName.trim()) {
      toast("Nome da automação é obrigatório", "error");
      return;
    }
    if (!trigger.event) {
      toast("Conecte o bloco de evento ao gatilho", "error");
      return;
    }
    if (canvasActions.length === 0) {
      toast("Conecte pelo menos um bloco de ação", "error");
      return;
    }

    const payload: any = {
      name: ruleName.trim(),
      description: ruleDesc.trim() || undefined,
      isActive,
      trigger,
      actions: canvasActions,
      layout,
    };

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/automations/${editingId}`, payload);
        toast("Automação atualizada!", "success");
      } else {
        await api.post("/automations", payload);
        toast("Automação criada!", "success");
      }
      setView("list");
      resetBuilder();
      loadRules();
    } catch {
      toast("Erro ao salvar automação", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ─────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/automations/${deleteTarget}`);
      toast("Automação excluída", "success");
      setDeleteTarget(null);
      loadRules();
    } catch {
      toast("Erro ao excluir", "error");
    }
  };

  /* ── Toggle ─────────────────────────────────────────────── */
  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/automations/${id}/toggle`, {});
      loadRules();
    } catch {
      toast("Erro ao alternar status", "error");
    }
  };

  /* ── Condition Helpers ──────────────────────────────────── */
  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "eq", value: "" }]);
  };

  const updateCondition = (idx: number, patch: Partial<ConditionNode>) => {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  /** Deep-update a node inside the condition tree at a given path */
  const updateConditionTree = (newConditions: ConditionNode[]) => {
    setConditions(newConditions);
  };

  /* ── Action Helpers ─────────────────────────────────────── */
  const addAction = (typeId: string) => {
    const def = getActionDef(typeId);
    if (!def) return;
    const config: Record<string, any> = {};
    // Set defaults for config fields
    if (def.configFields) {
      for (const f of def.configFields) {
        if (f.options && f.options.length > 0) config[f.id] = f.options[0].value;
        else config[f.id] = "";
      }
    }
    setActions([...actions, { type: typeId, config }]);
  };

  const updateActionConfig = (idx: number, key: string, value: any) => {
    setActions(
      actions.map((a, i) =>
        i === idx ? { ...a, config: { ...a.config, [key]: value } } : a
      )
    );
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  /* ── Available Events (depends on selected entity) ─────── */
  const availableEvents = ENTITY_EVENTS[triggerEntity] || [];

  /* ── Available Fields (depends on selected entity) ─────── */
  const availableFields = ENTITY_FIELDS[triggerEntity] || [];

  /* ── Available Actions (depends on selected entity) ─────── */
  const availableActions = getActionsForEntity(triggerEntity);

  /* ═══════════════════════════════════════════════════════════
     RENDER — LIST VIEW
     ═══════════════════════════════════════════════════════════ */
  if (view === "list") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Automações</h1>
            <p className="text-sm text-slate-500 mt-1">
              Regras que executam ações automaticamente quando eventos acontecem
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2 text-sm border border-violet-300 text-violet-700 hover:bg-violet-50 rounded-lg transition-colors font-medium flex items-center gap-1.5"
            >
              📋 Templates
            </button>
            <button
              onClick={openNewBuilder}
              className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <span className="text-lg">+</span> Nova Automação
            </button>
          </div>
        </div>

        {/* Rules List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma automação criada</h3>
            <p className="text-slate-500 mb-6">
              Crie regras para automatizar ações quando eventos acontecem no sistema.
            </p>
            <button
              onClick={openNewBuilder}
              className="bg-violet-600 text-white px-6 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
            >
              Criar Primeira Automação
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => (
              <AutomationCard
                key={rule.id}
                rule={rule}
                onEdit={() => openEditBuilder(rule)}
                onDelete={() => setDeleteTarget(rule.id)}
                onToggle={() => handleToggle(rule.id)}
                onSimulate={() => setSimulateRule(rule)}
                onTimeline={() => setTimelineRule(rule)}
              />
            ))}
          </div>
        )}

        {/* Delete Confirm */}
        <ConfirmModal
          open={!!deleteTarget}
          title="Excluir Automação"
          message="Tem certeza que deseja excluir esta automação? O histórico de execuções será mantido."
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />

        {/* Template Gallery */}
        <TemplateGallery
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          onApply={() => loadRules()}
        />

        {/* Simulation Modal */}
        {simulateRule && (
          <SimulationModal
            open={!!simulateRule}
            ruleId={simulateRule.id}
            ruleName={simulateRule.name}
            entityType={simulateRule.trigger.entity}
            onClose={() => setSimulateRule(null)}
          />
        )}

        {/* Execution Timeline */}
        {timelineRule && (
          <ExecutionTimeline
            open={!!timelineRule}
            ruleId={timelineRule.id}
            ruleName={timelineRule.name}
            onClose={() => setTimelineRule(null)}
          />
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER — BUILDER VIEW
     ═══════════════════════════════════════════════════════════ */

  // ── Canvas mode ──
  if (builderMode === "canvas") {
    return (
      <div className="space-y-4">
        {/* Header with back + name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); resetBuilder(); }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {editingId ? "Editar Automação" : "Nova Automação"}
          </h1>
          <button
            onClick={() => setBuilderMode("form")}
            className="ml-4 px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 font-medium"
          >
            ← Modo Formulário
          </button>
        </div>

        {/* Name & Active toggle inline */}
        <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-3">
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Nome da automação *"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
          />
          <input
            type="text"
            value={ruleDesc}
            onChange={(e) => setRuleDesc(e.target.value)}
            placeholder="Descrição (opcional)"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
          />
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600" />
          </label>
        </div>

        {/* Canvas */}
        <CanvasBuilder
          entity={triggerEntity}
          onEntityChange={setTriggerEntity}
          trigger={{ entity: triggerEntity, event: triggerEvent, conditions: conditions.length > 0 ? conditions : undefined }}
          actions={actions}
          layout={ruleLayout}
          onSave={handleCanvasSave}
          onCancel={() => { setView("list"); resetBuilder(); }}
          ruleName={ruleName}
          saving={saving}
        />
      </div>
    );
  }

  // ── Form mode ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); resetBuilder(); }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {editingId ? "Editar Automação" : "Nova Automação"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBuilderMode("canvas")}
            className="px-3 py-2 text-sm border border-violet-300 text-violet-700 hover:bg-violet-50 rounded-lg transition-colors font-medium flex items-center gap-1.5"
          >
            🎨 Modo Canvas
          </button>
          <button
            onClick={() => { setView("list"); resetBuilder(); }}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Automação"}
          </button>
        </div>
      </div>

      {/* Builder Form */}
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Name & Description */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Automação *</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Ex: Lançar financeiro ao finalizar OS"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
            <input
              type="text"
              value={ruleDesc}
              onChange={(e) => setRuleDesc(e.target.value)}
              placeholder="Breve descrição do que esta automação faz"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
            </label>
            <span className="text-sm text-slate-700">{isActive ? "Ativa" : "Inativa"}</span>
          </div>
        </div>

        {/* ── QUANDO (Trigger) ──────────────────────────── */}
        <SectionHeader
          icon="⚡"
          title="QUANDO"
          subtitle="Gatilho — o que dispara esta automação"
          colors={CATEGORY_COLORS.TRIGGER}
        />
        <div className={`rounded-xl border-2 ${CATEGORY_COLORS.TRIGGER.border} ${CATEGORY_COLORS.TRIGGER.bg} p-6 space-y-4`}>
          <div className="grid grid-cols-2 gap-4">
            {/* Entity */}
            <div>
              <label className="block text-sm font-medium text-orange-800 mb-1">Entidade</label>
              <select
                value={triggerEntity}
                onChange={(e) => {
                  setTriggerEntity(e.target.value as EntityType);
                  setTriggerEvent("");
                  setConditions([]);
                  setActions([]);
                }}
                className="w-full px-3 py-2 border border-orange-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-orange-500"
              >
                {ENTITY_OPTIONS.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.icon} {ent.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Event */}
            <div>
              <label className="block text-sm font-medium text-orange-800 mb-1">Evento</label>
              <select
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
                className="w-full px-3 py-2 border border-orange-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Selecione o evento...</option>
                {availableEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.icon} {evt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {triggerEvent && (
            <p className="text-xs text-orange-700">
              {availableEvents.find(e => e.id === triggerEvent)?.description}
            </p>
          )}
        </div>

        {/* Connection Arrow */}
        {triggerEvent && <ConnectionArrow />}

        {/* ── SE (Conditions) ───────────────────────────── */}
        {triggerEvent && (
          <>
            <SectionHeader
              icon="🔍"
              title="SE (opcional)"
              subtitle="Condições — filtros que devem ser atendidos"
              colors={CATEGORY_COLORS.CONDITION}
            />
            <div className={`rounded-xl border-2 ${CATEGORY_COLORS.CONDITION.border} ${CATEGORY_COLORS.CONDITION.bg} p-6 space-y-3`}>
              {/* Mode Toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConditionMode('simple')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      conditionMode === 'simple'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    Modo Simples (AND)
                  </button>
                  <button
                    onClick={() => setConditionMode('advanced')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      conditionMode === 'advanced'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    Modo Avançado (Árvore SIM/NÃO)
                  </button>
                </div>
                {conditionMode === 'advanced' && (
                  <span className="text-xs text-amber-600 italic">
                    Ações dentro dos ramos — seção ENTÃO fica opcional
                  </span>
                )}
              </div>

              {conditionMode === 'simple' ? (
                /* ── Simple mode: flat AND list ── */
                <>
                  {conditions.length === 0 && (
                    <p className="text-sm text-amber-700 italic">
                      Sem condições — a automação dispara para qualquer registro neste evento.
                    </p>
                  )}
                  {conditions.map((cond, idx) => (
                    <ConditionRow
                      key={idx}
                      condition={cond}
                      fields={availableFields}
                      entity={triggerEntity}
                      onChange={(patch) => updateCondition(idx, patch)}
                      onRemove={() => removeCondition(idx)}
                    />
                  ))}
                  <button
                    onClick={addCondition}
                    className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                  >
                    <span className="text-lg">+</span> Adicionar Condição
                  </button>
                </>
              ) : (
                /* ── Advanced mode: SIM/NÃO tree ── */
                <>
                  {conditions.length === 0 && (
                    <p className="text-sm text-amber-700 italic">
                      Adicione condições com ramificação SIM/NÃO. Cada ramo pode ter suas próprias ações e sub-condições.
                    </p>
                  )}
                  {conditions.map((node, idx) => (
                    <ConditionTreeNode
                      key={idx}
                      node={node}
                      depth={0}
                      fields={availableFields}
                      entity={triggerEntity}
                      availableActions={getActionsForEntity(triggerEntity)}
                      onChange={(updated) => {
                        const next = [...conditions];
                        next[idx] = updated;
                        updateConditionTree(next);
                      }}
                      onRemove={() => removeCondition(idx)}
                    />
                  ))}
                  <button
                    onClick={addCondition}
                    className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                  >
                    <span className="text-lg">+</span> Adicionar Condição
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Connection Arrow */}
        {triggerEvent && <ConnectionArrow />}

        {/* ── ENTÃO (Actions) ───────────────────────────── */}
        {triggerEvent && (
          <>
            <SectionHeader
              icon="🎯"
              title={conditionMode === 'advanced' ? 'ENTÃO (global — opcional)' : 'ENTÃO'}
              subtitle={conditionMode === 'advanced'
                ? 'Ações globais — executadas sempre, além das ações nos ramos'
                : 'Ações — o que o sistema faz automaticamente'
              }
              colors={CATEGORY_COLORS.ACTION}
            />
            <div className={`rounded-xl border-2 ${CATEGORY_COLORS.ACTION.border} ${CATEGORY_COLORS.ACTION.bg} p-6 space-y-4`}>
              {actions.length === 0 && (
                <p className="text-sm text-violet-700 italic">
                  Adicione pelo menos uma ação que será executada.
                </p>
              )}
              {actions.map((action, idx) => (
                <ActionRow
                  key={idx}
                  action={action}
                  entity={triggerEntity}
                  onChange={(key, val) => updateActionConfig(idx, key, val)}
                  onRemove={() => removeAction(idx)}
                />
              ))}

              {/* Add Action Dropdown */}
              <div className="pt-2 border-t border-violet-200">
                <label className="block text-sm font-medium text-violet-800 mb-2">Adicionar ação:</label>
                <div className="flex flex-wrap gap-2">
                  {availableActions.map((at) => (
                    <button
                      key={at.id}
                      onClick={() => addAction(at.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-violet-300 rounded-lg hover:bg-violet-100 transition-colors text-violet-800 flex items-center gap-1.5"
                    >
                      <span>{at.icon}</span> {at.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Summary */}
        {triggerEvent && (actions.length > 0 || (conditionMode === 'advanced' && countActionsInTree(conditions) > 0)) && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Resumo da Automação</h3>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-orange-700">QUANDO</span>{" "}
              {ENTITY_OPTIONS.find(e => e.id === triggerEntity)?.label}{" "}
              é {availableEvents.find(e => e.id === triggerEvent)?.label?.toLowerCase()}
              {conditions.length > 0 && (
                <span>
                  {" "}
                  <span className="font-medium text-amber-700">SE</span>{" "}
                  {conditions.filter(c => c.field && c.value).length} condição(ões) atendida(s)
                </span>
              )}
              {" "}
              <span className="font-medium text-violet-700">ENTÃO</span>{" "}
              {describeActions(actions).toLowerCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ icon, title, subtitle, colors }: {
  icon: string;
  title: string;
  subtitle: string;
  colors: { bg: string; text: string; iconBg: string };
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 ${colors.iconBg} rounded-lg flex items-center justify-center text-white text-sm`}>
        {icon}
      </div>
      <div>
        <h2 className={`text-sm font-bold ${colors.text}`}>{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function ConnectionArrow() {
  return (
    <div className="flex justify-center">
      <div className="w-0.5 h-8 bg-slate-300 relative">
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-r-2 border-slate-300 transform rotate-45" />
      </div>
    </div>
  );
}

function ConditionRow({ condition, fields, entity, onChange, onRemove }: {
  condition: ConditionDef;
  fields: ConditionFieldDef[];
  entity: EntityType;
  onChange: (patch: Partial<ConditionDef>) => void;
  onRemove: () => void;
}) {
  const selectedField = fields.find(f => f.id === condition.field);
  const operators = selectedField
    ? OPERATORS_BY_FIELD_TYPE[selectedField.type] || []
    : [];

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 p-3">
      {/* Field */}
      <select
        value={condition.field}
        onChange={(e) => onChange({ field: e.target.value, operator: "eq", value: "" })}
        className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
      >
        <option value="">Campo...</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value })}
        className="w-40 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
        disabled={!condition.field}
      >
        {operators.map((op) => (
          <option key={op.id} value={op.id}>{op.label}</option>
        ))}
      </select>

      {/* Value */}
      {selectedField?.type === "enum" && selectedField.values ? (
        <select
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
        >
          <option value="">Selecione...</option>
          {selectedField.values.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : selectedField?.type === "date" ? (
        <input
          type="date"
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
        />
      ) : (
        <input
          type={selectedField?.type === "number" ? "number" : "text"}
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={selectedField?.placeholder || "Valor..."}
          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
        />
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        title="Remover condição"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONDITION TREE NODE — Recursive SIM/NÃO branching component
   ═══════════════════════════════════════════════════════════════ */

function ConditionTreeNode({ node, depth, fields, entity, availableActions, onChange, onRemove }: {
  node: ConditionNode;
  depth: number;
  fields: ConditionFieldDef[];
  entity: EntityType;
  availableActions: ActionTypeDef[];
  onChange: (updated: ConditionNode) => void;
  onRemove: () => void;
}) {
  const [showTrue, setShowTrue] = useState(true);
  const [showFalse, setShowFalse] = useState(true);

  const selectedField = fields.find(f => f.id === node.field);
  const operators = selectedField
    ? OPERATORS_BY_FIELD_TYPE[selectedField.type] || []
    : [];

  // ── Branch helpers ──
  const updateBranch = (branchKey: 'trueBranch' | 'falseBranch', patch: Partial<BranchDef>) => {
    const existing = node[branchKey] || { conditions: [], actions: [] };
    onChange({ ...node, [branchKey]: { ...existing, ...patch } });
  };

  const addBranchCondition = (branchKey: 'trueBranch' | 'falseBranch') => {
    const existing = node[branchKey] || { conditions: [], actions: [] };
    const newCond: ConditionNode = { field: '', operator: 'eq', value: '' };
    updateBranch(branchKey, { conditions: [...(existing.conditions || []), newCond] });
  };

  const updateBranchCondition = (branchKey: 'trueBranch' | 'falseBranch', idx: number, updated: ConditionNode) => {
    const existing = node[branchKey] || { conditions: [], actions: [] };
    const next = [...(existing.conditions || [])];
    next[idx] = updated;
    updateBranch(branchKey, { conditions: next });
  };

  const removeBranchCondition = (branchKey: 'trueBranch' | 'falseBranch', idx: number) => {
    const existing = node[branchKey] || { conditions: [], actions: [] };
    updateBranch(branchKey, { conditions: (existing.conditions || []).filter((_, i) => i !== idx) });
  };

  const addBranchAction = (branchKey: 'trueBranch' | 'falseBranch', typeId: string) => {
    const def = getActionDef(typeId);
    if (!def) return;
    const config: Record<string, any> = {};
    if (def.configFields) {
      for (const f of def.configFields) {
        if (f.options && f.options.length > 0) config[f.id] = f.options[0].value;
        else config[f.id] = '';
      }
    }
    const existing = node[branchKey] || { conditions: [], actions: [] };
    updateBranch(branchKey, { actions: [...(existing.actions || []), { type: typeId, config }] });
  };

  const updateBranchActionConfig = (branchKey: 'trueBranch' | 'falseBranch', idx: number, key: string, value: any) => {
    const existing = node[branchKey] || { conditions: [], actions: [] };
    const next = (existing.actions || []).map((a, i) =>
      i === idx ? { ...a, config: { ...a.config, [key]: value } } : a
    );
    updateBranch(branchKey, { actions: next });
  };

  const removeBranchAction = (branchKey: 'trueBranch' | 'falseBranch', idx: number) => {
    const existing = node[branchKey] || { conditions: [], actions: [] };
    updateBranch(branchKey, { actions: (existing.actions || []).filter((_, i) => i !== idx) });
  };

  const trueBranch = node.trueBranch || { conditions: [], actions: [] };
  const falseBranch = node.falseBranch || { conditions: [], actions: [] };

  return (
    <div className="relative" style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      {/* Condition Card */}
      <div className="bg-white rounded-lg border-2 border-amber-300 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-bold text-xs shrink-0">SE</span>
          {/* Field */}
          <select
            value={node.field}
            onChange={(e) => onChange({ ...node, field: e.target.value, operator: 'eq', value: '' })}
            className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
          >
            <option value="">Campo...</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          {/* Operator */}
          <select
            value={node.operator}
            onChange={(e) => onChange({ ...node, operator: e.target.value })}
            className="w-36 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
            disabled={!node.field}
          >
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.label}</option>
            ))}
          </select>
          {/* Value */}
          {selectedField?.type === 'enum' && selectedField.values ? (
            <select
              value={node.value}
              onChange={(e) => onChange({ ...node, value: e.target.value })}
              className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="">Selecione...</option>
              {selectedField.values.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : selectedField?.type === 'date' ? (
            <input
              type="date"
              value={node.value}
              onChange={(e) => onChange({ ...node, value: e.target.value })}
              className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          ) : (
            <input
              type={selectedField?.type === 'number' ? 'number' : 'text'}
              value={node.value}
              onChange={(e) => onChange({ ...node, value: e.target.value })}
              placeholder={selectedField?.placeholder || 'Valor...'}
              className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          )}
          {/* Remove */}
          <button
            onClick={onRemove}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
            title="Remover condição"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Branches */}
      <div className="mt-2 grid grid-cols-2 gap-3">
        {/* ── TRUE Branch (SIM) ── */}
        <div className="rounded-lg border-2 border-green-300 bg-green-50/50">
          <button
            onClick={() => setShowTrue(!showTrue)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100/50 transition-colors rounded-t-lg"
          >
            <span>✅ SIM ({(trueBranch.conditions?.length || 0)} cond, {(trueBranch.actions?.length || 0)} ações)</span>
            <svg className={`h-4 w-4 transition-transform ${showTrue ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showTrue && (
            <div className="p-3 space-y-2 border-t border-green-200">
              {/* Branch conditions (recursive) */}
              {(trueBranch.conditions || []).map((child, ci) => (
                <ConditionTreeNode
                  key={ci}
                  node={child}
                  depth={depth + 1}
                  fields={fields}
                  entity={entity}
                  availableActions={availableActions}
                  onChange={(updated) => updateBranchCondition('trueBranch', ci, updated)}
                  onRemove={() => removeBranchCondition('trueBranch', ci)}
                />
              ))}
              {/* Branch actions */}
              {(trueBranch.actions || []).map((act, ai) => (
                <div key={`act-${ai}`} className="ml-1">
                  <MiniActionRow
                    action={act}
                    entity={entity}
                    onChange={(key, val) => updateBranchActionConfig('trueBranch', ai, key, val)}
                    onRemove={() => removeBranchAction('trueBranch', ai)}
                  />
                </div>
              ))}
              {/* Add buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => addBranchCondition('trueBranch')}
                  className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
                >
                  + Sub-condição
                </button>
                <span className="text-green-300">|</span>
                <div className="relative group">
                  <button className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-1">
                    + Ação
                  </button>
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 hidden group-hover:block min-w-[200px]">
                    {availableActions.map((at) => (
                      <button
                        key={at.id}
                        onClick={() => addBranchAction('trueBranch', at.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-green-50 flex items-center gap-2"
                      >
                        <span>{at.icon}</span> {at.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FALSE Branch (NÃO) ── */}
        <div className="rounded-lg border-2 border-red-300 bg-red-50/50">
          <button
            onClick={() => setShowFalse(!showFalse)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100/50 transition-colors rounded-t-lg"
          >
            <span>❌ NÃO ({(falseBranch.conditions?.length || 0)} cond, {(falseBranch.actions?.length || 0)} ações)</span>
            <svg className={`h-4 w-4 transition-transform ${showFalse ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showFalse && (
            <div className="p-3 space-y-2 border-t border-red-200">
              {/* Branch conditions (recursive) */}
              {(falseBranch.conditions || []).map((child, ci) => (
                <ConditionTreeNode
                  key={ci}
                  node={child}
                  depth={depth + 1}
                  fields={fields}
                  entity={entity}
                  availableActions={availableActions}
                  onChange={(updated) => updateBranchCondition('falseBranch', ci, updated)}
                  onRemove={() => removeBranchCondition('falseBranch', ci)}
                />
              ))}
              {/* Branch actions */}
              {(falseBranch.actions || []).map((act, ai) => (
                <div key={`act-${ai}`} className="ml-1">
                  <MiniActionRow
                    action={act}
                    entity={entity}
                    onChange={(key, val) => updateBranchActionConfig('falseBranch', ai, key, val)}
                    onRemove={() => removeBranchAction('falseBranch', ai)}
                  />
                </div>
              ))}
              {/* Add buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => addBranchCondition('falseBranch')}
                  className="text-xs text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
                >
                  + Sub-condição
                </button>
                <span className="text-red-300">|</span>
                <div className="relative group">
                  <button className="text-xs text-red-700 hover:text-red-900 font-medium flex items-center gap-1">
                    + Ação
                  </button>
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 hidden group-hover:block min-w-[200px]">
                    {availableActions.map((at) => (
                      <button
                        key={at.id}
                        onClick={() => addBranchAction('falseBranch', at.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 flex items-center gap-2"
                      >
                        <span>{at.icon}</span> {at.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI ACTION ROW — compact action inside a branch
   ═══════════════════════════════════════════════════════════════ */

function MiniActionRow({ action, entity, onChange, onRemove }: {
  action: ActionDef;
  entity: EntityType;
  onChange: (key: string, value: any) => void;
  onRemove: () => void;
}) {
  const def = getActionDef(action.type);
  if (!def) return null;

  return (
    <div className="bg-violet-50 rounded-lg border border-violet-200 p-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{def.icon}</span>
          <span className="text-xs font-semibold text-violet-900">{def.label}</span>
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
          title="Remover ação"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {def.configFields && def.configFields.length > 0 && (
        <div className="space-y-1.5 pt-1.5 border-t border-violet-100">
          {def.configFields.map((cf) => (
            <div key={cf.id}>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                {cf.label} {cf.required && <span className="text-red-500">*</span>}
              </label>
              {cf.type === 'select' && cf.options ? (
                <select
                  value={action.config?.[cf.id] || ''}
                  onChange={(e) => onChange(cf.id, e.target.value)}
                  className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white"
                >
                  {cf.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : cf.type === 'textarea' ? (
                <textarea
                  value={action.config?.[cf.id] || ''}
                  onChange={(e) => onChange(cf.id, e.target.value)}
                  placeholder={cf.placeholder}
                  rows={1}
                  className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={action.config?.[cf.id] || ''}
                  onChange={(e) => onChange(cf.id, e.target.value)}
                  placeholder={cf.placeholder}
                  className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ action, entity, onChange, onRemove }: {
  action: ActionDef;
  entity: EntityType;
  onChange: (key: string, value: any) => void;
  onRemove: () => void;
}) {
  const def = getActionDef(action.type);
  if (!def) return null;

  return (
    <div className="bg-white rounded-lg border border-violet-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{def.icon}</span>
          <span className="text-sm font-semibold text-violet-900">{def.label}</span>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Remover ação"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">{def.description}</p>

      {/* Config Fields */}
      {def.configFields && def.configFields.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-violet-100">
          {def.configFields.map((cf) => (
            <div key={cf.id}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {cf.label} {cf.required && <span className="text-red-500">*</span>}
              </label>
              {cf.type === "select" && cf.options ? (
                <select
                  value={action.config?.[cf.id] || ""}
                  onChange={(e) => onChange(cf.id, e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                >
                  {cf.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : cf.type === "textarea" ? (
                <textarea
                  value={action.config?.[cf.id] || ""}
                  onChange={(e) => onChange(cf.id, e.target.value)}
                  placeholder={cf.placeholder}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={action.config?.[cf.id] || ""}
                  onChange={(e) => onChange(cf.id, e.target.value)}
                  placeholder={cf.placeholder}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationCard({ rule, onEdit, onDelete, onToggle, onSimulate, onTimeline }: {
  rule: AutomationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onSimulate: () => void;
  onTimeline: () => void;
}) {
  const triggerSummary = describeTrigger(rule.trigger);
  const actionSummary = describeActions(rule.actions);
  const execCount = rule._count?.executions ?? 0;

  return (
    <div className={`bg-white rounded-xl border ${rule.isActive ? "border-slate-200" : "border-slate-200 opacity-60"} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-semibold text-slate-900 truncate">{rule.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
              rule.isActive
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              {rule.isActive ? "Ativa" : "Inativa"}
            </span>
            {execCount > 0 && (
              <button
                onClick={onTimeline}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors cursor-pointer"
                title="Ver histórico de execuções"
              >
                {execCount} execução{execCount !== 1 ? "ões" : ""}
              </button>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-slate-500 mb-2">{rule.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${CATEGORY_COLORS.TRIGGER.bg} ${CATEGORY_COLORS.TRIGGER.text} font-medium`}>
              ⚡ {triggerSummary}
            </span>
            <span className="text-slate-400">→</span>
            <span className={`px-2 py-1 rounded ${CATEGORY_COLORS.ACTION.bg} ${CATEGORY_COLORS.ACTION.text} font-medium`}>
              🎯 {actionSummary}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-4">
          {/* Simulate */}
          <button
            onClick={onSimulate}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            title="Simular (dry run)"
          >
            <span className="text-base">🔬</span>
          </button>
          {/* Timeline */}
          <button
            onClick={onTimeline}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Histórico de execuções"
          >
            <span className="text-base">📜</span>
          </button>
          {/* Toggle */}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title={rule.isActive ? "Desativar" : "Ativar"}
          >
            {rule.isActive ? (
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 9v3m0 0v3" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
          {/* Edit */}
          <button
            onClick={onEdit}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Editar"
          >
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="Excluir"
          >
            <svg className="h-5 w-5 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
