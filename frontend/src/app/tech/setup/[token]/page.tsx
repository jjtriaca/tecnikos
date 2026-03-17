"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTechAuth } from "@/contexts/TechAuthContext";

type SetupStep = "loading" | "welcome" | "install" | "done" | "error";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function TechSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { loginWithToken, user } = useTechAuth();
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>("loading");
  const [error, setError] = useState<string | null>(null);
  const [techName, setTechName] = useState<string>("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Listen for beforeinstallprompt (Android/Chrome)
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Auto-login with token
  useEffect(() => {
    (async () => {
      try {
        const result = await loginWithToken(token);
        setStep("welcome");
      } catch (err: any) {
        setError(err.message || "Link inválido ou expirado");
        setStep("error");
      }
    })();
  }, [token, loginWithToken]);

  // Get tech name after login
  useEffect(() => {
    if (user) setTechName(user.name?.split(" ")[0] || "");
  }, [user]);

  async function handleInstallPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setStep("done");
      }
      setDeferredPrompt(null);
    } else {
      // If no prompt (iOS or already installed), just proceed
      setStep("done");
    }
  }

  function handleSkip() {
    router.push("/tech/orders");
  }

  function handleGoToOrders() {
    router.push("/tech/orders");
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-400 border-t-transparent" />
          <p className="text-sm text-blue-200">Configurando seu acesso...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
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

  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl bg-white px-7 py-8 shadow-2xl">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="Tecnikos" className="h-9 w-9" />
            <div>
              <div className="text-sm font-bold text-slate-900">Tecnikos</div>
              <div className="text-[10px] text-slate-400">Portal do Tecnico</div>
            </div>
          </div>

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-lg font-bold text-slate-900 text-center mb-1">
            Bem-vindo{techName ? `, ${techName}` : ""}!
          </h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Seu acesso está configurado. Para facilitar, instale o app no seu celular.
          </p>

          {!isStandalone() ? (
            <>
              <button
                onClick={() => setStep("install")}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 text-sm mb-3"
              >
                Instalar o app
              </button>
              <button
                onClick={handleSkip}
                className="h-11 w-full rounded-xl border border-slate-200 font-medium text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                Pular por enquanto
              </button>
            </>
          ) : (
            <button
              onClick={handleGoToOrders}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 text-sm"
            >
              Começar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "install") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl bg-white px-7 py-8 shadow-2xl">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Instalar o app</h1>
          <p className="text-sm text-slate-500 mb-6">
            Adicione o Tecnikos à sua tela inicial para acesso rápido.
          </p>

          {isIOS() ? (
            /* iOS install instructions */
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</div>
                <p className="text-sm text-slate-600 pt-0.5">
                  Toque no botão <span className="inline-flex items-center"><svg className="h-4 w-4 text-blue-600 mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></span> <strong>Compartilhar</strong> na barra inferior do Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</div>
                <p className="text-sm text-slate-600 pt-0.5">
                  Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">3</div>
                <p className="text-sm text-slate-600 pt-0.5">
                  Toque em <strong>&quot;Adicionar&quot;</strong> para confirmar
                </p>
              </div>
            </div>
          ) : isAndroid() && deferredPrompt ? (
            /* Android with native prompt */
            <div className="mb-6">
              <button
                onClick={handleInstallPWA}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 font-semibold text-white shadow-lg shadow-green-600/25 text-sm"
              >
                Instalar agora
              </button>
            </div>
          ) : (
            /* Android without prompt / desktop */
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</div>
                <p className="text-sm text-slate-600 pt-0.5">
                  Toque no menu <strong>(3 pontos)</strong> no canto superior do navegador
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</div>
                <p className="text-sm text-slate-600 pt-0.5">
                  Toque em <strong>&quot;Adicionar à tela inicial&quot;</strong> ou <strong>&quot;Instalar app&quot;</strong>
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleSkip}
            className="h-11 w-full rounded-xl border border-slate-200 font-medium text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            Continuar sem instalar
          </button>
        </div>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white px-7 py-8 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">Tudo pronto!</h1>
        <p className="text-sm text-slate-500 mb-6">O app foi instalado. Você receberá as ordens de serviço pelo WhatsApp.</p>
        <button
          onClick={handleGoToOrders}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 text-sm"
        >
          Começar
        </button>
      </div>
    </div>
  );
}
