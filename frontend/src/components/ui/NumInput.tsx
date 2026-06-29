"use client";

// NumInput — input numerico COMPARTILHADO (system-wide). Resolve o bug do "0 que gruda":
// usa estado de texto LOCAL e deixa o campo VAZIO quando o valor e 0 (placeholder), sincronizando
// com o valor externo so quando NAO focado. Backspace apaga normal; nao volta pra "0" sozinho.
// Origem: copia do NumInput de quotes/pool/new (extraido pra cca). Drop-in: value/onChange/etc.
import { useEffect, useRef, useState } from "react";

export default function NumInput({ value, onChange, placeholder, className, title, onFocus, onBlur }: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const focused = useRef(false);
  // Sincroniza com o valor externo so quando NAO focado (carregar dado / sugestao auto).
  useEffect(() => {
    if (!focused.current) setText(value ? String(value) : "");
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      title={title}
      className={className}
      onFocus={() => { focused.current = true; onFocus?.(); }}
      onChange={(e) => {
        let v = e.target.value.replace(",", ".").replace(/[^0-9.-]/g, "");
        const dot = v.indexOf(".");
        if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 2);
        setText(v);
        const n = parseFloat(v);
        onChange(isNaN(n) ? 0 : n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = parseFloat(text);
        if (isNaN(n)) { setText(""); onChange(0); }
        else { const r = Math.round(n * 100) / 100; setText(r ? String(r) : ""); onChange(r); }
        onBlur?.();
      }}
    />
  );
}
