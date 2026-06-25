"use client";

/**
 * RichTextEditor — editor de texto VISUAL (WYSIWYG) com barra CONTEXTUAL.
 * Selecione o texto -> a barra (fonte/tamanho/cor/B/I/S/alinhamento) aplica na
 * selecao e reflete o estado (negrito/italico/sublinhado ativos). Sem lib externa:
 * usa contentEditable + document.execCommand (nativo do navegador). Saida = HTML
 * inline (styleWithCSS), que o relatorio renderiza direto no bloco TEXT.
 *
 * Obs: execCommand e "deprecated" mas funciona em todos os navegadores atuais
 * (Chrome/Edge/Firefox). E o caminho sem dependencia pra um editor de texto.
 */
import { useEffect, useRef, useState } from "react";

const FONTS: [string, string][] = [
  ["", "Fonte"],
  ["Georgia, serif", "Georgia"],
  ["Arial, Helvetica, sans-serif", "Arial"],
  ["'Times New Roman', serif", "Times"],
  ["'Trebuchet MS', sans-serif", "Trebuchet"],
  ["'Courier New', monospace", "Courier"],
];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export default function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ bold: false, italic: false, underline: false });

  // Conteudo inicial — so na montagem (evita reset do cursor enquanto digita).
  // O componente e remontado (key) ao trocar de bloco, entao re-inicializa certo.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML || "");
  const refreshState = () => {
    try {
      setSt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch { /* noop */ }
  };

  const exec = (cmd: string, val?: string) => {
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* noop */ }
    document.execCommand(cmd, false, val);
    ref.current?.focus();
    emit();
    refreshState();
  };

  // Tamanho em PT: marca a selecao com fontSize=7 e converte pra span style (pt exato).
  const applyFontSize = (pt: string) => {
    if (!pt) return;
    document.execCommand("fontSize", false, "7");
    ref.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const s = document.createElement("span");
      s.style.fontSize = `${pt}pt`;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.replaceWith(s);
    });
    ref.current?.focus();
    emit();
  };

  const btn = (active: boolean) =>
    `h-7 w-7 rounded text-sm font-bold ${active ? "bg-cyan-600 text-white" : "bg-white text-slate-700 border border-slate-300"} hover:bg-cyan-50`;

  return (
    <div className="rounded border border-slate-300">
      {/* Barra contextual */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1">
        <select onChange={(e) => exec("fontName", e.target.value)} className="rounded border border-slate-300 px-1 py-0.5 text-xs" title="Fonte" defaultValue="">
          {FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
        </select>
        <select onChange={(e) => { applyFontSize(e.target.value); e.target.selectedIndex = 0; }} className="rounded border border-slate-300 px-1 py-0.5 text-xs" title="Tamanho" defaultValue="">
          <option value="">Tam.</option>
          {SIZES.map((s) => <option key={s} value={s}>{s}pt</option>)}
        </select>
        <label className="flex items-center gap-1 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" title="Cor do texto">
          A<input type="color" onChange={(e) => exec("foreColor", e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        </label>
        <button type="button" onClick={() => exec("bold")} className={btn(st.bold)} title="Negrito">B</button>
        <button type="button" onClick={() => exec("italic")} className={btn(st.italic) + " italic"} title="Italico">I</button>
        <button type="button" onClick={() => exec("underline")} className={btn(st.underline) + " underline"} title="Sublinhado">S</button>
        <span className="mx-0.5 h-5 w-px bg-slate-300" />
        <button type="button" onClick={() => exec("justifyLeft")} className={btn(false)} title="Esquerda">⯇</button>
        <button type="button" onClick={() => exec("justifyCenter")} className={btn(false)} title="Centro">≡</button>
        <button type="button" onClick={() => exec("justifyRight")} className={btn(false)} title="Direita">⯈</button>
      </div>
      {/* Area editavel */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onBlur={emit}
        className="min-h-[90px] max-h-[220px] overflow-auto px-2 py-1.5 text-sm text-slate-900 focus:outline-none"
      />
    </div>
  );
}
