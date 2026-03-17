"use client";

import { type Block, genBlockId } from "@/types/workflow-blocks";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  blocks: Block[];
}

function wire(blocks: Block[]): Block[] {
  // Auto-wire next pointers in sequence
  for (let i = 0; i < blocks.length - 1; i++) {
    if (blocks[i].type !== "CONDITION") {
      blocks[i].next = blocks[i + 1].id;
    }
  }
  return blocks;
}

function makeTemplate(name: string, description: string, icon: string, color: string, middleBlocks: Omit<Block, "id" | "next">[]): WorkflowTemplate {
  const startId = genBlockId();
  const endId = genBlockId();
  const blocks: Block[] = [
    { id: startId, type: "START", name: "Inicio", icon: "\u25b6\ufe0f", config: {}, next: null },
    ...middleBlocks.map((b) => ({
      ...b,
      id: genBlockId(),
      next: null,
    })) as Block[],
    { id: endId, type: "END", name: "Fim", icon: "\u23f9\ufe0f", config: {}, next: null },
  ];
  return { id: name, name, description, icon, color, blocks: wire(blocks) };
}

export const TEMPLATES: WorkflowTemplate[] = [
  makeTemplate(
    "Instalacao Padrao",
    "Fluxo completo para instalacao de equipamentos",
    "\ud83d\udd27",
    "bg-blue-500",
    [
      { type: "STATUS", name: "Status: Atribuida", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Notificar Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Voce foi atribuido a OS {titulo}. Acesse o link para mais detalhes.", includeLink: true }] } },
      { type: "STATUS", name: "Status: A Caminho", icon: "\ud83d\udd04", config: { targetStatus: "A_CAMINHO" } },
      { type: "GPS", name: "GPS de Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Foto Antes", icon: "\ud83d\udcf8", config: { minPhotos: 1, label: "Foto antes da instalacao", photoType: "ANTES" } },
      { type: "STATUS", name: "Status: Em Execucao", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Checklist de Instalacao", icon: "\u2611\ufe0f", config: { items: ["Verificar rede eletrica", "Testar equipamento", "Fixar suportes", "Conectar tubulacao", "Testar funcionamento"] } },
      { type: "PHOTO", name: "Foto Depois", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Fotos apos instalacao", photoType: "DEPOIS" } },
      { type: "SIGNATURE", name: "Assinatura do Cliente", icon: "\u270d\ufe0f", config: { label: "Assinatura do cliente" } },
      { type: "STATUS", name: "Status: Concluida", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Notificar Cliente", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Servico de instalacao concluido! Obrigado pela preferencia." }] } },
    ]
  ),
  makeTemplate(
    "Manutencao Preventiva",
    "Fluxo para manutencao programada com checklist",
    "\ud83d\udee0\ufe0f",
    "bg-green-500",
    [
      { type: "STATUS", name: "Status: Atribuida", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Notificar Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Manutencao preventiva agendada: {titulo}. Data: {data_agendamento}.", includeLink: true }] } },
      { type: "GPS", name: "Registro de Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "STATUS", name: "Status: Em Execucao", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Verificacao Inicial", icon: "\ud83d\udccb", config: { items: ["Inspecao visual", "Verificar nivel de oleo", "Checar filtros", "Verificar correias", "Medir temperatura"] } },
      { type: "NOTE", name: "Observacoes Tecnicas", icon: "\ud83d\udcdd", config: { placeholder: "Descreva as condicoes encontradas e servicos realizados...", required: true } },
      { type: "PHOTO", name: "Fotos do Servico", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Registrar antes e depois", photoType: "GERAL" } },
      { type: "STATUS", name: "Status: Concluida", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Relatorio ao Gestor", icon: "\ud83d\udcac", config: { recipients: [{ type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Manutencao preventiva concluida: {titulo}. Tecnico: {tecnico}." }] } },
    ]
  ),
  makeTemplate(
    "Vistoria Tecnica",
    "Fluxo simples para vistoria e laudo",
    "\ud83d\udd0d",
    "bg-amber-500",
    [
      { type: "STATUS", name: "Status: Atribuida", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Avisar Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Vistoria agendada: {titulo}.", includeLink: true }] } },
      { type: "GPS", name: "Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "STATUS", name: "Status: Em Execucao", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "PHOTO", name: "Fotos da Vistoria", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Registrar todos os pontos inspecionados", photoType: "EVIDENCIA" } },
      { type: "FORM", name: "Laudo Tecnico", icon: "\ud83d\udccb", config: { fields: [
        { name: "Condicao geral", type: "select", required: true, options: ["Bom", "Regular", "Ruim", "Critico"] },
        { name: "Observacoes", type: "text", required: true },
        { name: "Prazo para reparo (dias)", type: "number", required: false },
      ] } },
      { type: "SIGNATURE", name: "Assinatura", icon: "\u270d\ufe0f", config: { label: "Assinatura do responsavel" } },
      { type: "STATUS", name: "Status: Concluida", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
    ]
  ),
  makeTemplate(
    "Manutencao Corretiva",
    "Fluxo para reparo emergencial com aprovacao",
    "\u26a1",
    "bg-red-500",
    [
      { type: "STATUS", name: "Status: Atribuida", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Urgente: Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "URGENTE: Reparo necessario em {titulo}. Dirija-se ao local imediatamente.", includeLink: true }] } },
      { type: "STATUS", name: "Status: A Caminho", icon: "\ud83d\udd04", config: { targetStatus: "A_CAMINHO" } },
      { type: "GPS", name: "Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Foto do Problema", icon: "\ud83d\udcf8", config: { minPhotos: 1, label: "Registrar o problema encontrado", photoType: "ANTES" } },
      { type: "STATUS", name: "Status: Em Execucao", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "STEP", name: "Executar Reparo", icon: "\u2699\ufe0f", config: { description: "Realizar o reparo necessario", requirePhoto: true, requireNote: true, requireGps: false } },
      { type: "PHOTO", name: "Foto Apos Reparo", icon: "\ud83d\udcf8", config: { minPhotos: 1, label: "Evidencia do reparo concluido", photoType: "DEPOIS" } },
      { type: "SIGNATURE", name: "Aceite do Cliente", icon: "\u270d\ufe0f", config: { label: "Cliente confirma o reparo" } },
      { type: "STATUS", name: "Status: Concluida", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Notificar Todos", icon: "\ud83d\udcac", config: { recipients: [
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Reparo concluido: {titulo}. Tecnico: {tecnico}." },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Reparo em {titulo} foi concluido com sucesso!" },
      ] } },
    ]
  ),
  makeTemplate(
    "Fluxo em Branco",
    "Comece do zero e monte seu proprio fluxo",
    "\u2795",
    "bg-slate-500",
    []
  ),
];

interface Props {
  onSelect: (blocks: Block[]) => void;
  onClose: () => void;
}

export default function WorkflowTemplates({ onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Escolha um modelo</h2>
            <p className="text-xs text-slate-400">Selecione um template para comecar ou crie do zero</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-6">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.blocks)}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-lg shadow-sm ${t.color}`}>
                {t.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{t.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t.description}</p>
                <p className="text-[10px] text-slate-300 mt-1">
                  {t.blocks.filter(b => b.type !== "START" && b.type !== "END").length} blocos
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
