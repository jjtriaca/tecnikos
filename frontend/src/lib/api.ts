// lib/api.ts — fetch wrapper with JWT refresh interceptor (no axios dependency)

export type ApiErrorPayload = {
  message?: string;
  error?: string;
  statusCode?: number;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;

  constructor(status: number, message: string, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

// In development, use Next.js rewrite proxy (/api) so cookies work on same origin.
// In production, point directly to the backend URL.
const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api" // browser: use same-origin proxy
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"); // server-side

/* ------------------------------------------------------------------ */
/*  In-memory access token (NOT in localStorage — safer against XSS)  */
/* ------------------------------------------------------------------ */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/* ------------------------------------------------------------------ */
/*  Core request function                                              */
/* ------------------------------------------------------------------ */
type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  _skipRefresh?: boolean;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (accessToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const hasBody = options.body !== undefined && options.body !== null;
  const body = hasBody ? JSON.stringify(options.body) : undefined;

  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
    signal: options.signal,
    credentials: "include",
    cache: "no-store",
  });

  // 401 interceptor: attempt silent refresh
  if (res.status === 401 && !options._skipRefresh && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, _skipRefresh: true });
    }
    setAccessToken(null);
    throw new ApiError(401, "Sessão expirada");
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const data = (
    isJson ? await res.json().catch(() => null) : await res.text().catch(() => "")
  ) as any;

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed: ${res.status} ${res.statusText}`;

    throw new ApiError(
      res.status,
      message,
      typeof data === "object" ? data : { message: String(data) },
    );
  }

  return data as T;
}

/* ------------------------------------------------------------------ */
/*  Silent refresh                                                     */
/* ------------------------------------------------------------------ */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Public refresh — used by AuthContext on mount */
export async function silentRefresh(): Promise<string | null> {
  const ok = await tryRefresh();
  return ok ? accessToken : null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),

  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),

  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),

  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),

  del: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
