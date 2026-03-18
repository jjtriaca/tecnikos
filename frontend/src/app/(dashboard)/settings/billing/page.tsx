"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
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
  maxTechnicians: number;
  maxAiMessages: number;
  supportLevel: string;
  allModulesIncluded: boolean;
};

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  osQuantity: number;
  userQuantity: number;
  technicianQuantity: number;
  aiMessageQuantity: number;
  nfseImportQuantity: number;
  priceCents: number;
};

type UsageData = {
  usedThisMonth: number;
  maxOsPerMonth: number;
  isUnlimited: boolean;
  percentage: number;
  daysLeft: number;
  osCount?: number;
  avulsaNfseCount?: number;
};

type BillingStatus = {
  hasSubscription: boolean;
  status?: string;
  planId?: string;
  planName?: string;
  valueBrl?: number;
  planPriceCents?: number;
  isPromo?: boolean;
  promoMonthsLeft?: number;
  billingCycle?: string;
  creditBalanceCents?: number;
  pendingPlanName?: string | null;
  pendingPlanAt?: string | null;
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

function formatLimit(value: number, unit: string): string {
  return value === 0 ? `${unit} ilimitados` : `Ate ${value} ${unit}`;
}

const SUPPORT_LABELS: Record<string, string> = {
  EMAIL: "Suporte por email",
  EMAIL_CHAT: "Suporte por email e chat",
  PRIORITY: "Suporte prioritario",
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [downgrading, setDowngrading] = useState<string | null>(null);
  const [cancellingDowngrade, setCancellingDowngrade] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Show success message from checkout redirect
  useEffect(() => {
    const addon = searchParams.get("addon");
    const upgrade = searchParams.get("upgrade");
    if (addon === "success") {
      showMessage({ type: "success", text: "Pacote de OS adquirido com sucesso! As OS serao creditadas apos confirmacao do pagamento." });
    } else if (upgrade === "success") {
      showMessage({ type: "success", text: "Upgrade realizado com sucesso! Seu plano sera atualizado apos confirmacao do pagamento." });
    }
  }, [searchParams]);

  const loadData = () => {
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
  };

  useEffect(() => { loadData(); }, []);

  const messageRef = React.useRef<HTMLDivElement>(null);

  function showMessage(msg: { type: "success" | "error"; text: string }) {
    setMessage(msg);
    setTimeout(() => messageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
  }

  async function handlePurchase(addOnId: string) {
    setPurchasing(addOnId);
    setMessage(null);
    try {
      const result = await api.post<{ success: boolean; message: string; checkoutUrl?: string }>("/auth/purchase-addon", {
        addOnId,
      });

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        showMessage({ type: "success", text: "Pagina de pagamento aberta! Finalize o pagamento para receber as OS extras." });
      } else {
        showMessage({ type: "success", text: result.message });
        const newUsage = await api.get<UsageData>("/service-orders/usage");
        setUsage(newUsage);
      }
    } catch (err: any) {
      showMessage({ type: "error", text: err?.message || "Erro ao comprar pacote" });
    } finally {
      setPurchasing(null);
    }
  }

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    setMessage(null);
    try {
      const result = await api.post<{ success: boolean; checkoutUrl: string; creditApplied?: number }>("/auth/upgrade-plan", {
        newPlanId: planId,
      });

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        const creditMsg = result.creditApplied
          ? ` Credito de R$ ${result.creditApplied.toFixed(2).replace(".", ",")} aplicado na primeira fatura.`
          : "";
        showMessage({ type: "success", text: `Pagina de pagamento do upgrade aberta!${creditMsg}` });
      }
    } catch (err: any) {
      showMessage({ type: "error", text: err?.message || "Erro ao fazer upgrade" });
    } finally {
      setUpgrading(null);
    }
  }

  async function handleDowngrade(planId: string) {
    setDowngrading(planId);
    setMessage(null);
    try {
      const result = await api.post<{ success: boolean; message: string }>("/auth/downgrade-plan", {
        newPlanId: planId,
      });
      showMessage({ type: "success", text: result.message });
      loadData();
    } catch (err: any) {
      showMessage({ type: "error", text: err?.message || "Erro ao agendar downgrade" });
    } finally {
      setDowngrading(null);
    }
  }

  async function handleCancelDowngrade() {
    setCancellingDowngrade(true);
    setMessage(null);
    try {
      await api.post("/auth/cancel-downgrade", {});
      showMessage({ type: "success", text: "Downgrade cancelado. Seu plano atual sera mantido." });
      loadData();
    } catch (err: any) {
      showMessage({ type: "error", text: err?.message || "Erro ao cancelar downgrade" });
    } finally {
      setCancellingDowngrade(false);
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

  // Use planPriceCents for upgrade/downgrade comparison (not the promo-discounted value)
  const currentPlanPriceCents = billing?.planPriceCents ?? (billing?.valueBrl ? billing.valueBrl * 100 : 0);
  const currentPlanId = billing?.planId;
  const upgradePlans = plans.filter((p) => p.id !== currentPlanId && p.priceCents > currentPlanPriceCents);
  const downgradePlans = plans.filter((p) => p.id !== currentPlanId && p.priceCents < currentPlanPriceCents && p.priceCents > 0);

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
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Promocao ativa — {billing.promoMonthsLeft} {billing.promoMonthsLeft === 1 ? "mes" : "meses"} restante{billing.promoMonthsLeft > 1 ? "s" : ""}
                  </span>
                </div>
              ) : null}
              {billing.billingCycle && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Ciclo: {billing.billingCycle === "ANNUAL" ? "Anual" : "Mensal"}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {billing.valueBrl != null ? `R$ ${billing.valueBrl.toFixed(2).replace(".", ",")}` : "\u2014"}
              </p>
              <p className="text-xs text-slate-400">/{billing.billingCycle === "ANNUAL" ? "ano" : "mes"}</p>
              {billing.isPromo && billing.planPriceCents && billing.planPriceCents !== Math.round((billing.valueBrl || 0) * 100) && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Apos promocao: {formatCurrency(billing.planPriceCents)}/mes
                </p>
              )}
            </div>
          </div>

          {/* Credit balance */}
          {(billing.creditBalanceCents ?? 0) > 0 && (
            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              Saldo: {formatCurrency(billing.creditBalanceCents!)} (sera abatido na proxima fatura)
            </div>
          )}

          {/* Pending downgrade */}
          {billing.pendingPlanName && billing.pendingPlanAt && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Mudanca para <strong className="mx-1">{billing.pendingPlanName}</strong> agendada para {new Date(billing.pendingPlanAt).toLocaleDateString("pt-BR")}
              </div>
              <button
                onClick={handleCancelDowngrade}
                disabled={cancellingDowngrade}
                className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
              >
                {cancellingDowngrade ? "..." : "Cancelar"}
              </button>
            </div>
          )}

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
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Uso neste ciclo</h2>
          <div className="flex items-end gap-4 mb-3">
            <span className="text-3xl font-bold text-slate-900">{usage.usedThisMonth}</span>
            <span className="text-sm text-slate-500 mb-1">/ {usage.maxOsPerMonth} transacoes</span>
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
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-3 text-[11px] text-slate-400">
              {usage.osCount !== undefined && (
                <span>{usage.osCount} OS</span>
              )}
              {(usage.avulsaNfseCount ?? 0) > 0 && (
                <span>+ {usage.avulsaNfseCount} NFS-e avulsas</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {usage.daysLeft} dias restantes
            </span>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div ref={messageRef} className={`rounded-xl border px-4 py-3 text-sm ${
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
          <p className="text-xs text-slate-500 mb-3">O upgrade e imediato. O saldo do plano atual sera creditado como desconto na primeira fatura do novo plano.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upgradePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                variant="upgrade"
                actionLabel="Fazer Upgrade"
                loading={upgrading === plan.id}
                onAction={() => handleUpgrade(plan.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Downgrade Plans */}
      {downgradePlans.length > 0 && !billing?.pendingPlanName && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Trocar para plano menor</h2>
          <p className="text-xs text-slate-500 mb-3">A troca sera aplicada no proximo ciclo de cobranca. Voce continua com o plano atual ate o final do periodo pago.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {downgradePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                variant="downgrade"
                actionLabel="Trocar Plano"
                loading={downgrading === plan.id}
                onAction={() => handleDowngrade(plan.id)}
              />
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
                    {addOn.osQuantity > 0 && (
                      <><p className="text-2xl font-bold text-slate-900">+{addOn.osQuantity}</p><p className="text-xs text-slate-500">ordens de servico</p></>
                    )}
                    {addOn.userQuantity > 0 && (
                      <><p className="text-2xl font-bold text-slate-900">+{addOn.userQuantity}</p><p className="text-xs text-slate-500">{addOn.userQuantity === 1 ? "usuario gestor" : "usuarios gestores"}</p></>
                    )}
                    {addOn.technicianQuantity > 0 && (
                      <><p className="text-2xl font-bold text-slate-900">+{addOn.technicianQuantity}</p><p className="text-xs text-slate-500">{addOn.technicianQuantity === 1 ? "tecnico" : "tecnicos"}</p></>
                    )}
                    {addOn.aiMessageQuantity > 0 && (
                      <><p className="text-2xl font-bold text-slate-900">+{addOn.aiMessageQuantity}</p><p className="text-xs text-slate-500">msgs IA/mes</p></>
                    )}
                    {addOn.nfseImportQuantity > 0 && (
                      <><p className="text-2xl font-bold text-slate-900">+{addOn.nfseImportQuantity}</p><p className="text-xs text-slate-500">importacoes NFS-e</p></>
                    )}
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

      {addOns.length === 0 && upgradePlans.length === 0 && downgradePlans.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum pacote adicional ou opcao de plano disponivel no momento.</p>
        </div>
      )}
    </div>
  );
}

/* ── Plan Card Component ──────────────────────────── */

function PlanCard({
  plan,
  variant,
  actionLabel,
  loading,
  onAction,
}: {
  plan: Plan;
  variant: "upgrade" | "downgrade";
  actionLabel: string;
  loading: boolean;
  onAction: () => void;
}) {
  const isUpgrade = variant === "upgrade";
  const borderColor = isUpgrade ? "border-blue-200" : "border-slate-200";
  const bgGradient = isUpgrade ? "bg-gradient-to-br from-blue-50 to-white" : "bg-white";
  const iconBg = isUpgrade ? "bg-blue-100" : "bg-slate-100";
  const iconColor = isUpgrade ? "text-blue-600" : "text-slate-500";
  const priceColor = isUpgrade ? "text-blue-600" : "text-slate-700";
  const checkColor = isUpgrade ? "text-blue-500" : "text-slate-400";

  return (
    <div className={`rounded-xl border ${borderColor} ${bgGradient} p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <svg className={`h-5 w-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            {isUpgrade ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
            )}
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{plan.name}</h3>
          {plan.description && (
            <p className="text-xs text-slate-500">{plan.description}</p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="space-y-1.5 mb-4 flex-1">
        <FeatureLine color={checkColor} text={formatLimit(plan.maxUsers, "usuarios")} />
        <FeatureLine color={checkColor} text={plan.maxOsPerMonth === 0 ? "OS ilimitadas" : `Ate ${plan.maxOsPerMonth} OS/mes`} />
        <FeatureLine color={checkColor} text={formatLimit(plan.maxTechnicians, "tecnicos")} />
        <FeatureLine color={checkColor} text={plan.maxAiMessages === 0 ? "Msgs IA ilimitadas" : `${plan.maxAiMessages} msgs IA/mes`} />
        <FeatureLine color={checkColor} text={SUPPORT_LABELS[plan.supportLevel] || plan.supportLevel} />
        {plan.allModulesIncluded && (
          <FeatureLine color={checkColor} text="Todos os modulos inclusos" />
        )}
      </div>

      {/* Price */}
      <div className="mb-4">
        <p className={`text-2xl font-bold ${priceColor}`}>{formatCurrency(plan.priceCents)}</p>
        <p className="text-[10px] text-slate-400">/mes</p>
        {plan.priceYearlyCents != null && plan.priceYearlyCents > 0 && (
          <p className="text-[10px] text-slate-400">
            ou {formatCurrency(plan.priceYearlyCents)}/ano ({Math.round((1 - plan.priceYearlyCents / (plan.priceCents * 12)) * 100)}% desconto)
          </p>
        )}
      </div>

      {/* Action */}
      <button
        onClick={onAction}
        disabled={loading}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isUpgrade
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {loading ? "Processando..." : actionLabel}
      </button>
    </div>
  );
}

function FeatureLine({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600">
      <svg className={`w-3.5 h-3.5 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      {text}
    </div>
  );
}
