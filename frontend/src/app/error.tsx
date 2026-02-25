'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção, enviar para Sentry ou similar
    console.error('[ErrorBoundary]', error);
  }, [error]);

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
