"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Boleto, BOLETO_STATUS_CONFIG } from "@/types/finance";
import BoletoStatusBadge from "./BoletoStatusBadge";
import { getAccessToken } from "@/lib/api";

interface Props {
  boleto: Boleto;
  onClose: () => void;
  onRefresh: () => void;
}

export default function BoletoDetailModal({ boleto, onClose, onRefresh }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast(`${label} copiada!`, "success");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRefresh = async () => {
    setLoading("refresh");
    try {
      await api.post(`/boleto/${boleto.id}/refresh`);
      toast("Status atualizado", "success");
      onRefresh();
    } catch (err: any) {
      toast(err?.message || "Erro ao atualizar", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar este boleto?")) return;
    setLoading("cancel");
    try {
      await api.post(`/boleto/${boleto.id}/cancel`, {});
      toast("Boleto cancelado", "success");
      onRefresh();
    } catch (err: any) {
      toast(err?.message || "Erro ao cancelar", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    setLoading("pdf");
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/boleto/${boleto.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Erro ao baixar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boleto-${boleto.nossoNumero}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      toast(err?.message || "Erro ao baixar PDF", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleRegister = async () => {
    setLoading("register");
    try {
      await api.post(`/boleto/${boleto.id}/register`);
      toast("Boleto registrado no banco", "success");
      onRefresh();
    } catch (err: any) {
      toast(err?.message || "Erro ao registrar", "error");
    } finally {
      setLoading(null);
    }
  };

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR");

  const canCancel = ["REGISTERED", "OVERDUE"].includes(boleto.status);
  const canRefresh = ["REGISTERED", "OVERDUE", "REGISTERING"].includes(boleto.status);
  const canDownloadPdf = ["REGISTERED", "OVERDUE"].includes(boleto.status);
  const canRegister = ["DRAFT", "REJECTED"].includes(boleto.status);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Detalhes do Boleto</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <BoletoStatusBadge status={boleto.status} />
            {boleto.boletoConfig && (
              <span className="text-xs text-slate-500">{boleto.boletoConfig.bankName}</span>
            )}
          </div>

          {/* Erro */}
          {boleto.errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {boleto.errorMessage}
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Valor</div>
              <div className="font-medium">{formatCents(boleto.amountCents)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Vencimento</div>
              <div className="font-medium">{formatDate(boleto.dueDate)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Nosso Numero</div>
              <div className="font-mono text-xs">{boleto.nossoNumero}</div>
            </div>
            {boleto.paidAmountCents && (
              <div>
                <div className="text-xs text-slate-500">Valor Pago</div>
                <div className="font-medium text-green-700">{formatCents(boleto.paidAmountCents)}</div>
              </div>
            )}
          </div>

          {/* Sacado */}
          <div className="text-sm">
            <div className="text-xs text-slate-500 mb-1">Sacado (Pagador)</div>
            <div className="font-medium">{boleto.payerName}</div>
            <div className="text-xs text-slate-500">{boleto.payerDocumentType}: {boleto.payerDocument}</div>
          </div>

          {/* Linha digitavel */}
          {boleto.linhaDigitavel && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Linha Digitavel</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-slate-50 p-2 rounded border break-all">
                  {boleto.linhaDigitavel}
                </code>
                <button
                  onClick={() => copyToClipboard(boleto.linhaDigitavel!, "Linha digitavel")}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  {copied === "Linha digitavel" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          {/* Codigo de barras */}
          {boleto.codigoBarras && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Codigo de Barras</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-slate-50 p-2 rounded border break-all">
                  {boleto.codigoBarras}
                </code>
                <button
                  onClick={() => copyToClipboard(boleto.codigoBarras!, "Codigo de barras")}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  {copied === "Codigo de barras" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          {/* PIX */}
          {boleto.pixCopiaECola && (
            <div>
              <div className="text-xs text-slate-500 mb-1">PIX Copia e Cola</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-slate-50 p-2 rounded border break-all max-h-20 overflow-y-auto">
                  {boleto.pixCopiaECola}
                </code>
                <button
                  onClick={() => copyToClipboard(boleto.pixCopiaECola!, "PIX")}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  {copied === "PIX" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
            {boleto.registeredAt && <div>Registrado: {formatDate(boleto.registeredAt)}</div>}
            {boleto.paidAt && <div>Pago: {formatDate(boleto.paidAt)}</div>}
            {boleto.cancelledAt && <div>Cancelado: {formatDate(boleto.cancelledAt)}</div>}
          </div>
        </div>

        {/* Acoes */}
        <div className="p-5 border-t border-slate-200 flex gap-2 flex-wrap">
          {canRegister && (
            <button
              onClick={handleRegister}
              disabled={loading === "register"}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === "register" ? "Registrando..." : "Registrar no Banco"}
            </button>
          )}
          {canDownloadPdf && (
            <button
              onClick={handleDownloadPdf}
              disabled={loading === "pdf"}
              className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded hover:bg-slate-800 disabled:opacity-50"
            >
              {loading === "pdf" ? "Baixando..." : "Download PDF"}
            </button>
          )}
          {canRefresh && (
            <button
              onClick={handleRefresh}
              disabled={loading === "refresh"}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50"
            >
              {loading === "refresh" ? "Atualizando..." : "Atualizar Status"}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={loading === "cancel"}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {loading === "cancel" ? "Cancelando..." : "Cancelar Boleto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
