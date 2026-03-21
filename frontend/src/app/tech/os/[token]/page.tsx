"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTechAuth } from "@/contexts/TechAuthContext";

export default function TechOsTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { loginWithToken, user, loading } = useTechAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // Wait for auth init to complete before deciding
    if (loading) return;

    (async () => {
      try {
        // If already authenticated, skip token consumption — go directly to orders
        if (user) {
          router.replace("/tech/orders");
          return;
        }

        const result = await loginWithToken(token);

        if (result.type === "pending_contract" && result.contractToken) {
          router.replace(`/contract/${result.contractToken}`);
          return;
        }

        if (result.serviceOrderId) {
          router.replace(`/tech/orders/${result.serviceOrderId}`);
        } else {
          router.replace("/tech/orders");
        }
      } catch (err: any) {
        setError(err.message || "Link invalido ou expirado");
      }
    })();
  }, [token, loginWithToken, router, user, loading]);

  /* ── Try device recover and go to orders ────────────── */
  async function handleOpenMyOrders() {
    setRecovering(true);
    router.push("/tech/login");
  }

  if (error) {
    // Friendly message — could be another tech clicking or token already used
    const isAlreadyAssigned =
      error.includes("finalizada") || error.includes("atribuida");

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl bg-white px-7 py-8 shadow-2xl text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isAlreadyAssigned ? "bg-amber-50" : "bg-red-100"}`}>
            {isAlreadyAssigned ? (
              <svg className="h-8 w-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">
            {isAlreadyAssigned ? "OS ja atribuida" : "Link indisponivel"}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {isAlreadyAssigned
              ? "Esta ordem de servico ja foi atribuida. Se for seu tecnico, abra o app para acessar."
              : error}
          </p>
          <button
            onClick={handleOpenMyOrders}
            disabled={recovering}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white text-sm hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
          >
            {recovering ? "Abrindo..." : "Abrir minhas OS"}
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Voce sera redirecionado para verificar suas ordens de servico
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-400 border-t-transparent" />
        <p className="text-sm text-blue-200">Abrindo ordem de servico...</p>
      </div>
    </div>
  );
}
