"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for updates periodically (every 30 min)
          setInterval(() => {
            registration.update();
          }, 30 * 60 * 1000);

          // Re-sync existing push subscription with backend (handles SW updates)
          registration.pushManager?.getSubscription().then(async (sub) => {
            if (sub) {
              try {
                const p256dh = sub.getKey("p256dh");
                const auth = sub.getKey("auth");
                if (p256dh && auth) {
                  const toBase64 = (buf: ArrayBuffer) => {
                    const bytes = new Uint8Array(buf);
                    let binary = "";
                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                    return window.btoa(binary);
                  };
                  // Dynamic import to avoid bundling api.ts in SW context
                  const { api } = await import("@/lib/api");
                  await api.post("/push/subscribe", {
                    endpoint: sub.endpoint,
                    keys: { p256dh: toBase64(p256dh), auth: toBase64(auth) },
                    deviceName: navigator.userAgent,
                  });
                }
              } catch {
                // Silent — push re-sync is best-effort
              }
            }
          });
        })
        .catch(() => {
          // Service worker registration failed — not critical
        });
    }
  }, []);

  return null;
}
