"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isVerificationPending } from "@/contexts/AuthContext";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

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

          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
            tenantPending={pendingVerification}
          />
          <Header sidebarCollapsed={sidebarCollapsed} />

          {/* Main content */}
          <main
            data-main
            className={`pt-16 transition-all duration-300 ${
              sidebarCollapsed ? "ml-[68px]" : "ml-64"
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
