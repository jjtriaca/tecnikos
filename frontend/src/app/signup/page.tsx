"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { track } from "@/lib/track";

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

function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Document verification types */
interface VerificationStatus {
  uploadedCount: number;
  uploadComplete: boolean;
  reviewStatus: string;
  expired: boolean;
  documents: {
    cnpjCard: boolean;
    docFront: boolean;
    docBack: boolean;
    selfieClose: boolean;
    selfieMedium: boolean;
  };
}

const DOC_STEPS = [
  { key: "cnpjCard", label: "Cartao CNPJ", accept: "image/*,application/pdf", capture: "environment" as const },
  { key: "docFront", label: "Documento (Frente)", accept: "image/*", capture: "environment" as const },
  { key: "docBack", label: "Documento (Verso)", accept: "image/*", capture: "environment" as const },
  { key: "selfieClose", label: "Selfie 1", accept: "image/*", capture: "user" as const },
  { key: "selfieMedium", label: "Selfie 2", accept: "image/*", capture: "user" as const },
];

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

  // Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Checkout URL (Asaas hosted checkout)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // CNPJ lookup
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjData, setCnpjData] = useState<{
    found: boolean; razaoSocial?: string; nomeFantasia?: string;
    email?: string; telefone?: string; reason?: string;
    cep?: string; logradouro?: string; numero?: string; bairro?: string;
    municipio?: string; uf?: string; situacao?: string;
  } | null>(null);

  // Verification session (step 3)
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus | null>(null);
  const [showDesktopUpload, setShowDesktopUpload] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const desktopFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [cnpjPdfUploaded, setCnpjPdfUploaded] = useState(false);
  const [uploadingCnpjPdf, setUploadingCnpjPdf] = useState(false);
  const cnpjPdfInputRef = useRef<HTMLInputElement | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; slug?: string; skipPayment?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payment pending state (waiting for checkout confirmation)
  const [paymentPending, setPaymentPending] = useState(false);

  // Signup attempt tracking
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // Email resend
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendEmail, setResendEmail] = useState("");
  const [resendSending, setResendSending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Traffic source (captured once on mount)
  const [trafficSource] = useState(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      referrer: document.referrer || undefined,
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
      utmTerm: params.get("utm_term") || undefined,
      utmContent: params.get("utm_content") || undefined,
      landingPage: window.location.href,
    };
  });

  // Render error block with "Report Problem" option
  function renderError() {
    if (!error) return null;
    return (
      <div className="space-y-2">
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        {attemptId && !reportSent && (
          <div>
            {!showReportForm ? (
              <button onClick={() => setShowReportForm(true)} className="text-[11px] text-slate-400 hover:text-blue-500 underline">
                Teve um problema? Nos avise
              </button>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Descreva o problema encontrado:</p>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 resize-none"
                  rows={3} value={reportMessage} onChange={(e) => setReportMessage(e.target.value)}
                  placeholder="Descreva o que aconteceu..." />
                <div className="flex gap-2">
                  <button onClick={() => setShowReportForm(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
                  <button onClick={sendReport} disabled={reportSending || !reportMessage.trim()}
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                    {reportSending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {reportSent && (
          <p className="text-[11px] text-green-600">Mensagem enviada! Nossa equipe vai analisar.</p>
        )}
      </div>
    );
  }

  // Save/update signup attempt (fire-and-forget)
  const saveAttempt = useCallback(async (data: Record<string, unknown>) => {
    try {
      const body = { ...data, id: attemptId };
      const r = await fetch("/api/public/saas/signup-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
      const result = await r.json();
      if (result.id && !attemptId) setAttemptId(result.id);
    } catch {}
  }, [attemptId]);

  // Report problem
  async function sendReport() {
    if (!reportMessage.trim() || !attemptId) return;
    setReportSending(true);
    try {
      await fetch(`/api/public/saas/signup-attempt/${attemptId}/criticism`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criticism: reportMessage.trim() }),
      });
      setReportSent(true);
      setShowReportForm(false);
    } catch {}
    finally { setReportSending(false); }
  }

  // Countdown timer for email resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    track("signup_step_1");
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

    // Auto-fill voucher from URL
    const voucherFromUrl = searchParams.get("voucher");
    if (voucherFromUrl && !promoCode) {
      setPromoCode(voucherFromUrl.toUpperCase());
      // Auto-validate
      fetch(`/api/public/saas/validate-code?code=${encodeURIComponent(voucherFromUrl)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.valid) setPromoValid(data);
        })
        .catch(() => {});
    }
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
        // Auto-fill company name from CNPJ data
        const companyName = data.nomeFantasia || data.razaoSocial || "";
        setForm((f) => ({ ...f, name: companyName }));
      }
    } catch {
      setCnpjData({ found: false, reason: "Erro ao consultar" });
    } finally {
      setCnpjLoading(false);
    }
  }

  // Step 2 → Step 3 transition: create tenant + verification session
  async function handleStep2Continue() {
    setError(null);
    setSubmitting(true);

    // Save form context to attempt before trying
    saveAttempt({
      slug: form.slug, companyName: form.name, cnpj: form.cnpj,
      responsibleName: form.responsibleName, responsibleEmail: form.responsibleEmail,
      responsiblePhone: form.responsiblePhone, lastStep: 2,
      cnpjData: cnpjData?.found ? cnpjData : undefined,
    });

    try {
      // 1. Create tenant (signup)
      const r = await fetch("/api/public/saas/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          password,
          planId: selectedPlanId,
          billingCycle,
          promoCode: promoValid?.valid ? promoCode.trim() : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao cadastrar");

      setTenantId(data.tenantId);

      // If voucher skips payment, still need verification
      // 2. Create verification session
      const vr = await fetch("/api/public/saas/create-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: data.tenantId }),
      });
      const vData = await vr.json();
      if (!vr.ok) throw new Error(vData.message || "Erro ao criar sessao de verificacao");

      setVerifyToken(vData.token);
      setVerifyUrl(vData.verifyUrl);

      track("signup_step_3");
      saveAttempt({ lastStep: 3, lastError: null });
      setStep(3);
    } catch (err: any) {
      const msg = err.message || "Erro ao cadastrar";
      setError(msg);
      saveAttempt({ lastStep: 2, lastError: msg, rejectionReasons: [msg] });
    } finally {
      setSubmitting(false);
    }
  }

  // Polling for verification status (Step 3)
  useEffect(() => {
    if (step !== 3 || !verifyToken) return;
    let active = true;

    const poll = async () => {
      try {
        const r = await fetch(`/api/public/saas/verification/${verifyToken}/status`);
        if (r.ok && active) {
          const data: VerificationStatus = await r.json();
          setVerifyStatus(data);
        }
      } catch {}
    };

    poll(); // initial
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [step, verifyToken]);

  // Auto-advance to payment when all 5 documents are uploaded
  useEffect(() => {
    if (step === 3 && verifyStatus?.uploadComplete) {
      track("signup_docs_complete");
      saveAttempt({ lastStep: 3 });
      // Short delay for visual feedback
      const timer = setTimeout(() => handleAfterDocuments(), 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, verifyStatus?.uploadComplete]);

  // Desktop upload handler
  async function handleDesktopUpload(docType: string, file: File) {
    if (!verifyToken) return;
    setUploadingType(docType);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", docType);

      const r = await fetch(`/api/public/saas/verification/${verifyToken}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao enviar");

      // Update status immediately
      setVerifyStatus((prev) => prev ? {
        ...prev,
        uploadedCount: data.uploadedCount,
        uploadComplete: data.uploadComplete,
        documents: { ...prev.documents, [docType]: true },
      } : prev);
    } catch (err: any) {
      const msg = err.message || "Erro ao enviar arquivo";
      setError(msg);
      saveAttempt({ lastStep: 3, lastError: msg });
    } finally {
      setUploadingType(null);
    }
  }

  // Upload CNPJ card (first doc) — then show QR for remaining docs
  async function handleCnpjPdfUpload(file: File) {
    if (!verifyToken) return;
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Tipo de arquivo não permitido. Use PDF, JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo: 10MB.");
      return;
    }
    setUploadingCnpjPdf(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "cnpjCard");
      const r = await fetch(`/api/public/saas/verification/${verifyToken}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao enviar");
      setCnpjPdfUploaded(true);
      // Update verify status to reflect CNPJ uploaded
      setVerifyStatus((prev) => prev ? {
        ...prev,
        uploadedCount: data.uploadedCount,
        uploadComplete: data.uploadComplete,
        documents: { ...prev.documents, cnpjCard: true },
      } : {
        uploadedCount: data.uploadedCount,
        uploadComplete: data.uploadComplete,
        reviewStatus: "PENDING",
        expired: false,
        documents: { cnpjCard: true, docFront: false, docBack: false, selfieClose: false, selfieMedium: false },
      });
      track("signup_cnpj_card_uploaded");
    } catch (err: any) {
      const msg = err.message || "Erro ao enviar Cartão CNPJ";
      setError(msg);
      saveAttempt({ lastStep: 3, lastError: msg });
    } finally {
      setUploadingCnpjPdf(false);
    }
  }

  // After verification docs uploaded → proceed to payment or finish
  function handleAfterDocuments() {
    if (isVoucher) {
      track("signup_complete", { skipPayment: true });
      saveAttempt({ lastStep: 5, completedAt: new Date().toISOString() });
      setResult({
        success: true,
        message: "Seus documentos foram enviados! Aguarde a analise para ativacao da sua conta.",
        slug: form.slug,
        skipPayment: true,
      });
      setStep(totalSteps);
    } else {
      track("signup_step_4");
      saveAttempt({ lastStep: 4 });
      setStep(4);
    }
  }

  // Step 4: Submit payment
  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        tenantId,
        billingCycle,
        promoCode: promoValid?.valid ? promoCode.trim() : undefined,
      };

      const r = await fetch("/api/public/saas/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao processar pagamento");

      track("signup_payment_submitted", { method: "checkout" });
      saveAttempt({ lastStep: 4, paymentSubmitted: true });

      // Open Asaas Checkout in new tab
      if (data.checkoutUrl) {
        setCheckoutUrl(data.checkoutUrl);
        window.open(data.checkoutUrl, "_blank");
      }

      setPaymentPending(true);
    } catch (err: any) {
      const msg = err.message || "Erro ao processar pagamento";
      setError(msg);
      saveAttempt({ lastStep: 4, lastError: msg });
    } finally {
      setSubmitting(false);
    }
  }

  // Poll for payment confirmation (checkout)
  useEffect(() => {
    if (!paymentPending || !tenantId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/public/saas/payment-status/${tenantId}`);
        const data = await r.json();
        if (!cancelled && data.isActive) {
          setPaymentPending(false);
          track("signup_complete", { method: "checkout" });
          saveAttempt({ lastStep: 5, completedAt: new Date().toISOString() });
          setResult({ success: true, message: "Pagamento confirmado!", slug: form.slug, skipPayment: false });
          setStep(totalSteps);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 5000); // Poll every 5 seconds
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentPending, tenantId]);

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

            <button onClick={() => { if (selectedPlanId) { const plan = plans.find(p => p.id === selectedPlanId); track("signup_step_2", { planId: selectedPlanId, billingCycle }); saveAttempt({ planId: selectedPlanId, planName: plan?.name, billingCycle, lastStep: 1, ...trafficSource }); setStep(2); } }} disabled={!selectedPlanId}
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

            <form onSubmit={(e) => { e.preventDefault(); handleStep2Continue(); }} className="space-y-4">
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
                <label className="mb-1 block text-xs font-medium text-slate-600">CNPJ *</label>
                <div className="flex gap-2">
                  <input className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.cnpj} onChange={(e) => { setForm({ ...form, cnpj: maskCnpj(e.target.value), name: "" }); setCnpjData(null); }}
                    placeholder="00.000.000/0001-00" maxLength={18} required />
                  <button type="button" onClick={lookupCnpj}
                    disabled={cnpjLoading || form.cnpj.replace(/\D/g, "").length !== 14}
                    className="rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                    {cnpjLoading ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Consultando
                      </span>
                    ) : "Consultar CNPJ"}
                  </button>
                </div>
                {cnpjData && !cnpjData.found && (
                  <div className="mt-1.5 text-xs text-red-500">{cnpjData.reason}</div>
                )}
              </div>

              {/* Company data from CNPJ (read-only) */}
              {cnpjData?.found && (
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className="text-xs font-semibold text-green-700">Dados da Receita Federal</span>
                    {cnpjData.situacao && (
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cnpjData.situacao === "ATIVA" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>{cnpjData.situacao}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Razao Social</span>
                      <p className="text-sm text-slate-800 font-medium">{cnpjData.razaoSocial || "-"}</p>
                    </div>
                    {cnpjData.nomeFantasia && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">Nome Fantasia</span>
                        <p className="text-sm text-slate-800 font-medium">{cnpjData.nomeFantasia}</p>
                      </div>
                    )}
                    {cnpjData.logradouro && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-400 uppercase">Endereco</span>
                        <p className="text-sm text-slate-700">
                          {cnpjData.logradouro}{cnpjData.numero ? `, ${cnpjData.numero}` : ""}
                          {cnpjData.bairro ? ` — ${cnpjData.bairro}` : ""}
                          {cnpjData.municipio ? ` · ${cnpjData.municipio}` : ""}
                          {cnpjData.uf ? `/${cnpjData.uf}` : ""}
                          {cnpjData.cep ? ` · CEP ${cnpjData.cep}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    <input type="email" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm lowercase outline-none focus:border-blue-500"
                      value={form.responsibleEmail} onChange={(e) => setForm({ ...form, responsibleEmail: e.target.value.toLowerCase() })} required />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Telefone</label>
                  <input className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.responsiblePhone} onChange={(e) => setForm({ ...form, responsiblePhone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" maxLength={15} />
                </div>
              </div>

              {/* Password section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Senha de acesso</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Senha *</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm outline-none focus:border-blue-500"
                        value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                        autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Confirmar senha *</label>
                    <input type={showPassword ? "text" : "password"}
                      className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-blue-500 ${
                        confirmPassword && confirmPassword !== password ? "border-red-400 bg-red-50" : "border-slate-200"
                      }`}
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                      autoComplete="new-password" />
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-[10px] text-red-500 mt-1">As senhas nao coincidem</p>
                    )}
                  </div>
                </div>

                {/* Password strength indicators */}
                {password && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex gap-1">
                      {[
                        password.length >= 8,
                        /[A-Z]/.test(password),
                        /[a-z]/.test(password),
                        /\d/.test(password),
                        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
                      ].map((ok, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${ok ? "bg-green-500" : "bg-slate-200"}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5">
                      {[
                        { label: "8+ caracteres", ok: password.length >= 8 },
                        { label: "Letra maiuscula", ok: /[A-Z]/.test(password) },
                        { label: "Letra minuscula", ok: /[a-z]/.test(password) },
                        { label: "Numero", ok: /\d/.test(password) },
                        { label: "Caractere especial", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
                      ].map((rule) => (
                        <div key={rule.label} className="flex items-center gap-1">
                          {rule.ok ? (
                            <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          )}
                          <span className={`text-[10px] ${rule.ok ? "text-green-600" : "text-slate-400"}`}>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {renderError()}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Voltar</button>
                <button type="submit" disabled={
                  submitting ||
                  slugAvailable === false ||
                  !cnpjData?.found ||
                  !form.name ||
                  !password ||
                  password.length < 8 ||
                  !/[A-Z]/.test(password) ||
                  !/[a-z]/.test(password) ||
                  !/\d/.test(password) ||
                  !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ||
                  password !== confirmPassword
                }
                  className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Cadastrando...
                    </span>
                  ) : "Continuar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Document Verification */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
              {cnpjPdfUploaded ? "Verificacao de documentos" : "Cartao CNPJ"}
            </h1>
            <p className="text-sm text-slate-500 text-center mb-6">
              {cnpjPdfUploaded
                ? "Complete a verificacao enviando os documentos restantes"
                : "Envie o Cartao CNPJ da empresa para validar seu cadastro"}
            </p>

            {/* ── CNPJ Card Upload (mandatory) ── */}
            {!cnpjPdfUploaded && (
              <div className="mb-5">
                <div
                  className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-8 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all"
                  onClick={() => cnpjPdfInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCnpjPdfUpload(file);
                  }}
                >
                  <input
                    ref={cnpjPdfInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCnpjPdfUpload(file);
                    }}
                    className="hidden"
                  />
                  {uploadingCnpjPdf ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
                      <p className="text-sm font-medium text-blue-700">Enviando...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">Cartao CNPJ</p>
                      <p className="text-xs text-slate-500 mb-3">
                        Clique ou arraste o arquivo PDF ou imagem do Cartao CNPJ
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                        </svg>
                        Selecionar arquivo
                      </div>
                      <p className="text-[10px] text-slate-400 mt-3">PDF, JPEG, PNG ou WebP — maximo 10MB</p>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-3">
                  Voce pode obter o Cartao CNPJ em <a href="https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">receita.fazenda.gov.br</a>
                </p>
              </div>
            )}

            {/* ── After CNPJ card: QR code + remaining docs checklist ── */}
            {cnpjPdfUploaded && !verifyStatus?.uploadComplete && (
              <div className="space-y-5">
                {/* CNPJ Card success badge */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-green-800">Cartao CNPJ enviado</span>
                </div>

                {/* QR Code for remaining documents */}
                <div className="text-center">
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Documentos de identidade</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Escaneie o QR code abaixo <strong>no celular</strong> para enviar os documentos restantes
                  </p>
                  {verifyUrl && (
                    <div className="inline-block p-4 bg-white rounded-2xl shadow-lg border border-slate-200 mb-4">
                      <QRCodeSVG value={verifyUrl} size={180} level="M" />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mb-5">
                    Ou abra este link no celular: <span className="text-blue-500 break-all">{verifyUrl}</span>
                  </p>
                </div>

                {/* Document checklist */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Progresso dos documentos</p>
                  <div className="space-y-2.5">
                    {DOC_STEPS.map((doc) => {
                      const done = verifyStatus?.documents?.[doc.key as keyof VerificationStatus["documents"]] ?? false;
                      return (
                        <div key={doc.key} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-green-500" : "bg-slate-200"}`}>
                            {done ? (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                            )}
                          </div>
                          <span className={`text-sm ${done ? "text-green-700 font-medium" : "text-slate-500"}`}>{doc.label}</span>
                          {done && <span className="text-[10px] text-green-500 ml-auto">Enviado</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{verifyStatus?.uploadedCount ?? 1} de {DOC_STEPS.length} documentos</span>
                      <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${((verifyStatus?.uploadedCount ?? 1) / DOC_STEPS.length) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  Aguardando envio dos documentos pelo celular... A tela avancara automaticamente.
                </p>
              </div>
            )}

            {/* ── All docs complete — advancing ── */}
            {cnpjPdfUploaded && verifyStatus?.uploadComplete && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-green-800">Todos os documentos enviados!</p>
                <p className="text-xs text-green-600 mt-1">Avancando para pagamento...</p>
                <div className="mt-3 flex justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                </div>
              </div>
            )}

            {renderError()}
          </div>
        )}

        {/* Step 4: Payment (Asaas Checkout) */}
        {step === 4 && (
          <div>
            {paymentPending ? (
              <div className="space-y-5">
                <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">Aguardando pagamento</h1>
                <p className="text-sm text-slate-500 text-center mb-4">
                  Finalize o pagamento na pagina do Asaas que foi aberta
                </p>

                {/* Waiting animation */}
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-6">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                    <p className="text-sm font-medium text-blue-800">
                      Aguardando confirmacao do pagamento...
                    </p>
                  </div>
                  <p className="text-xs text-blue-600 text-center">
                    Esta pagina sera atualizada automaticamente quando o pagamento for confirmado.
                  </p>
                </div>

                {/* Reopen checkout link */}
                {checkoutUrl && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => window.open(checkoutUrl, "_blank")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-100 text-blue-800 text-sm font-medium hover:bg-blue-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Reabrir pagina de pagamento
                    </button>
                  </div>
                )}

                {/* Methods info */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-600 mb-3">Metodos aceitos:</p>
                  <div className="flex items-center justify-center gap-6 text-slate-500">
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.45 16.52l-3.01-3.01c-.11-.11-.29-.11-.4 0l-3.02 3.01c-.67.67-1.56 1.04-2.5 1.04h-.64l3.8 3.8c1.1 1.1 2.9 1.1 4 0l3.82-3.82h-.55c-.95 0-1.83-.37-2.5-1.02zm-8.48-4.56l3.02 3.01c.11.11.29.11.4 0l3.01-3.01c.67-.67 1.56-1.04 2.5-1.04h.55L12.63 7.1c-1.1-1.1-2.9-1.1-4 0l-3.8 3.8h.64c.95.01 1.83.38 2.5 1.06z"/></svg>
                      PIX
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5Z" /></svg>
                      Boleto
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                      Cartao
                    </div>
                  </div>
                </div>

                {/* Price summary */}
                {selectedPlan && (
                  <div className="rounded-xl bg-slate-900 text-white p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{selectedPlan.name}</span>
                      <span className="font-bold text-lg">{formatBRL(firstMonthCents)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Pagamento</h1>
            <p className="text-sm text-slate-500 text-center mb-8">Finalize sua assinatura com pagamento seguro via Asaas</p>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              {/* Payment methods icons */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-600 mb-4 text-center">Voce podera escolher o metodo de pagamento na proxima tela:</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-xl bg-slate-50">
                    <svg className="w-8 h-8 mx-auto text-slate-700 mb-1" viewBox="0 0 24 24" fill="currentColor"><path d="M15.45 16.52l-3.01-3.01c-.11-.11-.29-.11-.4 0l-3.02 3.01c-.67.67-1.56 1.04-2.5 1.04h-.64l3.8 3.8c1.1 1.1 2.9 1.1 4 0l3.82-3.82h-.55c-.95 0-1.83-.37-2.5-1.02zm-8.48-4.56l3.02 3.01c.11.11.29.11.4 0l3.01-3.01c.67-.67 1.56-1.04 2.5-1.04h.55L12.63 7.1c-1.1-1.1-2.9-1.1-4 0l-3.8 3.8h.64c.95.01 1.83.38 2.5 1.06z"/></svg>
                    <p className="text-sm font-semibold text-slate-900">PIX</p>
                    <p className="text-[10px] text-slate-400">Instantaneo</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-slate-50">
                    <svg className="w-8 h-8 mx-auto text-slate-700 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v5.625M16.5 14.625v5.625M19.5 14.625v5.625" /></svg>
                    <p className="text-sm font-semibold text-slate-900">Boleto</p>
                    <p className="text-[10px] text-slate-400">Ate 3 dias</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-slate-50">
                    <svg className="w-8 h-8 mx-auto text-slate-700 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                    <p className="text-sm font-semibold text-slate-900">Cartao</p>
                    <p className="text-[10px] text-slate-400">Imediato</p>
                  </div>
                </div>
              </div>

              {/* Price summary */}
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

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <p className="text-xs text-blue-700">
                  Ao clicar em &quot;Pagar&quot;, uma pagina segura do Asaas sera aberta para voce escolher seu metodo de pagamento e finalizar a compra.
                </p>
              </div>

              {renderError()}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Voltar</button>
                <button type="submit" disabled={submitting}
                  className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {submitting ? "Processando..." : "Pagar"}
                </button>
              </div>
            </form>
            </>
            )}
          </div>
        )}

        {/* Step 5: Success — Awaiting Review */}
        {step === totalSteps && result && (
          <div className="text-center py-10">
            {/* Icon — green check for payment flow, blue clock for voucher */}
            {result.skipPayment ? (
              <div className="w-16 h-16 rounded-full bg-blue-100 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {result.skipPayment ? "Cadastro realizado!" : "Pagamento confirmado!"}
            </h1>
            <p className="text-slate-500 mb-4 max-w-md mx-auto">
              {result.skipPayment
                ? "Seus documentos foram enviados para analise."
                : "Seu pagamento foi confirmado com sucesso. Seus documentos estao em analise."
              }
            </p>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6 max-w-sm mx-auto">
              <div className="flex items-center gap-2 justify-center mb-1">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-amber-800 font-medium">Aguardando analise de documentos</p>
              </div>
              <p className="text-xs text-amber-600">
                Voce recebera um email quando sua conta for totalmente ativada.
              </p>
            </div>
            {(result.slug || form.slug) && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-6 max-w-sm mx-auto">
                <p className="text-xs text-blue-600 font-medium mb-1">Seu endereco:</p>
                <p className="text-lg font-bold text-blue-900">{result.slug || form.slug}.tecnikos.com.br</p>
              </div>
            )}

            {/* Email resend section */}
            {tenantId && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6 max-w-sm mx-auto text-left">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <span className="text-xs font-semibold text-slate-700">Email de acesso enviado para:</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <input type="email"
                    className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm lowercase outline-none focus:border-blue-500"
                    value={resendEmail || form.responsibleEmail}
                    onChange={(e) => setResendEmail(e.target.value.toLowerCase())}
                  />
                </div>
                {resendSuccess && (
                  <p className="text-xs text-green-600 mb-2">Email reenviado com sucesso!</p>
                )}
                <p className="text-[10px] text-slate-400 mb-2">
                  Nao recebeu? Confira o email acima e clique em reenviar.
                </p>
                <button
                  disabled={resendSending || resendCountdown > 0}
                  onClick={async () => {
                    setResendSending(true);
                    setResendSuccess(false);
                    try {
                      const r = await fetch("/api/public/saas/resend-welcome", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tenantId, email: resendEmail || form.responsibleEmail }),
                      });
                      const data = await r.json();
                      if (!r.ok) throw new Error(data.message);
                      setResendSuccess(true);
                      // Update form email if changed
                      if (data.email) setForm((f) => ({ ...f, responsibleEmail: data.email }));
                      // Start 60s countdown
                      setResendCountdown(60);
                    } catch (err: any) {
                      setError(err.message || "Erro ao reenviar");
                    } finally {
                      setResendSending(false);
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  {resendSending ? "Enviando..." : resendCountdown > 0 ? `Reenviar em ${resendCountdown}s` : "Reenviar email"}
                </button>
              </div>
            )}

            <Link href="/"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
              Voltar para inicio
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
