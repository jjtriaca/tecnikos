"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

type WhatsAppConfig = {
  provider: "META";
  isConnected: boolean;
  connectedAt: string | null;
  metaPhoneNumberId: string | null;
  metaWabaId: string | null;
  hasAccessToken: boolean;
  verifyToken: string;
  webhookUrl: string;
};

type TestResult = {
  success: boolean;
  phoneNumber?: string;
  displayName?: string;
  error?: string;
};

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Form fields
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get<WhatsAppConfig>("/whatsapp/config");
      setConfig(data);
      if (data.metaPhoneNumberId) {
        setPhoneNumberId(data.metaPhoneNumberId);
      }
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleTestConnection() {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setError("Preencha o Phone Number ID e o Access Token");
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await api.post<TestResult>("/whatsapp/test-connection", {
        metaAccessToken: accessToken.trim(),
        metaPhoneNumberId: phoneNumberId.trim(),
      });
      setTestResult(result);
      if (result.success) {
        setSuccess(
          `Conexao OK! Numero: ${result.phoneNumber} (${result.displayName})`
        );
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
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setError("Preencha o Phone Number ID e o Access Token");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await api.put<WhatsAppConfig>("/whatsapp/config", {
        metaAccessToken: accessToken.trim(),
        metaPhoneNumberId: phoneNumberId.trim(),
      });
      setConfig(result);
      setAccessToken("");
      setSuccess("WhatsApp conectado com sucesso!");
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
      await api.del("/whatsapp/disconnect");
      setConfig((prev) =>
        prev ? { ...prev, isConnected: false, hasAccessToken: false } : null
      );
      setPhoneNumberId("");
      setAccessToken("");
      setSuccess("WhatsApp desconectado");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const isConnected = config?.isConnected;

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
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
            <span className="text-sm text-slate-700 font-medium">
              WhatsApp
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            WhatsApp Business API
          </h1>
          <p className="text-sm text-slate-500">
            Conecte sua conta Meta Business para enviar e receber mensagens.
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
              className="h-5 w-5 text-green-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
            Meta WhatsApp Cloud API
          </code>
        </div>

        {isConnected && config?.connectedAt && (
          <div className="text-xs text-slate-400 mt-1">
            Conectado em:{" "}
            {new Date(config.connectedAt).toLocaleString("pt-BR")}
          </div>
        )}
      </div>

      {/* Config Form — shown when NOT connected */}
      {!isConnected && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Conectar WhatsApp
          </h3>

          <div className="space-y-4">
            {/* Phone Number ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number ID
              </label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Ex: 123456789012345"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1">
                Encontre no painel da Meta: WhatsApp &rarr; API Setup &rarr;
                Phone Number ID
              </p>
            </div>

            {/* Access Token */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Access Token (Permanente)
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Cole seu access token aqui"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">
                Gere um token permanente no painel da Meta: Business Settings
                &rarr; System Users &rarr; Generate Token
              </p>
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
                  <>
                    <span className="font-semibold">Conexao OK!</span> Numero:{" "}
                    {testResult.phoneNumber} ({testResult.displayName})
                  </>
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
                  testing || !phoneNumberId.trim() || !accessToken.trim()
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
                disabled={
                  saving || !phoneNumberId.trim() || !accessToken.trim()
                }
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
            </div>
          </div>
        </div>
      )}

      {/* Webhook Config — shown when connected */}
      {isConnected && config && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Configuracao do Webhook
          </h3>
          <p className="text-xs text-slate-600 mb-4">
            Configure estes dados no{" "}
            <a
              href="https://developers.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              Painel da Meta
            </a>{" "}
            &rarr; seu App &rarr; WhatsApp &rarr; Configuration &rarr; Webhook.
          </p>

          {/* Webhook URL */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Callback URL
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white border border-blue-200 px-3 py-2 text-xs font-mono text-slate-700 break-all">
                {config.webhookUrl}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(config.webhookUrl, "webhookUrl")
                }
                className="flex-shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {copiedField === "webhookUrl" ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Verify Token */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Verify Token
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white border border-blue-200 px-3 py-2 text-xs font-mono text-slate-700 break-all">
                {config.verifyToken}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(config.verifyToken, "verifyToken")
                }
                className="flex-shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {copiedField === "verifyToken" ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Subscribed fields info */}
          <div className="mt-4 pt-3 border-t border-blue-200">
            <p className="text-xs text-slate-500">
              <strong>Campos para assinar no webhook:</strong> messages
            </p>
          </div>
        </div>
      )}

      {/* Disconnect button — shown when connected */}
      {isConnected && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                Desconectar WhatsApp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Isso remove o token de acesso. Voce precisara reconectar para
                enviar mensagens.
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
          Como conectar
        </h3>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              1
            </span>
            <p>
              Acesse{" "}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                developers.facebook.com
              </a>{" "}
              e crie um App do tipo <strong>&quot;Business&quot;</strong>.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              2
            </span>
            <p>
              Adicione o produto <strong>&quot;WhatsApp&quot;</strong> ao seu
              App.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              3
            </span>
            <p>
              Na secao <strong>API Setup</strong>, copie o{" "}
              <strong>Phone Number ID</strong> e gere um{" "}
              <strong>Access Token permanente</strong>.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              4
            </span>
            <p>
              Cole os dados nos campos acima e clique{" "}
              <strong>&quot;Conectar&quot;</strong>.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              5
            </span>
            <p>
              Apos conectar, copie a{" "}
              <strong>Callback URL</strong> e o{" "}
              <strong>Verify Token</strong> para o webhook no painel da Meta.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              6
            </span>
            <p>
              Pronto! Use o{" "}
              <Link
                href="/whatsapp"
                className="text-blue-600 hover:underline font-medium"
              >
                Chat do WhatsApp
              </Link>{" "}
              para conversar e as automacoes enviarao mensagens automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
