'use client';

import { useState } from 'react';
import type { TechnicianOnboardingConfig } from '@/types/stage-config';
import { CHANNEL_OPTIONS } from '@/types/stage-config';

/* ── Props ─────────────────────────────────────────────────── */

interface Props {
  config: TechnicianOnboardingConfig;
  onChange: (config: TechnicianOnboardingConfig) => void;
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
  return <div className="ml-13 pl-3 border-l-2 border-purple-100 mt-2 space-y-2 animate-fadeIn">{children}</div>;
}

/* ── Sub-section for a trigger (new tech or new specialization) ── */

function TriggerSection({
  title,
  hint,
  triggerConfig,
  onChange,
}: {
  title: string;
  hint: string;
  triggerConfig: TechnicianOnboardingConfig['onNewTechnician'];
  onChange: (c: TechnicianOnboardingConfig['onNewTechnician']) => void;
}) {
  const update = (patch: Partial<TechnicianOnboardingConfig['onNewTechnician']>) =>
    onChange({ ...triggerConfig, ...patch });

  return (
    <div className="space-y-3">
      <Toggle
        checked={triggerConfig.enabled}
        onChange={(v) => update({ enabled: v })}
        label={title}
        hint={hint}
      />

      <ConfigRow visible={triggerConfig.enabled}>
        {/* Send contract link */}
        <Toggle
          checked={triggerConfig.sendContractLink}
          onChange={(v) => update({ sendContractLink: v })}
          label="Enviar link de contrato"
          hint="Envia um link para o tecnico visualizar e aceitar o contrato"
        />

        <ConfigRow visible={triggerConfig.sendContractLink}>
          {/* Channel */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Canal:</span>
            <select
              value={triggerConfig.channel}
              onChange={(e) => update({ channel: e.target.value })}
              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value.toUpperCase()}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {/* Contract name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Nome do contrato:</span>
            <input
              type="text"
              value={triggerConfig.contractName}
              onChange={(e) => update({ contractName: e.target.value })}
              placeholder="Ex: Contrato de Prestacao de Servicos"
              className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </label>

          {/* Contract content */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Conteudo do contrato:</span>
            <textarea
              value={triggerConfig.contractContent}
              onChange={(e) => update({ contractContent: e.target.value })}
              placeholder="Digite o texto do contrato que o tecnico devera aceitar..."
              rows={6}
              className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {['{nome}', '{empresa}', '{especializacao}', '{data}'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ contractContent: triggerConfig.contractContent + v })}
                  title={`Inserir variavel ${v}`}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-600 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </label>

          {/* Notification message */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Mensagem de notificacao:</span>
            <textarea
              value={triggerConfig.notifyMessage}
              onChange={(e) => update({ notifyMessage: e.target.value })}
              placeholder="Mensagem enviada junto com o link..."
              rows={2}
              className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-none"
            />
          </label>

          {/* Options row */}
          <div className="flex flex-wrap gap-4">
            <SubToggle
              checked={triggerConfig.requireAcceptance}
              onChange={(v) => update({ requireAcceptance: v })}
              label="Pedir aceite"
            />
            <SubToggle
              checked={triggerConfig.requireSignature}
              onChange={(v) => update({ requireSignature: v })}
              label="Pedir assinatura digital"
            />
            <SubToggle
              checked={triggerConfig.blockUntilAccepted}
              onChange={(v) => update({ blockUntilAccepted: v })}
              label="Bloquear tecnico ate aceitar"
            />
          </div>

          {/* Expiration */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Expiracao:</span>
            <input
              type="number"
              value={triggerConfig.expirationDays}
              min={1}
              max={90}
              onChange={(e) => update({ expirationDays: parseInt(e.target.value) || 7 })}
              className="text-xs rounded border border-slate-300 px-2 py-1 w-16 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            />
            <span className="text-xs text-slate-400">dias</span>
          </label>
        </ConfigRow>
      </ConfigRow>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */

export default function TechnicianOnboardingSection({ config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const enabledCount =
    (config.onNewTechnician.enabled ? 1 : 0) +
    (config.onNewSpecialization.enabled ? 1 : 0);

  return (
    <div className={`rounded-xl border-2 transition-all ${config.enabled ? 'border-purple-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        {/* Left side */}
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
          onClick={() => config.enabled && setExpanded(!expanded)}
        >
          <span className={`text-xs text-slate-400 transition-transform ${config.enabled && expanded ? 'rotate-90' : ''}`}>
            {config.enabled ? '\u25B6' : ''}
          </span>
          <span className="text-lg">👷</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Novo Tecnico</h3>
            <p className="text-xs text-slate-400">Onboarding e contrato</p>
          </div>
          {config.enabled && enabledCount > 0 && (
            <span className="ml-2 shrink-0 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              {enabledCount} {enabledCount === 1 ? 'gatilho' : 'gatilhos'}
            </span>
          )}
          {config.enabled && !expanded && enabledCount > 0 && (
            <span className="text-[10px] text-slate-400 hidden sm:inline">&mdash; clique para expandir</span>
          )}
        </div>
        {/* Right side — toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium ${config.enabled ? 'text-purple-600' : 'text-slate-400'}`}>
            {config.enabled ? 'Ativo' : 'Desativado'}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                const enabling = e.target.checked;
                onChange({ ...config, enabled: enabling });
                if (enabling) setExpanded(true);
              }}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-purple-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
          </label>
        </div>
      </div>

      {/* Disabled hint */}
      {!config.enabled && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-400 italic">Desativado &mdash; ative para configurar envio de contratos ao cadastrar tecnicos</p>
        </div>
      )}

      {/* Enabled but minimized */}
      {config.enabled && !expanded && (
        <div className="px-4 pb-3 cursor-pointer" onClick={() => setExpanded(true)}>
          <div className="flex flex-wrap gap-1.5">
            {config.onNewTechnician.enabled && (
              <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                👷 Novo tecnico
              </span>
            )}
            {config.onNewSpecialization.enabled && (
              <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                🔧 Nova especializacao
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {config.enabled && expanded && (
        <div className="px-4 pb-5 space-y-5 border-t border-purple-100 pt-4">
          {/* Trigger 1: New Technician */}
          <TriggerSection
            title="Quando tecnico e cadastrado"
            hint="Dispara quando um parceiro recebe o tipo TECNICO"
            triggerConfig={config.onNewTechnician}
            onChange={(c) => onChange({ ...config, onNewTechnician: c })}
          />

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Trigger 2: New Specialization */}
          <TriggerSection
            title="Quando nova especializacao e atribuida"
            hint="Dispara quando uma especializacao e adicionada ao tecnico"
            triggerConfig={config.onNewSpecialization}
            onChange={(c) => onChange({ ...config, onNewSpecialization: c })}
          />
        </div>
      )}
    </div>
  );
}
