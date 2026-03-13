"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuth, UserRole, isAdminHost } from "@/contexts/AuthContext";
import { useFiscalModule } from "@/contexts/FiscalModuleContext";
import { api } from "@/lib/api";
import UsageBar from "./UsageBar";

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  children?: NavChild[];
  requiresFiscal?: boolean;
  hidden?: boolean; // Only visible when user is already on this path
}

/* ── SVG Icons (clean, Bling-like) ─────────────────────── */

const icons = {
  dashboard: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  orders: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  technicians: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  finance: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  workflow: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  notifications: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  partners: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  automation: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  whatsapp: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  products: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  agenda: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  ),
  nfe: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  fiscal: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  saas: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
    </svg>
  ),
  quotes: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  ),
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: icons.dashboard, roles: ["ADMIN", "DESPACHO", "FINANCEIRO", "FISCAL", "LEITURA"] },
  { label: "Ordens de Serviço", href: "/orders", icon: icons.orders, roles: ["ADMIN", "DESPACHO", "LEITURA"] },
  { label: "Orçamentos", href: "/quotes", icon: icons.quotes, roles: ["ADMIN", "DESPACHO", "LEITURA"] },
  { label: "Cadastros", href: "/partners", icon: icons.partners, roles: ["ADMIN", "DESPACHO"], children: [
    { label: "Parceiros", href: "/partners" },
    { label: "Produtos", href: "/products" },
    { label: "Serviços", href: "/services" },
  ] },
  { label: "Finanças", href: "/finance", icon: icons.finance, roles: ["ADMIN", "FINANCEIRO", "LEITURA"], children: [
    { label: "Financeiro", href: "/finance" },
    { label: "Resultados", href: "/results" },
    { label: "Relatórios", href: "/reports" },
  ] },
  { label: "Fiscal", href: "/nfe", icon: icons.nfe, roles: ["ADMIN", "FISCAL", "FINANCEIRO"], requiresFiscal: true, children: [
    { label: "NFe Entrada", href: "/nfe" },
    { label: "NFS-e Entrada", href: "/nfe/entrada" },
    { label: "NFS-e Saída", href: "/nfe/saida" },
    { label: "Escrituração", href: "/fiscal" },
    { label: "Livro de Entradas", href: "/fiscal/livro-entradas" },
    { label: "Serviços Tomados", href: "/fiscal/servicos-tomados" },
    { label: "Geração SPED", href: "/fiscal/sped" },
  ] },
  { label: "Configurações", href: "/settings", icon: icons.settings, roles: ["ADMIN", "DESPACHO", "FISCAL"], children: [
    { label: "Geral", href: "/settings" },
    { label: "Assinatura", href: "/settings/billing" },
    { label: "Dispositivos", href: "/settings/devices" },
    { label: "Usuários", href: "/users" },
    { label: "Fluxo de Atendimento", href: "/workflow" },
    { label: "Notificações", href: "/notifications" },
  ] },
  { label: "SaaS Admin", href: "/ctrl-zr8k2x", icon: icons.saas, roles: ["ADMIN"], hidden: true, children: [
    { label: "Dashboard SaaS", href: "/ctrl-zr8k2x" },
    { label: "Empresas", href: "/ctrl-zr8k2x/tenants" },
    { label: "Planos", href: "/ctrl-zr8k2x/plans" },
    { label: "Pacotes Add-on", href: "/ctrl-zr8k2x/addons" },
    { label: "Promoções", href: "/ctrl-zr8k2x/promotions" },
  ] },
];

// Routes allowed when tenant is PENDING_VERIFICATION (settings, dashboard, etc.)
const ALLOWED_WHEN_PENDING = new Set([
  "/dashboard",
  "/settings",
  "/settings/billing",
  "/settings/devices",
  "/settings/email",
  "/settings/fiscal",
  "/settings/whatsapp",
  "/users",
  "/workflow",
  "/notifications",
]);

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  tenantPending?: boolean;
}

export default function Sidebar({ collapsed, onToggle, tenantPending }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { fiscalEnabled } = useFiscalModule();
  const [buildInfo, setBuildInfo] = useState<{ version: string } | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setBuildInfo({ version: d.version }))
      .catch(() => {});
  }, []);

  // Auto-expand parent menus when a child route is active
  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.children && item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
        setExpandedMenus((prev) => new Set(prev).add(item.href));
      }
    });
  }, [pathname]);

  const toggleMenu = (href: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const isAdmin = isAdminHost(user);
  const isSaasAdmin = isAdmin || pathname.startsWith("/ctrl-zr8k2x");

  // Unread signup attempts badge
  const [unreadAttempts, setUnreadAttempts] = useState(0);
  const fetchUnread = useCallback(() => {
    if (!user || !user.roles.includes("ADMIN")) return;
    api.get<{ count: number }>("/admin/tenants/signup-attempts/unread-count")
      .then((d) => setUnreadAttempts(d.count))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // When on SaaS admin path, show only SaaS items as top-level nav
  const SAAS_NAV: NavItem[] = [
    { label: "Dashboard SaaS", href: "/ctrl-zr8k2x", icon: icons.dashboard, roles: ["ADMIN"] },
    { label: "Empresas", href: "/ctrl-zr8k2x/tenants", icon: icons.partners, roles: ["ADMIN"] },
    { label: "Notas Fiscais", href: "/ctrl-zr8k2x/invoices", icon: icons.finance, roles: ["ADMIN"] },
    { label: "Planos", href: "/ctrl-zr8k2x/plans", icon: icons.finance, roles: ["ADMIN"] },
    { label: "Pacotes Add-on", href: "/ctrl-zr8k2x/addons", icon: icons.automation, roles: ["ADMIN"] },
    { label: "Promocoes", href: "/ctrl-zr8k2x/promotions", icon: icons.automation, roles: ["ADMIN"] },
    { label: "Tentativas", href: "/ctrl-zr8k2x/signup-attempts", icon: icons.users, roles: ["ADMIN"] },
    { label: "Voltar ao sistema", href: "/dashboard", icon: icons.workflow, roles: ["ADMIN"] },
  ];

  const visibleItems = isSaasAdmin
    ? SAAS_NAV.filter((item) => user && item.roles.some(r => user.roles.includes(r)))
    : NAV_ITEMS.filter(
        (item) => user && item.roles.some(r => user.roles.includes(r)) && (!item.requiresFiscal || fiscalEnabled) && !item.hidden
      );

  return (
    <aside
      data-sidebar
      className={`fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="Tecnikos" className="h-8 w-8" />
            <span className="text-base font-bold tracking-tight">
              Tecnikos
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <svg
            className={`h-4.5 w-4.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-3 flex flex-col gap-0.5 px-3">
        {visibleItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedMenus.has(item.href);
          const isParentActive = hasChildren
            ? item.children!.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))
            : false;
          const isActive = !hasChildren && (
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          );

          // Check if this item is disabled due to pending verification
          const isParentAllowed = hasChildren
            ? item.children!.some((c) => ALLOWED_WHEN_PENDING.has(c.href))
            : ALLOWED_WHEN_PENDING.has(item.href);
          const isDisabled = tenantPending && !isParentAllowed;

          if (hasChildren) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => {
                    if (isDisabled) return;
                    if (!collapsed) toggleMenu(item.href);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                    isDisabled
                      ? "text-slate-600 cursor-not-allowed opacity-50"
                      : isParentActive
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                  title={collapsed ? item.label : isDisabled ? "Disponível após validação dos documentos" : undefined}
                >
                  <span className="flex-shrink-0 opacity-90">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {isDisabled ? (
                        <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      ) : (
                        <svg
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </>
                  )}
                </button>
                {!collapsed && isExpanded && !isDisabled && (
                  <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                    {item.children!.map((child) => {
                      const isChildActive = child.href === item.href
                        ? pathname === child.href
                        : (pathname === child.href || pathname.startsWith(child.href + "/"));
                      const isChildDisabled = tenantPending && !ALLOWED_WHEN_PENDING.has(child.href);
                      if (isChildDisabled) {
                        return (
                          <span
                            key={child.href}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-slate-600 opacity-50 cursor-not-allowed"
                          >
                            <span className="truncate">{child.label}</span>
                          </span>
                        );
                      }
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-all duration-200 ${
                            isChildActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (isDisabled) {
            return (
              <span
                key={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 cursor-not-allowed opacity-50"
                title={collapsed ? item.label : "Disponível após validação dos documentos"}
              >
                <span className="flex-shrink-0 opacity-90">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </>
                )}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0 opacity-90">{item.icon}</span>
              {!collapsed && <span className="truncate flex-1">{item.label}</span>}
              {!collapsed && item.href === "/ctrl-zr8k2x/signup-attempts" && unreadAttempts > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadAttempts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Usage bar + User info + version at bottom */}
      {user && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3">
          <UsageBar collapsed={collapsed} />
          {!collapsed ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold flex-shrink-0 shadow-lg shadow-blue-600/20">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.roles.join(", ")}</p>
                </div>
              </div>
              {buildInfo && (
                <p className="mt-2 text-center text-[10px] text-slate-600">
                  v{buildInfo.version}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold shadow-lg shadow-blue-600/20">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              {buildInfo && (
                <p className="text-[9px] text-slate-600">v{buildInfo.version}</p>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
