"use client";
// Componente "?" tooltip — padrao system-wide pra exibir explicacoes longas
// sem poluir o layout. Comportamento (originado em v1.11.49 AutoSelectModal):
//   - Hover no botao "?" → popover aparece (via CSS group/peer)
//   - Click no "?" → popover FIXA, fecha so ao clicar fora (via mousedown listener global)
//   - Acessibilidade: aria-label + cursor-help
//
// Ver memory/feedback_ui_help_hint_pattern.md pra padrao consolidado.

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Texto da explicacao (mostrado no popover) */
  text: string;
  /** Posicao do popover: 'right' (default) ou 'left' */
  align?: "left" | "right";
  /** Largura do popover (default 18rem) */
  width?: string;
  /** Estilo de cor: 'slate' (default), 'violet', 'cyan' */
  tone?: "slate" | "violet" | "cyan" | "amber";
}

export function HelpHint({ text, align = "right", width = "w-72", tone = "slate" }: Props) {
  const [pinned, setPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pinned) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    }
    // setTimeout 0 — evita que o proprio click que setou pinned dispare o listener
    const t = setTimeout(() => document.addEventListener("mousedown", onMouseDown), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onMouseDown); };
  }, [pinned]);

  const tones = {
    slate: { btn: "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600", pop: "border-slate-300" },
    violet: { btn: "border-violet-300 bg-violet-100 hover:bg-violet-200 text-violet-700", pop: "border-violet-300" },
    cyan: { btn: "border-cyan-300 bg-cyan-100 hover:bg-cyan-200 text-cyan-700", pop: "border-cyan-300" },
    amber: { btn: "border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-700", pop: "border-amber-300" },
  };
  const t = tones[tone];

  return (
    <div ref={containerRef} className="group/help relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPinned(!pinned); }}
        aria-label="Ajuda"
        className={`inline-flex items-center justify-center rounded-full border ${t.btn} w-4 h-4 text-[10px] font-bold cursor-help transition leading-none`}
      >
        ?
      </button>
      <div
        className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} mt-1 z-50 ${width} rounded-lg border ${t.pop} bg-white shadow-lg p-2.5 text-[11px] text-slate-700 leading-snug ${
          pinned ? "" : "invisible group-hover/help:visible pointer-events-none"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * Helper component que combina label + HelpHint pra usar em forms.
 * Substitui o padrao antigo de "label + hint de 3 linhas embaixo do input".
 */
export function FieldLabel({ children, help, htmlFor, className = "", tone = "slate" }: { children: React.ReactNode; help?: string; htmlFor?: string; className?: string; tone?: "slate" | "violet" | "cyan" | "amber" }) {
  return (
    <label htmlFor={htmlFor} className={`flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1 ${className}`}>
      <span>{children}</span>
      {help && <HelpHint text={help} tone={tone} />}
    </label>
  );
}
