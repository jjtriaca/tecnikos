"use client";

/**
 * CompositionEditor — editor de ARVORE de cards/linhas/blocos (o "montador de cards").
 * Edita ReportNode[] (a composicao de uma pagina, salva em pageConfig.nodes).
 * Aninhamento livre: card dentro de card, linha com colunas, qualquer bloco dentro.
 * Pares com o renderizador recursivo de BudgetReport.ReportNodeView.
 */
import { useEffect, useState } from "react";
import type { ReportNode } from "./BudgetReport";

const genId = () => "n" + Math.random().toString(36).slice(2, 9);

const BLOCK_TYPES: [string, string][] = [
  ["TEXT", "Texto / HTML"],
  ["IMAGE", "Imagem"],
  ["COVER", "Capa"],
  ["PRODUCTS_BY_SECTION", "Produtos por etapa"],
  ["BUDGET_SUMMARY", "Resumo do orcamento"],
  ["TERMS_CONDITIONS", "Termos e condicoes"],
  ["PHOTOS_GALLERY", "Galeria de fotos"],
  ["INSTALLMENTS", "Plano de pagamento"],
  ["CUSTOM_TABLE", "Tabela personalizada"],
  ["HEATING_SOLAR", "Datasheet Coletor Solar"],
  ["HEATING_BOMBA", "Datasheet Bomba de Calor"],
];
const BLOCK_LABEL: Record<string, string> = Object.fromEntries(BLOCK_TYPES);

function newNode(kind: "card" | "row" | "block"): ReportNode {
  if (kind === "card") return { id: genId(), kind: "card", style: { padding: 12, borderColor: "#e2e8f0", borderWidth: 1, radius: 8, bg: "#ffffff" }, children: [] };
  if (kind === "row") return { id: genId(), kind: "row", style: { gap: 8 }, children: [] };
  return { id: genId(), kind: "block", blockType: "TEXT", config: { html: "Novo texto" } };
}

// Modelos de card prontos (o "modelos de cards" pedido). Cada um gera uma sub-arvore nova.
const TEMPLATES: { label: string; make: () => ReportNode }[] = [
  {
    label: "Card titulo + texto",
    make: () => ({ id: genId(), kind: "card", style: { padding: 14, borderColor: "#e2e8f0", borderWidth: 1, radius: 10, bg: "#ffffff" }, children: [
      { id: genId(), kind: "block", blockType: "TEXT", config: { html: "<h3 style='margin:0 0 6px;color:#1e3a8a'>Titulo</h3><p>Texto do card.</p>" } },
    ] }),
  },
  {
    label: "Duas colunas",
    make: () => ({ id: genId(), kind: "row", style: { gap: 10 }, children: [
      { id: genId(), kind: "card", style: { padding: 12, borderColor: "#e2e8f0", borderWidth: 1, radius: 8, bg: "#ffffff" }, children: [{ id: genId(), kind: "block", blockType: "TEXT", config: { html: "Coluna 1" } }] },
      { id: genId(), kind: "card", style: { padding: 12, borderColor: "#e2e8f0", borderWidth: 1, radius: 8, bg: "#ffffff" }, children: [{ id: genId(), kind: "block", blockType: "TEXT", config: { html: "Coluna 2" } }] },
    ] }),
  },
  {
    label: "Card destaque (cor)",
    make: () => ({ id: genId(), kind: "card", style: { padding: 14, radius: 10, bg: "#1e3a8a", textColor: "#ffffff" }, children: [
      { id: genId(), kind: "block", blockType: "TEXT", config: { html: "<b>Destaque</b> — chamada importante." } },
    ] }),
  },
  {
    // Capa comercial EDITAVEL — mesma cara do bloco Capa (cinza cheio ate as bordas, logo no topo,
    // titulo grande no meio, bloco do cliente, rodape), mas TUDO em cards/textos que o operador
    // edita a vontade (posicao, tamanho, cor). Auto-preenche por placeholders ({clientName} etc.).
    // Espacadores (TEXT vazio com flex) empurram o titulo pro meio e o rodape pro pe.
    label: "Capa comercial (cheia)",
    make: () => ({ id: genId(), kind: "card", style: { bleed: true, bg: "#8c8c8c", padding: 56, textColor: "#0f172a" }, children: [
      { id: genId(), kind: "row", style: { gap: 8, justify: "end" }, children: [
        { id: genId(), kind: "block", blockType: "IMAGE", config: { url: "", w: 90, lockAspect: true, alignH: "right" } },
      ] },
      { id: genId(), kind: "block", blockType: "TEXT", style: { flex: 1 }, config: { html: "" } },
      { id: genId(), kind: "block", blockType: "TEXT", config: { html: "<div style='font-size:54px;font-weight:800;line-height:1.05'>Proposta<br>Comercial</div>" } },
      { id: genId(), kind: "block", blockType: "TEXT", style: { flex: 1.3 }, config: { html: "" } },
      { id: genId(), kind: "block", blockType: "TEXT", config: { html: "<div style='font-size:13px;line-height:1.9'><b>Nome:</b> {clientName}<br><b>Cidade:</b> {clientCity}<br><b>Data:</b> {budgetDate}<br><b>Solicitante:</b> {clientName}<br><b>Orcamento no:</b> {budgetCode}</div>" } },
      { id: genId(), kind: "block", blockType: "TEXT", style: { flex: 0.4 }, config: { html: "" } },
      { id: genId(), kind: "block", blockType: "TEXT", style: { textAlign: "center" }, config: { html: "<div style='font-size:10px'>A validade da proposta e de {validityDays} dias. Apos esse periodo, favor consultar se houve alteracao no valor da proposta.</div>" } },
    ] }),
  },
];

// ── Operacoes na arvore (puras, imutaveis) ──────────────────────────────────
function updateNode(nodes: ReportNode[], id: string, patch: Partial<ReportNode>): ReportNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch };
    return n.children ? { ...n, children: updateNode(n.children, id, patch) } : n;
  });
}
function removeNode(nodes: ReportNode[], id: string): ReportNode[] {
  return nodes.filter((n) => n.id !== id).map((n) => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}
function addChild(nodes: ReportNode[], parentId: string, child: ReportNode): ReportNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), child] };
    return n.children ? { ...n, children: addChild(n.children, parentId, child) } : n;
  });
}
function moveNode(nodes: ReportNode[], id: string, dir: "up" | "down"): ReportNode[] {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx >= 0) {
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= nodes.length) return nodes;
    const copy = [...nodes];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  }
  return nodes.map((n) => (n.children ? { ...n, children: moveNode(n.children, id, dir) } : n));
}
function findNode(nodes: ReportNode[], id: string): ReportNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}

// ── Linha da arvore (recursiva) ──────────────────────────────────────────────
function NodeRow({ node, depth, selectedId, onSelect, onAddInto, onMove, onRemove }: {
  node: ReportNode; depth: number; selectedId: string | null;
  onSelect: (id: string) => void; onAddInto: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void; onRemove: (id: string) => void;
}) {
  const isContainer = node.kind === "card" || node.kind === "row";
  const icon = node.kind === "card" ? "🃏" : node.kind === "row" ? "▭" : "🧩";
  const label = node.kind === "block" ? (BLOCK_LABEL[node.blockType || ""] || node.blockType || "Bloco") : node.kind === "card" ? "Card" : "Linha (colunas)";
  return (
    <div>
      <div style={{ paddingLeft: 6 + depth * 16 }}
        className={`flex items-center gap-1 py-1 pr-1 rounded ${selectedId === node.id ? "bg-cyan-50 ring-1 ring-cyan-300" : "hover:bg-slate-50"}`}>
        <span className="text-xs">{icon}</span>
        <button type="button" onClick={() => onSelect(node.id)} className="flex-1 truncate text-left text-xs text-slate-700">{label}</button>
        {isContainer && <button type="button" onClick={() => onAddInto(node.id)} title="Adicionar dentro" className="px-1 text-xs text-cyan-600 hover:text-cyan-800">➕</button>}
        <button type="button" onClick={() => onMove(node.id, "up")} title="Subir" className="px-0.5 text-xs text-slate-400 hover:text-slate-700">⬆</button>
        <button type="button" onClick={() => onMove(node.id, "down")} title="Descer" className="px-0.5 text-xs text-slate-400 hover:text-slate-700">⬇</button>
        <button type="button" onClick={() => onRemove(node.id)} title="Remover" className="px-0.5 text-xs text-red-400 hover:text-red-600">🗑</button>
      </div>
      {(node.children || []).map((c) => (
        <NodeRow key={c.id} node={c} depth={depth + 1} selectedId={selectedId}
          onSelect={onSelect} onAddInto={onAddInto} onMove={onMove} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Controles de TAMANHO da imagem: Largura x Altura (px) com CADEADO de proporcao.
// Cadeado LIGADO (padrao): mexeu num campo, o outro acompanha pela proporcao real da imagem
// (le naturalWidth/naturalHeight) -> nunca distorce. Desligado: livre (so altura ou so largura).
// Alem disso: alinhar Horizontal x Vertical da imagem dentro do card (vertical pede altura no card).
function ImageSizeControls({ cfg, setCfg }: { cfg: any; setCfg: (p: Record<string, any>) => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    if (!cfg.url) { setRatio(null); return; }
    const img = new window.Image();
    img.onload = () => { if (img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight); };
    img.src = cfg.url;
  }, [cfg.url]);
  const locked = cfg.lockAspect !== false; // padrao LIGADO
  const setW = (val: string) => {
    const w = val ? Number(val) : null;
    if (w && locked && ratio) setCfg({ w, h: Math.round(w / ratio) });
    else setCfg({ w });
  };
  const setH = (val: string) => {
    const h = val ? Number(val) : null;
    if (h && locked && ratio) setCfg({ h, w: Math.round(h * ratio) });
    else setCfg({ h });
  };
  const inp = "mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs";
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-end gap-1">
        <label className="block flex-1 text-[11px] text-slate-600">Largura (px)
          <input type="number" min={0} value={cfg.w ?? ""} placeholder="auto" onChange={(e) => setW(e.target.value)} className={inp} /></label>
        <button type="button" title={locked ? "Proporcao TRAVADA — mexer num campo ajusta o outro. Clique pra liberar." : "Proporcao LIVRE — largura e altura independentes. Clique pra travar."}
          onClick={() => setCfg({ lockAspect: !locked })}
          className={`mb-0.5 shrink-0 rounded border px-2 py-1 text-sm ${locked ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-300 bg-white text-slate-400"}`}>{locked ? "🔒" : "🔓"}</button>
        <label className="block flex-1 text-[11px] text-slate-600">Altura (px)
          <input type="number" min={0} value={cfg.h ?? ""} placeholder="auto" onChange={(e) => setH(e.target.value)} className={inp} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-slate-600">Alinhar horizontal
          <select value={cfg.alignH || "left"} onChange={(e) => setCfg({ alignH: e.target.value })} className={inp}>
            <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
          </select></label>
        <label className="block text-[11px] text-slate-600">Alinhar vertical
          <select value={cfg.alignV || "top"} onChange={(e) => setCfg({ alignV: e.target.value })} className={inp}>
            <option value="top">Topo</option><option value="center">Centro</option><option value="bottom">Base</option>
          </select></label>
      </div>
      <div className="text-[10px] text-slate-400">Só um campo preenchido = o outro fica automático (mantém proporção). Alinhar vertical precisa de <b>Altura do card</b>.</div>
    </div>
  );
}

// ── Editor de UM no selecionado ──────────────────────────────────────────────
function NodeInspector({ node, onChange, onUploadImage }: { node: ReportNode; onChange: (patch: Partial<ReportNode>) => void; onUploadImage?: (file: File) => Promise<string> }) {
  const st: any = node.style || {};
  const setStyle = (p: Record<string, any>) => onChange({ style: { ...st, ...p } });
  const cfg: any = node.config || {};
  const setCfg = (p: Record<string, any>) => onChange({ config: { ...cfg, ...p } });

  if (node.kind === "block") {
    return (
      <div className="space-y-2">
        <label className="block text-xs text-slate-600">Tipo de bloco
          <select value={node.blockType || ""} onChange={(e) => onChange({ blockType: e.target.value })}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
            {BLOCK_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {node.blockType === "TEXT" ? (
          <div className="space-y-2">
            <label className="block text-xs text-slate-600">Tamanho do texto do bloco inteiro (pt)
              <input type="number" min={5} max={48} value={st.fontSize ?? ""} placeholder="padrão" onChange={(e) => setStyle({ fontSize: e.target.value ? Number(e.target.value) : null })} className="mt-0.5 w-24 rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
            <div className="rounded border border-cyan-200 bg-cyan-50/60 px-2 py-2 text-xs text-slate-600">
              ✏️ Edite o texto <b>direto na folha</b>: clique no texto, selecione um trecho e formate pela <b>aba Início</b>. Pra mudar o tamanho de TODO o bloco de uma vez, use o campo acima.
            </div>
          </div>
        ) : node.blockType === "IMAGE" ? (
          <div className="block text-xs text-slate-600">Imagem
            <input value={cfg.url || ""} onChange={(e) => setCfg({ url: e.target.value })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="https://... ou envie um arquivo" />
            {onUploadImage ? (
              <div className="mt-1 flex items-center gap-2">
                <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 hover:bg-slate-200">📁 Enviar
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await onUploadImage(f); setCfg({ url }); } catch { /* erro silencioso */ } if (e.target) e.target.value = ""; }} />
                </label>
                {cfg.url ? <img src={cfg.url} alt="" className="h-8 rounded border border-slate-200 bg-white" /> : null}
              </div>
            ) : null}
            {/* Preencher card: imagem ocupa 100% do card (precisa Altura no card pai). */}
            <label className="mt-2 flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
              <input type="checkbox" checked={!!(cfg.fill || cfg.fit === "fill")} onChange={(e) => setCfg({ fill: e.target.checked, fit: null })} />
              Preencher o card 100% (corta a sobra, não distorce)
            </label>
            {cfg.fill || cfg.fit === "fill" ? (
              <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                Defina a <b>Altura do card</b> (no Card pai) — ou deixe a imagem ao lado de um card mais alto (esticar). A imagem ocupa tudo.
              </div>
            ) : (
              <ImageSizeControls cfg={cfg} setCfg={setCfg} />
            )}
          </div>
        ) : (
          <label className="block text-xs text-slate-600">Configuracao (JSON, opcional)
            <textarea defaultValue={cfg && Object.keys(cfg).length ? JSON.stringify(cfg, null, 2) : ""}
              onBlur={(e) => { try { setCfg(e.target.value ? JSON.parse(e.target.value) : {}); } catch { /* ignora json invalido */ } }}
              rows={3} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
              placeholder='Ex: {"showImages": true}' />
          </label>
        )}
      </div>
    );
  }
  if (node.kind === "row") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-600">Espaco entre colunas (px)
          <input type="number" value={st.gap ?? 8} onChange={(e) => setStyle({ gap: Number(e.target.value) })}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        </label>
        <label className="block text-xs text-slate-600">Alinhamento vertical
          <select value={st.align || "stretch"} onChange={(e) => setStyle({ align: e.target.value })}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="stretch">Esticar</option><option value="flex-start">Topo</option>
            <option value="center">Centro</option><option value="flex-end">Base</option>
          </select>
        </label>
        <label className="block text-xs text-slate-600 col-span-2">Distribuir colunas (horizontal)
          <select value={st.justify || "start"} onChange={(e) => setStyle({ justify: e.target.value })}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="start">Esquerda</option><option value="center">Centro</option>
            <option value="end">Direita</option><option value="between">Espaçar entre (extremos colados)</option>
            <option value="around">Espaçar ao redor (margem nas pontas)</option>
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">
          <input type="checkbox" checked={!!st.wrap} onChange={(e) => setStyle({ wrap: e.target.checked })} />
          Quebrar colunas em telas pequenas (empilhar no mobile)
        </label>
        <div className="col-span-2 text-[10px] text-slate-400">A largura de cada coluna é definida em cada <b>Card</b> (Largura %/exata ou Peso). Aqui você controla o espaço, o alinhamento e a quebra entre eles.</div>
      </div>
    );
  }
  // card
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center justify-between gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">Fundo
          <input type="color" value={st.bg || "#ffffff"} onChange={(e) => setStyle({ bg: e.target.value })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
        <label className="flex items-center justify-between gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">Cor do texto
          <input type="color" value={st.textColor || "#0f172a"} onChange={(e) => setStyle({ textColor: e.target.value })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
        <label className="flex items-center justify-between gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">Cor da borda
          <input type="color" value={st.borderColor || "#e2e8f0"} onChange={(e) => setStyle({ borderColor: e.target.value })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
        <label className="flex items-center gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">
          <input type="checkbox" checked={!!st.shadow} onChange={(e) => setStyle({ shadow: e.target.checked })} /> Sombra</label>
      </div>
      <label className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
        <input type="checkbox" checked={!!st.bleed} onChange={(e) => setStyle({ bleed: e.target.checked })} />
        Sangria — capa cheia (fundo vai até as bordas, ocupa a folha toda)
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-xs text-slate-600">Borda (px)
          <input type="number" min={0} value={st.borderWidth ?? 1} onChange={(e) => setStyle({ borderWidth: Number(e.target.value) })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
        <label className="block text-xs text-slate-600">Cantos (px)
          <input type="number" min={0} value={st.radius ?? 8} onChange={(e) => setStyle({ radius: Number(e.target.value) })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
        <label className="block text-xs text-slate-600">Espacamento (px)
          <input type="number" min={0} value={st.padding ?? 12} onChange={(e) => setStyle({ padding: Number(e.target.value) })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
      </div>
      {/* Posicao do card na pagina (tudo editavel) */}
      <div className="rounded border border-slate-200 bg-slate-50 p-2 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Posicao na pagina</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-600">Largura
            <select value={st.width || "100%"} onChange={(e) => setStyle({ width: e.target.value })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="100%">100% (cheia)</option><option value="75%">75%</option>
              <option value="66%">66%</option><option value="50%">50%</option>
              <option value="33%">33%</option><option value="25%">25%</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">Alinhar na pagina
            <select value={st.selfAlign || "left"} onChange={(e) => setStyle({ selfAlign: e.target.value })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">Largura exata (px)
            <input type="number" min={0} value={st.widthPx ?? ""} placeholder="usa a % acima" onChange={(e) => setStyle({ widthPx: e.target.value ? Number(e.target.value) : null })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-slate-600">Altura do card (px)
            <input type="number" min={0} value={st.height ?? ""} placeholder="automática" onChange={(e) => setStyle({ height: e.target.value ? Number(e.target.value) : null })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-slate-600">Peso na linha (lado a lado)
            <input type="number" min={0} step={1} value={st.flex ?? ""} placeholder="igual" onChange={(e) => setStyle({ flex: e.target.value ? Number(e.target.value) : null })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
        </div>
        <div className="text-[10px] text-slate-400">Largura exata (px) vence a % acima. <b>Peso</b> divide o espaço entre cards lado a lado (ex.: 2 e 1 = 66%/33%). Deixe vazio pra largura/iguais.</div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs text-slate-600">Espaco acima (px)
            <input type="number" min={0} value={st.marginTop ?? 0} onChange={(e) => setStyle({ marginTop: Number(e.target.value) })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
          <label className="block text-xs text-slate-600">Espaco abaixo (px)
            <input type="number" min={0} value={st.marginBottom ?? 8} onChange={(e) => setStyle({ marginBottom: Number(e.target.value) })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
          <label className="block text-xs text-slate-600">Alinhar texto
            <select value={st.textAlign || "left"} onChange={(e) => setStyle({ textAlign: e.target.value })}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="left">Esquerda</option><option value="center">Centro</option>
              <option value="right">Direita</option><option value="justify">Justificado</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function CompositionEditor({ nodes, onChange, onUploadImage, selectedId: controlledId, onSelectId }: { nodes: ReportNode[]; onChange: (nodes: ReportNode[]) => void; onUploadImage?: (file: File) => Promise<string>; selectedId?: string | null; onSelectId?: (id: string | null) => void }) {
  // Seleção controlável de fora (Etapa B: clicar na folha seleciona o nó aqui). Se o parent
  // não passar selectedId/onSelectId, cai no estado interno (retrocompatível).
  const [internalId, setInternalId] = useState<string | null>(null);
  const selectedId = controlledId !== undefined ? controlledId : internalId;
  const setSelectedId = (id: string | null) => { if (onSelectId) onSelectId(id); else setInternalId(id); };
  const [addInto, setAddInto] = useState<string | "root" | null>(null);

  const selected = selectedId ? findNode(nodes, selectedId) : null;

  function doAdd(kind: "card" | "row" | "block") {
    const node = newNode(kind);
    if (addInto && addInto !== "root") onChange(addChild(nodes, addInto, node));
    else onChange([...nodes, node]);
    setAddInto(null);
    setSelectedId(node.id);
  }
  function insertTemplate(make: () => ReportNode) {
    const node = make();
    if (addInto && addInto !== "root") onChange(addChild(nodes, addInto, node));
    else onChange([...nodes, node]);
    setAddInto(null);
    setSelectedId(node.id);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Estrutura {addInto && addInto !== "root" ? "(adicionando dentro do card/linha selecionado)" : ""}</span>
          <button type="button" onClick={() => setAddInto("root")} className="rounded bg-cyan-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-cyan-700">+ Novo</button>
        </div>
        {nodes.length === 0 ? (
          <div className="px-2 py-3 text-xs text-slate-500">Vazio. Use &quot;+ Novo&quot; pra adicionar o primeiro card/bloco.</div>
        ) : (
          <div className="max-h-56 overflow-auto">
            {nodes.map((n) => (
              <NodeRow key={n.id} node={n} depth={0} selectedId={selectedId}
                onSelect={setSelectedId} onAddInto={setAddInto}
                onMove={(id, dir) => onChange(moveNode(nodes, id, dir))}
                onRemove={(id) => { onChange(removeNode(nodes, id)); if (selectedId === id) setSelectedId(null); }} />
            ))}
          </div>
        )}
      </div>

      {addInto && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Adicionar:</span>
            <button type="button" onClick={() => doAdd("card")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">🃏 Card</button>
            <button type="button" onClick={() => doAdd("row")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">▭ Linha (colunas)</button>
            <button type="button" onClick={() => doAdd("block")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">🧩 Bloco</button>
            <button type="button" onClick={() => setAddInto(null)} className="ml-auto text-xs text-slate-500 hover:text-slate-700">cancelar</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Modelos:</span>
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" onClick={() => insertTemplate(t.make)} className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100">{t.label}</button>
            ))}
          </div>
        </div>
      )}

      {selected ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">
            Editar {selected.kind === "card" ? "Card" : selected.kind === "row" ? "Linha (colunas)" : "Bloco"}
          </div>
          <NodeInspector node={selected} onChange={(patch) => onChange(updateNode(nodes, selected.id, patch))} onUploadImage={onUploadImage} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
          Clique num item da estrutura pra editar (ou use ➕ pra adicionar dentro de um card).
        </div>
      )}
    </div>
  );
}
