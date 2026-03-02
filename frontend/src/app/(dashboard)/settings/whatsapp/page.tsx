"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

type ConnectionStatus = {
  instance: string;
  state: string;
  statusReason?: number;
};

type QRCodeData = {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
};

export default function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [qrCode, setQrCode] = useState<QRCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<ConnectionStatus>("/whatsapp/status");
      setStatus(data);
      return data;
    } catch {
      setStatus({ instance: "tecnikos", state: "close" });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll status when waiting for QR code scan
  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    };
  }, [fetchStatus]);

  const qrRefreshRef = useRef<NodeJS.Timeout | null>(null);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);

    // Poll status every 3s to detect connection
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus();
      if (s?.state === "open") {
        // Connected! Stop all polling
        if (pollRef.current) clearInterval(pollRef.current);
        if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
        setQrCode(null);
        setSuccess("WhatsApp conectado com sucesso!");
        setTimeout(() => setSuccess(null), 5000);
      }
    }, 3000);

    // Auto-refresh QR code every 15s (WhatsApp QR expires in ~20s)
    qrRefreshRef.current = setInterval(async () => {
      try {
        const data = await api.get<QRCodeData>("/whatsapp/qrcode");
        if (data?.base64) {
          setQrCode(data);
        }
      } catch {
        // If QR fetch fails, try connect again
        try {
          const data = await api.post<QRCodeData & { message: string }>("/whatsapp/connect");
          if (data?.base64) {
            setQrCode(data);
          }
        } catch {
          // ignore
        }
      }
    }, 15000);
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    setQrCode(null);
    try {
      const data = await api.post<QRCodeData & { message: string }>("/whatsapp/connect");
      setQrCode(data);
      startPolling();
    } catch (err: any) {
      setError(err.message || "Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  }

  async function handleGetQR() {
    setError(null);
    try {
      const data = await api.get<QRCodeData>("/whatsapp/qrcode");
      setQrCode(data);
      startPolling();
    } catch (err: any) {
      setError(err.message || "Erro ao obter QR Code");
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await api.del("/whatsapp/logout");
      setStatus({ instance: status?.instance || "tecnikos", state: "close" });
      setQrCode(null);
      setSuccess("WhatsApp desconectado");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleConfigureWebhook() {
    setConfiguring(true);
    setError(null);
    try {
      const result = await api.post<{ message: string; url: string }>("/whatsapp/configure-webhook", {});
      setSuccess(`Webhook configurado: ${result.url}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || "Erro ao configurar webhook");
    } finally {
      setConfiguring(false);
    }
  }

  const isConnected = status?.state === "open";
  const isConnecting = status?.state === "connecting";

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
            <span className="text-sm text-slate-700 font-medium">WhatsApp</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Integracao WhatsApp</h1>
          <p className="text-sm text-slate-500">
            Conecte seu WhatsApp para enviar e receber mensagens automaticamente.
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Status da Conexao
          </h3>

          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isConnected
              ? "bg-green-50 border border-green-200 text-green-700"
              : isConnecting
              ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
              : "bg-slate-100 border border-slate-200 text-slate-600"
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-slate-400"
            }`} />
            {isConnected ? "Conectado" : isConnecting ? "Conectando..." : "Desconectado"}
          </span>
        </div>

        <div className="text-sm text-slate-500 mb-4">
          Instancia: <code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{status?.instance}</code>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!isConnected && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {connecting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Conectando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Conectar WhatsApp
                </>
              )}
            </button>
          )}

          {!isConnected && !qrCode && (
            <button
              onClick={handleGetQR}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Exibir QR Code
            </button>
          )}

          {isConnected && (
            <>
              <button
                onClick={handleConfigureWebhook}
                disabled={configuring}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {configuring ? "Configurando..." : "Configurar Webhook"}
              </button>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* QR Code */}
      {qrCode?.base64 && !isConnected && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2 text-center">
            Escaneie o QR Code com o WhatsApp
          </h3>
          <p className="text-xs text-slate-500 mb-4 text-center">
            Abra o WhatsApp no seu celular &rarr; Configuracoes &rarr; Dispositivos conectados &rarr; Conectar um dispositivo
          </p>
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-lg border border-slate-200">
              <img
                src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                alt="QR Code WhatsApp"
                className="w-64 h-64"
              />
            </div>
          </div>
          {qrCode.pairingCode && (
            <p className="mt-4 text-center text-sm text-slate-600">
              Codigo de pareamento: <code className="font-mono font-bold text-blue-600 text-lg">{qrCode.pairingCode}</code>
            </p>
          )}
          <p className="mt-3 text-center text-xs text-slate-400 animate-pulse">
            Aguardando conexao... O QR Code atualiza automaticamente.
          </p>
        </div>
      )}

      {/* QR Code as text (fallback) */}
      {qrCode?.code && !qrCode?.base64 && !isConnected && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">QR Code (texto)</h3>
          <p className="text-xs text-slate-500 mb-2">
            Se a imagem nao apareceu, copie este codigo e gere o QR manualmente:
          </p>
          <pre className="bg-white rounded-lg p-3 text-xs font-mono text-slate-600 break-all border border-yellow-200 max-h-32 overflow-y-auto">
            {qrCode.code}
          </pre>
        </div>
      )}

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

      {/* Instructions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Como funciona</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">1</span>
            <p>Clique em <strong>&quot;Conectar WhatsApp&quot;</strong> para gerar o QR Code.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">2</span>
            <p>Abra o WhatsApp no celular e escaneie o QR Code (Dispositivos Conectados).</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">3</span>
            <p>Apos conectar, clique em <strong>&quot;Configurar Webhook&quot;</strong> para habilitar o recebimento de mensagens.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">4</span>
            <p>Pronto! As mensagens serao enviadas automaticamente pelas automacoes e voce pode usar o <Link href="/whatsapp" className="text-blue-600 hover:underline font-medium">Chat do WhatsApp</Link> para conversar diretamente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
