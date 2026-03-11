"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get<AddOn[]>("/public/saas/addons"),
      api.get<UsageData>("/service-orders/usage"),
    ]).then(([addOnsRes, usageRes]) => {
      if (addOnsRes.status === "fulfilled") setAddOns(addOnsRes.value);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value);
      setLoading(false);
    });
  }, []);

  async function handlePurchase(addOnId: string) {
    setPurchasing(addOnId);
    setMessage(null);
    try {
      // For now, we need tenantId. Since this is a tenant-scoped request,
      // we'll pass it. In production, this would come from the auth context.
      const result = await api.post<{ success: boolean; message: string }>("/public/saas/purchase-addon", {
        tenantId: "self", // Backend resolves from auth context
        addOnId,
        billingType: "PIX",
      });
      setMessage({ type: "success", text: result.message });
      // Refresh usage
      const newUsage = await api.get<UsageData>("/service-orders/usage");
      setUsage(newUsage);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Erro ao comprar pacote" });
    } finally {
      setPurchasing(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Assinatura e Pacotes</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie seu plano e compre pacotes adicionais de OS</p>
      </div>

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

      {addOns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum pacote adicional disponivel no momento.</p>
        </div>
      )}
    </div>
  );
}
