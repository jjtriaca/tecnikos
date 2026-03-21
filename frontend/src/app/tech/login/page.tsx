"use client";

import { useState } from "react";
import { useTechAuth } from "@/contexts/TechAuthContext";

type Step = "idle" | "otp_sent" | "verifying";

export default function TechLoginPage() {
  const { requestOtp, loginWithOtp } = useTechAuth();
  const [step, setStep] = useState<Step>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ── Mask phone: (11) 99999-9999 ───────────────────── */
  function formatPhone(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function rawPhone() {
    return phone.replace(/\D/g, "");
  }

  /* ── Request OTP ───────────────────────────────────── */
  async function handleRequestOtp() {
    const digits = rawPhone();
    if (digits.length < 10) {
      setError("Digite um telefone valido");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestOtp(digits);
      setStep("otp_sent");
    } catch (err: any) {
      setError(err.message || "Erro ao enviar codigo");
    } finally {
      setLoading(false);
    }
  }

  /* ── Verify OTP ────────────────────────────────────── */
  async function handleVerifyOtp() {
    if (code.length < 6) {
      setError("Digite o codigo de 6 digitos");
      return;
    }
    setLoading(true);
    setError(null);
    setStep("verifying");
    try {
      await loginWithOtp(rawPhone(), code);
      // loginWithOtp redirects to /tech/orders on success
    } catch (err: any) {
      setError(err.message || "Codigo invalido");
      setStep("otp_sent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-5">
      {/* Decorative */}
      <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl bg-white px-7 py-8 shadow-2xl shadow-black/20">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="Tecnikos" className="h-9 w-9" />
            <div>
              <div className="text-sm font-bold text-slate-900">Tecnikos</div>
              <div className="text-[10px] text-slate-400">Portal do Tecnico</div>
            </div>
          </div>

          {step === "idle" && (
            <>
              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                  <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
              </div>

              <h1 className="text-lg font-bold text-slate-900 text-center">Verificar minhas OS</h1>
              <p className="mt-2 text-sm text-slate-500 text-center leading-relaxed">
                Digite seu telefone para receber um codigo de verificacao por WhatsApp.
              </p>

              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefone</label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
              )}

              <button
                onClick={handleRequestOtp}
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Enviando..." : "Enviar codigo"}
              </button>

              {/* Divider */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  Ou acesse pelo link enviado pela empresa via WhatsApp.
                </p>
              </div>
            </>
          )}

          {(step === "otp_sent" || step === "verifying") && (
            <>
              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                  <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h1 className="text-lg font-bold text-slate-900 text-center">Codigo enviado</h1>
              <p className="mt-2 text-sm text-slate-500 text-center leading-relaxed">
                Enviamos um codigo de 6 digitos para o WhatsApp do numero <strong className="text-slate-700">{phone}</strong>.
              </p>

              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Codigo</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-slate-900 placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                  autoFocus
                />
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || step === "verifying"}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {step === "verifying" ? "Verificando..." : "Verificar e entrar"}
              </button>

              <button
                onClick={() => { setStep("idle"); setCode(""); setError(null); }}
                className="mt-2 w-full rounded-xl py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Alterar telefone
              </button>
            </>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center gap-2 justify-center text-slate-400">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="text-[10px]">Acesso seguro via verificacao WhatsApp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
