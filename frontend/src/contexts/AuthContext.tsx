"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, setAccessToken, silentRefresh } from "@/lib/api";

export type UserRole = "ADMIN" | "DESPACHO" | "FINANCEIRO" | "LEITURA";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type MeResponse = AuthUser & { company?: { id: string; name: string } };

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    companyId: string;
  };
};

function mapUser(d: MeResponse): AuthUser {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    role: d.role,
    companyId: d.companyId,
    companyName: d.company?.name,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount: try silent refresh → fetch user
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = await silentRefresh();
        if (!token || cancelled) return;

        const me = await api.get<MeResponse>("/auth/me");
        if (!cancelled) setUser(mapUser(me));
      } catch {
        // not logged in
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe?: boolean) => {
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
        rememberMe,
      });
      setAccessToken(res.accessToken);

      // Fetch full user with company name
      try {
        const me = await api.get<MeResponse>("/auth/me");
        setUser(mapUser(me));
      } catch {
        // fallback to login response data
        setUser({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          companyId: res.user.companyId,
        });
      }

      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
