"use client";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

interface BillingStatus {
  hasSubscription: boolean;
  status?: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "SUSPENDED";
  nextBillingDate?: string;
  daysUntilDue?: number;
  overdueAt?: string;
  daysOverdue?: number;
  hoursUntilBlock?: number | null;
  isPromo?: boolean;
  promoMonthsLeft?: number;
  planName?: string;
  valueBrl?: number;
}

/**
 * Global billing warning banner for gestors.
 * Shows warnings when payment is due, overdue, or blocked.
 */
export default function BillingBanner() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.tenantStatus === "PENDING_VERIFICATION" || user.tenantStatus === "PENDING_PAYMENT") return;

    let cancelled = false;
    const fetchBilling = async () => {
      try {
        const data = await api.get<BillingStatus>("/auth/billing-status");
        if (!cancelled) setBilling(data);
      } catch {
        // Silently fail — banner just won't show
      }
    };

    fetchBilling();
    // Refresh every 30 minutes
    const interval = setInterval(fetchBilling, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  if (!billing || !billing.hasSubscription || dismissed) return null;

  // Tenant BLOCKED — most critical
  if (user?.tenantStatus === "BLOCKED") {
    return (
      <div className="bg-red-700 text-white text-center py-2.5 px-4 text-sm font-medium z-50">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>
            <strong>Conta bloqueada por inadimplencia.</strong>{" "}
            Regularize seu pagamento para restaurar o acesso.
          </span>
          <a
            href="/settings/billing"
            className="ml-1 rounded-md bg-white/20 px-3 py-0.5 text-xs font-bold hover:bg-white/30 transition-colors"
          >
            Ver assinatura
          </a>
        </div>
      </div>
    );
  }

  // PAST_DUE with overdue tracking
  if (billing.status === "PAST_DUE" && billing.daysOverdue !== undefined && billing.daysOverdue > 0) {
    const hoursLeft = billing.hoursUntilBlock;
    const daysLeft = hoursLeft !== null && hoursLeft !== undefined ? Math.floor(hoursLeft / 24) : null;
    const remainingHours = hoursLeft !== null && hoursLeft !== undefined ? hoursLeft % 24 : null;

    let blockText = "";
    if (daysLeft !== null && remainingHours !== null) {
      if (daysLeft > 0) {
        blockText = ` Sera bloqueado em ${daysLeft}d ${remainingHours}h.`;
      } else if (remainingHours > 0) {
        blockText = ` Sera bloqueado em ${remainingHours}h.`;
      } else {
        blockText = " Bloqueio iminente!";
      }
    }

    return (
      <div className="bg-red-600 text-white text-center py-2.5 px-4 text-sm font-medium z-50">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <svg className="w-4 h-4 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>
            <strong>Pagamento atrasado ha {billing.daysOverdue} dia{billing.daysOverdue > 1 ? "s" : ""}.</strong>
            {blockText} Evite o bloqueio regularizando seu pagamento.
          </span>
          <a
            href="/settings/billing"
            className="ml-1 rounded-md bg-white/20 px-3 py-0.5 text-xs font-bold hover:bg-white/30 transition-colors"
          >
            Regularizar
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
            title="Fechar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Due today
  if (billing.daysUntilDue !== undefined && billing.daysUntilDue === 0) {
    return (
      <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium z-50">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>
            Sua fatura vence <strong>hoje</strong>. Mantenha seu pagamento em dia para evitar interrupcoes.
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
            title="Fechar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Nothing to show
  return null;
}
