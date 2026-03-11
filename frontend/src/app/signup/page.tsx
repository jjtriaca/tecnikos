"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  maxUsers: number;
  maxOsPerMonth: number;
  priceCents: number;
  priceYearlyCents: number | null;
  description: string | null;
  features: string[];
}

interface PromoValidation {
  valid: boolean;
  reason?: string;
  name?: string;
  discountPercent?: number;
  discountCents?: number;
  durationMonths?: number;
  skipPayment?: boolean;
  applicablePlans?: string[];
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Convert File to base64 data URI */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SignupPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" /></div>}>
      <SignupPage />
    </Suspense>
  );
}

function SignupPage() {
  const searchParams = useSearchParams();
  const totalSteps = 5;
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [promoCode, setPromoCode] = useState("");
  const [promoValid, setPromoValid] = useState<PromoValidation | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Company form
  const [form, setForm] = useState({
    slug: "", name: "", cnpj: "",
    responsibleName: "", responsibleEmail: "", responsiblePhone: "",
  });
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  // Payment form
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [cardForm, setCardForm] = useState({
    holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "",
    cpfCnpj: "", postalCode: "", addressNumber: "",
  });

  // CNPJ lookup
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjData, setCnpjData] = useState<{ found: boolean; razaoSocial?: string; nomeFantasia?: string; email?: string; telefone?: string; reason?: string } | null>(null);

  // Identity verification (step 3)
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    approved: boolean;
    skipped?: boolean;
    documentType?: string;
    livenessScore?: number;
    faceMatchScore?: number;
    reasons?: string[];
    ocrFields?: Record<string, string>;
    qsaValidation?: { validated: boolean; socioNome?: string; message?: string };
    error?: string;
  } | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; slug?: string; skipPayment?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/saas/plans")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Plan[]) => {
        setPlans(data);
        const planFromUrl = searchParams.get("plan");
        const cycleFromUrl = searchParams.get("cycle");
        if (planFromUrl && data.some((p: Plan) => p.id === planFromUrl)) {
          setSelectedPlanId(planFromUrl);
        }
        if (cycleFromUrl === "yearly") setBillingCycle("yearly");
      })
      .catch(() => {});
  }, [searchParams]);

  // Check slug availability with debounce
  const checkSlug = useCallback(async (slug: string) => {
    if (slug.length < 3) { setSlugAvailable(null); return; }
    setSlugChecking(true);
    try {
      const r = await fetch(`/api/public/saas/check-slug?slug=${encodeURIComponent(slug)}`);
      const data = await r.json();
      setSlugAvailable(data.available);
    } catch { setSlugAvailable(null); }
    finally { setSlugChecking(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (form.slug.length >= 3) checkSlug(form.slug); }, 500);
    return () => clearTimeout(timer);
  }, [form.slug, checkSlug]);

  // Validate promo code
  async function validatePromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const r = await fetch(`/api/public/saas/validate-code?code=${encodeURIComponent(promoCode.trim())}`);
      const data: PromoValidation = await r.json();
      setPromoValid(data);
    } catch { setPromoValid({ valid: false, reason: "Erro ao validar" }); }
    finally { setPromoLoading(false); }
  }

  // CNPJ lookup
  async function lookupCnpj() {
    const digits = form.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjData(null);
    try {
      const r = await fetch(`/api/public/saas/cnpj-lookup?cnpj=${digits}`);
      const data = await r.json();
      setCnpjData(data);
      if (data.found) {
        const companyName = data.nomeFantasia || data.razaoSocial || "";
        if (!form.name && companyName) {
          setForm((f) => ({ ...f, name: companyName }));
        }
      }
    } catch {
      setCnpjData({ found: false, reason: "Erro ao consultar" });
    } finally {
      setCnpjLoading(false);
    }
  }

  // File handlers for identity verification
  function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFile(file);
    setDocPreview(URL.createObjectURL(file));
    setVerifyResult(null);
  }

  function handleSelfieFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    setVerifyResult(null);
  }

  // Identity verification
  async function handleVerify() {
    if (!docFile || !selfieFile) return;
    setVerifying(true);
    setError(null);
    setVerifyResult(null);
    try {
      const [docB64, selfieB64] = await Promise.all([
        fileToBase64(docFile),
        fileToBase64(selfieFile),
      ]);

      const r = await fetch("/api/public/saas/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentBase64: docB64, selfieBase64: selfieB64, cnpj: form.cnpj }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro na verificacao");

      setVerifyResult(data);
    } catch (err: any) {
      setError(err.message || "Erro na verificacao de identidade");
    } finally {
      setVerifying(false);
    }
  }

  // After verification approved → call signup
  async function handleAfterVerification() {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/public/saas/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          planId: selectedPlanId,
          billingCycle,
          promoCode: promoValid?.valid ? promoCode.trim() : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao cadastrar");

      setTenantId(data.tenantId);

      if (data.skipPayment) {
        setResult(data);
        setStep(totalSteps);
      } else {
        setCardForm((c) => ({ ...c, holderName: form.responsibleName, cpfCnpj: form.cnpj }));
        setStep(4);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  }

  // Step 4: Submit payment
  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: any = {
        tenantId,
        billingType,
        billingCycle,
        promoCode: promoValid?.valid ? promoCode.trim() : undefined,
      };

      if (billingType === "CREDIT_CARD") {
        payload.creditCard = {
          holderName: cardForm.holderName,
          number: cardForm.number.replace(/\s/g, ""),
          expiryMonth: cardForm.expiryMonth,
          expiryYear: cardForm.expiryYear,
          ccv: cardForm.ccv,
        };
        payload.creditCardHolderInfo = {
          name: cardForm.holderName || form.responsibleName,
          email: form.responsibleEmail,
          cpfCnpj: (cardForm.cpfCnpj || form.cnpj || "").replace(/[^\d]/g, ""),
          postalCode: (cardForm.postalCode || "").replace(/[^\d]/g, ""),
          addressNumber: cardForm.addressNumber || "0",
        };
      }

      const r = await fetch("/api/public/saas/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao processar pagamento");

      setResult({
        success: true,
        message: data.message,
        slug: form.slug,
        skipPayment: false,
      });
      setStep(totalSteps);
    } catch (err: any) {
      setError(err.message || "Erro ao processar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate price
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const baseMonthlyCents = selectedPlan?.priceCents || 0;
  const yearlyTotal = selectedPlan?.priceYearlyCents || baseMonthlyCents * 12;
  const baseDisplayCents = billingCycle === "yearly" ? yearlyTotal / 12 : baseMonthlyCents;

  let firstMonthCents = baseDisplayCents;
  let discountLabel = "";
  if (promoValid?.valid && selectedPlan) {
    if (promoValid.discountPercent) {
      firstMonthCents = Math.round(baseDisplayCents * (1 - promoValid.discountPercent / 100));
      discountLabel = `${promoValid.discountPercent}% OFF`;
    } else if (promoValid.discountCents) {
      firstMonthCents = Math.max(0, baseDisplayCents - promoValid.discountCents);
      discountLabel = `- ${formatBRL(promoValid.discountCents)}`;
    }
  }
  const hasDiscount = firstMonthCents !== baseDisplayCents && promoValid?.valid;
  const isVoucher = promoValid?.valid && promoValid.skipPayment;

  // Steps: 1=Plan, 2=Company, 3=Verify, 4=Payment, 5=Success
  // Voucher skips step 4 (payment)
  const visibleSteps = isVoucher ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];
  const displayStep = isVoucher && step === totalSteps ? 4 : step;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900">Tecnikos</span>
          </Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-blue-600">
            Ja tenho conta
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {visibleSteps.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                displayStep >= s ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
              }`}>
                {displayStep > s ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : s}
              </div>
              {s < visibleSteps[visibleSteps.length - 1] && <div className={`w-12 h-0.5 ${displayStep > s ? "bg-blue-600" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Plan */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Escolha seu plano</h1>
            <p className="text-sm text-slate-500 text-center mb-8">Selecione o plano ideal para sua empresa</p>

            {plans.some((p) => p.priceYearlyCents) && (
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-slate-100 rounded-full p-1">
                  <button onClick={() => setBillingCycle("monthly")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                    Mensal
                  </button>
                  <button onClick={() => setBillingCycle("yearly")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${billingCycle === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                    Anual
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {plans.map((plan) => {
                const monthly = plan.priceCents;
                const yearly = plan.priceYearlyCents;
                const display = billingCycle === "yearly" && yearly ? yearly / 12 : monthly;
                const selected = selectedPlanId === plan.id;
                return (
                  <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left rounded-xl border-2 p-5 transition-all ${selected ? "border-blue-600 bg-blue-50/50 shadow-md" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">{plan.name}</h3>
                        {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          {plan.maxUsers} usuario{plan.maxUsers > 1 ? "s" : ""} · {plan.maxOsPerMonth === 0 ? "OS ilimitadas" : `${plan.maxOsPerMonth} OS/mes`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-slate-900">{formatBRL(display)}</span>
                        <span className="text-xs text-slate-400">/mes</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Promo code */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Codigo promocional ou voucher</label>
              <div className="flex gap-2">
                <input className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 uppercase"
                  value={promoCode} onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValid(null); }}
                  placeholder="Ex: PROMO50 ou VCH-XXXXXXXX" />
                <button onClick={validatePromo} disabled={!promoCode.trim() || promoLoading}
                  className="rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                  {promoLoading ? "..." : "Validar"}
                </button>
              </div>
              {promoValid && (
                <div className={`mt-2 text-xs ${promoValid.valid ? "text-green-600" : "text-red-500"}`}>
                  {promoValid.valid ? (
                    <>{promoValid.name} — {promoValid.skipPayment ? "Acesso imediato (sem pagamento)" : discountLabel}
                      {promoValid.durationMonths && promoValid.durationMonths > 1 && ` por ${promoValid.durationMonths} meses`}</>
                  ) : promoValid.reason}
                </div>
              )}
            </div>

            {/* Price summary */}
            {selectedPlan && (
              <div className="mt-4 rounded-xl bg-slate-900 text-white p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{selectedPlan.name} ({billingCycle === "yearly" ? "anual" : "mensal"})</span>
                  <span>{formatBRL(baseDisplayCents)}/mes</span>
                </div>
                {hasDiscount && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-green-400">Desconto 1o mes ({discountLabel})</span>
                    <span className="text-green-400">- {formatBRL(baseDisplayCents - firstMonthCents)}</span>
                  </div>
                )}
                {isVoucher && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-green-400">Voucher — pagamento dispensado</span>
                    <span className="text-green-400 font-bold">GRATIS</span>
                  </div>
                )}
                <div className="border-t border-white/20 mt-3 pt-3 flex items-center justify-between font-bold">
                  <span>1o mes</span>
                  <span className="text-lg">{isVoucher ? "R$ 0,00" : formatBRL(firstMonthCents)}</span>
                </div>
              </div>
            )}

            <button onClick={() => { if (selectedPlanId) setStep(2); }} disabled={!selectedPlanId}
              className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Continuar
            </button>
          </div>
        )}

        {/* Step 2: Company Info */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Dados da empresa</h1>
            <p className="text-sm text-slate-500 text-center mb-8">Preencha os dados para criar sua conta</p>

            <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Subdominio da sua empresa *</label>
                <div className="flex items-center">
                  <input className={`h-10 flex-1 rounded-l-lg border px-3 text-sm outline-none ${
                    slugAvailable === true ? "border-green-400 bg-green-50" : slugAvailable === false ? "border-red-400 bg-red-50" : "border-slate-200"
                  } focus:border-blue-500`}
                    value={form.slug} onChange={(e) => { setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }); setSlugAvailable(null); }}
                    placeholder="sua-empresa" required minLength={3} />
                  <span className="h-10 rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-3 text-xs text-slate-400 leading-10 whitespace-nowrap">.tecnikos.com.br</span>
                </div>
                {slugChecking && <p className="text-xs text-slate-400 mt-1">Verificando...</p>}
                {slugAvailable === true && <p className="text-xs text-green-600 mt-1">Disponivel!</p>}
                {slugAvailable === false && <p className="text-xs text-red-500 mt-1">Ja em uso. Tente outro.</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Nome da empresa *</label>
                <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Empresa LTDA" required />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">CNPJ *</label>
                <div className="flex gap-2">
                  <input className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.cnpj} onChange={(e) => { setForm({ ...form, cnpj: e.target.value }); setCnpjData(null); }}
                    placeholder="00.000.000/0001-00" required />
                  <button type="button" onClick={lookupCnpj}
                    disabled={cnpjLoading || form.cnpj.replace(/\D/g, "").length !== 14}
                    className="rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap">
                    {cnpjLoading ? "..." : "Consultar"}
                  </button>
                </div>
                {cnpjData && (
                  <div className={`mt-1.5 text-xs ${cnpjData.found ? "text-green-600" : "text-red-500"}`}>
                    {cnpjData.found ? <span>{cnpjData.razaoSocial}{cnpjData.nomeFantasia ? ` (${cnpjData.nomeFantasia})` : ""}</span> : cnpjData.reason}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Responsavel</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Nome completo *</label>
                    <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                      value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
                    <input type="email" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                      value={form.responsibleEmail} onChange={(e) => setForm({ ...form, responsibleEmail: e.target.value })} required />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Telefone</label>
                  <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.responsiblePhone} onChange={(e) => setForm({ ...form, responsiblePhone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
              </div>

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Voltar</button>
                <button type="submit" disabled={slugAvailable === false}
                  className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  Continuar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Identity Verification */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Verificacao de identidade</h1>
            <p className="text-sm text-slate-500 text-center mb-8">
              Envie uma foto do seu documento (RG ou CNH) e uma selfie para validacao
            </p>

            <div className="space-y-5">
              {/* Document upload */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                  </svg>
                  Foto do documento (RG ou CNH)
                </h3>
                <input ref={docInputRef} type="file" accept="image/*" capture="environment" onChange={handleDocFile} className="hidden" />
                {docPreview ? (
                  <div className="relative">
                    <img src={docPreview} alt="Documento" className="w-full max-h-48 object-contain rounded-lg border border-slate-200" />
                    <button type="button" onClick={() => { setDocFile(null); setDocPreview(null); setVerifyResult(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">X</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => docInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                    <p className="text-sm text-slate-500">Toque para tirar foto ou selecionar arquivo</p>
                    <p className="text-[10px] text-slate-400 mt-1">Frente do RG ou CNH aberta</p>
                  </button>
                )}
              </div>

              {/* Selfie upload */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Selfie do responsavel
                </h3>
                <input ref={selfieInputRef} type="file" accept="image/*" capture="user" onChange={handleSelfieFile} className="hidden" />
                {selfiePreview ? (
                  <div className="relative">
                    <img src={selfiePreview} alt="Selfie" className="w-full max-h-48 object-contain rounded-lg border border-slate-200" />
                    <button type="button" onClick={() => { setSelfieFile(null); setSelfiePreview(null); setVerifyResult(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">X</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => selfieInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    <p className="text-sm text-slate-500">Toque para tirar selfie ou selecionar foto</p>
                    <p className="text-[10px] text-slate-400 mt-1">Rosto visivel, boa iluminacao, sem oculos escuros</p>
                  </button>
                )}
              </div>

              {/* Verification result */}
              {verifyResult && (
                <div className={`rounded-xl border p-4 ${verifyResult.approved ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verifyResult.approved ? (
                      <>
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className="text-sm font-semibold text-green-800">Identidade verificada com sucesso!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                        <span className="text-sm font-semibold text-red-800">Verificacao nao aprovada</span>
                      </>
                    )}
                  </div>
                  {verifyResult.approved && verifyResult.documentType && (
                    <p className="text-xs text-green-700">
                      Documento: {verifyResult.documentType}
                      {verifyResult.faceMatchScore ? ` · Similaridade: ${verifyResult.faceMatchScore}%` : ""}
                      {verifyResult.livenessScore ? ` · Prova de vida: ${verifyResult.livenessScore}%` : ""}
                    </p>
                  )}
                  {verifyResult.qsaValidation && (
                    <p className={`text-xs mt-1 ${verifyResult.qsaValidation.validated ? "text-green-700" : "text-red-700"}`}>
                      {verifyResult.qsaValidation.validated ? "Socio confirmado" : "QSA"}: {verifyResult.qsaValidation.message}
                    </p>
                  )}
                  {verifyResult.skipped && (
                    <p className="text-xs text-green-700">Verificacao dispensada nesta etapa.</p>
                  )}
                  {verifyResult.reasons && verifyResult.reasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {verifyResult.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                          <span className="mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setStep(2); setError(null); }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Voltar</button>

                {!verifyResult?.approved ? (
                  <button type="button" onClick={handleVerify} disabled={!docFile || !selfieFile || verifying}
                    className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {verifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Verificando...
                      </span>
                    ) : "Verificar identidade"}
                  </button>
                ) : (
                  <button type="button" onClick={handleAfterVerification} disabled={submitting}
                    className="flex-[2] py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {submitting ? "Cadastrando..." : isVoucher ? "Ativar minha empresa" : "Continuar para pagamento"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Forma de pagamento</h1>
            <p className="text-sm text-slate-500 text-center mb-8">Escolha como deseja pagar sua assinatura</p>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "PIX" as const, label: "PIX", desc: "Aprovacao instantanea" },
                  { value: "BOLETO" as const, label: "Boleto", desc: "Ate 3 dias uteis" },
                  { value: "CREDIT_CARD" as const, label: "Cartao", desc: "Aprovacao imediata" },
                ] as const).map((method) => (
                  <button key={method.value} type="button" onClick={() => setBillingType(method.value)}
                    className={`rounded-xl border-2 p-4 text-center transition-all ${
                      billingType === method.value ? "border-blue-600 bg-blue-50/50 shadow-md" : "border-slate-200 bg-white hover:border-blue-300"
                    }`}>
                    <div className="text-2xl mb-1">
                      {method.value === "PIX" ? (
                        <svg className="w-7 h-7 mx-auto text-slate-700" viewBox="0 0 24 24" fill="currentColor"><path d="M15.45 16.52l-3.01-3.01c-.11-.11-.29-.11-.4 0l-3.02 3.01c-.67.67-1.56 1.04-2.5 1.04h-.64l3.8 3.8c1.1 1.1 2.9 1.1 4 0l3.82-3.82h-.55c-.95 0-1.83-.37-2.5-1.02zm-8.48-4.56l3.02 3.01c.11.11.29.11.4 0l3.01-3.01c.67-.67 1.56-1.04 2.5-1.04h.55L12.63 7.1c-1.1-1.1-2.9-1.1-4 0l-3.8 3.8h.64c.95.01 1.83.38 2.5 1.06zM20.2 7.1l-1.93-1.93c-.03.01-.06.03-.08.05l-2.02 2.02c-.11.11-.11.29 0 .4l3.54 3.54V9.62c0-.95-.37-1.83-1.04-2.5l-.47-.02zM3.8 16.87l1.93 1.93c.03-.01.06-.03.08-.05l2.02-2.02c.11-.11.11-.29 0-.4L4.29 12.8v1.57c0 .95.37 1.83 1.04 2.5h-1.53z"/></svg>
                      ) : method.value === "BOLETO" ? (
                        <svg className="w-7 h-7 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v5.625M16.5 14.625v5.625M19.5 14.625v5.625" /></svg>
                      ) : (
                        <svg className="w-7 h-7 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{method.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{method.desc}</p>
                  </button>
                ))}
              </div>

              {billingType === "CREDIT_CARD" && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Nome no cartao *</label>
                    <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                      value={cardForm.holderName} onChange={(e) => setCardForm({ ...cardForm, holderName: e.target.value })} placeholder="NOME COMO NO CARTAO" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Numero do cartao *</label>
                    <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 tracking-wider"
                      value={cardForm.number} onChange={(e) => setCardForm({ ...cardForm, number: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="0000 0000 0000 0000" maxLength={19} required />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="mb-1 block text-xs font-medium text-slate-600">Mes *</label>
                      <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                        value={cardForm.expiryMonth} onChange={(e) => setCardForm({ ...cardForm, expiryMonth: e.target.value })} placeholder="MM" maxLength={2} required /></div>
                    <div><label className="mb-1 block text-xs font-medium text-slate-600">Ano *</label>
                      <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                        value={cardForm.expiryYear} onChange={(e) => setCardForm({ ...cardForm, expiryYear: e.target.value })} placeholder="AAAA" maxLength={4} required /></div>
                    <div><label className="mb-1 block text-xs font-medium text-slate-600">CVV *</label>
                      <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                        value={cardForm.ccv} onChange={(e) => setCardForm({ ...cardForm, ccv: e.target.value })} placeholder="123" maxLength={4} required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="mb-1 block text-xs font-medium text-slate-600">CPF/CNPJ do titular *</label>
                      <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                        value={cardForm.cpfCnpj} onChange={(e) => setCardForm({ ...cardForm, cpfCnpj: e.target.value })} placeholder="000.000.000-00" required /></div>
                    <div><label className="mb-1 block text-xs font-medium text-slate-600">CEP *</label>
                      <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                        value={cardForm.postalCode} onChange={(e) => setCardForm({ ...cardForm, postalCode: e.target.value })} placeholder="00000-000" required /></div>
                  </div>
                </div>
              )}

              {billingType === "PIX" && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <p className="text-sm text-green-800 font-medium">Pagamento via PIX</p>
                  <p className="text-xs text-green-600 mt-1">Ao confirmar, um QR Code PIX sera gerado. Sua empresa sera ativada assim que o pagamento for confirmado.</p>
                </div>
              )}
              {billingType === "BOLETO" && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-800 font-medium">Pagamento via Boleto</p>
                  <p className="text-xs text-amber-600 mt-1">Ao confirmar, um boleto sera gerado. Sua empresa sera ativada apos a compensacao (ate 3 dias uteis).</p>
                </div>
              )}

              {selectedPlan && (
                <div className="rounded-xl bg-slate-900 text-white p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{selectedPlan.name} ({billingCycle === "yearly" ? "anual" : "mensal"})</span>
                    <span>{formatBRL(baseDisplayCents)}/mes</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-green-400">Desconto ({discountLabel})</span>
                      <span className="text-green-400">- {formatBRL(baseDisplayCents - firstMonthCents)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/20 mt-3 pt-3 flex items-center justify-between font-bold">
                    <span>Total</span>
                    <span className="text-lg">{formatBRL(firstMonthCents)}</span>
                  </div>
                </div>
              )}

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Voltar</button>
                <button type="submit" disabled={submitting}
                  className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {submitting ? "Processando..." : billingType === "CREDIT_CARD" ? "Pagar agora" : billingType === "PIX" ? "Gerar PIX" : "Gerar boleto"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 5: Success */}
        {step === totalSteps && result && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {result.skipPayment ? "Empresa ativada!" : "Cadastro realizado!"}
            </h1>
            <p className="text-slate-500 mb-4 max-w-md mx-auto">{result.message}</p>
            {result.skipPayment && (
              <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto">
                Seus dados de acesso foram enviados para o email cadastrado. Verifique sua caixa de entrada (e spam).
              </p>
            )}
            {(result.skipPayment || result.slug) && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-6 max-w-sm mx-auto">
                <p className="text-xs text-blue-600 font-medium mb-1">Seu endereco:</p>
                <p className="text-lg font-bold text-blue-900">{result.slug || form.slug}.tecnikos.com.br</p>
              </div>
            )}
            <Link href={result.skipPayment ? "/login" : "/"}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
              {result.skipPayment ? "Acessar minha conta" : "Voltar para inicio"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
