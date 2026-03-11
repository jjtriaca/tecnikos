const SESSION_KEY = "tk_sid";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function track(event: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const sessionId = getSessionId();
  const page = window.location.pathname;

  fetch("/api/public/saas/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, page, metadata, sessionId }),
    keepalive: true,
  }).catch(() => {});
}
