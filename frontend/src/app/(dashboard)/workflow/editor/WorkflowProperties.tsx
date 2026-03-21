"use client";

import { useState, useRef } from "react";
import { type Block, getCatalogEntry } from "@/types/workflow-blocks";

const EMOJI_OPTIONS = [
  "✅", "❌", "🚀", "📍", "🔧", "✋", "👍", "👎", "⏳", "🔄",
  "📋", "📞", "💬", "⚠️", "🛑", "🎯", "📦", "🏠", "🚗", "💰",
  "📸", "🔑", "⭐", "🔔", "📝", "🗓️", "👷", "🛠️", "📊", "💡",
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-7 w-10 rounded border border-slate-200 text-center text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors"
        title="Escolher emoji"
      >
        {value || "😀"}
      </button>
      {open && (
        <div className="absolute z-50 top-8 right-0 bg-white rounded-lg border border-slate-200 shadow-lg p-2 w-[200px] grid grid-cols-6 gap-1">
          {EMOJI_OPTIONS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => { onChange(em); setOpen(false); }}
              className={`h-7 w-7 rounded text-sm hover:bg-blue-50 flex items-center justify-center ${value === em ? "bg-blue-100 ring-1 ring-blue-400" : ""}`}
            >
              {em}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="col-span-6 text-[10px] text-red-400 hover:text-red-600 mt-1"
            >
              Remover emoji
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  block: Block | null;
  onChange: (block: Block) => void;
}

const OS_STATUSES = [
  { value: "ABERTA", label: "Aberta" },
  { value: "OFERTADA", label: "Ofertada" },
  { value: "ATRIBUIDA", label: "Atribuida" },
  { value: "A_CAMINHO", label: "A Caminho" },
  { value: "EM_EXECUCAO", label: "Em Execucao" },
  { value: "CONCLUIDA", label: "Concluida" },
  { value: "APROVADA", label: "Aprovada" },
  { value: "RECUSADA", label: "Recusada" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-slate-500 mb-1 mt-3 first:mt-0">{children}</label>;
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
      <span className="text-xs text-slate-600">{label}</span>
    </label>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
    />
  );
}

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1">
          <input
            value={item}
            onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            placeholder={placeholder || `Item ${i + 1}`}
            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400"
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="px-1.5 text-xs text-red-400 hover:text-red-600"
            title="Remover"
          >x</button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="text-[10px] text-blue-500 hover:text-blue-600 font-medium"
      >+ Adicionar item</button>
    </div>
  );
}

/* ── Confirm Button Editor — same visual pattern as ACTION_BUTTONS ── */
const CONFIRM_BTN_COLORS = [
  { value: "green", label: "Verde", bg: "bg-green-500", preview: "bg-gradient-to-r from-green-500 to-green-600 text-white" },
  { value: "blue", label: "Azul", bg: "bg-blue-500", preview: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
  { value: "red", label: "Vermelho", bg: "bg-red-500", preview: "bg-gradient-to-r from-red-500 to-red-600 text-white" },
  { value: "yellow", label: "Amarelo", bg: "bg-yellow-500", preview: "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white" },
  { value: "slate", label: "Cinza", bg: "bg-slate-500", preview: "bg-gradient-to-r from-slate-500 to-slate-600 text-white" },
];
const CONFIRM_BTN_SIZES = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
];

function ConfirmButtonEditor({ config, onChange }: { config: { label: string; color: string; icon: string; size?: string }; onChange: (btn: { label: string; color: string; icon: string; size?: string }) => void }) {
  const btn = config || { label: "Confirmar", color: "blue", icon: "✅", size: "md" };
  const colorDef = CONFIRM_BTN_COLORS.find(c => c.value === btn.color) || CONFIRM_BTN_COLORS[1];
  const btnSize = btn.size || "md";
  const btnSizePreview = btnSize === "sm" ? "py-2 text-[10px]" : btnSize === "lg" ? "py-5 text-base" : "py-3 text-xs";
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
      <p className="text-[11px] font-medium text-slate-500">Botão de confirmação</p>

      <div className="flex items-center gap-1.5">
        <EmojiPicker value={btn.icon || ""} onChange={(v) => onChange({ ...btn, icon: v })} />
        <input
          value={btn.label}
          onChange={(e) => onChange({ ...btn, label: e.target.value })}
          placeholder="Texto do botão"
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
        />
      </div>

      <div className="flex gap-1">
        {CONFIRM_BTN_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange({ ...btn, color: c.value })}
            className={`h-5 w-5 rounded-full ${c.bg} ${btn.color === c.value ? "ring-2 ring-offset-1 ring-blue-400" : "opacity-60 hover:opacity-100"}`}
            title={c.label}
          />
        ))}
      </div>

      <Label>Tamanho do botão</Label>
      <div className="flex gap-1">
        {CONFIRM_BTN_SIZES.map(s => (
          <button key={s.value} type="button"
            onClick={() => onChange({ ...btn, size: s.value })}
            className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-all ${
              btnSize === s.value ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >{s.label}</button>
        ))}
      </div>

      {/* Preview */}
      <div className={`rounded-xl text-center font-bold shadow-sm ${btnSizePreview} ${colorDef.preview}`}>
        {btn.icon ? `${btn.icon} ` : ""}{btn.label || "..."}
      </div>
    </div>
  );
}

function FormFieldsEditor({ fields, onChange }: { fields: any[]; onChange: (fields: any[]) => void }) {
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-2 space-y-1.5">
          <div className="flex gap-1">
            <input
              value={f.name}
              onChange={(e) => { const n = [...fields]; n[i] = { ...f, name: e.target.value }; onChange(n); }}
              placeholder="Nome do campo"
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
            />
            <select
              value={f.type}
              onChange={(e) => { const n = [...fields]; n[i] = { ...f, type: e.target.value }; onChange(n); }}
              className="rounded border border-slate-200 px-2 py-1 text-xs outline-none"
            >
              <option value="text">Texto</option>
              <option value="number">Numero</option>
              <option value="select">Selecao</option>
            </select>
            <button onClick={() => onChange(fields.filter((_, idx) => idx !== i))} className="px-1 text-xs text-red-400 hover:text-red-600">x</button>
          </div>
          <Checkbox
            checked={f.required || false}
            onChange={(v) => { const n = [...fields]; n[i] = { ...f, required: v }; onChange(n); }}
            label="Obrigatorio"
          />
        </div>
      ))}
      <button
        onClick={() => onChange([...fields, { name: "", type: "text", required: false }])}
        className="text-[10px] text-blue-500 hover:text-blue-600 font-medium"
      >+ Adicionar campo</button>
    </div>
  );
}

// Reusable "Ao entrar no raio" notification section — MUST be outside WorkflowProperties
// to avoid React remounting on every render (function identity changes inside components)
const PROXIMITY_VARS = [
  { var: "{tecnico}", label: "Técnico" },
  { var: "{cliente}", label: "Cliente" },
  { var: "{codigo}", label: "Código OS" },
  { var: "{titulo}", label: "Título OS" },
  { var: "{endereco}", label: "Endereço" },
  { var: "{empresa}", label: "Empresa" },
  { var: "{telefone_empresa}", label: "Tel. Empresa" },
];

function OnEnterRadiusNotifications({ onEnter, updateOnEnter }: { onEnter: any; updateOnEnter: (key: string, val: any) => void }) {
  const notifCliente = onEnter.notifyCliente || { enabled: false, channel: "WHATSAPP", message: "" };
  const notifGestor = onEnter.notifyGestor || { enabled: false, channel: "WHATSAPP", message: "" };
  const alert = onEnter.alert || { enabled: false, message: "" };

  const updateNotifField = (notifKey: string, field: string, value: any) => {
    const current = onEnter[notifKey] || {};
    updateOnEnter(notifKey, { ...current, [field]: value });
  };

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-[11px] font-medium text-slate-500 mb-2">Ao entrar no raio</p>

      <Checkbox checked={notifCliente.enabled} onChange={(v) => updateNotifField("notifyCliente", "enabled", v)} label="Notificar cliente" />
      {notifCliente.enabled && (
        <div className="ml-4 space-y-1 mb-2">
          <Select value={notifCliente.channel || "WHATSAPP"} onChange={(v) => updateNotifField("notifyCliente", "channel", v)}
            options={[{ value: "WHATSAPP", label: "WhatsApp" }, { value: "EMAIL", label: "Email" }, { value: "SMS", label: "SMS" }, { value: "PUSH", label: "Push" }]} />
          <TextArea value={notifCliente.message || ""}
            onChange={(v) => updateNotifField("notifyCliente", "message", v)}
            placeholder="Ex: Olá {cliente}, o técnico {tecnico} está chegando!"
            rows={2} />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {PROXIMITY_VARS.map(v => (
              <button key={v.var} type="button"
                onClick={() => updateNotifField("notifyCliente", "message", (notifCliente.message || "") + " " + v.var)}
                className="text-[10px] bg-slate-100 hover:bg-green-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer">
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Checkbox checked={notifGestor.enabled} onChange={(v) => updateNotifField("notifyGestor", "enabled", v)} label="Notificar gestor" />
      {notifGestor.enabled && (
        <div className="ml-4 space-y-1 mb-2">
          <Select value={notifGestor.channel || "PUSH"} onChange={(v) => updateNotifField("notifyGestor", "channel", v)}
            options={[{ value: "WHATSAPP", label: "WhatsApp" }, { value: "EMAIL", label: "Email" }, { value: "PUSH", label: "Push" }]} />
          <TextArea value={notifGestor.message || ""}
            onChange={(v) => updateNotifField("notifyGestor", "message", v)}
            placeholder="Ex: Técnico {tecnico} está próximo da OS {codigo}"
            rows={2} />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {PROXIMITY_VARS.map(v => (
              <button key={v.var} type="button"
                onClick={() => updateNotifField("notifyGestor", "message", (notifGestor.message || "") + " " + v.var)}
                className="text-[10px] bg-slate-100 hover:bg-green-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer">
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Checkbox checked={alert.enabled} onChange={(v) => updateNotifField("alert", "enabled", v)} label="Alerta no dashboard" />
      {alert.enabled && (
        <div className="ml-4 space-y-1 mb-2">
          <Input value={alert.message || ""}
            onChange={(v) => updateNotifField("alert", "message", v)}
            placeholder="Técnico {tecnico} chegou na região" />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {PROXIMITY_VARS.map(v => (
              <button key={v.var} type="button"
                onClick={() => updateNotifField("alert", "message", (alert.message || "") + " " + v.var)}
                className="text-[10px] bg-slate-100 hover:bg-green-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer">
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Label>Mudar status ao entrar no raio</Label>
      <Select value={onEnter.autoChangeStatus || ""} onChange={(v) => updateOnEnter("autoChangeStatus", v)}
        options={[
          { value: "", label: "Não mudar" },
          { value: "EM_EXECUCAO", label: "Em Execução" },
          { value: "NO_LOCAL", label: "No Local" },
        ]} />
    </div>
  );
}

export default function WorkflowProperties({ block, onChange }: Props) {
  if (!block) {
    return (
      <div className="w-72 shrink-0 border-l border-slate-200 bg-slate-50/50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <svg className="h-6 w-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
            </svg>
          </div>
          <p className="text-xs text-slate-400">Selecione um bloco para editar suas propriedades</p>
        </div>
      </div>
    );
  }

  const cat = getCatalogEntry(block.type);
  const cfg = block.config || {};

  function updateConfig(key: string, value: any, extra?: Record<string, any>) {
    onChange({ ...block, config: { ...cfg, [key]: value, ...extra } });
  }

  function updateName(name: string) {
    onChange({ ...block, name });
  }

  // Default messages per recipient type
  const DEFAULT_MESSAGES: Record<string, string> = {
    CLIENTE: "Ola {nome}, informamos que o servico {titulo} foi concluido com sucesso pelo tecnico {tecnico}. A {razao_social} agradece pela preferencia! Qualquer duvida, entre em contato.",
    TECNICO: "Ola {nome}, tudo bem? A {razao_social} tem um novo servico para voce! OS: {titulo}. Cliente: {nome_cliente}. Endereco: {endereco}. Data: {data_agendamento}. Confira os detalhes no app: {link_app}",
    FORNECEDOR: "Prezado {nome}, a {razao_social} solicita o fornecimento de materiais para a OS {titulo}. Endereco de entrega: {endereco}. Prazo: {data_agendamento}. Para duvidas, contate {empresa} pelo {telefone_empresa}.",
    GESTOR: "{tecnico} concluiu a OS {titulo} ({nome_cliente}, {endereco}). Verifique o relatorio e fotos no sistema.",
  };

  // Recipient editor for NOTIFY blocks
  function NotifyRecipients() {
    const recipients = Array.isArray(cfg.recipients) ? cfg.recipients : [];
    const updateRecipient = (idx: number, key: string, val: any) => {
      const n = [...recipients];
      n[idx] = { ...n[idx], [key]: val };
      updateConfig("recipients", n);
    };
    const changeRecipientType = (idx: number, newType: string) => {
      const n = [...recipients];
      const oldMsg = n[idx].message || "";
      const oldType = n[idx].type;
      // Auto-fill message if empty or still has the default of the previous type
      const isDefault = !oldMsg || oldMsg === DEFAULT_MESSAGES[oldType];
      n[idx] = { ...n[idx], type: newType, message: isDefault ? DEFAULT_MESSAGES[newType] || "" : oldMsg };
      updateConfig("recipients", n);
    };
    const addRecipient = (type: string = "CLIENTE") => {
      updateConfig("recipients", [...recipients, { type, enabled: true, channel: "WHATSAPP", message: DEFAULT_MESSAGES[type] || "" }]);
    };
    const removeRecipient = (idx: number) => {
      updateConfig("recipients", recipients.filter((_: any, i: number) => i !== idx));
    };

    // All available variables
    const COMMON_VARS = [
      { var: "{nome}", label: "Nome" },
      { var: "{empresa}", label: "Empresa" },
      { var: "{razao_social}", label: "Razao Social" },
      { var: "{cnpj_empresa}", label: "CNPJ" },
      { var: "{titulo}", label: "Titulo OS" },
      { var: "{data}", label: "Data Hoje" },
      { var: "{data_agendamento}", label: "Data Agendamento" },
      { var: "{endereco}", label: "Endereco" },
    ];
    const TECNICO_VARS = [
      { var: "{link_app}", label: "Link Primeiro Acesso" },
      { var: "{link_os}", label: "Link da OS" },
      { var: "{nome_cliente}", label: "Nome Cliente" },
    ];
    const CLIENTE_VARS = [
      { var: "{tecnico}", label: "Tecnico" },
      { var: "{telefone_empresa}", label: "Tel. Empresa" },
    ];
    const FORNECEDOR_VARS = [
      { var: "{tecnico}", label: "Tecnico" },
      { var: "{telefone_empresa}", label: "Tel. Empresa" },
      { var: "{nome_cliente}", label: "Nome Cliente" },
    ];
    const GESTOR_VARS = [
      { var: "{tecnico}", label: "Tecnico" },
      { var: "{nome_cliente}", label: "Nome Cliente" },
    ];

    const getVarsForType = (type: string) => {
      const extra = type === "TECNICO" ? TECNICO_VARS :
                    type === "CLIENTE" ? CLIENTE_VARS :
                    type === "FORNECEDOR" ? FORNECEDOR_VARS :
                    type === "GESTOR" ? GESTOR_VARS : [];
      return [...COMMON_VARS, ...extra];
    };

    return (
      <div className="space-y-2">
        {recipients.map((r: any, i: number) => (
          <div key={i} className="rounded-lg border border-slate-200 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Select value={r.type} onChange={(v) => changeRecipientType(i, v)} options={[
                { value: "CLIENTE", label: "Cliente" },
                { value: "TECNICO", label: "Tecnico" },
                { value: "FORNECEDOR", label: "Fornecedor" },
                { value: "GESTOR", label: "Gestor" },
              ]} />
              <button onClick={() => removeRecipient(i)} className="ml-2 px-1 text-xs text-red-400 hover:text-red-600">x</button>
            </div>
            <Select value={r.channel || "WHATSAPP"} onChange={(v) => updateRecipient(i, "channel", v)} options={[
              { value: "WHATSAPP", label: "WhatsApp" },
              { value: "EMAIL", label: "Email" },
              { value: "PUSH", label: "Push" },
            ]} />
            <TextArea value={r.message || ""} onChange={(v) => updateRecipient(i, "message", v)} placeholder="Digite a mensagem..." rows={4} />
            {/* Variable chips */}
            <div className="flex flex-wrap gap-1">
              {getVarsForType(r.type).map(v => (
                <button
                  key={v.var}
                  type="button"
                  onClick={() => updateRecipient(i, "message", (r.message || "") + " " + v.var)}
                  className="text-[10px] bg-slate-100 hover:bg-green-100 text-slate-600 px-1.5 py-0.5 rounded"
                >
                  {v.label}
                </button>
              ))}
            </div>
            {r.type === "TECNICO" && (
              <div className="space-y-1.5">
                <Checkbox checked={r.includeLink || false} onChange={(v) => {
                  const n = [...(Array.isArray(cfg.recipients) ? cfg.recipients : [])];
                  if (v) {
                    n[i] = { ...n[i], includeLink: true, acceptanceType: n[i].acceptanceType || "simple" };
                  } else {
                    const { acceptanceType, contractName, contractContent, requireSignature, ...rest } = n[i];
                    n[i] = { ...rest, includeLink: false };
                  }
                  updateConfig("recipients", n);
                }} label="Incluir link de aceite" />
                {r.includeLink && (
                  <div className="ml-5 space-y-1.5 border-l-2 border-blue-200 pl-3">
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name={`accept-type-${i}`} checked={r.acceptanceType !== "contract"} onChange={() => updateRecipient(i, "acceptanceType", "simple")} className="h-3 w-3 text-blue-600" />
                        <span className="text-[11px] text-slate-600">Confirmacao simples</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name={`accept-type-${i}`} checked={r.acceptanceType === "contract"} onChange={() => updateRecipient(i, "acceptanceType", "contract")} className="h-3 w-3 text-blue-600" />
                        <span className="text-[11px] text-slate-600">Contrato</span>
                      </label>
                    </div>
                    {r.acceptanceType === "contract" && (
                      <div className="space-y-1.5">
                        <Input value={r.contractName || ""} onChange={(v) => updateRecipient(i, "contractName", v)} placeholder="Nome do contrato" />
                        <TextArea value={r.contractContent || ""} onChange={(v) => updateRecipient(i, "contractContent", v)} placeholder="Conteudo do contrato..." rows={6} />
                        <div className="flex flex-wrap gap-1">
                          {[
                            { var: "{nome}", label: "Nome" },
                            { var: "{empresa}", label: "Empresa" },
                            { var: "{razao_social}", label: "Razao Social" },
                            { var: "{cnpj_empresa}", label: "CNPJ" },
                            { var: "{documento}", label: "Documento" },
                            { var: "{data}", label: "Data Hoje" },
                            { var: "{endereco_empresa}", label: "End. Empresa" },
                          ].map(v => (
                            <button
                              key={v.var}
                              type="button"
                              onClick={() => updateRecipient(i, "contractContent", (r.contractContent || "") + " " + v.var)}
                              className="text-[10px] bg-slate-100 hover:bg-green-100 text-slate-600 px-1.5 py-0.5 rounded"
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                        <Checkbox checked={r.requireSignature || false} onChange={(v) => updateRecipient(i, "requireSignature", v)} label="Exigir assinatura digital" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <button onClick={() => addRecipient("CLIENTE")} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">+ Adicionar destinatario</button>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${cat?.color || "bg-slate-50"} ${cat?.borderColor || "border-slate-200"}`}>
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm ${cat?.iconBg || "bg-slate-500"}`}>
            {block.icon}
          </span>
          <div>
            <p className={`text-sm font-semibold ${cat?.textColor || "text-slate-900"}`}>{cat?.name || block.type}</p>
            <p className="text-[10px] text-slate-400">{cat?.description || ""}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-1">
        {/* Name (common to all) */}
        <Label>Nome do bloco</Label>
        <Input value={block.name} onChange={updateName} placeholder="Nome..." />

        {/* STEP */}
        {block.type === "STEP" && (
          <>
            <Label>Descricao</Label>
            <TextArea value={cfg.description || ""} onChange={(v) => updateConfig("description", v)} placeholder="O que o tecnico deve fazer..." />
            <div className="mt-2 space-y-1.5">
              <Checkbox checked={cfg.requirePhoto || false} onChange={(v) => updateConfig("requirePhoto", v)} label="Exigir foto" />
              <Checkbox checked={cfg.requireNote || false} onChange={(v) => updateConfig("requireNote", v)} label="Exigir observacao" />
              <Checkbox checked={cfg.requireGps || false} onChange={(v) => updateConfig("requireGps", v)} label="Registrar GPS" />
            </div>
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Confirmar etapa", color: "blue", icon: "✅" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* PHOTO */}
        {block.type === "PHOTO" && (
          <>
            <Label>Label</Label>
            <Input value={cfg.label || ""} onChange={(v) => updateConfig("label", v)} placeholder="Ex: Foto do equipamento" />
            <Label>Minimo de fotos</Label>
            <Input type="number" value={cfg.minPhotos || 1} onChange={(v) => updateConfig("minPhotos", parseInt(v) || 1)} />
            <Label>Tipo</Label>
            <Select value={cfg.photoType || "GERAL"} onChange={(v) => updateConfig("photoType", v)} options={[
              { value: "ANTES", label: "Antes do servico" },
              { value: "DEPOIS", label: "Depois do servico" },
              { value: "EVIDENCIA", label: "Evidencia" },
              { value: "GERAL", label: "Geral" },
            ]} />
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Enviar fotos", color: "green", icon: "📸" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* NOTE */}
        {block.type === "NOTE" && (
          <>
            <Label>Placeholder</Label>
            <Input value={cfg.placeholder || ""} onChange={(v) => updateConfig("placeholder", v)} placeholder="Texto de orientacao..." />
            <Checkbox checked={cfg.required !== false} onChange={(v) => updateConfig("required", v)} label="Obrigatorio" />
            <div className="flex gap-2 mt-1">
              <div className="flex-1">
                <Label>Min. caracteres</Label>
                <input type="number" min={0} value={cfg.minChars || ""} onChange={(e) => updateConfig("minChars", e.target.value ? parseInt(e.target.value) : null)} placeholder="0" className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
              </div>
              <div className="flex-1">
                <Label>Max. caracteres</Label>
                <input type="number" min={0} value={cfg.maxChars || ""} onChange={(e) => updateConfig("maxChars", e.target.value ? parseInt(e.target.value) : null)} placeholder="Sem limite" className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
              </div>
            </div>
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Enviar", color: "blue", icon: "📝" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* GPS — sempre auto-captura ao chegar no bloco */}
        {block.type === "GPS" && (
          <>
            <Checkbox checked={cfg.required !== false} onChange={(v) => updateConfig("required", v)} label="Obrigatorio" />
            <Checkbox checked={cfg.highAccuracy !== false} onChange={(v) => updateConfig("highAccuracy", v)} label="Alta precisao (GPS hardware)" />

            <Label>Modo de captura</Label>
            <Select
              value={cfg.trackingMode || "single"}
              onChange={(v) => updateConfig("trackingMode", v)}
              options={[
                { value: "single", label: "Pontual (1 captura)" },
                { value: "continuous", label: "Rastreamento continuo" },
              ]}
            />

            {cfg.trackingMode === "continuous" && (() => {
              const onEnter = cfg.onEnterRadius || {};
              const updateOnEnter = (key: string, val: any) => {
                updateConfig("onEnterRadius", { ...onEnter, [key]: val });
              };
              return (
                <>
                  <Label>Intervalo entre capturas (segundos)</Label>
                  <Input type="number" value={cfg.intervalSeconds || 30} onChange={(v) => updateConfig("intervalSeconds", parseInt(v) || 30)} placeholder="30" />

                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-medium text-slate-500 mb-2">Proximidade do destino</p>

                    <Label>Raio de proximidade (metros)</Label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={10} max={1000} step={10} value={cfg.radiusMeters || 50}
                        onChange={(e) => updateConfig("radiusMeters", parseInt(e.target.value))}
                        className="flex-1 accent-blue-500" />
                      <span className="text-xs font-bold text-blue-600 min-w-[50px] text-right">{cfg.radiusMeters || 50}m</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Distancia em metros do destino para disparar eventos</p>

                    <Checkbox checked={cfg.autoAdvanceOnProximity !== false} onChange={(v) => updateConfig("autoAdvanceOnProximity", v)} label="Auto-avancar ao entrar no raio" />
                    <p className="text-[10px] text-slate-400">{cfg.autoAdvanceOnProximity !== false ? "O bloco avança automaticamente quando o técnico entra no raio" : "O técnico precisa clicar o botão abaixo para avançar"}</p>

                    {cfg.autoAdvanceOnProximity === false && (
                      <ConfirmButtonEditor
                        config={cfg.arrivalButton || { label: "Cheguei", color: "green", icon: "📍" }}
                        onChange={(v) => updateConfig("arrivalButton", v)}
                      />
                    )}
                  </div>

                  <OnEnterRadiusNotifications onEnter={onEnter} updateOnEnter={updateOnEnter} />
                </>
              );
            })()}

            <p className="text-[10px] text-slate-400 mt-2">
              {cfg.trackingMode === "continuous"
                ? cfg.autoAdvanceOnProximity !== false
                  ? "O rastreamento GPS inicia automaticamente. O bloco avança quando o técnico entra no raio configurado."
                  : "O rastreamento GPS inicia automaticamente. O técnico precisa clicar o botão ao entrar no raio para avançar."
                : "A localização é capturada automaticamente quando o fluxo chega neste bloco. Se o GPS estiver desativado, o técnico será avisado."}
            </p>
          </>
        )}

        {/* PROXIMITY_TRIGGER */}
        {block.type === "PROXIMITY_TRIGGER" && (() => {
          const onEnter = cfg.onEnterRadius || {};
          const updateOnEnter = (key: string, val: any) => {
            updateConfig("onEnterRadius", { ...onEnter, [key]: val });
          };
          return (
            <>
              <Label>Raio de proximidade (metros)</Label>
              <div className="flex items-center gap-2">
                <input type="range" min={10} max={1000} step={10} value={cfg.radiusMeters || 50}
                  onChange={(e) => updateConfig("radiusMeters", parseInt(e.target.value))}
                  className="flex-1 accent-rose-500" />
                <span className="text-xs font-bold text-rose-600 min-w-[50px] text-right">{cfg.radiusMeters || 50}m</span>
              </div>
              <p className="text-[10px] text-slate-400">Distancia em metros do destino para disparar eventos</p>

              <Label>Intervalo de envio GPS (segundos)</Label>
              <Input type="number" value={cfg.trackingIntervalSeconds || 30} onChange={(v) => updateConfig("trackingIntervalSeconds", parseInt(v) || 30)} placeholder="30" />

              <Checkbox checked={cfg.requireHighAccuracy !== false} onChange={(v) => updateConfig("requireHighAccuracy", v)} label="Alta precisao (GPS hardware)" />

              <OnEnterRadiusNotifications onEnter={onEnter} updateOnEnter={updateOnEnter} />

              <p className="text-[10px] text-slate-400 mt-3">O rastreamento GPS inicia automaticamente quando o fluxo chega neste bloco. O bloco avanca quando o tecnico entra no raio configurado.</p>
            </>
          );
        })()}

        {/* QUESTION */}
        {block.type === "QUESTION" && (
          <>
            <Label>Pergunta</Label>
            <Input value={cfg.question || ""} onChange={(v) => updateConfig("question", v)} placeholder="Ex: O equipamento esta funcionando?" />
            <Label>Opcoes de resposta</Label>
            <ListEditor items={cfg.options || ["Sim", "Nao"]} onChange={(v) => updateConfig("options", v)} placeholder="Opcao..." />
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Confirmar", color: "blue", icon: "✅" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* CHECKLIST */}
        {block.type === "CHECKLIST" && (
          <>
            <Label>Itens do checklist</Label>
            <ListEditor items={cfg.items || []} onChange={(v) => updateConfig("items", v)} placeholder="Item..." />
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Confirmar checklist", color: "green", icon: "☑️" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* SIGNATURE */}
        {block.type === "SIGNATURE" && (
          <>
            <Label>Label</Label>
            <Input value={cfg.label || ""} onChange={(v) => updateConfig("label", v)} placeholder="Ex: Assinatura do cliente" />
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Enviar assinatura", color: "blue", icon: "✍️" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* FORM */}
        {block.type === "FORM" && (
          <>
            <Label>Campos do formulario</Label>
            <FormFieldsEditor fields={cfg.fields || []} onChange={(v) => updateConfig("fields", v)} />
            <ConfirmButtonEditor config={cfg.confirmButton || { label: "Enviar formulario", color: "green", icon: "📋" }} onChange={(v) => updateConfig("confirmButton", v)} />
          </>
        )}

        {/* CONDITION */}
        {block.type === "CONDITION" && (
          <>
            <Label>Pergunta da condicao</Label>
            <Input value={cfg.question || ""} onChange={(v) => updateConfig("question", v)} placeholder="Ex: Problema encontrado?" />
            <p className="text-[10px] text-slate-400 mt-1">SIM segue pelo caminho esquerdo, NAO pelo direito</p>
          </>
        )}

        {/* ACTION_BUTTONS */}
        {block.type === "ACTION_BUTTONS" && (() => {
          const buttons: { id: string; label: string; color: string; icon?: string }[] = cfg.buttons || [];
          const COLORS = [
            { value: "green", label: "Verde", bg: "bg-green-500", preview: "bg-green-100 text-green-800 border-green-300" },
            { value: "red", label: "Vermelho", bg: "bg-red-500", preview: "bg-red-100 text-red-800 border-red-300" },
            { value: "blue", label: "Azul", bg: "bg-blue-500", preview: "bg-blue-100 text-blue-800 border-blue-300" },
            { value: "yellow", label: "Amarelo", bg: "bg-yellow-500", preview: "bg-yellow-100 text-yellow-800 border-yellow-300" },
            { value: "slate", label: "Cinza", bg: "bg-slate-500", preview: "bg-slate-100 text-slate-800 border-slate-300" },
          ];
          const BTN_SIZES = [
            { value: "sm", label: "Pequeno" },
            { value: "md", label: "Médio" },
            { value: "lg", label: "Grande" },
          ];
          const buttonSize = cfg.buttonSize || "md";
          const updateButton = (idx: number, key: string, val: any) => {
            const n = [...buttons];
            n[idx] = { ...n[idx], [key]: val };
            onChange({ ...block, config: { ...cfg, buttons: n } });
          };
          const addButton = () => {
            const newId = `btn_${buttons.length}`;
            const newButtons = [...buttons, { id: newId, label: "Novo", color: "blue", icon: "" }];
            const newBranches = { ...block.branches, [newId]: null };
            onChange({ ...block, config: { ...cfg, buttons: newButtons }, branches: newBranches });
          };
          const removeButton = (idx: number) => {
            const btn = buttons[idx];
            const newButtons = buttons.filter((_, i) => i !== idx);
            const newBranches = { ...block.branches };
            delete newBranches[btn.id];
            onChange({ ...block, config: { ...cfg, buttons: newButtons }, branches: newBranches });
          };
          // Info panel config
          const infoPanel = cfg.infoPanel || null;
          const INFO_COLORS_BTN = [
            { value: "blue", bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800" },
            { value: "green", bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
            { value: "red", bg: "bg-red-100", border: "border-red-300", text: "text-red-800" },
            { value: "yellow", bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800" },
            { value: "slate", bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800" },
            { value: "purple", bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800" },
            { value: "cyan", bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-800" },
            { value: "orange", bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
          ];
          const INFO_VARS_BTN = [
            { var: "{titulo}", label: "Título OS", icon: "📄" },
            { var: "{codigo}", label: "Código", icon: "🔢" },
            { var: "{nome_cliente}", label: "Cliente", icon: "👤" },
            { var: "{telefone_cliente}", label: "Tel. Cliente", icon: "📱" },
            { var: "{contato_local}", label: "Contato Local", icon: "🏠" },
            { var: "{endereco}", label: "Endereço", icon: "📍" },
            { var: "{tecnico}", label: "Técnico", icon: "🔧" },
            { var: "{valor}", label: "Valor", icon: "💰" },
            { var: "{data_agendamento}", label: "Prazo", icon: "📅" },
            { var: "{empresa}", label: "Empresa", icon: "🏢" },
            { var: "{telefone_empresa}", label: "Tel. Empresa", icon: "☎️" },
            { var: "{status}", label: "Status", icon: "🔄" },
            { var: "{descricao}", label: "Descrição", icon: "📝" },
          ];
          const updateInfoPanel = (key: string, val: any) => {
            const current = cfg.infoPanel || { enabled: true, position: "before", color: "blue", fontSize: "sm", boxSize: "compact", icon: "ℹ️", title: "", message: "" };
            updateConfig("infoPanel", { ...current, [key]: val });
          };
          const infoMsgRef = { current: null as HTMLTextAreaElement | null };
          const insertInfoVar = (v: string) => {
            const ta = infoMsgRef.current;
            const panel = cfg.infoPanel || {};
            if (ta) {
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              const text = panel.message || "";
              const newText = text.substring(0, start) + v + text.substring(end);
              updateInfoPanel("message", newText);
              setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.length, start + v.length); }, 50);
            } else {
              updateInfoPanel("message", (panel.message || "") + v);
            }
          };
          const btnSizePreview = buttonSize === "sm" ? "py-2 text-[10px]" : buttonSize === "lg" ? "py-5 text-base" : "py-3 text-xs";
          return (
            <>
              <Label>Titulo (exibido ao tecnico)</Label>
              <Input value={cfg.title || ""} onChange={(v) => updateConfig("title", v)} placeholder="Ex: O que deseja fazer?" />

              <Label>Tamanho dos botões</Label>
              <div className="flex gap-1 mb-2">
                {BTN_SIZES.map(s => (
                  <button key={s.value} type="button"
                    onClick={() => updateConfig("buttonSize", s.value)}
                    className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-all ${
                      buttonSize === s.value ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >{s.label}</button>
                ))}
              </div>

              <Label>Botoes ({buttons.length})</Label>
              <div className="space-y-2">
                {buttons.map((btn, i) => {
                  const colorDef = COLORS.find(c => c.value === btn.color) || COLORS[0];
                  return (
                    <div key={btn.id} className={`rounded-lg border p-2 space-y-1.5 ${colorDef.preview.split(" ").find(c => c.startsWith("border-")) || "border-slate-200"}`}>
                      <div className="flex items-center gap-1.5">
                        <input
                          value={btn.label}
                          onChange={(e) => updateButton(i, "label", e.target.value)}
                          placeholder="Texto do botao"
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                        />
                        {buttons.length > 1 && (
                          <button onClick={() => removeButton(i)} className="px-1.5 py-0.5 text-xs text-red-400 hover:text-red-600 rounded hover:bg-red-50" title="Remover">x</button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {COLORS.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => updateButton(i, "color", c.value)}
                              className={`h-5 w-5 rounded-full ${c.bg} ${btn.color === c.value ? "ring-2 ring-offset-1 ring-blue-400" : "opacity-60 hover:opacity-100"}`}
                              title={c.label}
                            />
                          ))}
                        </div>
                        <EmojiPicker
                          value={btn.icon || ""}
                          onChange={(v) => updateButton(i, "icon", v)}
                        />
                      </div>
                      {/* Preview */}
                      <div className={`rounded-md border text-center font-bold ${btnSizePreview} ${colorDef.preview}`}>
                        {btn.icon ? `${btn.icon} ` : ""}{btn.label || "..."}
                      </div>
                    </div>
                  );
                })}
                {buttons.length < 4 && (
                  <button onClick={addButton} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">+ Adicionar botao</button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {buttons.length === 1
                  ? "1 botao = acao simples. O tecnico confirma e o fluxo continua."
                  : "Cada botao segue um caminho diferente no fluxo."}
              </p>

              {/* Embedded Info Panel */}
              <div className="mt-3 border-t border-slate-200 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!infoPanel?.enabled} onChange={(e) => {
                    if (e.target.checked) {
                      updateConfig("infoPanel", { enabled: true, position: "before", color: "blue", fontSize: "sm", boxSize: "compact", icon: "ℹ️", title: "", message: "" });
                    } else {
                      updateConfig("infoPanel", { ...cfg.infoPanel, enabled: false });
                    }
                  }} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                  <span className="text-xs font-medium text-slate-700">Incluir painel informativo</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-0.5">Exibe informações da OS junto com os botões</p>

                {infoPanel?.enabled && (
                  <div className="mt-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/30 p-2 space-y-2">
                    <Label>Posição</Label>
                    <div className="flex gap-1">
                      {[{ value: "before", label: "Antes dos botões" }, { value: "after", label: "Depois dos botões" }].map(p => (
                        <button key={p.value} type="button"
                          onClick={() => updateInfoPanel("position", p.value)}
                          className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-all ${
                            (infoPanel.position || "before") === p.value ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                        >{p.label}</button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Emoji</Label>
                        <EmojiPicker value={infoPanel.icon || "ℹ️"} onChange={(v) => updateInfoPanel("icon", v)} />
                      </div>
                      <div className="flex-1">
                        <Label>Fonte</Label>
                        <div className="flex gap-0.5">
                          {[{ v: "sm", l: "P" }, { v: "md", l: "M" }, { v: "lg", l: "G" }].map(s => (
                            <button key={s.v} type="button"
                              onClick={() => updateInfoPanel("fontSize", s.v)}
                              className={`flex-1 rounded border px-1 py-0.5 text-[9px] font-bold ${
                                (infoPanel.fontSize || "sm") === s.v ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500"
                              }`}
                            >{s.l}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label>Card</Label>
                        <div className="flex gap-0.5">
                          {[{ v: "compact", l: "P" }, { v: "normal", l: "M" }, { v: "large", l: "G" }].map(s => (
                            <button key={s.v} type="button"
                              onClick={() => updateInfoPanel("boxSize", s.v)}
                              className={`flex-1 rounded border px-1 py-0.5 text-[9px] font-bold ${
                                (infoPanel.boxSize || "compact") === s.v ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500"
                              }`}
                            >{s.l}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Label>Cor</Label>
                    <div className="flex gap-1">
                      {INFO_COLORS_BTN.map(c => (
                        <button key={c.value} type="button"
                          onClick={() => updateInfoPanel("color", c.value)}
                          className={`w-5 h-5 rounded-full ${c.bg} border ${(infoPanel.color || "blue") === c.value ? "border-slate-800 scale-110 shadow" : c.border}`}
                        />
                      ))}
                    </div>

                    <Label>Título</Label>
                    <input type="text" value={infoPanel.title || ""} onChange={(e) => updateInfoPanel("title", e.target.value)}
                      placeholder="Ex: Detalhes da OS" className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />

                    <Label>Mensagem</Label>
                    <textarea ref={(el) => { infoMsgRef.current = el; }} value={infoPanel.message || ""} onChange={(e) => updateInfoPanel("message", e.target.value)}
                      rows={3} placeholder="Texto com variáveis da OS..."
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400 resize-none" />

                    <p className="text-[10px] text-slate-400">Clique para inserir variável:</p>
                    <div className="flex flex-wrap gap-1">
                      {INFO_VARS_BTN.map(v => (
                        <button key={v.var} type="button"
                          onClick={() => insertInfoVar(v.var)}
                          className="flex items-center gap-0.5 rounded bg-slate-100 border border-slate-200 px-1 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-green-100 hover:border-green-300 hover:text-green-700 transition-colors"
                        ><span className="text-[8px]">{v.icon}</span> {v.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* NOTIFY */}
        {block.type === "NOTIFY" && (
          <>
            <Label>Destinatarios</Label>
            {NotifyRecipients()}
          </>
        )}

        {/* APPROVAL */}
        {block.type === "APPROVAL" && (
          <>
            <Label>Aprovador</Label>
            <Select value={cfg.approverRole || "ADMIN"} onChange={(v) => updateConfig("approverRole", v)} options={[
              { value: "ADMIN", label: "Admin" },
              { value: "DESPACHO", label: "Despacho" },
            ]} />
            <Label>Mensagem</Label>
            <TextArea value={cfg.message || ""} onChange={(v) => updateConfig("message", v)} placeholder="Mensagem para o aprovador..." />
          </>
        )}

        {/* INFO — Bloco informativo visual para o técnico */}
        {block.type === "INFO" && (() => {
          const INFO_COLORS = [
            { value: "blue", label: "Azul", bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800" },
            { value: "green", label: "Verde", bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
            { value: "red", label: "Vermelho", bg: "bg-red-100", border: "border-red-300", text: "text-red-800" },
            { value: "yellow", label: "Amarelo", bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800" },
            { value: "slate", label: "Neutro", bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800" },
            { value: "purple", label: "Roxo", bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800" },
            { value: "cyan", label: "Ciano", bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-800" },
            { value: "orange", label: "Laranja", bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
          ];
          const VARS = [
            { var: "{titulo}", label: "Título OS", icon: "📄" },
            { var: "{codigo}", label: "Código", icon: "🔢" },
            { var: "{nome_cliente}", label: "Cliente", icon: "👤" },
            { var: "{telefone_cliente}", label: "Tel. Cliente", icon: "📱" },
            { var: "{contato_local}", label: "Contato Local", icon: "🏠" },
            { var: "{endereco}", label: "Endereço", icon: "📍" },
            { var: "{tecnico}", label: "Técnico", icon: "🔧" },
            { var: "{valor}", label: "Valor", icon: "💰" },
            { var: "{data_agendamento}", label: "Prazo", icon: "📅" },
            { var: "{empresa}", label: "Empresa", icon: "🏢" },
            { var: "{telefone_empresa}", label: "Tel. Empresa", icon: "☎️" },
            { var: "{status}", label: "Status", icon: "🔄" },
            { var: "{descricao}", label: "Descrição", icon: "📝" },
          ];
          const FONT_SIZES = [
            { value: "sm", label: "Pequeno" },
            { value: "md", label: "Médio" },
            { value: "lg", label: "Grande" },
          ];
          const BOX_SIZES = [
            { value: "compact", label: "Compacto" },
            { value: "normal", label: "Normal" },
            { value: "large", label: "Grande" },
          ];
          const selectedColor = INFO_COLORS.find(c => c.value === (cfg.color || "blue")) || INFO_COLORS[0];
          const fontSize = cfg.fontSize || "md";
          const boxSize = cfg.boxSize || "normal";
          const previewFontSize = fontSize === "sm" ? "text-[11px]" : fontSize === "lg" ? "text-base" : "text-sm";
          const previewTitleSize = fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm";
          const previewPadding = boxSize === "compact" ? "p-2" : boxSize === "large" ? "p-5" : "p-3";
          // Insert variable at textarea cursor position
          const msgRef = { current: null as HTMLTextAreaElement | null };
          const insertVar = (v: string) => {
            const ta = msgRef.current;
            if (ta) {
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              const text = cfg.message || "";
              const newText = text.substring(0, start) + v + text.substring(end);
              updateConfig("message", newText);
              setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.length, start + v.length); }, 50);
            } else {
              updateConfig("message", (cfg.message || "") + v);
            }
          };
          return (
            <>
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {["ℹ️","✅","❌","⚠️","🎉","📋","📞","🔍","⏳","🔄","📖","🚫","💡","🔔","⭐","🏠","🔧","📍","🚀","🎯","💬","📊"].map(e => (
                  <button key={e} type="button"
                    onClick={() => updateConfig("icon", e)}
                    className={`text-base p-0.5 rounded hover:bg-slate-100 transition-all ${cfg.icon === e ? "ring-2 ring-blue-400 bg-blue-50 scale-110" : ""}`}
                  >{e}</button>
                ))}
              </div>

              <Label>Cor do card</Label>
              <div className="flex gap-1.5 mb-2">
                {INFO_COLORS.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => updateConfig("color", c.value)}
                    className={`w-7 h-7 rounded-full ${c.bg} border-2 transition-all ${cfg.color === c.value ? "border-slate-800 scale-110 shadow" : c.border}`}
                    title={c.label}
                  />
                ))}
              </div>

              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Label>Tamanho da fonte</Label>
                  <div className="flex gap-1">
                    {FONT_SIZES.map(s => (
                      <button key={s.value} type="button"
                        onClick={() => updateConfig("fontSize", s.value)}
                        className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-all ${
                          fontSize === s.value ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <Label>Tamanho do card</Label>
                  <div className="flex gap-1">
                    {BOX_SIZES.map(s => (
                      <button key={s.value} type="button"
                        onClick={() => updateConfig("boxSize", s.value)}
                        className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-all ${
                          boxSize === s.value ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <Label>Título (exibido ao técnico)</Label>
              <input type="text" value={cfg.title || ""} onChange={(e) => updateConfig("title", e.target.value)}
                placeholder="Ex: OS Recusada" className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />

              <Label>Mensagem</Label>
              <textarea ref={(el) => { msgRef.current = el; }} value={cfg.message || ""} onChange={(e) => updateConfig("message", e.target.value)}
                rows={4} placeholder="Texto que o técnico verá. Use as variáveis abaixo para trazer dados reais da OS..."
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400 resize-none" />

              {/* Variable chips — click to insert at cursor position */}
              <p className="text-[10px] text-slate-400 mt-1 mb-1">Clique para inserir dado real da OS na mensagem:</p>
              <div className="flex flex-wrap gap-1">
                {VARS.map(v => (
                  <button key={v.var} type="button"
                    onClick={() => insertVar(v.var)}
                    className="flex items-center gap-0.5 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-green-100 hover:border-green-300 hover:text-green-700 transition-colors"
                  ><span className="text-[9px]">{v.icon}</span> {v.label}</button>
                ))}
              </div>

              {/* Preview */}
              <Label>Preview no celular</Label>
              <div className={`rounded-xl border-2 ${selectedColor.border} ${selectedColor.bg} ${previewPadding} mt-1`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={fontSize === "sm" ? "text-base" : fontSize === "lg" ? "text-2xl" : "text-lg"}>{cfg.icon || "ℹ️"}</span>
                  <span className={`font-bold ${selectedColor.text} ${previewTitleSize}`}>{cfg.title || "Informação"}</span>
                </div>
                <p className={`${selectedColor.text} opacity-80 whitespace-pre-line leading-relaxed ${previewFontSize}`}>
                  {(cfg.message || "Use as variáveis para trazer dados reais da OS.\nEx: {titulo}, {nome_cliente}, {endereco}...").substring(0, 200)}
                </p>
              </div>

              <ConfirmButtonEditor config={cfg.confirmButton || { label: "Entendi", color: "blue", icon: "ℹ️" }} onChange={(v) => updateConfig("confirmButton", v)} />
            </>
          );
        })()}

        {/* ALERT */}
        {block.type === "ALERT" && (
          <>
            <Label>Mensagem</Label>
            <TextArea value={cfg.message || ""} onChange={(v) => updateConfig("message", v)} placeholder="Texto do alerta..." />
            <Label>Severidade</Label>
            <Select value={cfg.severity || "info"} onChange={(v) => updateConfig("severity", v)} options={[
              { value: "info", label: "Informacao" },
              { value: "warning", label: "Atencao" },
              { value: "critical", label: "Critico" },
            ]} />
          </>
        )}

        {/* DELAY */}
        {block.type === "DELAY" && (() => {
          const currentUnit = cfg.unit || "minutes";
          const currentDur = cfg.duration ?? cfg.minutes ?? 15;
          const units = [
            { value: "seconds", label: "Seg", short: "s" },
            { value: "minutes", label: "Min", short: "m" },
            { value: "hours", label: "Hora", short: "h" },
            { value: "days", label: "Dia", short: "d" },
          ];
          const presets: Record<string, { dur: number; unit: string; label: string }[]> = {
            seconds: [{ dur: 10, unit: "seconds", label: "10s" }, { dur: 30, unit: "seconds", label: "30s" }, { dur: 45, unit: "seconds", label: "45s" }],
            minutes: [{ dur: 1, unit: "minutes", label: "1 min" }, { dur: 5, unit: "minutes", label: "5 min" }, { dur: 15, unit: "minutes", label: "15 min" }, { dur: 30, unit: "minutes", label: "30 min" }],
            hours: [{ dur: 1, unit: "hours", label: "1h" }, { dur: 2, unit: "hours", label: "2h" }, { dur: 6, unit: "hours", label: "6h" }, { dur: 12, unit: "hours", label: "12h" }],
            days: [{ dur: 1, unit: "days", label: "1 dia" }, { dur: 2, unit: "days", label: "2 dias" }, { dur: 3, unit: "days", label: "3 dias" }, { dur: 7, unit: "days", label: "7 dias" }],
          };
          const setDelay = (dur: number, unit: string) => {
            onChange({ ...block, config: { ...cfg, duration: dur, unit } });
          };
          return (
            <>
              <Label>Unidade</Label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {units.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setDelay(currentDur, u.value)}
                    className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                      currentUnit === u.value
                        ? "bg-blue-500 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              <Label>Duracao</Label>
              <input
                type="number"
                min={1}
                value={currentDur}
                onChange={(e) => setDelay(parseInt(e.target.value) || 1, currentUnit)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
              <Label>Atalhos</Label>
              <div className="flex flex-wrap gap-1.5">
                {(presets[currentUnit] || []).map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDelay(p.dur, p.unit)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      currentDur === p.dur && currentUnit === p.unit
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          );
        })()}

        {/* SLA */}
        {block.type === "SLA" && (
          <>
            <Label>Tempo maximo (minutos)</Label>
            <Input type="number" value={cfg.maxMinutes || 240} onChange={(v) => updateConfig("maxMinutes", parseInt(v) || 240)} />
            <Checkbox checked={cfg.alertOnExceed !== false} onChange={(v) => updateConfig("alertOnExceed", v)} label="Alertar ao exceder" />
          </>
        )}

        {/* STATUS */}
        {block.type === "STATUS" && (
          <>
            <Label>Mudar status para</Label>
            <Select value={cfg.targetStatus || "EM_EXECUCAO"} onChange={(v) => updateConfig("targetStatus", v)} options={OS_STATUSES} />
            <p className="text-[10px] text-slate-400 mt-1">O sistema muda o status automaticamente. Para botoes de acao do tecnico, use o bloco "Botoes de Acao".</p>
          </>
        )}

        {/* RESCHEDULE */}
        {block.type === "RESCHEDULE" && (
          <>
            <Label>Motivo do reagendamento</Label>
            <TextArea value={cfg.reason || ""} onChange={(v) => updateConfig("reason", v)} placeholder="Motivo..." />
          </>
        )}
      </div>
    </div>
  );
}
