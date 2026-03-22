// Tecnikos Service Worker — PWA + Offline Shell + Cache Strategy + Background Sync
const CACHE_NAME = "tecnikos-v2";
const SHELL_CACHE = "tecnikos-shell-v2";
const API_CACHE = "tecnikos-api-v1";

// App shell files to cache immediately
const SHELL_FILES = [
  "/tech/orders",
  "/tech/login",
  "/manifest.json",
  "/favicon.svg",
  "/logo-icon.svg",
  "/apple-touch-icon.png",
];

// API endpoints eligible for cache (GET only, for offline fallback)
const CACHEABLE_API_PATTERNS = [
  /\/api\/service-orders\/[^/]+$/,
  /\/api\/service-orders\/[^/]+\/workflow$/,
  /\/api\/service-orders\/[^/]+\/attachments$/,
  /\/api\/tech-auth\/my-orders$/,
];

function isCacheableApi(pathname) {
  return CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_FILES).catch(() => {
        // Some files might fail (e.g., login requires auth)
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  const VALID_CACHES = [CACHE_NAME, SHELL_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !VALID_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST uploads, advances, etc. go through normally)
  if (event.request.method !== "GET") return;

  // Cacheable API calls: Network-first with API cache fallback
  if (isCacheableApi(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: "offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          });
        })
    );
    return;
  }

  // Non-cacheable API calls: always go to network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/api")) {
    return;
  }

  // Static assets (images, icons, fonts): Cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Next.js static chunks: Cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages with token (tech public links): always network, never cache
  if (url.searchParams.has("token")) {
    return;
  }

  // Pages: Network-first with cache fallback
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Fallback: show cached orders page
            return caches.match("/tech/orders");
          });
        })
    );
    return;
  }
});

// Background Sync: triggered by system when connectivity restored
self.addEventListener("sync", (event) => {
  if (event.tag === "tecnikos-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_TRIGGER" });
        });
      })
    );
  }
});

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "Nova notificacao",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      vibrate: [200, 100, 200],
      data: {
        url: data.url || "/tech/orders",
      },
      actions: data.actions || [],
      tag: data.tag || "tecnikos-notification",
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Tecnikos", options)
    );
  } catch {
    // Ignore malformed push data
  }
});

// Notification click: open the relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/tech/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If already open, focus it
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});

// Message handler: receive messages from app
self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_COMPLETE") {
    // Broadcast sync complete to all clients
    self.clients.matchAll({ type: "window" }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "SYNC_COMPLETE" });
      });
    });
  }
});
