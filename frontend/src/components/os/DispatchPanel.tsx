"use client";

import { useDispatch, DispatchState } from "@/contexts/DispatchContext";

// ── WhatsApp status display ──

function MessageStatus({ d }: { d: DispatchState }) {
  if (d.resending) {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Reenviando...
      </span>
    );
  }

  if (d.notificationStatus === "FAILED") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Falhou{d.errorDetail ? `: ${d.errorDetail.substring(0, 50)}` : ""}
      </span>
    );
  }

  // WhatsApp delivery statuses
  const waStatus = d.whatsappStatus?.toUpperCase();

  if (waStatus === "READ") {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <span className="font-bold">✓✓</span> Lida
      </span>
    );
  }

  if (waStatus === "DELIVERED") {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <span className="font-bold">✓✓</span> Entregue
      </span>
    );
  }

  if (d.notificationStatus === "SENT" || waStatus === "SENT") {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <span className="font-bold">✓</span> Enviada
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Enviando...
    </span>
  );
}

// ── Technician status display ──

function TechStatus({ d }: { d: DispatchState }) {
  if (d.completedAt) {
    return <span className="text-xs text-green-700">✅ Concluída</span>;
  }
  if (d.startedAt) {
    return <span className="text-xs text-blue-600">🔧 Em execução</span>;
  }
  if (d.arrivedAt) {
    return <span className="text-xs text-indigo-600">📍 No local</span>;
  }
  if (d.enRouteAt) {
    return <span className="text-xs text-amber-600">🚗 A caminho</span>;
  }
  if (d.acceptedAt) {
    return <span className="text-xs text-green-600">✅ Aceito</span>;
  }
  return <span className="text-xs text-slate-400">⏳ Aguardando aceite</span>;
}

// ── Single dispatch card ──

function DispatchCard({ d }: { d: DispatchState }) {
  const { removeDispatch, resendNotification } = useDispatch();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-indigo-600">
              {d.osCode || "OS"}
            </span>
            <span className="truncate text-xs text-slate-700">
              {d.osTitle || ""}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            👤 {d.technicianName || "Técnico"}
            {d.technicianPhone ? ` · ${d.technicianPhone}` : ""}
          </div>
        </div>
        <button
          onClick={() => removeDispatch(d.osId)}
          className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
          title="Fechar"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status rows */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Mensagem:</span>
          <MessageStatus d={d} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Técnico:</span>
          <TechStatus d={d} />
        </div>
      </div>

      {/* Resend button */}
      {d.notificationStatus === "FAILED" && !d.resending && (
        <button
          onClick={() => resendNotification(d.osId)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reenviar notificação
        </button>
      )}
    </div>
  );
}

// ── Minimized icon ──

function MinimizedIcon() {
  const { dispatches, toggleMinimize } = useDispatch();
  const failedCount = dispatches.filter((d) => d.notificationStatus === "FAILED").length;

  return (
    <button
      onClick={toggleMinimize}
      className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-indigo-700"
      title="Painel de despacho"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {/* Badge */}
      <span className={`absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
        failedCount > 0 ? "bg-red-500" : "bg-green-500"
      }`}>
        {dispatches.length}
      </span>
    </button>
  );
}

// ── Main DispatchPanel ──

export default function DispatchPanel() {
  const { dispatches, minimized, toggleMinimize } = useDispatch();

  if (dispatches.length === 0) return null;

  if (minimized) return <MinimizedIcon />;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {/* Panel header */}
      <div className="flex items-center justify-between rounded-t-xl bg-indigo-600 px-3 py-2 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-sm font-medium">
            Despacho ({dispatches.length})
          </span>
        </div>
        <button
          onClick={toggleMinimize}
          className="rounded p-1 hover:bg-indigo-500"
          title="Minimizar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dispatch cards */}
      <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-b-xl bg-slate-50 p-2 shadow-lg">
        {dispatches.map((d) => (
          <DispatchCard key={d.osId} d={d} />
        ))}
      </div>
    </div>
  );
}
