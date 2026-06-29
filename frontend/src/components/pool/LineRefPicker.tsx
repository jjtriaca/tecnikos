"use client";

// LineRefPicker — seletor de linhas (LREF) COMPARTILHADO (v1.14.04, extraido pra cca em 29/06).
// Usado pelo montador de formula (FormulaModal) e auto-selecao/indicador (AutoSelectModal) no
// editor de orcamento, e tambem pelo EngineReporter (inserir campo de etapa/linha no relatorio).
//   • Linhas AGRUPADAS por etapa, todas COLAPSADAS (operador abre a etapa e marca a linha).
//   • Filtra por tipo (kind PRODUCT/SERVICE).
//   • Mostra cellRef + ITEM (slotName) + descricao + a spec detectada, pro operador reconhecer.
// O componente so cuida da SELECAO/visual; cada tela passa o onApply (a logica de inserir difere).
import { useState } from "react";

// Defaults de etapa (espelham quotes/pool/[id]/page.tsx). Mantidos aqui pra o componente ser
// auto-contido; quem tiver labels custom passa via environmentParams.customSections.labels.
const SECTION_LABEL: Record<string, string> = {
  CONSTRUCAO: "Construcao",
  FILTRO: "Filtro",
  CASCATA: "Cascata",
  SPA: "SPA",
  AQUECIMENTO: "Aquecimento",
  ILUMINACAO: "Iluminacao",
  CASA_MAQUINAS: "Casa de Maquinas",
  DISPOSITIVOS: "Dispositivos",
  ACIONAMENTOS: "Acionamentos",
  BORDA_CALCADA: "Borda/Calcada",
  EXECUCAO: "Execucao",
  OUTROS: "Outros",
};
const SECTION_ORDER: string[] = [
  "CONSTRUCAO", "BORDA_CALCADA", "FILTRO", "CASCATA", "SPA",
  "AQUECIMENTO", "ILUMINACAO", "CASA_MAQUINAS", "DISPOSITIVOS",
  "ACIONAMENTOS", "EXECUCAO", "OUTROS",
];

export type LineRefPickerLine = {
  cellRef: string;
  slotName?: string | null;
  description: string;
  poolSection?: string | null;
  kind?: string | null;
  linked: boolean;
  specs: Record<string, any> | null;
  qty?: number;
};

export function LineRefPicker({
  icon, specKey, combine, refKind = 'PRODUCT', lines, environmentParams, sectionOrder,
  selected, onToggle, onApply, onCancel, innerRef,
}: {
  icon?: string;
  specKey: string | null;
  combine: 'sum' | 'max';
  refKind?: 'PRODUCT' | 'SERVICE' | 'ALL'; // ALL = nao filtra por tipo (uso do relatorio)
  lines: LineRefPickerLine[];
  environmentParams?: any;
  sectionOrder?: string[];
  selected: Set<string>;
  onToggle: (cellRef: string) => void;
  onApply: () => void;
  onCancel: () => void;
  innerRef?: { current: HTMLDivElement | null };
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // colapsadas por padrao
  const customLabels = (environmentParams?.customSections?.labels ?? {}) as Record<string, string>;
  const labelFor = (k: string) => customLabels[k] ?? SECTION_LABEL[k] ?? k;
  const eligible = lines.filter((l) => !!l.cellRef && (refKind === 'ALL' || (l.kind || 'PRODUCT') === refKind));
  const groups = new Map<string, LineRefPickerLine[]>();
  for (const l of eligible) {
    const s = l.poolSection || 'OUTROS';
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(l);
  }
  const secOrder = (sectionOrder && sectionOrder.length > 0) ? sectionOrder : SECTION_ORDER;
  const orderedSecs = Array.from(groups.keys()).sort((a, b) => {
    const ia = secOrder.indexOf(a); const ib = secOrder.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return (
    <div ref={innerRef} className="rounded-lg border-2 border-violet-300 bg-violet-50 p-3">
      <div className="text-xs font-bold text-violet-900 mb-1">
        🔗 {icon} Escolha a(s) linha(s) {selected.size > 0 && <span className="text-violet-700">— {selected.size} selecionada(s)</span>}
      </div>
      <div className="text-[11px] text-violet-800 mb-2 leading-tight">
        Abra a etapa e marque a(s) linha(s) que entra(m) no calculo. {combine === 'sum'
          ? 'Varias linhas SOMAM (ex: vazao × qtd de cada).'
          : 'Varias linhas usam o MAIOR valor entre elas.'}
      </div>
      {eligible.length === 0 ? (
        <div className="text-[11px] text-amber-700 italic px-1 py-2">
          {refKind === 'ALL'
            ? 'Nenhuma linha neste modelo (escolha um modelo de obra com linhas).'
            : `Nenhuma linha de ${refKind === 'SERVICE' ? 'servico' : 'produto'} neste orcamento.`}
        </div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {orderedSecs.map((sec) => {
            const lns = groups.get(sec)!;
            const selCount = lns.filter((l) => selected.has(l.cellRef)).length;
            const open = expanded.has(sec);
            return (
              <div key={sec} className="rounded border border-violet-200 bg-white overflow-hidden">
                <button type="button"
                  onClick={() => setExpanded((p) => { const n = new Set(p); if (n.has(sec)) n.delete(sec); else n.add(sec); return n; })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-violet-50">
                  <span className="text-violet-600 text-[10px] w-3 shrink-0">{open ? '▼' : '▶'}</span>
                  <span className="text-xs font-semibold text-slate-800 flex-1 truncate">{labelFor(sec)}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{lns.length} linha{lns.length > 1 ? 's' : ''}</span>
                  {selCount > 0 && <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">{selCount} ✓</span>}
                </button>
                {open && (
                  <div className="border-t border-violet-100 p-1 space-y-1">
                    {lns.map((o) => {
                      const sv = specKey ? Number(o.specs?.[specKey]) : null;
                      const hasSpec = sv !== null && Number.isFinite(sv);
                      const checked = selected.has(o.cellRef);
                      const itemLabel = (o.slotName && o.slotName.trim()) ? o.slotName.trim() : null;
                      return (
                        <label key={o.cellRef}
                          className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer transition ${checked ? 'bg-violet-100 border-violet-500' : 'bg-white border-slate-200 hover:border-violet-400 hover:bg-violet-50'}`}>
                          <input type="checkbox" checked={checked} onChange={() => onToggle(o.cellRef)} className="h-3.5 w-3.5 accent-violet-600 shrink-0" />
                          <span className="font-mono text-[10px] text-violet-700 w-9 shrink-0">{o.cellRef}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs text-slate-800 truncate" title={itemLabel || o.description}>{itemLabel || o.description}</span>
                            {itemLabel && o.description && o.description !== itemLabel && (
                              <span className="block text-[10px] text-slate-500 truncate" title={o.description}>{o.description}</span>
                            )}
                          </span>
                          {hasSpec
                            ? <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">{specKey}={sv}</span>
                            : (specKey ? <span className="text-[10px] text-amber-700 shrink-0">sem {specKey}</span> : null)}
                          {specKey && combine === 'sum' && Number(o.qty) > 0 && <span className="text-[10px] text-slate-500 shrink-0">×{Number(o.qty)}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button type="button" disabled={selected.size === 0} onClick={onApply}
          className="rounded bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1 text-xs font-semibold">
          Aplicar {selected.size > 0 && `(${selected.size})`}
        </button>
        <button type="button" onClick={onCancel} className="text-[10px] text-violet-700 hover:text-violet-900 underline">Cancelar</button>
      </div>
    </div>
  );
}
