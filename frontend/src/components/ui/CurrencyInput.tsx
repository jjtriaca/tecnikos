"use client";

/** Format currency on blur: "350" → "350,00", "80.5" → "80,50" */
function fmtCurrency(value: string): string {
  if (!value) return "";
  const num = parseFloat(value.replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) return value;
  return num.toFixed(2).replace(".", ",");
}

/** Format percentage on blur: "10" → "10,0", "5.5" → "5,5" */
function fmtPercent(value: string): string {
  if (!value) return "";
  const num = parseFloat(value.replace(",", "."));
  if (isNaN(num)) return value;
  return num.toFixed(1).replace(".", ",");
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  format?: "currency" | "percent";
  disabled?: boolean;
  className?: string;
};

export function CurrencyInput({ value, onChange, placeholder, prefix, suffix, format = "currency", disabled, className }: Props) {
  const handleBlur = () => {
    if (format === "currency") onChange(fmtCurrency(value));
    else if (format === "percent") onChange(fmtPercent(value));
  };

  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-lg border border-slate-300 ${prefix ? "pl-9" : "pl-3"} ${suffix ? "pr-7" : "pr-3"} py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 ${className || ""}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">{suffix}</span>}
    </div>
  );
}

export { fmtCurrency, fmtPercent };
