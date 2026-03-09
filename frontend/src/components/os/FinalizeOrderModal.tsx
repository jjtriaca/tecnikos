"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";

interface FinalizeEntry {
  type: "RECEIVABLE" | "PAYABLE";
  partnerName: string | null;
  description: string;
  grossCents: number;
  commissionBps: number;
  commissionCents: number;
  netCents: number;
}

interface FinalizePreview {
  needsTechFinalization: boolean;
  techName: string | null;
  osTitle: string;
  osCode: string;
  isReturn: boolean;
  returnPaidToTech: boolean;
  entries: FinalizeEntry[];
}

interface FinalizeOrderModalProps {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onFinalized: () => void;
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinalizeOrderModal({ open, orderId, onClose, onFinalized }: FinalizeOrderModalProps) {
  const [step, setStep] = useState<"loading" | "warning" | "preview" | "confirming" | "error">("loading");
  const [preview, setPreview] = useState<FinalizePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("loading");
      setPreview(null);
      setError(null);
      return;
    }
    // Load preview
    setStep("loading");
    api.get<FinalizePreview>(`/service-orders/${orderId}/finalize-preview`)
      .then((data) => {
        setPreview(data);
        if (data.needsTechFinalization) {
          setStep("warning");
        } else {
          setStep("preview");
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? (err.payload?.message || err.message) : "Erro ao carregar preview");
        setStep("error");
      });
  }, [open, orderId]);

  async function handleConfirm() {
    setStep("confirming");
    try {
      await api.post(`/service-orders/${orderId}/finalize`);
      onFinalized();
    } catch (err) {
      setError(err instanceof ApiError ? (err.payload?.message || err.message) : "Erro ao finalizar OS");
      setStep("error");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in">

        {/* Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-500">Carregando...</p>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">Erro</h3>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Warning about incomplete workflow */}
        {step === "warning" && preview && (
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">Workflow Incompleto</h3>
                <p className="mt-1 text-sm text-slate-500">
                  O técnico <strong className="text-slate-700">{preview.techName || "atribuído"}</strong> ainda não finalizou o serviço{" "}
                  <strong className="text-slate-700">{preview.osCode ? `${preview.osCode} — ` : ""}{preview.osTitle}</strong>.
                </p>
                <p className="mt-2 text-sm text-slate-500">Deseja finalizar a OS mesmo assim?</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => setStep("preview")}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Financial entries preview */}
        {step === "preview" && preview && (
          <div>
            <h3 className="text-base font-semibold text-slate-900">Confirmar Finalização</h3>
            <p className="mt-1 text-sm text-slate-500">Os seguintes lançamentos financeiros serão criados:</p>

            <div className="mt-4 space-y-3">
              {preview.entries.map((entry, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      entry.type === "RECEIVABLE"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {entry.type === "RECEIVABLE" ? "A Receber" : "A Pagar"}
                    </span>
                    {entry.partnerName && (
                      <span className="text-sm text-slate-600">{entry.partnerName}</span>
                    )}
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Valor bruto</dt>
                      <dd className="text-slate-900">{formatCurrency(entry.grossCents)}</dd>
                    </div>
                    {entry.type === "PAYABLE" && entry.commissionBps > 0 && (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Comissão ({(entry.commissionBps / 100).toFixed(2)}%)</dt>
                          <dd className="text-slate-500">- {formatCurrency(entry.commissionCents)}</dd>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1">
                          <dt className="font-medium text-slate-700">Valor líquido (técnico)</dt>
                          <dd className="font-medium text-slate-900">{formatCurrency(entry.netCents)}</dd>
                        </div>
                      </>
                    )}
                    {entry.type === "RECEIVABLE" && (
                      <div className="flex justify-between">
                        <dt className="font-medium text-slate-700">Valor a receber</dt>
                        <dd className="font-medium text-green-700">{formatCurrency(entry.netCents)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}

              {preview.entries.length === 0 && (
                <p className="text-sm text-slate-400 italic">Nenhum lançamento será criado (sem cliente ou técnico atribuído)</p>
              )}

              {preview.isReturn && !preview.returnPaidToTech && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-700">Retorno de atendimento — técnico não receberá comissão neste serviço</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Confirmar e Finalizar
              </button>
            </div>
          </div>
        )}

        {/* Confirming state */}
        {step === "confirming" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <svg className="h-8 w-8 animate-spin text-green-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-500">Finalizando OS e criando lançamentos...</p>
          </div>
        )}
      </div>
    </div>
  );
}
