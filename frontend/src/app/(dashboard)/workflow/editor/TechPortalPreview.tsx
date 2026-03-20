"use client";

import { useState } from "react";

export interface TechPortalConfig {
  showAddress: boolean;
  showValue: boolean;
  showDeadline: boolean;
  showDescription: boolean;
  showClient: boolean;
  customMessage: string;
}

export const DEFAULT_TECH_PORTAL_CONFIG: TechPortalConfig = {
  showAddress: true,
  showValue: true,
  showDeadline: true,
  showDescription: true,
  showClient: false,
  customMessage: "",
};

interface Props {
  config: TechPortalConfig;
  onChange: (config: TechPortalConfig) => void;
  onClose: () => void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-xs text-slate-600 group-hover:text-slate-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? "bg-blue-500" : "bg-slate-200"}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

export default function TechPortalPreview({ config, onChange, onClose }: Props) {
  const update = (key: keyof TechPortalConfig, value: boolean | string) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex gap-6 bg-white rounded-2xl shadow-2xl p-6 max-w-3xl w-full mx-4">
        {/* Left: Controls */}
        <div className="w-64 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Portal do Tecnico</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
          </div>
          <p className="text-[10px] text-slate-400 mb-4">Configure quais informacoes o tecnico visualiza ao acessar a OS pelo link.</p>

          <div className="space-y-0.5 border-t border-slate-100 pt-3">
            <Toggle label="Endereco" checked={config.showAddress} onChange={(v) => update("showAddress", v)} />
            <Toggle label="Valor" checked={config.showValue} onChange={(v) => update("showValue", v)} />
            <Toggle label="Prazo" checked={config.showDeadline} onChange={(v) => update("showDeadline", v)} />
            <Toggle label="Descricao da OS" checked={config.showDescription} onChange={(v) => update("showDescription", v)} />
            <Toggle label="Nome do cliente" checked={config.showClient} onChange={(v) => update("showClient", v)} />
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <label className="block text-xs text-slate-600 mb-1">Mensagem personalizada</label>
            <textarea
              value={config.customMessage}
              onChange={(e) => update("customMessage", e.target.value)}
              placeholder="Ex: Lembre-se de usar EPI..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
            />
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Concluir
          </button>
        </div>

        {/* Right: Phone Preview */}
        <div className="flex-1 flex justify-center">
          <div className="w-[280px] h-[560px] rounded-[2rem] border-[6px] border-slate-800 bg-slate-50 overflow-hidden shadow-xl flex flex-col">
            {/* Status bar */}
            <div className="bg-slate-800 px-4 py-1 flex items-center justify-between">
              <span className="text-[8px] text-white/60">20:30</span>
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              </div>
            </div>

            {/* App header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold text-white">Tecnikos</span>
              <div className="ml-auto h-2 w-2 rounded-full bg-green-400" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {/* Status badge + Title */}
              <div>
                <span className="inline-block rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[8px] font-semibold mb-1">Ofertada</span>
                <h2 className="text-sm font-bold text-slate-800">OS de Exemplo</h2>
              </div>

              {/* Custom message */}
              {config.customMessage && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-2">
                  <p className="text-[9px] text-blue-700 leading-relaxed">{config.customMessage}</p>
                </div>
              )}

              {/* Info card */}
              {(config.showAddress || config.showValue || config.showDeadline || config.showDescription || config.showClient) && (
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm space-y-2">
                  {config.showClient && (
                    <div className="flex items-start gap-2">
                      <div className="h-4 w-4 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[7px]">👤</span>
                      </div>
                      <div>
                        <p className="text-[7px] text-slate-400">Cliente</p>
                        <p className="text-[9px] font-medium text-slate-700">Joao da Silva</p>
                      </div>
                    </div>
                  )}
                  {config.showDescription && (
                    <p className="text-[9px] text-slate-500 leading-relaxed">Troca de disjuntor e revisao da fiacao do quadro de energia.</p>
                  )}
                  {config.showAddress && (
                    <div className="flex items-start gap-2">
                      <div className="h-4 w-4 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[7px]">📍</span>
                      </div>
                      <div>
                        <p className="text-[7px] text-slate-400">Endereco</p>
                        <p className="text-[9px] font-medium text-slate-700">Rua Exemplo, 123 - Centro</p>
                      </div>
                    </div>
                  )}
                  {config.showValue && (
                    <div className="flex items-start gap-2">
                      <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[7px]">💰</span>
                      </div>
                      <div>
                        <p className="text-[7px] text-slate-400">Valor</p>
                        <p className="text-[9px] font-bold text-slate-700">R$ 360,00</p>
                      </div>
                    </div>
                  )}
                  {config.showDeadline && (
                    <div className="flex items-start gap-2">
                      <div className="h-4 w-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[7px]">🕐</span>
                      </div>
                      <div>
                        <p className="text-[7px] text-slate-400">Prazo</p>
                        <p className="text-[9px] font-medium text-slate-700">19 de marco de 2026</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Workflow steps preview */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-slate-400">Fluxo: Avaliacao para Orcamento</span>
                  <span className="text-[8px] text-slate-300 ml-auto">0/1</span>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 flex items-center gap-2">
                  <span className="text-[9px]">✅</span>
                  <span className="text-[9px] font-medium text-green-700">Delay</span>
                  <span className="text-[7px] text-green-500 ml-auto">19/03, 20:45</span>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 flex items-center gap-2">
                  <span className="text-[9px]">✅</span>
                  <span className="text-[9px] font-medium text-green-700">Status</span>
                  <span className="text-[7px] text-green-500 ml-auto">19/03, 20:45</span>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 flex items-center gap-2">
                  <span className="text-[9px]">🎯</span>
                  <span className="text-[9px] font-medium text-orange-700">Botoes de Acao</span>
                </div>
              </div>
            </div>

            {/* Bottom nav */}
            <div className="bg-white border-t border-slate-200 px-6 py-2 flex justify-around">
              <div className="flex flex-col items-center">
                <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15" />
                </svg>
                <span className="text-[7px] text-blue-600 font-medium">Minhas OS</span>
              </div>
              <div className="flex flex-col items-center">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
                <span className="text-[7px] text-slate-400">Perfil</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
