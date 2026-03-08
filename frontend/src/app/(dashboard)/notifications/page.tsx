"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  channel: string;
  type: string;
  message: string;
  status: string;
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
  CONTRACT_SENT: "Contrato Enviado",
  CONTRACT_ACCEPTED: "Contrato Aceito",
  OS_ATRIBUIDA: "OS Atribuída",
  OS_CONCLUIDA: "OS Concluída",
  PROXIMIDADE: "Proximidade",
};

const CHANNEL_COLORS: Record<string, string> = {
  MOCK: "bg-slate-100 text-slate-600",
  WHATSAPP: "bg-green-100 text-green-700",
  EMAIL: "bg-blue-100 text-blue-700",
  SMS: "bg-amber-100 text-amber-700",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
        <p className="text-sm text-slate-500">
          Log de notificações enviadas pelo sistema.
        </p>
      </div>

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
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-slate-400">
                    {formatDate(n.sentAt || n.createdAt)}
                  </span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        n.status === "SENT"
                          ? "bg-green-100 text-green-700"
                          : n.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {n.status === "SENT" ? "Enviada" : n.status === "FAILED" ? "Falhou" : n.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
