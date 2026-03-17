"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (typeof window !== "undefined" && localStorage.getItem("tk_pwa_dismissed")) {
      return;
    }

    // Check if already installed (standalone mode)
    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem("tk_pwa_dismissed", "1");
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom">
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
          onClick={handleInstall}
          className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-blue-700 shadow active:scale-[0.98] transition-all"
        >
          Instalar App
        </button>
      </div>
    </div>
  );
}
