"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import StageSection from "./components/StageSection";
import TechnicianOnboardingSection from "./components/TechnicianOnboardingSection";
import ClientOnboardingSection from "./components/ClientOnboardingSection";
import SupplierOnboardingSection from "./components/SupplierOnboardingSection";
import {
  type WorkflowFormConfig,
  type StageConfig,
  type TechnicianOnboardingConfig,
  type ClientOnboardingConfig,
  type SupplierOnboardingConfig,
  createDefaultConfig,
  compileToV2,
  decompileFromV2,
  WORKFLOW_PRESETS,
  OS_STATUSES,
  TRIGGER_OPTIONS,
} from "@/types/stage-config";

/* ═══════════════════════════════════════════════════════════════
   FLUXO DE ATENDIMENTO — Formulário de Etapas
   Página grande scrollável com toggles por etapa.
   ═══════════════════════════════════════════════════════════════ */

/* ── API Types ────────────────────────────────────────────── */

type WorkflowTemplate = {
  id: string;
  name: string;
  isDefault: boolean;
  steps: any;
  createdAt: string;
  requiredSpecializationIds: string[];
};

type WorkflowListItem = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
};

/* ── Page ──────────────────────────────────────────────────── */

export default function WorkflowPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  /* ── State ─────────────────────────────────────────────── */
  const [view, setView] = useState<"list" | "form">("list");
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [config, setConfig] = useState<WorkflowFormConfig>(createDefaultConfig());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>("blank");

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Trigger section: collapsed by default, auto-collapse when scrolled out of view
  const [triggerExpanded, setTriggerExpanded] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerExpanded || !triggerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) setTriggerExpanded(false); },
      { threshold: 0.1 },
    );
    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, [triggerExpanded]);

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
    setConfig(createDefaultConfig());
    setEditingId(null);
    setActivePreset("blank");
    setView("form");
  };

  const handleEdit = async (wf: WorkflowListItem) => {
    try {
      setLoading(true);
      const full = await api.get<WorkflowTemplate>(`/workflows/${wf.id}`);

      const decompiled = decompileFromV2(full.steps);
      if (decompiled) {
        decompiled.name = full.name;
        decompiled.isDefault = full.isDefault;
        setConfig(decompiled);
      } else {
        // Can't decompile (has CONDITION blocks or unknown format)
        const fresh = createDefaultConfig();
        fresh.name = full.name;
        fresh.isDefault = full.isDefault;
        setConfig(fresh);
        toast("Fluxo antigo com blocos complexos. Configuração resetada.", "warning");
      }

      setEditingId(full.id);
      setActivePreset("");
      setView("form");
    } catch {
      toast("Erro ao carregar fluxo", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast("Informe um nome para o fluxo", "error");
      return;
    }

    const isOnboardingTrigger = ['partner_tech_created', 'partner_spec_added', 'partner_client_created', 'partner_supplier_created'].includes(config.trigger.id);
    const enabledStages = config.stages.filter(s => s.enabled);
    if (!isOnboardingTrigger && enabledStages.length === 0) {
      toast("Ative pelo menos uma etapa", "error");
      return;
    }

    try {
      setSaving(true);
      const v2 = compileToV2(config);
      const payload = {
        name: config.name.trim(),
        steps: v2,
        isDefault: config.isDefault,
      };

      if (editingId) {
        await api.put(`/workflows/${editingId}`, payload);
        toast("Fluxo atualizado com sucesso!", "success");
      } else {
        await api.post("/workflows", payload);
        toast("Fluxo criado com sucesso!", "success");
      }

      setView("list");
      loadWorkflows();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao salvar fluxo", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (wf: WorkflowListItem) => {
    try {
      const full = await api.get<WorkflowTemplate>(`/workflows/${wf.id}`);
      await api.post("/workflows", {
        name: `${full.name} (cópia)`,
        steps: full.steps,
        isDefault: false,
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
      toast("Fluxo excluído", "success");
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

  const handlePreset = (presetId: string) => {
    const preset = WORKFLOW_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setConfig(preset.apply(config));
    setActivePreset(presetId);
  };

  const handleStageChange = (index: number, stage: StageConfig) => {
    const stages = [...config.stages];
    stages[index] = stage;

    // Handle mutual exclusion: _disableOtherFinancial flag
    const disableOther = (stage.autoActions.financialEntry as any)._disableOtherFinancial;
    if (disableOther) {
      // Remove the internal flag
      stages[index] = {
        ...stage,
        autoActions: {
          ...stage.autoActions,
          financialEntry: {
            enabled: true,
            entries: stage.autoActions.financialEntry.entries || [],
          },
        },
      };
      // Disable financial in the other stage
      const otherIdx = stages.findIndex(s => s.status === disableOther);
      if (otherIdx >= 0) {
        stages[otherIdx] = {
          ...stages[otherIdx],
          autoActions: {
            ...stages[otherIdx].autoActions,
            financialEntry: { enabled: false, entries: stages[otherIdx].autoActions.financialEntry.entries || [] },
          },
        };
      }
    }

    setConfig({ ...config, stages });
    setActivePreset(""); // preset no longer applies
  };

  /* ── Computed ──────────────────────────────────────────── */

  const totalEnabled = config.stages.filter(s => s.enabled).length;
  const totalActions = config.stages.reduce((sum, s) => {
    if (!s.enabled) return sum;
    return sum +
      Object.values(s.techActions).filter(a => a.enabled).length +
      Object.values(s.autoActions).filter(a => a.enabled).length +
      Object.values(s.timeControl).filter(a => a.enabled).length;
  }, 0);
  // onboarding triggers removed — trigger system replaces it

  /* ── Render: LIST ──────────────────────────────────────── */

  if (view === "list") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fluxo de Atendimento</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure as etapas do atendimento com ações automáticas e do técnico
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
              <div key={wf.id} className={`bg-white rounded-xl border hover:shadow-md transition-all overflow-hidden group ${wf.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                {/* Color bar */}
                <div className={`h-1.5 ${wf.isActive ? "bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" : "bg-slate-300"}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-bold truncate ${wf.isActive ? "text-slate-800" : "text-slate-400"}`}>{wf.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Criado em {new Date(wf.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {wf.isDefault && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Padrão
                        </span>
                      )}
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
                      ✏️ Editar
                    </button>
                    <button onClick={() => handleDuplicate(wf)}
                      className="flex-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded-lg py-2 transition-colors">
                      📋 Duplicar
                    </button>
                    <button onClick={() => setDeleteId(wf.id)}
                      className="flex-1 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg py-2 transition-colors">
                      🗑️ Excluir
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
            message="Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita."
            confirmLabel="Excluir"
            variant="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteId(null)}
          />
        )}
      </div>
    );
  }

  /* ── Render: FORM ──────────────────────────────────────── */

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 flex items-center justify-between gap-3">
        <button onClick={() => setView("list")}
          className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1">
          ← Voltar
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-bold text-slate-700">
            {editingId ? "Editar Fluxo" : "Novo Fluxo"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalEnabled > 0 && (
            <span className="hidden sm:inline text-xs text-slate-400">
              {totalEnabled} etapas · {totalActions} ações
            </span>
          )}
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? "Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {/* Name + Default */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Nome do fluxo *</span>
              <input
                type="text"
                value={config.name}
                onChange={e => setConfig({ ...config, name: e.target.value })}
                placeholder="Ex: Instalação Padrão, Manutenção Corretiva..."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors"
              />
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.isDefault}
                onChange={e => setConfig({ ...config, isDefault: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-200 h-4 w-4"
              />
              <span className="text-sm text-slate-700">Fluxo padrão</span>
            </label>
          </div>
        </div>
      </div>

      {/* Presets */}
      {!['partner_tech_created', 'partner_spec_added', 'partner_client_created', 'partner_supplier_created'].includes(config.trigger.id) && <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          🎨 Modelos Prontos
          <span className="text-xs font-normal text-slate-400">— clique para preencher automaticamente</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {WORKFLOW_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium border transition-all ${
                activePreset === preset.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span className="mr-1.5">{preset.icon}</span>
              {preset.name}
            </button>
          ))}
        </div>
        {activePreset && activePreset !== "blank" && (
          <p className="text-xs text-blue-600 mt-2">
            ✓ Modelo &ldquo;{WORKFLOW_PRESETS.find(p => p.id === activePreset)?.name}&rdquo; aplicado — personalize abaixo
          </p>
        )}
      </div>}

      {/* Trigger Selector — collapsible */}
      <div ref={triggerRef} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setTriggerExpanded(!triggerExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">1.</span>
            <span className="text-sm">⚡</span>
            <span className="text-sm font-semibold text-slate-700">Quando:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              {config.trigger.icon} {config.trigger.label}
            </span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${triggerExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {triggerExpanded && (
          <div className="px-4 pb-2 border-t border-slate-100 pt-1.5">
            <div className="flex flex-wrap gap-1">
              {TRIGGER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setConfig({ ...config, trigger: opt }); setActivePreset(""); setTriggerExpanded(false); }}
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 transition-all ${
                    config.trigger.id === opt.id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                  }`}
                >
                  <span className="text-[10px] leading-none">{opt.icon}</span>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    config.trigger.id === opt.id ? "text-blue-700" : "text-slate-500"
                  }`}>
                    {opt.label}
                  </span>
                  {config.trigger.id === opt.id && (
                    <span className="text-blue-600 text-[9px] shrink-0">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Connection arrow: trigger → stages */}
      <div className="flex justify-center -my-1">
        <div className="w-0.5 h-6 bg-slate-300 relative">
          <div className="absolute -bottom-1 -left-[3px] w-2 h-2 border-b-2 border-r-2 border-slate-300 transform rotate-45" />
        </div>
      </div>

      {/* Stages — content changes depending on trigger */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          📊 Etapas do Fluxo
          <span className="text-xs font-normal text-slate-400">
            {config.trigger.id === 'partner_tech_created'
              ? '— configure o onboarding do técnico'
              : config.trigger.id === 'partner_spec_added'
              ? '— configure o envio por especialização'
              : config.trigger.id === 'partner_client_created'
              ? '— configure o onboarding do cliente'
              : config.trigger.id === 'partner_supplier_created'
              ? '— configure o onboarding do fornecedor'
              : '— ative e configure cada etapa'}
          </span>
        </h2>

      {config.trigger.id === 'partner_supplier_created' ? (
        <SupplierOnboardingSection
          config={config.supplierOnboarding}
          onChange={(onboarding) => setConfig({ ...config, supplierOnboarding: onboarding })}
        />
      ) : config.trigger.id === 'partner_client_created' ? (
        <ClientOnboardingSection
          config={config.clientOnboarding}
          onChange={(onboarding) => setConfig({ ...config, clientOnboarding: onboarding })}
        />
      ) : ['partner_tech_created', 'partner_spec_added'].includes(config.trigger.id) ? (
        <TechnicianOnboardingSection
          config={config.technicianOnboarding}
          onChange={(onboarding) => setConfig({ ...config, technicianOnboarding: onboarding })}
          triggerId={config.trigger.id}
        />
      ) : (
        <div>

          <div className="space-y-3">
            {config.stages.map((stage, index) => (
              <div key={stage.id}>
                <StageSection
                  stage={stage}
                  index={index}
                  onChange={(updated) => handleStageChange(index, updated)}
                  allStages={config.stages}
                />
                {/* Connection arrow */}
                {index < config.stages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-6 bg-slate-300 relative">
                      <div className="absolute -bottom-1 -left-[3px] w-2 h-2 border-b-2 border-r-2 border-slate-300 transform rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Summary + Save */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Resumo</h3>
            <p className="text-xs text-slate-500 mt-1">
              {config.trigger.id === 'partner_supplier_created' ? (
                <>&#9889; {config.trigger.label} · Onboarding de fornecedor {config.supplierOnboarding.enabled ? '\u2705 ativo' : '\u23F8 desativado'}</>
              ) : config.trigger.id === 'partner_client_created' ? (
                <>&#9889; {config.trigger.label} · Onboarding de cliente {config.clientOnboarding.enabled ? '\u2705 ativo' : '\u23F8 desativado'}</>
              ) : ['partner_tech_created', 'partner_spec_added'].includes(config.trigger.id) ? (
                <>&#9889; {config.trigger.label} · {config.trigger.id === 'partner_tech_created' ? 'Onboarding de técnico' : 'Nova especialização'} {config.technicianOnboarding.enabled ? '\u2705 ativo' : '\u23F8 desativado'}</>
              ) : (
                <>⚡ {config.trigger.label} · {totalEnabled} {totalEnabled === 1 ? "etapa ativa" : "etapas ativas"} · {totalActions} {totalActions === 1 ? "ação configurada" : "ações configuradas"}</>
              )}
            </p>
            {!['partner_tech_created', 'partner_spec_added', 'partner_client_created', 'partner_supplier_created'].includes(config.trigger.id) && totalEnabled > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {config.stages.filter(s => s.enabled).map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {s.icon} {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
              {saving ? "Salvando..." : "💾 Salvar Fluxo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
