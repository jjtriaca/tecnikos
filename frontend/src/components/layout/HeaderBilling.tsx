"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

interface UsageData {
  usedThisMonth: number;
  maxOsPerMonth: number;
  isUnlimited: boolean;
  percentage: number;
  daysLeft: number;
}

interface NfseImportUsage {
  used: number;
  limit: number;
  percentage: number;
  enabled: boolean;
}

interface BillingStatus {
  hasSubscription: boolean;
  status?: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "SUSPENDED";
  planName?: string;
  valueBrl?: number;
  isPromo?: boolean;
  promoMonthsLeft?: number;
  daysOverdue?: number;
  overduePaymentUrl?: string;
  pendingPlanName?: string | null;
  pendingPlanAt?: string | null;
}

function getBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 90) return "bg-red-400";
  if (pct >= 80) return "bg-amber-400";
  return "bg-blue-500";
}

function getTextClass(pct: number): string {
  if (pct >= 90) return "text-red-600 font-semibold";
  if (pct >= 80) return "text-amber-600 font-semibold";
  return "text-slate-500";
}

export default function HeaderBilling() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [nfseUsage, setNfseUsage] = useState<NfseImportUsage | null>(null);

  useEffect(() => {
    let mounted = true;
    api.get<UsageData>("/service-orders/usage")
      .then(d => { if (mounted) setUsage(d); })
      .catch(() => {});
    api.get<BillingStatus>("/auth/billing-status")
      .then(d => { if (mounted) setBilling(d); })
      .catch(() => {});
    api.get<NfseImportUsage>("/nfse-entrada/import-usage")
      .then(d => { if (mounted) setNfseUsage(d); })
      .catch(() => {});
    const interval = setInterval(() => {
      api.get<UsageData>("/service-orders/usage").then(setUsage).catch(() => {});
      api.get<BillingStatus>("/auth/billing-status").then(setBilling).catch(() => {});
      api.get<NfseImportUsage>("/nfse-entrada/import-usage")
        .then(d => setNfseUsage(d))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="flex items-center gap-3">
      {/* ── 1. Barra de uso de OS ── */}
      {usage && !usage.isUnlimited && (
        <Link
          href={usage.percentage >= 100 ? "/settings/billing?filter=os" : "/settings/billing"}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 hover:opacity-90 transition-colors ${
            usage.percentage >= 100 ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"
          }`}
          title={`${usage.usedThisMonth} de ${usage.maxOsPerMonth} OS usadas este ciclo (${usage.daysLeft} dias restantes)`}
        >
          <div className="flex flex-col gap-0.5 min-w-[100px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">OS este mes</span>
              <span className={`text-[10px] ${getTextClass(usage.percentage)}`}>
                {usage.percentage}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${getBarColor(usage.percentage)}`}
                style={{ width: `${Math.min(usage.percentage, 100)}%` }}
              />
            </div>
            <span className={`text-[10px] ${getTextClass(usage.percentage)}`}>
              {usage.usedThisMonth} / {usage.maxOsPerMonth}
            </span>
          </div>
        </Link>
      )}

      {/* ── 1b. Barra de uso NFS-e Import ── */}
      {nfseUsage && (
        <Link
          href={!nfseUsage.enabled || nfseUsage.percentage >= 100 ? "/settings/billing?filter=nfse" : "/nfe/entrada"}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 hover:opacity-90 transition-colors ${
            !nfseUsage.enabled || nfseUsage.percentage >= 100 ? "border-red-300 bg-red-50" : nfseUsage.percentage >= 80 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
          }`}
          title={!nfseUsage.enabled ? "Sem cota de importacao NFS-e — compre um add-on" : `${nfseUsage.used} de ${nfseUsage.limit} importacoes NFS-e usadas`}
        >
          <div className="flex flex-col gap-0.5 min-w-[100px]">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] ${!nfseUsage.enabled || nfseUsage.percentage >= 100 ? "text-red-600" : nfseUsage.percentage >= 80 ? "text-amber-600" : "text-emerald-500"}`}>Import NFS-e</span>
              {nfseUsage.enabled ? (
                <span className={`text-[10px] ${getTextClass(nfseUsage.percentage)}`}>
                  {nfseUsage.percentage}%
                </span>
              ) : (
                <span className="text-[10px] text-red-600 font-semibold">0</span>
              )}
            </div>
            <div className={`h-1.5 w-full rounded-full ${!nfseUsage.enabled || nfseUsage.percentage >= 100 ? "bg-red-100" : "bg-emerald-100"}`}>
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${!nfseUsage.enabled ? "bg-red-500" : getBarColor(nfseUsage.percentage)}`}
                style={{ width: nfseUsage.enabled ? `${Math.min(nfseUsage.percentage, 100)}%` : "100%" }}
              />
            </div>
            <span className={`text-[10px] ${!nfseUsage.enabled ? "text-red-600 font-semibold" : getTextClass(nfseUsage.percentage)}`}>
              {nfseUsage.used} / {nfseUsage.limit}
            </span>
          </div>
        </Link>
      )}

      {/* ── 2. Comprar OS (add-on) ── */}
      {usage && !usage.isUnlimited && usage.percentage >= 80 && (
        <Link
          href="/settings/billing?filter=os"
          className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          title="Comprar pacote extra de OS"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Comprar OS
        </Link>
      )}

      {/* ── 3. Status da mensalidade ── */}
      {billing?.hasSubscription && (
        <>
          {billing.status === "PAST_DUE" ? (
            <Link
              href={billing.overduePaymentUrl || "/settings/billing"}
              className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors animate-pulse"
              title={`Pagamento atrasado${billing.daysOverdue ? ` ha ${billing.daysOverdue} dia(s)` : ""}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Atrasado
            </Link>
          ) : billing.isPromo && billing.promoMonthsLeft ? (
            <Link
              href="/settings/billing?filter=plans"
              className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              title={`Promocao ativa — ${billing.promoMonthsLeft} mes(es) restante(s)`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              Promo {billing.promoMonthsLeft}m
            </Link>
          ) : billing.status === "ACTIVE" ? (
            <Link
              href="/settings/billing?filter=plans"
              className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition-colors"
              title={`Assinatura em dia${billing.planName ? ` — Plano ${billing.planName}` : ""}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Em dia
            </Link>
          ) : null}

          {/* Downgrade pending badge */}
          {billing.pendingPlanName && billing.pendingPlanAt && (
            <Link
              href="/settings/billing?filter=plans"
              className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              title={`Mudanca para ${billing.pendingPlanName} em ${new Date(billing.pendingPlanAt).toLocaleDateString("pt-BR")}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Downgrade {Math.max(0, Math.ceil((new Date(billing.pendingPlanAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d
            </Link>
          )}
        </>
      )}
    </div>
  );
}
