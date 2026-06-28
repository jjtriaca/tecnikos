"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import BudgetReport, { BudgetReportData, ReportNode, CompositionPreview } from "@/components/pool/report/BudgetReport";
import { printViaClone } from "@/lib/printViaClone";
import CompositionEditor from "@/components/pool/report/CompositionEditor";

// Etapa C: grava o HTML editado IN-PLACE (na folha) de volta no no TEXT (recursivo, imutavel).
function setNodeHtml(nodes: ReportNode[], id: string, html: string): ReportNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, config: { ...(n.config || {}), html } }
      : n.children ? { ...n, children: setNodeHtml(n.children, id, html) } : n,
  );
}

type Page = {
  id: string;
  order: number;
  type: "FIXED" | "DYNAMIC";
  htmlContent: string | null;
  dynamicType: string | null;
  pageConfig: any;
  isConditional: boolean;
  conditionRule: any;
  pageBreak: boolean;
  isActive: boolean;
};

type Layout = {
  id: string;
  name: string;
  isDefault: boolean;
  branding: any;
  isActive: boolean;
  pages: Page[];
};

const DYNAMIC_LABEL: Record<string, string> = {
  COVER: "Capa do orcamento",
  BUDGET_SUMMARY: "Resumo do orcamento",
  PRODUCTS_BY_SECTION: "Produtos por secao",
  PHOTOS_GALLERY: "Galeria de fotos",
  CALCULATIONS: "Memoria de calculo",
  TERMS_CONDITIONS: "Termos e condicoes",
  INSTALLMENTS: "Plano de pagamento",
  CUSTOM_TABLE: "Tabela personalizada",
  HEATING_BOMBA: "Datasheet Bomba de Calor",
  HEATING_SOLAR: "Datasheet Coletor Solar",
};

const PLACEHOLDERS = [
  { key: "{clientName}", label: "Nome do cliente" },
  { key: "{clientDocument}", label: "CPF/CNPJ do cliente" },
  { key: "{budgetCode}", label: "Código do orcamento" },
  { key: "{budgetTitle}", label: "Titulo do orcamento" },
  { key: "{budgetTotal}", label: "Valor total" },
  { key: "{poolLength}", label: "Comprimento (m)" },
  { key: "{poolWidth}", label: "Largura (m)" },
  { key: "{poolDepth}", label: "Profundidade (m)" },
  { key: "{poolArea}", label: "Area (m²)" },
  { key: "{poolVolume}", label: "Volume (m³)" },
  { key: "{poolPerimeter}", label: "Perimetro (m)" },
  { key: "{validityDays}", label: "Validade (dias)" },
  { key: "{date}", label: "Data atual" },
];

// Imagem de exemplo auto-contida (data-URI) pro preview do editor.
const sampleImg = (label: string, color: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='180'><rect width='240' height='180' fill='${color}'/><text x='120' y='98' font-size='18' fill='white' text-anchor='middle' font-family='sans-serif'>${label}</text></svg>`,
  );

// Orcamento de EXEMPLO — alimenta a pre-visualizacao ao vivo do editor (o layout
// e generico, nao amarrado a 1 orcamento; aqui mostramos como ele fica com dados).
const SAMPLE_BUDGET: BudgetReportData = {
  code: "ORCP-00001",
  title: "Piscina Pre moldada",
  clientName: "Anderson da Silva Prado",
  clientDocument: "123.456.789-00",
  clientCity: "Primavera do Leste - MT",
  budgetDate: "11/06/2026",
  dimensions: { length: 7, width: 3, depth: 1.4, area: 28.5, volume: 33.3, perimeter: 20 },
  subtotalCents: 18561520,
  discountCents: 0,
  taxesCents: 144412,
  totalCents: 18705932,
  termsConditions: "Proposta sujeita a vistoria tecnica do local antes do inicio.\nValores incluem materiais e mao de obra conforme itens descritos.",
  equipmentWarranty: "12 meses para equipamentos (bomba, filtro, aquecimento).",
  workWarranty: "5 anos contra vazamentos na estrutura da piscina.",
  paymentTerms: "Entrada de 40% na assinatura + saldo em 3x mensais.",
  installments: [
    { label: "Entrada", dueLabel: "Na assinatura", valueCents: 7482373 },
    { label: "Parcela (1/3)", dueLabel: "+30 dias", valueCents: 3741186 },
    { label: "Parcela (2/3)", dueLabel: "+60 dias", valueCents: 3741186 },
    { label: "Parcela (3/3)", dueLabel: "+90 dias", valueCents: 3741187 },
  ],
  validityDays: 30,
  sectionOrder: ["CONSTRUCAO", "FILTRO", "CASCATA", "ACIONAMENTOS"],
  sectionLabels: { CONSTRUCAO: "Construcao", FILTRO: "Filtragem", CASCATA: "Cascata", ACIONAMENTOS: "Acionamentos eletricos" },
  items: [
    { poolSection: "CONSTRUCAO", description: "Kit piscina pre-moldada 7x3", qty: 1, unitPriceCents: 9800000, totalCents: 9800000 },
    { poolSection: "CONSTRUCAO", description: "Mao de obra de instalacao", slotName: "Servico", qty: 1, unitPriceCents: 3200000, totalCents: 3200000 },
    { poolSection: "FILTRO", description: "Conjunto Filtrante 1/2 cv", qty: 1, unitPriceCents: 1850000, totalCents: 1850000, imageUrl: sampleImg("Filtro", "#0e7490") },
    { poolSection: "CASCATA", description: "Kit Cascata Inox Embutir 120cm", slotName: "Cascata", qty: 1, unitPriceCents: 1280000, totalCents: 1280000, imageUrl: sampleImg("Cascata 120cm", "#0369a1") },
    { poolSection: "ACIONAMENTOS", description: "Quadro eletrico 24 polos", qty: 1, unitPriceCents: 505760, totalCents: 505760, imageUrl: sampleImg("Quadro", "#334155") },
  ],
};

// Botao da faixa de opcoes (ribbon) — icone em cima, rotulo embaixo (estilo Office).
function RibbonBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex flex-col items-center justify-center gap-0.5 rounded px-2 py-1 min-w-[56px] text-slate-700 hover:bg-cyan-50 disabled:opacity-40 disabled:cursor-not-allowed">
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] leading-tight text-center">{label}</span>
    </button>
  );
}
export default function PoolPrintLayoutEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [tab, setTab] = useState("Inserir"); // aba da ribbon (Office-like)
  // Pagina "selecionada" para NAVEGAR (mostrar na folha) — clicar numa pagina NAO abre
  // mais o editor (so o "Editar"); ela vira o foco da folha (scroll + contorno).
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  // Confirmacao de remocao de pagina via MODAL proprio (substitui window.confirm nativo).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; n: number } | null>(null);
  // Aba "Cab/Rodape": qual esta sendo editado (cabecalho ou rodape).
  const [hfEdit, setHfEdit] = useState<"header" | "footer">("header");

  const load = useCallback(async () => {
    try {
      const data = await api.get<Layout>(`/pool-print-layouts/${id}`);
      setLayout(data);
      setName(data.name);
      setIsDefault(data.isDefault);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar layout", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  // Ao selecionar uma pagina (navegar), rola a folha ate ela. So quando a folha esta
  // visivel (nao em modo edicao/nova pagina, senao o elemento nem existe).
  useEffect(() => {
    if (selectedPageId && !editingPage && !showAddPage) {
      const el = document.getElementById(`rp-page-${selectedPageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedPageId, editingPage, showAddPage]);

  async function saveMeta() {
    try {
      await api.put(`/pool-print-layouts/${id}`, { name, isDefault });
      toast("Layout salvo", "success");
      setEditingMeta(false);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  // Branding/estilo do relatorio — edita local (preview ao vivo) + salva no layout (Json).
  function setBranding(patch: Record<string, any>) {
    setLayout((prev) => (prev ? { ...prev, branding: { ...(prev.branding || {}), ...patch } } : prev));
  }
  async function saveBranding() {
    try {
      await api.put(`/pool-print-layouts/${id}`, { branding: layout?.branding || {} });
      toast("Estilo salvo", "success");
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao salvar estilo", "error");
    }
  }
  // Upload de imagem do relatorio (logo, foto). Retorna a URL salva em /uploads.
  async function uploadAsset(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const token = getAccessToken();
    const res = await fetch(`/api/pool-print-layouts/${id}/asset`, {
      method: "POST", body: fd, credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Erro ao enviar imagem"); }
    const data = await res.json();
    return data.url as string;
  }

  // ── Etapa C: aba "Inicio" formata a SELECAO de texto na folha (modelo Word) ──
  // Guarda o ultimo Range dentro de um bloco editavel (.rp-inline-edit) e aplica execCommand
  // nele. Botoes usam onMouseDown preventDefault (mantem o foco/selecao); selects/cor
  // restauram o Range antes do comando. fireInput propaga a mudanca pro React (salva no no).
  const selRange = useRef<Range | null>(null);
  const [selFmt, setSelFmt] = useState({ bold: false, italic: false, underline: false, fontName: "", sizePt: "", color: "#000000" });
  // Campo de tamanho DIGITÁVEL (reflete a seleção, mas aceita qualquer valor digitado).
  const [sizeInput, setSizeInput] = useState("");
  useEffect(() => { setSizeInput(selFmt.sizePt || ""); }, [selFmt.sizePt]);
  const ribFmtBtn = (active: boolean) =>
    `h-7 w-7 rounded text-sm font-bold ${active ? "bg-cyan-600 text-white" : "bg-white text-slate-700 border border-slate-300"} hover:bg-cyan-50`;

  const closestEditable = (r: Range | null): HTMLElement | null => {
    if (!r) return null;
    const n = r.commonAncestorContainer;
    const el = n.nodeType === 3 ? (n as Text).parentElement : (n as Element);
    return (el && (el as Element).closest ? (el.closest(".rp-inline-edit") as HTMLElement) : null) || null;
  };
  const reflectSel = () => {
    let bold = false, italic = false, underline = false;
    try { bold = document.queryCommandState("bold"); italic = document.queryCommandState("italic"); underline = document.queryCommandState("underline"); } catch { /* noop */ }
    let fontName = "", sizePt = "", color = "#000000";
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      let n: Node | null = sel.anchorNode;
      if (n && n.nodeType === 3) n = (n as Text).parentElement;
      if (n && (n as Element).nodeType === 1) {
        const cs = window.getComputedStyle(n as Element);
        const fam = (cs.fontFamily || "").toLowerCase();
        for (const v of ["Georgia, serif", "Arial, Helvetica, sans-serif", "'Times New Roman', serif", "'Trebuchet MS', sans-serif", "'Courier New', monospace"]) {
          const first = v.split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
          if (fam.includes(first)) { fontName = v; break; }
        }
        sizePt = String(Math.round((parseFloat(cs.fontSize) || 0) * 72 / 96));
        const m = (cs.color || "").match(/\d+/g);
        if (m && m.length >= 3) color = "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
      }
    }
    setSelFmt({ bold, italic, underline, fontName, sizePt, color });
  };
  useEffect(() => {
    const h = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        if (closestEditable(r)) { selRange.current = r.cloneRange(); reflectSel(); }
      }
    };
    document.addEventListener("selectionchange", h);
    return () => document.removeEventListener("selectionchange", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const restoreSel = () => {
    const ed = closestEditable(selRange.current);
    ed?.focus();
    const sel = window.getSelection();
    if (selRange.current && sel) { sel.removeAllRanges(); sel.addRange(selRange.current); }
  };
  const fireInput = () => { closestEditable(selRange.current)?.dispatchEvent(new Event("input", { bubbles: true })); };
  const selExec = (cmd: string, val?: string) => {
    if (!closestEditable(selRange.current)) return;
    restoreSel();
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* noop */ }
    document.execCommand(cmd, false, val);
    fireInput(); reflectSel();
  };
  const selFontSize = (pt: string) => {
    if (!pt || !closestEditable(selRange.current)) return;
    restoreSel();
    // IMPORTANTE: forcar styleWithCSS=false aqui, senao (apos um B/I/cor que liga
    // styleWithCSS) o fontSize=7 vira <span font-size:xx-large> (GIGANTE) e o conversor
    // nao acha o font[size=7] pra trocar pelo pt. Com false, gera <font size=7> e convertemos.
    try { document.execCommand("styleWithCSS", false, "false"); } catch { /* noop */ }
    document.execCommand("fontSize", false, "7");
    document.querySelectorAll('.rp-inline-edit font[size="7"]').forEach((f) => {
      const s = document.createElement("span");
      s.style.fontSize = `${pt}pt`;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.replaceWith(s);
    });
    fireInput(); reflectSel();
  };

  async function addPage(payload: any) {
    try {
      await api.post(`/pool-print-layouts/${id}/pages`, payload);
      setShowAddPage(false);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function updatePage(pageId: string, patch: any) {
    try {
      await api.put(`/pool-print-layouts/pages/${pageId}`, patch);
      setEditingPage(null);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function doRemovePage(pageId: string) {
    try {
      await api.del(`/pool-print-layouts/pages/${pageId}`);
      setPendingDelete(null);
      if (editingPage?.id === pageId) setEditingPage(null);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function reorderPages(pageIds: string[]) {
    try {
      await api.post(`/pool-print-layouts/${id}/reorder-pages`, { pageIds });
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao reordenar", "error");
    }
  }

  function handleDragStart(pageId: string) {
    setDraggingId(pageId);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId || !layout) return;
    const pages = [...layout.pages];
    const fromIdx = pages.findIndex((p) => p.id === draggingId);
    const toIdx = pages.findIndex((p) => p.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = pages.splice(fromIdx, 1);
    pages.splice(toIdx, 0, moved);
    setLayout({ ...layout, pages });
  }

  function handleDragEnd() {
    if (draggingId && layout) {
      reorderPages(layout.pages.map((p) => p.id));
    }
    setDraggingId(null);
  }

  if (loading) return <div className="p-6 text-slate-600">Carregando...</div>;
  if (!layout) return <div className="p-6 text-slate-600">Layout nao encontrado.</div>;

  const brand = (layout.branding || {}) as any;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4.5rem)" }}>
      {/* BARRA DE TITULO */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-white shrink-0">
        <Link href="/pool/print-layouts" className="text-xs text-slate-500 hover:text-slate-700">← Layouts</Link>
        {editingMeta ? (
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="text-lg font-bold text-slate-900 rounded border border-slate-300 px-2 py-0.5" />
            <label className="flex items-center gap-1 text-sm text-slate-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> padrao
            </label>
            <button onClick={saveMeta} className="rounded bg-cyan-600 px-3 py-1 text-sm text-white hover:bg-cyan-700">Salvar</button>
            <button onClick={() => { setEditingMeta(false); setName(layout.name); setIsDefault(layout.isDefault); }}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">{layout.name}</h1>
            {layout.isDefault && <span className="rounded-full bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5">padrao</span>}
            <button onClick={() => setEditingMeta(true)} className="text-xs text-cyan-600 hover:text-cyan-800">Editar nome</button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">🖨️ Imprimir exemplo</button>
        </div>
      </div>

      {/* ABAS DA RIBBON */}
      <div className="flex items-end gap-1 px-3 pt-1 bg-slate-100 border-b border-slate-200 shrink-0">
        {["Arquivo", "Inicio", "Inserir", "Pagina", "Cab/Rodape", "Estilo"].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-t-md ${tab === t ? "bg-white font-semibold text-slate-900 border border-b-0 border-slate-200" : "text-slate-600 hover:bg-slate-200"}`}>{t}</button>
        ))}
      </div>

      {/* FAIXA DE OPCOES — cada ferramenta na aba certa (estilo Office) */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-white border-b border-slate-200 overflow-x-auto shrink-0" style={{ minHeight: 56 }}>
        {tab === "Arquivo" && (<>
          <RibbonBtn icon="✏️" label="Renomear" onClick={() => setEditingMeta(true)} />
          <RibbonBtn icon="💾" label="Salvar estilo" onClick={saveBranding} />
          <RibbonBtn icon="🖨️" label="Imprimir" onClick={() => printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })} />
          <RibbonBtn icon="📑" label="Duplicar" onClick={() => toast("Duplicar: em breve", "info")} />
        </>)}
        {tab === "Inicio" && (<>
          <select value={selFmt.fontName} onChange={(e) => selExec("fontName", e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" title="Fonte do texto selecionado">
            <option value="">Fonte</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times</option>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
            <option value="'Courier New', monospace">Courier</option>
          </select>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Tamanho do texto selecionado (pt) — digite e Enter">
            <input type="number" min={5} max={120} value={sizeInput} placeholder="Tam"
              onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); selFontSize(sizeInput); } }}
              onBlur={() => { if (sizeInput) selFontSize(sizeInput); }}
              className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />pt
          </label>
          <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm" title="Cor do texto"><span>A</span><input type="color" value={selFmt.color} onChange={(e) => selExec("foreColor", e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("bold")} className={ribFmtBtn(selFmt.bold)} title="Negrito">B</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("italic")} className={ribFmtBtn(selFmt.italic) + " italic"} title="Italico">I</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("underline")} className={ribFmtBtn(selFmt.underline) + " underline"} title="Sublinhado">U</button>
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("justifyLeft")} className={ribFmtBtn(false)} title="Esquerda">⯇</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("justifyCenter")} className={ribFmtBtn(false)} title="Centro">≡</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("justifyRight")} className={ribFmtBtn(false)} title="Direita">⯈</button>
          <span className="text-[10px] text-slate-400 ml-1">selecione um texto na folha pra formatar</span>
        </>)}
        {tab === "Inserir" && (<>
          <RibbonBtn icon="➕" label="Nova pagina" onClick={() => setShowAddPage(true)} />
          <span className="text-xs text-slate-500 px-2">Capa, Produtos, Datasheets, Cards, Texto, Imagem… escolha o tipo ao adicionar.</span>
        </>)}
        {tab === "Pagina" && (<>
          <label className="text-xs text-slate-600 flex items-center gap-1">Orientacao
            <select value={brand.orientation || "portrait"} onChange={(e) => setBranding({ orientation: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="portrait">Retrato</option><option value="landscape">Paisagem</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 flex items-center gap-1">Margem
            <input type="number" min={0} max={30} value={brand.pageMarginMm ?? 12} onChange={(e) => setBranding({ pageMarginMm: e.target.value === "" ? null : Number(e.target.value) })} className="w-14 rounded border border-slate-300 px-2 py-1 text-sm" />mm
          </label>
          <label className="text-xs text-slate-600 flex items-center gap-1">Fundo
            <select value={brand.bgType || "solid"} onChange={(e) => setBranding({ bgType: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="solid">Solido</option><option value="gradient">Gradiente</option></select>
            <input type="color" value={brand.bgColor || "#ffffff"} onChange={(e) => setBranding({ bgColor: e.target.value })} className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0" title="Cor de fundo" />
            {brand.bgType === "gradient" ? <input type="color" value={brand.bgColor2 || "#e2e8f0"} onChange={(e) => setBranding({ bgColor2: e.target.value })} className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0" title="2a cor" /> : null}
          </label>
          <span className="text-[10px] text-slate-400 ml-1">Cabecalho/Rodape ficam na aba &quot;Cab/Rodape&quot;.</span>
        </>)}
        {tab === "Cab/Rodape" && (() => {
          const isH = hfEdit === "header";
          const k = {
            html: isH ? "headerHtml" : "footerHtml",
            logo: isH ? "headerLogo" : "logoFooter",
            size: isH ? "logoSizeHeader" : "logoSizeFooter",
            side: isH ? "headerLogoSide" : "footerLogoSide",
            onCover: isH ? "headerOnCover" : "footerOnCover",
          };
          const logoOn = isH ? brand.headerLogo !== false : !!brand.logoFooter;
          return (<>
            <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
              <button type="button" onClick={() => setHfEdit("header")} className={`px-3 py-1 ${isH ? "bg-cyan-600 text-white" : "bg-white text-slate-700"}`}>Cabecalho</button>
              <button type="button" onClick={() => setHfEdit("footer")} className={`px-3 py-1 ${!isH ? "bg-cyan-600 text-white" : "bg-white text-slate-700"}`}>Rodape</button>
            </div>
            <span className="mx-0.5 h-5 w-px bg-slate-300" />
            <input value={brand[k.html] || ""} onChange={(e) => setBranding({ [k.html]: e.target.value || null })} placeholder={isH ? "Texto do cabecalho ({budgetCode})" : "Texto do rodape (SLS · {date})"} className="w-56 rounded border border-slate-300 px-2 py-1 text-xs" />
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Mostrar a logo neste local"><input type="checkbox" checked={logoOn} onChange={(e) => setBranding({ [k.logo]: e.target.checked })} />Logo</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Altura da logo (px)">px<input type="number" min={12} max={120} value={brand[k.size] ?? (isH ? 34 : 28)} onChange={(e) => setBranding({ [k.size]: e.target.value ? Number(e.target.value) : null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Lado da logo">Lado
              <select value={brand[k.side] || "right"} onChange={(e) => setBranding({ [k.side]: e.target.value })} className="rounded border border-slate-300 px-1 py-1 text-sm">
                <option value="left">Esquerda</option><option value="right">Direita</option>
              </select>
            </label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Mostrar este bloco tambem na capa"><input type="checkbox" checked={!!brand[k.onCover]} onChange={(e) => setBranding({ [k.onCover]: e.target.checked })} />Mostrar na capa</label>
            <RibbonBtn icon="💾" label="Salvar" onClick={saveBranding} />
          </>);
        })()}
        {tab === "Estilo" && (<>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Padrao do relatorio:</span>
          <select value={brand.fontFamily || ""} onChange={(e) => setBranding({ fontFamily: e.target.value || null })} className="rounded border border-slate-300 px-2 py-1 text-sm" title="Fonte padrao do relatorio">
            <option value="">Fonte padrao</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times</option>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
            <option value="'Courier New', monospace">Courier</option>
          </select>
          <input type="number" min={7} max={18} value={brand.fontSizePt ?? ""} onChange={(e) => setBranding({ fontSizePt: e.target.value ? Number(e.target.value) : null })} placeholder="pt" className="w-14 rounded border border-slate-300 px-2 py-1 text-sm" title="Tamanho base (pt)" />
          <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm" title="Cor do texto padrao"><span>A</span><input type="color" value={brand.textColor || "#0f172a"} onChange={(e) => setBranding({ textColor: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          <label className="text-xs text-slate-600 flex items-center gap-1">Primaria<input type="color" value={brand.primaryColor || "#0f172a"} onChange={(e) => setBranding({ primaryColor: e.target.value })} className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0" /></label>
          <label className="text-xs text-slate-600 flex items-center gap-1">Destaque<input type="color" value={brand.accentColor || "#1e3a8a"} onChange={(e) => setBranding({ accentColor: e.target.value })} className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0" /></label>
          <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">📁 Logo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await uploadAsset(f); setBranding({ logoUrl: url }); toast("Logo enviado", "success"); } catch (err: any) { toast(err.message || "Erro", "error"); } if (e.target) e.target.value = ""; }} /></label>
          {brand.logoUrl ? <img src={brand.logoUrl} alt="logo" className="h-7 rounded border border-slate-200" /> : null}
          <span className="text-[10px] text-slate-400">Logo capa:</span>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Altura da logo na CAPA (px)">px<input type="number" min={16} max={220} value={brand.logoSizeCover ?? 64} onChange={(e) => setBranding({ logoSizeCover: e.target.value ? Number(e.target.value) : null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Posicao da logo na CAPA">Posicao
            <select value={brand.logoAlign || "right"} onChange={(e) => setBranding({ logoAlign: e.target.value })} className="rounded border border-slate-300 px-1 py-1 text-sm">
              <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
            </select>
          </label>
          <span className="text-[10px] text-slate-400 ml-1">Cabecalho/Rodape na aba &quot;Cab/Rodape&quot;.</span>
          <RibbonBtn icon="💾" label="Salvar" onClick={saveBranding} />
        </>)}
      </div>

      {/* 3 PAINEIS — topo (titulo+abas+faixa) fica FIXO; aqui embaixo: paginas | folha | editor */}
      <div className="flex flex-1 min-h-0">
      {/* ESQUERDA: Paginas + estilo */}
      <div className="w-[340px] shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Paginas</div>
        <button onClick={() => setShowAddPage(true)} className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-700">+ Pagina</button>
      </div>

      {/* Branding agora vive nas ABAS da faixa (Inicio/Pagina/Estilo). Painel escondido. */}
      <details hidden className="rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">🎨 Padrao do relatorio — fonte, cores, fundo, cabecalho/rodape <span className="font-normal text-slate-400">(cada card/texto pode sobrescrever)</span></summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-slate-600">Tipo de fonte
              <select value={brand.fontFamily || ""} onChange={(e) => setBranding({ fontFamily: e.target.value || null })}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="">Padrao</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Times New Roman', serif">Times</option>
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
                <option value="'Courier New', monospace">Courier</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">Tamanho da fonte (pt)
              <input type="number" min={7} max={18} value={brand.fontSizePt ?? ""}
                onChange={(e) => setBranding({ fontSizePt: e.target.value ? Number(e.target.value) : null })}
                placeholder="auto" className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["Cor do texto", "textColor", "#0f172a"],
              ["Cor de fundo", "bgColor", "#ffffff"],
              ["Cor primaria", "primaryColor", "#0f172a"],
              ["Cor de destaque", "accentColor", "#1e3a8a"],
            ] as [string, string, string][]).map(([lbl, key, def]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">
                {lbl}
                <input type="color" value={brand[key] || def} onChange={(e) => setBranding({ [key]: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-slate-600">Tipo de fundo
              <select value={brand.bgType || "solid"} onChange={(e) => setBranding({ bgType: e.target.value })}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="solid">Cor solida</option>
                <option value="gradient">Gradiente</option>
              </select>
            </label>
            {brand.bgType === "gradient" ? (
              <label className="flex items-center justify-between gap-2 text-xs text-slate-600 rounded border border-slate-200 px-2 py-1">2a cor (gradiente)
                <input type="color" value={brand.bgColor2 || "#e2e8f0"} onChange={(e) => setBranding({ bgColor2: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              </label>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-slate-600">Orientacao
              <select value={brand.orientation || "portrait"} onChange={(e) => setBranding({ orientation: e.target.value })}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="portrait">Retrato (vertical)</option>
                <option value="landscape">Paisagem (horizontal)</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">Margem da pagina (mm)
              <input type="number" min={0} max={30} value={brand.pageMarginMm ?? 12}
                onChange={(e) => setBranding({ pageMarginMm: e.target.value === "" ? null : Number(e.target.value) })}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
          </div>
          <div className="block text-xs text-slate-600">Logo (aparece na Capa)
            <input value={brand.logoUrl || ""} onChange={(e) => setBranding({ logoUrl: e.target.value || null })}
              placeholder="https://... ou envie um arquivo" className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <div className="mt-1 flex items-center gap-2">
              <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 hover:bg-slate-200">📁 Enviar imagem
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await uploadAsset(f); setBranding({ logoUrl: url }); toast("Logo enviado", "success"); } catch (err: any) { toast(err.message || "Erro ao enviar", "error"); } if (e.target) e.target.value = ""; }} />
              </label>
              {brand.logoUrl ? <img src={brand.logoUrl} alt="logo" className="h-8 rounded border border-slate-200 bg-white" /> : null}
            </div>
          </div>
          <label className="block text-xs text-slate-600">Cabecalho (HTML, aceita variaveis) — em toda pagina
            <textarea value={brand.headerHtml || ""} onChange={(e) => setBranding({ headerHtml: e.target.value || null })} rows={2}
              placeholder="Ex: {budgetCode} — {clientName}" className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono" />
          </label>
          <label className="block text-xs text-slate-600">Rodape (HTML, aceita variaveis) — em toda pagina
            <textarea value={brand.footerHtml || ""} onChange={(e) => setBranding({ footerHtml: e.target.value || null })} rows={2}
              placeholder="Ex: SLS Obras LTDA · contato@tecnikos.com.br · {date}" className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono" />
          </label>
          <button onClick={saveBranding}
            className="rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">
            Salvar estilo
          </button>
        </div>
      </details>

      {/* Pages list */}
      {layout.pages.length === 0 ? (
        <div className="py-16 text-center text-slate-600 rounded-xl border border-dashed border-slate-300 bg-white">
          Nenhuma pagina ainda. Adicione pelo menos uma capa pra comecar.
        </div>
      ) : (
        <div className="space-y-3">
          {layout.pages.map((p, idx) => (
            <div key={p.id}
              draggable
              onClick={() => { setEditingPage(null); setShowAddPage(false); setSelectedPageId(p.id); }}
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDragEnd={handleDragEnd}
              title="Clique para ver esta pagina na folha · use Editar para alterar"
              className={`rounded-xl border bg-white shadow-sm p-3 cursor-pointer transition ${
                editingPage?.id === p.id || selectedPageId === p.id ? "border-cyan-500 ring-2 ring-cyan-200" : draggingId === p.id ? "opacity-50 border-cyan-400" : "border-slate-200 hover:border-cyan-300"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg w-12 h-12 flex-shrink-0">
                  <div className="text-xs text-slate-600">PAG.</div>
                  <div className="text-lg font-bold text-slate-700">{idx + 1}</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {(p.pageConfig as any)?.nodes?.length ? (
                      <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 font-semibold">COMPOSICAO</span>
                    ) : p.type === "FIXED" ? (
                      <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 font-semibold">HTML FIXO</span>
                    ) : (
                      <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 font-semibold">DINAMICA</span>
                    )}
                    {p.isConditional && (
                      <span className="rounded-full bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 font-semibold">CONDICIONAL</span>
                    )}
                    {!p.isActive && (
                      <span className="rounded-full bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5">inativa</span>
                    )}
                  </div>
                  <div className="font-medium text-slate-900">
                    {(p.pageConfig as any)?.nodes?.length
                      ? <span className="text-slate-700">Composicao de cards · {(p.pageConfig as any).nodes.length} no topo</span>
                      : p.type === "DYNAMIC"
                      ? (DYNAMIC_LABEL[p.dynamicType || ""] || p.dynamicType || "Pagina dinamica")
                      : p.htmlContent
                        ? <span className="text-slate-700">{p.htmlContent.slice(0, 80).replace(/<[^>]+>/g, "").trim() || "(sem conteudo)"}{p.htmlContent.length > 80 ? "..." : ""}</span>
                        : "(sem conteudo)"}
                  </div>
                  {p.isConditional && (
                    <div className="text-xs text-orange-600 mt-1">
                      Aparece apenas se: {JSON.stringify(p.conditionRule)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingPage(p); }}
                    className="text-xs text-cyan-600 hover:text-cyan-800 font-medium">
                    Editar
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setPendingDelete({ id: p.id, n: idx + 1 }); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>{/* fim painel esquerdo (Paginas & estilo) */}

      {/* CENTRO: edita a pagina selecionada (sem janela) OU mostra a folha. Nada a direita. */}
      <div className="flex-1 min-w-0 overflow-auto bg-slate-200 p-4">
        {(showAddPage || editingPage) ? (
          <div className="mx-auto max-w-[1400px] rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-800">
                {editingPage
                  ? <>✎ Pagina {layout.pages.findIndex((p) => p.id === editingPage.id) + 1} <span className="font-normal text-slate-500">— {(editingPage.pageConfig as any)?.nodes?.length ? "Composicao" : editingPage.type === "DYNAMIC" ? (DYNAMIC_LABEL[editingPage.dynamicType || ""] || "Dinamica") : "HTML fixo"}</span></>
                  : <>➕ Nova pagina</>}
              </div>
              <button type="button" onClick={() => { setShowAddPage(false); setEditingPage(null); }}
                className="text-xs text-slate-500 hover:text-slate-700">✕ Fechar (ver folha)</button>
            </div>
            <PageEditor
              inline
              key={editingPage?.id || "new"}
              editing={editingPage}
              onClose={() => { setShowAddPage(false); setEditingPage(null); }}
              onSubmit={(payload) => editingPage ? updatePage(editingPage.id, payload) : addPage(payload)}
              onUploadImage={uploadAsset}
            />
          </div>
        ) : (
          <>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Pre-visualizacao <span className="text-slate-400">(dados de exemplo)</span> <span className="text-slate-400">— clique numa pagina na lista para focar nela</span></div>
            <BudgetReport data={SAMPLE_BUDGET} layout={{ branding: layout.branding, pages: layout.pages }}
              editable selectedPageId={selectedPageId} onSelectPage={(id) => setSelectedPageId(id)} />
          </>
        )}
      </div>

      </div>{/* fim 3 paineis */}

      {/* Modal de confirmacao de remocao (substitui window.confirm nativo) */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPendingDelete(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-slate-900">Remover pagina {pendingDelete.n}?</div>
            <p className="mt-1 text-sm text-slate-600">Esta acao nao pode ser desfeita.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={() => doRemovePage(pendingDelete.id)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageEditor({ editing, onClose, onSubmit, onUploadImage, inline }: {
  editing: Page | null;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  onUploadImage?: (file: File) => Promise<string>;
  inline?: boolean;
}) {
  const [type, setType] = useState<"FIXED" | "DYNAMIC">(editing?.type || "DYNAMIC");
  const [dynamicType, setDynamicType] = useState(editing?.dynamicType || "COVER");
  const [htmlContent, setHtmlContent] = useState(editing?.htmlContent || "");
  const [pageConfig, setPageConfig] = useState(editing?.pageConfig ? JSON.stringify(editing.pageConfig, null, 2) : "{}");
  const [isConditional, setIsConditional] = useState(editing?.isConditional || false);
  const [conditionRequires, setConditionRequires] = useState(
    (editing?.conditionRule as any)?.requires?.join(",") || ""
  );
  const [pageBreak, setPageBreak] = useState(editing?.pageBreak ?? true);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  // Composicao por cards (v1.14.16): se a pagina tem pageConfig.nodes, abre no modo cards.
  const [compMode, setCompMode] = useState<boolean>(!!(editing?.pageConfig as any)?.nodes);
  const [nodes, setNodes] = useState<ReportNode[]>(((editing?.pageConfig as any)?.nodes as ReportNode[]) || []);
  // Etapa B: nó selecionado, compartilhado entre o montador (CompositionEditor) e a folha
  // (CompositionPreview) — clicar num lado destaca/edita no outro.
  const [selNode, setSelNode] = useState<string | null>(null);

  function insertPlaceholder(ph: string) {
    setHtmlContent(htmlContent + ph);
  }
  // Config amigavel: le/escreve uma chave do pageConfig (que e um JSON string no state).
  function pcGet(key: string, def: any) { try { return JSON.parse(pageConfig || "{}")[key] ?? def; } catch { return def; } }
  function pcSet(key: string, val: any) { let o: any = {}; try { o = JSON.parse(pageConfig || "{}"); } catch { o = {}; } o[key] = val; setPageConfig(JSON.stringify(o, null, 2)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      pageBreak,
      isActive,
      isConditional,
    };
    if (compMode) {
      // Composicao por cards: salva como FIXED + pageConfig.nodes (sem novo enum -> sem migration).
      payload.type = "FIXED";
      payload.htmlContent = null;
      payload.dynamicType = null;
      payload.pageConfig = { nodes };
    } else if (type === "FIXED") {
      payload.type = "FIXED";
      payload.htmlContent = htmlContent;
      payload.dynamicType = null;
      payload.pageConfig = {};
    } else {
      payload.type = "DYNAMIC";
      payload.dynamicType = dynamicType;
      payload.htmlContent = null;
      try {
        payload.pageConfig = JSON.parse(pageConfig || "{}");
      } catch {
        alert("JSON de configuracao invalido");
        return;
      }
    }
    if (isConditional && conditionRequires.trim()) {
      payload.conditionRule = {
        requires: conditionRequires.split(",").map((s) => s.trim()).filter(Boolean),
      };
    } else if (!isConditional) {
      payload.conditionRule = null;
    }
    onSubmit(payload);
  }

  const inner = (
    <>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        {editing ? "Editar pagina" : "Nova pagina"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setType("DYNAMIC"); setCompMode(false); }}
              className={`px-4 py-2 rounded text-sm ${!compMode && type === "DYNAMIC" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              Pagina dinamica
            </button>
            <button type="button" onClick={() => { setType("FIXED"); setCompMode(false); }}
              className={`px-4 py-2 rounded text-sm ${!compMode && type === "FIXED" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              HTML fixo (placeholders)
            </button>
            <button type="button" onClick={() => setCompMode(true)}
              className={`px-4 py-2 rounded text-sm ${compMode ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              🃏 Composicao (cards)
            </button>
          </div>

          <p className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            {compMode
              ? "🃏 Composicao: monte a pagina DO ZERO com cards, colunas, texto e blocos — liberdade total."
              : type === "FIXED"
              ? "📝 HTML fixo: conteudo livre em HTML com variaveis (placeholders) — do zero, mais tecnico."
              : "⚙️ Pagina dinamica: bloco PRONTO que se preenche sozinho com os dados do orcamento (Capa, Resumo, Produtos por etapa...)."}
          </p>

          {compMode ? (
            <div>
              <p className="mb-2 text-xs text-slate-500">Monte a pagina com <b>cards</b>, <b>linhas (colunas)</b> e <b>blocos</b> aninhados. Use ➕ pra adicionar dentro de um card. <b>Clique direto na folha</b> pra selecionar e editar o elemento.</p>
              <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
                <CompositionEditor nodes={nodes} onChange={setNodes} onUploadImage={onUploadImage} selectedId={selNode} onSelectId={setSelNode} />
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600">Folha (edicao ao vivo) <span className="font-normal text-slate-400">— clique no TEXTO pra editar; selecione um trecho e formate pela aba Inicio (em cima)</span></div>
                  <CompositionPreview nodes={nodes} data={SAMPLE_BUDGET} selectedId={selNode} onSelectNode={setSelNode} onEditText={(id, html) => setNodes((ns) => setNodeHtml(ns, id, html))} />
                </div>
              </div>
            </div>
          ) : type === "DYNAMIC" ? (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tipo de pagina dinamica *</label>
                <select value={dynamicType} onChange={(e) => setDynamicType(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  {Object.entries(DYNAMIC_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
              {dynamicType === "PRODUCTS_BY_SECTION" ? (
                <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={pcGet("showImages", true) !== false} onChange={(e) => pcSet("showImages", e.target.checked)} />
                  Mostrar imagens dos produtos
                </label>
              ) : dynamicType === "PHOTOS_GALLERY" ? (
                <label className="block text-sm text-slate-700">Colunas da galeria
                  <input type="number" min={1} max={6} value={pcGet("columns", 3)} onChange={(e) => pcSet("columns", Math.max(1, Math.min(6, Number(e.target.value) || 3)))}
                    className="ml-2 w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
              ) : null}
              <details className="rounded border border-slate-200 px-3 py-2">
                <summary className="cursor-pointer text-xs text-slate-500">Configuração avançada (JSON)</summary>
                <textarea value={pageConfig} onChange={(e) => setPageConfig(e.target.value)} rows={6}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder='{"sections": ["CONSTRUCAO"], "showImages": true}' />
                <p className="mt-1 text-xs text-slate-500">
                  Ex: <code>{`{"sections": ["FILTRO"], "showImages": true}`}</code>
                </p>
              </details>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-600">Conteudo HTML *</label>
                  <details className="relative">
                    <summary className="text-xs text-cyan-600 cursor-pointer hover:text-cyan-800">+ Inserir variavel</summary>
                    <div className="absolute right-0 top-6 z-10 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto w-64 p-2 grid grid-cols-1 gap-1">
                      {PLACEHOLDERS.map((ph) => (
                        <button key={ph.key} type="button"
                          onClick={() => insertPlaceholder(ph.key)}
                          className="text-left text-xs px-2 py-1 rounded hover:bg-slate-100">
                          <span className="font-mono text-cyan-600">{ph.key}</span>
                          <span className="text-slate-600 ml-2">{ph.label}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
                <textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} rows={12} required
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder='<h1>Orcamento {budgetCode}</h1>\n<p>Cliente: {clientName}</p>' />
                <p className="mt-1 text-xs text-slate-500">
                  HTML simples com placeholders. Placeholders disponiveis: {PLACEHOLDERS.map((p) => p.key).join(", ")}
                </p>
              </div>
            </>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isConditional} onChange={(e) => setIsConditional(e.target.checked)} />
              Pagina condicional (so aparece se requisito for atendido)
            </label>
            {isConditional && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Requer caracteristicas</label>
                <input value={conditionRequires} onChange={(e) => setConditionRequires(e.target.value)}
                  placeholder="Ex: AQUECIMENTO_SOLAR (separado por virgula)"
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={pageBreak} onChange={(e) => setPageBreak(e.target.checked)} />
              Quebra de pagina apos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Ativa
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
              {editing ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
    </>
  );
  if (inline) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4">{inner}</div>;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white rounded-xl shadow-xl w-full ${compMode ? "max-w-5xl" : "max-w-3xl"} p-6 max-h-[90vh] overflow-y-auto`}>
        {inner}
      </div>
    </div>
  );
}
