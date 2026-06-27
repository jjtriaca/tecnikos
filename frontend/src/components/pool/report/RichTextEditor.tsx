"use client";

/**
 * RichTextEditor — editor de texto VISUAL (WYSIWYG) com barra CONTEXTUAL.
 * Selecione o texto -> a barra (fonte/tamanho/cor/B/I/S/alinhamento) aplica na
 * selecao E REFLETE o estado da selecao (negrito/italico/sublinhado ativos +
 * fonte/tamanho/cor lidos do trecho selecionado). Sem lib externa: usa
 * contentEditable + document.execCommand (nativo do navegador). Saida = HTML
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

// fontFamily computada -> value do FONTS (match pela 1a familia)
function matchFont(computed: string): string {
  const c = (computed || "").toLowerCase();
  for (const [v] of FONTS) {
    if (!v) continue;
    const first = v.split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
    if (first && c.includes(first)) return v;
  }
  return "";
}
// "rgb(r, g, b)" -> "#rrggbb"
function rgbToHex(rgb: string): string {
  const m = (rgb || "").match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  return "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}

export default function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // BUG FIX (v1.14.x): ao clicar num <select>/<input color> da barra, o foco SAI do
  // contentEditable e a selecao COLAPSA -> execCommand rodava no vazio (negrito/cor/etc
  // nao aplicavam). Guardamos o ultimo Range valido dentro do editor e o RESTAURAMOS
  // antes de cada comando. (Botoes B/I/S/alinhar usam onMouseDown preventDefault, que ja
  // mantem o foco; mas restaurar tambem cobre os selects/cor.)
  const savedRange = useRef<Range | null>(null);
  const [st, setSt] = useState({ bold: false, italic: false, underline: false, fontName: "", sizePt: "", color: "#000000" });

  // Conteudo inicial — so na montagem (evita reset do cursor enquanto digita).
  // O componente e remontado (key) ao trocar de bloco, entao re-inicializa certo.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML || "");

  // Guarda o Range atual se estiver DENTRO do editor (chamado em mouseup/keyup/focus).
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (ref.current && ref.current.contains(r.commonAncestorContainer)) {
        savedRange.current = r.cloneRange();
      }
    }
  };
  // Restaura a selecao guardada e devolve o foco ao editor (antes de cada execCommand).
  const restoreRange = () => {
    const sel = window.getSelection();
    ref.current?.focus();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  // Le o estado da selecao (B/I/S + fonte/tamanho/cor) e reflete na barra.
  const refreshState = () => {
    saveRange();
    let bold = false, italic = false, underline = false;
    try {
      bold = document.queryCommandState("bold");
      italic = document.queryCommandState("italic");
      underline = document.queryCommandState("underline");
    } catch { /* noop */ }
    let fontName = "", sizePt = "", color = "#000000";
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      let n: Node | null = sel.anchorNode;
      if (n && n.nodeType === 3) n = (n as Text).parentElement;
      if (n && n.nodeType === 1 && ref.current?.contains(n)) {
        const cs = window.getComputedStyle(n as Element);
        fontName = matchFont(cs.fontFamily);
        sizePt = String(Math.round((parseFloat(cs.fontSize) || 0) * 72 / 96));
        color = rgbToHex(cs.color);
      }
    }
    setSt({ bold, italic, underline, fontName, sizePt, color });
  };

  const exec = (cmd: string, val?: string) => {
    restoreRange();
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* noop */ }
    document.execCommand(cmd, false, val);
    emit();
    refreshState();
  };

  // Tamanho em PT: marca a selecao com fontSize=7 e converte pra span style (pt exato).
  const applyFontSize = (pt: string) => {
    if (!pt) return;
    restoreRange();
    document.execCommand("fontSize", false, "7");
    ref.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const s = document.createElement("span");
      s.style.fontSize = `${pt}pt`;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.replaceWith(s);
    });
    ref.current?.focus();
    emit();
    refreshState();
  };

  const btn = (active: boolean) =>
    `h-7 w-7 rounded text-sm font-bold ${active ? "bg-cyan-600 text-white" : "bg-white text-slate-700 border border-slate-300"} hover:bg-cyan-50`;

  const sizeSel = SIZES.map(String).includes(st.sizePt) ? st.sizePt : "";

  return (
    <div className="rounded border border-slate-300">
      {/* Barra contextual — reflete a selecao */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1">
        <select value={st.fontName} onChange={(e) => exec("fontName", e.target.value)} className="rounded border border-slate-300 px-1 py-0.5 text-xs" title="Fonte">
          {FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
        </select>
        <select value={sizeSel} onChange={(e) => applyFontSize(e.target.value)} className="rounded border border-slate-300 px-1 py-0.5 text-xs" title="Tamanho">
          <option value="">Tam.</option>
          {SIZES.map((s) => <option key={s} value={s}>{s}pt</option>)}
        </select>
        <label className="flex items-center gap-1 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs" title="Cor do texto">
          A<input type="color" value={st.color} onChange={(e) => exec("foreColor", e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        </label>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={btn(st.bold)} title="Negrito">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={btn(st.italic) + " italic"} title="Italico">I</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className={btn(st.underline) + " underline"} title="Sublinhado">U</button>
        <span className="mx-0.5 h-5 w-px bg-slate-300" />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")} className={btn(false)} title="Esquerda">⯇</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")} className={btn(false)} title="Centro">≡</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyRight")} className={btn(false)} title="Direita">⯈</button>
      </div>
      {/* Area editavel */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onFocus={refreshState}
        onBlur={emit}
        className="rp-inline-edit min-h-[90px] max-h-[220px] overflow-auto px-2 py-1.5 text-sm text-slate-900 focus:outline-none"
      />
    </div>
  );
}
