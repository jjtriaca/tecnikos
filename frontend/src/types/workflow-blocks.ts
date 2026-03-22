/* ═══════════════════════════════════════════════════════════════
   WORKFLOW BLOCKS — Type definitions and catalog
   Shared between builder UI, workflow engine, and technician view
   ═══════════════════════════════════════════════════════════════ */

/* ── Block Types ─────────────────────────────────────────────── */

export type BlockType =
  // Flow control
  | 'START'
  | 'END'
  | 'CONDITION'
  | 'ACTION_BUTTONS'
  // Actions (technician-facing)
  | 'STEP'
  | 'PHOTO'
  | 'NOTE'
  | 'GPS'
  | 'QUESTION'
  | 'CHECKLIST'
  | 'SIGNATURE'
  | 'FORM'
  | 'MATERIALS'
  // Communication
  | 'NOTIFY'
  | 'APPROVAL'
  | 'ALERT'
  // Visual / Informational
  | 'INFO'
  // GPS / Tracking
  | 'PROXIMITY_TRIGGER'
  // System
  | 'DELAY'
  | 'SLA'
  | 'STATUS'
  | 'RESCHEDULE';

export type BlockCategory = 'FLOW' | 'ACTIONS' | 'VISUAL' | 'COMMUNICATION' | 'SYSTEM';

/* ── Block Data Model ────────────────────────────────────────── */

export type Block = {
  id: string;
  type: BlockType;
  name: string;
  icon: string;
  config: Record<string, any>;
  // Graph connections
  next: string | null;
  // Only for CONDITION blocks:
  yesBranch?: string | null;
  noBranch?: string | null;
  // Only for ACTION_BUTTONS blocks: maps buttonId → next blockId
  branches?: Record<string, string | null>;
};

export type WorkflowDefV2 = {
  version: 2;
  blocks: Block[];
};

/* ── Block Config Types ──────────────────────────────────────── */

export type StepConfig = {
  description?: string;
  requirePhoto?: boolean;
  requireNote?: boolean;
  requireGps?: boolean;
};

export type PhotoConfig = {
  minPhotos?: number;
  label?: string;
  photoType?: 'ANTES' | 'DEPOIS' | 'EVIDENCIA' | 'GERAL';
};

export type NoteConfig = {
  placeholder?: string;
  required?: boolean;
};

export type GpsConfig = {
  auto?: boolean;
  required?: boolean;
  highAccuracy?: boolean;
  trackingMode?: 'single' | 'continuous';
  intervalSeconds?: number;
  // Proximity fields (continuous mode only)
  radiusMeters?: number;
  showDistanceToTech?: boolean;
  autoAdvanceOnProximity?: boolean;
  arrivalButton?: { label: string; color: string; icon: string; size?: string };
  saveArrivalCoords?: boolean;
  onEnterRadius?: {
    notifyCliente?: { enabled: boolean; channel: string; message: string };
    notifyGestor?: { enabled: boolean; channel: string; message: string };
    autoChangeStatus?: string;
    alert?: { enabled: boolean; message: string };
  };
};

export type QuestionConfig = {
  question?: string;
  options?: string[];
};

export type ChecklistConfig = {
  items?: string[];
};

export type SignatureConfig = {
  label?: string;
};

export type FormConfig = {
  fields?: { name: string; type: 'text' | 'number' | 'select'; required?: boolean; options?: string[] }[];
};

export type ConditionConfig = {
  conditionType?: 'question' | 'gps_proximity' | 'time_range' | 'field_check';
  question?: string;
  gpsMeters?: number;
  timeStart?: string;
  timeEnd?: string;
  field?: string;
  operator?: string;
  value?: string;
};

export type NotifyConfig = {
  channel?: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH';
  message?: string;
  recipient?: 'CLIENTE' | 'GESTOR' | 'TECNICO';
};

export type ApprovalConfig = {
  approverRole?: 'ADMIN' | 'DESPACHO';
  message?: string;
};

export type AlertConfig = {
  message?: string;
  severity?: 'info' | 'warning' | 'critical';
};

export type DelayConfig = {
  minutes?: number;
  duration?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days';
};

export type SlaConfig = {
  maxMinutes?: number;
  alertOnExceed?: boolean;
};

export type StatusConfig = {
  targetStatus?: string;
};

export type RescheduleConfig = {
  reason?: string;
};

export type ActionButtonDef = {
  id: string;
  label: string;
  color: 'green' | 'red' | 'blue' | 'yellow' | 'slate';
  icon?: string;
};

export type ActionButtonsConfig = {
  title?: string;
  buttons?: ActionButtonDef[];
};

/* ── Block Catalog Definition ────────────────────────────────── */

export type CatalogEntry = {
  type: BlockType;
  name: string;
  icon: string;
  description: string;
  category: BlockCategory;
  color: string;       // tailwind bg class
  borderColor: string; // tailwind border class
  iconBg: string;      // tailwind bg class for icon circle
  textColor: string;   // tailwind text class
};

/* ── Block Catalog ───────────────────────────────────────────── */

export const BLOCK_CATALOG: CatalogEntry[] = [
  // Flow
  { type: 'CONDITION', name: 'SE / Condição', icon: '❓', description: 'Avalia condição → 2 caminhos (SIM / NÃO)', category: 'FLOW', color: 'bg-amber-50', borderColor: 'border-amber-300', iconBg: 'bg-amber-500', textColor: 'text-amber-900' },
  { type: 'ACTION_BUTTONS', name: 'Botões de Ação', icon: '🎯', description: 'Botões para o técnico escolher (aceitar, recusar, etc.)', category: 'FLOW', color: 'bg-amber-50', borderColor: 'border-amber-300', iconBg: 'bg-amber-600', textColor: 'text-amber-900' },

  // Actions
  { type: 'STEP', name: 'Etapa', icon: '⚙️', description: 'Passo que o técnico confirma', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'PHOTO', name: 'Foto', icon: '📸', description: 'Tirar ou enviar foto', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'NOTE', name: 'Nota', icon: '📝', description: 'Observação de texto', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'GPS', name: 'GPS', icon: '📍', description: 'Registrar localização atual', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'QUESTION', name: 'Pergunta', icon: '🤔', description: 'Pergunta com opções para o técnico', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'CHECKLIST', name: 'Checklist', icon: '☑️', description: 'Lista de itens para verificar', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'SIGNATURE', name: 'Assinatura', icon: '✍️', description: 'Assinatura digital do cliente', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },
  { type: 'FORM', name: 'Formulário', icon: '📋', description: 'Campos customizáveis', category: 'ACTIONS', color: 'bg-blue-50', borderColor: 'border-blue-300', iconBg: 'bg-blue-500', textColor: 'text-blue-900' },

  // Visual / Informational
  { type: 'INFO', name: 'Informação', icon: 'ℹ️', description: 'Exibe informação visual para o técnico (não requer ação)', category: 'VISUAL', color: 'bg-cyan-50', borderColor: 'border-cyan-300', iconBg: 'bg-cyan-500', textColor: 'text-cyan-900' },

  // GPS / Tracking
  { type: 'PROXIMITY_TRIGGER', name: 'Proximidade (legado)', icon: '📡', description: 'Legado — use GPS em modo continuo. Rastreia GPS e dispara eventos ao entrar no raio do destino', category: 'ACTIONS', color: 'bg-rose-50', borderColor: 'border-rose-300', iconBg: 'bg-rose-500', textColor: 'text-rose-900' },

  // Communication
  { type: 'NOTIFY', name: 'Notificar', icon: '💬', description: 'Enviar WhatsApp ou Email automatico', category: 'COMMUNICATION', color: 'bg-emerald-50', borderColor: 'border-emerald-300', iconBg: 'bg-emerald-500', textColor: 'text-emerald-900' },
  { type: 'APPROVAL', name: 'Aprovação', icon: '🔒', description: 'Trava fluxo até gestor aprovar', category: 'COMMUNICATION', color: 'bg-emerald-50', borderColor: 'border-emerald-300', iconBg: 'bg-emerald-500', textColor: 'text-emerald-900' },
  { type: 'ALERT', name: 'Alerta', icon: '🔔', description: 'Alerta para o gestor/dashboard', category: 'COMMUNICATION', color: 'bg-emerald-50', borderColor: 'border-emerald-300', iconBg: 'bg-emerald-500', textColor: 'text-emerald-900' },

  // System
  { type: 'DELAY', name: 'Delay', icon: '⏳', description: 'Aguardar X minutos/horas', category: 'SYSTEM', color: 'bg-violet-50', borderColor: 'border-violet-300', iconBg: 'bg-violet-500', textColor: 'text-violet-900' },
  { type: 'SLA', name: 'SLA', icon: '⏱️', description: 'Tempo limite com alerta', category: 'SYSTEM', color: 'bg-violet-50', borderColor: 'border-violet-300', iconBg: 'bg-violet-500', textColor: 'text-violet-900' },
  { type: 'STATUS', name: 'Status', icon: '🔄', description: 'Mudar status da OS', category: 'SYSTEM', color: 'bg-violet-50', borderColor: 'border-violet-300', iconBg: 'bg-violet-500', textColor: 'text-violet-900' },
  { type: 'RESCHEDULE', name: 'Reagendar', icon: '📅', description: 'Reagendar OS para outra data', category: 'SYSTEM', color: 'bg-violet-50', borderColor: 'border-violet-300', iconBg: 'bg-violet-500', textColor: 'text-violet-900' },
];

export const CATALOG_BY_CATEGORY: Record<BlockCategory, CatalogEntry[]> = {
  FLOW: BLOCK_CATALOG.filter(b => b.category === 'FLOW'),
  ACTIONS: BLOCK_CATALOG.filter(b => b.category === 'ACTIONS'),
  VISUAL: BLOCK_CATALOG.filter(b => b.category === 'VISUAL'),
  COMMUNICATION: BLOCK_CATALOG.filter(b => b.category === 'COMMUNICATION'),
  SYSTEM: BLOCK_CATALOG.filter(b => b.category === 'SYSTEM'),
};

export const CATEGORY_LABELS: Record<BlockCategory, { label: string; icon: string }> = {
  FLOW: { label: 'Fluxo', icon: '⚙️' },
  ACTIONS: { label: 'Ações', icon: '✋' },
  VISUAL: { label: 'Visual', icon: 'ℹ️' },
  COMMUNICATION: { label: 'Comunicação', icon: '💬' },
  SYSTEM: { label: 'Sistema', icon: '🔧' },
};

/* ── Catalog Lookup ──────────────────────────────────────────── */

export function getCatalogEntry(type: BlockType): CatalogEntry | undefined {
  return BLOCK_CATALOG.find(b => b.type === type);
}

/* ── ID Generator ────────────────────────────────────────────── */

let _counter = 0;
export function genBlockId(): string {
  _counter++;
  return `b_${Date.now().toString(36)}_${_counter}`;
}

/* ── Default Block Factory ───────────────────────────────────── */

export function createBlock(type: BlockType, overrides?: Partial<Block>): Block {
  const cat = getCatalogEntry(type);
  const base: Block = {
    id: genBlockId(),
    type,
    name: cat?.name || type,
    icon: cat?.icon || '⚙️',
    config: getDefaultConfig(type),
    next: null,
    ...(type === 'CONDITION' ? { yesBranch: null, noBranch: null } : {}),
    ...(type === 'ACTION_BUTTONS' ? { branches: {} } : {}),
  };
  return { ...base, ...overrides };
}

export function getDefaultConfig(type: BlockType): Record<string, any> {
  switch (type) {
    case 'STEP': return { requirePhoto: false, requireNote: false, requireGps: false, description: 'Executar o servico conforme especificado na ordem', confirmButton: { label: 'Confirmar etapa', color: 'blue', icon: '✅' } };
    case 'PHOTO': return { minPhotos: 1, label: 'Registrar foto do local ou equipamento', photoType: 'GERAL', confirmButton: { label: 'Enviar fotos', color: 'green', icon: '📸' } };
    case 'NOTE': return { placeholder: 'Descreva as condicoes encontradas, servicos realizados e observacoes relevantes...', required: true, confirmButton: { label: 'Enviar', color: 'blue', icon: '📝' } };
    case 'GPS': return { highAccuracy: true, trackingMode: 'single', radiusMeters: 50, autoAdvanceOnProximity: true };
    case 'PROXIMITY_TRIGGER': return {
      radiusMeters: 50,
      trackingIntervalSeconds: 30,
      requireHighAccuracy: true,
      onEnterRadius: {
        notifyCliente: { enabled: false, channel: 'WHATSAPP', message: 'Ola {cliente}, o tecnico {tecnico} esta chegando ao local! Previsao de chegada em poucos minutos.' },
        notifyGestor: { enabled: false, channel: 'WHATSAPP', message: 'Tecnico {tecnico} esta proximo do local da OS {codigo} - {titulo}.' },
        autoChangeStatus: '',
        alert: { enabled: false, message: 'Tecnico {tecnico} chegou na regiao da OS {codigo}' },
      },
    };
    case 'QUESTION': return { question: 'O equipamento esta funcionando corretamente?', options: ['Sim', 'Nao'], confirmButton: { label: 'Confirmar', color: 'blue', icon: '✅' } };
    case 'CHECKLIST': return { items: ['Verificar condicoes do local', 'Inspecionar equipamento', 'Testar funcionamento'], confirmButton: { label: 'Confirmar checklist', color: 'green', icon: '☑️' } };
    case 'SIGNATURE': return { label: 'Assinatura do cliente confirmando a execucao do servico', confirmButton: { label: 'Enviar assinatura', color: 'blue', icon: '✍️' } };
    case 'FORM': return { fields: [{ name: 'Condicao do equipamento', type: 'select', required: true, options: ['Bom', 'Regular', 'Ruim'] }, { name: 'Observacoes', type: 'text', required: false }], confirmButton: { label: 'Enviar formulario', color: 'green', icon: '📋' } };
    case 'MATERIALS': return { label: 'Liste os materiais necessarios para o servico', notePlaceholder: 'Descreva o diagnostico e observacoes...', noteRequired: false, minItems: 1, confirmButton: { label: 'Enviar materiais', color: 'green', icon: '📦' } };
    case 'CONDITION': return { conditionType: 'question', question: 'O servico foi concluido com sucesso?' };
    case 'ACTION_BUTTONS': return { title: '', buttons: [{ id: 'btn_0', label: 'Confirmar', color: 'green', icon: '✅' }] };
    case 'NOTIFY': return { recipients: [{ type: 'CLIENTE', enabled: true, channel: 'WHATSAPP', message: 'Ola {nome}, informamos que o servico {titulo} foi concluido com sucesso pelo tecnico {tecnico}. A {razao_social} agradece pela preferencia! Qualquer duvida, entre em contato.' }] };
    case 'APPROVAL': return { approverRole: 'ADMIN', message: 'Servico finalizado aguardando aprovacao do gestor para encerramento da OS.' };
    case 'ALERT': return { message: 'Atencao: verificar pendencia na ordem de servico {titulo}.', severity: 'warning' };
    case 'DELAY': return { duration: 15, unit: 'minutes', minutes: 15 };
    case 'SLA': return { maxMinutes: 240, alertOnExceed: true };
    case 'STATUS': return { targetStatus: 'EM_EXECUCAO' };
    case 'RESCHEDULE': return { reason: 'Cliente solicitou reagendamento' };
    case 'INFO': return { icon: 'ℹ️', color: 'blue', fontSize: 'md', boxSize: 'normal', title: '', message: '', confirmButton: { label: 'Entendi', color: 'blue', icon: 'ℹ️' } };
    default: return {};
  }
}

/* ── Default Workflow ────────────────────────────────────────── */

export function createDefaultWorkflow(): Block[] {
  const startId = genBlockId();
  const endId = genBlockId();

  return [
    { id: startId, type: 'START', name: 'Início', icon: '▶️', config: {}, next: endId },
    { id: endId, type: 'END', name: 'Fim', icon: '⏹️', config: {}, next: null },
  ];
}

/* ── Graph Helpers ───────────────────────────────────────────── */

export function findBlock(blocks: Block[], id: string): Block | undefined {
  return blocks.find(b => b.id === id);
}

export function findStartBlock(blocks: Block[]): Block | undefined {
  return blocks.find(b => b.type === 'START');
}

export function findEndBlock(blocks: Block[]): Block | undefined {
  return blocks.find(b => b.type === 'END');
}

/** Find the block whose `next`, `yesBranch`, `noBranch`, or `branches[x]` points to `targetId` */
export function findParent(blocks: Block[], targetId: string): { block: Block; via: string } | undefined {
  for (const b of blocks) {
    if (b.next === targetId) return { block: b, via: 'next' };
    if (b.yesBranch === targetId) return { block: b, via: 'yesBranch' };
    if (b.noBranch === targetId) return { block: b, via: 'noBranch' };
    if (b.branches) {
      for (const [key, val] of Object.entries(b.branches)) {
        if (val === targetId) return { block: b, via: `branches.${key}` };
      }
    }
  }
  return undefined;
}

/** Insert a new block between `afterBlockId` and whatever it currently points to via `via` */
export function insertBlockAfter(
  blocks: Block[],
  afterBlockId: string,
  newBlock: Block,
  via: string = 'next'
): Block[] {
  return blocks.map(b => {
    if (b.id !== afterBlockId) return b;
    let oldTarget: string | null | undefined;
    if (via.startsWith('branches.')) {
      const btnId = via.split('.')[1];
      oldTarget = b.branches?.[btnId];
      const updated = { ...b, branches: { ...b.branches, [btnId]: newBlock.id } };
      newBlock.next = oldTarget ?? null;
      return updated;
    }
    oldTarget = via === 'yesBranch' ? b.yesBranch : via === 'noBranch' ? b.noBranch : b.next;
    const updated = { ...b, [via]: newBlock.id };
    newBlock.next = oldTarget ?? null;
    return updated;
  }).concat(newBlock);
}

/** Remove a block and reconnect the chain */
export function removeBlock(blocks: Block[], blockId: string): Block[] {
  const block = findBlock(blocks, blockId);
  if (!block || block.type === 'START' || block.type === 'END') return blocks;

  // If it's a CONDITION or ACTION_BUTTONS, also remove all blocks in all branches
  if (block.type === 'CONDITION' || block.type === 'ACTION_BUTTONS') {
    const toRemove = new Set<string>([blockId]);
    const collectBranch = (startId: string | null | undefined) => {
      let id = startId;
      while (id) {
        const b = findBlock(blocks, id);
        if (!b) break;
        toRemove.add(b.id);
        if (b.type === 'CONDITION') {
          collectBranch(b.yesBranch);
          collectBranch(b.noBranch);
        }
        if (b.type === 'ACTION_BUTTONS' && b.branches) {
          Object.values(b.branches).forEach(brId => collectBranch(brId));
        }
        id = b.next;
      }
    };
    if (block.type === 'CONDITION') {
      collectBranch(block.yesBranch);
      collectBranch(block.noBranch);
    }
    if (block.branches) {
      Object.values(block.branches).forEach(brId => collectBranch(brId));
    }

    // Find parent and reconnect to block.next (merge point)
    const parent = findParent(blocks, blockId);
    const result = blocks
      .filter(b => !toRemove.has(b.id))
      .map(b => {
        if (parent && b.id === parent.block.id) {
          if (parent.via.startsWith('branches.')) {
            const btnId = parent.via.split('.')[1];
            return { ...b, branches: { ...b.branches, [btnId]: block.next } };
          }
          return { ...b, [parent.via]: block.next };
        }
        return b;
      });
    return result;
  }

  // Simple block: find parent, reconnect to block.next
  const parent = findParent(blocks, blockId);
  return blocks
    .filter(b => b.id !== blockId)
    .map(b => {
      if (parent && b.id === parent.block.id) {
        return { ...b, [parent.via]: block.next };
      }
      return b;
    });
}

/** Count blocks in the main chain + branches (excluding START/END) */
export function countUserBlocks(blocks: Block[]): number {
  return blocks.filter(b => b.type !== 'START' && b.type !== 'END').length;
}

/** Walk the chain from a starting block and return ordered list of IDs */
export function walkChain(blocks: Block[], startId: string | null): string[] {
  const ids: string[] = [];
  let currentId = startId;
  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) break; // prevent infinite loops
    visited.add(currentId);
    ids.push(currentId);
    const block = findBlock(blocks, currentId);
    if (!block) break;
    currentId = block.next;
  }
  return ids;
}

/** Parse steps from DB — V2 format only */
export function parseWorkflowSteps(steps: any): WorkflowDefV2 {
  if (steps && typeof steps === 'object' && !Array.isArray(steps) && steps.version === 2) {
    return steps;
  }
  return { version: 2, blocks: createDefaultWorkflow() };
}
