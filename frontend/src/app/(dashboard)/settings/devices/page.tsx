"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Session = {
  id: string;
  deviceName: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivityAt: string | null;
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function deviceIcon(name: string | null): string {
  if (!name) return "💻";
  if (name.includes("Android") || name.includes("iOS")) return "📱";
  return "💻";
}

export default function DevicesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await api.get<Session[]>("/auth/sessions");
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await api.del(`/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await api.post("/auth/sessions/revoke-all");
      await loadSessions();
    } catch {
      // ignore
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dispositivos Conectados</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os dispositivos com sessão ativa na sua conta
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAll}
            disabled={revokingAll}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 disabled:opacity-50 transition-colors"
          >
            {revokingAll ? "Encerrando..." : "Encerrar todas as outras sessões"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhuma sessão ativa encontrada
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, idx) => (
            <div
              key={session.id}
              className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${
                idx === 0 ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"
              }`}
            >
              <div className="text-3xl">{deviceIcon(session.deviceName)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {session.deviceName || "Dispositivo desconhecido"}
                  </span>
                  {idx === 0 && (
                    <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      ESTA SESSÃO
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                  {session.ip && <span>IP: {session.ip}</span>}
                  <span>Ativa {timeAgo(session.lastActivityAt)}</span>
                  <span>
                    Criada em{" "}
                    {new Date(session.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              {idx !== 0 && (
                <button
                  onClick={() => handleRevoke(session.id)}
                  disabled={revoking === session.id}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 disabled:opacity-50 transition-colors"
                >
                  {revoking === session.id ? "..." : "Encerrar"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Sobre o controle de dispositivos</h3>
        <p className="text-xs text-slate-500">
          Cada vez que você faz login em um novo navegador ou dispositivo, uma sessão é criada.
          Se você não reconhece algum dispositivo na lista, encerre a sessão imediatamente e
          altere sua senha.
        </p>
      </div>
    </div>
  );
}
