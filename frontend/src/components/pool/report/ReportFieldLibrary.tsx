"use client";

// Biblioteca de campos/blocos ("biblia") do EngineReporter.
// Painel hierarquico por ORIGEM (acordeao: 1 aberto por vez, minimiza ao perder foco),
// com busca (centenas de campos) e fontes pequenas. Clicar num item insere a caixa na pagina.
import { useRef, useState } from "react";
import { REPORT_FIELD_CATALOG, CatalogField } from "./reportFieldCatalog";

export default function ReportFieldLibrary({ onInsertText, onInsertBlock, onClose }: {
  onInsertText: (token: string) => void;
  onInsertBlock: (blockType: string) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState<string | null>("orcamento_piscina"); // 1 grupo aberto
  const [q, setQ] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const query = q.trim().toLowerCase();

  const insert = (f: CatalogField) => {
    if (f.kind === "block" && f.blockType) onInsertBlock(f.blockType);
    else if (f.token) onInsertText(f.token);
  };
  // Minimiza (fecha acordeao) ao perder o foco do painel.
  const onBlurPanel = () => { setTimeout(() => { if (!panelRef.current?.contains(document.activeElement)) setOpen(null); }, 120); };

  const Row = ({ f }: { f: CatalogField }) => (
    <button type="button" onClick={() => insert(f)} title={`Inserir ${f.token || f.blockType}`}
      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-slate-700 hover:bg-cyan-50">
      <span className="w-4 shrink-0 text-center">{f.icon || (f.kind === "block" ? "🧩" : "🔤")}</span>
      <span className="shrink-0 font-mono text-[10px] text-cyan-700">{f.kind === "block" ? "▦" : f.token}</span>
      <span className="truncate text-slate-600">{f.label}</span>
    </button>
  );

  return (
    <div ref={panelRef} onBlur={onBlurPanel} tabIndex={-1}
      className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">📚 Campos &amp; blocos</span>
        {onClose ? <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" title="Fechar">✕</button> : null}
      </div>
      <div className="border-b border-slate-200 p-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campo… (ex: cliente, total)"
          className="w-full rounded border border-slate-300 px-2 py-1 text-[11px]" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {query ? (
          // Busca: lista achatada com a origem ao lado
          REPORT_FIELD_CATALOG.flatMap((s) => s.fields
            .filter((f) => (f.label + " " + (f.token || f.blockType || "")).toLowerCase().includes(query))
            .map((f) => ({ s, f }))
          ).slice(0, 200).map(({ s, f }, i) => (
            <div key={s.id + i} className="flex items-center gap-1">
              <span className="w-4 shrink-0 text-center text-[11px]" title={s.label}>{s.icon}</span>
              <div className="min-w-0 flex-1"><Row f={f} /></div>
            </div>
          ))
        ) : (
          REPORT_FIELD_CATALOG.map((s) => (
            <div key={s.id} className="mb-0.5">
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)}
                className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] font-semibold ${open === s.id ? "bg-cyan-100 text-cyan-800" : "text-slate-700 hover:bg-slate-100"}`}>
                <span className="w-4 shrink-0 text-center">{open === s.id ? "▾" : "▸"}</span>
                <span>{s.icon}</span>
                <span className="truncate">{s.label}</span>
                {s.live ? <span className="ml-auto rounded-full bg-emerald-100 px-1.5 text-[9px] text-emerald-700">dados reais</span> : <span className="ml-auto text-[9px] text-slate-400">{s.fields.length}</span>}
              </button>
              {open === s.id ? (
                <div className="ml-2 border-l border-slate-200 pl-1">
                  {s.fields.map((f, i) => <Row key={i} f={f} />)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-slate-200 px-2 py-1 text-[9px] text-slate-400">Clique num campo pra inserir na folha. Origens sem &quot;dados reais&quot; inserem o token (resolve quando ligar a fonte).</div>
    </div>
  );
}
