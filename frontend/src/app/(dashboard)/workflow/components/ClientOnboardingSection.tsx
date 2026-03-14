'use client';

import { useState, useRef } from 'react';
import type { ClientOnboardingConfig } from '@/types/stage-config';
import { CHANNEL_OPTIONS } from '@/types/stage-config';

const EXPIRATION_UNITS = [
  { value: 'days', label: 'Dias' },
  { value: 'months', label: 'Meses' },
  { value: 'years', label: 'Anos' },
  { value: 'indefinite', label: 'Indeterminado' },
] as const;

/* ── Props ─────────────────────────────────────────────────── */

interface Props {
  config: ClientOnboardingConfig;
  onChange: (config: ClientOnboardingConfig) => void;
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

/* ── Variables ────────────────────────────────────────────── */

const CLIENT_WELCOME_VARIABLES = ['{nome}', '{empresa}', '{razao_social}', '{telefone}', '{email}', '{data}'];
const CLIENT_CONTRACT_VARIABLES = ['{nome}', '{empresa}', '{razao_social}', '{cnpj_empresa}', '{endereco_empresa}', '{documento}', '{email}', '{telefone}', '{data}'];

const DEFAULT_POSITIVE_KEYWORDS = ['sim', 'aceito', 'confirmo', 'ok', 'pode ser', 'quero', 'topo', 'bora'];
const DEFAULT_NEGATIVE_KEYWORDS = ['nao', 'não', 'recuso', 'desisto', 'nao quero', 'não quero', 'cancela'];
const DEFAULT_REPLY_MESSAGE = 'Perfeito {nome}! Seu cadastro como cliente esta confirmado. Em breve voce podera solicitar servicos pela plataforma.';
const DEFAULT_DECLINE_MESSAGE = 'Atencao: o cliente {nome} ({email}) recusou o cadastro. Resposta: "{resposta}".';

const CONFIRM_VIA_OPTIONS = [
  { value: 'WHATSAPP', label: 'Resposta WhatsApp' },
  { value: 'LINK', label: 'Link de confirmacao' },
] as const;

/* ── Main Component ───────────────────────────────────────── */

export default function ClientOnboardingSection({ config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notifyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const declineTextareaRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<ClientOnboardingConfig>) =>
    onChange({ ...config, ...patch });

  /* ── Variable insertion helpers ─────────────────────────── */

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      update({ contractContent: config.contractContent + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.contractContent;
    const newText = text.substring(0, start) + variable + text.substring(end);
    update({ contractContent: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const insertNotifyVariable = (variable: string) => {
    const textarea = notifyTextareaRef.current;
    if (!textarea) {
      update({ notifyMessage: (config.notifyMessage || '') + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.notifyMessage || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    update({ notifyMessage: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const insertWelcomeVariable = (variable: string) => {
    const textarea = welcomeTextareaRef.current;
    if (!textarea) {
      update({ welcomeMessage: (config.welcomeMessage || '') + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.welcomeMessage || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    update({ welcomeMessage: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const insertReplyVariable = (variable: string) => {
    const textarea = replyTextareaRef.current;
    if (!textarea) {
      update({ welcomeReplyMessage: (config.welcomeReplyMessage ?? DEFAULT_REPLY_MESSAGE) + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.welcomeReplyMessage ?? DEFAULT_REPLY_MESSAGE;
    const newText = text.substring(0, start) + variable + text.substring(end);
    update({ welcomeReplyMessage: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const insertDeclineVariable = (variable: string) => {
    const textarea = declineTextareaRef.current;
    if (!textarea) {
      update({ welcomeDeclineMessage: (config.welcomeDeclineMessage ?? DEFAULT_DECLINE_MESSAGE) + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.welcomeDeclineMessage ?? DEFAULT_DECLINE_MESSAGE;
    const newText = text.substring(0, start) + variable + text.substring(end);
    update({ welcomeDeclineMessage: newText });
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const expirationUnit = config.expirationUnit || 'days';

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className={`rounded-xl border-2 transition-all ${config.enabled ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
          onClick={() => config.enabled && setExpanded(!expanded)}
        >
          <span className={`text-xs text-slate-400 transition-transform ${config.enabled && expanded ? 'rotate-90' : ''}`}>
            {config.enabled ? '\u25B6' : ''}
          </span>
          <span className="text-lg">👤</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Onboarding de Cliente</h3>
            <p className="text-xs text-slate-400">Boas-vindas e termos de servico para novos clientes</p>
          </div>
          {config.enabled && (
            <>
              {(config.sendContractLink || config.sendWelcomeMessage) && (
                <span className="ml-2 shrink-0 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {(config.sendContractLink ? 1 : 0) + (config.sendWelcomeMessage ? 1 : 0)} {(config.sendContractLink ? 1 : 0) + (config.sendWelcomeMessage ? 1 : 0) === 1 ? 'acao' : 'acoes'}
                </span>
              )}
              {!expanded && (config.sendContractLink || config.sendWelcomeMessage) && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">&mdash; clique para expandir</span>
              )}
            </>
          )}
        </div>
        {/* Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium ${config.enabled ? 'text-blue-600' : 'text-slate-400'}`}>
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
            <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
          </label>
        </div>
      </div>

      {/* Disabled hint */}
      {!config.enabled && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-400 italic">Desativado — ative para configurar boas-vindas e termos ao cadastrar clientes</p>
        </div>
      )}

      {/* Enabled but minimized */}
      {config.enabled && !expanded && (
        <div className="px-4 pb-3 cursor-pointer" onClick={() => setExpanded(true)}>
          <div className="flex flex-wrap gap-1.5">
            {config.sendContractLink && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                📄 Termos de servico
              </span>
            )}
            {config.sendWelcomeMessage && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                💬 Mensagem de boas-vindas
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {config.enabled && expanded && (
        <div className="px-4 pb-5 space-y-4 border-t border-blue-100 pt-4">

          {/* ── Termos de Servico / Contrato ── */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">TERMOS</span>
              <span className="text-xs text-slate-500">Contrato de prestacao de servicos</span>
            </div>
            <Toggle
              checked={config.sendContractLink}
              onChange={(v) => update({ sendContractLink: v })}
              label="Enviar termos de servico"
              hint="Envia um link para o cliente visualizar e aceitar os termos de prestacao de servicos"
            />

            <ConfigRow visible={config.sendContractLink}>
              {/* Channel */}
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Canal:</span>
                <select
                  value={config.channel}
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
                <span className="text-xs text-slate-500">Nome do documento:</span>
                <input
                  type="text"
                  value={config.contractName}
                  onChange={(e) => update({ contractName: e.target.value })}
                  placeholder="Ex: Termos de Prestacao de Servicos"
                  className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </label>

              {/* Contract content */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Conteudo dos termos:</span>
                <textarea
                  ref={textareaRef}
                  value={config.contractContent}
                  onChange={(e) => update({ contractContent: e.target.value })}
                  placeholder="Digite o texto dos termos de servico que o cliente devera aceitar..."
                  rows={6}
                  className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-slate-400 mr-1 self-center">Variaveis:</span>
                  {CLIENT_CONTRACT_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      title={`Inserir ${v} na posicao do cursor`}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification message */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Mensagem de notificacao:</span>
                <textarea
                  ref={notifyTextareaRef}
                  value={config.notifyMessage}
                  onChange={(e) => update({ notifyMessage: e.target.value })}
                  placeholder="Mensagem enviada junto com o link dos termos..."
                  rows={3}
                  className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-slate-400 mr-1 self-center">Variaveis:</span>
                  {CLIENT_WELCOME_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertNotifyVariable(v)}
                      title={`Inserir ${v} na posicao do cursor`}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options row */}
              <div className="flex flex-wrap gap-4">
                <SubToggle
                  checked={config.requireAcceptance}
                  onChange={(v) => update({ requireAcceptance: v })}
                  label="Pedir aceite"
                />
                <SubToggle
                  checked={config.requireSignature}
                  onChange={(v) => update({ requireSignature: v })}
                  label="Pedir assinatura digital"
                />
                <SubToggle
                  checked={config.blockUntilAccepted}
                  onChange={(v) => update({ blockUntilAccepted: v })}
                  label="Bloquear cliente ate aceitar"
                />
              </div>

              {/* Expiration */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Validade:</span>
                <select
                  value={expirationUnit}
                  onChange={(e) => {
                    const unit = e.target.value as 'days' | 'months' | 'years' | 'indefinite';
                    if (unit === 'indefinite') {
                      update({ expirationUnit: unit, expirationDays: 0 });
                    } else {
                      update({ expirationUnit: unit, expirationDays: config.expirationDays || 30 });
                    }
                  }}
                  className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                >
                  {EXPIRATION_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                {expirationUnit !== 'indefinite' && (
                  <input
                    type="number"
                    value={config.expirationDays}
                    min={1}
                    max={expirationUnit === 'years' ? 10 : expirationUnit === 'months' ? 120 : 365}
                    onChange={(e) => update({ expirationDays: parseInt(e.target.value) || 30 })}
                    className="text-xs rounded border border-slate-300 px-2 py-1 w-16 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                )}
                {expirationUnit === 'indefinite' && (
                  <span className="text-xs text-slate-400 italic">Sem data de expiracao</span>
                )}
              </div>
            </ConfigRow>
          </div>

          {/* ── Mensagem de Boas-vindas ── */}
          <div className="rounded-lg border border-green-200 bg-green-50/30 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-100 px-1.5 py-0.5 rounded">MENSAGEM</span>
              <span className="text-xs text-slate-500">Boas-vindas ao cliente</span>
            </div>
            <Toggle
              checked={config.sendWelcomeMessage ?? false}
              onChange={(v) => update({ sendWelcomeMessage: v })}
              label="Enviar mensagem de boas-vindas"
              hint="Envia mensagem de boas-vindas ao novo cliente com opcao de confirmacao"
            />

            <ConfigRow visible={config.sendWelcomeMessage ?? false}>
              {/* Channel */}
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Canal:</span>
                <select
                  value={config.welcomeChannel || 'WHATSAPP'}
                  onChange={(e) => update({ welcomeChannel: e.target.value })}
                  className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                >
                  {CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value.toUpperCase()}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Welcome message */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Mensagem de boas-vindas:</span>
                <textarea
                  ref={welcomeTextareaRef}
                  value={config.welcomeMessage || ''}
                  onChange={(e) => update({ welcomeMessage: e.target.value })}
                  placeholder="Digite a mensagem de boas-vindas para o cliente..."
                  rows={3}
                  className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none resize-y"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-slate-400 mr-1 self-center">Variaveis:</span>
                  {CLIENT_WELCOME_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertWelcomeVariable(v)}
                      title={`Inserir ${v} na posicao do cursor`}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-600 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wait for reply + confirm via */}
              <div className="space-y-2">
                <SubToggle
                  checked={config.welcomeWaitForReply ?? false}
                  onChange={(v) => update({ welcomeWaitForReply: v })}
                  label="Aguardar confirmacao do cliente"
                />

                {(config.welcomeWaitForReply ?? false) && (
                  <div className="ml-5 space-y-3 animate-fadeIn">
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Confirmar via:</span>
                      <select
                        value={config.welcomeConfirmVia || 'WHATSAPP'}
                        onChange={(e) => update({ welcomeConfirmVia: e.target.value })}
                        className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                      >
                        {CONFIRM_VIA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    <p className="text-[10px] text-slate-400 italic">
                      {(config.welcomeConfirmVia || 'WHATSAPP') === 'WHATSAPP'
                        ? 'O cliente confirma respondendo qualquer mensagem no WhatsApp'
                        : 'O cliente confirma clicando em um link'}
                    </p>

                    {/* ── Resposta Positiva (Aceite) ── */}
                    <div className="rounded border border-green-200 bg-green-50/50 p-2.5 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">&#10003; Se aceitar</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">Mensagem de retorno:</span>
                        <textarea
                          ref={replyTextareaRef}
                          value={config.welcomeReplyMessage ?? DEFAULT_REPLY_MESSAGE}
                          onChange={(e) => update({ welcomeReplyMessage: e.target.value })}
                          placeholder="Ex: Perfeito {nome}, seu cadastro esta confirmado!"
                          rows={2}
                          className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none resize-y"
                        />
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-slate-400 mr-1 self-center">Variaveis:</span>
                          {['{nome}', '{empresa}', '{razao_social}', '{data}'].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => insertReplyVariable(v)}
                              title={`Inserir ${v} na posicao do cursor`}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-700 transition-colors cursor-pointer"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">Palavras-chave de aceite:</span>
                        <input
                          type="text"
                          value={(config.welcomePositiveKeywords?.length ? config.welcomePositiveKeywords : DEFAULT_POSITIVE_KEYWORDS).join(', ')}
                          onChange={(e) => update({ welcomePositiveKeywords: e.target.value.split(',').map(s => s.trim()) })}
                          onBlur={(e) => update({ welcomePositiveKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                          placeholder="sim, aceito, confirmo, ok, quero, topo, bora"
                          className="text-xs rounded border border-slate-300 px-2 py-1 focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none"
                        />
                        <span className="text-[10px] text-slate-400 italic">Separar por virgula. Se a resposta conter qualquer uma dessas palavras, sera considerada aceite.</span>
                      </div>
                    </div>

                    {/* ── Resposta Negativa (Recusa) ── */}
                    <div className="rounded border border-red-200 bg-red-50/50 p-2.5 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">&#10007; Se recusar</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">Palavras-chave de recusa:</span>
                        <input
                          type="text"
                          value={(config.welcomeNegativeKeywords?.length ? config.welcomeNegativeKeywords : DEFAULT_NEGATIVE_KEYWORDS).join(', ')}
                          onChange={(e) => update({ welcomeNegativeKeywords: e.target.value.split(',').map(s => s.trim()) })}
                          onBlur={(e) => update({ welcomeNegativeKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                          placeholder="nao, não, recuso, desisto, cancela"
                          className="text-xs rounded border border-slate-300 px-2 py-1 focus:border-red-500 focus:ring-1 focus:ring-red-200 outline-none"
                        />
                        <span className="text-[10px] text-slate-400 italic">Separar por virgula. Se a resposta conter qualquer uma dessas palavras (e nenhuma de aceite), sera considerada recusa.</span>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-500">Acoes na recusa:</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(config.welcomeDeclineActions ?? ['NOTIFY_GESTOR']).includes('DEACTIVATE')}
                            onChange={(e) => {
                              const current = config.welcomeDeclineActions ?? ['NOTIFY_GESTOR'];
                              const next = e.target.checked
                                ? [...current.filter(a => a !== 'DEACTIVATE'), 'DEACTIVATE']
                                : current.filter(a => a !== 'DEACTIVATE');
                              update({ welcomeDeclineActions: next });
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-200"
                          />
                          <span className="text-xs text-slate-600">Desativar cadastro do cliente</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(config.welcomeDeclineActions ?? ['NOTIFY_GESTOR']).includes('NOTIFY_GESTOR')}
                            onChange={(e) => {
                              const current = config.welcomeDeclineActions ?? ['NOTIFY_GESTOR'];
                              const next = e.target.checked
                                ? [...current.filter(a => a !== 'NOTIFY_GESTOR'), 'NOTIFY_GESTOR']
                                : current.filter(a => a !== 'NOTIFY_GESTOR');
                              update({ welcomeDeclineActions: next });
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-200"
                          />
                          <span className="text-xs text-slate-600">Notificar o gestor</span>
                        </label>
                      </div>
                      {(config.welcomeDeclineActions ?? ['NOTIFY_GESTOR']).includes('NOTIFY_GESTOR') && (
                        <div className="flex flex-col gap-1 animate-fadeIn">
                          <span className="text-xs text-slate-500">Mensagem de notificacao ao gestor:</span>
                          <textarea
                            ref={declineTextareaRef}
                            value={config.welcomeDeclineMessage ?? DEFAULT_DECLINE_MESSAGE}
                            onChange={(e) => update({ welcomeDeclineMessage: e.target.value })}
                            placeholder='Ex: {nome} recusou o cadastro. Resposta: "{resposta}"'
                            rows={2}
                            className="text-sm rounded border border-slate-300 px-2 py-1.5 focus:border-red-500 focus:ring-1 focus:ring-red-200 outline-none resize-y"
                          />
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-slate-400 mr-1 self-center">Variaveis:</span>
                            {['{nome}', '{empresa}', '{resposta}'].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => insertDeclineVariable(v)}
                                title={`Inserir ${v} na posicao do cursor`}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 transition-colors cursor-pointer"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ConfigRow>
          </div>

        </div>
      )}
    </div>
  );
}
