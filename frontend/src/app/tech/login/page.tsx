"use client";

export default function TechLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
      {/* Decorative */}
      <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl bg-white px-7 py-8 shadow-2xl shadow-black/20">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="Tecnikos" className="h-9 w-9" />
            <div>
              <div className="text-sm font-bold text-slate-900">Tecnikos</div>
              <div className="text-[10px] text-slate-400">Portal do Tecnico</div>
            </div>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 6.364l4.5 4.5" />
              </svg>
            </div>
          </div>

          <h1 className="text-lg font-bold text-slate-900 text-center">Acesso por link</h1>
          <p className="mt-2 text-sm text-slate-500 text-center leading-relaxed">
            Seu acesso ao portal e feito pelo link enviado pela empresa.
          </p>
          <p className="mt-3 text-sm text-slate-500 text-center leading-relaxed">
            Se voce nao recebeu o link ou sua sessao expirou, entre em contato com seu gestor para solicitar um novo acesso.
          </p>

          {/* Visual divider */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2.5 justify-center text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-xs">Acesso seguro via link unico</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
