/* ═══════════════════════════════════════════════════════════════
   AUTOMATION BLOCKS — Type definitions, catalogs & connection rules
   Controls which blocks can connect to which (typed port system).
   ═══════════════════════════════════════════════════════════════ */

/* ── Port Types (connection compatibility) ─────────────────── */

export type PortType = 'TRIGGER_OUT' | 'ENTITY_OUT' | 'LOGIC_OUT';

/* ── Block Categories ──────────────────────────────────────── */

export type AutoBlockCategory = 'TRIGGER' | 'ENTITY' | 'EVENT' | 'CONDITION' | 'ACTION';

/* ── Connection Rules ──────────────────────────────────────── */

export const CONNECTION_RULES: Record<AutoBlockCategory, { acceptsFrom: PortType[]; outputPort: PortType }> = {
  TRIGGER:   { acceptsFrom: [],               outputPort: 'TRIGGER_OUT' },
  ENTITY:    { acceptsFrom: ['TRIGGER_OUT'],   outputPort: 'ENTITY_OUT' },
  EVENT:     { acceptsFrom: ['ENTITY_OUT'],    outputPort: 'LOGIC_OUT'  },
  CONDITION: { acceptsFrom: ['LOGIC_OUT'],     outputPort: 'LOGIC_OUT'  },
  ACTION:    { acceptsFrom: ['LOGIC_OUT'],     outputPort: 'LOGIC_OUT'  },
};

/* ── Entity Types ──────────────────────────────────────────── */

export type EntityType = 'SERVICE_ORDER' | 'PARTNER';

export const ENTITY_OPTIONS: { id: EntityType; label: string; icon: string }[] = [
  { id: 'SERVICE_ORDER', label: 'Ordem de Serviço', icon: '📋' },
  { id: 'PARTNER', label: 'Parceiro', icon: '👤' },
];

/* ── Event Types per Entity ────────────────────────────────── */

export interface EventOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const ENTITY_EVENTS: Record<EntityType, EventOption[]> = {
  SERVICE_ORDER: [
    { id: 'created',        label: 'Criada',          icon: '➕', description: 'Quando uma nova OS é criada' },
    { id: 'updated',        label: 'Editada',         icon: '✏️', description: 'Quando dados da OS são alterados' },
    { id: 'assigned',       label: 'Atribuída',       icon: '👤', description: 'Quando um técnico é atribuído' },
    { id: 'status_changed', label: 'Status Alterado', icon: '🔄', description: 'Quando o status muda (qualquer transição)' },
    { id: 'completed',      label: 'Finalizada',      icon: '✅', description: 'Quando a OS é concluída' },
    { id: 'approved',       label: 'Aprovada',        icon: '👍', description: 'Quando a OS é aprovada' },
    { id: 'cancelled',      label: 'Cancelada',       icon: '❌', description: 'Quando a OS é cancelada' },
    { id: 'deleted',        label: 'Excluída',        icon: '🗑️', description: 'Quando a OS é excluída' },
  ],
  PARTNER: [
    { id: 'partner_created',        label: 'Criado',          icon: '➕', description: 'Quando um novo parceiro é cadastrado' },
    { id: 'partner_updated',        label: 'Editado',         icon: '✏️', description: 'Quando dados do parceiro são alterados' },
    { id: 'partner_status_changed', label: 'Status Alterado', icon: '🔄', description: 'Quando o status do parceiro muda' },
    { id: 'partner_deleted',        label: 'Excluído',        icon: '🗑️', description: 'Quando o parceiro é excluído' },
  ],
};

/* ── Condition Fields per Entity ───────────────────────────── */

export type FieldType = 'enum' | 'text' | 'number' | 'date';

export interface ConditionFieldDef {
  id: string;
  label: string;
  type: FieldType;
  values?: string[];    // for enum fields
  placeholder?: string; // for text/number inputs
}

export const SERVICE_ORDER_STATUS_VALUES = [
  'ABERTA', 'OFERTADA', 'ATRIBUIDA', 'EM_EXECUCAO', 'CONCLUIDA', 'APROVADA', 'AJUSTE', 'CANCELADA',
];

export const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

export const ENTITY_FIELDS: Record<EntityType, ConditionFieldDef[]> = {
  SERVICE_ORDER: [
    { id: 'status',            label: 'Status',              type: 'enum',   values: SERVICE_ORDER_STATUS_VALUES },
    { id: 'oldStatus',         label: 'Status Anterior',     type: 'enum',   values: SERVICE_ORDER_STATUS_VALUES },
    { id: 'state',             label: 'Estado (UF)',         type: 'enum',   values: UF_LIST },
    { id: 'city',              label: 'Cidade',              type: 'text',   placeholder: 'Ex: São Paulo' },
    { id: 'neighborhood',      label: 'Bairro',              type: 'text',   placeholder: 'Ex: Centro' },
    { id: 'valueCents',        label: 'Valor (centavos)',    type: 'number', placeholder: 'Ex: 50000 (= R$500)' },
    { id: 'assignedPartnerId', label: 'Técnico Atribuído',  type: 'text',   placeholder: 'ID do técnico' },
    { id: 'clientPartnerId',   label: 'Cliente',             type: 'text',   placeholder: 'ID do cliente' },
    { id: 'title',             label: 'Título',              type: 'text',   placeholder: 'Ex: Instalação' },
    { id: 'description',       label: 'Descrição',           type: 'text',   placeholder: 'Texto livre' },
    { id: 'addressStreet',     label: 'Endereco',             type: 'text',   placeholder: 'Ex: Rua XV de Novembro' },
    { id: 'cep',               label: 'CEP',                 type: 'text',   placeholder: 'Ex: 01001-000' },
    { id: 'deadlineAt',        label: 'Prazo',               type: 'date' },
    { id: 'createdAt',         label: 'Data de Criação',     type: 'date' },
  ],
  PARTNER: [
    { id: 'status',       label: 'Status',         type: 'enum',   values: ['ATIVO', 'INATIVO', 'SUSPENSO'] },
    { id: 'personType',   label: 'Tipo Pessoa',    type: 'enum',   values: ['PF', 'PJ'] },
    { id: 'state',        label: 'Estado (UF)',    type: 'enum',   values: UF_LIST },
    { id: 'city',         label: 'Cidade',         type: 'text',   placeholder: 'Ex: São Paulo' },
    { id: 'name',         label: 'Nome',           type: 'text',   placeholder: 'Nome do parceiro' },
    { id: 'rating',       label: 'Avaliação',      type: 'number', placeholder: 'Ex: 4.5' },
  ],
};

/* ── Operators per Field Type ──────────────────────────────── */

export interface OperatorOption {
  id: string;
  label: string;
  symbol: string;
}

export const OPERATORS_BY_FIELD_TYPE: Record<FieldType, OperatorOption[]> = {
  enum: [
    { id: 'eq',  label: 'é igual a',       symbol: '=' },
    { id: 'neq', label: 'é diferente de',  symbol: '≠' },
    { id: 'in',  label: 'está em',         symbol: '∈' },
  ],
  text: [
    { id: 'eq',       label: 'é igual a',      symbol: '=' },
    { id: 'neq',      label: 'é diferente de', symbol: '≠' },
    { id: 'contains', label: 'contém',         symbol: '⊃' },
  ],
  number: [
    { id: 'eq',  label: 'é igual a',      symbol: '=' },
    { id: 'neq', label: 'é diferente de', symbol: '≠' },
    { id: 'gt',  label: 'maior que',      symbol: '>' },
    { id: 'lt',  label: 'menor que',      symbol: '<' },
    { id: 'gte', label: 'maior ou igual', symbol: '≥' },
    { id: 'lte', label: 'menor ou igual', symbol: '≤' },
  ],
  date: [
    { id: 'eq',  label: 'é igual a',  symbol: '=' },
    { id: 'gt',  label: 'depois de',  symbol: '>' },
    { id: 'lt',  label: 'antes de',   symbol: '<' },
    { id: 'gte', label: 'a partir de', symbol: '≥' },
    { id: 'lte', label: 'até',        symbol: '≤' },
  ],
};

/* ── Action Types per Entity ───────────────────────────────── */

export interface ActionTypeDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  entity: EntityType | 'ANY'; // 'ANY' = available for all entities
  configFields?: ActionConfigField[];
}

export interface ActionConfigField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export const ACTION_TYPES: ActionTypeDef[] = [
  {
    id: 'LAUNCH_FINANCIAL',
    label: 'Lançar Financeiro (Comissão)',
    icon: '💰',
    description: 'Confirma o repasse financeiro (comissão) da OS automaticamente',
    entity: 'SERVICE_ORDER',
  },
  {
    id: 'CHANGE_STATUS',
    label: 'Mudar Status da OS',
    icon: '🔄',
    description: 'Altera o status da OS automaticamente',
    entity: 'SERVICE_ORDER',
    configFields: [
      {
        id: 'targetStatus',
        label: 'Novo Status',
        type: 'select',
        required: true,
        options: SERVICE_ORDER_STATUS_VALUES.map(s => ({ value: s, label: s })),
      },
    ],
  },
  {
    id: 'SEND_NOTIFICATION',
    label: 'Enviar Notificação',
    icon: '💬',
    description: 'Envia uma notificação por WhatsApp, SMS ou Email',
    entity: 'ANY',
    configFields: [
      {
        id: 'channel',
        label: 'Canal',
        type: 'select',
        required: true,
        options: [
          { value: 'WHATSAPP', label: 'WhatsApp' },
          { value: 'SMS', label: 'SMS' },
          { value: 'EMAIL', label: 'Email' },
        ],
      },
      {
        id: 'recipient',
        label: 'Destinatário',
        type: 'select',
        required: true,
        options: [
          { value: 'TECNICO', label: 'Técnico' },
          { value: 'CLIENTE', label: 'Cliente' },
          { value: 'GESTOR', label: 'Gestor' },
        ],
      },
      {
        id: 'message',
        label: 'Mensagem',
        type: 'textarea',
        required: true,
        placeholder: 'Ex: OS finalizada com sucesso!',
      },
    ],
  },
  {
    id: 'ALERT_MANAGER',
    label: 'Alertar Gestor',
    icon: '🔔',
    description: 'Cria um alerta no painel do gestor',
    entity: 'ANY',
    configFields: [
      {
        id: 'message',
        label: 'Mensagem do Alerta',
        type: 'textarea',
        required: true,
        placeholder: 'Ex: OS de alto valor foi finalizada',
      },
      {
        id: 'severity',
        label: 'Severidade',
        type: 'select',
        options: [
          { value: 'info', label: 'Informação' },
          { value: 'warning', label: 'Atenção' },
          { value: 'critical', label: 'Crítico' },
        ],
      },
    ],
  },
  {
    id: 'ASSIGN_TECHNICIAN',
    label: 'Atribuir Técnico Automaticamente',
    icon: '👷',
    description: 'Atribui o técnico com melhor rating e especialização compatível',
    entity: 'SERVICE_ORDER',
    configFields: [
      {
        id: 'strategy',
        label: 'Estratégia',
        type: 'select',
        required: true,
        options: [
          { value: 'BEST_RATING', label: 'Melhor Avaliação' },
          { value: 'LEAST_BUSY', label: 'Menos Ocupado' },
        ],
      },
    ],
  },
  {
    id: 'DUPLICATE_OS',
    label: 'Duplicar OS',
    icon: '📋',
    description: 'Cria uma cópia da OS com status ABERTA',
    entity: 'SERVICE_ORDER',
  },
  {
    id: 'WEBHOOK',
    label: 'Chamar Webhook Externo',
    icon: '🔗',
    description: 'Envia dados do evento para uma URL externa via HTTP POST',
    entity: 'ANY',
    configFields: [
      {
        id: 'url',
        label: 'URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.exemplo.com/webhook',
      },
      {
        id: 'headers',
        label: 'Headers (JSON)',
        type: 'textarea',
        placeholder: '{"Authorization":"Bearer ..."}',
      },
    ],
  },
];

/* ── Colors per Category ───────────────────────────────────── */

export const CATEGORY_COLORS: Record<AutoBlockCategory, { bg: string; border: string; text: string; iconBg: string }> = {
  TRIGGER:   { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-900',  iconBg: 'bg-orange-500' },
  ENTITY:    { bg: 'bg-blue-50',    border: 'border-blue-300',    text: 'text-blue-900',    iconBg: 'bg-blue-500' },
  EVENT:     { bg: 'bg-green-50',   border: 'border-green-300',   text: 'text-green-900',   iconBg: 'bg-green-500' },
  CONDITION: { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-900',   iconBg: 'bg-amber-500' },
  ACTION:    { bg: 'bg-violet-50',  border: 'border-violet-300',  text: 'text-violet-900',  iconBg: 'bg-violet-500' },
};

/* ── Trigger/Condition/Action Data (stored in DB as JSON) ─── */

export interface TriggerDef {
  entity: EntityType;
  event: string;
  conditions?: ConditionNode[];
  /** 'simple' = flat AND list (default/legacy), 'advanced' = SIM/NÃO tree */
  conditionMode?: 'simple' | 'advanced';
}

/**
 * Legacy flat condition (kept for backward compat — same shape as ConditionNode without branches).
 */
export interface ConditionDef {
  field: string;
  operator: string;
  value: any;
}

/**
 * v1.00.20 — Condition with optional SIM/NÃO branching.
 * When trueBranch/falseBranch are absent the condition works as a classic AND filter.
 */
export interface ConditionNode {
  field: string;
  operator: string;
  value: any;
  trueBranch?: BranchDef;   // ✅ SIM — evaluated when condition is TRUE
  falseBranch?: BranchDef;  // ❌ NÃO — evaluated when condition is FALSE
}

/**
 * A branch inside a SIM/NÃO tree. Can contain nested conditions (AND) and/or actions.
 */
export interface BranchDef {
  conditions?: ConditionNode[];
  actions?: ActionDef[];
}

export interface ActionDef {
  type: string;
  config?: Record<string, any>;
}

export interface AutomationRuleData {
  id?: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: TriggerDef;
  actions: ActionDef[];
}

/* ── Helper: Get available actions for an entity ─────────── */

export function getActionsForEntity(entity: EntityType): ActionTypeDef[] {
  return ACTION_TYPES.filter(a => a.entity === entity || a.entity === 'ANY');
}

/* ── Helper: Get operators for a field ───────────────────── */

export function getOperatorsForField(entity: EntityType, fieldId: string): OperatorOption[] {
  const fields = ENTITY_FIELDS[entity];
  if (!fields) return [];
  const field = fields.find(f => f.id === fieldId);
  if (!field) return [];
  return OPERATORS_BY_FIELD_TYPE[field.type] || [];
}

/* ── Helper: Get field definition ────────────────────────── */

export function getFieldDef(entity: EntityType, fieldId: string): ConditionFieldDef | undefined {
  return ENTITY_FIELDS[entity]?.find(f => f.id === fieldId);
}

/* ── Helper: Get action definition ───────────────────────── */

export function getActionDef(actionType: string): ActionTypeDef | undefined {
  return ACTION_TYPES.find(a => a.id === actionType);
}

/* ── Helper: Count all conditions in a tree (recursive) ──── */

function countConditionsInTree(conditions?: ConditionNode[]): number {
  if (!conditions) return 0;
  let count = conditions.length;
  for (const c of conditions) {
    if (c.trueBranch?.conditions) count += countConditionsInTree(c.trueBranch.conditions);
    if (c.falseBranch?.conditions) count += countConditionsInTree(c.falseBranch.conditions);
  }
  return count;
}

/* ── Helper: Count all actions in a tree (recursive) ─────── */

export function countActionsInTree(conditions?: ConditionNode[]): number {
  if (!conditions) return 0;
  let count = 0;
  for (const c of conditions) {
    if (c.trueBranch?.actions) count += c.trueBranch.actions.length;
    if (c.trueBranch?.conditions) count += countActionsInTree(c.trueBranch.conditions);
    if (c.falseBranch?.actions) count += c.falseBranch.actions.length;
    if (c.falseBranch?.conditions) count += countActionsInTree(c.falseBranch.conditions);
  }
  return count;
}

/* ── Helper: Human-readable trigger summary ──────────────── */

export function describeTrigger(trigger: TriggerDef): string {
  const entityLabel = ENTITY_OPTIONS.find(e => e.id === trigger.entity)?.label || trigger.entity;
  const eventLabel = ENTITY_EVENTS[trigger.entity]?.find(e => e.id === trigger.event)?.label || trigger.event;
  const condCount = countConditionsInTree(trigger.conditions);
  const isAdvanced = trigger.conditionMode === 'advanced';

  let desc = `Quando ${entityLabel} é ${eventLabel}`;
  if (condCount > 0) {
    desc += ` (${condCount} condição${condCount > 1 ? 'ões' : ''}`;
    if (isAdvanced) desc += ' — árvore';
    desc += ')';
  }
  return desc;
}

/* ── Helper: Human-readable action summary ───────────────── */

export function describeActions(actions: ActionDef[]): string {
  return actions
    .map(a => ACTION_TYPES.find(t => t.id === a.type)?.label || a.type)
    .join(', ');
}
