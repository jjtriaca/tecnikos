/**
 * OfflineWorkflowManager — Executes workflow blocks locally when offline.
 *
 * Mirrors the backend's advanceBlockV2 logic for next-block resolution,
 * including CONDITION and ACTION_BUTTONS branching.
 */
import {
  getOfflineWorkflowState,
  saveOfflineWorkflowState,
  getCachedServiceOrder,
  cacheServiceOrder,
  enqueueSyncItem,
  getOfflinePhotosByBlock,
  type OfflineBlockExecution,
  type OfflineWorkflowState,
} from './db';

/* ═══════════════════════════════════════════════════════════════
   TYPES (mirrors backend)
   ═══════════════════════════════════════════════════════════════ */

type BlockDef = {
  id: string;
  type: string;
  name: string;
  icon: string;
  config: Record<string, any>;
  next: string | null;
  yesBranch?: string | null;
  noBranch?: string | null;
  branches?: Record<string, string>;
  completed: boolean;
  completedAt?: string;
  note?: string;
  photoUrl?: string;
  responseData?: any;
};

type WorkflowProgressV2 = {
  templateId: string;
  templateName: string;
  version: number;
  totalBlocks: number;
  completedBlocks: number;
  currentBlock: BlockDef | null;
  executionPath: BlockDef[];
  isComplete: boolean;
  techPortalConfig?: any;
};

/** Non-interactive block types that auto-execute */
const SYSTEM_TYPES = new Set([
  'STATUS', 'STATUS_CHANGE', 'NOTIFY', 'FINANCIAL_ENTRY', 'ALERT',
  'DELAY', 'WAIT_FOR', 'START', 'END', 'INFO',
]);

const ACTIONABLE_TYPES = new Set([
  'STEP', 'PHOTO', 'NOTE', 'GPS', 'QUESTION', 'CHECKLIST',
  'SIGNATURE', 'FORM', 'MATERIALS', 'ACTION_BUTTONS', 'CONDITION', 'ARRIVAL_QUESTION',
]);

/* ═══════════════════════════════════════════════════════════════
   ADVANCE BLOCK OFFLINE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Execute a block locally and advance to the next one.
 * Returns the updated workflow progress for the UI.
 */
export async function advanceBlockOffline(
  serviceOrderId: string,
  blockId: string,
  payload: {
    note?: string;
    photoUrl?: string;
    responseData?: any;
  },
  localPhotoIds?: string[],
): Promise<WorkflowProgressV2 | null> {
  const cached = await getCachedServiceOrder(serviceOrderId);
  if (!cached) return null;

  const workflow: WorkflowProgressV2 = cached.workflow;
  if (!workflow?.currentBlock || workflow.currentBlock.id !== blockId) {
    return null;
  }

  const currentBlock = workflow.currentBlock;
  const blocks = workflow.executionPath;

  // Create offline execution record
  const execution: OfflineBlockExecution = {
    id: crypto.randomUUID(),
    blockId,
    blockType: currentBlock.type,
    blockName: currentBlock.name,
    payload,
    localPhotoIds,
    executedAt: Date.now(),
    synced: false,
  };

  // Get or create offline state
  let offlineState = await getOfflineWorkflowState(serviceOrderId);
  if (!offlineState) {
    offlineState = {
      serviceOrderId,
      executedBlocks: [],
      localAttachments: localPhotoIds || [],
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
  }
  offlineState.executedBlocks.push(execution);
  if (localPhotoIds) {
    offlineState.localAttachments.push(...localPhotoIds);
  }
  offlineState.lastUpdatedAt = Date.now();

  // Enqueue sync items
  // First: photos (if any)
  if (localPhotoIds) {
    for (const photoId of localPhotoIds) {
      await enqueueSyncItem({
        serviceOrderId,
        type: 'PHOTO_UPLOAD',
        payload: { blockId },
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 5,
        createdAt: Date.now(),
        offlinePhotoId: photoId,
      });
    }
  }

  // Then: the advance call
  await enqueueSyncItem({
    serviceOrderId,
    type: 'WORKFLOW_ADVANCE',
    payload: { blockId, ...payload, clientTimestamp: new Date().toISOString() },
    status: 'PENDING',
    retryCount: 0,
    maxRetries: 5,
    createdAt: Date.now(),
  });

  // Mark current block as completed in the execution path
  const blockIdx = blocks.findIndex((b) => b.id === blockId);
  if (blockIdx !== -1) {
    blocks[blockIdx].completed = true;
    blocks[blockIdx].completedAt = new Date().toISOString();
    blocks[blockIdx].note = payload.note;
    blocks[blockIdx].photoUrl = payload.photoUrl;
    blocks[blockIdx].responseData = payload.responseData;
  }

  // Resolve next block
  const nextBlock = resolveNextBlock(currentBlock, blocks, payload);

  // Auto-skip system blocks until we find an actionable one or END
  let effectiveNext = nextBlock;
  while (effectiveNext && SYSTEM_TYPES.has(effectiveNext.type) && effectiveNext.type !== 'END') {
    // Mark system block as completed
    const sysIdx = blocks.findIndex((b) => b.id === effectiveNext!.id);
    if (sysIdx !== -1) {
      blocks[sysIdx].completed = true;
      blocks[sysIdx].completedAt = new Date().toISOString();
    }
    effectiveNext = resolveNextBlock(effectiveNext, blocks, {});
  }

  // Update workflow state
  workflow.completedBlocks = blocks.filter(
    (b) => b.completed && ACTIONABLE_TYPES.has(b.type),
  ).length;

  if (!effectiveNext || effectiveNext.type === 'END') {
    workflow.currentBlock = null;
    workflow.isComplete = true;
  } else {
    workflow.currentBlock = effectiveNext;
  }

  // Save to IndexedDB
  await saveOfflineWorkflowState(offlineState);
  await cacheServiceOrder(serviceOrderId, cached.data, workflow, cached.attachments);

  return workflow;
}

/**
 * Resolve the next block after completing the current one.
 * Handles branching for CONDITION and ACTION_BUTTONS.
 */
function resolveNextBlock(
  current: BlockDef,
  blocks: BlockDef[],
  payload: { responseData?: any },
): BlockDef | null {
  let nextId: string | null = null;

  if (current.type === 'CONDITION') {
    const answer = payload.responseData?.answer;
    const isYes = answer === true || answer === 'true' || answer === 'SIM' || answer === 'Sim' || answer === 'sim';
    nextId = isYes ? (current.yesBranch || current.next) : (current.noBranch || current.next);
  } else if (current.type === 'ACTION_BUTTONS') {
    const buttonId = payload.responseData?.buttonId;
    if (buttonId && current.branches?.[buttonId]) {
      nextId = current.branches[buttonId];
    } else {
      nextId = current.next;
    }
  } else {
    nextId = current.next;
  }

  if (!nextId) return null;
  return blocks.find((b) => b.id === nextId) || null;
}

/**
 * Get the effective workflow state: server state merged with local offline executions.
 * Use this when loading a page that may have offline work.
 */
export async function getEffectiveWorkflow(
  serviceOrderId: string,
): Promise<{ workflow: WorkflowProgressV2; hasOfflineData: boolean } | null> {
  const cached = await getCachedServiceOrder(serviceOrderId);
  if (!cached) return null;

  const offlineState = await getOfflineWorkflowState(serviceOrderId);
  const hasOfflineData = !!offlineState && offlineState.executedBlocks.length > 0;

  return {
    workflow: cached.workflow,
    hasOfflineData,
  };
}

/**
 * Check if a service order has pending offline data.
 */
export async function hasPendingOfflineData(serviceOrderId: string): Promise<boolean> {
  const state = await getOfflineWorkflowState(serviceOrderId);
  return !!state && state.executedBlocks.some((b) => !b.synced);
}

/**
 * Get local photo count for a block (offline photos not yet synced).
 */
export async function getOfflinePhotoCount(
  serviceOrderId: string,
  blockId: string,
): Promise<number> {
  const photos = await getOfflinePhotosByBlock(serviceOrderId, blockId);
  return photos.length;
}
