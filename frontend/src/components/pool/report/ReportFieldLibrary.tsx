"use client";

// Biblioteca de campos/blocos ("biblia") do EngineReporter.
// Painel hierarquico por ORIGEM (acordeao: 1 aberto por vez, minimiza ao perder foco),
// com busca (centenas de campos) e fontes pequenas. Clicar num item insere a caixa na pagina.
import { useRef, useState } from "react";
import { REPORT_FIELD_CATALOG, CatalogField } from "./reportFieldCatalog";

export default function ReportFieldLibrary({ onInsertText, onInsertBlock, onClose, sourceId, onPickLine }: {
  onInsertText: (token: string) => void;
  onInsertBlock: (blockType: string) => void;
  onClose?: () => void;
  sourceId?: string; // se vier, escopa o painel a UMA origem (a do layout) — esconde as outras
  onPickLine?: () => void; // abre o picker de etapa/linha (LineRefPicker) — so faz sentido p/ obras
}) {
  // Escopo: layout ligado a uma origem mostra SO os campos dela (evita inserir campo de outra origem).
  const sources = sourceId ? REPORT_FIELD_CATALOG.filter((s) => s.id === sourceId) : REPORT_FIELD_CATALOG;
  const [open, setOpen] = useState<string | null>(sourceId ?? "orcamento_obras"); // 1 origem aberta
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null); // token copiado (feedback)
  const panelRef = useRef<HTMLDivElement>(null);
  const query = q.trim().toLowerCase();

  const insert = (f: CatalogField) => {
    if (f.kind === "block" && f.blockType) onInsertBlock(f.blockType);
    else if (f.token) onInsertText(f.token);
  };
  // Clicar no codigo: copia pro clipboard pra colar dentro de um texto (NAO insere caixa).
  const copyToken = (token: string) => {
    try { navigator.clipboard?.writeText(token); } catch { /* clipboard bloqueado: select-all ainda permite copiar */ }
    setCopied(token);
    window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1200);
  };
  const Row = ({ f }: { f: CatalogField }) => {
    const isBlock = f.kind === "block";
    return (
      <div className="group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-slate-700 hover:bg-cyan-50" title={`${f.label}${f.token ? `  ${f.token}` : ""}`}>
        <span className="w-4 shrink-0 text-center">{f.icon || (isBlock ? "🧩" : "🔤")}</span>
        {isBlock ? (
          <span className="shrink-0 font-mono text-[10px] text-cyan-700">▦</span>
        ) : (
          <button type="button" onClick={() => copyToken(f.token!)}
            title="Clique pra copiar o código e colar dentro de um texto"
            className="shrink-0 cursor-copy select-all rounded bg-slate-100 px-1 font-mono text-[10px] text-cyan-700 hover:bg-cyan-100">
            {copied === f.token ? "copiado!" : f.token}
          </button>
        )}
        <span className="truncate text-slate-600">{f.label}</span>
        <button type="button" onClick={() => insert(f)} title="Inserir caixa do campo na página"
          className="ml-auto shrink-0 rounded bg-cyan-600 px-1.5 text-[11px] font-bold leading-tight text-white opacity-60 group-hover:opacity-100">+</button>
      </div>
    );
  };

  return (
    <div ref={panelRef} tabIndex={-1}
      className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">📚 Campos &amp; blocos</span>
        {onClose ? <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" title="Fechar">✕</button> : null}
      </div>
      <div className="border-b border-slate-200 p-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campo… (ex: cliente, total)"
          className="w-full rounded border border-slate-300 px-2 py-1 text-[11px]" />
      </div>
      {onPickLine && (
        <button type="button" onClick={onPickLine} title="Escolher uma linha do modelo de obra (etapa → linha) e inserir produto/qtd/valor"
          className="m-1.5 flex items-center justify-center gap-1 rounded border border-violet-300 bg-violet-50 px-2 py-1.5 text-[11px] font-semibold text-violet-800 hover:bg-violet-100">
          🔗 Campo de etapa/linha…
        </button>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {query ? (
          // Busca: lista achatada (origem › subgrupo) ao lado
          sources.flatMap((s) => s.groups.flatMap((g) => g.fields
            .filter((f) => (f.label + " " + (f.token || f.blockType || "") + " " + g.label + " " + s.label).toLowerCase().includes(query))
            .map((f) => ({ s, g, f }))
          )).slice(0, 250).map(({ s, g, f }, i) => (
            <div key={s.id + i}>
              <div className="px-1 pt-1 text-[9px] text-slate-400">{s.icon} {s.label} › {g.label}</div>
              <Row f={f} />
            </div>
          ))
        ) : (
          sources.map((s) => {
            const count = s.groups.reduce((n, g) => n + g.fields.length, 0);
            return (
              <div key={s.id} className="mb-0.5">
                <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)}
                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] font-semibold ${open === s.id ? "bg-cyan-100 text-cyan-800" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className="w-4 shrink-0 text-center">{open === s.id ? "▾" : "▸"}</span>
                  <span>{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                  {s.live ? <span className="ml-auto rounded-full bg-emerald-100 px-1.5 text-[9px] text-emerald-700">dados reais</span> : <span className="ml-auto text-[9px] text-slate-400">{count}</span>}
                </button>
                {open === s.id ? (
                  <div className="ml-1.5 border-l border-slate-200 pl-1">
                    {s.groups.map((g, gi) => (
                      <div key={gi} className="mb-0.5">
                        <div className="flex items-center gap-1 px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          <span>{g.icon}</span><span className="truncate">{g.label}</span>
                        </div>
                        {g.fields.map((f, fi) => <Row key={fi} f={f} />)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-slate-200 px-2 py-1 text-[9px] text-slate-400">Clique no <b>+</b> pra inserir a caixa na folha • clique no <b>código</b> pra copiar e colar dentro de um texto.</div>
    </div>
  );
}
