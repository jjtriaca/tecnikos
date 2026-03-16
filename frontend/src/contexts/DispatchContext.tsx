"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { api } from "@/lib/api";

// ── Types ──

export interface DispatchInitData {
  technicianName: string;
  technicianPhone: string;
  notificationId?: string;
  notificationStatus?: string;
  notificationChannel?: string;
  errorDetail?: string;
}

export interface DispatchState {
  osId: string;
  osCode?: string;
  osTitle?: string;
  osDescription?: string;
  // Technician
  technicianName: string;
  technicianPhone: string;
  // Notification
  notificationId?: string;
  notificationStatus: string; // SENT, FAILED, PENDING
  notificationChannel: string; // WHATSAPP, MOCK
  whatsappStatus?: string; // sent, delivered, read, failed
  errorDetail?: string;
  // OS status & timestamps
  osStatus?: string;
  acceptedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  // OS details (rich info)
  valueCents?: number;
  deadlineAt?: string;
  scheduledStartAt?: string;
  addressText?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  isUrgent?: boolean;
  isReturn?: boolean;
  clientName?: string;
  // UI state
  resending?: boolean;
}

interface DispatchContextValue {
  dispatches: DispatchState[];
  minimized: boolean;
  addDispatch: (osId: string, data: DispatchInitData, osCode?: string, osTitle?: string) => void;
  removeDispatch: (osId: string) => void;
  toggleMinimize: () => void;
  resendNotification: (osId: string) => Promise<void>;
}

const DispatchContext = createContext<DispatchContextValue | null>(null);

const STORAGE_KEY = "teknikos_dispatch_ids";
const POLL_INTERVAL_MS = 5000;

// Terminal OS statuses — stop polling when reached
const TERMINAL_STATUSES = ["CONCLUIDA", "APROVADA", "CANCELADA"];

export function DispatchProvider({ children }: { children: ReactNode }) {
  const [dispatches, setDispatches] = useState<DispatchState[]>([]);
  const [minimized, setMinimized] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        if (ids.length > 0) {
          // Restore with minimal data — polling will fill in details
          const restored: DispatchState[] = ids.map((osId) => ({
            osId,
            technicianName: "",
            technicianPhone: "",
            notificationStatus: "PENDING",
            notificationChannel: "WHATSAPP",
          }));
          setDispatches(restored);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist IDs to sessionStorage
  useEffect(() => {
    const ids = dispatches.map((d) => d.osId);
    if (ids.length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [dispatches]);

  // Polling
  useEffect(() => {
    if (dispatches.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      const activeDispatches = dispatches.filter(
        (d) => !TERMINAL_STATUSES.includes(d.osStatus || ""),
      );
      if (activeDispatches.length === 0) return;

      for (const d of activeDispatches) {
        try {
          const result = await api.get<any>(`/service-orders/${d.osId}/dispatch-status`);
          const so = result.serviceOrder;
          setDispatches((prev) =>
            prev.map((p) =>
              p.osId === d.osId
                ? {
                    ...p,
                    osCode: so?.code || p.osCode,
                    osTitle: so?.title || p.osTitle,
                    osDescription: so?.description || p.osDescription,
                    osStatus: so?.status,
                    acceptedAt: so?.acceptedAt,
                    enRouteAt: so?.enRouteAt,
                    arrivedAt: so?.arrivedAt,
                    startedAt: so?.startedAt,
                    completedAt: so?.completedAt,
                    createdAt: so?.createdAt || p.createdAt,
                    valueCents: so?.valueCents ?? p.valueCents,
                    deadlineAt: so?.deadlineAt || p.deadlineAt,
                    scheduledStartAt: so?.scheduledStartAt || p.scheduledStartAt,
                    addressText: so?.addressText || p.addressText,
                    city: so?.city || p.city,
                    state: so?.state || p.state,
                    neighborhood: so?.neighborhood || p.neighborhood,
                    isUrgent: so?.isUrgent ?? p.isUrgent,
                    isReturn: so?.isReturn ?? p.isReturn,
                    clientName: so?.clientName || p.clientName,
                    technicianName: result.technician?.name || p.technicianName,
                    technicianPhone: result.technician?.phone || p.technicianPhone,
                    notificationId: result.notification?.id || p.notificationId,
                    notificationStatus: result.notification?.status || p.notificationStatus,
                    whatsappStatus: result.notification?.whatsappStatus || p.whatsappStatus,
                    errorDetail: result.notification?.errorDetail || undefined,
                  }
                : p,
            ),
          );
        } catch {
          // OS might have been deleted — remove from dispatches
          setDispatches((prev) => prev.filter((p) => p.osId !== d.osId));
        }
      }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatches.length]);

  const addDispatch = useCallback(
    (osId: string, data: DispatchInitData, osCode?: string, osTitle?: string) => {
      setDispatches((prev) => {
        if (prev.some((d) => d.osId === osId)) return prev; // already tracked
        return [
          ...prev,
          {
            osId,
            osCode,
            osTitle,
            technicianName: data.technicianName,
            technicianPhone: data.technicianPhone,
            notificationId: data.notificationId,
            notificationStatus: data.notificationStatus || "PENDING",
            notificationChannel: data.notificationChannel || "WHATSAPP",
            errorDetail: data.errorDetail,
          },
        ];
      });
      setMinimized(false); // auto-expand when new dispatch added
    },
    [],
  );

  const removeDispatch = useCallback((osId: string) => {
    setDispatches((prev) => prev.filter((d) => d.osId !== osId));
  }, []);

  const toggleMinimize = useCallback(() => {
    setMinimized((prev) => !prev);
  }, []);

  const resendNotification = useCallback(async (osId: string) => {
    setDispatches((prev) =>
      prev.map((d) => (d.osId === osId ? { ...d, resending: true } : d)),
    );
    try {
      const dispatch = dispatches.find((d) => d.osId === osId);
      if (!dispatch?.notificationId) return;
      const result = await api.post<any>(`/notifications/${dispatch.notificationId}/resend`);
      setDispatches((prev) =>
        prev.map((d) =>
          d.osId === osId
            ? {
                ...d,
                resending: false,
                notificationStatus: result.status,
                whatsappMessageId: result.whatsappMessageId,
                errorDetail: result.errorDetail || undefined,
              }
            : d,
        ),
      );
    } catch {
      setDispatches((prev) =>
        prev.map((d) => (d.osId === osId ? { ...d, resending: false } : d)),
      );
    }
  }, [dispatches]);

  return (
    <DispatchContext.Provider
      value={{ dispatches, minimized, addDispatch, removeDispatch, toggleMinimize, resendNotification }}
    >
      {children}
    </DispatchContext.Provider>
  );
}

export function useDispatch() {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useDispatch must be used within DispatchProvider");
  return ctx;
}
