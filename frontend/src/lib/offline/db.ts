/**
 * Tecnikos Offline Database — IndexedDB schema and helpers
 * Uses the `idb` library for Promise-based IndexedDB access.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type CachedServiceOrder = {
  id: string;
  data: any;          // ServiceOrder object from API
  workflow: any;      // WorkflowProgressV2 from API
  attachments: any[]; // Attachment[] metadata (no blobs)
  cachedAt: number;   // Date.now()
};

export type OfflineBlockExecution = {
  id: string;           // Random UUID for dedup
  blockId: string;
  blockType: string;
  blockName: string;
  payload: {
    note?: string;
    photoUrl?: string;  // Placeholder until sync; real URL after upload
    responseData?: any;
  };
  localPhotoIds?: string[];
  executedAt: number;
  synced: boolean;
};

export type OfflineWorkflowState = {
  serviceOrderId: string;
  executedBlocks: OfflineBlockExecution[];
  localAttachments: string[];  // IDs referencing offline-photos store
  startedAt: number;
  lastUpdatedAt: number;
};

export type OfflinePhoto = {
  id: string;
  serviceOrderId: string;
  blockId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  synced: boolean;
  serverAttachmentId?: string;
  serverUrl?: string;
};

export type SyncQueueItem = {
  id?: number;          // Auto-increment
  serviceOrderId: string;
  type: 'PHOTO_UPLOAD' | 'WORKFLOW_ADVANCE' | 'GPS_POSITION';
  payload: any;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
  offlinePhotoId?: string;
};

/* ═══════════════════════════════════════════════════════════════
   SCHEMA
   ═══════════════════════════════════════════════════════════════ */

interface TecnikosDB extends DBSchema {
  'service-orders': {
    key: string;
    value: CachedServiceOrder;
    indexes: { 'by-cachedAt': number };
  };
  'offline-workflow-state': {
    key: string;
    value: OfflineWorkflowState;
  };
  'offline-photos': {
    key: string;
    value: OfflinePhoto;
    indexes: {
      'by-serviceOrderId': string;
      'by-blockId': string;
      'by-synced': number; // 0=false, 1=true (IDB can't index booleans directly)
    };
  };
  'sync-queue': {
    key: number;
    value: SyncQueueItem;
    indexes: {
      'by-serviceOrderId': string;
      'by-status': string;
      'by-createdAt': number;
    };
  };
}

/* ═══════════════════════════════════════════════════════════════
   DATABASE INSTANCE
   ═══════════════════════════════════════════════════════════════ */

const DB_NAME = 'tecnikos-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<TecnikosDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<TecnikosDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<TecnikosDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Service orders cache
      if (!db.objectStoreNames.contains('service-orders')) {
        const soStore = db.createObjectStore('service-orders', { keyPath: 'id' });
        soStore.createIndex('by-cachedAt', 'cachedAt');
      }

      // Offline workflow state
      if (!db.objectStoreNames.contains('offline-workflow-state')) {
        db.createObjectStore('offline-workflow-state', { keyPath: 'serviceOrderId' });
      }

      // Offline photos (blobs)
      if (!db.objectStoreNames.contains('offline-photos')) {
        const photoStore = db.createObjectStore('offline-photos', { keyPath: 'id' });
        photoStore.createIndex('by-serviceOrderId', 'serviceOrderId');
        photoStore.createIndex('by-blockId', 'blockId');
        photoStore.createIndex('by-synced', 'synced');
      }

      // Sync queue (FIFO)
      if (!db.objectStoreNames.contains('sync-queue')) {
        const queueStore = db.createObjectStore('sync-queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        queueStore.createIndex('by-serviceOrderId', 'serviceOrderId');
        queueStore.createIndex('by-status', 'status');
        queueStore.createIndex('by-createdAt', 'createdAt');
      }
    },
  });

  return dbInstance;
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE ORDER CACHE HELPERS
   ═══════════════════════════════════════════════════════════════ */

export async function cacheServiceOrder(
  id: string,
  data: any,
  workflow: any,
  attachments: any[],
): Promise<void> {
  const db = await getDB();
  await db.put('service-orders', {
    id,
    data,
    workflow,
    attachments,
    cachedAt: Date.now(),
  });
}

export async function getCachedServiceOrder(id: string): Promise<CachedServiceOrder | undefined> {
  const db = await getDB();
  return db.get('service-orders', id);
}

export async function deleteCachedServiceOrder(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('service-orders', id);
}

/* ═══════════════════════════════════════════════════════════════
   OFFLINE WORKFLOW STATE HELPERS
   ═══════════════════════════════════════════════════════════════ */

export async function getOfflineWorkflowState(serviceOrderId: string): Promise<OfflineWorkflowState | undefined> {
  const db = await getDB();
  return db.get('offline-workflow-state', serviceOrderId);
}

export async function saveOfflineWorkflowState(state: OfflineWorkflowState): Promise<void> {
  const db = await getDB();
  await db.put('offline-workflow-state', state);
}

export async function deleteOfflineWorkflowState(serviceOrderId: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-workflow-state', serviceOrderId);
}

/* ═══════════════════════════════════════════════════════════════
   OFFLINE PHOTOS HELPERS
   ═══════════════════════════════════════════════════════════════ */

export async function saveOfflinePhoto(photo: OfflinePhoto): Promise<void> {
  const db = await getDB();
  await db.put('offline-photos', photo);
}

export async function getOfflinePhoto(id: string): Promise<OfflinePhoto | undefined> {
  const db = await getDB();
  return db.get('offline-photos', id);
}

export async function getOfflinePhotosByBlock(
  serviceOrderId: string,
  blockId: string,
): Promise<OfflinePhoto[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('offline-photos', 'by-serviceOrderId', serviceOrderId);
  return all.filter((p) => p.blockId === blockId);
}

export async function getUnsyncedPhotos(): Promise<OfflinePhoto[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-photos', 'by-synced', 0);
}

export async function markPhotoSynced(
  id: string,
  serverAttachmentId: string,
  serverUrl: string,
): Promise<void> {
  const db = await getDB();
  const photo = await db.get('offline-photos', id);
  if (photo) {
    photo.synced = true;
    photo.serverAttachmentId = serverAttachmentId;
    photo.serverUrl = serverUrl;
    await db.put('offline-photos', photo);
  }
}

export async function deleteOfflinePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-photos', id);
}

/* ═══════════════════════════════════════════════════════════════
   SYNC QUEUE HELPERS
   ═══════════════════════════════════════════════════════════════ */

export async function enqueueSyncItem(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('sync-queue', item as SyncQueueItem);
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync-queue', 'by-status', 'PENDING');
}

export async function getFailedSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync-queue', 'by-status', 'FAILED');
}

export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('sync-queue', item);
}

export async function deleteSyncItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('sync-queue', id);
}

export async function clearCompletedSyncItems(): Promise<void> {
  const db = await getDB();
  const completed = await db.getAllFromIndex('sync-queue', 'by-status', 'COMPLETED');
  const tx = db.transaction('sync-queue', 'readwrite');
  for (const item of completed) {
    if (item.id !== undefined) tx.store.delete(item.id);
  }
  await tx.done;
}

export async function getSyncQueueCount(): Promise<{ pending: number; failed: number; total: number }> {
  const db = await getDB();
  const pending = (await db.getAllFromIndex('sync-queue', 'by-status', 'PENDING')).length;
  const failed = (await db.getAllFromIndex('sync-queue', 'by-status', 'FAILED')).length;
  const inProgress = (await db.getAllFromIndex('sync-queue', 'by-status', 'IN_PROGRESS')).length;
  return { pending: pending + inProgress, failed, total: pending + inProgress + failed };
}
