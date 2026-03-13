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

export type UserRole = "ADMIN" | "DESPACHO" | "FINANCEIRO" | "FISCAL" | "LEITURA";

export type TenantStatus = "PENDING_VERIFICATION" | "PENDING_PAYMENT" | "ACTIVE" | "BLOCKED" | "CANCELLED" | "SUSPENDED";

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  companyId: string;
  companyName?: string;
  tenantStatus?: TenantStatus | null;
  verificationStatus?: VerificationStatus | null;
}

/** Check if user has ANY of the given roles */
export function hasRole(user: AuthUser | null | undefined, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return user.roles.some(r => roles.includes(r));
}

/** Check if verification is still pending (docs not yet approved) */
export function isVerificationPending(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  // No verification status means no session exists (e.g. master tenant)
  if (!user.verificationStatus) return false;
  return user.verificationStatus !== "APPROVED";
}

export interface VerificationInfo {
  status: string | null;  // PENDING | APPROVED | REJECTED
  rejectionReason: string | null;
  token: string | null;   // for re-upload redirect
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  verificationInfo: VerificationInfo | null;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type MeResponse = {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  companyId: string;
  company?: { id: string; name: string };
  tenantStatus?: TenantStatus | null;
  verificationStatus?: VerificationStatus | null;
};

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    roles: UserRole[];
    companyId: string;
  };
};

function mapUser(d: MeResponse): AuthUser {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    roles: d.roles,
    companyId: d.companyId,
    companyName: d.company?.name,
    tenantStatus: d.tenantStatus || null,
    verificationStatus: d.verificationStatus || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo | null>(null);
  const router = useRouter();

  // Fetch detailed verification info (rejection reason, token for re-upload)
  const fetchVerification = useCallback(async () => {
    try {
      const data = await api.get<any>("/public/saas/tenant-verification-status");
      if (data?.status) {
        setVerificationInfo({
          status: data.status,
          rejectionReason: data.rejectionReason || null,
          token: data.token || null,
        });
      }
    } catch { /* ignore */ }
  }, []);

  // On mount: try silent refresh → fetch user
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = await silentRefresh();
        if (!token || cancelled) return;

        const me = await api.get<MeResponse>("/auth/me");
        if (!cancelled) {
          const u = mapUser(me);
          setUser(u);
          // Fetch detailed verification info if not yet approved
          if (u.verificationStatus && u.verificationStatus !== "APPROVED") {
            fetchVerification();
          }
        }
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
  }, [fetchVerification]);

  const login = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      });
      setAccessToken(res.accessToken);

      // Fetch full user with company name + tenant status + verification status
      try {
        const me = await api.get<MeResponse>("/auth/me");
        const u = mapUser(me);
        setUser(u);
        if (u.verificationStatus && u.verificationStatus !== "APPROVED") {
          fetchVerification();
        }
      } catch {
        // fallback to login response data
        setUser({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          roles: res.user.roles,
          companyId: res.user.companyId,
        });
      }

      router.push("/dashboard");
    },
    [router, fetchVerification]
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

  const refreshVerification = useCallback(async () => {
    await fetchVerification();
    // Also refresh user data to get updated verificationStatus
    try {
      const me = await api.get<MeResponse>("/auth/me");
      setUser(mapUser(me));
    } catch { /* ignore */ }
  }, [fetchVerification]);

  const value = useMemo(
    () => ({ user, loading, verificationInfo, login, logout, refreshVerification }),
    [user, loading, verificationInfo, login, logout, refreshVerification]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
