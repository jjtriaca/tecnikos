import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-7xl font-bold text-slate-200 mb-2">404</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Pagina nao encontrada
        </h2>
        <p className="text-slate-500 mb-6 text-sm">
          A pagina que voce procura nao existe ou foi movida.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Ir para o painel
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
          >
            Pagina inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
