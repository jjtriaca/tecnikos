"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTechAuth } from "@/contexts/TechAuthContext";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function TechLoginPage() {
  const { requestOtp, loginWithOtp } = useTechAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-focus code input
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  async function handleRequestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phoneDigits);
      setStep("code");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || "Não foi possível enviar o código");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithOtp(phoneDigits, code);
    } catch (err: any) {
      setError(err.message || "Código inválido");
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

          <h1 className="text-lg font-bold text-slate-900">Entrar</h1>
          <p className="mt-0.5 text-xs text-slate-500 mb-5">
            {step === "phone"
              ? "Digite seu telefone para receber o código de acesso."
              : "Digite o código enviado por WhatsApp."}
          </p>

          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Telefone</label>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  type="tel"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phoneDigits.length < 10}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all text-sm"
              >
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Código de verificação</label>
                <input
                  ref={codeInputRef}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all tracking-[0.3em] text-center font-mono text-lg"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all text-sm"
              >
                {loading ? "Verificando..." : "Entrar"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setCode(""); setError(null); }}
                  className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Trocar telefone
                </button>

                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={countdown > 0 || loading}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:text-slate-400 transition-colors"
                >
                  {countdown > 0 ? `Reenviar (${countdown}s)` : "Reenviar código"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
