"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, api } from "@/lib/api";
import PasswordInput from "@/components/ui/PasswordInput";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const SAVED_EMAIL_KEY = "tk_saved_email";

type ForgotState = "idle" | "form" | "sending" | "sent";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || undefined;
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

  // Forgot password state
  const [forgotState, setForgotState] = useState<ForgotState>("idle");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Carregar email salvo + config CAPTCHA
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }

    // Fetch captcha config from backend — always show widget when enabled
    api.get<{ enabled: boolean; siteKey: string | null }>("/auth/captcha-config")
      .then((cfg) => {
        if (cfg.enabled && cfg.siteKey) {
          setCaptchaSiteKey(cfg.siteKey);
          setShowCaptcha(true);
        }
      })
      .catch(() => {/* CAPTCHA config unavailable — skip */});
  }, []);

  const onCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotError(null);
    setForgotState("sending");
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotState("sent");
    } catch (err) {
      if (err instanceof ApiError) {
        setForgotError(err.payload?.message || err.message);
      } else {
        setForgotError("Erro ao enviar. Tente novamente.");
      }
      setForgotState("form");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Require CAPTCHA if shown
    if (showCaptcha && !captchaToken) {
      setError("Complete a verificacao 'Sou humano' para continuar.");
      return;
    }

    setLoading(true);

    // Salvar ou limpar email
    if (rememberEmail) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    try {
      await login(email, password, captchaToken || undefined, redirectTo);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const msg = err.payload?.message || err.message;
        setError(msg);
        // Reset captcha on failure
        if (showCaptcha) {
          setCaptchaToken(null);
          turnstileRef.current?.reset();
        }
      } else if (err instanceof Error && err.message === "Failed to fetch") {
        setError("Servidor indisponivel. Verifique se o backend esta rodando.");
      } else {
        setError("Credenciais invalidas");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />

      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />

      {/* Login card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white px-8 py-10 shadow-2xl shadow-black/20">
            {/* Brand */}
            <div className="mb-8 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.svg" alt="Tecnikos" className="h-10 w-10" />
              <div>
                <div className="text-base font-bold text-slate-900">Tecnikos</div>
                <div className="text-[11px] text-slate-400">Gestao de Servicos Tecnicos</div>
              </div>
            </div>

            {/* Welcome */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-900">
                Bem-vindo de volta
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Entre com suas credenciais para continuar.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Email
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
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
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Senha
                </label>
                <PasswordInput
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotState("form");
                    setForgotError(null);
                  }}
                  disabled={loading}
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Lembrar email (apenas preenche o campo, NAO mantem sessao) */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-500">Lembrar meu email</span>
              </label>

              {/* CAPTCHA Turnstile — aparece a cada 7 dias */}
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
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>

              <div className="pt-3 text-center text-[11px] text-slate-300">
                Tecnikos &mdash; Gestao de Servicos Tecnicos
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotState !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            {forgotState === "sent" ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Email enviado!</h3>
                <p className="text-sm text-slate-500 mb-5">
                  Se o email estiver cadastrado, voce recebera um link para redefinir sua senha.
                </p>
                <button
                  onClick={() => setForgotState("idle")}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Esqueceu a senha?</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Informe seu email para receber o link de redefinicao.
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="seu@email.com"
                    required
                    autoFocus
                  />
                  {forgotError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                      {forgotError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={forgotState === "sending"}
                    className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {forgotState === "sending" ? "Enviando..." : "Enviar link de redefinicao"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotState("idle")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
