"use client";

// NumInput — input numerico COMPARTILHADO (system-wide). Resolve o bug do "0 que gruda":
// usa estado de texto LOCAL e deixa o campo VAZIO quando o valor e 0 (placeholder), sincronizando
// com o valor externo so quando NAO focado. Backspace apaga normal; nao volta pra "0" sozinho.
// Origem: copia do NumInput de quotes/pool/new (extraido pra cca). Drop-in: value/onChange/etc.
// v1.15.36: setas ▲▼ VISIVEIS via prop `spin` (opt-in) + stepping por teclado ↑/↓ (Shift=10, Alt=0,1).
import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function NumInput({ value, onChange, placeholder, className, title, onFocus, onBlur, spin }: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  spin?: boolean; // mostra setinhas ▲▼ visiveis (opt-in) — usado nos campos de medida do editor
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const focused = useRef(false);
  // Sincroniza com o valor externo so quando NAO focado (carregar dado / sugestao auto).
  useEffect(() => {
    if (!focused.current) setText(value ? String(value) : "");
  }, [value]);
  // Incrementa/decrementa (teclado ↑/↓ ou setinha). Shift=10, Alt=0,1. Base = texto se focado, senao o valor.
  const bump = (sign: number, big: boolean, small: boolean) => {
    const base = focused.current ? (parseFloat((text || "0").replace(",", ".")) || 0) : (value || 0);
    const stepv = big ? 10 : small ? 0.1 : 1;
    const nv = Math.round((base + sign * stepv) * 100) / 100;
    setText(nv ? String(nv) : "");
    onChange(nv);
  };
  const input = (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      title={title}
      className={className}
      style={spin ? { paddingRight: 14 } : undefined}
      onFocus={() => { focused.current = true; onFocus?.(); }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        bump(e.key === "ArrowUp" ? 1 : -1, e.shiftKey, e.altKey);
      }}
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
  if (!spin) return input;
  // Variante com setinhas ▲▼ (opt-in) — sobrepostas na direita do input, nao mudam a largura.
  const btn: CSSProperties = { display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 7, lineHeight: 1, color: "#64748b", cursor: "pointer", background: "transparent", border: 0, padding: 0 };
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {input}
      <span style={{ position: "absolute", top: 2, bottom: 2, right: 2, width: 11, display: "flex", flexDirection: "column" }}>
        <button type="button" tabIndex={-1} title="Aumentar (Shift +10, Alt +0,1)" style={btn} onMouseDown={(e) => { e.preventDefault(); bump(1, e.shiftKey, e.altKey); }}>▲</button>
        <button type="button" tabIndex={-1} title="Diminuir (Shift −10, Alt −0,1)" style={btn} onMouseDown={(e) => { e.preventDefault(); bump(-1, e.shiftKey, e.altKey); }}>▼</button>
      </span>
    </span>
  );
}
