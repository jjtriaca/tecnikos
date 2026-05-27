"use client";

// Modal de gestao das Regras Solares (v1.12.63).
// Cada regra vincula um (tipo de produto, modelo) a um conjunto de regras de
// dimensionamento (MIN/MAX coletores por bateria, max area, max series, vazao).
// Sem regra cadastrada, o sistema usa defaults internos.
//
// Aberto via botao "Cadastrar regras" no Diagrama de Instalacao do Simulador Solar.
// Documentacao: memory/project_solar_regras_configuraveis.md.

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { HelpHint } from "@/components/ui/HelpHint";

interface SolarRulesValues {
  minColetoresPorBateria: number;
  maxColetoresPorBateria: number;
  maxAreaPorBateriaM2: number;
  maxBateriasEmSerie: number;
  vazaoProjetoLhPorM2: number;
}

interface SolarRule {
  id: string;
  name: string;
  poolType: string;
  model: string;
  rules: SolarRulesValues;
  productCount: number;
}

interface UncoveredEntry {
  poolType: string;
  model: string;
  productCount: number;
}

interface ListResponse {
  rules: SolarRule[];
  uncovered: UncoveredEntry[];
  defaults: SolarRulesValues;
  relevantPoolTypes: string[];
  collectorRuleConfigured: boolean;
}

interface ModelOption {
  model: string;
  productCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void; // callback pro Simulador re-resolver o badge
}

type Phase = "LIST" | "FORM";

const EMPTY_RULES: SolarRulesValues = {
  minColetoresPorBateria: 5,
  maxColetoresPorBateria: 7,
  maxAreaPorBateriaM2: 30,
  maxBateriasEmSerie: 3,
  vazaoProjetoLhPorM2: 252,
};

export default function SolarRulesModal({ open, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("LIST");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPoolType, setFormPoolType] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formRules, setFormRules] = useState<SolarRulesValues>(EMPTY_RULES);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dropdown options
  const [poolTypes, setPoolTypes] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => setMounted(true), []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListResponse>("/pool-budgets/solar-rules");
      setData(res);
    } catch (err: any) {
      toast(err?.message ?? "Erro ao carregar regras", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Carrega lista inicial (relevantPoolTypes vem junto com a resposta)
  useEffect(() => {
    if (open) {
      setPhase("LIST");
      reload();
    }
  }, [open, reload]);

  // Sincroniza dropdown de tipos com a resposta filtrada pelo backend
  useEffect(() => {
    if (data?.relevantPoolTypes) setPoolTypes(data.relevantPoolTypes);
  }, [data?.relevantPoolTypes]);

  // Quando poolType muda no form, recarrega modelos disponiveis
  useEffect(() => {
    if (!formPoolType.trim()) {
      setModelOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    api
      .get<ModelOption[]>(`/pool-budgets/solar-rules/models?poolType=${encodeURIComponent(formPoolType.trim())}`)
      .then((res) => {
        if (!cancelled) setModelOptions(res);
      })
      .catch(() => {
        if (!cancelled) setModelOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formPoolType]);

  function openNewForm(prefillPoolType?: string, prefillModel?: string) {
    setEditingId(null);
    setFormName(prefillModel ?? "");
    setFormPoolType(prefillPoolType ?? "");
    setFormModel(prefillModel ?? "");
    setFormRules(data?.defaults ?? EMPTY_RULES);
    setFormError(null);
    setPhase("FORM");
  }

  function openEditForm(rule: SolarRule) {
    setEditingId(rule.id);
    setFormName(rule.name);
    setFormPoolType(rule.poolType);
    setFormModel(rule.model);
    setFormRules({ ...rule.rules });
    setFormError(null);
    setPhase("FORM");
  }

  function backToList() {
    setPhase("LIST");
    setEditingId(null);
    setFormError(null);
  }

  function validateForm(): string | null {
    if (!formName.trim()) return "Nome eh obrigatorio.";
    if (!formPoolType.trim()) return "Tipo de produto eh obrigatorio.";
    if (!formModel.trim()) return "Modelo eh obrigatorio.";
    if (formRules.minColetoresPorBateria > formRules.maxColetoresPorBateria) {
      return "MIN coletores nao pode ser maior que MAX.";
    }
    if (formRules.minColetoresPorBateria < 1 || formRules.minColetoresPorBateria > 10) {
      return "MIN coletores deve estar entre 1 e 10.";
    }
    if (formRules.maxColetoresPorBateria < 1 || formRules.maxColetoresPorBateria > 10) {
      return "MAX coletores deve estar entre 1 e 10.";
    }
    if (formRules.maxAreaPorBateriaM2 < 10 || formRules.maxAreaPorBateriaM2 > 50) {
      return "MAX area por bateria deve estar entre 10 e 50 m².";
    }
    if (formRules.maxBateriasEmSerie < 1 || formRules.maxBateriasEmSerie > 5) {
      return "MAX baterias em serie deve estar entre 1 e 5.";
    }
    if (formRules.vazaoProjetoLhPorM2 < 150 || formRules.vazaoProjetoLhPorM2 > 400) {
      return "Vazao de projeto deve estar entre 150 e 400 L/h/m².";
    }
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formName.trim(),
        poolType: formPoolType.trim(),
        model: formModel.trim(),
        rules: formRules,
      };
      if (editingId) {
        await api.put(`/pool-budgets/solar-rules/${editingId}`, payload);
        toast("Regra atualizada.", "success");
      } else {
        await api.post("/pool-budgets/solar-rules", payload);
        toast("Regra cadastrada.", "success");
      }
      backToList();
      await reload();
      onChanged?.();
    } catch (err: any) {
      setFormError(err?.message ?? "Erro ao salvar regra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: SolarRule) {
    if (!confirm(`Excluir a regra "${rule.name}"? Os ${rule.productCount} produto(s) vinculados passarao a usar os padroes do sistema.`)) {
      return;
    }
    try {
      await api.del(`/pool-budgets/solar-rules/${rule.id}`);
      toast("Regra excluida.", "success");
      await reload();
      onChanged?.();
    } catch (err: any) {
      toast(err?.message ?? "Erro ao excluir", "error");
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {phase === "LIST" ? "Regras Solares" : editingId ? "Editar Regra" : "Nova Regra"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {phase === "LIST"
                ? "Cada regra aplica a um modelo de coletor especifico (1 modelo por regra)."
                : "Defina como o sistema dimensiona baterias e vazao para este modelo."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === "LIST" ? (
            <ListView
              loading={loading}
              data={data}
              onNew={() => openNewForm()}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onNewFromUncovered={(u) => openNewForm(u.poolType, u.model)}
            />
          ) : (
            <FormView
              poolTypes={poolTypes}
              modelOptions={modelOptions}
              loadingModels={loadingModels}
              formName={formName}
              setFormName={setFormName}
              formPoolType={formPoolType}
              setFormPoolType={(v) => {
                setFormPoolType(v);
                if (formModel && !modelOptions.find((m) => m.model === formModel)) {
                  setFormModel("");
                }
              }}
              formModel={formModel}
              setFormModel={setFormModel}
              formRules={formRules}
              setFormRules={setFormRules}
              defaults={data?.defaults ?? EMPTY_RULES}
              formError={formError}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
          {phase === "LIST" ? (
            <>
              <p className="text-xs text-slate-500">
                {data?.uncovered.length
                  ? `${data.uncovered.length} modelo(s) sem regra cadastrada.`
                  : "Todos os modelos cadastrados tem regra."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Fechar
                </button>
                <button
                  onClick={() => openNewForm()}
                  className="px-3 py-1.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
                >
                  + Nova regra
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={backToList}
                className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                ← Voltar
              </button>
              <div className="flex gap-2">
                <button
                  onClick={backToList}
                  className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Cadastrar regra"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── List view ────────────────────────────────────────────────── */

function ListView({
  loading,
  data,
  onNew,
  onEdit,
  onDelete,
  onNewFromUncovered,
}: {
  loading: boolean;
  data: ListResponse | null;
  onNew: () => void;
  onEdit: (rule: SolarRule) => void;
  onDelete: (rule: SolarRule) => void;
  onNewFromUncovered: (u: UncoveredEntry) => void;
}) {
  if (loading && !data) {
    return <p className="text-sm text-slate-500 text-center py-8">Carregando...</p>;
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">Nenhuma regra cadastrada ainda.</p>
          <p className="text-xs text-slate-500 mt-1">
            Sistema usa padroes internos: MIN {data.defaults.minColetoresPorBateria} · MAX{" "}
            {data.defaults.maxColetoresPorBateria} · MAX {data.defaults.maxAreaPorBateriaM2}m² ·{" "}
            {data.defaults.maxBateriasEmSerie} em serie · vazao {data.defaults.vazaoProjetoLhPorM2} L/h/m².
          </p>
          <button
            onClick={onNew}
            className="mt-4 px-3 py-1.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
          >
            Cadastrar primeira regra
          </button>
        </div>
      ) : (
        data.rules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800">{rule.name}</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-medium">{rule.poolType}</span>
                  <span className="text-slate-400"> · </span>
                  <span>{rule.model}</span>
                  <span className="text-slate-400"> · </span>
                  <span>{rule.productCount} produto{rule.productCount === 1 ? "" : "s"}</span>
                </p>
                <div className="grid grid-cols-5 gap-2 mt-2 text-[11px] text-slate-700">
                  <Cell label="MIN col" value={`${rule.rules.minColetoresPorBateria} un`} />
                  <Cell label="MAX col" value={`${rule.rules.maxColetoresPorBateria} un`} />
                  <Cell label="MAX area" value={`${rule.rules.maxAreaPorBateriaM2} m²`} />
                  <Cell label="MAX serie" value={`${rule.rules.maxBateriasEmSerie} un`} />
                  <Cell label="Vazao" value={`${rule.rules.vazaoProjetoLhPorM2} L/h/m²`} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onEdit(rule)}
                  className="px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(rule)}
                  className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {data.uncovered.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-5">
          <h4 className="text-xs font-semibold text-amber-900 mb-2">
            Modelos sem regra cadastrada — usam padroes do sistema
          </h4>
          <div className="space-y-1.5">
            {data.uncovered.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-amber-900">
                  <span className="font-medium">{u.poolType}</span>
                  <span className="text-amber-700"> · </span>
                  <span>{u.model}</span>
                  <span className="text-amber-700"> · </span>
                  <span>{u.productCount} produto{u.productCount === 1 ? "" : "s"}</span>
                </span>
                <button
                  onClick={() => onNewFromUncovered(u)}
                  className="px-2 py-0.5 text-[11px] font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded"
                >
                  Cadastrar regra
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded px-2 py-1">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}

/* ── Form view ────────────────────────────────────────────────── */

function FormView({
  poolTypes,
  modelOptions,
  loadingModels,
  formName,
  setFormName,
  formPoolType,
  setFormPoolType,
  formModel,
  setFormModel,
  formRules,
  setFormRules,
  defaults,
  formError,
}: {
  poolTypes: string[];
  modelOptions: ModelOption[];
  loadingModels: boolean;
  formName: string;
  setFormName: (v: string) => void;
  formPoolType: string;
  setFormPoolType: (v: string) => void;
  formModel: string;
  setFormModel: (v: string) => void;
  formRules: SolarRulesValues;
  setFormRules: (v: SolarRulesValues) => void;
  defaults: SolarRulesValues;
  formError: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Aviso explicativo — pre-requisitos do cadastro */}
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-[11px] text-slate-700 leading-relaxed">
        <div className="font-semibold text-cyan-900 mb-1 flex items-center gap-1.5">
          <span>Como esta regra vai funcionar</span>
        </div>
        <p>
          A regra so e aplicada quando um coletor selecionado no Simulador tem <strong>Tipo</strong> e{" "}
          <strong>Modelo</strong> exatamente iguais aos cadastrados abaixo.
        </p>
        <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-slate-600">
          <li>
            <strong>Tipo</strong> e <strong>Modelo</strong> sao campos do cadastro do produto (Cadastros &gt;
            Produtos &gt; aba Piscina).
          </li>
          <li>
            O <strong>Modelo</strong> agrupa varios tamanhos de uma mesma linha tecnica — ex: "Tropicos"
            cobre Tropicos 2,24m², 3,36m², 4,48m², etc.
          </li>
          <li>
            Se o modelo desejado nao aparece no dropdown abaixo, e porque <strong>nenhum produto</strong>{" "}
            deste tipo esta cadastrado com esse modelo. Volte no cadastro do produto e preencha.
          </li>
        </ul>
      </div>

      {/* Identificacao */}
      <div className="space-y-3">
        <Field
          label="Nome da regra"
          hint="Nome livre pra voce identificar a regra. Sugestao: use o nome do modelo (ex: 'Tropicos')."
        >
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="ex: Tropicos"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
            maxLength={80}
          />
        </Field>

        <Field
          label="Tipo de produto"
          hint="Filtrado para mostrar apenas tipos relevantes a coletores solares (segue a regra de auto-selecao do coletor configurada em Configuracoes Avancadas). Se vazio, nenhum produto do tenant casa com o filtro — cadastre coletores ou ajuste a regra de auto-selecao."
        >
          <select
            value={formPoolType}
            onChange={(e) => setFormPoolType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none bg-white"
          >
            <option value="">— Selecione —</option>
            {poolTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {poolTypes.length === 0 && (
            <p className="text-[10px] text-amber-700 mt-1">
              Nenhum tipo encontrado. Cadastre um coletor solar no catalogo (Cadastros &gt; Produtos)
              preenchendo <strong>Tipo (poolType)</strong> e <strong>Modelo</strong>.
            </p>
          )}
        </Field>

        <Field
          label="Modelo"
          hint="Modelos distintos cadastrados nos produtos deste tipo. Cada produto contribui com seu valor do campo Modelo. Se o que voce procura nao aparece: ou nao existe produto desse modelo, ou o campo Modelo esta vazio no cadastro."
        >
          <select
            value={formModel}
            onChange={(e) => setFormModel(e.target.value)}
            disabled={!formPoolType || loadingModels}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none bg-white disabled:bg-slate-50"
          >
            <option value="">— Selecione —</option>
            {modelOptions.map((m) => (
              <option key={m.model} value={m.model}>
                {m.model} ({m.productCount} produto{m.productCount === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          {formPoolType && !loadingModels && modelOptions.length === 0 && (
            <p className="text-[10px] text-amber-700 mt-1">
              Nenhum produto deste tipo tem o campo <strong>Modelo</strong> preenchido. Va em
              Cadastros &gt; Produtos, edite os coletores e preencha o campo Modelo (ex: "Tropicos").
            </p>
          )}
          {!formPoolType && (
            <p className="text-[10px] text-slate-500 mt-1">Selecione o tipo primeiro.</p>
          )}
        </Field>
      </div>

      {/* Regras de dimensionamento */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Regras de dimensionamento
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="MIN coletores por bateria"
            unit="un"
            value={formRules.minColetoresPorBateria}
            onChange={(v) => setFormRules({ ...formRules, minColetoresPorBateria: v })}
            min={1}
            max={10}
            defaultValue={defaults.minColetoresPorBateria}
          />
          <NumField
            label="MAX coletores por bateria"
            unit="un"
            value={formRules.maxColetoresPorBateria}
            onChange={(v) => setFormRules({ ...formRules, maxColetoresPorBateria: v })}
            min={1}
            max={10}
            defaultValue={defaults.maxColetoresPorBateria}
          />
        </div>

        <NumField
          label="MAX area por bateria"
          unit="m²"
          value={formRules.maxAreaPorBateriaM2}
          onChange={(v) => setFormRules({ ...formRules, maxAreaPorBateriaM2: v })}
          min={10}
          max={50}
          defaultValue={defaults.maxAreaPorBateriaM2}
        />

        <NumField
          label="MAX baterias em serie"
          unit="un"
          value={formRules.maxBateriasEmSerie}
          onChange={(v) => setFormRules({ ...formRules, maxBateriasEmSerie: v })}
          min={1}
          max={5}
          defaultValue={defaults.maxBateriasEmSerie}
        />

        <NumField
          label="Vazao de projeto"
          unit="L/h por m² de coletor"
          value={formRules.vazaoProjetoLhPorM2}
          onChange={(v) => setFormRules({ ...formRules, vazaoProjetoLhPorM2: v })}
          min={150}
          max={400}
          defaultValue={defaults.vazaoProjetoLhPorM2}
        />
      </div>

      {formError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {formError}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
        <span>{label}</span>
        {hint && <HelpHint text={hint} tone="cyan" width={320} />}
      </label>
      {children}
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  defaultValue,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  defaultValue: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        <span className="text-[10px] text-slate-500 font-normal ml-1">
          ({min}–{max}, padrao {defaultValue})
        </span>
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Number.isFinite(v) ? Math.round(v) : 0);
          }}
          min={min}
          max={max}
          step={1}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:border-cyan-500 focus:outline-none"
        />
        <span className="text-xs text-slate-600">{unit}</span>
      </div>
    </div>
  );
}
