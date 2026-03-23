"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, isVerificationPending, isAdminHost } from "@/contexts/AuthContext";
import { FiscalModuleProvider } from "@/contexts/FiscalModuleContext";
import { ChatIAProvider } from "@/contexts/ChatIAContext";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ChatIAPanel from "@/components/chat-ia/ChatIAPanel";
import VerificationBanner from "./VerificationBanner";
import BillingBanner from "./BillingBanner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarMouseEnter = useCallback(() => {
    if (!sidebarCollapsed) return;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverExpanded(true);
  }, [sidebarCollapsed]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (!sidebarCollapsed) return;
    hoverTimeout.current = setTimeout(() => setHoverExpanded(false), 1500);
  }, [sidebarCollapsed]);

  // Effective collapsed state: collapsed by user but temporarily expanded by hover
  const effectiveCollapsed = sidebarCollapsed && !hoverExpanded;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // Admin host: redirect from /dashboard to /ctrl-zr8k2x
  useEffect(() => {
    if (!loading && user && isAdminHost(user) && pathname === "/dashboard") {
      router.replace("/ctrl-zr8k2x");
    }
  }, [loading, user, pathname, router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Restrict features when docs not yet approved (works for ACTIVE tenants too)
  const pendingVerification = isVerificationPending(user);

  return (
    <FiscalModuleProvider>
      <ChatIAProvider>
        <div className="min-h-screen bg-slate-50">
          {/* Verification status banner — shows when docs are pending/rejected */}
          <VerificationBanner />
          {/* Billing warning banner — overdue, due today, blocked */}
          <BillingBanner />

          <div
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
          >
            <Sidebar
              collapsed={effectiveCollapsed}
              onToggle={() => { setSidebarCollapsed((c) => !c); setHoverExpanded(false); }}
              tenantPending={pendingVerification}
            />
          </div>
          <Header sidebarCollapsed={effectiveCollapsed} />

          {/* Main content */}
          <main
            data-main
            className={`pt-16 transition-all duration-300 ${
              effectiveCollapsed ? "ml-[68px]" : "ml-64"
            }`}
          >
            <div className="p-6">{children}</div>
          </main>

          {/* Chat IA floating panel */}
          <ChatIAPanel />
        </div>
      </ChatIAProvider>
    </FiscalModuleProvider>
  );
}
