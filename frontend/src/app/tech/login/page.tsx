"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTechAuth } from "@/contexts/TechAuthContext";
import PasswordInput from "@/components/ui/PasswordInput";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const SAVED_EMAIL_KEY = "tk_tech_saved_email";
const CAPTCHA_VERIFIED_KEY = "tk_tech_captcha_verified_at";
const CAPTCHA_INTERVAL_DAYS = 7;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function needsCaptcha(): boolean {
  const stored = localStorage.getItem(CAPTCHA_VERIFIED_KEY);
  if (!stored) return true;
  const diff = Date.now() - Number(stored);
  return diff > CAPTCHA_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

export default function TechLoginPage() {
  const { login } = useTechAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // CAPTCHA state
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Carregar email salvo + config CAPTCHA
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }

    fetch(`${API_BASE}/auth/captcha-config`)
      .then((r) => r.json())
      .then((cfg: { enabled: boolean; siteKey: string | null }) => {
        if (cfg.enabled && cfg.siteKey && needsCaptcha()) {
          setCaptchaSiteKey(cfg.siteKey);
          setShowCaptcha(true);
        }
      })
      .catch(() => {});
  }, []);

  const onCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (showCaptcha && !captchaToken) {
      setError("Complete a verificacao 'Sou humano' para continuar.");
      return;
    }

    setLoading(true);

    if (rememberEmail) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    try {
      await login(email, password, captchaToken || undefined);
      localStorage.setItem(CAPTCHA_VERIFIED_KEY, String(Date.now()));
    } catch (err: any) {
      setError(err.message || "Credenciais invalidas");
      if (showCaptcha) {
        setCaptchaToken(null);
        turnstileRef.current?.reset();
      }
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
            Use as credenciais enviadas pelo gestor.
          </p>

          <form onSubmit={onSubmit} className="space-y-3.5" autoComplete="on">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Email</label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Senha</label>
              <PasswordInput
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Lembrar email */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors"
              />
              <span className="text-xs text-slate-500">Lembrar meu email</span>
            </label>

            {/* CAPTCHA Turnstile */}
            {showCaptcha && captchaSiteKey && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={captchaSiteKey}
                  onSuccess={onCaptchaSuccess}
                  onError={() => setCaptchaToken(null)}
                  onExpire={() => setCaptchaToken(null)}
                  options={{
                    theme: "light",
                    size: "normal",
                    language: "pt-br",
                  }}
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all text-sm"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
