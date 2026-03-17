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
        })
        .catch(() => {
          // Service worker registration failed — not critical
        });
    }
  }, []);

  return null;
}
