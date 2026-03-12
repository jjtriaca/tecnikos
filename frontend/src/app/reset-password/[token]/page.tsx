"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

const RULES = [
  { label: "8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Letra maiuscula", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Letra minuscula", test: (v: string) => /[a-z]/.test(v) },
  { label: "Numero", test: (v: string) => /\d/.test(v) },
  {
    label: "Caractere especial",
    test: (v: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(v),
  },
];

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) return;
    api
      .get<{ valid: boolean; email?: string }>(
        `/auth/reset-password/${token}`
      )
      .then((res) => {
        setValid(res.valid);
        if (res.email) setEmail(res.email);
      })
      .catch(() => setValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const passed = useMemo(() => RULES.map((r) => r.test(password)), [password]);
  const strength = passed.filter(Boolean).length;
  const allPassed = passed.every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allPassed && passwordsMatch && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaving(true);

    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.payload?.message || err.message);
      } else {
        setError("Erro ao redefinir senha. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (validating) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-white">
            <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
            </svg>
            Verificando link...
          </div>
        </div>
      </div>
    );
  }

  // Invalid / expired token
  if (!valid && !success) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 left-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="rounded-3xl bg-white px-8 py-10 shadow-2xl shadow-black/20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Link invalido ou expirado</h2>
              <p className="text-sm text-slate-500 mb-6">
                Este link de redefinicao de senha nao e mais valido.
                Solicite um novo link.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 transition-all"
              >
                Voltar ao login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 left-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="rounded-3xl bg-white px-8 py-10 shadow-2xl shadow-black/20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Senha definida com sucesso!</h2>
              <p className="text-sm text-slate-500 mb-6">
                Sua senha foi redefinida. Agora voce pode fazer login.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 transition-all"
              >
                Ir para o login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  const strengthPercent = (strength / RULES.length) * 100;
  const strengthColor =
    strength <= 1 ? "bg-red-500" : strength <= 2 ? "bg-orange-500" : strength <= 3 ? "bg-yellow-500" : strength <= 4 ? "bg-blue-500" : "bg-green-500";

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
      <div className="absolute top-0 left-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />

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

            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-900">Definir nova senha</h1>
              {email && (
                <p className="mt-1 text-sm text-slate-500">
                  Para: <span className="font-medium text-slate-700">{email}</span>
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 pr-10 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Crie uma senha forte"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${strengthPercent}%` }}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                      {RULES.map((r, i) => (
                        <div key={r.label} className="flex items-center gap-1.5">
                          {passed[i] ? (
                            <svg className="h-3.5 w-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          )}
                          <span className={`text-xs ${passed[i] ? "text-green-700" : "text-slate-400"}`}>
                            {r.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Confirmar senha
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  required
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1 text-xs text-red-500">As senhas nao conferem</p>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    Salvando...
                  </span>
                ) : (
                  "Definir senha"
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
