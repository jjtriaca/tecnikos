'use client';

import { useState } from 'react';
import type {
  StageConfig, FormFieldDef, PhotoRequirementGroup, TechQuestionOption, ArrivalTimeOption,
  TECH_ACTION_LABELS as TechLabelsType,
  AUTO_ACTION_LABELS as AutoLabelsType,
  TIME_CONTROL_LABELS as TimeLabelsType,
} from '@/types/stage-config';
import {
  TECH_ACTION_LABELS, AUTO_ACTION_LABELS, TIME_CONTROL_LABELS,
  CHANNEL_OPTIONS, SEVERITY_OPTIONS, STRATEGY_OPTIONS,
  PHOTO_TYPE_OPTIONS, PHOTO_MOMENT_OPTIONS, TRIGGER_CONDITIONS, TIMEOUT_ACTIONS,
  NOTIFY_VARS, TECH_SELECTION_METHODS, ON_TIMEOUT_OPTIONS,
  LINK_PAGE_FIELDS, QUESTION_ACTIONS, ON_DECLINE_OPTIONS,
  KEEP_ACTIVE_OPTIONS, PAUSE_REASON_CATEGORIES,
  FINANCIAL_ENTRY_TYPES, FINANCIAL_VALUE_SOURCES,
  GESTOR_REJECT_ACTIONS, COMMISSION_ADJUSTMENT_TYPES,
} from '@/types/stage-config';
import type { FinancialEntryConfig } from '@/types/stage-config';

/* ── Props ─────────────────────────────────────────────────── */

interface StageSectionProps {
  stage: StageConfig;
  index: number;
  onChange: (stage: StageConfig) => void;
  allStages?: StageConfig[];
}

/* ── Helpers ───────────────────────────────────────────────── */

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-200 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

function SubToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-200 h-3.5 w-3.5" />
      <span className="text-xs text-slate-600">{label}</span>
    </label>
  );
}

function ConfigRow({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  if (!visible) return null;
  return <div className="ml-13 pl-3 border-l-2 border-blue-100 mt-2 space-y-2 animate-fadeIn">{children}</div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-slate-500 whitespace-nowrap">{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange, min, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; suffix?: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-slate-500 whitespace-nowrap">{label}:</span>
      <input type="number" value={value} min={min ?? 1} onChange={e => onChange(parseInt(e.target.value) || 0)} className="text-xs rounded border border-slate-300 px-2 py-1 w-20 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}:</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder, vars }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; vars?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}:</span>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-none" />
      {vars && (
        <div className="flex flex-wrap gap-1 mt-1">
          {NOTIFY_VARS.map(v => (
            <button key={v.var} type="button" onClick={() => onChange(value + v.var)} title={v.label}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">
              {v.var}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

/* ── Listas dinâmicas ──────────────────────────────────────── */

function ItemList({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, val: string) => onChange(items.map((item, idx) => idx === i ? val : item));

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
          <input type="text" value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
            className="flex-1 text-xs rounded border border-slate-300 px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-0.5 text-xs">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Adicionar item</button>
    </div>
  );
}

function FormFieldList({ fields, onChange }: { fields: FormFieldDef[]; onChange: (fields: FormFieldDef[]) => void }) {
  const add = () => onChange([...fields, { name: '', type: 'text', required: false }]);
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<FormFieldDef>) => onChange(fields.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  return (
    <div className="space-y-1.5">
      {fields.map((field, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input type="text" value={field.name} onChange={e => update(i, { name: e.target.value })} placeholder="Nome do campo"
            className="flex-1 text-xs rounded border border-slate-300 px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
          <select value={field.type} onChange={e => update(i, { type: e.target.value as FormFieldDef['type'] })}
            className="text-xs rounded border border-slate-300 px-1 py-1 bg-white">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="select">Seleção</option>
          </select>
          <SubToggle checked={field.required} onChange={v => update(i, { required: v })} label="Obrig." />
          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-0.5 text-xs">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Adicionar campo</button>
    </div>
  );
}

/* ── Photo Requirements list ──────────────────────────────── */

function PhotoRequirementList({ groups, onChange }: { groups: PhotoRequirementGroup[]; onChange: (groups: PhotoRequirementGroup[]) => void }) {
  const add = () => onChange([...groups, {
    id: `pr_${Date.now().toString(36)}`,
    moment: 'general',
    minPhotos: 1,
    maxPhotos: 0,
    label: '',
    instructions: '',
    required: true,
  }]);
  const remove = (i: number) => onChange(groups.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<PhotoRequirementGroup>) => onChange(groups.map((g, idx) => idx === i ? { ...g, ...patch } : g));

  const momentLabel = (moment: string) => PHOTO_MOMENT_OPTIONS.find(o => o.value === moment)?.label || moment;
  const isPauseRelated = (moment: string) => moment === 'on_pause' || moment === 'on_resume';

  return (
    <div className="space-y-3">
      {groups.map((group, i) => (
        <div key={group.id} className={`rounded-lg border p-3 space-y-2 ${isPauseRelated(group.moment) ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              {i + 1}. {group.label || momentLabel(group.moment)}
            </span>
            <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-0.5 text-xs" title="Remover grupo">✕</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Momento:</span>
              <select value={group.moment} onChange={e => update(i, { moment: e.target.value })}
                className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none">
                {PHOTO_MOMENT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <NumberField label="Mín. fotos" value={group.minPhotos} onChange={v => update(i, { minPhotos: v })} min={0} />
            <NumberField label="Máx. fotos" value={group.maxPhotos} onChange={v => update(i, { maxPhotos: v })} min={0} suffix="(0=ilimitado)" />
          </div>
          {isPauseRelated(group.moment) && (
            <p className="text-[10px] text-blue-600 bg-blue-100/50 rounded px-2 py-1">
              ℹ️ Estas fotos serão exigidas quando o técnico pausar/retomar o atendimento (requer Sistema de Pausas ativado no Controle de Tempo).
            </p>
          )}
          <TextField label="Rótulo" value={group.label} onChange={v => update(i, { label: v })} placeholder="Ex: Foto antes do serviço" />
          <TextField label="Instruções para o técnico" value={group.instructions} onChange={v => update(i, { instructions: v })} placeholder="Ex: Tire fotos do equipamento de frente e de lado" />
          <SubToggle checked={group.required} onChange={v => update(i, { required: v })} label="Obrigatório (bloqueia prosseguir sem fotos)" />
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
        + Adicionar grupo de fotos
      </button>
      {groups.length === 0 && (
        <p className="text-[10px] text-slate-400 italic">Nenhum grupo configurado. Clique para adicionar.</p>
      )}
    </div>
  );
}

/* ── Conflict Warning ──────────────────────────────────────── */

function ConflictWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-xs text-amber-800">
      <span className="shrink-0">⚠️</span>
      <span>{message}</span>
    </div>
  );
}

/* ── WhatsApp Cost Warning ────────────────────────────────── */

function WhatsAppCostWarning({ channel }: { channel: string }) {
  if (channel !== 'whatsapp') return null;
  return (
    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 flex items-center gap-1">
      <span>💰</span> Notificações WhatsApp têm custo por mensagem. Use com critério para evitar gastos desnecessários.
    </p>
  );
}

/* ── Section header ────────────────────────────────────────── */

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-4">
      <span className="text-sm">{icon}</span>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

/* ── Main component ────────────────────────────────────────── */

export default function StageSection({ stage, index, onChange, allStages }: StageSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const update = (patch: Partial<StageConfig>) => onChange({ ...stage, ...patch });
  const updateTech = (key: string, patch: any) => onChange({
    ...stage,
    techActions: { ...stage.techActions, [key]: { ...stage.techActions[key as keyof typeof stage.techActions], ...patch } },
  });
  const updateChecklistCls = (cls: 'toolsPpe' | 'materials' | 'initialCheck' | 'finalCheck', patch: any) => onChange({
    ...stage,
    techActions: { ...stage.techActions, checklistConfig: { ...stage.techActions.checklistConfig, [cls]: { ...stage.techActions.checklistConfig[cls], ...patch } } },
  });
  const updateAuto = (key: string, patch: any) => onChange({
    ...stage,
    autoActions: { ...stage.autoActions, [key]: { ...stage.autoActions[key as keyof typeof stage.autoActions], ...patch } },
  });
  const updateTime = (key: string, patch: any) => onChange({
    ...stage,
    timeControl: { ...stage.timeControl, [key]: { ...stage.timeControl[key as keyof typeof stage.timeControl], ...patch } },
  });

  const enabledCount =
    Object.values(stage.techActions).filter(a => a.enabled).length +
    Object.values(stage.autoActions).filter(a => a.enabled).length +
    Object.values(stage.timeControl).filter(a => a.enabled).length;

  // Cross-stage conflict detection
  const abertaStage = allStages?.find(s => s.status === 'ABERTA');
  const atribuidaStage = allStages?.find(s => s.status === 'ATRIBUIDA');
  const execucaoStage = allStages?.find(s => s.status === 'EM_EXECUCAO');
  const scheduleActive = abertaStage?.autoActions.scheduleConfig?.enabled ?? false;
  const scheduleNotifiesTech = scheduleActive && (abertaStage?.autoActions.scheduleConfig?.notifyTechnician?.enabled ?? false);

  return (
    <div className={`rounded-xl border-2 transition-all ${stage.enabled ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        {/* Left side — click to expand/collapse */}
        <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={() => stage.enabled && setExpanded(!expanded)}>
          <span className={`text-xs text-slate-400 transition-transform ${stage.enabled && expanded ? 'rotate-90' : ''}`}>
            {stage.enabled ? '▶' : ''}
          </span>
          <span className="text-lg">{stage.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">
              {stage.label}
            </h3>
            <p className="text-xs text-slate-400">{stage.status.replace('_', ' ')}</p>
          </div>
          {stage.enabled && enabledCount > 0 && (
            <span className="ml-2 shrink-0 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {enabledCount} {enabledCount === 1 ? 'ação' : 'ações'}
            </span>
          )}
          {stage.enabled && !expanded && enabledCount > 0 && (
            <span className="text-[10px] text-slate-400 hidden sm:inline">— clique para expandir</span>
          )}
        </div>
        {/* Right side — toggle on/off */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium ${stage.enabled ? 'text-blue-600' : 'text-slate-400'}`}>
            {stage.enabled ? 'Ativo' : 'Desativado'}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={stage.enabled} onChange={e => {
              const enabling = e.target.checked;
              update({ enabled: enabling });
              if (enabling) setExpanded(true);
            }} className="sr-only peer" />
            <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
          </label>
        </div>
      </div>

      {/* Disabled hint */}
      {!stage.enabled && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-400 italic">Etapa desativada — ative o toggle para configurar</p>
        </div>
      )}

      {/* Enabled but minimized */}
      {stage.enabled && !expanded && (
        <div className="px-4 pb-3 cursor-pointer" onClick={() => setExpanded(true)}>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stage.autoActions).filter(([, a]) => a.enabled).map(([key]) => (
              <span key={key} className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                ⚡ {(AUTO_ACTION_LABELS as any)[key]?.label || key}
              </span>
            ))}
            {Object.entries(stage.techActions).filter(([, a]) => a.enabled).map(([key]) => (
              <span key={key} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                👷 {(TECH_ACTION_LABELS as any)[key]?.label || key}
              </span>
            ))}
            {Object.entries(stage.timeControl).filter(([, a]) => a.enabled).map(([key]) => (
              <span key={key} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                ⏱️ {(TIME_CONTROL_LABELS as any)[key]?.label || key}
              </span>
            ))}
            {enabledCount === 0 && (
              <span className="text-xs text-slate-400 italic">Nenhuma ação configurada — clique para expandir</span>
            )}
          </div>
        </div>
      )}

      {/* Expanded — full config */}
      {stage.enabled && expanded && (
        <div className="px-4 pb-5 space-y-1">

          {/* ── AÇÕES AUTOMÁTICAS ── */}
          <SectionLabel icon="⚡" title="Ações Automáticas" />
          <div className="space-y-3">

            {/* ═══ ABERTA — Regime + Seleção de Técnicos + Despacho ═══ */}
            {stage.status === 'ABERTA' && (
              <>
                {/* ── 1. REGIME DE ATENDIMENTO ── */}
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3">
                  <Toggle checked={stage.autoActions.scheduleConfig.enabled}
                    onChange={v => updateAuto('scheduleConfig', { enabled: v })}
                    label="📅 Regime de Agenda (CLT)"
                    hint="Ativa despacho por agenda — ao criar OS com este fluxo, o operador escolhe técnico, data e horário no calendário." />
                  <ConfigRow visible={stage.autoActions.scheduleConfig.enabled}>
                    <div className="space-y-3">
                      {/* Notificação do técnico */}
                      <div>
                        <SubToggle checked={stage.autoActions.scheduleConfig.notifyTechnician.enabled}
                          onChange={v => updateAuto('scheduleConfig', { notifyTechnician: { ...stage.autoActions.scheduleConfig.notifyTechnician, enabled: v } })}
                          label="Notificar técnico sobre agendamento" />
                        {stage.autoActions.scheduleConfig.notifyTechnician.enabled && (
                          <div className="ml-5 mt-2 space-y-2">
                            <SelectField label="Canal" value={stage.autoActions.scheduleConfig.notifyTechnician.channel}
                              onChange={v => updateAuto('scheduleConfig', { notifyTechnician: { ...stage.autoActions.scheduleConfig.notifyTechnician, channel: v } })}
                              options={CHANNEL_OPTIONS} />
                            <NumberField label="Notificar antes" value={stage.autoActions.scheduleConfig.notifyTechnician.minutesBefore}
                              onChange={v => updateAuto('scheduleConfig', { notifyTechnician: { ...stage.autoActions.scheduleConfig.notifyTechnician, minutesBefore: v } })}
                              min={0} suffix="min (0 = ao agendar)" />
                            <TextAreaField label="Mensagem" value={stage.autoActions.scheduleConfig.notifyTechnician.message}
                              onChange={v => updateAuto('scheduleConfig', { notifyTechnician: { ...stage.autoActions.scheduleConfig.notifyTechnician, message: v } })}
                              placeholder="{nome}, você tem um serviço agendado para {data_agendamento} às {hora_agendamento}..." vars />
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400 italic mt-1">
                        💡 Quando ativo, ao criar OS com este fluxo o operador escolhe técnico + data/hora.
                        A OS já nasce como &quot;Atribuída&quot; (pula Aberta → Ofertada).
                      </p>
                    </div>
                  </ConfigRow>
                </div>

                {/* ── 2. SELEÇÃO DE TÉCNICOS (método + limite) ── */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <Toggle checked={stage.autoActions.techSelection.enabled}
                    onChange={v => updateAuto('techSelection', { enabled: v })}
                    label="Seleção de técnicos"
                    hint="Define como os técnicos serão filtrados e ordenados para receber a OS (por avaliação, proximidade, etc.)" />
                  {stage.autoActions.techSelection.enabled && scheduleActive && (
                    <ConflictWarning message="O Regime de Agenda está ativo — o técnico é escolhido manualmente na agenda. A seleção automática não será utilizada." />
                  )}
                  <ConfigRow visible={stage.autoActions.techSelection.enabled}>
                    <div className="space-y-2.5">
                      <div>
                        <span className="text-xs font-medium text-slate-600 block mb-2">Método de seleção:</span>
                        <div className="space-y-1.5">
                          {TECH_SELECTION_METHODS.map(m => (
                            <label key={m.value} className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-colors">
                              <input type="radio" name={`${stage.id}_techMethod`}
                                checked={stage.autoActions.techSelection.method === m.value}
                                onChange={() => updateAuto('techSelection', { method: m.value })}
                                className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                              <div>
                                <span className="text-xs font-medium text-slate-700">{m.label}</span>
                                <p className="text-[10px] text-slate-400">{m.hint}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="pt-1 border-t border-slate-200 space-y-2">
                        <NumberField label="Máx. de técnicos" value={stage.autoActions.techSelection.maxTechnicians}
                          onChange={v => updateAuto('techSelection', { maxTechnicians: v })} />
                        <SubToggle checked={stage.autoActions.techSelection.discardBusyTechnicians}
                          onChange={v => updateAuto('techSelection', { discardBusyTechnicians: v })}
                          label="Descartar técnicos que estão em atendimento" />
                        <p className="text-[10px] text-slate-400 ml-5 -mt-1">Técnicos ocupados dentro do prazo de aceitar não receberão a oferta.</p>
                      </div>
                      <p className="text-[10px] text-slate-400 italic mt-1">
                        💡 O tempo para aceitar e o comportamento ao expirar são configurados na etapa &quot;Ofertada&quot;.
                        O tempo para ir a caminho é configurado na etapa &quot;Atribuída&quot;.
                      </p>
                    </div>
                  </ConfigRow>
                </div>

                {/* ── 1b. TELA DE REVISÃO DOS TÉCNICOS ── */}
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3">
                  <Toggle checked={stage.autoActions.techReviewScreen.enabled}
                    onChange={v => updateAuto('techReviewScreen', { enabled: v })}
                    label="👁️ Tela de revisão dos técnicos"
                    hint="Exibe uma tela para o operador conferir e editar a lista de técnicos antes de disparar as mensagens" />
                  {stage.autoActions.techReviewScreen.enabled && scheduleActive && (
                    <ConflictWarning message="O Regime de Agenda está ativo — o técnico é escolhido na agenda, a tela de revisão não será exibida." />
                  )}
                  <ConfigRow visible={stage.autoActions.techReviewScreen.enabled}>
                    <div className="space-y-2">
                      <SubToggle checked={stage.autoActions.techReviewScreen.allowEdit}
                        onChange={v => updateAuto('techReviewScreen', { allowEdit: v })}
                        label="Permitir editar a lista de técnicos" />
                      <p className="text-[10px] text-slate-400 ml-5 -mt-1">
                        Quando ativado, o despacho pode incluir ou excluir técnicos da lista antes de confirmar o envio.
                      </p>
                    </div>
                  </ConfigRow>
                </div>

                {/* ── 2. DISPARO DE MENSAGENS ── */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <Toggle checked={stage.autoActions.messageDispatch.enabled}
                    onChange={v => updateAuto('messageDispatch', { enabled: v })}
                    label="Disparo de mensagens"
                    hint="Mensagens enviadas automaticamente quando a OS é criada. Configure canal, texto e link para técnicos, gestor e cliente." />
                  {stage.autoActions.messageDispatch.enabled && scheduleActive && (
                    <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700">
                      <span className="shrink-0">ℹ️</span>
                      <span>O Regime de Agenda está ativo — a OS nasce como Atribuída, mas as mensagens serão disparadas normalmente (o sistema usa fallback automático).</span>
                    </div>
                  )}
                  <ConfigRow visible={stage.autoActions.messageDispatch.enabled}>
                    <div className="space-y-3">
                      {/* Mensagem para técnicos */}
                      <div className="rounded border border-blue-100 bg-blue-50/30 p-2.5">
                        <SubToggle checked={stage.autoActions.messageDispatch.toTechnicians.enabled}
                          onChange={v => updateAuto('messageDispatch', { toTechnicians: { ...stage.autoActions.messageDispatch.toTechnicians, enabled: v } })}
                          label="👷 Mensagem para técnicos selecionados" />
                        {stage.autoActions.messageDispatch.toTechnicians.enabled && (
                          <div className="mt-2 ml-5 space-y-2">
                            <SelectField label="Canal" value={stage.autoActions.messageDispatch.toTechnicians.channel}
                              onChange={v => updateAuto('messageDispatch', { toTechnicians: { ...stage.autoActions.messageDispatch.toTechnicians, channel: v } })}
                              options={CHANNEL_OPTIONS} />
                            <WhatsAppCostWarning channel={stage.autoActions.messageDispatch.toTechnicians.channel} />
                            <TextAreaField label="Mensagem" value={stage.autoActions.messageDispatch.toTechnicians.message}
                              onChange={v => updateAuto('messageDispatch', { toTechnicians: { ...stage.autoActions.messageDispatch.toTechnicians, message: v } })}
                              placeholder="Olá {tecnico}, você recebeu uma nova OS: {titulo}. Endereço: {endereco}, {cidade}." vars />

                            {/* ── LINK PARA OS TÉCNICOS ── */}
                            <div className="rounded border border-blue-200 bg-blue-50/50 p-2.5 mt-2">
                              <SubToggle
                                checked={stage.autoActions.messageDispatch.toTechnicians.link.enabled}
                                onChange={v => updateAuto('messageDispatch', {
                                  toTechnicians: { ...stage.autoActions.messageDispatch.toTechnicians,
                                    link: { ...stage.autoActions.messageDispatch.toTechnicians.link, enabled: v } }
                                })}
                                label="🔗 Incluir link na mensagem" />
                              {stage.autoActions.messageDispatch.toTechnicians.link.enabled && (() => {
                                const lnk = stage.autoActions.messageDispatch.toTechnicians.link;
                                const updateLink = (patch: any) => updateAuto('messageDispatch', {
                                  toTechnicians: { ...stage.autoActions.messageDispatch.toTechnicians,
                                    link: { ...lnk, ...patch } }
                                });
                                return (
                                <div className="mt-2 ml-5 space-y-3">
                                  {/* ── VALIDADE ── */}
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-3">
                                      <NumberField label="Validade do link" value={lnk.validityHours}
                                        onChange={v => updateLink({ validityHours: v })} suffix="horas" />
                                    </div>
                                    {scheduleActive && (
                                      <div className="flex flex-wrap gap-3 items-center">
                                        <span className="text-xs text-slate-500">📅 Modo agenda:</span>
                                        <span className="text-[10px] text-slate-400">até a data agendada +</span>
                                        <NumberField label="" value={lnk.agendaMarginHours}
                                          onChange={v => updateLink({ agendaMarginHours: v })} suffix="horas de margem" />
                                      </div>
                                    )}
                                  </div>

                                  {/* ── PÁGINA 1 — OFERTA ── */}
                                  <div className="pt-2 border-t border-blue-200">
                                    <span className="text-xs font-bold text-slate-600 block mb-2">📄 Página 1 — Oferta</span>
                                    <p className="text-[10px] text-slate-400 mb-2">O técnico abre o link e vê os detalhes da OS.</p>

                                    {/* Layout da página */}
                                    <div className="mb-3">
                                      <span className="text-xs font-medium text-slate-500 block mb-1.5">Layout:</span>
                                      <div className="space-y-1">
                                        {lnk.pageLayout.map((block, bi) => (
                                          <div key={block.id} className={`flex items-center gap-2 p-1.5 rounded border transition-colors ${block.enabled ? 'border-blue-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                                            <div className="flex flex-col gap-0.5">
                                              <button type="button" disabled={bi === 0}
                                                onClick={() => {
                                                  const layout = [...lnk.pageLayout];
                                                  [layout[bi - 1], layout[bi]] = [layout[bi], layout[bi - 1]];
                                                  updateLink({ pageLayout: layout });
                                                }}
                                                className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30">▲</button>
                                              <button type="button" disabled={bi === lnk.pageLayout.length - 1}
                                                onClick={() => {
                                                  const layout = [...lnk.pageLayout];
                                                  [layout[bi], layout[bi + 1]] = [layout[bi + 1], layout[bi]];
                                                  updateLink({ pageLayout: layout });
                                                }}
                                                className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30">▼</button>
                                            </div>
                                            <input type="checkbox" checked={block.enabled}
                                              onChange={e => {
                                                const layout = [...lnk.pageLayout];
                                                layout[bi] = { ...layout[bi], enabled: e.target.checked };
                                                updateLink({ pageLayout: layout });
                                              }}
                                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-200 h-3.5 w-3.5" />
                                            <span className="text-xs">
                                              {block.type === 'info'
                                                ? (LINK_PAGE_FIELDS.find(f => f.field === block.field)?.icon || '📋')
                                                : '✏️'}
                                            </span>
                                            {block.type === 'info' ? (
                                              <span className="text-xs text-slate-700 flex-1">{block.label}</span>
                                            ) : (
                                              <div className="flex-1 flex flex-col gap-1">
                                                <span className="text-xs font-medium text-slate-600">{block.label}</span>
                                                {block.enabled && (
                                                  <input type="text" value={block.content || ''} placeholder="Digite o texto com {variáveis}..."
                                                    onChange={e => {
                                                      const layout = [...lnk.pageLayout];
                                                      layout[bi] = { ...layout[bi], content: e.target.value };
                                                      updateLink({ pageLayout: layout });
                                                    }}
                                                    className="text-xs rounded border border-slate-300 px-2 py-0.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Botão aceitar */}
                                    <div className="space-y-1">
                                      <SubToggle checked={lnk.acceptOS} onChange={v => updateLink({ acceptOS: v })}
                                        label="✅ Botão &quot;Aceitar OS&quot;" />
                                      <p className="text-[10px] text-slate-400 ml-5">
                                        {lnk.acceptOS
                                          ? 'Técnico clica para aceitar. Primeiro clique trava o link para este dispositivo.'
                                          : 'Desativado — a página é informativa. GPS ou "Estou a caminho" serão mostrados aqui.'}
                                      </p>
                                      {lnk.acceptOS && (
                                        <div className="ml-5 mt-1 space-y-1.5 pl-3 border-l-2 border-green-200">
                                          <SubToggle checked={lnk.onAccept.notifyGestor.enabled}
                                            onChange={v => updateLink({ onAccept: { ...lnk.onAccept, notifyGestor: { ...lnk.onAccept.notifyGestor, enabled: v } } })}
                                            label="👔 Notificar gestor ao aceitar" />
                                          {lnk.onAccept.notifyGestor.enabled && (
                                            <div className="ml-5 space-y-1">
                                              <SelectField label="Canal" value={lnk.onAccept.notifyGestor.channel}
                                                onChange={v => updateLink({ onAccept: { ...lnk.onAccept, notifyGestor: { ...lnk.onAccept.notifyGestor, channel: v } } })}
                                                options={CHANNEL_OPTIONS} />
                                              <WhatsAppCostWarning channel={lnk.onAccept.notifyGestor.channel} />
                                              <TextAreaField label="Mensagem" value={lnk.onAccept.notifyGestor.message}
                                                onChange={v => updateLink({ onAccept: { ...lnk.onAccept, notifyGestor: { ...lnk.onAccept.notifyGestor, message: v } } })}
                                                placeholder="Ex: Técnico {tecnico} aceitou a OS {titulo}." vars />
                                            </div>
                                          )}
                                          <SubToggle checked={lnk.onAccept.notifyCliente.enabled}
                                            onChange={v => updateLink({ onAccept: { ...lnk.onAccept, notifyCliente: { ...lnk.onAccept.notifyCliente, enabled: v } } })}
                                            label="👤 Notificar cliente ao aceitar" />
                                          {lnk.onAccept.notifyCliente.enabled && (
                                            <div className="ml-5 space-y-1">
                                              <SelectField label="Canal" value={lnk.onAccept.notifyCliente.channel}
                                                onChange={v => updateLink({ onAccept: { ...lnk.onAccept, notifyCliente: { ...lnk.onAccept.notifyCliente, channel: v } } })}
                                                options={CHANNEL_OPTIONS} />
                                              <WhatsAppCostWarning channel={lnk.onAccept.notifyCliente.channel} />
                                              <TextAreaField label="Mensagem" value={lnk.onAccept.notifyCliente.message}
                                                onChange={v => updateLink({ onAccept: { ...lnk.onAccept, notifyCliente: { ...lnk.onAccept.notifyCliente, message: v } } })}
                                                placeholder="Ex: Um técnico foi designado para {titulo}." vars />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* ── PÁGINA 2 — PÓS-ACEITE (só se acceptOS ativo) ── */}
                                  {lnk.acceptOS && (
                                    <div className="pt-2 border-t border-blue-200">
                                      <span className="text-xs font-bold text-slate-600 block mb-2">📄 Página 2 — Pós-aceite</span>
                                      <p className="text-[10px] text-slate-400 mb-2">Após aceitar, o técnico vê esta página até agir.</p>
                                      <div className="space-y-3">
                                        {/* GPS button + notifications */}
                                        <div>
                                          <SubToggle checked={lnk.gpsNavigation} onChange={v => updateLink({ gpsNavigation: v })}
                                            label="📡 Botão &quot;Ativar GPS&quot;" />
                                          <p className="text-[10px] text-slate-400 ml-5 mt-0.5">Rastreamento por proximidade até o local do serviço.</p>
                                          {lnk.gpsNavigation && (
                                            <div className="ml-5 mt-1 space-y-1.5 pl-3 border-l-2 border-cyan-200">
                                              <SubToggle checked={lnk.onGps.notifyGestor.enabled}
                                                onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyGestor: { ...lnk.onGps.notifyGestor, enabled: v } } })}
                                                label="👔 Notificar gestor ao ativar GPS" />
                                              {lnk.onGps.notifyGestor.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onGps.notifyGestor.channel}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyGestor: { ...lnk.onGps.notifyGestor, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onGps.notifyGestor.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onGps.notifyGestor.message}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyGestor: { ...lnk.onGps.notifyGestor, message: v } } })}
                                                    placeholder="Ex: Técnico {tecnico} ativou GPS — a caminho de {endereco}." vars />
                                                </div>
                                              )}
                                              <SubToggle checked={lnk.onGps.notifyCliente.enabled}
                                                onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyCliente: { ...lnk.onGps.notifyCliente, enabled: v } } })}
                                                label="👤 Notificar cliente ao ativar GPS" />
                                              {lnk.onGps.notifyCliente.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onGps.notifyCliente.channel}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyCliente: { ...lnk.onGps.notifyCliente, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onGps.notifyCliente.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onGps.notifyCliente.message}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyCliente: { ...lnk.onGps.notifyCliente, message: v } } })}
                                                    placeholder="Ex: O técnico está rastreando sua localização." vars />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {/* En Route button + notifications */}
                                        <div>
                                          <SubToggle checked={lnk.enRoute} onChange={v => updateLink({ enRoute: v })}
                                            label="🚗 Botão &quot;Estou a caminho&quot;" />
                                          <p className="text-[10px] text-slate-400 ml-5 mt-0.5">Registra timestamp de partida.</p>
                                          {lnk.enRoute && (
                                            <div className="ml-5 mt-1 space-y-1.5 pl-3 border-l-2 border-orange-200">
                                              <SubToggle checked={lnk.onEnRoute.notifyGestor.enabled}
                                                onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyGestor: { ...lnk.onEnRoute.notifyGestor, enabled: v } } })}
                                                label="👔 Notificar gestor ao sair" />
                                              {lnk.onEnRoute.notifyGestor.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onEnRoute.notifyGestor.channel}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyGestor: { ...lnk.onEnRoute.notifyGestor, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onEnRoute.notifyGestor.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onEnRoute.notifyGestor.message}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyGestor: { ...lnk.onEnRoute.notifyGestor, message: v } } })}
                                                    placeholder="Ex: Técnico {tecnico} está a caminho. OS: {titulo}." vars />
                                                </div>
                                              )}
                                              <SubToggle checked={lnk.onEnRoute.notifyCliente.enabled}
                                                onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyCliente: { ...lnk.onEnRoute.notifyCliente, enabled: v } } })}
                                                label="👤 Notificar cliente ao sair" />
                                              {lnk.onEnRoute.notifyCliente.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onEnRoute.notifyCliente.channel}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyCliente: { ...lnk.onEnRoute.notifyCliente, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onEnRoute.notifyCliente.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onEnRoute.notifyCliente.message}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyCliente: { ...lnk.onEnRoute.notifyCliente, message: v } } })}
                                                    placeholder="Ex: O técnico está a caminho! OS: {titulo}." vars />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ── PÁGINA SEM ACEITE (só se acceptOS desativado) ── */}
                                  {!lnk.acceptOS && (
                                    <div className="pt-2 border-t border-blue-200">
                                      <span className="text-xs font-bold text-slate-600 block mb-2">📄 Ações na página (sem aceite)</span>
                                      <p className="text-[10px] text-slate-400 mb-2">Página informativa. O primeiro clique em qualquer botão trava o link para o dispositivo.</p>
                                      <div className="space-y-3">
                                        {/* GPS button + notifications (no-accept mode) */}
                                        <div>
                                          <SubToggle checked={lnk.gpsNavigation} onChange={v => updateLink({ gpsNavigation: v })}
                                            label="📡 Botão &quot;Ativar GPS&quot;" />
                                          <p className="text-[10px] text-slate-400 ml-5 mt-0.5">Rastreamento por proximidade até o local do serviço.</p>
                                          {lnk.gpsNavigation && (
                                            <div className="ml-5 mt-1 space-y-1.5 pl-3 border-l-2 border-cyan-200">
                                              <SubToggle checked={lnk.onGps.notifyGestor.enabled}
                                                onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyGestor: { ...lnk.onGps.notifyGestor, enabled: v } } })}
                                                label="👔 Notificar gestor ao ativar GPS" />
                                              {lnk.onGps.notifyGestor.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onGps.notifyGestor.channel}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyGestor: { ...lnk.onGps.notifyGestor, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onGps.notifyGestor.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onGps.notifyGestor.message}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyGestor: { ...lnk.onGps.notifyGestor, message: v } } })}
                                                    placeholder="Ex: Técnico {tecnico} ativou GPS." vars />
                                                </div>
                                              )}
                                              <SubToggle checked={lnk.onGps.notifyCliente.enabled}
                                                onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyCliente: { ...lnk.onGps.notifyCliente, enabled: v } } })}
                                                label="👤 Notificar cliente ao ativar GPS" />
                                              {lnk.onGps.notifyCliente.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onGps.notifyCliente.channel}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyCliente: { ...lnk.onGps.notifyCliente, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onGps.notifyCliente.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onGps.notifyCliente.message}
                                                    onChange={v => updateLink({ onGps: { ...lnk.onGps, notifyCliente: { ...lnk.onGps.notifyCliente, message: v } } })}
                                                    placeholder="Ex: O técnico está rastreando sua localização." vars />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {/* En Route button + notifications (no-accept mode) */}
                                        <div>
                                          <SubToggle checked={lnk.enRoute} onChange={v => updateLink({ enRoute: v })}
                                            label="🚗 Botão &quot;Estou a caminho&quot;" />
                                          <p className="text-[10px] text-slate-400 ml-5 mt-0.5">Registra timestamp de partida.</p>
                                          {lnk.enRoute && (
                                            <div className="ml-5 mt-1 space-y-1.5 pl-3 border-l-2 border-orange-200">
                                              <SubToggle checked={lnk.onEnRoute.notifyGestor.enabled}
                                                onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyGestor: { ...lnk.onEnRoute.notifyGestor, enabled: v } } })}
                                                label="👔 Notificar gestor ao sair" />
                                              {lnk.onEnRoute.notifyGestor.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onEnRoute.notifyGestor.channel}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyGestor: { ...lnk.onEnRoute.notifyGestor, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onEnRoute.notifyGestor.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onEnRoute.notifyGestor.message}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyGestor: { ...lnk.onEnRoute.notifyGestor, message: v } } })}
                                                    placeholder="Ex: Técnico {tecnico} está a caminho." vars />
                                                </div>
                                              )}
                                              <SubToggle checked={lnk.onEnRoute.notifyCliente.enabled}
                                                onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyCliente: { ...lnk.onEnRoute.notifyCliente, enabled: v } } })}
                                                label="👤 Notificar cliente ao sair" />
                                              {lnk.onEnRoute.notifyCliente.enabled && (
                                                <div className="ml-5 space-y-1">
                                                  <SelectField label="Canal" value={lnk.onEnRoute.notifyCliente.channel}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyCliente: { ...lnk.onEnRoute.notifyCliente, channel: v } } })}
                                                    options={CHANNEL_OPTIONS} />
                                                  <WhatsAppCostWarning channel={lnk.onEnRoute.notifyCliente.channel} />
                                                  <TextAreaField label="Mensagem" value={lnk.onEnRoute.notifyCliente.message}
                                                    onChange={v => updateLink({ onEnRoute: { ...lnk.onEnRoute, notifyCliente: { ...lnk.onEnRoute.notifyCliente, message: v } } })}
                                                    placeholder="Ex: O técnico está a caminho! OS: {titulo}." vars />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {!lnk.gpsNavigation && !lnk.enRoute && (
                                          <p className="text-[10px] text-amber-600 italic">⚠️ Nenhum botão ativado — a página será apenas leitura (sem trava de dispositivo).</p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* ── PÁGINA TRACKING (info) ── */}
                                  {lnk.gpsNavigation && (
                                    <div className="pt-2 border-t border-blue-200">
                                      <span className="text-xs font-bold text-slate-600 block mb-1">📡 Página de tracking</span>
                                      <p className="text-[10px] text-slate-400">Automática ao ativar GPS — mostra distância em tempo real, barra de proximidade e botão &quot;Cheguei no local&quot;. Configuração do raio na etapa A Caminho (Proximidade GPS).</p>
                                    </div>
                                  )}
                                </div>
                                );
                              })()}

                              {/* ── PERGUNTA PARA O TÉCNICO (dentro do link) ── */}
                              <div className="pt-3 border-t border-blue-200 mt-3">
                                <Toggle checked={stage.autoActions.techQuestion.enabled}
                                  onChange={v => {
                                    updateAuto('techQuestion', { enabled: v });
                                    if (v) {
                                      const tq = stage.autoActions.techQuestion;
                                      onChange({
                                        ...stage,
                                        autoActions: { ...stage.autoActions, techQuestion: { ...tq, enabled: true } },
                                        techActions: {
                                          ...stage.techActions,
                                          question: {
                                            enabled: true,
                                            question: tq.question,
                                            options: tq.options.map(o => o.label),
                                          },
                                        },
                                      });
                                    } else {
                                      onChange({
                                        ...stage,
                                        autoActions: { ...stage.autoActions, techQuestion: { ...stage.autoActions.techQuestion, enabled: false } },
                                        techActions: {
                                          ...stage.techActions,
                                          question: { enabled: false, question: '', options: [] },
                                        },
                                      });
                                    }
                                  }}
                                  label="❓ Pergunta para o técnico"
                                  hint="Exibe uma pergunta na página do link. O técnico responde antes de aceitar a OS. Cada opção pode disparar uma ação automática." />
                                <ConfigRow visible={stage.autoActions.techQuestion.enabled}>
                                  <div className="space-y-3">
                                    <TextField label="Pergunta" value={stage.autoActions.techQuestion.question}
                                      onChange={v => {
                                        onChange({
                                          ...stage,
                                          autoActions: { ...stage.autoActions, techQuestion: { ...stage.autoActions.techQuestion, question: v } },
                                          techActions: { ...stage.techActions, question: { ...stage.techActions.question, question: v } },
                                        });
                                      }}
                                      placeholder="Ex: Você tem disponibilidade para atender esta OS?" />

                                    <div>
                                      <span className="text-xs font-medium text-slate-600 block mb-2">Opções de resposta:</span>
                                      <div className="space-y-2">
                                        {stage.autoActions.techQuestion.options.map((opt, oi) => (
                                          <div key={oi} className="flex items-start gap-2 p-2 rounded border border-slate-200 bg-white">
                                            <span className="text-xs text-slate-400 mt-1.5 font-mono w-4">{oi + 1}.</span>
                                            <div className="flex-1 space-y-1.5">
                                              <input type="text" value={opt.label} placeholder="Texto da opção"
                                                onChange={e => {
                                                  const newOpts = [...stage.autoActions.techQuestion.options];
                                                  newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                                                  onChange({
                                                    ...stage,
                                                    autoActions: { ...stage.autoActions, techQuestion: { ...stage.autoActions.techQuestion, options: newOpts } },
                                                    techActions: { ...stage.techActions, question: { ...stage.techActions.question, options: newOpts.map(o => o.label) } },
                                                  });
                                                }}
                                                className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
                                              <SelectField label="Ação" value={opt.action}
                                                onChange={v => {
                                                  const newOpts = [...stage.autoActions.techQuestion.options];
                                                  newOpts[oi] = { ...newOpts[oi], action: v };
                                                  updateAuto('techQuestion', { options: newOpts });
                                                }}
                                                options={QUESTION_ACTIONS} />
                                            </div>
                                            <button type="button"
                                              onClick={() => {
                                                const newOpts = stage.autoActions.techQuestion.options.filter((_, i) => i !== oi);
                                                onChange({
                                                  ...stage,
                                                  autoActions: { ...stage.autoActions, techQuestion: { ...stage.autoActions.techQuestion, options: newOpts } },
                                                  techActions: { ...stage.techActions, question: { ...stage.techActions.question, options: newOpts.map(o => o.label) } },
                                                });
                                              }}
                                              className="text-red-400 hover:text-red-600 p-0.5 text-xs mt-1">✕</button>
                                          </div>
                                        ))}
                                        <button type="button"
                                          onClick={() => {
                                            const newOpt: TechQuestionOption = { label: '', action: 'none' };
                                            const newOpts = [...stage.autoActions.techQuestion.options, newOpt];
                                            onChange({
                                              ...stage,
                                              autoActions: { ...stage.autoActions, techQuestion: { ...stage.autoActions.techQuestion, options: newOpts } },
                                              techActions: { ...stage.techActions, question: { ...stage.techActions.question, options: newOpts.map(o => o.label) } },
                                            });
                                          }}
                                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Adicionar opção</button>
                                      </div>
                                    </div>

                                    <SubToggle checked={stage.autoActions.techQuestion.required}
                                      onChange={v => updateAuto('techQuestion', { required: v })}
                                      label="Obrigatória (técnico deve responder para prosseguir)" />
                                  </div>
                                </ConfigRow>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mensagem para gestor e cliente movidas para dentro dos botões do link (onAccept, onGps, onEnRoute) */}
                    </div>
                  </ConfigRow>
                </div>

              </>
            )}

            {/* ═══ OFERTADA — Tempo de Aceite + Regras ═══ */}
            {stage.status === 'OFERTADA' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3">
                <h4 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1.5">⏱️ Configurações de aceite</h4>
                <p className="text-[10px] text-slate-400 mb-3">Quando a OS é ofertada aos técnicos, defina o tempo e regras para aceitar.</p>

                {/* Tempo para aceitar */}
                <div className="space-y-2.5">
                  <span className="text-xs font-medium text-slate-600 block">Tempo para aceitar:</span>
                  <div className="space-y-1.5 ml-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name={`${stage.id}_acceptMode`}
                        checked={stage.autoActions.techSelection.acceptTimeout.mode === 'fixed'}
                        onChange={() => updateAuto('techSelection', { acceptTimeout: { ...stage.autoActions.techSelection.acceptTimeout, mode: 'fixed' } })}
                        className="text-amber-600 focus:ring-amber-200" />
                      <span className="text-xs text-slate-700">Tempo fixo</span>
                    </label>
                    {stage.autoActions.techSelection.acceptTimeout.mode === 'fixed' && (
                      <div className="ml-5 flex items-center gap-2">
                        <NumberField label="Valor" value={stage.autoActions.techSelection.acceptTimeout.value}
                          onChange={v => updateAuto('techSelection', { acceptTimeout: { ...stage.autoActions.techSelection.acceptTimeout, value: v } })} />
                        <SelectField label="" value={stage.autoActions.techSelection.acceptTimeout.unit}
                          onChange={v => updateAuto('techSelection', { acceptTimeout: { ...stage.autoActions.techSelection.acceptTimeout, unit: v } })}
                          options={[{ value: 'minutes', label: 'Minutos' }, { value: 'hours', label: 'Horas' }]} />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name={`${stage.id}_acceptMode`}
                        checked={stage.autoActions.techSelection.acceptTimeout.mode === 'from_os'}
                        onChange={() => updateAuto('techSelection', { acceptTimeout: { ...stage.autoActions.techSelection.acceptTimeout, mode: 'from_os' } })}
                        className="text-amber-600 focus:ring-amber-200" />
                      <span className="text-xs text-slate-700">Definido na OS</span>
                      <span className="text-[10px] text-slate-400">(cada OS pode ter seu próprio tempo)</span>
                    </label>
                  </div>
                </div>

                {/* Ao expirar */}
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <SelectField label="Ao expirar o tempo" value={stage.autoActions.techSelection.onTimeout}
                    onChange={v => updateAuto('techSelection', { onTimeout: v })} options={ON_TIMEOUT_OPTIONS} />
                </div>

              </div>
            )}

            {/* ═══ ATRIBUÍDA — Tempo a Caminho + Pergunta de Chegada ═══ */}
            {stage.status === 'ATRIBUIDA' && (
              <>
                {/* Card verde: Tempo para ir a caminho */}
                <div className="rounded-lg border border-green-200 bg-green-50/30 p-3">
                  <h4 className="text-sm font-semibold text-green-800 mb-1 flex items-center gap-1.5">🚗 Tempo para ir a caminho</h4>
                  <p className="text-[10px] text-slate-400 mb-3">Após aceitar, o técnico tem um prazo para clicar &quot;A caminho&quot;.</p>

                  <div className="space-y-2.5">
                    <span className="text-xs font-medium text-slate-600 block">Tempo para clicar a caminho:</span>
                    <div className="space-y-1.5 ml-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`${stage.id}_enRouteMode`}
                          checked={stage.autoActions.techSelection.enRouteTimeout.mode === 'fixed'}
                          onChange={() => updateAuto('techSelection', { enRouteTimeout: { ...stage.autoActions.techSelection.enRouteTimeout, mode: 'fixed' } })}
                          className="text-green-600 focus:ring-green-200" />
                        <span className="text-xs text-slate-700">Tempo fixo</span>
                      </label>
                      {stage.autoActions.techSelection.enRouteTimeout.mode === 'fixed' && (
                        <div className="ml-5 flex items-center gap-2">
                          <NumberField label="Valor" value={stage.autoActions.techSelection.enRouteTimeout.value}
                            onChange={v => updateAuto('techSelection', { enRouteTimeout: { ...stage.autoActions.techSelection.enRouteTimeout, value: v } })} />
                          <SelectField label="" value={stage.autoActions.techSelection.enRouteTimeout.unit}
                            onChange={v => updateAuto('techSelection', { enRouteTimeout: { ...stage.autoActions.techSelection.enRouteTimeout, unit: v } })}
                            options={[{ value: 'minutes', label: 'Minutos' }, { value: 'hours', label: 'Horas' }]} />
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`${stage.id}_enRouteMode`}
                          checked={stage.autoActions.techSelection.enRouteTimeout.mode === 'from_os'}
                          onChange={() => updateAuto('techSelection', { enRouteTimeout: { ...stage.autoActions.techSelection.enRouteTimeout, mode: 'from_os' } })}
                          className="text-green-600 focus:ring-green-200" />
                        <span className="text-xs text-slate-700">Definido na OS</span>
                        <span className="text-[10px] text-slate-400">(cada OS pode ter seu próprio tempo)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Card azul: Pergunta de tempo estimado de chegada */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                  <Toggle checked={stage.autoActions.arrivalQuestion.enabled}
                    onChange={v => updateAuto('arrivalQuestion', { enabled: v })}
                    label="🕐 Pergunta de tempo estimado"
                    hint="Após aceitar a OS, o sistema pergunta ao técnico quanto tempo levará para estar a caminho. A resposta é exibida ao gestor e pode ser enviada ao cliente." />
                  <ConfigRow visible={stage.autoActions.arrivalQuestion.enabled}>
                    <div className="space-y-3">
                      {/* Pergunta */}
                      <TextField label="Pergunta" value={stage.autoActions.arrivalQuestion.question}
                        onChange={v => updateAuto('arrivalQuestion', { question: v })}
                        placeholder="Ex: Quanto tempo até você estar a caminho?" />

                      {/* Opções de tempo */}
                      <div>
                        <span className="text-xs font-medium text-slate-600 block mb-2">Opções de tempo:</span>
                        <div className="space-y-2">
                          {stage.autoActions.arrivalQuestion.options.map((opt, oi) => {
                            const enRouteMinutes = stage.autoActions.techSelection.enRouteTimeout.mode === 'fixed'
                              ? stage.autoActions.techSelection.enRouteTimeout.value * (stage.autoActions.techSelection.enRouteTimeout.unit === 'hours' ? 60 : 1)
                              : null;
                            const exceedsLimit = enRouteMinutes !== null && opt.minutes > enRouteMinutes;
                            return (
                              <div key={oi} className={`flex items-center gap-2 p-2 rounded border ${exceedsLimit ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                                <span className="text-xs text-slate-400 font-mono w-4">{oi + 1}.</span>
                                <input type="text" value={opt.label} placeholder="Rótulo (ex: 30 minutos)"
                                  onChange={e => {
                                    const newOpts = [...stage.autoActions.arrivalQuestion.options];
                                    newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                                    updateAuto('arrivalQuestion', { options: newOpts });
                                  }}
                                  className="flex-1 text-xs rounded border border-slate-300 px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
                                <label className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">min:</span>
                                  <input type="number" value={opt.minutes} min={1}
                                    onChange={e => {
                                      const newOpts = [...stage.autoActions.arrivalQuestion.options];
                                      newOpts[oi] = { ...newOpts[oi], minutes: parseInt(e.target.value) || 0 };
                                      updateAuto('arrivalQuestion', { options: newOpts });
                                    }}
                                    className={`text-xs rounded border px-2 py-1 w-16 outline-none ${exceedsLimit ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`} />
                                </label>
                                {exceedsLimit && (
                                  <span className="text-[10px] text-red-500 font-medium" title="Excede o prazo configurado acima">⚠️</span>
                                )}
                                <button type="button"
                                  onClick={() => {
                                    const newOpts = stage.autoActions.arrivalQuestion.options.filter((_, i) => i !== oi);
                                    updateAuto('arrivalQuestion', { options: newOpts });
                                  }}
                                  className="text-red-400 hover:text-red-600 p-0.5 text-xs">✕</button>
                              </div>
                            );
                          })}
                          <button type="button"
                            onClick={() => {
                              const newOpts = [...stage.autoActions.arrivalQuestion.options, { label: '', minutes: 0 }];
                              updateAuto('arrivalQuestion', { options: newOpts });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Adicionar opção</button>
                        </div>
                        {stage.autoActions.techSelection.enRouteTimeout.mode === 'fixed' && (
                          <p className="text-[10px] text-amber-600 mt-2">
                            ⚠️ Opções com tempo maior que {stage.autoActions.techSelection.enRouteTimeout.value} {stage.autoActions.techSelection.enRouteTimeout.unit === 'hours' ? 'hora(s)' : 'minuto(s)'} (prazo acima) serão bloqueadas para o técnico.
                            Se ele tentar, verá um erro e poderá informar novo tempo ou recusar o atendimento.
                          </p>
                        )}
                        {stage.autoActions.techSelection.enRouteTimeout.mode === 'from_os' && (
                          <p className="text-[10px] text-amber-600 mt-2">
                            ⚠️ O prazo é definido por OS — a validação será feita no celular do técnico com base no tempo configurado em cada OS.
                          </p>
                        )}
                      </div>

                      {/* Configurações adicionais */}
                      <div className="pt-2 border-t border-blue-200 space-y-2">
                        <div>
                          <SubToggle checked={stage.autoActions.arrivalQuestion.useAsDynamicTimeout}
                            onChange={v => updateAuto('arrivalQuestion', { useAsDynamicTimeout: v })}
                            label="Usar como timeout dinâmico" />
                          <p className="text-[10px] text-slate-400 ml-5 mt-0.5">
                            Se ativo, o tempo que o técnico escolher substitui o prazo fixo acima. O prazo configurado acima passa a ser apenas o limite máximo.
                          </p>
                        </div>
                        <SubToggle checked={stage.autoActions.arrivalQuestion.notifyCliente}
                          onChange={v => updateAuto('arrivalQuestion', { notifyCliente: v })}
                          label="Notificar cliente sobre tempo estimado" />
                        <SubToggle checked={stage.autoActions.arrivalQuestion.notifyGestor}
                          onChange={v => updateAuto('arrivalQuestion', { notifyGestor: v })}
                          label="Notificar gestor sobre tempo estimado" />
                        {(stage.autoActions.arrivalQuestion.notifyCliente || stage.autoActions.arrivalQuestion.notifyGestor) && (
                          <p className="text-[10px] text-slate-400 ml-5">
                            💡 Use a variável <code className="bg-slate-100 px-1 rounded">{'{tempo_estimado_chegada}'}</code> nas mensagens de notificação.
                          </p>
                        )}
                      </div>

                      {/* Ação ao recusar */}
                      <div className="pt-2 border-t border-blue-200">
                        <SelectField label="Ao recusar atendimento" value={stage.autoActions.arrivalQuestion.onDecline}
                          onChange={v => updateAuto('arrivalQuestion', { onDecline: v })}
                          options={ON_DECLINE_OPTIONS} />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Quando o técnico não conseguir cumprir o prazo e clicar &quot;Não vou poder atender&quot;, o sistema executará esta ação.
                        </p>
                      </div>
                    </div>
                  </ConfigRow>
                </div>
              </>
            )}

            {/* ═══ A_CAMINHO — Rastreamento por Proximidade ═══ */}
            {stage.status === 'A_CAMINHO' && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3">
                <Toggle checked={stage.autoActions.proximityTrigger.enabled}
                  onChange={v => updateAuto('proximityTrigger', { enabled: v })}
                  label="📡 Rastreamento por proximidade"
                  hint="Monitora o GPS do técnico e dispara ações automáticas quando ele se aproxima do endereço do cliente (notificar cliente, iniciar execução, etc)." />
                <ConfigRow visible={stage.autoActions.proximityTrigger.enabled}>
                  <div className="space-y-3">

                    {/* Raio de proximidade */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Raio de proximidade (metros)</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min={50} max={5000} step={50}
                          value={stage.autoActions.proximityTrigger.radiusMeters}
                          onChange={e => updateAuto('proximityTrigger', { radiusMeters: parseInt(e.target.value) })}
                          className="flex-1 accent-purple-600" />
                        <div className="flex items-center gap-1">
                          <input type="number" min={50} max={5000} step={50}
                            value={stage.autoActions.proximityTrigger.radiusMeters}
                            onChange={e => updateAuto('proximityTrigger', { radiusMeters: parseInt(e.target.value) || 200 })}
                            className="text-xs rounded border border-slate-300 px-2 py-1 w-20 text-center outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200" />
                          <span className="text-[10px] text-slate-400">m</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {stage.autoActions.proximityTrigger.radiusMeters >= 1000
                          ? `${(stage.autoActions.proximityTrigger.radiusMeters / 1000).toFixed(1)} km`
                          : `${stage.autoActions.proximityTrigger.radiusMeters}m`} — Eventos disparam quando o técnico entrar neste raio.
                      </p>
                    </div>

                    {/* Intervalo de rastreamento */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Intervalo de rastreamento</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={10} max={120} step={5}
                          value={stage.autoActions.proximityTrigger.trackingIntervalSeconds}
                          onChange={e => updateAuto('proximityTrigger', { trackingIntervalSeconds: parseInt(e.target.value) || 30 })}
                          className="text-xs rounded border border-slate-300 px-2 py-1 w-16 text-center outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200" />
                        <span className="text-xs text-slate-500">segundos</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Frequência de envio da posição. Menor = mais preciso, maior = economiza bateria.
                      </p>
                    </div>

                    {/* Precisão e duração */}
                    <div className="space-y-2">
                      <SubToggle checked={stage.autoActions.proximityTrigger.requireHighAccuracy}
                        onChange={v => updateAuto('proximityTrigger', { requireHighAccuracy: v })}
                        label="Alta precisão GPS obrigatória" />
                    </div>

                    {/* Manter GPS ativo até */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Manter GPS ativo até:</label>
                      <div className="space-y-1.5 ml-1">
                        {KEEP_ACTIVE_OPTIONS.map(opt => (
                          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                            <input type="radio" name={`${stage.id}_keepActive`}
                              checked={stage.autoActions.proximityTrigger.keepActiveUntil === opt.value}
                              onChange={() => updateAuto('proximityTrigger', { keepActiveUntil: opt.value })}
                              className="text-purple-600 focus:ring-purple-200 mt-0.5" />
                            <div>
                              <span className="text-xs text-slate-700">{opt.label}</span>
                              <p className="text-[10px] text-slate-400">{opt.hint}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ── Quando o técnico chegar ao local — Radio unificado ── */}
                    <div className="pt-2 border-t border-purple-200">
                      <label className="text-xs font-semibold text-purple-800 block mb-3">🚀 Quando o técnico chegar ao local:</label>
                      {(() => {
                        const prox = stage.autoActions.proximityTrigger;
                        const onRadius = prox.onEnterRadius.autoStartExecution;
                        const onArrival = prox.arrivalButton?.autoStartExecution ?? false;
                        const arrEnabled = prox.arrivalButton?.enabled ?? true;
                        const mode = onRadius ? 'radius' : (onArrival && arrEnabled) ? 'arrival' : 'manual';
                        const setMode = (m: string) => {
                          updateAuto('proximityTrigger', {
                            onEnterRadius: { ...prox.onEnterRadius, autoStartExecution: m === 'radius' },
                            arrivalButton: { ...prox.arrivalButton, enabled: m === 'arrival', autoStartExecution: m === 'arrival' },
                          });
                        };
                        const radioOpts = [
                          { value: 'radius', label: 'Ao entrar no raio de proximidade', desc: 'A OS muda para "Em Execução" automaticamente quando o GPS detecta que o técnico entrou no raio configurado.' },
                          { value: 'arrival', label: 'Ao clicar "Cheguei no local"', desc: 'O técnico confirma manualmente que chegou. A OS muda para "Em Execução" ao clicar o botão.' },
                          { value: 'manual', label: 'Não iniciar automaticamente', desc: 'O gestor decide manualmente quando a OS entra em execução.' },
                        ];
                        return (
                          <div className="space-y-2">
                            {radioOpts.map(opt => (
                              <div key={opt.value}>
                                <label className="flex items-start gap-2 cursor-pointer">
                                  <input type="radio" name={`${stage.id}_arrivalMode`} checked={mode === opt.value}
                                    onChange={() => setMode(opt.value)} className="text-purple-600 focus:ring-purple-200 mt-0.5" />
                                  <div>
                                    <span className="text-xs text-slate-700 font-medium">{opt.label}</span>
                                    <p className="text-[10px] text-slate-400">{opt.desc}</p>
                                  </div>
                                </label>

                                {/* ── Painel expandido: Ao entrar no raio ── */}
                                {opt.value === 'radius' && mode === 'radius' && (
                                  <div className="ml-5 mt-2 p-3 rounded-lg border border-purple-200 bg-purple-50/40 space-y-3">
                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.notifyCliente.enabled}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyCliente: { ...prox.onEnterRadius.notifyCliente, enabled: v } } })}
                                        label="Notificar cliente" />
                                      {prox.onEnterRadius.notifyCliente.enabled && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <SelectField label="Canal" value={prox.onEnterRadius.notifyCliente.channel}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyCliente: { ...prox.onEnterRadius.notifyCliente, channel: v } } })}
                                            options={CHANNEL_OPTIONS} />
                                          <WhatsAppCostWarning channel={prox.onEnterRadius.notifyCliente.channel} />
                                          <TextAreaField label="Mensagem" value={prox.onEnterRadius.notifyCliente.message}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyCliente: { ...prox.onEnterRadius.notifyCliente, message: v } } })}
                                            placeholder="O técnico {tecnico} está chegando! OS: {titulo}" vars />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.notifyGestor.enabled}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyGestor: { ...prox.onEnterRadius.notifyGestor, enabled: v } } })}
                                        label="Notificar gestor" />
                                      {prox.onEnterRadius.notifyGestor.enabled && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <SelectField label="Canal" value={prox.onEnterRadius.notifyGestor.channel}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyGestor: { ...prox.onEnterRadius.notifyGestor, channel: v } } })}
                                            options={CHANNEL_OPTIONS} />
                                          <WhatsAppCostWarning channel={prox.onEnterRadius.notifyGestor.channel} />
                                          <TextAreaField label="Mensagem" value={prox.onEnterRadius.notifyGestor.message}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyGestor: { ...prox.onEnterRadius.notifyGestor, message: v } } })}
                                            placeholder="Técnico {tecnico} chegou no raio de {distancia_tecnico} — OS: {titulo}" vars />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.alert.enabled}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, alert: { ...prox.onEnterRadius.alert, enabled: v } } })}
                                        label="Alerta no dashboard" />
                                      {prox.onEnterRadius.alert.enabled && (
                                        <div className="ml-5 mt-1.5">
                                          <TextField label="Mensagem do alerta" value={prox.onEnterRadius.alert.message}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, alert: { ...prox.onEnterRadius.alert, message: v } } })}
                                            placeholder="Ex: Técnico chegou ao local" />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.updateAddressCoords}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, updateAddressCoords: v } })}
                                        label="Atualizar coordenadas do endereço" />
                                      {prox.onEnterRadius.updateAddressCoords && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-600">Gravar quando estiver a</label>
                                            <input type="number" min={1} max={100} className="w-16 text-xs border border-slate-300 rounded px-2 py-1"
                                              value={prox.onEnterRadius.coordsRadiusMeters}
                                              onChange={e => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, coordsRadiusMeters: Number(e.target.value) || 10 } })} />
                                            <span className="text-[11px] text-slate-600">metros do endereço</span>
                                          </div>
                                          <p className="text-[10px] text-slate-400">
                                            Só grava as coordenadas quando o técnico atingir essa distância. Use um valor baixo (ex: 10m ou menos) para maior precisão.
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    <p className="text-[10px] text-slate-400 mt-1">
                                      💡 Use <code className="bg-slate-100 px-1 rounded">{'{distancia_tecnico}'}</code> e <code className="bg-slate-100 px-1 rounded">{'{tecnico}'}</code> nas mensagens.
                                      Os eventos disparam apenas UMA vez.
                                    </p>
                                  </div>
                                )}

                                {/* ── Painel expandido: Ao clicar Cheguei ── */}
                                {opt.value === 'arrival' && mode === 'arrival' && (
                                  <div className="ml-5 mt-2 p-3 rounded-lg border border-purple-200 bg-purple-50/40 space-y-3">
                                    <div>
                                      <SubToggle checked={prox.arrivalButton?.notifyCliente?.enabled ?? false}
                                        onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, notifyCliente: { ...prox.arrivalButton?.notifyCliente, enabled: v } } })}
                                        label="Notificar cliente" />
                                      {prox.arrivalButton?.notifyCliente?.enabled && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <SelectField label="Canal" value={prox.arrivalButton.notifyCliente.channel}
                                            onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, notifyCliente: { ...prox.arrivalButton.notifyCliente, channel: v } } })}
                                            options={CHANNEL_OPTIONS} />
                                          <WhatsAppCostWarning channel={prox.arrivalButton.notifyCliente.channel} />
                                          <TextAreaField label="Mensagem" value={prox.arrivalButton.notifyCliente.message}
                                            onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, notifyCliente: { ...prox.arrivalButton.notifyCliente, message: v } } })}
                                            placeholder="O técnico {tecnico} chegou ao local! OS: {titulo}" vars />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.arrivalButton?.notifyGestor?.enabled ?? false}
                                        onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, notifyGestor: { ...prox.arrivalButton?.notifyGestor, enabled: v } } })}
                                        label="Notificar gestor" />
                                      {prox.arrivalButton?.notifyGestor?.enabled && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <SelectField label="Canal" value={prox.arrivalButton.notifyGestor.channel}
                                            onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, notifyGestor: { ...prox.arrivalButton.notifyGestor, channel: v } } })}
                                            options={CHANNEL_OPTIONS} />
                                          <WhatsAppCostWarning channel={prox.arrivalButton.notifyGestor.channel} />
                                          <TextAreaField label="Mensagem" value={prox.arrivalButton.notifyGestor.message}
                                            onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, notifyGestor: { ...prox.arrivalButton.notifyGestor, message: v } } })}
                                            placeholder="Técnico {tecnico} chegou ao local — OS: {titulo}" vars />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.arrivalButton?.alert?.enabled ?? false}
                                        onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, alert: { ...prox.arrivalButton?.alert, enabled: v } } })}
                                        label="Alerta no dashboard" />
                                      {prox.arrivalButton?.alert?.enabled && (
                                        <div className="ml-5 mt-1.5">
                                          <TextField label="Mensagem do alerta" value={prox.arrivalButton?.alert?.message ?? ''}
                                            onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, alert: { ...prox.arrivalButton?.alert, message: v } } })}
                                            placeholder="Ex: Técnico chegou ao local" />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.arrivalButton?.updateAddressCoords ?? true}
                                        onChange={v => updateAuto('proximityTrigger', { arrivalButton: { ...prox.arrivalButton, updateAddressCoords: v } })}
                                        label="Atualizar coordenadas do endereço" />
                                      {(prox.arrivalButton?.updateAddressCoords ?? true) && (
                                        <p className="text-[10px] text-slate-400 ml-5 mt-1">
                                          Grava as coordenadas exatas do técnico ao confirmar chegada. Maior precisão possível.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* ── Painel expandido: Manual ── */}
                                {opt.value === 'manual' && mode === 'manual' && (
                                  <div className="ml-5 mt-2 p-3 rounded-lg border border-purple-200 bg-purple-50/40 space-y-3">
                                    <p className="text-[10px] text-slate-500">
                                      ℹ️ A OS permanece em &quot;A Caminho&quot; até que o gestor mude manualmente para &quot;Em Execução&quot;.
                                      O tracking GPS continua ativo — as opções abaixo disparam ao detectar proximidade.
                                    </p>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.notifyCliente.enabled}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyCliente: { ...prox.onEnterRadius.notifyCliente, enabled: v } } })}
                                        label="Notificar cliente ao detectar proximidade" />
                                      {prox.onEnterRadius.notifyCliente.enabled && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <SelectField label="Canal" value={prox.onEnterRadius.notifyCliente.channel}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyCliente: { ...prox.onEnterRadius.notifyCliente, channel: v } } })}
                                            options={CHANNEL_OPTIONS} />
                                          <WhatsAppCostWarning channel={prox.onEnterRadius.notifyCliente.channel} />
                                          <TextAreaField label="Mensagem" value={prox.onEnterRadius.notifyCliente.message}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyCliente: { ...prox.onEnterRadius.notifyCliente, message: v } } })}
                                            placeholder="O técnico {tecnico} está chegando! OS: {titulo}" vars />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.notifyGestor.enabled}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyGestor: { ...prox.onEnterRadius.notifyGestor, enabled: v } } })}
                                        label="Notificar gestor ao detectar proximidade" />
                                      {prox.onEnterRadius.notifyGestor.enabled && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <SelectField label="Canal" value={prox.onEnterRadius.notifyGestor.channel}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyGestor: { ...prox.onEnterRadius.notifyGestor, channel: v } } })}
                                            options={CHANNEL_OPTIONS} />
                                          <WhatsAppCostWarning channel={prox.onEnterRadius.notifyGestor.channel} />
                                          <TextAreaField label="Mensagem" value={prox.onEnterRadius.notifyGestor.message}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, notifyGestor: { ...prox.onEnterRadius.notifyGestor, message: v } } })}
                                            placeholder="Técnico {tecnico} está próximo — OS: {titulo}" vars />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.alert.enabled}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, alert: { ...prox.onEnterRadius.alert, enabled: v } } })}
                                        label="Alerta no dashboard" />
                                      {prox.onEnterRadius.alert.enabled && (
                                        <div className="ml-5 mt-1.5">
                                          <TextField label="Mensagem do alerta" value={prox.onEnterRadius.alert.message}
                                            onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, alert: { ...prox.onEnterRadius.alert, message: v } } })}
                                            placeholder="Ex: Técnico próximo ao local" />
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <SubToggle checked={prox.onEnterRadius.updateAddressCoords}
                                        onChange={v => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, updateAddressCoords: v } })}
                                        label="Atualizar coordenadas do endereço" />
                                      {prox.onEnterRadius.updateAddressCoords && (
                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-slate-600">Gravar quando estiver a</label>
                                            <input type="number" min={1} max={100} className="w-16 text-xs border border-slate-300 rounded px-2 py-1"
                                              value={prox.onEnterRadius.coordsRadiusMeters}
                                              onChange={e => updateAuto('proximityTrigger', { onEnterRadius: { ...prox.onEnterRadius, coordsRadiusMeters: Number(e.target.value) || 10 } })} />
                                            <span className="text-[11px] text-slate-600">metros do endereço</span>
                                          </div>
                                          <p className="text-[10px] text-slate-400">
                                            Só grava as coordenadas quando o técnico atingir essa distância. Use um valor baixo (ex: 10m ou menos) para maior precisão.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </ConfigRow>
              </div>
            )}

            {/* ═══ AÇÕES GENÉRICAS (filtradas por etapa) ═══ */}

            {/* ═══ NOTIFICAÇÕES SIMPLES — filtradas por etapa ═══ */}
            {/* ABERTA usa messageDispatch rico. A_CAMINHO e APROVADA não têm notificações. */}
            {!['ABERTA', 'A_CAMINHO', 'APROVADA'].includes(stage.status) && (
              <>
                {/* Notificar gestor — OFERTADA, ATRIBUÍDA, EM_EXECUÇÃO, CONCLUÍDA */}
                <div>
                  <Toggle checked={stage.autoActions.notifyGestor.enabled} onChange={v => updateAuto('notifyGestor', { enabled: v })}
                    label={AUTO_ACTION_LABELS.notifyGestor.label}
                    hint={stage.status === 'OFERTADA'
                      ? 'Útil quando outro operador despacha a OS ou em despachos automáticos — avisa o gestor que a oferta foi enviada aos técnicos.'
                      : AUTO_ACTION_LABELS.notifyGestor.hint} />
                  <ConfigRow visible={stage.autoActions.notifyGestor.enabled}>
                    <SelectField label="Canal" value={stage.autoActions.notifyGestor.channel}
                      onChange={v => updateAuto('notifyGestor', { channel: v })} options={CHANNEL_OPTIONS} />
                    <WhatsAppCostWarning channel={stage.autoActions.notifyGestor.channel} />
                    <TextAreaField label="Mensagem" value={stage.autoActions.notifyGestor.message}
                      onChange={v => updateAuto('notifyGestor', { message: v })} placeholder="OS {titulo} entrou na etapa {status}. Cliente: {cliente}." vars />
                  </ConfigRow>
                </div>

                {/* Notificar técnico — REMOVIDO de OFERTADA (duplicado com ABERTA), A_CAMINHO (sem sentido), EM_EXECUÇÃO (já sabe), CONCLUÍDA (já sabe), APROVADA (encerrado) */}
                {/* Só aparece na ATRIBUÍDA */}
                {stage.status === 'ATRIBUIDA' && (
                <div>
                  <Toggle checked={stage.autoActions.notifyTecnico.enabled} onChange={v => updateAuto('notifyTecnico', { enabled: v })}
                    label={AUTO_ACTION_LABELS.notifyTecnico.label} hint={AUTO_ACTION_LABELS.notifyTecnico.hint} />
                  {stage.autoActions.notifyTecnico.enabled && scheduleNotifiesTech && (
                    <ConflictWarning message="O Regime de Agenda (etapa Aberta) já notifica o técnico sobre o agendamento. Ativar esta notificação pode gerar mensagem duplicada para o técnico." />
                  )}
                  <ConfigRow visible={stage.autoActions.notifyTecnico.enabled}>
                    <SelectField label="Canal" value={stage.autoActions.notifyTecnico.channel}
                      onChange={v => updateAuto('notifyTecnico', { channel: v })} options={CHANNEL_OPTIONS} />
                    <WhatsAppCostWarning channel={stage.autoActions.notifyTecnico.channel} />
                    <TextAreaField label="Mensagem" value={stage.autoActions.notifyTecnico.message}
                      onChange={v => updateAuto('notifyTecnico', { message: v })} placeholder="Você foi atribuído à OS {titulo}. Cliente: {cliente}, Endereço: {endereco}." vars />
                    <SubToggle checked={stage.autoActions.notifyTecnico.includeLink} onChange={v => updateAuto('notifyTecnico', { includeLink: v })} label="Incluir link da OS" />
                  </ConfigRow>
                </div>
                )}

                {/* Notificar cliente — OFERTADA, ATRIBUÍDA, EM_EXECUÇÃO, CONCLUÍDA */}
                <div>
                  <Toggle checked={stage.autoActions.notifyCliente.enabled} onChange={v => updateAuto('notifyCliente', { enabled: v })}
                    label={AUTO_ACTION_LABELS.notifyCliente.label}
                    hint={stage.status === 'OFERTADA'
                      ? 'Avisa o cliente que a OS foi enviada aos técnicos e está aguardando aceite.'
                      : stage.status === 'ATRIBUIDA'
                        ? 'Avisa o cliente que um técnico foi designado. Se o link já notifica no aceite (onAccept), pode ser duplicado.'
                        : AUTO_ACTION_LABELS.notifyCliente.hint} />
                  {stage.status === 'ATRIBUIDA' && stage.autoActions.notifyCliente.enabled && (
                    (() => {
                      const linkOnAcceptClient = abertaStage?.autoActions.messageDispatch?.toTechnicians?.link?.onAccept?.notifyCliente?.enabled;
                      return linkOnAcceptClient ? (
                        <ConflictWarning message="O link do técnico (etapa Aberta) já notifica o cliente ao aceitar a OS. Ativar esta notificação pode gerar mensagem duplicada para o cliente." />
                      ) : null;
                    })()
                  )}
                  <ConfigRow visible={stage.autoActions.notifyCliente.enabled}>
                    <SelectField label="Canal" value={stage.autoActions.notifyCliente.channel}
                      onChange={v => updateAuto('notifyCliente', { channel: v })} options={CHANNEL_OPTIONS} />
                    <WhatsAppCostWarning channel={stage.autoActions.notifyCliente.channel} />
                    <TextAreaField label="Mensagem" value={stage.autoActions.notifyCliente.message}
                      onChange={v => updateAuto('notifyCliente', { message: v })} placeholder="Olá {cliente}, sua OS {titulo} foi atualizada. Status: {status}." vars />
                  </ConfigRow>
                </div>
              </>
            )}

            {/* ═══ APROVAÇÃO DO GESTOR — só CONCLUÍDA ═══ */}
            {stage.status === 'CONCLUIDA' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                <Toggle checked={stage.autoActions.gestorApproval.enabled}
                  onChange={v => updateAuto('gestorApproval', { enabled: v })}
                  label="👔 Aprovação do gestor"
                  hint="A OS fica retida em 'Concluída' até o gestor revisar e aprovar. Ele pode aprovar, aprovar com ressalvas (desconto na comissão), ou reprovar (reabrir). Sem isso, a OS é aprovada automaticamente." />
                <ConfigRow visible={stage.autoActions.gestorApproval.enabled}>
                  <div className="space-y-4">
                    {/* Checklist de revisão */}
                    <div>
                      <span className="text-xs font-semibold text-blue-800 block mb-2">📋 Checklist de revisão do gestor:</span>
                      <p className="text-[10px] text-slate-400 mb-2">Itens que o gestor deve conferir antes de aprovar. Aparecerão como checkboxes no painel.</p>
                      <ItemList items={stage.autoActions.gestorApproval.reviewChecklist}
                        onChange={items => updateAuto('gestorApproval', { reviewChecklist: items })}
                        placeholder="Ex: Verificar fotos do serviço" />
                    </div>

                    {/* On Approve */}
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-xs font-semibold text-green-700 block mb-2">✅ Ao APROVAR:</span>
                      <p className="text-[10px] text-slate-400 mb-2">A OS avança para &quot;Aprovada&quot; automaticamente.</p>
                      <div className="space-y-2">
                        <div className="rounded border border-blue-100 bg-white p-2">
                          <SubToggle checked={stage.autoActions.gestorApproval.onApprove.notifyTecnico.enabled}
                            onChange={v => updateAuto('gestorApproval', { onApprove: { ...stage.autoActions.gestorApproval.onApprove, notifyTecnico: { ...stage.autoActions.gestorApproval.onApprove.notifyTecnico, enabled: v } } })}
                            label="👷 Notificar técnico" />
                          {stage.autoActions.gestorApproval.onApprove.notifyTecnico.enabled && (
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              <SelectField label="Canal" value={stage.autoActions.gestorApproval.onApprove.notifyTecnico.channel}
                                onChange={v => updateAuto('gestorApproval', { onApprove: { ...stage.autoActions.gestorApproval.onApprove, notifyTecnico: { ...stage.autoActions.gestorApproval.onApprove.notifyTecnico, channel: v } } })}
                                options={CHANNEL_OPTIONS} />
                              <TextAreaField label="Mensagem" value={stage.autoActions.gestorApproval.onApprove.notifyTecnico.message}
                                onChange={v => updateAuto('gestorApproval', { onApprove: { ...stage.autoActions.gestorApproval.onApprove, notifyTecnico: { ...stage.autoActions.gestorApproval.onApprove.notifyTecnico, message: v } } })}
                                placeholder="✅ Seu serviço {titulo} foi aprovado pelo gestor!" vars />
                            </div>
                          )}
                        </div>
                        <div className="rounded border border-blue-100 bg-white p-2">
                          <SubToggle checked={stage.autoActions.gestorApproval.onApprove.notifyCliente.enabled}
                            onChange={v => updateAuto('gestorApproval', { onApprove: { ...stage.autoActions.gestorApproval.onApprove, notifyCliente: { ...stage.autoActions.gestorApproval.onApprove.notifyCliente, enabled: v } } })}
                            label="👤 Notificar cliente" />
                          {stage.autoActions.gestorApproval.onApprove.notifyCliente.enabled && (
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              <SelectField label="Canal" value={stage.autoActions.gestorApproval.onApprove.notifyCliente.channel}
                                onChange={v => updateAuto('gestorApproval', { onApprove: { ...stage.autoActions.gestorApproval.onApprove, notifyCliente: { ...stage.autoActions.gestorApproval.onApprove.notifyCliente, channel: v } } })}
                                options={CHANNEL_OPTIONS} />
                              <TextAreaField label="Mensagem" value={stage.autoActions.gestorApproval.onApprove.notifyCliente.message}
                                onChange={v => updateAuto('gestorApproval', { onApprove: { ...stage.autoActions.gestorApproval.onApprove, notifyCliente: { ...stage.autoActions.gestorApproval.onApprove.notifyCliente, message: v } } })}
                                placeholder="Olá {cliente}, seu serviço {titulo} foi finalizado com sucesso. Obrigado!" vars />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* On Approve With Reservations */}
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-xs font-semibold text-amber-700 block mb-2">⚠️ Ao APROVAR COM RESSALVAS:</span>
                      <div className="space-y-3">
                        <SubToggle checked={stage.autoActions.gestorApproval.onApproveWithReservations.enabled}
                          onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, enabled: v } })}
                          label="Habilitar opção de aprovar com ressalvas" />

                        {stage.autoActions.gestorApproval.onApproveWithReservations.enabled && (
                          <div className="ml-5 space-y-3">
                            <SubToggle checked={stage.autoActions.gestorApproval.onApproveWithReservations.requireNote}
                              onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, requireNote: v } })}
                              label="Exigir descrição das ressalvas" />

                            <SubToggle checked={stage.autoActions.gestorApproval.onApproveWithReservations.flagOS}
                              onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, flagOS: v } })}
                              label="Marcar OS com flag de qualidade" />

                            {/* Commission Adjustment */}
                            <div className="rounded border border-amber-200 bg-amber-50/50 p-2 space-y-2">
                              <SubToggle checked={stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.enabled}
                                onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, commissionAdjustment: { ...stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment, enabled: v } } })}
                                label="💰 Ajustar comissão do técnico" />
                              {stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.enabled && (
                                <div className="ml-5 flex flex-wrap gap-3">
                                  <SelectField label="Tipo" value={stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.type}
                                    onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, commissionAdjustment: { ...stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment, type: v } } })}
                                    options={COMMISSION_ADJUSTMENT_TYPES} />
                                  <NumberField label={stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.type === 'reduce_percent' ? 'Percentual' : 'Valor (R$)'}
                                    value={stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.value}
                                    onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, commissionAdjustment: { ...stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment, value: v } } })}
                                    min={0} suffix={stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.type === 'reduce_percent' ? '%' : 'R$'} />
                                  {COMMISSION_ADJUSTMENT_TYPES.find(t => t.value === stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.type) && (
                                    <p className="text-[10px] text-slate-400 w-full">
                                      💡 {COMMISSION_ADJUSTMENT_TYPES.find(t => t.value === stage.autoActions.gestorApproval.onApproveWithReservations.commissionAdjustment.type)?.hint}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Notifications */}
                            <div className="rounded border border-amber-100 bg-white p-2">
                              <SubToggle checked={stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico.enabled}
                                onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, notifyTecnico: { ...stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico, enabled: v } } })}
                                label="👷 Notificar técnico" />
                              {stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico.enabled && (
                                <div className="mt-1.5 ml-5 space-y-1.5">
                                  <SelectField label="Canal" value={stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico.channel}
                                    onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, notifyTecnico: { ...stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico, channel: v } } })}
                                    options={CHANNEL_OPTIONS} />
                                  <TextAreaField label="Mensagem" value={stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico.message}
                                    onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, notifyTecnico: { ...stage.autoActions.gestorApproval.onApproveWithReservations.notifyTecnico, message: v } } })}
                                    placeholder="Mensagem ao técnico sobre ressalvas... Use {ressalvas}" vars />
                                </div>
                              )}
                            </div>
                            <div className="rounded border border-amber-100 bg-white p-2">
                              <SubToggle checked={stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente.enabled}
                                onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, notifyCliente: { ...stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente, enabled: v } } })}
                                label="👤 Notificar cliente" />
                              {stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente.enabled && (
                                <div className="mt-1.5 ml-5 space-y-1.5">
                                  <SelectField label="Canal" value={stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente.channel}
                                    onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, notifyCliente: { ...stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente, channel: v } } })}
                                    options={CHANNEL_OPTIONS} />
                                  <TextAreaField label="Mensagem" value={stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente.message}
                                    onChange={v => updateAuto('gestorApproval', { onApproveWithReservations: { ...stage.autoActions.gestorApproval.onApproveWithReservations, notifyCliente: { ...stage.autoActions.gestorApproval.onApproveWithReservations.notifyCliente, message: v } } })}
                                    placeholder="Olá {cliente}, seu serviço {titulo} foi aprovado com ressalvas: {ressalvas}." vars />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* On Reject */}
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-xs font-semibold text-red-700 block mb-2">❌ Ao REPROVAR:</span>
                      <div className="space-y-3">
                        <SelectField label="Ação ao reprovar" value={stage.autoActions.gestorApproval.onReject.action}
                          onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, action: v } })}
                          options={GESTOR_REJECT_ACTIONS} />
                        {GESTOR_REJECT_ACTIONS.find(a => a.value === stage.autoActions.gestorApproval.onReject.action) && (
                          <p className="text-[10px] text-slate-400 -mt-1">
                            💡 {GESTOR_REJECT_ACTIONS.find(a => a.value === stage.autoActions.gestorApproval.onReject.action)?.hint}
                          </p>
                        )}
                        <SubToggle checked={stage.autoActions.gestorApproval.onReject.requireReason}
                          onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, requireReason: v } })}
                          label="Exigir motivo da reprovação" />
                        <div className="rounded border border-red-100 bg-white p-2">
                          <SubToggle checked={stage.autoActions.gestorApproval.onReject.notifyTecnico.enabled}
                            onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, notifyTecnico: { ...stage.autoActions.gestorApproval.onReject.notifyTecnico, enabled: v } } })}
                            label="👷 Notificar técnico" />
                          {stage.autoActions.gestorApproval.onReject.notifyTecnico.enabled && (
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              <SelectField label="Canal" value={stage.autoActions.gestorApproval.onReject.notifyTecnico.channel}
                                onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, notifyTecnico: { ...stage.autoActions.gestorApproval.onReject.notifyTecnico, channel: v } } })}
                                options={CHANNEL_OPTIONS} />
                              <TextAreaField label="Mensagem" value={stage.autoActions.gestorApproval.onReject.notifyTecnico.message}
                                onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, notifyTecnico: { ...stage.autoActions.gestorApproval.onReject.notifyTecnico, message: v } } })}
                                placeholder="Mensagem de reprovação ao técnico... Use {motivo_rejeicao}" vars />
                            </div>
                          )}
                        </div>
                        <div className="rounded border border-red-100 bg-white p-2">
                          <SubToggle checked={stage.autoActions.gestorApproval.onReject.notifyCliente.enabled}
                            onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, notifyCliente: { ...stage.autoActions.gestorApproval.onReject.notifyCliente, enabled: v } } })}
                            label="👤 Notificar cliente" />
                          {stage.autoActions.gestorApproval.onReject.notifyCliente.enabled && (
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              <SelectField label="Canal" value={stage.autoActions.gestorApproval.onReject.notifyCliente.channel}
                                onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, notifyCliente: { ...stage.autoActions.gestorApproval.onReject.notifyCliente, channel: v } } })}
                                options={CHANNEL_OPTIONS} />
                              <TextAreaField label="Mensagem" value={stage.autoActions.gestorApproval.onReject.notifyCliente.message}
                                onChange={v => updateAuto('gestorApproval', { onReject: { ...stage.autoActions.gestorApproval.onReject, notifyCliente: { ...stage.autoActions.gestorApproval.onReject.notifyCliente, message: v } } })}
                                placeholder="Olá {cliente}, houve um problema com seu serviço {titulo}. Entraremos em contato." vars />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-blue-600 bg-blue-50 rounded px-2 py-1.5">
                      💡 Quando ativado, a OS ficará na etapa &quot;Concluída&quot; aguardando aprovação. O gestor verá um painel de revisão com fotos, checklist e os botões: Aprovar, Aprovar com Ressalvas e Reprovar.
                    </p>
                  </div>
                </ConfigRow>
              </div>
            )}

            {/* Lançar financeiro — só CONCLUÍDA e APROVADA */}
            {['CONCLUIDA', 'APROVADA'].includes(stage.status) && (() => {
              const otherStatus = stage.status === 'CONCLUIDA' ? 'APROVADA' : 'CONCLUIDA';
              const otherLabel  = stage.status === 'CONCLUIDA' ? 'Aprovada' : 'Concluída';
              const otherStage  = allStages?.find(s => s.status === otherStatus);
              const otherHasFinancial = otherStage?.autoActions.financialEntry.enabled ?? false;

              return (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
                <Toggle checked={stage.autoActions.financialEntry.enabled}
                  onChange={v => {
                    if (v && otherHasFinancial) {
                      if (!confirm(`A etapa "${otherLabel}" já possui lançamento financeiro ativado.\n\nPara evitar lançamentos duplicados, ao ativar aqui o financeiro da "${otherLabel}" será desativado.\n\nDeseja continuar?`)) return;
                      // Desativar o financeiro da outra etapa
                      if (otherStage) {
                        const otherIndex = allStages?.indexOf(otherStage) ?? -1;
                        if (otherIndex >= 0) {
                          // We need to propagate this change — call onChange on this stage
                          // and the parent will handle the other via a special flag
                          updateAuto('financialEntry', { enabled: true, _disableOtherFinancial: otherStatus });
                          return;
                        }
                      }
                    }
                    updateAuto('financialEntry', { enabled: v });
                  }}
                  label={AUTO_ACTION_LABELS.financialEntry.label} hint="Quando a OS chega nesta etapa, gera lançamentos financeiros automaticamente (a receber do cliente e/ou a pagar para o técnico)" />

                {/* Aviso de conflito — outra etapa já tem financeiro ativo */}
                {stage.autoActions.financialEntry.enabled && otherHasFinancial && (
                  <div className="mt-2 px-3 py-2 rounded bg-amber-50 border border-amber-300">
                    <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                      <span>&#9888;&#65039;</span> A etapa &quot;{otherLabel}&quot; tambem possui lançamento financeiro ativado. Isso pode gerar lançamentos duplicados.
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      Recomendamos manter o financeiro em apenas uma das etapas (Concluída OU Aprovada).
                    </p>
                  </div>
                )}

                <ConfigRow visible={stage.autoActions.financialEntry.enabled}>
                  <div className="space-y-2">
                    {(stage.autoActions.financialEntry.entries || []).map((entry: FinancialEntryConfig, ei: number) => (
                      <div key={entry.id} className="rounded border border-emerald-200 bg-white p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">
                            {FINANCIAL_ENTRY_TYPES.find(t => t.value === entry.type)?.icon || '💰'} {entry.label || 'Lançamento ' + (ei + 1)}
                          </span>
                          <button type="button" onClick={() => {
                            const entries = (stage.autoActions.financialEntry.entries || []).filter((_: FinancialEntryConfig, i: number) => i !== ei);
                            updateAuto('financialEntry', { entries });
                          }} className="text-red-400 hover:text-red-600 p-0.5 text-xs" title="Remover">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <SelectField label="Tipo" value={entry.type}
                            onChange={v => {
                              const entries = [...(stage.autoActions.financialEntry.entries || [])];
                              const typeInfo = FINANCIAL_ENTRY_TYPES.find(t => t.value === v);
                              entries[ei] = { ...entries[ei], type: v, label: typeInfo?.label || entry.label };
                              updateAuto('financialEntry', { entries });
                            }} options={FINANCIAL_ENTRY_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))} />
                          <SelectField label="Valor" value={entry.valueSource}
                            onChange={v => {
                              const entries = [...(stage.autoActions.financialEntry.entries || [])];
                              entries[ei] = { ...entries[ei], valueSource: v };
                              updateAuto('financialEntry', { entries });
                            }} options={FINANCIAL_VALUE_SOURCES.map(s => ({ value: s.value, label: s.label }))} />
                        </div>
                        {entry.valueSource === 'fixed' && (
                          <NumberField label="Valor fixo (R$)" value={entry.fixedValue || 0}
                            onChange={v => {
                              const entries = [...(stage.autoActions.financialEntry.entries || [])];
                              entries[ei] = { ...entries[ei], fixedValue: v };
                              updateAuto('financialEntry', { entries });
                            }} min={0} />
                        )}
                        {entry.valueSource === 'percent_os' && (
                          <NumberField label="Percentual (%)" value={entry.percentOfOS || 0}
                            onChange={v => {
                              const entries = [...(stage.autoActions.financialEntry.entries || [])];
                              entries[ei] = { ...entries[ei], percentOfOS: v };
                              updateAuto('financialEntry', { entries });
                            }} min={0} suffix="%" />
                        )}
                        <TextField label="Rótulo" value={entry.label}
                          onChange={v => {
                            const entries = [...(stage.autoActions.financialEntry.entries || [])];
                            entries[ei] = { ...entries[ei], label: v };
                            updateAuto('financialEntry', { entries });
                          }} placeholder="Nome do lançamento" />
                        <TextField label="Descrição" value={entry.description}
                          onChange={v => {
                            const entries = [...(stage.autoActions.financialEntry.entries || [])];
                            entries[ei] = { ...entries[ei], description: v };
                            updateAuto('financialEntry', { entries });
                          }} placeholder="Descrição do lançamento..." />
                        <SubToggle checked={entry.autoCreate}
                          onChange={v => {
                            const entries = [...(stage.autoActions.financialEntry.entries || [])];
                            entries[ei] = { ...entries[ei], autoCreate: v };
                            updateAuto('financialEntry', { entries });
                          }} label="Criar automaticamente (sem intervenção do gestor)" />
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      const newEntry: FinancialEntryConfig = {
                        id: `fe_${Date.now().toString(36)}`,
                        type: 'contas_receber',
                        label: 'Novo lançamento',
                        valueSource: 'os_value',
                        description: '',
                        autoCreate: true,
                      };
                      const entries = [...(stage.autoActions.financialEntry.entries || []), newEntry];
                      updateAuto('financialEntry', { entries });
                    }} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
                      + Adicionar lançamento financeiro
                    </button>
                    {(stage.autoActions.financialEntry.entries || []).length === 0 && (
                      <p className="text-[10px] text-slate-400 italic">
                        Nenhum lançamento configurado. Adicione para criar registros financeiros automáticos.
                      </p>
                    )}
                  </div>
                </ConfigRow>
              </div>
              );
            })()}

            {/* Atribuir técnico e Duplicar OS — REMOVIDOS de todas as etapas */}
            {/* assignTech e duplicateOS não fazem sentido como auto-ações: */}
            {/* - Após conclusão/aprovação, o serviço está encerrado */}
            {/* - Redistribuição deve ser feita manualmente pelo gestor */}
            {/* - Duplicar OS para follow-up é decisão manual, não automática */}

            {/* Webhook — REMOVIDO de todas as etapas (decisão global) */}
            {/* Alerta — REMOVIDO de todas as etapas (redundante com status no card) */}
          </div>

          {/* ── AÇÕES DO TÉCNICO ── */}
          {/* ABERTA/OFERTADA: sem técnico. A_CAMINHO: dirigindo, sem interação. APROVADA: encerrado. */}
          {!['ABERTA', 'OFERTADA', 'A_CAMINHO', 'APROVADA'].includes(stage.status) && (
          <>
          <SectionLabel icon="👷" title="Ações do Técnico" />
          <div className="space-y-3">
            {/* STEP — só EM_EXECUÇÃO (ATRIBUÍDA: filtrado, CONCLUÍDA: filtrado) */}
            {stage.status === 'EM_EXECUCAO' && (
            <div>
              <Toggle checked={stage.techActions.step.enabled} onChange={v => updateTech('step', { enabled: v })}
                label={TECH_ACTION_LABELS.step.label} hint={TECH_ACTION_LABELS.step.hint} />
              <ConfigRow visible={stage.techActions.step.enabled}>
                <TextField label="Descrição da atividade" value={stage.techActions.step.description}
                  onChange={v => updateTech('step', { description: v })} placeholder="O que o técnico deve fazer..." />
                <div className="flex flex-wrap gap-3">
                  <SubToggle checked={stage.techActions.step.requirePhoto} onChange={v => updateTech('step', { requirePhoto: v })} label="Exigir foto" />
                  <SubToggle checked={stage.techActions.step.requireNote} onChange={v => updateTech('step', { requireNote: v })} label="Exigir nota" />
                  <SubToggle checked={stage.techActions.step.requireGPS} onChange={v => updateTech('step', { requireGPS: v })} label="Exigir GPS" />
                </div>
              </ConfigRow>
            </div>
            )}

            {/* PHOTO REQUIREMENTS (multi-group) — EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3">
                <Toggle checked={stage.techActions.photoRequirements.enabled}
                  onChange={v => updateTech('photoRequirements', { enabled: v })}
                  label={TECH_ACTION_LABELS.photoRequirements.label} hint={TECH_ACTION_LABELS.photoRequirements.hint} />
                <ConfigRow visible={stage.techActions.photoRequirements.enabled}>
                  <PhotoRequirementList
                    groups={stage.techActions.photoRequirements.groups}
                    onChange={groups => updateTech('photoRequirements', { groups })} />
                  {stage.techActions.photoRequirements.groups.some((g: PhotoRequirementGroup) => ['on_pause', 'on_resume'].includes(g.moment)) && !stage.timeControl.pauseSystem?.enabled && (
                    <ConflictWarning message="Há fotos configuradas para momento de pausa/retorno, mas o Sistema de Pausas não está ativo nesta etapa. As fotos de pausa/retorno não serão solicitadas." />
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    💡 Configure múltiplos grupos: ex. fotos &quot;Antes de iniciar&quot; + fotos &quot;Após concluir&quot;.
                    Cada grupo pode exigir quantidade e momento diferentes.
                  </p>
                </ConfigRow>
              </div>
            )}

            {/* PHOTO (single group) — ATRIBUÍDA e CONCLUÍDA */}
            {['ATRIBUIDA', 'CONCLUIDA'].includes(stage.status) && (
              <div>
                <Toggle checked={stage.techActions.photo.enabled} onChange={v => updateTech('photo', { enabled: v })}
                  label={TECH_ACTION_LABELS.photo.label} hint={TECH_ACTION_LABELS.photo.hint} />
                <ConfigRow visible={stage.techActions.photo.enabled}>
                  <div className="flex flex-wrap gap-3">
                    <NumberField label="Mínimo de fotos" value={stage.techActions.photo.minPhotos}
                      onChange={v => updateTech('photo', { minPhotos: v })} />
                    <SelectField label="Tipo" value={stage.techActions.photo.photoType}
                      onChange={v => updateTech('photo', { photoType: v })} options={PHOTO_TYPE_OPTIONS} />
                  </div>
                  <TextField label="Rótulo" value={stage.techActions.photo.label}
                    onChange={v => updateTech('photo', { label: v })} placeholder="Ex: Foto antes do serviço" />
                </ConfigRow>
              </div>
            )}

            {/* NOTE */}
            <div>
              <Toggle checked={stage.techActions.note.enabled} onChange={v => updateTech('note', { enabled: v })}
                label={TECH_ACTION_LABELS.note.label} hint={TECH_ACTION_LABELS.note.hint} />
              <ConfigRow visible={stage.techActions.note.enabled}>
                <TextField label="Placeholder" value={stage.techActions.note.placeholder}
                  onChange={v => updateTech('note', { placeholder: v })} placeholder="Texto de exemplo..." />
              </ConfigRow>
            </div>

            {/* GPS — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
            <div>
              <Toggle checked={stage.techActions.gps.enabled} onChange={v => updateTech('gps', { enabled: v })}
                label={TECH_ACTION_LABELS.gps.label} hint={TECH_ACTION_LABELS.gps.hint} />
              <ConfigRow visible={stage.techActions.gps.enabled}>
                <SubToggle checked={stage.techActions.gps.requireAccuracy} onChange={v => updateTech('gps', { requireAccuracy: v })} label="Alta precisão obrigatória" />
              </ConfigRow>
            </div>
            )}

            {/* CHECKLIST LEGADO — ATRIBUIDA + EM_EXECUCAO (backward compat) */}
            {['ATRIBUIDA', 'EM_EXECUCAO'].includes(stage.status) && (
            <div>
              <Toggle checked={stage.techActions.checklist.enabled} onChange={v => updateTech('checklist', { enabled: v })}
                label={TECH_ACTION_LABELS.checklist.label} hint={TECH_ACTION_LABELS.checklist.hint} />
              <ConfigRow visible={stage.techActions.checklist.enabled}>
                <ItemList items={stage.techActions.checklist.items}
                  onChange={items => updateTech('checklist', { items })} placeholder="Item do checklist" />
              </ConfigRow>
            </div>
            )}

            {/* CHECKLISTS ESTRUTURADOS — 4 classes fixas */}
            {['ABERTA', 'ATRIBUIDA', 'EM_EXECUCAO', 'CONCLUIDA'].includes(stage.status) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-700">Checklists do Serviço</p>
              <p className="text-[10px] text-blue-500 -mt-2">Itens vêm do cadastro de serviços da OS. Configure modo e obrigatoriedade por classe.</p>

              {([
                { cls: 'toolsPpe' as const, labelKey: 'checklistToolsPpe' },
                { cls: 'materials' as const, labelKey: 'checklistMaterials' },
                { cls: 'initialCheck' as const, labelKey: 'checklistInitialCheck' },
                { cls: 'finalCheck' as const, labelKey: 'checklistFinalCheck' },
              ]).map(({ cls, labelKey }) => (
                <div key={cls}>
                  <Toggle
                    checked={stage.techActions.checklistConfig[cls].enabled}
                    onChange={v => updateChecklistCls(cls, { enabled: v })}
                    label={TECH_ACTION_LABELS[labelKey]?.label || cls}
                    hint={TECH_ACTION_LABELS[labelKey]?.hint}
                  />
                  <ConfigRow visible={stage.techActions.checklistConfig[cls].enabled}>
                    <div className="flex flex-wrap gap-3">
                      <SelectField label="Modo" value={stage.techActions.checklistConfig[cls].mode}
                        onChange={v => updateChecklistCls(cls, { mode: v })}
                        options={[{ value: 'ITEM_BY_ITEM', label: 'Item a item' }, { value: 'FULL', label: 'Checklist inteiro' }]} />
                      <SelectField label="Obrigatoriedade" value={stage.techActions.checklistConfig[cls].required}
                        onChange={v => updateChecklistCls(cls, { required: v })}
                        options={[{ value: 'REQUIRED', label: 'Obrigatório' }, { value: 'RECOMMENDED', label: 'Recomendado' }]} />
                    </div>
                    {stage.techActions.checklistConfig[cls].required === 'RECOMMENDED' && (
                      <SubToggle
                        checked={stage.techActions.checklistConfig[cls].notifyOnSkip}
                        onChange={v => updateChecklistCls(cls, { notifyOnSkip: v })}
                        label="Notificar gestor se técnico pular"
                      />
                    )}
                  </ConfigRow>
                </div>
              ))}
            </div>
            )}

            {/* FORM — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
            <div>
              <Toggle checked={stage.techActions.form.enabled} onChange={v => updateTech('form', { enabled: v })}
                label={TECH_ACTION_LABELS.form.label} hint={TECH_ACTION_LABELS.form.hint} />
              <ConfigRow visible={stage.techActions.form.enabled}>
                <FormFieldList fields={stage.techActions.form.fields}
                  onChange={fields => updateTech('form', { fields })} />
              </ConfigRow>
            </div>
            )}

            {/* MATERIALS — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/30 p-3">
                <Toggle checked={stage.techActions.materials.enabled}
                  onChange={v => updateTech('materials', { enabled: v })}
                  label={TECH_ACTION_LABELS.materials.label} hint={TECH_ACTION_LABELS.materials.hint} />
                <ConfigRow visible={stage.techActions.materials.enabled}>
                  <TextField label="Rótulo" value={stage.techActions.materials.label}
                    onChange={v => updateTech('materials', { label: v })} placeholder="Ex: Materiais utilizados" />
                  <div className="flex flex-wrap gap-3">
                    <SubToggle checked={stage.techActions.materials.requireQuantity}
                      onChange={v => updateTech('materials', { requireQuantity: v })}
                      label="Exigir quantidade" />
                    <SubToggle checked={stage.techActions.materials.requireUnitCost}
                      onChange={v => updateTech('materials', { requireUnitCost: v })}
                      label="Exigir custo unitário" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    O técnico poderá adicionar materiais/peças usados com nome{stage.techActions.materials.requireQuantity ? ', quantidade' : ''}{stage.techActions.materials.requireUnitCost ? ' e custo unitário' : ''}.
                  </p>
                </ConfigRow>
              </div>
            )}

            {/* SIGNATURE — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
            <div>
              <Toggle checked={stage.techActions.signature.enabled} onChange={v => updateTech('signature', { enabled: v })}
                label={TECH_ACTION_LABELS.signature.label} hint={TECH_ACTION_LABELS.signature.hint} />
              <ConfigRow visible={stage.techActions.signature.enabled}>
                <TextField label="Rótulo" value={stage.techActions.signature.label}
                  onChange={v => updateTech('signature', { label: v })} placeholder="Assinatura do cliente" />
              </ConfigRow>
            </div>
            )}

            {/* QUESTION — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
            <div>
              <Toggle checked={stage.techActions.question.enabled} onChange={v => updateTech('question', { enabled: v })}
                label={TECH_ACTION_LABELS.question.label} hint={TECH_ACTION_LABELS.question.hint} />
              <ConfigRow visible={stage.techActions.question.enabled}>
                <TextField label="Pergunta" value={stage.techActions.question.question}
                  onChange={v => updateTech('question', { question: v })} placeholder="Qual a pergunta?" />
                <div>
                  <span className="text-xs text-slate-500">Opções de resposta:</span>
                  <ItemList items={stage.techActions.question.options}
                    onChange={options => updateTech('question', { options })} placeholder="Opção" />
                </div>
              </ConfigRow>
            </div>
            )}
          </div>
          </>
          )}

          {/* Hint para etapas sem ações do técnico */}
          {['ABERTA', 'OFERTADA'].includes(stage.status) && (
            <div className="mt-2 px-3 py-2 rounded bg-slate-50 border border-dashed border-slate-200">
              <p className="text-[10px] text-slate-400 italic">
                👷 Ações do técnico não estão disponíveis nesta etapa — o técnico só é atribuído a partir da etapa &quot;Atribuída&quot;.
              </p>
            </div>
          )}
          {stage.status === 'APROVADA' && (
            <div className="mt-2 px-3 py-2 rounded bg-slate-50 border border-dashed border-slate-200">
              <p className="text-[10px] text-slate-400 italic">
                👔 Ações do técnico não estão disponíveis nesta etapa — &quot;Aprovada&quot; é uma etapa gerencial. O trabalho de campo termina na &quot;Concluída&quot;.
              </p>
            </div>
          )}

          {/* ── CONTROLE DE TEMPO ── */}
          <SectionLabel icon="⏱️" title="Controle de Tempo" />
          <div className="space-y-3">
            {/* WAIT_FOR — REMOVIDO de todas as etapas (coberto por configs específicas de cada etapa) */}

            {/* EXECUTION TIMER — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3">
                <Toggle checked={stage.timeControl.executionTimer.enabled}
                  onChange={v => updateTime('executionTimer', { enabled: v })}
                  label={TIME_CONTROL_LABELS.executionTimer.label} hint={TIME_CONTROL_LABELS.executionTimer.hint} />
                <ConfigRow visible={stage.timeControl.executionTimer.enabled}>
                  <SubToggle checked={stage.timeControl.executionTimer.showToTech}
                    onChange={v => updateTime('executionTimer', { showToTech: v })}
                    label="Exibir cronômetro para o técnico" />
                  <SubToggle checked={stage.timeControl.executionTimer.pauseDiscountsFromSla}
                    onChange={v => updateTime('executionTimer', { pauseDiscountsFromSla: v })}
                    label="Pausas descontam do tempo" />
                  <p className="text-[10px] text-slate-400">
                    ⏲️ Registra o tempo efetivo de execução. O cronômetro é pausado/retomado automaticamente
                    quando o técnico pausa o atendimento (requer Sistema de Pausas ativado abaixo).
                  </p>
                </ConfigRow>
              </div>
            )}

            {/* PAUSE SYSTEM — only EM_EXECUCAO */}
            {stage.status === 'EM_EXECUCAO' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/30 p-3">
                <Toggle checked={stage.timeControl.pauseSystem?.enabled ?? false}
                  onChange={v => updateTime('pauseSystem', { ...(stage.timeControl.pauseSystem || {}), enabled: v })}
                  label="⏸️ Sistema de pausas" hint="Permite ao técnico pausar e retomar o atendimento (almoço, buscar peças, etc). O tempo pausado é registrado separadamente e pode descontar do cronômetro." />
                <ConfigRow visible={stage.timeControl.pauseSystem?.enabled ?? false}>
                  {/* Limites */}
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Máximo de pausas" value={stage.timeControl.pauseSystem?.maxPauses ?? 0}
                      onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, maxPauses: v })}
                      suffix="0 = ilimitado" />
                    <NumberField label="Duração máxima total" value={stage.timeControl.pauseSystem?.maxPauseDurationMinutes ?? 0}
                      onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, maxPauseDurationMinutes: v })}
                      suffix="min (0 = ilimitado)" />
                  </div>

                  {/* Motivo */}
                  <SubToggle checked={stage.timeControl.pauseSystem?.requireReason ?? true}
                    onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, requireReason: v })}
                    label="Exigir motivo da pausa" />

                  {(stage.timeControl.pauseSystem?.requireReason ?? true) && (
                    <div className="ml-4 mt-1 space-y-1">
                      <p className="text-[10px] text-slate-500 font-medium mb-1">Motivos disponíveis para o técnico:</p>
                      {PAUSE_REASON_CATEGORIES.map(cat => {
                        const allowed = stage.timeControl.pauseSystem?.allowedReasons ?? [];
                        const isChecked = allowed.includes(cat.value);
                        return (
                          <label key={cat.value} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={isChecked}
                              disabled={cat.value === 'other'}
                              onChange={() => {
                                const next = isChecked
                                  ? allowed.filter((v: string) => v !== cat.value)
                                  : [...allowed, cat.value];
                                updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, allowedReasons: next });
                              }}
                              className="rounded border-slate-300" />
                            <span>{cat.icon} {cat.label}</span>
                            <span className="text-[10px] text-slate-400">— {cat.hint}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Fotos — redireciona para photoRequirements */}
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    <p className="text-[10px] text-blue-600 bg-blue-50 rounded px-2 py-1">
                      📸 As fotos de pausa/retomada são configuradas em <strong>&quot;Fotos por momento&quot;</strong> (acima), nos momentos &quot;Ao pausar&quot; e &quot;Ao retomar&quot;.
                    </p>
                  </div>

                  {/* Notificações ricas — ao pausar */}
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    <p className="text-[10px] text-slate-500 font-medium mb-2">🔔 Notificações ao PAUSAR:</p>
                    <div className="space-y-2">
                      {/* Gestor ao pausar */}
                      <div className="rounded border border-violet-100 bg-violet-50/30 p-2">
                        <SubToggle checked={stage.timeControl.pauseSystem?.notifications?.onPause?.gestor?.enabled ?? true}
                          onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, gestor: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.gestor, enabled: v } } } })}
                          label="👔 Notificar gestor" />
                        {stage.timeControl.pauseSystem?.notifications?.onPause?.gestor?.enabled && (
                          <div className="mt-1.5 ml-5 space-y-1.5">
                            <SelectField label="Canal" value={stage.timeControl.pauseSystem?.notifications?.onPause?.gestor?.channel || 'whatsapp'}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, gestor: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.gestor, channel: v } } } })}
                              options={CHANNEL_OPTIONS} />
                            <TextAreaField label="Mensagem" value={stage.timeControl.pauseSystem?.notifications?.onPause?.gestor?.message || ''}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, gestor: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.gestor, message: v } } } })}
                              placeholder="Técnico {tecnico} pausou a OS {titulo}. Motivo: {motivo_pausa}." vars />
                          </div>
                        )}
                      </div>
                      {/* Cliente ao pausar */}
                      <div className="rounded border border-emerald-100 bg-emerald-50/30 p-2">
                        <SubToggle checked={stage.timeControl.pauseSystem?.notifications?.onPause?.cliente?.enabled ?? false}
                          onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, cliente: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.cliente, enabled: v } } } })}
                          label="👤 Notificar cliente" />
                        {stage.timeControl.pauseSystem?.notifications?.onPause?.cliente?.enabled && (
                          <div className="mt-1.5 ml-5 space-y-1.5">
                            <SelectField label="Canal" value={stage.timeControl.pauseSystem?.notifications?.onPause?.cliente?.channel || 'sms'}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, cliente: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.cliente, channel: v } } } })}
                              options={CHANNEL_OPTIONS} />
                            <TextAreaField label="Mensagem" value={stage.timeControl.pauseSystem?.notifications?.onPause?.cliente?.message || ''}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, cliente: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.cliente, message: v } } } })}
                              placeholder="Olá {cliente}, seu serviço {titulo} foi pausado temporariamente. Motivo: {motivo_pausa}." vars />
                          </div>
                        )}
                      </div>
                      {/* Técnico ao pausar */}
                      <div className="rounded border border-blue-100 bg-blue-50/30 p-2">
                        <SubToggle checked={stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico?.enabled ?? false}
                          onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, tecnico: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico, enabled: v } } } })}
                          label="👷 Confirmar ao técnico" />
                        {stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico?.enabled && (
                          <div className="mt-1.5 ml-5 space-y-1.5">
                            <SelectField label="Canal" value={stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico?.channel || 'push'}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, tecnico: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico, channel: v } } } })}
                              options={CHANNEL_OPTIONS} />
                            <TextAreaField label="Mensagem" value={stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico?.message || ''}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onPause: { ...stage.timeControl.pauseSystem?.notifications?.onPause, tecnico: { ...stage.timeControl.pauseSystem?.notifications?.onPause?.tecnico, message: v } } } })}
                              placeholder="Pausa registrada na OS {titulo}. Tempo pausado: {tempo_pausado}." vars />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notificações ricas — ao retomar */}
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    <p className="text-[10px] text-slate-500 font-medium mb-2">🔔 Notificações ao RETOMAR:</p>
                    <div className="space-y-2">
                      {/* Gestor ao retomar */}
                      <div className="rounded border border-violet-100 bg-violet-50/30 p-2">
                        <SubToggle checked={stage.timeControl.pauseSystem?.notifications?.onResume?.gestor?.enabled ?? false}
                          onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, gestor: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.gestor, enabled: v } } } })}
                          label="👔 Notificar gestor" />
                        {stage.timeControl.pauseSystem?.notifications?.onResume?.gestor?.enabled && (
                          <div className="mt-1.5 ml-5 space-y-1.5">
                            <SelectField label="Canal" value={stage.timeControl.pauseSystem?.notifications?.onResume?.gestor?.channel || 'whatsapp'}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, gestor: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.gestor, channel: v } } } })}
                              options={CHANNEL_OPTIONS} />
                            <TextAreaField label="Mensagem" value={stage.timeControl.pauseSystem?.notifications?.onResume?.gestor?.message || ''}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, gestor: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.gestor, message: v } } } })}
                              placeholder="Técnico {tecnico} retomou a OS {titulo}. Pausado por: {tempo_pausado}." vars />
                          </div>
                        )}
                      </div>
                      {/* Cliente ao retomar */}
                      <div className="rounded border border-emerald-100 bg-emerald-50/30 p-2">
                        <SubToggle checked={stage.timeControl.pauseSystem?.notifications?.onResume?.cliente?.enabled ?? false}
                          onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, cliente: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.cliente, enabled: v } } } })}
                          label="👤 Notificar cliente" />
                        {stage.timeControl.pauseSystem?.notifications?.onResume?.cliente?.enabled && (
                          <div className="mt-1.5 ml-5 space-y-1.5">
                            <SelectField label="Canal" value={stage.timeControl.pauseSystem?.notifications?.onResume?.cliente?.channel || 'sms'}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, cliente: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.cliente, channel: v } } } })}
                              options={CHANNEL_OPTIONS} />
                            <TextAreaField label="Mensagem" value={stage.timeControl.pauseSystem?.notifications?.onResume?.cliente?.message || ''}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, cliente: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.cliente, message: v } } } })}
                              placeholder="Olá {cliente}, seu serviço {titulo} foi retomado." vars />
                          </div>
                        )}
                      </div>
                      {/* Técnico ao retomar */}
                      <div className="rounded border border-blue-100 bg-blue-50/30 p-2">
                        <SubToggle checked={stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico?.enabled ?? false}
                          onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, tecnico: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico, enabled: v } } } })}
                          label="👷 Confirmar ao técnico" />
                        {stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico?.enabled && (
                          <div className="mt-1.5 ml-5 space-y-1.5">
                            <SelectField label="Canal" value={stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico?.channel || 'push'}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, tecnico: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico, channel: v } } } })}
                              options={CHANNEL_OPTIONS} />
                            <TextAreaField label="Mensagem" value={stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico?.message || ''}
                              onChange={v => updateTime('pauseSystem', { ...stage.timeControl.pauseSystem, notifications: { ...stage.timeControl.pauseSystem?.notifications, onResume: { ...stage.timeControl.pauseSystem?.notifications?.onResume, tecnico: { ...stage.timeControl.pauseSystem?.notifications?.onResume?.tecnico, message: v } } } })}
                              placeholder="Pausa registrada na OS {titulo}. Tempo pausado: {tempo_pausado}." vars />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-2">
                    ⏸️ O técnico verá um botão &quot;Pausar&quot; durante a execução. Ao pausar, o cronômetro para e os destinatários configurados são notificados.
                    O técnico pode retomar a qualquer momento.
                  </p>
                </ConfigRow>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
