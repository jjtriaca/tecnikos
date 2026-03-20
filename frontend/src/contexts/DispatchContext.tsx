"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";

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
  createdByName?: string;
  // GPS tracking (Fase 2)
  destLat?: number;
  destLng?: number;
  techLat?: number;
  techLng?: number;
  techAccuracy?: number;
  techSpeed?: number;
  techHeading?: number;
  distanceMeters?: number;
  locationUpdatedAt?: string;
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

const POLL_INTERVAL_MS = 5000;

// Terminal OS statuses — stop polling when reached
const TERMINAL_STATUSES = ["CONCLUIDA", "APROVADA", "CANCELADA"];

// Clear legacy dismissed IDs from sessionStorage (no longer used)
try { sessionStorage.removeItem("teknikos_dispatch_dismissed"); } catch { /* noop */ }

function mapApiToDispatch(item: any): DispatchState {
  const so = item.serviceOrder;
  return {
    osId: so.id,
    osCode: so.code,
    osTitle: so.title,
    osDescription: so.description,
    osStatus: so.status,
    acceptedAt: so.acceptedAt,
    enRouteAt: so.enRouteAt,
    arrivedAt: so.arrivedAt,
    startedAt: so.startedAt,
    completedAt: so.completedAt,
    createdAt: so.createdAt,
    valueCents: so.valueCents,
    deadlineAt: so.deadlineAt,
    scheduledStartAt: so.scheduledStartAt,
    addressText: so.addressText,
    city: so.city,
    state: so.state,
    neighborhood: so.neighborhood,
    isUrgent: so.isUrgent,
    isReturn: so.isReturn,
    clientName: so.clientName,
    createdByName: so.createdByName,
    destLat: so.lat,
    destLng: so.lng,
    techLat: item.location?.lat,
    techLng: item.location?.lng,
    techAccuracy: item.location?.accuracy,
    techSpeed: item.location?.speed,
    techHeading: item.location?.heading,
    distanceMeters: item.location?.distanceMeters,
    locationUpdatedAt: item.location?.updatedAt,
    technicianName: item.technician?.name || "",
    technicianPhone: item.technician?.phone || "",
    notificationId: item.notification?.id,
    notificationStatus: item.notification?.status || "PENDING",
    notificationChannel: item.notification?.channel || "WHATSAPP",
    whatsappStatus: item.notification?.whatsappStatus,
    errorDetail: item.notification?.errorDetail,
  };
}

export function DispatchProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [dispatches, setDispatches] = useState<DispatchState[]>([]);
  const [minimized, setMinimized] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadRef = useRef(false);

  // Load all active OS once auth is ready
  useEffect(() => {
    if (loading || !user) return; // Wait for auth
    if (!hasRole(user, "ADMIN", "DESPACHO")) return; // Only dispatch roles
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    api.get<any[]>("/service-orders/active-dispatches")
      .then((items) => {
        if (!items || !Array.isArray(items)) return;
        const loaded = items.map(mapApiToDispatch).filter((d) => d.osStatus !== "APROVADA");
        if (loaded.length > 0) {
          setDispatches((prev) => {
            // Merge: keep existing (from addDispatch during create), add new from API
            const existingIds = new Set(prev.map((d) => d.osId));
            const newItems = loaded.filter((d) => !existingIds.has(d.osId));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      })
      .catch(() => {
        // Not logged in or error — ignore
      });
  }, [loading, user]);

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

          // Auto-close: remove dispatch when OS is APROVADA
          if (so?.status === "APROVADA") {
            setDispatches((prev) => prev.filter((p) => p.osId !== d.osId));
            continue;
          }

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
                    createdByName: so?.createdByName || p.createdByName,
                    destLat: so?.lat ?? p.destLat,
                    destLng: so?.lng ?? p.destLng,
                    techLat: result.location?.lat ?? undefined,
                    techLng: result.location?.lng ?? undefined,
                    techAccuracy: result.location?.accuracy ?? undefined,
                    techSpeed: result.location?.speed ?? undefined,
                    techHeading: result.location?.heading ?? undefined,
                    distanceMeters: result.location?.distanceMeters ?? undefined,
                    locationUpdatedAt: result.location?.updatedAt ?? undefined,
                    technicianName: result.technician?.name ?? p.technicianName,
                    technicianPhone: result.technician?.phone ?? p.technicianPhone,
                    // Always use fresh notification data from server (don't keep stale errors)
                    notificationId: result.notification?.id || undefined,
                    notificationStatus: result.notification?.status || "PENDING",
                    notificationChannel: result.notification?.channel || p.notificationChannel,
                    whatsappStatus: result.notification?.whatsappStatus || undefined,
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
