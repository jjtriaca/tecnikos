"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import PasswordInput from "@/components/ui/PasswordInput";

type EmailConfig = {
  isConnected: boolean;
  connectedAt: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  fromName: string | null;
  fromEmail: string | null;
  hasPassword: boolean;
};

type TestResult = {
  success: boolean;
  error?: string;
};

type SmtpPreset = {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  icon: string;
};

const SMTP_PRESETS: SmtpPreset[] = [
  {
    name: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    icon: "G",
  },
  {
    name: "Outlook / Office 365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    icon: "O",
  },
  {
    name: "Yahoo",
    host: "smtp.mail.yahoo.com",
    port: 587,
    secure: false,
    icon: "Y",
  },
];

export default function EmailSettingsPage() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [editing, setEditing] = useState(false);

  // Form fields
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  // Test send
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const populateForm = useCallback((data: EmailConfig) => {
    setSmtpHost(data.smtpHost || "");
    setSmtpPort(data.smtpPort || 587);
    setSmtpSecure(data.smtpSecure || false);
    setSmtpUser(data.smtpUser || "");
    setSmtpPass("");
    setFromName(data.fromName || "");
    setFromEmail(data.fromEmail || "");
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get<EmailConfig>("/email/config");
      setConfig(data);
      populateForm(data);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [populateForm]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  function handleSecurityChange(value: string) {
    if (value === "ssl") {
      setSmtpSecure(true);
      setSmtpPort(465);
    } else {
      setSmtpSecure(false);
      setSmtpPort(587);
    }
  }

  function applyPreset(preset: SmtpPreset) {
    setSmtpHost(preset.host);
    setSmtpPort(preset.port);
    setSmtpSecure(preset.secure);
  }

  function isFormValid() {
    const hasHost = smtpHost.trim().length > 0;
    const hasUser = smtpUser.trim().length > 0;
    const hasFrom = fromEmail.trim().length > 0;
    const hasPass =
      smtpPass.trim().length > 0 || (config?.isConnected && config?.hasPassword);
    return hasHost && hasUser && hasFrom && hasPass;
  }

  async function handleTestConnection() {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      setError(
        "Preencha o servidor SMTP, usuario e senha para testar a conexao"
      );
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await api.post<TestResult>("/email/test-connection", {
        smtpHost: smtpHost.trim(),
        smtpPort,
        smtpSecure,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
      });
      setTestResult(result);
      if (result.success) {
        setSuccess("Conexao SMTP verificada com sucesso!");
        setTimeout(() => setSuccess(null), 8000);
      } else {
        setError(`Falha na conexao: ${result.error}`);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao testar conexao");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!smtpHost.trim() || !smtpUser.trim() || !fromEmail.trim()) {
      setError("Preencha os campos obrigatorios: servidor, usuario e email do remetente");
      return;
    }

    if (!smtpPass.trim() && !(config?.isConnected && config?.hasPassword)) {
      setError("Informe a senha SMTP");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, any> = {
        smtpHost: smtpHost.trim(),
        smtpPort,
        smtpSecure,
        smtpUser: smtpUser.trim(),
        fromName: fromName.trim() || null,
        fromEmail: fromEmail.trim(),
      };

      if (smtpPass.trim()) {
        body.smtpPass = smtpPass.trim();
      }

      const result = await api.put<EmailConfig>("/email/config", body);
      setConfig(result);
      setSmtpPass("");
      setEditing(false);
      setSuccess("Servidor de email conectado com sucesso!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar configuracao");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await api.del("/email/disconnect");
      setConfig((prev) =>
        prev
          ? { ...prev, isConnected: false, hasPassword: false, connectedAt: null }
          : null
      );
      setSmtpHost("");
      setSmtpPort(587);
      setSmtpSecure(false);
      setSmtpUser("");
      setSmtpPass("");
      setFromName("");
      setFromEmail("");
      setEditing(false);
      setSuccess("Servidor de email desconectado");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleTestSend() {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      setError("Informe um email de destino valido");
      return;
    }

    setSendingTest(true);
    setError(null);
    setTestSendResult(null);

    try {
      const result = await api.post<{
        success: boolean;
        error?: string;
      }>("/email/test-send", { toEmail: testEmail.trim() });

      setTestSendResult(result);
      if (result.success) {
        setSuccess("Email de teste enviado com sucesso!");
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || "Erro ao enviar email de teste");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao enviar email de teste");
    } finally {
      setSendingTest(false);
    }
  }

  const isConnected = config?.isConnected;
  const showForm = !isConnected || editing;

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Email</h1>
        </div>
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/settings"
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Configuracoes
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-700 font-medium">Email</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Servidor de Email SMTP
          </h1>
          <p className="text-sm text-slate-500">
            Configure seu servidor SMTP para envio automatico de emails.
          </p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4">
          {success}
        </div>
      )}

      {/* Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            Status da Conexao
          </h3>

          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isConnected
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-slate-100 border border-slate-200 text-slate-600"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-slate-400"
              }`}
            />
            {isConnected ? "Conectado" : "Desconectado"}
          </span>
        </div>

        <div className="text-sm text-slate-500">
          Provedor:{" "}
          <code className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
            SMTP Personalizado
          </code>
        </div>

        {isConnected && config?.connectedAt && (
          <div className="text-xs text-slate-400 mt-1">
            Conectado em:{" "}
            {new Date(config.connectedAt).toLocaleString("pt-BR")}
          </div>
        )}

        {isConnected && config?.smtpHost && (
          <div className="text-xs text-slate-400 mt-1">
            Servidor:{" "}
            <code className="font-mono text-xs">
              {config.smtpHost}:{config.smtpPort}
            </code>
          </div>
        )}
      </div>

      {/* Config Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {isConnected ? "Editar Configuracao SMTP" : "Conectar Servidor SMTP"}
          </h3>

          <div className="space-y-4">
            {/* SMTP Host */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Servidor SMTP
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>

            {/* Port + Security */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Porta
                </label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  placeholder="587"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Seguranca
                </label>
                <select
                  value={smtpSecure ? "ssl" : "starttls"}
                  onChange={(e) => handleSecurityChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white"
                >
                  <option value="starttls">STARTTLS (587)</option>
                  <option value="ssl">SSL/TLS (465)</option>
                </select>
              </div>
            </div>

            {/* SMTP User */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Usuario SMTP
              </label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="email@empresa.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>

            {/* SMTP Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha SMTP
              </label>
              <PasswordInput
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={
                  isConnected && config?.hasPassword
                    ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                    : "Senha do app ou SMTP"
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono"
              />
              {isConnected && config?.hasPassword && (
                <p className="text-xs text-slate-400 mt-1">
                  Deixe em branco para manter a senha atual
                </p>
              )}
            </div>

            {/* From Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome do Remetente
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Tecnikos"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>

            {/* From Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email do Remetente
              </label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@empresa.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  testResult.success
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {testResult.success ? (
                  <span className="font-semibold">
                    Conexao SMTP verificada com sucesso!
                  </span>
                ) : (
                  <>
                    <span className="font-semibold">Falha:</span>{" "}
                    {testResult.error}
                  </>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={
                  testing ||
                  !smtpHost.trim() ||
                  !smtpUser.trim() ||
                  !smtpPass.trim()
                }
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {testing ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Testando...
                  </>
                ) : (
                  "Testar Conexao"
                )}
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !isFormValid()}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Conectando...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Conectar
                  </>
                )}
              </button>

              {editing && (
                <button
                  onClick={() => {
                    setEditing(false);
                    setTestResult(null);
                    setError(null);
                    if (config) populateForm(config);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMTP Presets — shown when form is visible */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Presets de Provedores
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Clique em um provedor para preencher automaticamente as configuracoes
            de servidor.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SMTP_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  smtpHost === preset.host
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50"
                }`}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                  {preset.icon}
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {preset.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {preset.host}:{preset.port}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Config button — shown when connected and NOT editing */}
      {isConnected && !editing && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                Configuracao SMTP
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Altere as configuracoes do servidor de email.
              </p>
            </div>
            <button
              onClick={() => {
                setEditing(true);
                setTestResult(null);
                setError(null);
                if (config) populateForm(config);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
              Editar Configuracao
            </button>
          </div>
        </div>
      )}

      {/* Test Send — shown when connected */}
      {isConnected && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Teste de Envio
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Envie um email de teste para verificar se o servidor SMTP esta
            funcionando corretamente.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email de destino
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-colors"
              />
            </div>
            <button
              onClick={handleTestSend}
              disabled={
                sendingTest || !testEmail.trim() || !testEmail.includes("@")
              }
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {sendingTest ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Enviando...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  Enviar Email de Teste
                </>
              )}
            </button>
          </div>

          {testSendResult && (
            <div
              className={`mt-3 rounded-lg px-4 py-3 text-sm ${
                testSendResult.success
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {testSendResult.success ? (
                <>
                  <span className="font-semibold">Enviado!</span> O email de
                  teste foi enviado para {testEmail}.
                </>
              ) : (
                <>
                  <span className="font-semibold">Falha:</span>{" "}
                  {testSendResult.error}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disconnect button — shown when connected */}
      {isConnected && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                Desconectar Email
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Isso remove as credenciais SMTP. Voce precisara reconectar para
                enviar emails.
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Como configurar
        </h3>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              1
            </span>
            <p>
              Escolha seu provedor de email (Gmail, Outlook, Yahoo ou outro) e
              acesse as configuracoes de seguranca da sua conta.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              2
            </span>
            <p>
              <strong>Para Gmail:</strong> ative a verificacao em duas etapas e
              gere uma{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                Senha de App
              </a>
              . Use essa senha no campo &quot;Senha SMTP&quot; (nao a senha da
              conta).
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              3
            </span>
            <p>
              <strong>Para Outlook/Office 365:</strong> use seu email e senha
              normais. Verifique se o acesso SMTP esta habilitado nas
              configuracoes da conta.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              4
            </span>
            <p>
              Selecione um preset de provedor acima ou preencha os dados do
              servidor manualmente.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              5
            </span>
            <p>
              Clique em <strong>&quot;Testar Conexao&quot;</strong> para
              verificar as credenciais e depois em{" "}
              <strong>&quot;Conectar&quot;</strong> para salvar.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              6
            </span>
            <p>
              Pronto! Use o <strong>&quot;Teste de Envio&quot;</strong> para
              confirmar que tudo esta funcionando. Os emails automaticos do
              sistema usarao este servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
