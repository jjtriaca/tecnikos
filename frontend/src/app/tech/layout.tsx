"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TechAuthProvider, useTechAuth } from "@/contexts/TechAuthContext";
import Link from "next/link";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

/* ── Bottom Nav Icons ──────────────────────────────────── */

function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-6 w-6 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-6 w-6 ${active ? "text-blue-600" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

/* ── Inner Layout (with auth check) ────────────────────── */

function TechInnerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useTechAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/tech/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/tech/login");
    }
  }, [loading, user, isLoginPage, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Login page: no chrome
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not authenticated
  if (!user) return null;

  const navItems = [
    { href: "/tech/orders", label: "Minhas OS", Icon: OrdersIcon },
    { href: "/tech/profile", label: "Perfil", Icon: ProfileIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-800">Tecnikos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-slate-500">{user.name.split(" ")[0]}</span>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-4">{children}</main>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-sm safe-bottom">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <Icon active={active} />
              <span className={`text-[10px] font-medium ${active ? "text-blue-600" : "text-slate-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Root Layout ───────────────────────────────────────── */

export default function TechLayout({ children }: { children: React.ReactNode }) {
  return (
    <TechAuthProvider>
      <TechInnerLayout>{children}</TechInnerLayout>
    </TechAuthProvider>
  );
}
