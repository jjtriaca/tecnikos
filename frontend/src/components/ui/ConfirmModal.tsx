"use client";

import { ReactNode, useState, useEffect } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Mostra textarea obrigatoria para motivo (ex: cancelamento) */
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  /** Callback alternativo que recebe o motivo digitado */
  onConfirmWithReason?: (reason: string) => void;
}

const VARIANTS = {
  danger: {
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    iconColor: "text-red-500",
    iconBg: "bg-red-100",
    btnColor: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
  },
  warning: {
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-100",
    btnColor: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
  },
  default: {
    icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-100",
    btnColor: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
  },
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
  reasonRequired = false,
  reasonPlaceholder = "Informe o motivo...",
  onConfirmWithReason,
}: ConfirmModalProps) {
  const [reason, setReason] = useState("");

  // Limpar motivo ao abrir/fechar
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  const v = VARIANTS[variant];
  const reasonValid = !reasonRequired || reason.trim().length >= 3;

  function handleConfirm() {
    if (reasonRequired && onConfirmWithReason) {
      onConfirmWithReason(reason.trim());
    } else {
      onConfirm();
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        <div className="flex items-start gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${v.iconBg}`}>
            <svg className={`h-5 w-5 ${v.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={v.icon} />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <div className="mt-1 text-sm text-slate-500">{message}</div>
          </div>
        </div>

        {/* Campo de motivo (opcional) */}
        {reasonRequired && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Motivo *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-400"
              autoFocus
            />
            {reason.length > 0 && reason.trim().length < 3 && (
              <p className="text-xs text-red-500 mt-1">Motivo deve ter pelo menos 3 caracteres</p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reasonValid}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${v.btnColor}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processando...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
