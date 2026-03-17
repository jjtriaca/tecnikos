"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Detect iOS Safari (not Chrome/Firefox on iOS, not standalone) */
function isIosSafari(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Safari on iOS has "Safari" in UA but NOT "CriOS" (Chrome) or "FxiOS" (Firefox)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [iosStep, setIosStep] = useState(0); // 0 = banner, 1-3 = step-by-step tutorial
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed
    if (isStandalone()) return;

    // Already dismissed recently (24h cooldown)
    const dismissedAt = localStorage.getItem("tk_pwa_dismissed_at");
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }

    // iOS Safari: show custom instructions
    if (isIosSafari()) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setShowIosBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: use native beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowAndroidBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowAndroidBanner(false);
    setShowIosBanner(false);
    localStorage.setItem("tk_pwa_dismissed_at", String(Date.now()));
  };

  /* ── Android Banner ── */
  if (showAndroidBanner && !dismissed) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom duration-300">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
              <img src="/icons/icon-72.png" alt="Tecnikos" className="h-7 w-7 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Instalar Tecnikos</p>
              <p className="text-xs text-white/70 mt-0.5">
                Adicione a tela inicial para acesso rapido
              </p>
            </div>
            <button onClick={handleDismiss} className="text-white/50 hover:text-white/80 shrink-0 p-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleInstallAndroid}
            className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-blue-700 shadow active:scale-[0.98] transition-all"
          >
            Instalar App
          </button>
        </div>
      </div>
    );
  }

  /* ── iOS Safari Tutorial ── */
  if (showIosBanner && !dismissed) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={handleDismiss}>
        <div
          className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-3">
              <img src="/icons/icon-72.png" alt="Tecnikos" className="h-10 w-10 rounded-xl shadow" />
              <div>
                <p className="text-base font-bold text-slate-800">Instalar Tecnikos</p>
                <p className="text-xs text-slate-400">Acesse como um app nativo</p>
              </div>
            </div>
            <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 p-1">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Steps */}
          <div className="px-5 pb-8 pt-2">
            {iosStep === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Instale o Tecnikos na tela inicial do seu iPhone para acesso rapido, sem precisar de app store.
                </p>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">1</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">Toque no botao Compartilhar</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Na barra inferior do Safari, toque no icone:
                      </p>
                      <div className="flex items-center justify-center mt-2 mb-1">
                        {/* Safari share icon replica */}
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border-2 border-blue-200 shadow-sm">
                          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-white text-xs font-bold shrink-0">2</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">Role e toque em &quot;Adicionar a Tela de Inicio&quot;</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No menu que aparece, role para baixo ate encontrar:
                      </p>
                      <div className="flex items-center gap-2.5 mt-2 rounded-lg bg-white border border-slate-200 px-3 py-2.5">
                        <svg className="h-5 w-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm text-slate-700">Adicionar a Tela de Inicio</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-100 p-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold shrink-0">3</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">Confirme tocando em &quot;Adicionar&quot;</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        O icone do Tecnikos vai aparecer na sua tela inicial!
                      </p>
                      <div className="flex items-center justify-center mt-2">
                        <div className="flex flex-col items-center gap-1">
                          <img src="/icons/icon-72.png" alt="Tecnikos" className="h-12 w-12 rounded-2xl shadow-md" />
                          <span className="text-[10px] text-slate-500">Tecnikos</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDismiss}
                  className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-200 transition-colors"
                >
                  Entendi, fazer depois
                </button>
              </div>
            )}
          </div>

          {/* Bottom safe area */}
          <div className="h-safe-bottom" />
        </div>
      </div>
    );
  }

  return null;
}
