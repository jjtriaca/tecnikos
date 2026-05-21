"use client";
// Componente "?" tooltip — padrao system-wide pra exibir explicacoes longas
// sem poluir o layout.
//
// V2 (v1.11.57+): usa createPortal pra renderizar o popover no document.body,
// position: fixed com top/left calculados via ref do botao. Isso evita que o
// popover seja cortado por containers pai com overflow: hidden/auto (ex: modal
// de edicao de produto com scroll).
//
// Comportamento:
//   - Hover no "?" → popover aparece
//   - Click no "?" → popover FIXA, fecha so ao clicar fora
//   - Reposiciona automaticamente se sair da viewport (espelha pra esquerda/cima)
//
// Ver memory/feedback_ui_help_hint_pattern.md.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  text: string;
  /** Largura do popover em pixels (default 288 = 18rem) */
  width?: number;
  /** Estilo de cor */
  tone?: "slate" | "violet" | "cyan" | "amber";
}

const TONES = {
  slate: { btn: "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600", pop: "border-slate-300" },
  violet: { btn: "border-violet-300 bg-violet-100 hover:bg-violet-200 text-violet-700", pop: "border-violet-300" },
  cyan: { btn: "border-cyan-300 bg-cyan-100 hover:bg-cyan-200 text-cyan-700", pop: "border-cyan-300" },
  amber: { btn: "border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-700", pop: "border-amber-300" },
};

export function HelpHint({ text, width = 288, tone = "slate" }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  function updatePosition() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    // Estimativa de altura — pode crescer com texto longo, mas eh aproximacao OK
    const popH = 120;
    // Posicao horizontal: tenta alinhar com botao mas garante que cabe na tela
    let left = r.left;
    if (left + width > viewW - 8) left = viewW - width - 8;
    if (left < 8) left = 8;
    // Posicao vertical: abaixo do botao se cabe, senao acima
    let top = r.bottom + 4;
    if (top + popH > viewH - 8) top = Math.max(8, r.top - popH - 4);
    setPos({ top, left });
  }

  function handleMouseEnter() {
    if (pinned) return;
    updatePosition();
    setOpen(true);
  }
  function handleMouseLeave() {
    if (!pinned) setOpen(false);
  }
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (pinned) {
      setPinned(false);
      setOpen(false);
    } else {
      updatePosition();
      setPinned(true);
      setOpen(true);
    }
  }

  // Reposiciona em resize/scroll quando aberto
  useLayoutEffect(() => {
    if (!open) return;
    function onChange() { updatePosition(); }
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true); // capture pra pegar scroll de containers internos
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open]);

  // Fechar quando clica fora (so quando pinned)
  useEffect(() => {
    if (!pinned) return;
    function onMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setPinned(false);
      setOpen(false);
    }
    const t = setTimeout(() => document.addEventListener("mousedown", onMouseDown), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onMouseDown); };
  }, [pinned]);

  const t = TONES[tone];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        tabIndex={-1}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="Ajuda"
        className={`inline-flex items-center justify-center rounded-full border ${t.btn} w-4 h-4 text-[10px] font-bold cursor-help transition leading-none`}
      >
        ?
      </button>
      {mounted && open && pos && createPortal(
        <div
          ref={popRef}
          onMouseEnter={() => { if (!pinned) setOpen(true); }}
          onMouseLeave={() => { if (!pinned) setOpen(false); }}
          style={{ position: "fixed", top: pos.top, left: pos.left, width }}
          className={`z-[9999] rounded-lg border ${t.pop} bg-white shadow-xl p-2.5 text-[11px] text-slate-700 leading-snug`}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Helper component que combina label + HelpHint pra usar em forms.
 * Substitui o padrao antigo de "label + hint de 3 linhas embaixo do input".
 */
export function FieldLabel({ children, help, htmlFor, className = "", tone = "slate", required = false }: { children: React.ReactNode; help?: string; htmlFor?: string; className?: string; tone?: "slate" | "violet" | "cyan" | "amber"; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={`flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1 ${className}`}>
      <span>{children}</span>
      {required && <span className="text-rose-600 font-bold leading-none" title="Obrigatorio pelo tipo do produto">*</span>}
      {help && <HelpHint text={help} tone={tone} />}
    </label>
  );
}
