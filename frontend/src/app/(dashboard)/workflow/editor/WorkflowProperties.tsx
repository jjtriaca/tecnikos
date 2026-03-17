"use client";

import { type Block, getCatalogEntry } from "@/types/workflow-blocks";

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

  function updateConfig(key: string, value: any) {
    onChange({ ...block, config: { ...cfg, [key]: value } });
  }

  function updateName(name: string) {
    onChange({ ...block, name });
  }

  // Default messages per recipient type
  const DEFAULT_MESSAGES: Record<string, string> = {
    CLIENTE: "Ola {nome}, informamos que o servico {titulo} foi concluido com sucesso pelo tecnico {tecnico}. A {razao_social} agradece pela preferencia! Qualquer duvida, entre em contato.",
    TECNICO: "Ola {nome}, voce foi designado para a OS {titulo}. Cliente: {nome_cliente}. Endereco: {endereco}. Data: {data_agendamento}. Acesse o app: {link_app}",
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
      { var: "{link_app}", label: "Link App" },
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
              <Checkbox checked={r.includeLink || false} onChange={(v) => updateRecipient(i, "includeLink", v)} label="Incluir link de aceite" />
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
          </>
        )}

        {/* NOTE */}
        {block.type === "NOTE" && (
          <>
            <Label>Placeholder</Label>
            <Input value={cfg.placeholder || ""} onChange={(v) => updateConfig("placeholder", v)} placeholder="Texto de orientacao..." />
            <Checkbox checked={cfg.required !== false} onChange={(v) => updateConfig("required", v)} label="Obrigatorio" />
          </>
        )}

        {/* GPS */}
        {block.type === "GPS" && (
          <Checkbox checked={cfg.auto !== false} onChange={(v) => updateConfig("auto", v)} label="Captura automatica" />
        )}

        {/* QUESTION */}
        {block.type === "QUESTION" && (
          <>
            <Label>Pergunta</Label>
            <Input value={cfg.question || ""} onChange={(v) => updateConfig("question", v)} placeholder="Ex: O equipamento esta funcionando?" />
            <Label>Opcoes de resposta</Label>
            <ListEditor items={cfg.options || ["Sim", "Nao"]} onChange={(v) => updateConfig("options", v)} placeholder="Opcao..." />
          </>
        )}

        {/* CHECKLIST */}
        {block.type === "CHECKLIST" && (
          <>
            <Label>Itens do checklist</Label>
            <ListEditor items={cfg.items || []} onChange={(v) => updateConfig("items", v)} placeholder="Item..." />
          </>
        )}

        {/* SIGNATURE */}
        {block.type === "SIGNATURE" && (
          <>
            <Label>Label</Label>
            <Input value={cfg.label || ""} onChange={(v) => updateConfig("label", v)} placeholder="Ex: Assinatura do cliente" />
          </>
        )}

        {/* FORM */}
        {block.type === "FORM" && (
          <>
            <Label>Campos do formulario</Label>
            <FormFieldsEditor fields={cfg.fields || []} onChange={(v) => updateConfig("fields", v)} />
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

        {/* NOTIFY */}
        {block.type === "NOTIFY" && (
          <>
            <Label>Destinatarios</Label>
            <NotifyRecipients />
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
        {block.type === "DELAY" && (
          <>
            <Label>Tempo de espera (minutos)</Label>
            <Input type="number" value={cfg.minutes || 15} onChange={(v) => updateConfig("minutes", parseInt(v) || 15)} />
          </>
        )}

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
