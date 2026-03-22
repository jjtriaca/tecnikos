"use client";

import { useOffline } from '@/hooks/useOffline';

export default function OfflineIndicator() {
  const { isOnline, pendingSyncCount, failedSyncCount, isSyncing } = useOffline();

  // Nothing to show when online and no pending sync
  if (isOnline && pendingSyncCount === 0 && failedSyncCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-md">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01M8.464 8.464a5 5 0 000 7.072M15.536 8.464a5 5 0 010 7.072" />
          </svg>
          Sem conexao — trabalhando offline
          {pendingSyncCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
              {pendingSyncCount} pendente{pendingSyncCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Syncing banner */}
      {isOnline && isSyncing && (
        <div className="flex items-center justify-center gap-2 bg-blue-500 px-3 py-1.5 text-xs font-medium text-white shadow-md">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Sincronizando... ({pendingSyncCount} pendente{pendingSyncCount > 1 ? 's' : ''})
        </div>
      )}

      {/* Failed items banner */}
      {isOnline && !isSyncing && failedSyncCount > 0 && (
        <div className="flex items-center justify-center gap-2 bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-md">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {failedSyncCount} item(ns) falharam ao sincronizar
        </div>
      )}

      {/* Pending sync badge (online, not syncing, items queued) */}
      {isOnline && !isSyncing && failedSyncCount === 0 && pendingSyncCount > 0 && (
        <div className="flex items-center justify-center gap-2 bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          {pendingSyncCount} item(ns) aguardando sincronizacao
        </div>
      )}
    </div>
  );
}
