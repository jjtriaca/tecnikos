"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@tecnikos.com.br");
  const [password, setPassword] = useState("Tecnikos2026!");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Carregar preferencia "lembrar-me" do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("rememberMe");
    if (saved === "true") setRememberMe(true);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Salvar preferencia
    localStorage.setItem("rememberMe", String(rememberMe));

    try {
      await login(email, password, rememberMe);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.payload?.message || err.message);
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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
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

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Email
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
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
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  onClick={() => setError("Recuperacao de senha sera implementada em breve.")}
                  disabled={loading}
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Lembrar-me */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-500">Lembrar-me</span>
              </label>

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
                admin@tecnikos.com.br / Tecnikos2026!
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
