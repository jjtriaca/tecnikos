"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTechAuth } from "@/contexts/TechAuthContext";

export default function TechOsTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { loginWithToken, user } = useTechAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
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
        setError(err.message || "Link inválido ou expirado");
      }
    })();
  }, [token, loginWithToken, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl bg-white px-7 py-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Link inválido</h1>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => router.push("/tech/login")}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white text-sm"
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-400 border-t-transparent" />
        <p className="text-sm text-blue-200">Abrindo ordem de serviço...</p>
      </div>
    </div>
  );
}
