/* ═══════════════════════════════════════════════════════════════
   FLOW BLOCKS — Sistema unificado de blocos "puzzle-piece"
   Combina workflow (execucao tecnico) + automacao (acoes sistema)
   em um unico builder estilo MIT App Inventor.
   Todos os nomes em Portugues Brasileiro.
   ═══════════════════════════════════════════════════════════════ */

/* ── Categorias ──────────────────────────────────────────── */

export type FlowBlockCategory =
  | 'TRIGGER'
  | 'FIELD'
  | 'CONDITION'
  | 'SYSTEM'
  | 'COMMUNICATION'
  | 'FINANCIAL'
  | 'INTEGRATION';

/* ── Tipos de Bloco ──────────────────────────────────────── */

export type FlowBlockType =
  | 'TRIGGER_START'
  | 'STEP' | 'PHOTO' | 'NOTE' | 'GPS' | 'QUESTION' | 'CHECKLIST' | 'SIGNATURE' | 'FORM'
  | 'GET'
  | 'CONDITION'
  | 'STATUS_CHANGE' | 'DELAY' | 'SLA' | 'RESCHEDULE' | 'GPS_PROXIMITY'
  | 'NOTIFY' | 'ALERT' | 'APPROVAL'
  | 'FINANCIAL_ENTRY'
  | 'WEBHOOK' | 'ASSIGN_TECH' | 'DUPLICATE_OS'
  | 'WAIT_FOR'
  | 'END';

/* ── Formatos de Peca ────────────────────────────────────── */

export type PuzzleShape = 'cap' | 'stack' | 'wrap' | 'end';

/* ── Definicao de Bloco ──────────────────────────────────── */

export interface FlowBlock {
  id: string;
  type: FlowBlockType;
  name: string;
  icon: string;
  config: Record<string, any>;
  children: string[];
  yesBranch?: string[];
  noBranch?: string[];
}

/* ── Definicao do Fluxo (salvo no DB) ────────────────────── */

export interface FlowDefinition {
  version: 3;
  blocks: FlowBlock[];
  trigger?: { entity: 'SERVICE_ORDER' | 'PARTNER'; event: string };
}

/* ── Entrada do Catalogo ─────────────────────────────────── */

export interface FlowCatalogEntry {
  type: FlowBlockType;
  name: string;
  icon: string;
  description: string;
  category: FlowBlockCategory;
  shape: PuzzleShape;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconBg: string;
  puzzleColor: string;
  configFields?: FlowConfigField[];
  requiresInteraction: boolean;
}

export interface FlowConfigField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'toggle' | 'items' | 'fields' | 'checklist' | 'recipients';
  required?: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Para opcoes dinamicas carregadas do banco (ex: 'specializations', 'technicians') */
  optionsFrom?: string;
  /** Mostrar campo apenas quando outro campo tiver determinado valor */
  showWhen?: { field: string; value: string | string[] };
}

/* ── Eventos de Gatilho ──────────────────────────────────── */

export interface TriggerEvent {
  id: string;
  label: string;
  icon: string;
  entity: 'SERVICE_ORDER' | 'PARTNER';
  description: string;
}

export const TRIGGER_EVENTS: TriggerEvent[] = [
  { id: 'os_created',        label: 'OS Criada',          icon: '➕', entity: 'SERVICE_ORDER', description: 'Quando uma nova OS e criada (qualquer tipo)' },
  { id: 'os_specialization_created', label: 'OS Especialização', icon: '🔍', entity: 'SERVICE_ORDER', description: 'OS criada com seleção de especialização' },
  { id: 'os_directed_created',      label: 'OS Direcionada',    icon: '🎯', entity: 'SERVICE_ORDER', description: 'OS criada com técnico direcionado' },
  { id: 'os_agenda_created',        label: 'OS Agenda',         icon: '📅', entity: 'SERVICE_ORDER', description: 'OS criada em regime de agenda (CLT)' },
  { id: 'os_assigned',       label: 'OS Atribuida',       icon: '👤', entity: 'SERVICE_ORDER', description: 'Quando um tecnico e atribuido' },
  { id: 'os_status_changed', label: 'Status OS Alterado', icon: '🔄', entity: 'SERVICE_ORDER', description: 'Quando o status da OS muda' },
  { id: 'os_completed',      label: 'OS Finalizada',      icon: '✅', entity: 'SERVICE_ORDER', description: 'Quando a OS e concluida' },
  { id: 'os_approved',       label: 'OS Aprovada',        icon: '👍', entity: 'SERVICE_ORDER', description: 'Quando a OS e aprovada' },
  { id: 'os_cancelled',      label: 'OS Cancelada',       icon: '❌', entity: 'SERVICE_ORDER', description: 'Quando a OS e cancelada' },
  { id: 'partner_created',        label: 'Parceiro Criado',          icon: '➕', entity: 'PARTNER', description: 'Quando um parceiro e cadastrado' },
  { id: 'partner_status_changed', label: 'Status Parceiro Alterado', icon: '🔄', entity: 'PARTNER', description: 'Quando o status do parceiro muda' },
];

export const OS_STATUS_VALUES = [
  'ABERTA', 'OFERTADA', 'ATRIBUIDA', 'A_CAMINHO', 'EM_EXECUCAO', 'CONCLUIDA', 'APROVADA', 'AJUSTE', 'CANCELADA',
];

export const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

/* ── Campos do Sistema (para bloco Buscar Dado) ──────────── */

export const SYSTEM_FIELDS = [
  { value: 'os.id', label: 'OS → ID' },
  { value: 'os.title', label: 'OS → Titulo' },
  { value: 'os.description', label: 'OS → Descricao' },
  { value: 'os.status', label: 'OS → Status' },
  { value: 'os.type', label: 'OS → Tipo de Servico' },
  { value: 'os.priority', label: 'OS → Prioridade' },
  { value: 'os.valueCents', label: 'OS → Valor (centavos)' },
  { value: 'os.valueFormatted', label: 'OS → Valor (R$)' },
  { value: 'os.scheduledDate', label: 'OS → Data Agendada' },
  { value: 'os.scheduledTime', label: 'OS → Hora Agendada' },
  { value: 'os.address', label: 'OS → Endereco Completo' },
  { value: 'os.street', label: 'OS → Rua' },
  { value: 'os.number', label: 'OS → Numero' },
  { value: 'os.complement', label: 'OS → Complemento' },
  { value: 'os.neighborhood', label: 'OS → Bairro' },
  { value: 'os.city', label: 'OS → Cidade' },
  { value: 'os.state', label: 'OS → Estado (UF)' },
  { value: 'os.zipCode', label: 'OS → CEP' },
  { value: 'os.lat', label: 'OS → Latitude' },
  { value: 'os.lng', label: 'OS → Longitude' },
  { value: 'os.notes', label: 'OS → Observacoes' },
  { value: 'os.createdAt', label: 'OS → Data de Criacao' },
  { value: 'os.link', label: 'OS → Link de Acesso' },
  { value: 'client.name', label: 'Cliente → Nome' },
  { value: 'client.phone', label: 'Cliente → Telefone' },
  { value: 'client.email', label: 'Cliente → Email' },
  { value: 'client.document', label: 'Cliente → CPF/CNPJ' },
  { value: 'tech.name', label: 'Tecnico → Nome' },
  { value: 'tech.phone', label: 'Tecnico → Telefone' },
  { value: 'tech.email', label: 'Tecnico → Email' },
  { value: 'tech.rating', label: 'Tecnico → Avaliacao' },
  { value: 'tech.specialization', label: 'Tecnico → Especializacao' },
  { value: 'partner.name', label: 'Parceiro → Nome Fantasia' },
  { value: 'partner.legalName', label: 'Parceiro → Razao Social' },
  { value: 'partner.document', label: 'Parceiro → CNPJ' },
  { value: 'partner.phone', label: 'Parceiro → Telefone' },
  { value: 'partner.email', label: 'Parceiro → Email' },
  { value: 'partner.city', label: 'Parceiro → Cidade' },
  { value: 'partner.state', label: 'Parceiro → Estado (UF)' },
  { value: 'company.name', label: 'Empresa → Nome' },
  { value: 'company.phone', label: 'Empresa → Telefone' },
  { value: 'finance.commission', label: 'Financeiro → Comissao (%)' },
  { value: 'finance.totalValue', label: 'Financeiro → Valor Total (R$)' },
  { value: 'finance.techPayment', label: 'Financeiro → Pagto Tecnico (R$)' },
];

/* ── Variáveis de Template para NOTIFY ───────────────────────── */

export interface NotifyRecipient {
  type: 'GESTOR' | 'TECNICO' | 'CLIENTE' | 'PARCEIRO';
  enabled: boolean;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  message: string;
  includeLink?: boolean;
  acceptanceType?: 'simple' | 'contract';
  contractName?: string;
  contractContent?: string;
  requireSignature?: boolean;
}

export const NOTIFY_TEMPLATE_VARS: { key: string; label: string; group: string }[] = [
  // OS
  { key: '{titulo}',       label: 'Titulo da OS',       group: 'OS' },
  { key: '{descricao}',    label: 'Descricao',          group: 'OS' },
  { key: '{status}',       label: 'Status',             group: 'OS' },
  { key: '{endereco}',     label: 'Endereco completo',  group: 'OS' },
  { key: '{prazo}',        label: 'Prazo',              group: 'OS' },
  { key: '{contato_local}',label: 'Contato no local',   group: 'OS' },
  { key: '{link}',         label: 'Link da OS',         group: 'OS' },
  // Valores
  { key: '{valor}',        label: 'Valor Total (R$)',   group: 'Financeiro' },
  { key: '{comissao}',     label: 'Comissao (%)',       group: 'Financeiro' },
  { key: '{valor_tecnico}',label: 'Valor Tecnico (R$)', group: 'Financeiro' },
  // Pessoas
  { key: '{cliente}',      label: 'Nome do Cliente',    group: 'Pessoas' },
  { key: '{cliente_fone}', label: 'Telefone Cliente',   group: 'Pessoas' },
  { key: '{tecnico}',      label: 'Nome do Tecnico',    group: 'Pessoas' },
  { key: '{tecnico_fone}', label: 'Telefone Tecnico',   group: 'Pessoas' },
  { key: '{empresa}',      label: 'Nome da Empresa',    group: 'Pessoas' },
];

export const DEFAULT_NOTIFY_RECIPIENTS: NotifyRecipient[] = [
  {
    type: 'GESTOR', enabled: true, channel: 'WHATSAPP',
    message: 'Nova OS: {titulo}\nCliente: {cliente}\nEndereco: {endereco}\nServico: {descricao}\nValor: {valor}',
  },
  {
    type: 'TECNICO', enabled: false, channel: 'WHATSAPP',
    message: 'OS atribuida: {titulo}\nComissao: {comissao}\nValor: {valor_tecnico}\nPrazo: {prazo}\nEndereco: {endereco}\nContato no local: {contato_local}',
    includeLink: true,
  },
  {
    type: 'CLIENTE', enabled: false, channel: 'WHATSAPP',
    message: '',
  },
];

/* ═══════════════════════════════════════════════════════════════
   CATALOGO DE BLOCOS — Todos em Portugues
   ═══════════════════════════════════════════════════════════════ */

export const FLOW_CATALOG: FlowCatalogEntry[] = [

  // ─── GATILHO ──────────────────────────────────
  { type: 'TRIGGER_START', name: 'Quando', icon: '⚡', description: 'Quando este evento acontecer',
    category: 'TRIGGER', shape: 'cap', puzzleColor: '#d97706', requiresInteraction: false,
    bgColor: 'bg-amber-50', borderColor: 'border-amber-400', textColor: 'text-amber-900', iconBg: 'bg-amber-600',
    configFields: [
      { id: 'triggerEvent', label: 'Evento', type: 'select', required: true,
        options: TRIGGER_EVENTS.map(e => ({ value: e.id, label: `${e.icon} ${e.label}` })) },
    ],
  },

  // ─── CAMPO (Tecnico) ──────────────────────────
  { type: 'STEP', name: 'Executar Etapa', icon: '⚙️', description: 'Passo que o tecnico confirma',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'description', label: 'Descricao', type: 'text', placeholder: 'O que o tecnico deve fazer' },
      { id: 'requirePhoto', label: 'Exigir Foto', type: 'toggle', defaultValue: false },
      { id: 'requireNote', label: 'Exigir Observacao', type: 'toggle', defaultValue: false },
      { id: 'requireGps', label: 'Exigir GPS', type: 'toggle', defaultValue: false },
    ],
  },
  { type: 'PHOTO', name: 'Tirar Foto', icon: '📸', description: 'Exigir foto do tecnico',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'label', label: 'Titulo', type: 'text', defaultValue: 'Foto', placeholder: 'Ex: Foto antes do servico' },
      { id: 'minPhotos', label: 'Minimo de fotos', type: 'number', defaultValue: 1 },
      { id: 'photoType', label: 'Tipo', type: 'select', defaultValue: 'GERAL', options: [
        { value: 'ANTES', label: 'Antes' }, { value: 'DEPOIS', label: 'Depois' },
        { value: 'EVIDENCIA', label: 'Evidencia' }, { value: 'GERAL', label: 'Geral' },
      ]},
    ],
  },
  { type: 'NOTE', name: 'Escrever Nota', icon: '📝', description: 'Campo de texto livre',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'placeholder', label: 'Texto guia', type: 'text', defaultValue: 'Digite sua observacao...' },
      { id: 'required', label: 'Obrigatorio', type: 'toggle', defaultValue: true },
    ],
  },
  { type: 'GPS', name: 'Capturar GPS', icon: '📍', description: 'Registrar localizacao',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'auto', label: 'Captura automatica', type: 'toggle', defaultValue: true },
      { id: 'requireActivation', label: 'Exigir GPS ativo p/ prosseguir', type: 'toggle', defaultValue: false },
      { id: 'trackContinuous', label: 'Rastreamento continuo', type: 'toggle', defaultValue: false },
      { id: 'label', label: 'Rotulo', type: 'select', defaultValue: 'POSICAO', options: [
        { value: 'CHECKIN', label: 'Check-in' }, { value: 'CHECKOUT', label: 'Check-out' }, { value: 'POSICAO', label: 'Posicao Atual' },
      ]},
    ],
  },
  { type: 'QUESTION', name: 'Fazer Pergunta', icon: '🤔', description: 'Pergunta com opcoes',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'question', label: 'Pergunta', type: 'text', required: true, placeholder: 'Ex: O equipamento funciona?' },
      { id: 'options', label: 'Opcoes', type: 'items', defaultValue: ['Sim', 'Nao'] },
    ],
  },
  { type: 'CHECKLIST', name: 'Checklist', icon: '☑️', description: 'Lista de itens',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'items', label: 'Itens', type: 'items', defaultValue: ['Item 1'] },
    ],
  },
  { type: 'SIGNATURE', name: 'Coletar Assinatura', icon: '✍️', description: 'Assinatura digital',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'label', label: 'Titulo', type: 'text', defaultValue: 'Assinatura do cliente' },
    ],
  },
  { type: 'FORM', name: 'Formulario', icon: '📋', description: 'Campos customizaveis',
    category: 'FIELD', shape: 'stack', puzzleColor: '#2563eb', requiresInteraction: true,
    bgColor: 'bg-blue-50', borderColor: 'border-blue-400', textColor: 'text-blue-900', iconBg: 'bg-blue-500',
    configFields: [
      { id: 'fields', label: 'Campos', type: 'fields', defaultValue: [{ name: 'Campo 1', type: 'text', required: false }] },
    ],
  },
  { type: 'GET', name: 'Buscar Dado', icon: '🔍', description: 'Busca qualquer campo do sistema',
    category: 'FIELD', shape: 'stack', puzzleColor: '#0891b2', requiresInteraction: false,
    bgColor: 'bg-cyan-50', borderColor: 'border-cyan-400', textColor: 'text-cyan-900', iconBg: 'bg-cyan-500',
    configFields: [
      { id: 'field', label: 'Campo', type: 'select', required: true, options: SYSTEM_FIELDS },
      { id: 'saveAs', label: 'Salvar como variavel', type: 'text', placeholder: 'Ex: cidade_os' },
    ],
  },

  // ─── CONDICAO ─────────────────────────────────
  { type: 'CONDITION', name: 'Se / Entao', icon: '❓', description: 'Divide em SIM / NAO',
    category: 'CONDITION', shape: 'wrap', puzzleColor: '#d97706', requiresInteraction: true,
    bgColor: 'bg-amber-50', borderColor: 'border-amber-400', textColor: 'text-amber-900', iconBg: 'bg-amber-500',
    configFields: [
      { id: 'conditionType', label: 'Tipo', type: 'select', defaultValue: 'question', options: [
        { value: 'question', label: 'Pergunta ao Tecnico' }, { value: 'field_check', label: 'Verificar Campo da OS' },
      ]},
      { id: 'question', label: 'Pergunta', type: 'text', placeholder: 'Ex: Precisa de reparo?' },
      { id: 'field', label: 'Campo', type: 'select', options: [
        { value: 'status', label: 'Status' }, { value: 'valueCents', label: 'Valor' },
        { value: 'state', label: 'Estado (UF)' }, { value: 'city', label: 'Cidade' },
        { value: 'type', label: 'Tipo de Servico' }, { value: 'priority', label: 'Prioridade' },
      ]},
      { id: 'operator', label: 'Operador', type: 'select', options: [
        { value: 'eq', label: 'Igual a' }, { value: 'neq', label: 'Diferente de' },
        { value: 'gt', label: 'Maior que' }, { value: 'lt', label: 'Menor que' }, { value: 'contains', label: 'Contem' },
      ]},
      { id: 'value', label: 'Valor', type: 'text', placeholder: 'Valor para comparar' },
    ],
  },

  // ─── SISTEMA ──────────────────────────────────
  { type: 'STATUS_CHANGE', name: 'Mudar Status', icon: '🔄', description: 'Altera status da OS',
    category: 'SYSTEM', shape: 'stack', puzzleColor: '#7c3aed', requiresInteraction: false,
    bgColor: 'bg-violet-50', borderColor: 'border-violet-400', textColor: 'text-violet-900', iconBg: 'bg-violet-500',
    configFields: [
      { id: 'targetStatus', label: 'Novo Status', type: 'select', required: true, options: OS_STATUS_VALUES.map(s => ({ value: s, label: s })) },
    ],
  },
  { type: 'DELAY', name: 'Aguardar', icon: '⏳', description: 'Aguardar X minutos',
    category: 'SYSTEM', shape: 'stack', puzzleColor: '#7c3aed', requiresInteraction: false,
    bgColor: 'bg-violet-50', borderColor: 'border-violet-400', textColor: 'text-violet-900', iconBg: 'bg-violet-500',
    configFields: [
      { id: 'minutes', label: 'Minutos', type: 'number', defaultValue: 15, placeholder: 'Ex: 30' },
    ],
  },
  { type: 'WAIT_FOR', name: 'Aguardar Verificando', icon: '⏳', description: 'Pausa e aguarda evento ou timeout',
    category: 'SYSTEM', shape: 'stack', puzzleColor: '#7c3aed', requiresInteraction: false,
    bgColor: 'bg-violet-50', borderColor: 'border-violet-400', textColor: 'text-violet-900', iconBg: 'bg-violet-500',
    configFields: [
      { id: 'timeoutMinutes', label: 'Tempo limite (minutos)', type: 'number',
        defaultValue: 60, placeholder: 'Ex: 30, 120, 1440 (24h)' },
      { id: 'triggerConditions', label: 'Disparar antecipadamente quando', type: 'checklist',
        defaultValue: [],
        options: [
          { value: 'os_assigned',       label: 'Tecnico aceitar a OS' },
          { value: 'os_status_changed', label: 'Status da OS mudar' },
          { value: 'os_completed',      label: 'OS for concluida' },
          { value: 'os_approved',       label: 'OS for aprovada' },
        ] },
      { id: 'targetStatus', label: 'Status alvo (quando "Status mudar")', type: 'select', defaultValue: '',
        options: [
          { value: '', label: 'Qualquer mudanca' },
          { value: 'ATRIBUIDA', label: 'ATRIBUIDA' },
          { value: 'EM_EXECUCAO', label: 'EM_EXECUCAO' },
          { value: 'CONCLUIDA', label: 'CONCLUIDA' },
          { value: 'APROVADA', label: 'APROVADA' },
        ],
        showWhen: { field: 'triggerConditions', value: ['os_status_changed'] } },
      { id: 'timeoutAction', label: 'Ao expirar tempo', type: 'select', defaultValue: 'continue',
        options: [
          { value: 'continue', label: 'Continuar para proximo bloco' },
          { value: 'cancel', label: 'Encerrar fluxo' },
        ] },
    ],
  },
  { type: 'SLA', name: 'Tempo pra Executar', icon: '⏱️', description: 'Tempo limite com alerta',
    category: 'SYSTEM', shape: 'stack', puzzleColor: '#7c3aed', requiresInteraction: false,
    bgColor: 'bg-violet-50', borderColor: 'border-violet-400', textColor: 'text-violet-900', iconBg: 'bg-violet-500',
    configFields: [
      { id: 'maxMinutes', label: 'Tempo Maximo (min)', type: 'number', defaultValue: 240 },
      { id: 'alertOnExceed', label: 'Alertar ao Exceder', type: 'toggle', defaultValue: true },
      { id: 'label', label: 'Rotulo no App', type: 'text', defaultValue: 'Tempo pra executar' },
    ],
  },
  { type: 'RESCHEDULE', name: 'Reagendar', icon: '📅', description: 'Reagendar OS',
    category: 'SYSTEM', shape: 'stack', puzzleColor: '#7c3aed', requiresInteraction: false,
    bgColor: 'bg-violet-50', borderColor: 'border-violet-400', textColor: 'text-violet-900', iconBg: 'bg-violet-500',
    configFields: [
      { id: 'reason', label: 'Motivo', type: 'text', placeholder: 'Motivo do reagendamento' },
    ],
  },
  { type: 'GPS_PROXIMITY', name: 'Proximidade GPS', icon: '📡', description: 'Dispara ao se aproximar do local',
    category: 'SYSTEM', shape: 'stack', puzzleColor: '#6d28d9', requiresInteraction: false,
    bgColor: 'bg-violet-50', borderColor: 'border-violet-400', textColor: 'text-violet-900', iconBg: 'bg-violet-600',
    configFields: [
      { id: 'radiusMeters', label: 'Raio (metros)', type: 'number', defaultValue: 200, placeholder: 'Ex: 200' },
      { id: 'target', label: 'Ponto Alvo', type: 'select', defaultValue: 'OS_ADDRESS', options: [
        { value: 'OS_ADDRESS', label: 'Endereco da OS' }, { value: 'CUSTOM', label: 'Coordenadas customizadas' },
      ]},
      { id: 'customLat', label: 'Latitude', type: 'text', placeholder: '-15.7801' },
      { id: 'customLng', label: 'Longitude', type: 'text', placeholder: '-47.9292' },
    ],
  },

  // ─── COMUNICACAO ──────────────────────────────
  { type: 'NOTIFY', name: 'Enviar Mensagem', icon: '💬', description: 'Multi-destinatario com templates',
    category: 'COMMUNICATION', shape: 'stack', puzzleColor: '#059669', requiresInteraction: false,
    bgColor: 'bg-emerald-50', borderColor: 'border-emerald-400', textColor: 'text-emerald-900', iconBg: 'bg-emerald-500',
    configFields: [
      { id: 'recipients', label: 'Destinatarios', type: 'recipients', required: true,
        defaultValue: DEFAULT_NOTIFY_RECIPIENTS },
    ],
  },
  { type: 'ALERT', name: 'Criar Alerta', icon: '🔔', description: 'Alerta para o gestor',
    category: 'COMMUNICATION', shape: 'stack', puzzleColor: '#059669', requiresInteraction: false,
    bgColor: 'bg-emerald-50', borderColor: 'border-emerald-400', textColor: 'text-emerald-900', iconBg: 'bg-emerald-500',
    configFields: [
      { id: 'message', label: 'Mensagem', type: 'textarea', required: true },
      { id: 'severity', label: 'Severidade', type: 'select', defaultValue: 'info', options: [
        { value: 'info', label: 'Informacao' }, { value: 'warning', label: 'Atencao' }, { value: 'critical', label: 'Critico' },
      ]},
    ],
  },
  { type: 'APPROVAL', name: 'Aguardar Aprovacao', icon: '🔒', description: 'Trava ate aprovar',
    category: 'COMMUNICATION', shape: 'stack', puzzleColor: '#059669', requiresInteraction: true,
    bgColor: 'bg-emerald-50', borderColor: 'border-emerald-400', textColor: 'text-emerald-900', iconBg: 'bg-emerald-500',
    configFields: [
      { id: 'approverRole', label: 'Aprovador', type: 'select', defaultValue: 'ADMIN', options: [
        { value: 'ADMIN', label: 'Administrador' }, { value: 'DESPACHO', label: 'Despacho' },
      ]},
      { id: 'message', label: 'Mensagem', type: 'text', placeholder: 'Motivo' },
    ],
  },

  // ─── FINANCEIRO ───────────────────────────────
  { type: 'FINANCIAL_ENTRY', name: 'Lancar Financeiro', icon: '💰', description: 'Comissao/repasse',
    category: 'FINANCIAL', shape: 'stack', puzzleColor: '#0d9488', requiresInteraction: false,
    bgColor: 'bg-teal-50', borderColor: 'border-teal-400', textColor: 'text-teal-900', iconBg: 'bg-teal-600',
    configFields: [
      { id: 'entryType', label: 'Tipo', type: 'select', defaultValue: 'AUTO', options: [
        { value: 'AUTO', label: 'Automatico (comissao)' }, { value: 'RECEIVABLE', label: 'Conta a Receber' }, { value: 'PAYABLE', label: 'Conta a Pagar' },
      ]},
      { id: 'valueField', label: 'Campo de Valor', type: 'select', defaultValue: 'os.valueCents', options: [
        { value: 'os.valueCents', label: 'Valor da OS' }, { value: 'custom', label: 'Valor customizado' },
      ]},
      { id: 'customValue', label: 'Valor (R$)', type: 'number', placeholder: '150.00' },
    ],
  },

  // ─── INTEGRACAO ───────────────────────────────
  { type: 'WEBHOOK', name: 'Chamar Webhook', icon: '🔗', description: 'Envia para URL externa',
    category: 'INTEGRATION', shape: 'stack', puzzleColor: '#e11d48', requiresInteraction: false,
    bgColor: 'bg-rose-50', borderColor: 'border-rose-400', textColor: 'text-rose-900', iconBg: 'bg-rose-500',
    configFields: [
      { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.exemplo.com/webhook' },
      { id: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization":"Bearer ..."}' },
    ],
  },
  { type: 'ASSIGN_TECH', name: 'Atribuir Tecnico', icon: '👷', description: 'Atribui automaticamente',
    category: 'INTEGRATION', shape: 'stack', puzzleColor: '#e11d48', requiresInteraction: false,
    bgColor: 'bg-rose-50', borderColor: 'border-rose-400', textColor: 'text-rose-900', iconBg: 'bg-rose-500',
    configFields: [
      { id: 'strategy', label: 'Estrategia', type: 'select', required: true, options: [
        { value: 'BEST_RATING', label: 'Melhor Avaliacao' },
        { value: 'LEAST_BUSY', label: 'Menos Ocupado' },
        { value: 'NEAREST', label: 'Mais Proximo' },
        { value: 'BY_SPECIALIZATION', label: 'Por Especializacao' },
        { value: 'TECNICO_ATRIBUIDO', label: 'Tecnico Atribuido (da OS)' },
      ]},
      { id: 'specializations', label: 'Especializacoes', type: 'checklist',
        optionsFrom: 'specializations',
        showWhen: { field: 'strategy', value: 'BY_SPECIALIZATION' },
      },
      { id: 'techSource', label: 'Origem do Tecnico', type: 'select',
        showWhen: { field: 'strategy', value: 'TECNICO_ATRIBUIDO' },
        defaultValue: 'OS_FIELD',
        options: [
          { value: 'OS_FIELD', label: 'Campo Tecnico da OS' },
          { value: 'SPECIFIC', label: 'Tecnico Especifico' },
        ],
      },
      { id: 'techId', label: 'Tecnico', type: 'select',
        optionsFrom: 'technicians',
        showWhen: { field: 'techSource', value: 'SPECIFIC' },
      },
    ],
  },
  { type: 'DUPLICATE_OS', name: 'Duplicar OS', icon: '📋', description: 'Copia com status ABERTA',
    category: 'INTEGRATION', shape: 'stack', puzzleColor: '#e11d48', requiresInteraction: false,
    bgColor: 'bg-rose-50', borderColor: 'border-rose-400', textColor: 'text-rose-900', iconBg: 'bg-rose-500',
  },

  // ─── FIM ──────────────────────────────────────
  { type: 'END', name: 'Fim', icon: '⏹️', description: 'Final do fluxo',
    category: 'SYSTEM', shape: 'end', puzzleColor: '#475569', requiresInteraction: false,
    bgColor: 'bg-slate-100', borderColor: 'border-slate-400', textColor: 'text-slate-700', iconBg: 'bg-slate-500',
  },
];

/* ── Cores e Labels por Categoria ────────────────────────── */

export const CATEGORY_META: Record<FlowBlockCategory, { label: string; icon: string; color: string; description: string }> = {
  TRIGGER:       { label: 'Gatilho',      icon: '⚡', color: '#d97706', description: 'Quando o fluxo dispara' },
  FIELD:         { label: 'Campo',        icon: '🔧', color: '#2563eb', description: 'Acoes do tecnico em campo' },
  CONDITION:     { label: 'Condicao',     icon: '❓', color: '#d97706', description: 'Ramificacao SIM/NAO' },
  SYSTEM:        { label: 'Sistema',      icon: '⚙️', color: '#7c3aed', description: 'Acoes automaticas' },
  COMMUNICATION: { label: 'Comunicacao',  icon: '💬', color: '#059669', description: 'Mensagens e alertas' },
  FINANCIAL:     { label: 'Financeiro',   icon: '💰', color: '#0d9488', description: 'Lancamentos financeiros' },
  INTEGRATION:   { label: 'Integracao',   icon: '🔗', color: '#e11d48', description: 'Integracao externa' },
};

/* ── Funcoes ─────────────────────────────────────────────── */

export function getCatalogEntry(type: FlowBlockType): FlowCatalogEntry | undefined {
  return FLOW_CATALOG.find(b => b.type === type);
}

export function getCatalogByCategory(): Record<FlowBlockCategory, FlowCatalogEntry[]> {
  const map: Record<string, FlowCatalogEntry[]> = {};
  for (const cat of Object.keys(CATEGORY_META) as FlowBlockCategory[]) {
    map[cat] = FLOW_CATALOG.filter(b => b.category === cat && b.type !== 'END');
  }
  return map as Record<FlowBlockCategory, FlowCatalogEntry[]>;
}

let _idCounter = 0;
export function genFlowBlockId(): string {
  _idCounter++;
  return `fb_${Date.now().toString(36)}_${_idCounter}`;
}

export function createFlowBlock(type: FlowBlockType, overrides?: Partial<FlowBlock>): FlowBlock {
  const cat = getCatalogEntry(type);
  const defaultConfig: Record<string, any> = {};
  if (cat?.configFields) {
    for (const f of cat.configFields) {
      if (f.defaultValue !== undefined) defaultConfig[f.id] = f.defaultValue;
    }
  }
  return {
    id: genFlowBlockId(), type, name: cat?.name || type, icon: cat?.icon || '⚙️',
    config: defaultConfig, children: [],
    ...(type === 'CONDITION' ? { yesBranch: [], noBranch: [] } : {}),
    ...overrides,
  };
}

export function createDefaultFlow(): FlowDefinition {
  const trigger = createFlowBlock('TRIGGER_START');
  const end = createFlowBlock('END');
  trigger.children = [end.id];
  return { version: 3, blocks: [trigger, end], trigger: { entity: 'SERVICE_ORDER', event: 'os_assigned' } };
}

export function findFlowBlock(blocks: FlowBlock[], id: string): FlowBlock | undefined {
  return blocks.find(b => b.id === id);
}

export function getTriggerBlock(blocks: FlowBlock[]): FlowBlock | undefined {
  return blocks.find(b => b.type === 'TRIGGER_START');
}

export function getEndBlock(blocks: FlowBlock[]): FlowBlock | undefined {
  return blocks.find(b => b.type === 'END');
}

export function countUserBlocks(blocks: FlowBlock[]): number {
  return blocks.filter(b => b.type !== 'TRIGGER_START' && b.type !== 'END').length;
}

export function convertFlowToV2(flow: FlowDefinition): { version: 2; blocks: any[] } {
  const v2Blocks: any[] = [];
  const triggerBlock = getTriggerBlock(flow.blocks);
  if (!triggerBlock) return { version: 2, blocks: [] };
  const startId = `v2_start_${Date.now()}`;
  const endId = `v2_end_${Date.now()}`;
  v2Blocks.push({ id: startId, type: 'START', name: 'Inicio', icon: '▶️', config: {}, next: null });
  function walk(childIds: string[], parentV2Id: string, via: string = 'next'): string | null {
    let prevId = parentV2Id; let lastId: string | null = null;
    for (const cid of childIds) {
      const b = findFlowBlock(flow.blocks, cid);
      if (!b) continue;
      if (b.type === 'END') { const p = v2Blocks.find(x => x.id === prevId); if (p) p[via === 'next' || lastId ? 'next' : via] = endId; lastId = endId; continue; }
      const v2t = b.type === 'STATUS_CHANGE' ? 'STATUS' : b.type;
      const v2b: any = { id: b.id, type: v2t, name: b.name, icon: b.icon, config: b.config, next: null };
      if (b.type === 'CONDITION') { v2b.yesBranch = null; v2b.noBranch = null; if (b.yesBranch?.length) walk(b.yesBranch, b.id, 'yesBranch'); if (b.noBranch?.length) walk(b.noBranch, b.id, 'noBranch'); }
      v2Blocks.push(v2b);
      const p = v2Blocks.find(x => x.id === prevId); if (p) { if (lastId) p.next = b.id; else p[via] = b.id; }
      prevId = b.id; lastId = b.id; via = 'next';
    }
    return lastId;
  }
  walk(triggerBlock.children, startId);
  v2Blocks.push({ id: endId, type: 'END', name: 'Fim', icon: '⏹️', config: {}, next: null });
  const last = v2Blocks[v2Blocks.length - 2]; if (last && !last.next) last.next = endId;
  return { version: 2, blocks: v2Blocks };
}
