"use client";

// Central de Avisos — painel system-wide que AGREGA os erros/avisos de validacao de
// todas as secoes da pagina de orcamento (geral, dimensoes, aquecimento, borda infinita).
// Cada aviso: secao + mensagem + nivel (erro vermelho = quebra o calculo / aviso amarelo =
// conferir). Clicar no aviso rola a tela ate a secao. O save da pagina bloqueia/confirma
// quando ha nivel "erro". Pedido do usuario (02/06) — evita erro silencioso (ex.: altura
// em cm digitada como metros). Reaproveitavel em outros cadastros.

import { useState } from "react";

export interface Aviso {
  id: string;
  secao: string; // "Geral" | "Dimensoes" | "Aquecimento" | "Borda Infinita"
  mensagem: string;
  nivel: "erro" | "aviso";
  anchor?: string; // id do elemento da secao pra rolar ate
}

export function CentralAvisos({ avisos }: { avisos: Aviso[] }) {
  const [open, setOpen] = useState(true);
  const erros = avisos.filter((a) => a.nivel === "erro").length;
  const warns = avisos.filter((a) => a.nivel === "aviso").length;

  if (avisos.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        ✓ Sem avisos — os campos preenchidos parecem coerentes.
      </div>
    );
  }

  const go = (anchor?: string) => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const hasErr = erros > 0;

  return (
    <div className={"rounded-xl border shadow-sm " + (hasErr ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left">
        <span className={"text-sm font-bold " + (hasErr ? "text-red-800" : "text-amber-800")}>
          ⚠ Central de avisos —{" "}
          {erros > 0 && <span className="text-red-700">{erros} erro{erros > 1 ? "s" : ""}</span>}
          {erros > 0 && warns > 0 && " · "}
          {warns > 0 && <span className="text-amber-700">{warns} aviso{warns > 1 ? "s" : ""}</span>}
        </span>
        <span className="flex-shrink-0 text-xs text-slate-500">{open ? "▼ ocultar" : "▶ ver"}</span>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-white/70 px-4 py-2">
          {avisos.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => go(a.anchor)} className="flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-[12px] hover:bg-white/50">
                <span className="flex-shrink-0">{a.nivel === "erro" ? "🔴" : "🟡"}</span>
                <span className="text-slate-700"><b>{a.secao}:</b> {a.mensagem}{a.anchor && <span className="ml-1 text-blue-600 underline">ir</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
