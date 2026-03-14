"use client";

import { useEffect } from "react";

/**
 * DeployGuard — Global listener for chunk load errors during deployments.
 *
 * When a new version is deployed, old JS chunks are replaced with new ones.
 * If the user is on the page and navigates (triggering a dynamic import),
 * the browser fails to load the old chunk → "ChunkLoadError".
 *
 * This component catches those errors globally (window.onerror + unhandledrejection)
 * and auto-reloads the page once. It also prevents form data loss by NOT reloading
 * if the user is actively typing in a form — instead shows a toast-like notification.
 */
export default function DeployGuard() {
  useEffect(() => {
    const isChunkError = (message: string): boolean =>
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("error loading dynamically imported module");

    const canAutoReload = (): boolean => {
      // Don't auto-reload if user is actively interacting with a form
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return false;
      }
      return true;
    };

    const showUpdateBanner = () => {
      // Show a non-intrusive banner instead of reloading
      if (document.getElementById("deploy-guard-banner")) return; // already showing

      const banner = document.createElement("div");
      banner.id = "deploy-guard-banner";
      banner.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:99999;background:#1e40af;color:white;padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:12px;font-family:system-ui;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);";
      banner.innerHTML = `
        <span>🔄 Nova versão disponível. Salve seu trabalho e atualize.</span>
        <button onclick="window.location.reload()" style="background:white;color:#1e40af;border:none;padding:6px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">
          Atualizar agora
        </button>
        <button onclick="this.parentElement.remove()" style="background:transparent;color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;">
          Depois
        </button>
      `;
      document.body.appendChild(banner);
    };

    const handleChunkError = () => {
      const key = "__chunk_reload_attempt";
      const lastAttempt = sessionStorage.getItem(key);
      const now = Date.now();

      // Already tried auto-reload recently? Show banner instead
      if (lastAttempt && now - Number(lastAttempt) < 60_000) {
        showUpdateBanner();
        return;
      }

      if (canAutoReload()) {
        // Auto-reload (user not typing in a form)
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      } else {
        // User is typing — show banner, don't lose their data
        showUpdateBanner();
      }
    };

    // Catch synchronous chunk errors
    const onError = (event: ErrorEvent) => {
      if (isChunkError(event.message || "")) {
        event.preventDefault();
        handleChunkError();
      }
    };

    // Catch async chunk errors (dynamic imports return promises)
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || "");
      if (isChunkError(msg)) {
        event.preventDefault();
        handleChunkError();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null; // Invisible component
}
