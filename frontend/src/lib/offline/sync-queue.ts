/**
 * SyncQueueManager — Processes queued offline operations when back online.
 *
 * Processing order per OS: PHOTO_UPLOAD first, then WORKFLOW_ADVANCE, then GPS_POSITION.
 * Photos must be uploaded before advances (advance references server-side photo URL).
 */
import {
  getPendingSyncItems,
  updateSyncItem,
  getOfflinePhoto,
  markPhotoSynced,
  clearCompletedSyncItems,
  type SyncQueueItem,
} from './db';
import { getTechAccessToken } from '@/contexts/TechAuthContext';

const API_BASE = '/api';
let isSyncing = false;

/**
 * Process all pending sync items. Called when connectivity is restored.
 * Items are processed FIFO, with photos before advances for the same OS.
 */
export async function processQueue(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    // Notify UI
    notifyClients('SYNC_START');

    let items = await getPendingSyncItems();
    if (items.length === 0) {
      notifyClients('SYNC_COMPLETE');
      return;
    }

    // Sort: photos first, then advances, then GPS. Within same type, by createdAt (FIFO)
    const typePriority: Record<string, number> = { PHOTO_UPLOAD: 0, WORKFLOW_ADVANCE: 1, GPS_POSITION: 2 };
    items.sort((a, b) => {
      const pa = typePriority[a.type] ?? 9;
      const pb = typePriority[b.type] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.createdAt - b.createdAt;
    });

    for (const item of items) {
      try {
        await processItem(item);
      } catch {
        // Individual item failure doesn't stop queue
      }
    }

    // Clean up completed items
    await clearCompletedSyncItems();
    notifyClients('SYNC_COMPLETE');
  } finally {
    isSyncing = false;
  }
}

async function processItem(item: SyncQueueItem): Promise<void> {
  item.status = 'IN_PROGRESS';
  item.lastAttemptAt = Date.now();
  await updateSyncItem(item);

  try {
    switch (item.type) {
      case 'PHOTO_UPLOAD':
        await processPhotoUpload(item);
        break;
      case 'WORKFLOW_ADVANCE':
        await processWorkflowAdvance(item);
        break;
      case 'GPS_POSITION':
        await processGpsPosition(item);
        break;
    }

    item.status = 'COMPLETED';
    await updateSyncItem(item);
  } catch (err: any) {
    item.retryCount += 1;
    item.error = err?.message || 'Erro desconhecido';

    if (err?.status === 401) {
      // Auth expired — pause queue, let recovery handle it
      item.status = 'PENDING';
      await updateSyncItem(item);
      throw new Error('AUTH_EXPIRED');
    }

    if (err?.status >= 400 && err?.status < 500 && err?.status !== 401) {
      // Client error (except auth) — don't retry
      item.status = 'FAILED';
      await updateSyncItem(item);
      return;
    }

    if (item.retryCount >= item.maxRetries) {
      item.status = 'FAILED';
    } else {
      item.status = 'PENDING';
    }
    await updateSyncItem(item);
  }
}

async function processPhotoUpload(item: SyncQueueItem): Promise<void> {
  if (!item.offlinePhotoId) throw new Error('No offline photo ID');

  const photo = await getOfflinePhoto(item.offlinePhotoId);
  if (!photo) throw new Error('Offline photo not found');
  if (photo.synced && photo.serverUrl) {
    // Already synced (idempotent)
    return;
  }

  const formData = new FormData();
  formData.append('file', photo.blob, photo.fileName);

  let qs = `type=WORKFLOW_STEP`;
  if (photo.blockId) qs += `&blockId=${encodeURIComponent(photo.blockId)}`;

  const token = getTechAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `${API_BASE}/service-orders/${item.serviceOrderId}/attachments?${qs}`,
    { method: 'POST', body: formData, headers, credentials: 'include' },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.message || `Upload failed: ${res.status}`) as any;
    error.status = res.status;
    throw error;
  }

  const att = await res.json();
  await markPhotoSynced(photo.id, att.id, att.url);

  // Store server URL in item payload for advance reference
  item.payload = { ...item.payload, serverUrl: att.url, serverAttachmentId: att.id };
  await updateSyncItem(item);
}

async function processWorkflowAdvance(item: SyncQueueItem): Promise<void> {
  const token = getTechAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `${API_BASE}/service-orders/${item.serviceOrderId}/workflow/advance`,
    { method: 'POST', body: JSON.stringify(item.payload), headers, credentials: 'include' },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Block already advanced — treat as success (idempotent)
    if (err.message?.includes('Bloco esperado')) {
      return;
    }
    const error = new Error(err.message || `Advance failed: ${res.status}`) as any;
    error.status = res.status;
    throw error;
  }
}

async function processGpsPosition(item: SyncQueueItem): Promise<void> {
  const token = getTechAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `${API_BASE}/service-orders/${item.serviceOrderId}/workflow/position`,
    { method: 'POST', body: JSON.stringify(item.payload), headers, credentials: 'include' },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.message || `GPS submit failed: ${res.status}`) as any;
    error.status = res.status;
    throw error;
  }
}

function notifyClients(type: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tecnikos:sync', { detail: { type } }));
    // Also post to SW for broadcast
    navigator.serviceWorker?.controller?.postMessage({ type });
  }
}

/**
 * Setup auto-sync: listens for online events and triggers queue processing.
 * Call once on app init.
 */
export function setupAutoSync(): () => void {
  const handleOnline = () => {
    setTimeout(() => processQueue(), 2000); // Small delay to let network stabilize
  };

  const handleSyncTrigger = () => {
    processQueue();
  };

  window.addEventListener('tecnikos:online', handleOnline);
  window.addEventListener('tecnikos:sync-trigger', handleSyncTrigger);

  // Register for Background Sync if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      if ('sync' in reg) {
        (reg as any).sync.register('tecnikos-sync').catch(() => {
          // Background Sync not supported, manual fallback is already set up
        });
      }
    });
  }

  return () => {
    window.removeEventListener('tecnikos:online', handleOnline);
    window.removeEventListener('tecnikos:sync-trigger', handleSyncTrigger);
  };
}
