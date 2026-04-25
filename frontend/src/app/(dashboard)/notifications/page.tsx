"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface Notification {
  id: string;
  channel: string;
  type: string;
  message: string;
  status: string;
  errorDetail?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  sentAt: string;
  createdAt: string;
  serviceOrderId?: string;
}

const TYPE_LABELS: Record<string, string> = {
  STATUS_CHANGE: "Mudança de Status",
  ASSIGNMENT: "Atribuição",
  REMINDER: "Lembrete",
  AUTOMATION: "Automação",
  CONTRACT_SENT: "Contrato Enviado",
  CONTRACT_ACCEPTED: "Contrato Aceito",
  OS_ATRIBUIDA: "OS Atribuída",
  OS_CONCLUIDA: "OS Concluída",
  PROXIMIDADE: "Proximidade",
  WELCOME_SENT: "Boas-vindas",
  WELCOME_ACCEPTED: "Aceite Boas-vindas",
};

const CHANNEL_COLORS: Record<string, string> = {
  MOCK: "bg-slate-100 text-slate-600",
  SYSTEM: "bg-purple-100 text-purple-700",
  WHATSAPP: "bg-green-100 text-green-700",
  EMAIL: "bg-blue-100 text-blue-700",
  SMS: "bg-amber-100 text-amber-700",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api.get<Notification[]>("/notifications");
      setNotifications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResend = async (id: string) => {
    setResending(id);
    try {
      const result = await api.post<Notification>(`/notifications/${id}/resend`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: result.status, errorDetail: result.errorDetail } : n)),
      );
      if (result.status === "SENT") {
        toast("Notificação reenviada com sucesso!", "success");
      } else {
        toast(`Reenvio falhou: ${result.errorDetail || "erro desconhecido"}`, "error");
      }
    } catch {
      toast("Erro ao reenviar notificação", "error");
    } finally {
      setResending(null);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const push = usePushNotifications();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
        <p className="text-sm text-slate-500">
          Log de notificações enviadas pelo sistema.
        </p>
      </div>

      {/* Push Notifications Toggle */}
      {push.supported && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">🔔 Notificações Push</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Receba alertas no navegador mesmo com o Tecnikos fechado
              </p>
            </div>
            <div className="flex items-center gap-3">
              {push.permission === "denied" ? (
                <span className="text-xs text-red-500">Bloqueado no navegador</span>
              ) : push.subscribed ? (
                <button
                  onClick={push.unsubscribe}
                  disabled={push.loading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  {push.loading ? "..." : "Desativar"}
                </button>
              ) : (
                <button
                  onClick={push.requestAndSubscribe}
                  disabled={push.loading}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {push.loading ? "Ativando..." : "Ativar Push"}
                </button>
              )}
              {push.subscribed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Ativo
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          <svg className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Nenhuma notificação enviada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${CHANNEL_COLORS[n.channel] || CHANNEL_COLORS.MOCK}`}
                    >
                      {n.channel}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600">
                      {TYPE_LABELS[n.type] || n.type}
                    </span>
                    {n.recipientPhone && (
                      <span className="text-slate-400">
                        → {n.recipientPhone}
                      </span>
                    )}
                    {n.recipientEmail && (
                      <span className="text-slate-400">
                        → {n.recipientEmail}
                      </span>
                    )}
                  </div>
                  {/* Error detail for failed notifications */}
                  {n.status === "FAILED" && n.errorDetail && (
                    <p className="mt-1 text-xs text-red-500">
                      Erro: {n.errorDetail}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-slate-400">
                    {formatDate(n.sentAt || n.createdAt)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      n.status === "READ"
                        ? "bg-green-100 text-green-700"
                        : n.status === "DELIVERED"
                          ? "bg-blue-100 text-blue-700"
                          : n.status === "SENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : n.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {n.status === "READ" ? "Lida" : n.status === "DELIVERED" ? "Entregue" : n.status === "SENT" ? "Enviada" : n.status === "FAILED" ? "Falhou" : n.status}
                  </span>
                  {/* Resend button for failed WhatsApp notifications */}
                  {n.status === "FAILED" && n.channel === "WHATSAPP" && (
                    <button
                      onClick={() => handleResend(n.id)}
                      disabled={resending === n.id}
                      className="mt-1 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {resending === n.id ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Reenviando...
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reenviar
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
