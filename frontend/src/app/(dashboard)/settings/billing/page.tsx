"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";

type Plan = {
  id: string;
  name: string;
  maxUsers: number;
  maxOsPerMonth: number;
  priceCents: number;
  priceYearlyCents: number | null;
  description: string | null;
  features: string[];
};

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  osQuantity: number;
  priceCents: number;
};

type UsageData = {
  usedThisMonth: number;
  maxOsPerMonth: number;
  isUnlimited: boolean;
  percentage: number;
  daysLeft: number;
};

type BillingStatus = {
  hasSubscription: boolean;
  status?: string;
  planName?: string;
  valueBrl?: number;
  isPromo?: boolean;
  promoMonthsLeft?: number;
};

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 90) return "bg-red-400";
  if (pct >= 80) return "bg-amber-400";
  return "bg-blue-500";
}

export default function BillingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Show success message from checkout redirect
  useEffect(() => {
    const addon = searchParams.get("addon");
    const upgrade = searchParams.get("upgrade");
    if (addon === "success") {
      setMessage({ type: "success", text: "Pacote de OS adquirido com sucesso! As OS serao creditadas apos confirmacao do pagamento." });
    } else if (upgrade === "success") {
      setMessage({ type: "success", text: "Upgrade realizado com sucesso! Seu plano sera atualizado apos confirmacao do pagamento." });
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.allSettled([
      api.get<AddOn[]>("/public/saas/addons"),
      api.get<UsageData>("/service-orders/usage"),
      api.get<Plan[]>("/public/saas/plans"),
      api.get<BillingStatus>("/auth/billing-status"),
    ]).then(([addOnsRes, usageRes, plansRes, billingRes]) => {
      if (addOnsRes.status === "fulfilled") setAddOns(addOnsRes.value);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value);
      if (billingRes.status === "fulfilled") setBilling(billingRes.value);
      setLoading(false);
    });
  }, []);

  async function handlePurchase(addOnId: string) {
    setPurchasing(addOnId);
    setMessage(null);
    try {
      const result = await api.post<{ success: boolean; message: string; checkoutUrl?: string }>("/public/saas/purchase-addon", {
        tenantId: "self",
        addOnId,
      });

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        setMessage({ type: "success", text: "Pagina de pagamento aberta! Finalize o pagamento para receber as OS extras." });
      } else {
        setMessage({ type: "success", text: result.message });
        // Refresh usage
        const newUsage = await api.get<UsageData>("/service-orders/usage");
        setUsage(newUsage);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Erro ao comprar pacote" });
    } finally {
      setPurchasing(null);
    }
  }

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    setMessage(null);
    try {
      const result = await api.post<{ success: boolean; checkoutUrl: string }>("/auth/upgrade-plan", {
        newPlanId: planId,
      });

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        setMessage({ type: "success", text: "Pagina de pagamento do upgrade aberta! Finalize para ativar o novo plano." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Erro ao fazer upgrade" });
    } finally {
      setUpgrading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Assinatura e Pacotes</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  // Filter plans for upgrade: only plans more expensive than current
  const currentPlanValue = billing?.valueBrl ? billing.valueBrl * 100 : 0;
  const upgradePlans = plans.filter((p) => p.priceCents > currentPlanValue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Assinatura e Pacotes</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie seu plano e compre pacotes adicionais de OS</p>
      </div>

      {/* Current Plan */}
      {billing?.hasSubscription && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Seu Plano</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-slate-900">{billing.planName || "Plano atual"}</p>
              {billing.isPromo && billing.promoMonthsLeft ? (
                <p className="text-xs text-green-600 mt-1">
                  Promocao ativa — {billing.promoMonthsLeft} {billing.promoMonthsLeft === 1 ? "mes" : "meses"} restante{billing.promoMonthsLeft > 1 ? "s" : ""}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {billing.valueBrl ? `R$ ${billing.valueBrl.toFixed(2).replace(".", ",")}` : "—"}
              </p>
              <p className="text-xs text-slate-400">/mes</p>
            </div>
          </div>
          {billing.status === "PAST_DUE" && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              Pagamento atrasado. Regularize para manter o acesso.
            </div>
          )}
        </div>
      )}

      {/* Usage Summary */}
      {usage && !usage.isUnlimited && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Uso de OS neste mes</h2>
          <div className="flex items-end gap-4 mb-3">
            <span className="text-3xl font-bold text-slate-900">{usage.usedThisMonth}</span>
            <span className="text-sm text-slate-500 mb-1">/ {usage.maxOsPerMonth} OS</span>
            <span className={`text-sm font-semibold mb-1 ml-auto ${
              usage.percentage >= 90 ? "text-red-500" : usage.percentage >= 80 ? "text-amber-500" : "text-blue-600"
            }`}>
              {usage.percentage}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getBarColor(usage.percentage)}`}
              style={{ width: `${Math.min(usage.percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {usage.daysLeft} dias restantes no mes
          </p>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          message.type === "success"
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Upgrade Plans */}
      {upgradePlans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Fazer Upgrade</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upgradePlans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-slate-500">{plan.description}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Ate {plan.maxUsers} usuarios
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {plan.maxOsPerMonth === -1 ? "OS ilimitadas" : `Ate ${plan.maxOsPerMonth} OS/mes`}
                  </div>
                </div>
                <div className="flex items-end justify-between mb-4">
                  <div className="text-right w-full">
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(plan.priceCents)}</p>
                    <p className="text-[10px] text-slate-400">/mes</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {upgrading === plan.id ? "Processando..." : "Fazer Upgrade"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add-on Packages */}
      {addOns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Pacotes Extras de OS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {addOns.map((addOn) => (
              <div
                key={addOn.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{addOn.name}</h3>
                    {addOn.description && (
                      <p className="text-xs text-slate-500">{addOn.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">+{addOn.osQuantity}</p>
                    <p className="text-xs text-slate-500">ordens de servico</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(addOn.priceCents)}</p>
                    <p className="text-[10px] text-slate-400">pagamento unico</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePurchase(addOn.id)}
                  disabled={purchasing === addOn.id}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {purchasing === addOn.id ? "Processando..." : "Comprar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {addOns.length === 0 && upgradePlans.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum pacote adicional ou upgrade disponivel no momento.</p>
        </div>
      )}
    </div>
  );
}
