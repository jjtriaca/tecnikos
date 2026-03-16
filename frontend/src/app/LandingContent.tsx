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

interface PioneerSlot {
  segment: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
}

/* ─── Helpers ─────────────────────────────────────────── */

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/* ─── Component ───────────────────────────────────────── */

export default function LandingContent() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [pioneerSlots, setPioneerSlots] = useState<PioneerSlot[]>([]);
  const [pioneerModal, setPioneerModal] = useState<PioneerSlot | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    track("landing_view");
    fetch("/api/public/saas/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("API error"))))
      .then(setPlans)
      .catch(() => setLoadError(true));
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

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Pioneer badge */}
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
            Ordens de servico, despacho, financeiro e automacao em uma unica plataforma
            para empresas de servicos tecnicos em campo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#precos"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-slate-900 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              Ver planos
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </a>
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

            {/* How it works */}
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
      {(plans.length > 0 || loadError) && (
        <section id="precos" className="py-20 sm:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Planos
              </h2>
              {loadError && plans.length === 0 ? (
                <p className="text-red-500 max-w-xl mx-auto mb-6">
                  Não foi possível carregar os planos. Tente novamente em alguns instantes.
                </p>
              ) : (
              <p className="text-slate-500 max-w-xl mx-auto mb-6">
                Sem taxa de adesao. Cancele quando quiser.
              </p>
              )}

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

                // Structured features from dedicated DB fields
                const structuredFeatures: string[] = [
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
                // Extra features from free-text field (filter out redundant ones already covered by structured fields)
                const skipPatterns = /tecnico|suporte|modulo|usuario|assistente|msgs? ia|\bos\b/i;
                const extraFeatures = (plan.features || []).filter((f: string) => !skipPatterns.test(f));
                const featureList = [...structuredFeatures, ...extraFeatures];

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
            <div className="text-center sm:text-right">
              <p className="text-xs text-slate-500">SLS Obras LTDA — CNPJ: 47.226.599/0001-40</p>
              <div className="flex items-center justify-center sm:justify-end gap-4 mt-1">
                <Link href="/privacy" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Politica de Privacidade</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-6 pt-4">
            <p className="text-xs text-slate-600 text-center">
              &copy; {new Date().getFullYear()} Tecnikos. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Pioneer Modal ─────────────────────────────────── */}
      {pioneerModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPioneerModal(null)}>
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Programa Pioneiro — {pioneerModal.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{pioneerModal.description}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Condicoes do Programa</h4>
              <ul className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
                <li>• Plano Essencial completo por R$ 15/mes durante 6 meses</li>
                <li>• Apos os 6 meses, o plano passa para o valor vigente do Essencial</li>
                <li>• A empresa se compromete a usar o sistema ativamente e reportar problemas</li>
                <li>• Apenas 1 vaga por segmento de atuacao</li>
                <li>• A vaga e pessoal e intransferivel</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPioneerModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Voltar
              </button>
              <Link
                href={`/signup?voucher=${pioneerModal.code}`}
                onClick={() => {
                  track("pioneer_accept", { segment: pioneerModal.segment, code: pioneerModal.code });
                  setPioneerModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold text-center hover:bg-amber-600 transition-colors"
              >
                Aceitar e criar conta
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
