'use client';

import { useEffect, useState } from 'react';

/**
 * Global Error Boundary.
 *
 * Handles two critical scenarios:
 * 1. ChunkLoadError — happens when a new deploy changes JS bundle hashes
 *    and the user tries to navigate while still on the old version.
 *    → Auto-reloads the page once to pick up new bundles.
 *
 * 2. Generic errors — shows a friendly error page with retry/home buttons.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isChunkError, setIsChunkError] = useState(false);

  useEffect(() => {
    console.error('[ErrorBoundary]', error);

    // Detect ChunkLoadError (dynamic import failure after deploy)
    const msg = error?.message || '';
    const isChunk =
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module');

    if (isChunk) {
      setIsChunkError(true);

      // Check if we already tried auto-reload (prevent infinite loop)
      const key = '__chunk_reload_attempt';
      const lastAttempt = sessionStorage.getItem(key);
      const now = Date.now();

      if (!lastAttempt || now - Number(lastAttempt) > 60_000) {
        // Auto-reload once (allow 1 attempt per minute)
        sessionStorage.setItem(key, String(now));
        window.location.reload();
        return;
      }
      // If already tried within 60s, show manual reload UI
    }
  }, [error]);

  if (isChunkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-5xl mb-4">🔄</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Atualização disponível
          </h2>
          <p className="text-slate-500 mb-6 text-sm">
            Uma nova versão do sistema foi instalada. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem('__chunk_reload_attempt');
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-6xl mb-4">&#9888;&#65039;</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Algo deu errado
        </h2>
        <p className="text-slate-500 mb-6 text-sm">
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
          >
            Voltar ao inicio
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-4">
            Codigo: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
