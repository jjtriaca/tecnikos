/**
 * useOffline — Online/offline detection hook for tech PWA
 *
 * Uses navigator.onLine + event listeners + health ping as connectivity check.
 * Exposes sync status from IndexedDB sync queue.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncQueueCount } from '@/lib/offline/db';

const HEALTH_PING_INTERVAL = 30_000; // 30s
const HEALTH_PING_URL = '/api/health';

export type OfflineStatus = {
  isOnline: boolean;
  pendingSyncCount: number;
  failedSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
};

export function useOffline(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [failedSyncCount, setFailedSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Actual connectivity check (navigator.onLine can lie)
  const checkConnectivity = useCallback(async () => {
    try {
      const res = await fetch(HEALTH_PING_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    }
  }, []);

  // Update sync queue counts
  const updateSyncCounts = useCallback(async () => {
    try {
      const counts = await getSyncQueueCount();
      setPendingSyncCount(counts.pending);
      setFailedSyncCount(counts.failed);
    } catch {
      // IDB not available
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync check
      updateSyncCounts();
      // Dispatch custom event for sync queue to pick up
      window.dispatchEvent(new CustomEvent('tecnikos:online'));
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen to SW sync messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_TRIGGER') {
        window.dispatchEvent(new CustomEvent('tecnikos:sync-trigger'));
      }
      if (event.data?.type === 'SYNC_START') {
        setIsSyncing(true);
      }
      if (event.data?.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        setLastSyncAt(Date.now());
        updateSyncCounts();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Periodic health check
    healthRef.current = setInterval(() => {
      if (navigator.onLine) checkConnectivity();
    }, HEALTH_PING_INTERVAL);

    // Initial sync count
    updateSyncCounts();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      if (healthRef.current) clearInterval(healthRef.current);
    };
  }, [checkConnectivity, updateSyncCounts]);

  // Poll sync counts every 5s when syncing
  useEffect(() => {
    if (!isSyncing) return;
    const iv = setInterval(updateSyncCounts, 5000);
    return () => clearInterval(iv);
  }, [isSyncing, updateSyncCounts]);

  return { isOnline, pendingSyncCount, failedSyncCount, isSyncing, lastSyncAt };
}
