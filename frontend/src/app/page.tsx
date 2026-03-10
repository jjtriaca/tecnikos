"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PublicPlan {
  id: string;
  name: string;
  maxUsers: number;
  maxOsPerMonth: number;
  priceCents: number;
  priceYearlyCents: number | null;
  description: string | null;
  features: string[];
}

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
    title: "Ordens de Servico",
    description: "Crie, atribua e acompanhe ordens de servico em tempo real. Controle total do fluxo de trabalho com status automaticos.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    title: "Gestao de Tecnicos",
    description: "Atribua tecnicos por especialidade e regiao. Portal exclusivo do tecnico com acesso mobile para atualizar OS em campo.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    title: "Controle Financeiro",
    description: "Gerencie recebiveis e pagaveis por OS. Comissoes automaticas, relatorios financeiros e integracao com pagamentos.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    title: "Automacao Inteligente",
    description: "Crie regras automaticas para atribuicao de OS, notificacoes e mudancas de status. Workflow visual drag-and-drop.",
  },
];

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function LandingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/public/saas/plans")
      .then((r) => r.ok ? r.json() : [])
      .then(setPlans)
      .catch(() => {});
  }, []);

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

          <div className="flex items-center gap-3">
            {plans.length > 0 && (
              <a href="#precos" className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                Planos
              </a>
            )}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-sm text-blue-200 font-medium">Vagas abertas para novas empresas</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Gestao inteligente de{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              servicos tecnicos
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Plataforma completa para empresas que gerenciam equipes de tecnicos em campo.
            Ordens de servico, despacho, financeiro e automacao em um so lugar.
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
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600/20 text-white font-semibold border border-blue-400/30 hover:bg-blue-600/30 transition-all duration-200"
            >
              Ja sou cliente
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
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
              Tudo que sua empresa precisa
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Do despacho ao financeiro, automatize toda a operacao de servicos tecnicos da sua empresa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
              {plans.some(p => p.priceYearlyCents) && (
                <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                      billingCycle === "monthly"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                      billingCycle === "yearly"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Anual
                    <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold">
                      Economia
                    </span>
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

                const defaultFeatures = [
                  `Ate ${plan.maxUsers} usuario${plan.maxUsers !== 1 ? "s" : ""}`,
                  plan.maxOsPerMonth === 0 ? "OS ilimitadas" : `${plan.maxOsPerMonth} OS/mes`,
                  "Todos os modulos",
                  "Suporte por chat",
                ];
                const featureList = plan.features.length > 0 ? plan.features : defaultFeatures;

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
                        <span className="rounded-full bg-amber-400 text-amber-900 px-4 py-1 text-xs font-bold shadow-md">
                          Mais popular
                        </span>
                      </div>
                    )}

                    <h3 className={`text-xl font-bold mb-1 ${isPopular ? "text-white" : "text-slate-900"}`}>
                      {plan.name}
                    </h3>
                    {plan.description && (
                      <p className={`text-sm mb-6 ${isPopular ? "text-blue-100" : "text-slate-500"}`}>
                        {plan.description}
                      </p>
                    )}

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-bold ${isPopular ? "text-white" : "text-slate-900"}`}>
                          {formatBRL(displayPrice)}
                        </span>
                        <span className={`text-sm ${isPopular ? "text-blue-200" : "text-slate-400"}`}>/mes</span>
                      </div>
                      {showYearly && savings > 0 && (
                        <div className={`mt-1 text-xs ${isPopular ? "text-blue-200" : "text-green-600"}`}>
                          {formatBRL(yearlyCents)}/ano — {savings}% de economia
                        </div>
                      )}
                      {showYearly && !yearlyCents && (
                        <div className={`mt-1 text-xs ${isPopular ? "text-blue-200" : "text-slate-400"}`}>
                          Cobrado mensalmente
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

            {/* Voucher hint */}
            <div className="text-center mt-8">
              <p className="text-sm text-slate-400">
                Possui um codigo de acesso?{" "}
                <Link href="/signup" className="text-blue-600 font-medium hover:underline">
                  Use seu voucher aqui
                </Link>
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
                Junte-se a empresas que ja automatizam seus servicos tecnicos com o Tecnikos.
                Comece em minutos, sem burocracia.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Comecar agora
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-10 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-300">Tecnikos</span>
            </div>
            <p className="text-sm text-slate-500">
              &copy; 2026 SLS Obras LTDA &mdash; Todos os direitos reservados
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
