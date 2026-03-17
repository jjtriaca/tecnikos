"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_BASE = typeof window !== "undefined" ? "/api" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

export type TechUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  status: string;
  rating: number;
  companyId: string;
  company?: { id: string; name: string };
};

type TechAuthState = {
  user: TechUser | null;
  loading: boolean;
  /** Legacy email+password login */
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  /** Request OTP code via WhatsApp */
  requestOtp: (phone: string) => Promise<{ otpId: string; expiresAt: string }>;
  /** Verify OTP code and login */
  loginWithOtp: (phone: string, code: string) => Promise<void>;
  /** Login via token (welcome link or OS link) */
  loginWithToken: (token: string) => Promise<{ type: string; serviceOrderId?: string }>;
  logout: () => Promise<void>;
};

const TechAuthContext = createContext<TechAuthState>({
  user: null,
  loading: true,
  login: async () => {},
  requestOtp: async () => ({ otpId: "", expiresAt: "" }),
  loginWithOtp: async () => {},
  loginWithToken: async () => ({ type: "welcome" }),
  logout: async () => {},
});

let techAccessToken: string | null = null;

export function setTechAccessToken(t: string | null) {
  techAccessToken = t;
}
export function getTechAccessToken() {
  return techAccessToken;
}

/* ── Tech API helper ───────────────────────────────────── */

export async function techApi<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (techAccessToken) {
    headers["Authorization"] = `Bearer ${techAccessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && path !== "/tech-auth/refresh") {
    // Try silent refresh
    const refreshed = await techSilentRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${techAccessToken}`;
      const retry = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
      if (!retry.ok) throw new Error(await retry.text());
      return retry.json();
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function techSilentRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tech-auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    techAccessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

/* ── Provider ──────────────────────────────────────────── */

export function TechAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TechUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    try {
      const data = await techApi<TechUser>("/tech-auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const refreshed = await techSilentRefresh();
      if (refreshed) {
        await fetchMe();
      }
      setLoading(false);
    })();
  }, [fetchMe]);

  /* ── Legacy email+password ─────────────────────────── */
  const login = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      const res = await fetch(`${API_BASE}/tech-auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(captchaToken ? { captchaToken } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Credenciais inválidas");
      }
      const data = await res.json();
      techAccessToken = data.accessToken;
      await fetchMe();
      router.push("/tech/orders");
    },
    [fetchMe, router]
  );

  /* ── OTP: request code ─────────────────────────────── */
  const requestOtp = useCallback(async (phone: string) => {
    const res = await fetch(`${API_BASE}/tech-auth/otp/request`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Não foi possível enviar o código");
    }
    return res.json();
  }, []);

  /* ── OTP: verify + login ───────────────────────────── */
  const loginWithOtp = useCallback(
    async (phone: string, code: string) => {
      const res = await fetch(`${API_BASE}/tech-auth/otp/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Código inválido");
      }
      const data = await res.json();
      techAccessToken = data.accessToken;
      await fetchMe();
      router.push("/tech/orders");
    },
    [fetchMe, router]
  );

  /* ── Token auth (welcome link or OS link) ──────────── */
  const loginWithToken = useCallback(
    async (token: string) => {
      const res = await fetch(`${API_BASE}/tech-auth/token/${token}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Link inválido ou expirado");
      }
      const data = await res.json();
      // If pending contract, don't login — return contract info
      if (data.type === 'pending_contract') {
        return { type: data.type, contractToken: data.contractToken };
      }
      techAccessToken = data.accessToken;
      await fetchMe();
      return { type: data.type, serviceOrderId: data.serviceOrderId };
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/tech-auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    techAccessToken = null;
    setUser(null);
    router.push("/tech/login");
  }, [router]);

  return (
    <TechAuthContext.Provider value={{ user, loading, login, requestOtp, loginWithOtp, loginWithToken, logout }}>
      {children}
    </TechAuthContext.Provider>
  );
}

export function useTechAuth() {
  return useContext(TechAuthContext);
}
