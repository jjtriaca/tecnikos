"use client";

/**
 * CardLast4Input — Input padronizado pros 4 ultimos digitos do cartao do CLIENTE
 * em recebimentos via cartao. Usar em qualquer form de lancamento RECEIVABLE
 * (finance, QuickCreate, EarlyFinancial, OS, etc.).
 *
 * Auto-filtra so digitos e limita a 4 caracteres.
 * Value pode ser "" (nao preenchido) ou 4 digitos.
 */

import React from "react";

export interface CardLast4InputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  hint?: string;
  /** Se true, destaca em amber quando vazio (util pra required visual) */
  emphasize?: boolean;
}

export default function CardLast4Input({
  value,
  onChange,
  label = "Últimos 4 dígitos do cartão",
  required = false,
  disabled = false,
  className = "",
  placeholder = "1234",
  hint,
  emphasize = false,
}: CardLast4InputProps) {
  function handleChange(raw: string) {
    const digitsOnly = raw.replace(/\D/g, "").slice(0, 4);
    onChange(digitsOnly);
  }

  const needsFill = emphasize && required && value.length !== 4;

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm font-mono select-none">••••</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-24 rounded-lg border px-3 py-2 text-sm font-mono tracking-wider text-center focus:outline-none focus:ring-1 ${
            needsFill
              ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500"
              : "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
          } disabled:bg-slate-100 disabled:cursor-not-allowed`}
          aria-label={label}
        />
        {value.length > 0 && value.length < 4 && (
          <span className="text-[10px] text-amber-600">Digite 4 dígitos</span>
        )}
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Helper: determina se um PaymentInstrument (ou PaymentMethod code) representa cartao.
 * Use pra decidir se mostra o input de cardLast4 ou nao.
 */
export function isCardPayment(opts: {
  paymentMethodCode?: string | null;
  requiresBrand?: boolean | null;
}): boolean {
  if (opts.requiresBrand) return true;
  const code = (opts.paymentMethodCode || "").toUpperCase();
  return (
    code.includes("CARTAO") ||
    code.includes("CREDIT") ||
    code.includes("DEBIT") ||
    code === "CARD"
  );
}
