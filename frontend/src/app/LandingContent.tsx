"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/track";

/* ─── Types ───────────────────────────────────────────── */

interface PublicPlan {
  id: string;
  name: string;
  maxUsers: number;
  maxOsPerMonth: number;
  priceCents: number;
  priceYearlyCents: number | null;
  description: string | null;
  features: string[];
  maxTechnicians: number | null;
  maxAiMessages: number | null;
  supportLevel: string | null;
  allModulesIncluded: boolean | null;
}

interface PublicAddOn {
  id: string;
  name: string;
  description: string | null;
  osQuantity: number;
  priceCents: number;
}

interface PioneerSlot {
  segment: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
}

/* ─── Static Data ─────────────────────────────────────── */

const segments = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "Piscinas e Aquecedores",
    description: "Gestao de servicos de manutencao de piscinas, aquecedores solares, bombas e tratamento de agua.",
    tags: ["Piscinas", "Aquecedores", "Bombas"],
    pioneer: true,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
      </svg>
    ),
    title: "Telecomunicacoes",
    description: "Instalacao e manutencao de redes de internet, fibra optica, TV a cabo e telefonia para provedores e operadoras.",
    tags: ["Internet", "Fibra optica", "Telefonia"],
    pioneer: true,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
    title: "Energia Solar",
    description: "Acompanhe instalacoes de paineis fotovoltaicos, inversores e manutencoes preventivas de sistemas de energia limpa.",
    tags: ["Paineis solares", "Inversores", "Manutencao"],
    pioneer: true,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    title: "Seguranca Eletronica",
    description: "Controle instalacoes de cameras, alarmes, cercas eletricas e sistemas de controle de acesso patrimonial.",
    tags: ["CFTV", "Alarmes", "Controle de acesso"],
    pioneer: true,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    title: "Climatizacao",
    description: "Gerencie servicos de instalacao e manutencao de ar condicionado, refrigeracao industrial e sistemas de ventilacao.",
    tags: ["Ar condicionado", "Refrigeracao", "Ventilacao"],
    pioneer: true,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
      </svg>
    ),
    title: "Manutencao Predial",
    description: "Servicos de eletrica, hidraulica, pintura e reformas em condominios, empresas e edificacoes comerciais.",
    tags: ["Eletrica", "Hidraulica", "Reformas"],
    pioneer: false,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
      </svg>
    ),
    title: "TI e Informatica",
    description: "Suporte tecnico, manutencao de redes corporativas, servidores e estacoes de trabalho em campo.",
    tags: ["Suporte TI", "Redes", "Servidores"],
    pioneer: false,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    title: "Automacao e IoT",
    description: "Instalacao e manutencao de sistemas de automacao residencial, comercial e dispositivos IoT conectados.",
    tags: ["Smart home", "Automacao", "IoT"],
    pioneer: false,
  },
];

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
    title: "Ordens de Servico",
    description: "Crie, atribua e acompanhe ordens de servico em tempo real. Sistema de OS online com controle total do fluxo de trabalho e status automaticos.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    title: "Gestao de Tecnicos",
    description: "Atribua tecnicos por especialidade e regiao. Portal exclusivo do tecnico com acesso mobile para atualizar OS em campo em tempo real.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    title: "Controle Financeiro",
    description: "Gerencie contas a receber e a pagar por OS. Comissoes automaticas para tecnicos, relatorios financeiros e integracao com meios de pagamento.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    title: "Automacao Inteligente",
    description: "Crie regras automaticas para atribuicao de OS, notificacoes e mudancas de status. Workflow customizavel com regras de negocios visuais.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    title: "Emissao de NFS-e",
    description: "Emita notas fiscais de servico direto pelo sistema. Integracao com prefeituras, controle de impostos e escrituracao automatica.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: "Dashboard e Relatorios",
    description: "Indicadores de desempenho (KPIs), relatorios operacionais e financeiros. Visao completa da sua operacao em tempo real com graficos e metricas.",
  },
];

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/* ─── Component ───────────────────────────────────────── */

export default function LandingContent() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [addOns, setAddOns] = useState<PublicAddOn[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [pioneerSlots, setPioneerSlots] = useState<PioneerSlot[]>([]);
  const [pioneerModal, setPioneerModal] = useState<PioneerSlot | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    track("landing_view");
    fetch("/api/public/saas/plans")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPlans)
      .catch(() => {});
    fetch("/api/public/saas/addons")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAddOns)
      .catch(() => {});
    fetch("/api/public/saas/pioneer-slots")
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d) => setPioneerSlots(d.slots || []))
      .catch(() => {});
  }, []);

  const availableSlots = pioneerSlots.filter((s) => s.available).length;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900">Tecnikos</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-5">
            <a href="#segmentos" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Segmentos</a>
            <a href="#funcionalidades" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Funcionalidades</a>
            {availableSlots > 0 && (
              <a href="#pioneiro" className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">Pioneiro</a>
            )}
            {plans.length > 0 && (
              <a href="#precos" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Planos</a>
            )}
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
              Cadastre-se
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="sm:hidden p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {mobileMenu ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenu && (
          <div className="sm:hidden bg-white border-t border-slate-100 px-4 py-3 space-y-2">
            <a href="#segmentos" onClick={() => setMobileMenu(false)} className="block py-2 text-sm font-medium text-slate-600">Segmentos</a>
            <a href="#funcionalidades" onClick={() => setMobileMenu(false)} className="block py-2 text-sm font-medium text-slate-600">Funcionalidades</a>
            {availableSlots > 0 && (
              <a href="#pioneiro" onClick={() => setMobileMenu(false)} className="block py-2 text-sm font-medium text-amber-600">Programa Pioneiro</a>
            )}
            {plans.length > 0 && (
              <a href="#precos" onClick={() => setMobileMenu(false)} className="block py-2 text-sm font-medium text-slate-600">Planos</a>
            )}
            <Link href="/signup" onClick={() => setMobileMenu(false)} className="block py-2 text-sm font-semibold text-blue-600">Cadastre-se</Link>
          </div>
        )}
      </header>

      {/* ── Hero Section ───────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Beta banner */}
          <div className="inline-flex items-start gap-3 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-400/20 mb-6 text-left max-w-2xl">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
            </svg>
            <div>
              <span className="text-sm font-semibold text-amber-300">Sistema em fase Beta</span>
              <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                O Tecnikos esta em desenvolvimento ativo. Algumas funcionalidades podem apresentar instabilidades,
                mas nossa equipe trabalha diariamente para aprimorar a plataforma e resolver qualquer problema com agilidade.
              </p>
            </div>
          </div>

          {/* Pioneer badge — clickable, scrolls to #pioneiro */}
          {availableSlots > 0 && (
            <a
              href="#pioneiro"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/25 mb-6 hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span className="text-sm text-amber-200 font-medium">
                Programa Pioneiro — {availableSlots} vaga{availableSlots !== 1 ? "s" : ""} disponive{availableSlots !== 1 ? "is" : "l"}
              </span>
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </a>
          )}

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Gestao inteligente de{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              servicos tecnicos
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Sistema completo para empresas de telecomunicacoes, climatizacao, energia solar,
            seguranca eletronica e outros servicos tecnicos em campo. Ordens de servico,
            despacho, financeiro e automacao em uma unica plataforma.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {plans.length > 0 ? (
              <a
                href="#precos"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-slate-900 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                Ver planos e precos
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </a>
            ) : (
              <a
                href="#funcionalidades"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-slate-900 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                Conhecer funcionalidades
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </a>
            )}
            <a
              href="#precos"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600/20 text-white font-semibold border border-blue-400/30 hover:bg-blue-600/30 transition-all duration-200"
            >
              Ver planos
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── Segments Section ───────────────────────────────── */}
      <section id="segmentos" className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
              Segmentos de Atuacao
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Para todos os tipos de servico tecnico em campo
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              O Tecnikos foi projetado para atender diferentes segmentos da industria de servicos tecnicos.
              Independente do seu ramo de atuacao, nossa plataforma se adapta ao seu fluxo de trabalho.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {segments.map((seg, i) => (
              <div
                key={i}
                className={`group rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-1 ${
                  seg.pioneer
                    ? "bg-white border-amber-200 hover:border-amber-300 hover:shadow-md shadow-sm"
                    : "bg-white border-slate-100 hover:border-blue-100 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-300 ${
                  seg.pioneer
                    ? "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
                    : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                }`}>
                  {seg.icon}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{seg.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">{seg.description}</p>
                <div className="flex flex-wrap gap-1">
                  {seg.tags.map((tag) => (
                    <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{tag}</span>
                  ))}
                </div>
                {seg.pioneer && (
                  <div className="mt-2">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                      Vaga Pioneiro
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ───────────────────────────────── */}
      <section id="funcionalidades" className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
              Funcionalidades
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Tudo que sua empresa precisa para gerenciar servicos
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Do despacho ao financeiro, automatize toda a operacao de servicos tecnicos da sua empresa com um sistema completo de gestao.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center mb-5 group-hover:from-blue-600 group-hover:to-blue-700 group-hover:text-white transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pioneer Program Section ────────────────────────── */}
      {pioneerSlots.length > 0 && (
        <section id="pioneiro" className="py-20 sm:py-28 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/25 mb-6">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                <span className="text-sm text-amber-200 font-semibold">Programa Pioneiro</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Seja um dos primeiros
              </h2>
              <p className="text-slate-300 max-w-2xl mx-auto leading-relaxed mb-2">
                Estamos selecionando <strong className="text-white">5 empresas pioneiras</strong> de segmentos distintos
                para nos ajudar a aprimorar o Tecnikos com uso real. Em troca, oferecemos acesso completo
                a plataforma por um valor simbolico nos primeiros meses.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <span className="text-4xl font-bold text-amber-400">R$ 15</span>
                <span className="text-slate-400 text-sm text-left">/mes por<br />6 meses</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Apos os 6 meses, o plano passa para o valor normal vigente</p>
            </div>

            {/* Explanatory text */}
            <div className="max-w-3xl mx-auto mb-8 bg-white/5 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-2">Como funciona?</h3>
              <ul className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
                <li className="flex gap-2"><span className="text-amber-400 mt-0.5">1.</span>Escolha a vaga do seu segmento de atuacao abaixo</li>
                <li className="flex gap-2"><span className="text-amber-400 mt-0.5">2.</span>Leia e aceite as condicoes do Programa Pioneiro</li>
                <li className="flex gap-2"><span className="text-amber-400 mt-0.5">3.</span>Crie sua conta com o voucher de desconto aplicado automaticamente</li>
                <li className="flex gap-2"><span className="text-amber-400 mt-0.5">4.</span>Pague apenas <strong className="text-white">R$ 15/mes</strong> nos primeiros 6 meses (plano Essencial completo)</li>
                <li className="flex gap-2"><span className="text-amber-400 mt-0.5">5.</span>Use o sistema, reporte problemas e ajude a moldar a plataforma para seu segmento</li>
              </ul>
            </div>

            {/* Pioneer slots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {pioneerSlots.map((slot) => (
                <div
                  key={slot.segment}
                  className={`rounded-xl p-5 border transition-all ${
                    slot.available
                      ? "bg-white/5 border-amber-400/30 hover:bg-white/10"
                      : "bg-white/[0.02] border-slate-700 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-sm font-bold ${slot.available ? "text-white" : "text-slate-500"}`}>
                      {slot.name}
                    </h3>
                    {slot.available ? (
                      <span className="text-[10px] font-bold text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">
                        Disponivel
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-700 rounded-full px-2 py-0.5">
                        Preenchida
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mb-4 ${slot.available ? "text-slate-400" : "text-slate-600"}`}>
                    {slot.description}
                  </p>
                  {slot.available ? (
                    <button
                      onClick={() => { setPioneerModal(slot); track("pioneer_click", { segment: slot.segment }); }}
                      className="w-full py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
                    >
                      Quero participar
                    </button>
                  ) : (
                    <div className="w-full py-2 rounded-lg bg-slate-800 text-slate-500 text-sm font-semibold text-center">
                      Vaga preenchida
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <p className="text-xs text-slate-500">
                {availableSlots} de 5 vagas disponiveis — uma por segmento de atuacao
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Pricing Section ─────────────────────────────────── */}
      {plans.length > 0 && (
        <section id="precos" className="py-20 sm:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-wider mb-4">
                Planos e Precos
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Escolha o plano ideal para sua empresa
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto mb-4">
                Todos os planos incluem acesso completo a plataforma. Sem taxa de adesao, cancele quando quiser.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Tecnicos ilimitados em todos os planos
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
                  1o mes com 50% OFF
                </span>
              </div>

              {/* Billing Toggle */}
              {plans.some((p) => p.priceYearlyCents) && (
                <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                      billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                      billingCycle === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Anual
                    <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold">Economia</span>
                  </button>
                </div>
              )}
            </div>

            <div className={`grid gap-6 ${plans.length === 1 ? "max-w-md mx-auto" : plans.length === 2 ? "sm:grid-cols-2 max-w-3xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
              {plans.map((plan, i) => {
                const isPopular = i === 1 && plans.length >= 2;
                const monthlyCents = plan.priceCents;
                const yearlyCents = plan.priceYearlyCents;
                const showYearly = billingCycle === "yearly" && yearlyCents;
                const displayPrice = showYearly ? yearlyCents / 12 : monthlyCents;
                const savings = yearlyCents ? Math.round(((monthlyCents * 12 - yearlyCents) / (monthlyCents * 12)) * 100) : 0;
                const featureList: string[] = [
                  plan.maxUsers >= 999 ? "Usuarios ilimitados" : `Ate ${plan.maxUsers} usuario${plan.maxUsers !== 1 ? "s" : ""} gestores`,
                  plan.maxOsPerMonth === 0 ? "OS ilimitadas" : `${plan.maxOsPerMonth} OS/mes`,
                  plan.maxTechnicians === 0 || plan.maxTechnicians == null
                    ? "Tecnicos ilimitados"
                    : `${plan.maxTechnicians} tecnico${plan.maxTechnicians !== 1 ? "s" : ""}`,
                  plan.maxAiMessages != null && plan.maxAiMessages > 0
                    ? `Assistente IA (${plan.maxAiMessages} msgs/mes)`
                    : "Assistente IA",
                  plan.allModulesIncluded !== false ? "Todos os modulos inclusos" : "",
                  plan.supportLevel === "PRIORITY" ? "Suporte prioritario"
                    : plan.supportLevel === "EMAIL_CHAT" ? "Suporte por e-mail e chat"
                    : "Suporte por e-mail",
                ].filter(Boolean);

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl p-8 transition-all ${
                      isPopular
                        ? "bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-600/20 scale-[1.02]"
                        : "bg-white border border-slate-200 hover:border-blue-200 hover:shadow-lg"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-amber-400 text-amber-900 px-4 py-1 text-xs font-bold shadow-md">Mais popular</span>
                      </div>
                    )}
                    <h3 className={`text-xl font-bold mb-1 ${isPopular ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                    {plan.description && <p className={`text-sm mb-6 ${isPopular ? "text-blue-100" : "text-slate-500"}`}>{plan.description}</p>}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-bold ${isPopular ? "text-white" : "text-slate-900"}`}>{formatBRL(displayPrice)}</span>
                        <span className={`text-sm ${isPopular ? "text-blue-200" : "text-slate-400"}`}>/mes</span>
                      </div>
                      {showYearly && savings > 0 && (
                        <div className={`mt-1 text-xs ${isPopular ? "text-blue-200" : "text-green-600"}`}>
                          {formatBRL(yearlyCents)}/ano — {savings}% de economia
                        </div>
                      )}
                      <div className={`mt-2 inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${isPopular ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        1o mes por {formatBRL(Math.round(monthlyCents * 0.5))}
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {featureList.map((feat, fi) => (
                        <li key={fi} className="flex items-center gap-2.5 text-sm">
                          <svg className={`w-4 h-4 flex-shrink-0 ${isPopular ? "text-blue-200" : "text-green-500"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          <span className={isPopular ? "text-blue-50" : "text-slate-600"}>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/signup?plan=${plan.id}&cycle=${billingCycle}`}
                      onClick={() => track("landing_click_plan", { planId: plan.id, planName: plan.name })}
                      className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                        isPopular
                          ? "bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20"
                      }`}
                    >
                      Comecar agora
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Add-ons */}
            {addOns.length > 0 && (
              <div className="mt-14 max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Precisa de mais?</h3>
                  <p className="text-sm text-slate-500">Adicione pacotes extras ao seu plano a qualquer momento</p>
                </div>
                <div className={`grid grid-cols-2 ${addOns.length >= 4 ? "sm:grid-cols-4" : addOns.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
                  {addOns.map((addon) => (
                    <div key={addon.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                      <span className="block text-sm font-semibold text-slate-700 mb-1">{addon.name}</span>
                      <span className="block text-lg font-bold text-blue-600">{formatBRL(addon.priceCents)}</span>
                      <span className="block text-[10px] text-slate-400">/mes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Voucher hint */}
            <div className="text-center mt-8">
              <p className="text-sm text-slate-400">
                Possui um codigo de acesso?{" "}
                <Link href="/signup" className="text-blue-600 font-medium hover:underline">Use seu voucher aqui</Link>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Section ──────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-10 sm:p-14 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Pronto para transformar sua operacao?
              </h2>
              <p className="text-slate-300 mb-8 max-w-lg mx-auto leading-relaxed">
                Junte-se as empresas que estao ajudando a construir o futuro da gestao
                de servicos tecnicos. Comece em minutos, sem burocracia.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  onClick={() => track("landing_click_signup")}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Comecar agora
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                {availableSlots > 0 && (
                  <a
                    href="#pioneiro"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-amber-500/20 text-amber-300 font-semibold border border-amber-400/30 hover:bg-amber-500/30 transition-all duration-200"
                  >
                    Programa Pioneiro
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            {/* Col 1: Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-slate-300">Tecnikos</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sistema de gestao de servicos tecnicos em campo. Software de ordens de servico, despacho de equipes e controle financeiro para empresas de todos os portes.
              </p>
            </div>

            {/* Col 2: Links */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Navegacao</h4>
              <div className="space-y-2">
                <a href="#segmentos" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Segmentos</a>
                <a href="#funcionalidades" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Funcionalidades</a>
                <a href="#precos" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Planos e Precos</a>
                <Link href="/privacy" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Politica de Privacidade</Link>
              </div>
            </div>

            {/* Col 3: Company */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Empresa</h4>
              <p className="text-sm text-slate-500">SLS Obras LTDA</p>
              <p className="text-xs text-slate-600 mt-1">CNPJ: 47.226.599/0001-40</p>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <p className="text-xs text-slate-600 text-center">
              &copy; 2026 SLS Obras LTDA — Todos os direitos reservados
            </p>
          </div>
        </div>
      </footer>

      {/* ── Pioneer Conditions Modal ─────────────────────────── */}
      {pioneerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPioneerModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Programa Pioneiro</h2>
                  <p className="text-sm text-slate-500">{pioneerModal.name}</p>
                </div>
                <button onClick={() => setPioneerModal(null)} className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                  </svg>
                  <span className="font-bold text-amber-900">R$ 15/mes por 6 meses</span>
                </div>
                <p className="text-sm text-amber-800">
                  Valor simbolico para empresas parceiras que nos ajudam a aprimorar a plataforma.
                  Apos os 6 meses, o plano passa para o valor normal vigente.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Condicoes de participacao</h3>
                <div className="space-y-3">
                  {[
                    "O sistema esta em fase Beta e pode apresentar bugs ou instabilidades. Nossa equipe se compromete a corrigir com agilidade.",
                    "Esperamos feedback ativo sobre problemas encontrados para que possamos aprimorar a plataforma rapidamente.",
                    "Voce tera suporte prioritario com acesso direto a equipe de desenvolvimento.",
                    "Sua empresa ajudara a moldar o sistema para o segmento de " + pioneerModal.name.toLowerCase() + ".",
                    "Apos o periodo de 6 meses, a assinatura sera renovada pelo valor normal do plano escolhido.",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <p className="text-sm text-slate-600">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPioneerModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Voltar
                </button>
                <Link
                  href={`/signup?voucher=${pioneerModal.code}`}
                  onClick={() => track("pioneer_accept", { segment: pioneerModal.segment, code: pioneerModal.code })}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold text-center hover:bg-amber-600 transition-colors"
                >
                  Aceitar e criar minha conta
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
