"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import BudgetReport, { BudgetReportData, ReportNode, CompositionPreview, CanvasEditor, Box, pageDims, LIST_FIELD_LABEL, type CondRule, type CondGroup, type CondOp, type DynCandidate, type ListConfig, type ListColumn } from "@/components/pool/report/BudgetReport";
import { buildReportData } from "@/components/pool/report/BudgetReportModal";
import { printViaClone } from "@/lib/printViaClone";
import CompositionEditor from "@/components/pool/report/CompositionEditor";
import ReportFieldLibrary from "@/components/pool/report/ReportFieldLibrary";
import { LineRefPicker, SECTION_LABEL, SECTION_ORDER, type LineRefPickerLine } from "@/components/pool/LineRefPicker";
import { validateLayoutTokens } from "@/components/pool/report/reportValidate";
import { REPORT_ICONS } from "@/components/pool/report/reportIcons";
import NumInput from "@/components/ui/NumInput";

const genBoxId = () => "b" + Math.random().toString(36).slice(2, 9);

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
  sourceType?: string | null; // origem dos dados (EngineReporter): POOL_BUDGET (default) | QUOTE | ...
  templateId?: string | null; // (obras) modelo de obra alvo
  pages: Page[];
};

// Origem (sourceType do layout) -> id da fonte no catalogo de campos (REPORT_FIELD_CATALOG).
const SOURCE_CATALOG_ID: Record<string, string> = {
  POOL_BUDGET: "orcamento_obras",
  QUOTE: "orcamento_servicos",
  SERVICE_ORDER: "ordem_servico",
  FIN_RECEIVABLE: "contas_receber",
  FIN_PAYABLE: "contas_pagar",
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
  // HEATING_SOLAR/HEATING_BOMBA NAO sao paginas dinamicas (enum do backend nao tem) —
  // usar como BLOCO dentro de uma pagina de Composicao.
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
  clientTradeName: "",
  clientDocument: "123.456.789-00",
  clientPhone: "(66) 99999-0000",
  clientEmail: "anderson@email.com",
  clientAddress: "Rua das Palmeiras, 123",
  clientNeighborhood: "Centro",
  clientCity: "Primavera do Leste - MT",
  clientState: "MT",
  clientZip: "78850-000",
  company: { name: "SLS Obras LTDA", tradeName: "SLS — Sol e Lazer Soluções", cnpj: "47.226.599/0001-40", ie: "ISENTO", phone: "(66) 99986-1230", email: "contato@sls.com.br", address: "Av. Paraná, 340 — Primavera do Leste/MT", city: "Primavera do Leste - MT", ownerName: "Juliano Triaca" },
  budgetDate: "11/06/2026",
  dimensions: { length: 7, width: 3, depth: 1.4, area: 28.5, volume: 33.3, perimeter: 20,
    maxDepth: 1.9, comprimentoTotal: 7, larguraTotal: 3, cantos: 9, perimetroExternoBorda: 25, perimetroParedesInternas: 9,
    areaParedeEFundo: 64.3, areaParedeM2: 39.14, radierM2: 39.14, radierM3: 7.83, escavacaoM3: 66.6 },
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
  environmentParams: { solicitante: "Anderson da Silva Prado", cidade: "Primavera do Leste", regiaoSolar: "MT" },
  sectionOrder: ["CONSTRUCAO", "FILTRO", "CASCATA", "ACIONAMENTOS"],
  sectionLabels: { CONSTRUCAO: "Construcao", FILTRO: "Filtragem", CASCATA: "Cascata", ACIONAMENTOS: "Acionamentos eletricos" },
  items: [
    { poolSection: "CONSTRUCAO", cellRef: "L1", description: "Kit piscina pre-moldada 7x3", qty: 1, unitPriceCents: 9800000, totalCents: 9800000, imageUrl: sampleImg("Piscina 7x3", "#0891b2"), hasProduct: true, productCode: "PIS-7X3", productDesc: "Kit Piscina Pre-moldada 7,00 x 3,00 m", productUnit: "kit", productSpecs: { material: "Concreto pre-moldado", garantiaAnos: 5 } },
    { poolSection: "CONSTRUCAO", cellRef: "L2", description: "Mao de obra de instalacao", slotName: "Servico", qty: 1, unitPriceCents: 3200000, totalCents: 3200000, hasProduct: true, productCode: "SRV-INST", productDesc: "Mao de obra de instalacao completa", productUnit: "servico" },
    { poolSection: "FILTRO", cellRef: "L3", description: "Conjunto Filtrante 1/2 cv", qty: 1, unitPriceCents: 1850000, totalCents: 1850000, imageUrl: sampleImg("Filtro", "#0e7490"), hasProduct: true, productCode: "FILT-050", productDesc: "Conjunto Filtrante V30 c/ Bomba 1/2 cv", productUnit: "kit", productSpecs: { vazaoM3h: 5.5, potenciaCv: 0.5 } },
    { poolSection: "CASCATA", cellRef: "L4", description: "Kit Cascata Inox Embutir 120cm", slotName: "Cascata", qty: 1, unitPriceCents: 1280000, totalCents: 1280000, imageUrl: sampleImg("Cascata 120cm", "#0369a1"), hasProduct: true, productCode: "CASC-120", productDesc: "Kit Cascata Inox Embutir 120 cm + Bomba 1 cv", productUnit: "kit", productSpecs: { comprimentoCm: 120 } },
    { poolSection: "ACIONAMENTOS", cellRef: "L5", description: "Quadro eletrico 24 polos", qty: 1, unitPriceCents: 505760, totalCents: 505760, imageUrl: sampleImg("Quadro", "#334155"), hasProduct: true, productCode: "QDR-24", productDesc: "Quadro eletrico 24 polos", productUnit: "pc" },
  ],
};

// Estado EM BRANCO do preview (nenhum orcamento escolhido) — campos vazios / zero. O operador
// escolhe um orcamento real na busca do cabecalho pra ver o relatorio com dados de verdade.
const BLANK_DATA: BudgetReportData = {
  code: "", title: "", items: [], totalCents: 0, subtotalCents: 0, discountCents: 0, taxesCents: 0,
  sectionOrder: [], sectionLabels: { ...SECTION_LABEL }, dimensions: {}, installments: [],
};

// Botao da faixa de opcoes (ribbon) — icone em cima, rotulo embaixo (estilo Office).
// Lista unica de fontes — usada no <select> E na deteccao da fonte do trecho/caixa selecionada.
const FONTS: { v: string; l: string }[] = [
  { v: "Arial, Helvetica, sans-serif", l: "Arial" },
  { v: "'Arial Black', Gadget, sans-serif", l: "Arial Black" },
  { v: "'Helvetica Neue', Helvetica, sans-serif", l: "Helvetica" },
  { v: "Verdana, Geneva, sans-serif", l: "Verdana" },
  { v: "Tahoma, Geneva, sans-serif", l: "Tahoma" },
  { v: "'Trebuchet MS', sans-serif", l: "Trebuchet MS" },
  { v: "Calibri, sans-serif", l: "Calibri" },
  { v: "'Segoe UI', sans-serif", l: "Segoe UI" },
  { v: "Georgia, serif", l: "Georgia" },
  { v: "'Times New Roman', Times, serif", l: "Times New Roman" },
  { v: "Garamond, serif", l: "Garamond" },
  { v: "'Palatino Linotype', Palatino, serif", l: "Palatino" },
  { v: "Cambria, serif", l: "Cambria" },
  { v: "'Courier New', monospace", l: "Courier New" },
  { v: "'Roboto', sans-serif", l: "Roboto" },
];
const fontFirstToken = (s: string) => (s.split(",")[0] || "").replace(/['"]/g, "").trim().toLowerCase();
function RibbonBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label}
      className="flex flex-col items-center justify-center gap-0.5 rounded px-1.5 py-0.5 min-w-[44px] text-slate-700 hover:bg-cyan-50 disabled:opacity-40 disabled:cursor-not-allowed">
      <span className="text-sm leading-none">{icon}</span>
      <span className="text-[9px] leading-tight text-center">{label}</span>
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
  const [linkModal, setLinkModal] = useState<{ url: string; text: string } | null>(null);
  // Linhas/etapas do MODELO de obra (templateId) — usadas no picker quando NÃO há orçamento escolhido.
  const [modelLines, setModelLines] = useState<LineRefPickerLine[]>([]);
  const [modelCustomSections, setModelCustomSections] = useState<{ labels?: Record<string, string>; hidden?: string[] } | null>(null);
  const [modelSectionOrder, setModelSectionOrder] = useState<string[]>([]);
  // PREVIEW POR ORCAMENTO REAL — o operador escolhe um orcamento na busca do cabecalho e o preview
  // renderiza com os dados DELE (mesmo buildReportData do PDF). Sem orcamento = tudo em branco/zero.
  const [previewBudget, setPreviewBudget] = useState<any | null>(null);
  const [budgetQuery, setBudgetQuery] = useState("");
  const [budgetResults, setBudgetResults] = useState<{ id: string; code?: string | null; clientName?: string | null }[]>([]);
  const [budgetPickerOpen, setBudgetPickerOpen] = useState(false);
  // FONTE do picker = o ORÇAMENTO escolhido (linhas/etapas reais; o que se escolhe = o que resolve no
  // preview/impressão). Sem orçamento, cai no MODELO. Resolve o descompasso "L5 do modelo ≠ L5 do orçamento".
  const tplLines = useMemo<LineRefPickerLine[]>(() => {
    if (!previewBudget) return modelLines;
    return ((previewBudget.items ?? []) as any[]).filter((it) => it?.cellRef).map((it) => ({
      cellRef: String(it.cellRef),
      slotName: it.slotName ?? null,
      description: it.description ?? "",
      poolSection: it.poolSection ?? null,
      kind: it.kind ?? "PRODUCT",
      linked: !!(it.product || it.service),
      specs: null,
      qty: Number(it.qty) || 0,
    }));
  }, [previewBudget, modelLines]);
  const tplCustomSections = useMemo(() => previewBudget ? (((previewBudget.environmentParams as any)?.customSections ?? null) as { labels?: Record<string, string>; hidden?: string[] } | null) : modelCustomSections, [previewBudget, modelCustomSections]);
  const tplSectionOrder = useMemo<string[]>(() => previewBudget ? ((previewBudget.sectionOrder as string[]) ?? []) : modelSectionOrder, [previewBudget, modelSectionOrder]);
  const [pickLine, setPickLine] = useState(false);
  const [lineSel, setLineSel] = useState<Set<string>>(new Set());
  const [etapaSel, setEtapaSel] = useState<Set<string>>(new Set()); // selecao quando "O que inserir" e nivel-etapa
  const [lineAttr, setLineAttr] = useState("produto");
  const [edTemplates, setEdTemplates] = useState<{ id: string; name: string; isDefault?: boolean }[]>([]);
  const [iconPicker, setIconPicker] = useState(false); // modal de escolher icone

  // ── CANVAS (PowerPoint): caixas livres da pagina em edicao ──
  // `region` = o que se edita: a PAGINA, o CABECALHO ou o RODAPE. `boxes` segura as caixas
  // da regiao ativa; scheduleSave grava no lugar certo (pagina -> pageConfig; cab/rodape -> branding).
  const [region, setRegion] = useState<"page" | "header" | "footer">("page");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selBox, setSelBox] = useState<string | null>(null);
  // Condicao de visibilidade da caixa (Fase 1b blocos dinamicos)
  // ── CONDIÇÃO (modal ÚNICO, compartilhado): grupo de regras E/OU. Cada regra: alvo + operador. ──
  const NEW_RULE: CondRule = { op: "hasProduct", cellRef: null, etapa: null, value: null, text: null };
  const [condModal, setCondModal] = useState(false);
  const [condDraft, setCondDraft] = useState<CondGroup>({ match: "all", rules: [{ ...NEW_RULE }] });
  // Onde o modal de condição grava ao salvar: a visibilidade da caixa (showIf) OU a exigência de um candidato.
  const [condTarget, setCondTarget] = useState<{ kind: "showIf" } | { kind: "cand"; i: number }>({ kind: "showIf" });
  const setCondRule = (i: number, patch: Partial<CondRule>) => setCondDraft((d) => ({ ...d, rules: d.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addCondRule = () => setCondDraft((d) => ({ ...d, rules: [...d.rules, { ...NEW_RULE }] }));
  const removeCondRule = (i: number) => setCondDraft((d) => ({ ...d, rules: d.rules.filter((_, j) => j !== i) }));
  // ── CANDIDATOS (imagem/texto dinâmico): lista ORDENADA de {linha-fonte + exigências(cond)}. ──
  const [candModal, setCandModal] = useState(false);
  const [candMode, setCandMode] = useState<"image" | "text">("image");
  const [candDraft, setCandDraft] = useState<DynCandidate[]>([]);
  const NEW_CAND: DynCandidate = { cellRef: null, etapa: null, kind: null, cond: null };
  const setCand = (i: number, patch: Partial<DynCandidate>) => setCandDraft((d) => d.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addCand = () => setCandDraft((d) => [...d, { ...NEW_CAND }]);
  const removeCand = (i: number) => setCandDraft((d) => d.filter((_, j) => j !== i));
  const moveCand = (i: number, dir: -1 | 1) => setCandDraft((d) => { const j = i + dir; if (j < 0 || j >= d.length) return d; const n = [...d]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  // Carrega uma condição (grupo, regra única legada, ou vazio) no draft do modal — inferindo a etapa da linha.
  const loadCondGroup = (src: CondRule | CondGroup | null | undefined): CondGroup => {
    const fill = (r: any): CondRule => { const o: CondRule = { op: r.op || "hasProduct", cellRef: r.cellRef ?? null, etapa: r.etapa ?? null, value: r.value ?? null, text: r.text ?? null, kind: r.kind ?? null }; if (o.cellRef && !o.etapa) o.etapa = tplLines.find((l) => l.cellRef === o.cellRef)?.poolSection ?? null; return o; };
    const cur = src as any;
    if (cur && Array.isArray(cur.rules)) return { match: cur.match === "any" ? "any" : "all", rules: cur.rules.length ? cur.rules.map(fill) : [{ ...NEW_RULE }] };
    if (cur && cur.op) return { match: "all", rules: [fill(cur)] };
    return { match: "all", rules: [{ ...NEW_RULE }] };
  };
  const openCondFor = (target: { kind: "showIf" } | { kind: "cand"; i: number }, src: CondRule | CondGroup | null | undefined) => { setCondTarget(target); setCondDraft(loadCondGroup(src)); setCondModal(true); };
  const saveCond = () => {
    if (condTarget.kind === "showIf") patchSelBox({ showIf: condDraft });
    else { const i = condTarget.i; setCandDraft((d) => d.map((c, j) => (j === i ? { ...c, cond: condDraft } : c))); }
    setCondModal(false);
  };
  // Nº de exigências de uma condição (pro rótulo "Exigências (N)").
  const condCount = (c: CondRule | CondGroup | null | undefined): number => { const cur = c as any; if (!cur) return 0; if (Array.isArray(cur.rules)) return cur.rules.length; return cur.op ? 1 : 0; };
  // ── LISTA DINAMICA (tabela): fonte (etapa/filtros) + colunas configuráveis + estilo por coluna ──
  const DEFAULT_LIST: ListConfig = { etapa: null, kind: null, lines: null, skipEmpty: true, maxRows: null, showHeader: true, zebra: true, border: true, headerBg: "#1e3a8a", headerColor: "#ffffff", columns: [{ field: "produto", widthMm: 90, align: "left" }, { field: "qtd", widthMm: 20, align: "right" }, { field: "unidade", widthMm: 20, align: "center" }] };
  const NEW_COL: ListColumn = { field: "produto", header: null, widthMm: null, align: "left", fontPt: null, color: null, bg: null };
  const [listModal, setListModal] = useState(false);
  const [listDraft, setListDraft] = useState<ListConfig>(DEFAULT_LIST);
  const openList = () => { setListDraft({ ...DEFAULT_LIST, ...((selectedBox?.listCfg) || {}), columns: ((selectedBox?.listCfg?.columns?.length ? selectedBox.listCfg.columns : DEFAULT_LIST.columns)).map((c) => ({ ...c })) }); setListModal(true); };
  const setListCol = (i: number, patch: Partial<ListColumn>) => setListDraft((d) => ({ ...d, columns: d.columns.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const addListCol = () => setListDraft((d) => ({ ...d, columns: [...d.columns, { ...NEW_COL }] }));
  const removeListCol = (i: number) => setListDraft((d) => ({ ...d, columns: d.columns.filter((_, j) => j !== i) }));
  const moveListCol = (i: number, dir: -1 | 1) => setListDraft((d) => { const j = i + dir; if (j < 0 || j >= d.columns.length) return d; const n = [...d.columns]; [n[i], n[j]] = [n[j], n[i]]; return { ...d, columns: n }; });
  // Texto legível de UMA regra / de uma condição (escopo do componente — usado na barra E no modal de candidatos).
  const ruleTxt = (r: CondRule) => {
    const alvo = r.cellRef ? `linha ${r.cellRef}` : r.etapa ? `etapa ${sectionLabelFor(r.etapa).toUpperCase()}` : "o orçamento";
    const vv = r.value ?? 0; const tx = r.text || "";
    const ops: Record<string, string> = { hasProduct: "tem produto", noProduct: "não tem produto", qtyGt: `qtd > ${vv}`, qtyGte: `qtd ≥ ${vv}`, qtyEq: `qtd = ${vv}`, qtyNeq: `qtd ≠ ${vv}`, qtyLte: `qtd ≤ ${vv}`, qtyLt: `qtd < ${vv}`, valGt: `valor > ${vv}`, valGte: `valor ≥ ${vv}`, valEq: `valor = ${vv}`, valNeq: `valor ≠ ${vv}`, valLte: `valor ≤ ${vv}`, valLt: `valor < ${vv}`, unitGt: `unitário > ${vv}`, unitGte: `unitário ≥ ${vv}`, unitEq: `unitário = ${vv}`, unitNeq: `unitário ≠ ${vv}`, unitLte: `unitário ≤ ${vv}`, unitLt: `unitário < ${vv}`, descHas: `descrição contém "${tx}"`, descNot: `descrição não contém "${tx}"` };
    return `${alvo} ${ops[r.op] || r.op}`;
  };
  const condText = (c: CondRule | CondGroup | null | undefined) => {
    if (!c) return "sempre";
    if ("rules" in c && Array.isArray(c.rules)) { if (!c.rules.length) return "sempre"; return c.rules.map(ruleTxt).join(c.match === "any" ? " OU " : " E "); }
    if (!("op" in c) || !c.op) return "sempre";
    return ruleTxt(c as CondRule);
  };
  // Banda repetidora (Fase 2 blocos dinamicos)
  const [bandModal, setBandModal] = useState(false);
  const [selSet, setSelSet] = useState<Set<string>>(new Set()); // multi-selecao (shift-clique)
  // Seleciona caixa(s): additive (shift) = alterna no conjunto; senao = seleciona so ela.
  function selectBox(id: string | null, additive?: boolean) {
    if (!id) { setSelBox(null); setSelSet(new Set()); return; }
    setTab("Layout");
    if (additive) {
      setSelSet((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
      setSelBox(id);
    } else { setSelSet(new Set([id])); setSelBox(id); }
  }
  const rnd2 = (v: number) => Math.round(v * 100) / 100;
  // Alinha as caixas selecionadas pela borda/centro da seleção (precisa de 2+).
  function alignSel(kind: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    const bs = boxes.filter((b) => selSet.has(b.id));
    if (bs.length < 2) return;
    const minX = Math.min(...bs.map((b) => b.x)), maxX = Math.max(...bs.map((b) => b.x + b.w));
    const minY = Math.min(...bs.map((b) => b.y)), maxY = Math.max(...bs.map((b) => b.y + b.h));
    const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2;
    commitBoxes(boxes.map((b) => {
      if (!selSet.has(b.id)) return b;
      let { x, y } = b;
      if (kind === "left") x = minX; else if (kind === "hcenter") x = cX - b.w / 2; else if (kind === "right") x = maxX - b.w;
      else if (kind === "top") y = minY; else if (kind === "vcenter") y = cY - b.h / 2; else if (kind === "bottom") y = maxY - b.h;
      return { ...b, x: rnd2(x), y: rnd2(y) };
    }));
  }
  // Distribui as selecionadas com espacamento IGUAL (precisa de 3+).
  function distributeSel(axis: "h" | "v") {
    const bs = boxes.filter((b) => selSet.has(b.id));
    if (bs.length < 3) return;
    const sorted = [...bs].sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
    const startP = axis === "h" ? sorted[0].x : sorted[0].y;
    const last = sorted[sorted.length - 1];
    const endP = axis === "h" ? last.x + last.w : last.y + last.h;
    const totalSize = sorted.reduce((s, b) => s + (axis === "h" ? b.w : b.h), 0);
    const gap = (endP - startP - totalSize) / (sorted.length - 1);
    const pos = new Map<string, number>();
    let cur = startP;
    for (const b of sorted) { pos.set(b.id, cur); cur += (axis === "h" ? b.w : b.h) + gap; }
    commitBoxes(boxes.map((b) => pos.has(b.id) ? (axis === "h" ? { ...b, x: rnd2(pos.get(b.id)!) } : { ...b, y: rnd2(pos.get(b.id)!) }) : b));
  }
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [histInfo, setHistInfo] = useState({ canUndo: false, canRedo: false });
  const histRef = useRef<{ stack: Box[][]; idx: number }>({ stack: [], idx: -1 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  const pageIsCanvas = (p: Page | null) => !!((p?.pageConfig as any)?.canvas);
  const selectedBox = boxes.find((b) => b.id === selBox) || null;
  // Fundo POR PAGINA (nao global): bg/bgType/bgColor2 vivem no pageConfig da pagina.
  const [pageBgCfg, setPageBgCfg] = useState<{ bg?: string | null; bgType?: string; bgColor2?: string }>({});
  const pageBgRef = useRef(pageBgCfg);
  // Nome da pagina (pageConfig.name) — operador batiza (Capa, Sobre, Produtos…).
  const [pageName, setPageName] = useState<string>("");
  const pageNameRef = useRef("");
  const [nameEdit, setNameEdit] = useState<{ id: string; v: string } | null>(null);
  // Cabeçalho/rodapé nesta página? INDEPENDENTES (pageConfig.noHeader / noFooter) — default mostra.
  const [pageNoHeader, setPageNoHeader] = useState(false);
  const [pageNoFooter, setPageNoFooter] = useState(false);
  const pageHFRef = useRef({ noHeader: false, noFooter: false });
  // Caixas vivas da PAGINA (em mm, ja migradas) — preservadas ao entrar/sair de cab/rodape
  // pra NAO reler do editingPage.pageConfig (que fica % stale ate o save debounced gravar).
  const pageBoxesRef = useRef<Box[]>([]);

  // Carrega os boxes + fundo ao abrir uma pagina canvas (volta pra regiao PAGINA, reseta historico).
  useEffect(() => {
    setRegion("page");
    if (editingPage && pageIsCanvas(editingPage)) {
      const pc = (editingPage.pageConfig as any) || {};
      let bs = (pc.boxes || []) as Box[];
      // MIGRACAO de % -> mm (uma vez por pagina): converte usando o tamanho da pagina e persiste unit:"mm".
      const needMigrate = pc.unit !== "mm" && bs.length > 0;
      if (needMigrate) {
        const { w: W, h: H } = pageDims(layout?.branding);
        const r1 = (v: number) => Math.round(v * 10) / 10;
        bs = bs.map((b) => ({ ...b, x: r1(b.x * W / 100), y: r1(b.y * H / 100), w: r1(b.w * W / 100), h: r1(b.h * H / 100) }));
      }
      setBoxes(bs); pageBoxesRef.current = bs; setSelBox(null); setSelSet(new Set()); setSaveState("idle");
      const bg = { bg: pc.bg ?? null, bgType: pc.bgType || "solid", bgColor2: pc.bgColor2 };
      setPageBgCfg(bg); pageBgRef.current = bg;
      const nm = pc.name || ""; setPageName(nm); pageNameRef.current = nm;
      const noHeader = !!(pc.noHeader || pc.noHF), noFooter = !!(pc.noFooter || pc.noHF);
      setPageNoHeader(noHeader); setPageNoFooter(noFooter); pageHFRef.current = { noHeader, noFooter };
      histRef.current = { stack: [JSON.parse(JSON.stringify(bs))], idx: 0 };
      setHistInfo({ canUndo: false, canRedo: false });
      if (needMigrate) scheduleSave(bs, "page"); // grava a migracao (com unit:"mm")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPage?.id]);

  // Muda o fundo SO desta pagina (persiste no pageConfig via scheduleSave).
  function setPageBg(patch: Record<string, any>) {
    const next = { ...pageBgRef.current, ...patch };
    pageBgRef.current = next; setPageBgCfg(next); scheduleSave(boxes);
  }
  // CSS do fundo da pagina atual (gradiente ou solido); usado no editor.
  const pageBgCss = pageBgCfg.bgType === "gradient"
    ? `linear-gradient(135deg, ${pageBgCfg.bg || "#ffffff"}, ${pageBgCfg.bgColor2 || "#e2e8f0"})`
    : (pageBgCfg.bg || "#ffffff");

  // Entra numa regiao de edicao (pagina / cabecalho / rodape) carregando suas caixas.
  function enterRegion(r: "page" | "header" | "footer") {
    const brandNow = (layoutRef.current?.branding || {}) as any;
    // Pagina: usa as caixas VIVAS (mm, ja migradas) do ref — NUNCA reler do pageConfig stale.
    const src = r === "page"
      ? pageBoxesRef.current
      : (brandNow[r === "header" ? "headerBoxes" : "footerBoxes"] || []);
    let bs = JSON.parse(JSON.stringify(src)) as Box[];
    // MIGRACAO %→mm das faixas (uma vez): cab/rodape usam W (pagina) x altura da faixa (mm).
    let migrate = false;
    if (r !== "page" && brandNow.hfUnit !== "mm" && bs.length) {
      const { w: W } = pageDims(layout?.branding);
      const stripH = r === "header" ? (brandNow.headerHmm ?? 18) : (brandNow.footerHmm ?? 14);
      const r1 = (v: number) => Math.round(v * 10) / 10;
      bs = bs.map((b) => ({ ...b, x: r1(b.x * W / 100), y: r1(b.y * stripH / 100), w: r1(b.w * W / 100), h: r1(b.h * stripH / 100) }));
      migrate = true;
    }
    setRegion(r); setBoxes(bs); setSelBox(null); setSelSet(new Set()); setSaveState("idle");
    histRef.current = { stack: [JSON.parse(JSON.stringify(bs))], idx: 0 };
    setHistInfo({ canUndo: false, canRedo: false });
    if (migrate) setTimeout(() => scheduleSave(bs, r), 0); // persiste a migracao da faixa
    setTab("Inserir");
  }

  function scheduleSave(bs: Box[], regionOverride?: "page" | "header" | "footer") {
    const r = regionOverride ?? region;
    if (r === "page") pageBoxesRef.current = bs; // mantem o snapshot vivo da pagina (mm)
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (r === "page") {
          if (!editingPage) return;
          const pageId = editingPage.id;
          const bgc = pageBgRef.current;
          const pageConfig = { canvas: true, unit: "mm", boxes: bs, bg: bgc.bg ?? null, bgType: bgc.bgType || "solid", bgColor2: bgc.bgColor2 ?? null, name: pageNameRef.current || null, noHeader: pageHFRef.current.noHeader || undefined, noFooter: pageHFRef.current.noFooter || undefined };
          await api.put(`/pool-print-layouts/pages/${pageId}`, { type: "FIXED", htmlContent: null, dynamicType: null, pageConfig });
          setLayout((prev) => prev ? { ...prev, pages: prev.pages.map((p) => p.id === pageId ? { ...p, type: "FIXED", pageConfig } : p) } : prev);
        } else {
          const key = r === "header" ? "headerBoxes" : "footerBoxes";
          const nextBrand = { ...((layoutRef.current?.branding || {}) as any), [key]: bs, hfUnit: "mm" };
          await api.put(`/pool-print-layouts/${id}`, { branding: nextBrand });
          setLayout((prev) => prev ? { ...prev, branding: nextBrand } : prev);
        }
        setSaveState("saved");
      } catch { setSaveState("idle"); }
    }, 700);
  }
  function pushHist(next: Box[]) {
    const h = histRef.current;
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push(JSON.parse(JSON.stringify(next)));
    if (h.stack.length > 60) h.stack.shift();
    h.idx = h.stack.length - 1;
    setHistInfo({ canUndo: h.idx > 0, canRedo: false });
  }
  function commitBoxes(next: Box[]) { setBoxes(next); pushHist(next); scheduleSave(next); }
  function undo() {
    const h = histRef.current; if (h.idx <= 0) return;
    h.idx--; const snap = JSON.parse(JSON.stringify(h.stack[h.idx])) as Box[];
    setBoxes(snap); setHistInfo({ canUndo: h.idx > 0, canRedo: h.idx < h.stack.length - 1 }); scheduleSave(snap);
  }
  function redo() {
    const h = histRef.current; if (h.idx >= h.stack.length - 1) return;
    h.idx++; const snap = JSON.parse(JSON.stringify(h.stack[h.idx])) as Box[];
    setBoxes(snap); setHistInfo({ canUndo: h.idx > 0, canRedo: h.idx < h.stack.length - 1 }); scheduleSave(snap);
  }
  // Drag/resize/digitação ao vivo: atualiza + AUTOSAVE (debounce). Commit (1 passo de histórico)
  // no fim do gesto (pointerup) e no blur do texto.
  const onCanvasChange = (b: Box) => setBoxes((cur) => {
    const prev = cur.find((x) => x.id === b.id);
    let next = cur.map((x) => x.id === b.id ? b : x);
    // Card dinamico: arrastar o card carrega os filhos junto (mesmo delta de posicao).
    if (prev && b.type === "CARD") {
      const dx = b.x - prev.x, dy = b.y - prev.y;
      if (dx !== 0 || dy !== 0) next = next.map((x) => x.parentId === b.id ? { ...x, x: x.x + dx, y: x.y + dy } : x);
    }
    scheduleSave(next); return next;
  });
  const onCanvasCommit = () => setBoxes((cur) => { pushHist(cur); scheduleSave(cur); groupSnapRef.current = null; return cur; });
  // Mover o GRUPO (multi-selecao) arrastando: snapshot ao iniciar, desloca TODAS as selecionadas pelo mesmo delta (rigido, preso a pagina).
  const groupSnapRef = useRef<Box[] | null>(null);
  const onCanvasGroupStart = () => setBoxes((cur) => { groupSnapRef.current = cur.map((b) => ({ ...b })); return cur; });
  const onCanvasGroupMove = (dx: number, dy: number) => {
    const snap = groupSnapRef.current; if (!snap || !selSet.size) return;
    const { w: PW, h: PH } = pageDims(layout?.branding);
    const sel = snap.filter((b) => selSet.has(b.id)); if (!sel.length) return;
    const minX = Math.min(...sel.map((b) => b.x)), maxR = Math.max(...sel.map((b) => b.x + b.w));
    const minY = Math.min(...sel.map((b) => b.y)), maxB = Math.max(...sel.map((b) => b.y + b.h));
    let ddx = dx; if (minX + ddx < 0) ddx = -minX; if (maxR + ddx > PW) ddx = PW - maxR;
    let ddy = dy; if (minY + ddy < 0) ddy = -minY; if (maxB + ddy > PH) ddy = PH - maxB;
    const next = snap.map((b) => selSet.has(b.id) ? { ...b, x: rnd2(b.x + ddx), y: rnd2(b.y + ddy) } : b);
    setBoxes(next); scheduleSave(next);
  };
  // Setas do teclado: move a selecao (grupo ou caixa unica) com precisao. Shift = passo maior.
  function nudgeSelection(dx: number, dy: number) {
    const ids = selSet.size ? selSet : (selBox ? new Set([selBox]) : new Set<string>());
    if (!ids.size) return;
    const sel = boxes.filter((b) => ids.has(b.id)); if (!sel.length) return;
    const { w: PW, h: PH } = pageDims(layout?.branding);
    const minX = Math.min(...sel.map((b) => b.x)), maxR = Math.max(...sel.map((b) => b.x + b.w));
    const minY = Math.min(...sel.map((b) => b.y)), maxB = Math.max(...sel.map((b) => b.y + b.h));
    let ddx = dx; if (minX + ddx < 0) ddx = -minX; if (maxR + ddx > PW) ddx = PW - maxR;
    let ddy = dy; if (minY + ddy < 0) ddy = -minY; if (maxB + ddy > PH) ddy = PH - maxB;
    if (!ddx && !ddy) return;
    const next = boxes.map((b) => ids.has(b.id) ? { ...b, x: rnd2(b.x + ddx), y: rnd2(b.y + ddy) } : b);
    commitBoxes(next);
  }

  const maxZ = () => boxes.reduce((m, b) => Math.max(m, b.z || 0), 0);
  // ── Hierarquia de objetos (camadas) ──
  const [objNameEdit, setObjNameEdit] = useState<{ id: string; v: string } | null>(null);
  const [objPanelOpen, setObjPanelOpen] = useState(false); // minimizado por padrao
  // Card que e GRUPO DINAMICO: flag dynamic OU ja tem filhos (legado v1.15.10).
  const isDynCard = (b: Box) => b.type === "CARD" && (!!b.dynamic || boxes.some((c) => c.parentId === b.id));
  const boxTypeIcon = (b: Box) => b.type === "TEXT" ? (Array.isArray(b.txtRules) ? "🔤" : b.href ? "🔗" : "🇹") : b.type === "IMAGE" ? "🖼️" : b.type === "LIST" ? "📋" : b.type === "BLOCK" ? "▦" : b.type === "ICON" ? "⭐" : isDynCard(b) ? "🪄" : "🃏";
  const boxAutoLabel = (b: Box) => {
    if (b.type === "TEXT") { const t = (b.html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); const base = t ? (t.length > 26 ? t.slice(0, 26) + "…" : t) : (Array.isArray(b.txtRules) ? "Texto dinâmico" : "Texto vazio"); return Array.isArray(b.txtRules) ? `${base}${b.showIf ? " ⚡" : ""}` : base; }
    if (b.type === "IMAGE") return Array.isArray(b.imgRules) ? `Imagem dinâmica (${b.imgRules.length})` : (b.url ? "Imagem" : "Imagem (vazia)");
    if (b.type === "LIST") return `Lista dinâmica (${b.listCfg?.columns?.length || 0} col)`;
    if (b.type === "BLOCK") return (DYNAMIC_LABEL as any)?.[b.blockType || ""] || b.blockType || "Bloco";
    if (b.type === "ICON") return REPORT_ICONS.find((i) => i.name === b.icon)?.label || "Ícone";
    return isDynCard(b) ? "Grupo dinâmico" : "Card";
  };
  const boxLabel = (b: Box) => b.name || boxAutoLabel(b);
  // Remove realce (background-color) de dentro do HTML da caixa de texto — limpa o "fundo atrás" do texto.
  function clearTextHighlight() {
    if (!selectedBox || selectedBox.type !== "TEXT" || !selectedBox.html) return;
    const cleaned = selectedBox.html.replace(/background(-color)?\s*:\s*[^;"']+;?/gi, "");
    if (cleaned !== selectedBox.html) patchSelBox({ html: cleaned });
  }
  function renameBox(boxId: string, name: string) {
    setObjNameEdit(null);
    commitBoxes(boxes.map((b) => b.id === boxId ? { ...b, name: name.trim() || undefined } : b));
  }
  // Move a caixa 1 posicao na LISTA (troca z com a vizinha visual). Lista em ordem de insercao
  // (z crescente): topo = mais antiga / atras, fim = mais nova / frente.
  function moveLayer(boxId: string, dir: "up" | "down") {
    const ordered = [...boxes].sort((a, b) => (a.z || 0) - (b.z || 0)); // = ordem exibida
    const i = ordered.findIndex((b) => b.id === boxId); if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1; if (j < 0 || j >= ordered.length) return;
    const zi = ordered[i].z || 0, zj = ordered[j].z || 0;
    commitBoxes(boxes.map((b) => b.id === ordered[i].id ? { ...b, z: zj } : b.id === ordered[j].id ? { ...b, z: zi } : b));
  }
  // Monta UMA caixa nova posicionada contra `cur` (boxes correntes) — PURO, não toca estado.
  // Usado por addBox (1) e addBoxes (N, acumulando) — sem isso o loop usava `boxes` velho e só a
  // última caixa "vingava" (bug: inserir 3 linhas inseria 1).
  function buildBox(kind: "TEXT" | "IMAGE" | "BLOCK" | "CARD" | "ICON" | "LIST", extra: Partial<Box>, cur: Box[]): Box {
    const { w: PW, h: pageH } = pageDims(layout?.branding);
    const isStrip = region !== "page";
    const PH = isStrip ? (region === "header" ? (brand.headerHmm ?? 18) : (brand.footerHmm ?? 14)) : pageH;
    const zTop = cur.reduce((m, b) => Math.max(m, b.z || 0), 0);
    const base: Box = kind === "TEXT"
      ? { id: genBoxId(), type: "TEXT", x: 15, y: 15, w: 110, h: 20, z: zTop + 1, html: "<p>Novo texto</p>", style: { fontSize: 12 } }
      : kind === "IMAGE"
      ? { id: genBoxId(), type: "IMAGE", x: 20, y: 20, w: 80, h: 55, z: zTop + 1, url: "", fit: "cover" }
      : kind === "CARD"
      ? { id: genBoxId(), type: "CARD", x: 15, y: 15, w: 110, h: 60, z: zTop + 1, style: { bg: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1, radius: 8 } }
      : kind === "ICON"
      ? { id: genBoxId(), type: "ICON", x: 20, y: 20, w: 14, h: 14, z: zTop + 1, style: {} }
      : kind === "LIST"
      ? { id: genBoxId(), type: "LIST", x: 12, y: 15, w: 120, h: 45, z: zTop + 1, style: { fontSize: 10 } }
      : { id: genBoxId(), type: "BLOCK", x: 10, y: 15, w: Math.round(PW - 20), h: Math.round(pageH - 30), z: zTop + 1, blockType: "PRODUCTS_BY_SECTION", config: {} };
    if (isStrip) {
      base.x = 6; base.y = 2;
      base.w = Math.min(base.w, Math.round(PW - 12));
      base.h = Math.max(4, Math.min(base.h, Math.round(PH - 4)));
    }
    const off = (cur.length % 6) * (isStrip ? 2 : 6);
    base.x = Math.max(0, Math.min(PW - base.w, (base.x || 0) + off));
    base.y = Math.max(0, Math.min(PH - base.h, (base.y || 0) + off));
    const nb = { ...base, ...extra } as Box;
    if (nb.type === "ICON" && !nb.style?.textColor) {
      const c = REPORT_ICONS.find((i) => i.name === nb.icon)?.color;
      if (c) nb.style = { ...(nb.style || {}), textColor: c };
    }
    // CARD DINAMICO: se um CARD DINAMICO esta selecionado, a caixa nova nasce DENTRO dele (parentId).
    const parentCard = (!isStrip && nb.type !== "CARD" && selBox) ? cur.find((b) => b.id === selBox && b.type === "CARD" && (b.dynamic || cur.some((c) => c.parentId === b.id))) : undefined;
    if (parentCard) {
      const pad = 3;
      nb.w = Math.min(nb.w, Math.max(8, parentCard.w - pad * 2));
      nb.h = Math.min(nb.h, Math.max(6, parentCard.h - pad * 2));
      nb.x = Math.max(parentCard.x + pad, Math.min(parentCard.x + pad + off, parentCard.x + parentCard.w - nb.w - pad));
      nb.y = Math.max(parentCard.y + pad, Math.min(parentCard.y + pad + off, parentCard.y + parentCard.h - nb.h - pad));
      nb.parentId = parentCard.id;
    }
    return nb;
  }
  function addBox(kind: "TEXT" | "IMAGE" | "BLOCK" | "CARD" | "ICON" | "LIST", extra: Partial<Box>) {
    const nb = buildBox(kind, extra, boxes);
    commitBoxes([...boxes, nb]); setSelBox(nb.id); setSelSet(new Set([nb.id])); setTab("Layout");
  }
  // Insere VARIAS caixas de uma vez (acumulando posição/z corretamente) e commita UMA vez.
  function addBoxes(items: { kind: "TEXT" | "IMAGE" | "BLOCK" | "CARD" | "ICON" | "LIST"; extra: Partial<Box> }[]) {
    if (!items.length) return;
    let cur = boxes;
    const added: Box[] = [];
    for (const it of items) { const nb = buildBox(it.kind, it.extra, cur); cur = [...cur, nb]; added.push(nb); }
    commitBoxes(cur);
    setSelBox(added[added.length - 1].id); setSelSet(new Set(added.map((b) => b.id))); setTab("Layout");
  }
  function duplicateSelBox() {
    if (!selectedBox) return;
    const { w: PW, h: PH } = pageDims(layout?.branding);
    // Grupo/card dinamico: duplicar leva os filhos (parentId) junto, remapeando o parentId pro clone.
    const roots = new Set<string>([...(selBox ? [selBox] : []), ...selSet]);
    for (const b of boxes) if (b.parentId && roots.has(b.parentId)) roots.add(b.id);
    // delta (com clamp na pagina) a partir da caixa ancora — filhos acompanham o mesmo deslocamento
    const dx = Math.min(PW - selectedBox.w, selectedBox.x + 5) - selectedBox.x;
    const dy = Math.min(PH - selectedBox.h, selectedBox.y + 5) - selectedBox.y;
    const src = boxes.filter((b) => roots.has(b.id)).sort((a, b) => (a.z || 0) - (b.z || 0));
    const idMap = new Map<string, string>();
    for (const b of src) idMap.set(b.id, genBoxId());
    let zc = maxZ();
    const clones = src.map((b) => {
      const c = JSON.parse(JSON.stringify(b)) as Box;
      c.id = idMap.get(b.id)!;
      if (c.parentId && idMap.has(c.parentId)) c.parentId = idMap.get(c.parentId)!;
      c.x = b.x + dx; c.y = b.y + dy; c.z = ++zc;
      return c;
    });
    commitBoxes([...boxes, ...clones]);
    const anchorId = idMap.get(selBox!)!;
    setSelBox(anchorId); setSelSet(new Set(clones.map((c) => c.id)));
  }
  function patchSelBox(patch: Partial<Box>) {
    if (!selBox) return;
    const cur = boxes.find((b) => b.id === selBox);
    let next = boxes.map((b) => b.id === selBox ? { ...b, ...patch } : b);
    // Card dinamico: mover o card pelos campos X/Y carrega os filhos junto (mesmo delta).
    if (cur && cur.type === "CARD" && (patch.x !== undefined || patch.y !== undefined)) {
      const dx = (patch.x ?? cur.x) - cur.x, dy = (patch.y ?? cur.y) - cur.y;
      if (dx !== 0 || dy !== 0) next = next.map((b) => b.parentId === selBox ? { ...b, x: b.x + dx, y: b.y + dy } : b);
    }
    commitBoxes(next);
  }
  function patchSelStyle(patch: Record<string, any>) {
    if (!selBox) return;
    commitBoxes(boxes.map((b) => b.id === selBox ? { ...b, style: { ...(b.style || {}), ...patch } } : b));
  }
  // Banda repetidora: marca as caixas selecionadas como uma linha-modelo que repete por linha/etapa.
  function makeBand(source: "linhas" | "etapas") {
    const ids = selSet.size ? selSet : (selBox ? new Set([selBox]) : new Set<string>());
    if (!ids.size) return;
    // reusa o band.id existente de alguma caixa selecionada, senao cria um novo
    const existing = boxes.find((b) => ids.has(b.id) && b.band?.id)?.band?.id;
    const id = existing || genBoxId();
    commitBoxes(boxes.map((b) => ids.has(b.id) ? { ...b, band: { id, source } } : b));
    setBandModal(false);
    toast(`Banda criada (${ids.size} caixa(s), repete por ${source === "linhas" ? "linha" : "etapa"})`, "success");
  }
  function clearBand() {
    const ids = selSet.size ? selSet : (selBox ? new Set([selBox]) : new Set<string>());
    if (!ids.size) return;
    commitBoxes(boxes.map((b) => ids.has(b.id) ? { ...b, band: null } : b));
    setBandModal(false);
    toast("Banda removida", "success");
  }
  function removeSelBox() {
    if (!selBox && selSet.size === 0) return;
    const toRemove = new Set<string>([...(selBox ? [selBox] : []), ...selSet]);
    // Card dinamico: apagar o card apaga os filhos (parentId) junto.
    for (const b of boxes) if (b.parentId && toRemove.has(b.parentId)) toRemove.add(b.id);
    commitBoxes(boxes.filter((b) => !toRemove.has(b.id))); setSelBox(null); setSelSet(new Set());
  }
  function zOrder(dir: "front" | "back") {
    if (!selBox) return;
    const zs = boxes.map((b) => b.z || 0); const top = Math.max(...zs, 0); const bot = Math.min(...zs, 0);
    patchSelBox({ z: dir === "front" ? top + 1 : bot - 1 });
  }
  async function newCanvasPage() {
    try {
      await api.post(`/pool-print-layouts/${id}/pages`, { type: "FIXED", htmlContent: null, dynamicType: null, pageConfig: { canvas: true, unit: "mm", boxes: [] }, pageBreak: true, isActive: true });
      const data = await api.get<Layout>(`/pool-print-layouts/${id}`);
      setLayout(data); setName(data.name); setIsDefault(data.isDefault);
      const last = data.pages[data.pages.length - 1];
      if (last) { setShowAddPage(false); setSelectedPageId(last.id); setEditingPage(last); setTab("Inserir"); }
    } catch (err: any) { toast(err?.payload?.message || "Erro", "error"); }
  }
  function convertToCanvas() {
    if (!editingPage) return;
    const p = editingPage; let bs: Box[] = [];
    const { w: PW, h: PH } = pageDims(layout?.branding);
    const nodes = (p.pageConfig as any)?.nodes;
    if (p.type === "DYNAMIC" && p.dynamicType) bs = [{ id: genBoxId(), type: "BLOCK", blockType: p.dynamicType, config: p.pageConfig || {}, x: 8, y: 8, w: Math.round(PW - 16), h: Math.round(PH - 16), z: 1 }];
    else if (p.type === "FIXED" && p.htmlContent) bs = [{ id: genBoxId(), type: "TEXT", html: p.htmlContent, x: 12, y: 12, w: Math.round(PW - 24), h: Math.round(PH - 40), z: 1 }];
    else if (Array.isArray(nodes) && nodes.length) bs = [{ id: genBoxId(), type: "TEXT", html: "<p>Página convertida — recrie os elementos como caixas (aba Inserir).</p>", x: 12, y: 12, w: Math.round(PW - 24), h: 30, z: 1 }];
    setBoxes(bs); setSelBox(null); setSelSet(new Set());
    histRef.current = { stack: [JSON.parse(JSON.stringify(bs))], idx: 0 }; setHistInfo({ canUndo: false, canRedo: false });
    setEditingPage({ ...p, type: "FIXED", pageConfig: { canvas: true, unit: "mm", boxes: bs } } as Page);
    scheduleSave(bs);
  }
  async function renamePage(pageId: string, name: string) {
    setNameEdit(null);
    if (editingPage?.id === pageId) { setPageName(name); pageNameRef.current = name; }
    const p = layoutRef.current?.pages.find((x) => x.id === pageId); if (!p) return;
    const pc = { ...((p.pageConfig as any) || {}), name: name || null };
    try {
      await api.put(`/pool-print-layouts/pages/${pageId}`, { pageConfig: pc });
      setLayout((prev) => prev ? { ...prev, pages: prev.pages.map((x) => x.id === pageId ? { ...x, pageConfig: pc } : x) } : prev);
    } catch (e: any) { toast(e?.payload?.message || "Erro", "error"); }
  }
  async function savePageMeta(patch: any) {
    if (!editingPage) return;
    const pid = editingPage.id;
    try {
      await api.put(`/pool-print-layouts/pages/${pid}`, patch);
      setEditingPage((prev) => prev ? { ...prev, ...patch } as Page : prev);
      setLayout((prev) => prev ? { ...prev, pages: prev.pages.map((p) => p.id === pid ? { ...p, ...patch } : p) } : prev);
    } catch (e: any) { toast(e?.payload?.message || "Erro", "error"); }
  }
  // Atalhos: Ctrl+Z / Ctrl+Y / Delete (so em pagina canvas e fora de campo de texto).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!editingPage || !pageIsCanvas(editingPage)) return;
      const t = e.target as HTMLElement;
      const inField = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selBox && !inField) { e.preventDefault(); removeSelBox(); }
      else if (!inField && (selSet.size || selBox) && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1; // mm; Shift = passo grosso
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeSelection(dx, dy);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPage, selBox, selSet, boxes]);

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

  // ── PREVIEW POR ORCAMENTO REAL — busca + persistencia do ultimo escolhido (localStorage por layout) ──
  const previewKey = `rp-preview-budget:${id}`;
  // Ao abrir, recarrega o ultimo orcamento escolhido.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(previewKey); } catch { /* sem localStorage */ }
    if (!saved) return;
    let cancel = false;
    api.get<any>(`/pool-budgets/${saved}`).then((b) => { if (!cancel) setPreviewBudget(b); })
      .catch(() => { try { localStorage.removeItem(previewKey); } catch { /* ignore */ } });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // Busca de orcamentos (debounce) enquanto digita / ao abrir a busca (lista recentes com q vazio).
  useEffect(() => {
    if (!budgetPickerOpen) return;
    const q = budgetQuery.trim();
    const t = setTimeout(() => {
      api.get<{ data: { id: string; code?: string; clientPartner?: { name?: string } }[] }>(`/pool-budgets?limit=8${q ? `&search=${encodeURIComponent(q)}` : ""}`)
        .then((r) => setBudgetResults((r.data || []).map((b) => ({ id: b.id, code: b.code, clientName: b.clientPartner?.name ?? null }))))
        .catch(() => setBudgetResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [budgetQuery, budgetPickerOpen]);
  // Escolhe um orcamento -> busca completo (com itens/produto) -> vira o preview + salva o ultimo.
  const pickPreviewBudget = async (bid: string) => {
    try {
      const full = await api.get<any>(`/pool-budgets/${bid}`);
      setPreviewBudget(full);
      try { localStorage.setItem(previewKey, bid); } catch { /* ignore */ }
      setBudgetPickerOpen(false); setBudgetQuery("");
    } catch (e: any) { toast(e?.payload?.message || "Erro ao carregar orçamento", "error"); }
  };
  const clearPreviewBudget = () => { setPreviewBudget(null); try { localStorage.removeItem(previewKey); } catch { /* ignore */ } };

  // Modelos de obra (p/ escolher/trocar o modelo do layout no picker de etapa/linha).
  useEffect(() => {
    api.get<{ data: { id: string; name: string; isDefault?: boolean }[] }>("/pool-budget-templates?limit=100")
      .then((r) => setEdTemplates(r.data || [])).catch(() => {});
  }, []);
  // Liga/troca o modelo de obra do layout (persiste) — recarrega as linhas via efeito abaixo.
  const setLayoutTemplate = async (tid: string) => {
    setLayout((prev) => (prev ? { ...prev, templateId: tid || null } : prev));
    try { await api.put(`/pool-print-layouts/${id}`, { templateId: tid || null }); }
    catch { toast("Erro ao salvar o modelo", "error"); }
  };

  // Carrega as linhas do modelo de obra (itemsSnapshot) p/ alimentar o picker de etapa/linha.
  useEffect(() => {
    const tid = layout?.templateId;
    if (!tid) { setModelLines([]); setModelCustomSections(null); setModelSectionOrder([]); return; }
    let cancel = false;
    (async () => {
      try {
        const tpl = await api.get<any>(`/pool-budget-templates/${tid}`);
        const snap = Array.isArray(tpl?.itemsSnapshot) ? tpl.itemsSnapshot : [];
        const lines: LineRefPickerLine[] = snap
          .filter((it: any) => it?.cellRef)
          .map((it: any) => ({
            cellRef: String(it.cellRef),
            slotName: it.slotName ?? null,
            description: it.description ?? "",
            poolSection: it.poolSection ?? null,
            kind: it.kind ?? "PRODUCT",
            linked: true,
            specs: null,
            qty: Number(it.qty) || 0,
          }));
        // Rotulos/ordem das etapas vem de tpl.defaults (gravado pelo "Salvar modelo", v1.13.46+) — usados pelo PICKER.
        const def = (tpl?.defaults ?? {}) as Record<string, any>;
        const cs = (def.customSections ?? null) as { labels?: Record<string, string>; hidden?: string[] } | null;
        const order = Array.isArray(def.sectionOrder) ? (def.sectionOrder as string[]) : [];
        if (!cancel) { setModelLines(lines); setModelCustomSections(cs); setModelSectionOrder(order); }
      } catch { if (!cancel) { setModelLines([]); setModelCustomSections(null); setModelSectionOrder([]); } }
    })();
    return () => { cancel = true; };
  }, [layout?.templateId]);

  // Atributos de "O que inserir" que sao de NIVEL-ETAPA (escolhe a etapa inteira, nao uma linha).
  const ETAPA_ATTRS = useMemo(() => new Set(["etapa", "etapaNome", "etapaItens", "etapaImagem", "etapaTotal"]), []);
  const isEtapaMode = ETAPA_ATTRS.has(lineAttr);
  // Rotulo amigavel de uma etapa: label custom/renomeado > default do enum > a propria chave.
  const sectionLabelFor = useCallback(
    (key: string) => (tplCustomSections?.labels ?? {})[key] ?? SECTION_LABEL[key] ?? key,
    [tplCustomSections],
  );
  // Etapas distintas do modelo, na MESMA ordem salva no modelo de obra (sectionOrder); resto no fim.
  const tplSections = useMemo(() => {
    const keys = Array.from(new Set(tplLines.map((l) => (l.poolSection || "OUTROS")).filter(Boolean) as string[]));
    const order = tplSectionOrder.length > 0 ? tplSectionOrder : SECTION_ORDER;
    return keys.sort((a, b) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }, [tplLines, tplSectionOrder]);

  // ── Seletor de LINHA COMPARTILHADO (tipo + etapa + linha filtrada). Usado nas regras de condição
  // E como FONTE de cada candidato (imagem/texto). `obj` = qualquer {cellRef,etapa,kind}. ──
  const lineCore = (obj: { cellRef?: string | null; etapa?: string | null; kind?: "PRODUCT" | "SERVICE" | null }, onChange: (p: any) => void, lineLabel?: string) => (<>
    <select value={obj.kind || ""} onChange={(e) => onChange({ kind: (e.target.value || null), cellRef: null })}
      title="Filtrar linhas por tipo" className="rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="">Tudo</option>
      <option value="PRODUCT">Produtos</option>
      <option value="SERVICE">Serviços</option>
    </select>
    <select value={obj.etapa || ""} onChange={(e) => { const v = e.target.value || null; const keep = !!obj.cellRef && tplLines.find((l) => l.cellRef === obj.cellRef)?.poolSection === v; onChange({ etapa: v, cellRef: keep ? obj.cellRef : null }); }}
      className="rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[120px] flex-1">
      <option value="">— Etapa —</option>
      {tplSections.map((s) => <option key={s} value={s}>{sectionLabelFor(s).toUpperCase()}</option>)}
    </select>
    <select value={obj.cellRef || ""} onChange={(e) => { const v = e.target.value || null; const ln = v ? tplLines.find((l) => l.cellRef === v) : null; onChange({ cellRef: v, etapa: ln?.poolSection ?? obj.etapa ?? null }); }}
      className="rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[150px] flex-1">
      <option value="">{lineLabel || (obj.etapa ? "— etapa toda —" : "— linha (opcional) —")}</option>
      {tplLines.filter((l) => (!obj.etapa || l.poolSection === obj.etapa) && (!obj.kind || (l.kind || "PRODUCT") === obj.kind)).map((l) => (
        <option key={l.cellRef} value={l.cellRef}>{`${l.cellRef} — ${l.description || (l.slotName || "")}`}</option>
      ))}
    </select>
  </>);
  // ── Linha-de-regra COMPARTILHADA (condição) = lineCore + operador + valor/texto. Modal ÚNICO. ──
  const ruleCore = (r: CondRule, onChange: (p: Partial<CondRule>) => void, lineLabel?: string) => (<>
    {lineCore(r, onChange, lineLabel)}
    <select value={r.op} onChange={(e) => onChange({ op: e.target.value as CondOp })} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
      <option value="hasProduct">tem produto</option>
      <option value="noProduct">não tem produto</option>
      <option value="qtyGt">qtd &gt;</option>
      <option value="qtyGte">qtd ≥</option>
      <option value="qtyEq">qtd =</option>
      <option value="qtyNeq">qtd ≠</option>
      <option value="qtyLte">qtd ≤</option>
      <option value="qtyLt">qtd &lt;</option>
      <option value="valGt">valor &gt;</option>
      <option value="valGte">valor ≥</option>
      <option value="valEq">valor =</option>
      <option value="valNeq">valor ≠</option>
      <option value="valLte">valor ≤</option>
      <option value="valLt">valor &lt;</option>
      <option value="unitGt">unitário &gt;</option>
      <option value="unitGte">unitário ≥</option>
      <option value="unitEq">unitário =</option>
      <option value="unitNeq">unitário ≠</option>
      <option value="unitLte">unitário ≤</option>
      <option value="unitLt">unitário &lt;</option>
      <option value="descHas">descrição contém</option>
      <option value="descNot">descrição não contém</option>
    </select>
    {r.op.startsWith("desc") ? (
      <input type="text" value={r.text ?? ""} onChange={(e) => onChange({ text: e.target.value })}
        placeholder="texto (ex: pré-moldada)" title="Texto procurado na descrição do produto/item" className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm" />
    ) : (r.op.startsWith("qty") || r.op.startsWith("val") || r.op.startsWith("unit")) ? (
      <input type="number" value={r.value ?? 0} onChange={(e) => onChange({ value: Number(e.target.value) })}
        title={r.op.startsWith("qty") ? "Quantidade" : "Valor em R$"} className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm" />
    ) : null}
  </>);

  // Dados do PREVIEW: quando ha modelo de obra ligado, resolve os tokens contra as linhas do
  // PROPRIO modelo (cellRef, etapa, nomes/ordem reais) em vez do SAMPLE_BUDGET fixo — assim o que
  // o operador escolhe no picker (ex: L5 = Parede pre-moldada) e exatamente o que aparece impresso.
  const previewData = useMemo<BudgetReportData>(() => {
    if (!previewBudget) return BLANK_DATA;
    const labels = { ...SECTION_LABEL, ...(((previewBudget.environmentParams as any)?.customSections?.labels) ?? {}) };
    return buildReportData(previewBudget, labels);
  }, [previewBudget]);

  // Fase 5 — alertas: tokens do layout que nao vao resolver (outra origem / linha inexistente / desconhecido).
  const reportIssues = useMemo(
    () => layout
      ? validateLayoutTokens(
          layout,
          SOURCE_CATALOG_ID[layout.sourceType || "POOL_BUDGET"] || "orcamento_obras",
          new Set(tplLines.map((l) => l.cellRef.toUpperCase())),
        )
      : [],
    [layout, tplLines],
  );

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
        const first = fontFirstToken(cs.fontFamily || "");
        // Casa pelo PRIMEIRO token (igualdade) — reconhece TODAS as fontes da lista (antes so 5).
        const hit = FONTS.find((f) => fontFirstToken(f.v) === first);
        if (hit) fontName = hit.v;
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
    const ed = closestEditable(selRange.current);
    if (!pt || !ed) return;
    restoreSel();
    // IMPORTANTE: forcar styleWithCSS=false (senao fontSize=7 vira xx-large). Gera <font size=7>
    // e convertemos pra <span pt>. Depois RE-SELECIONA o trecho convertido (do 1o ao ultimo span)
    // pra NAO perder a selecao ao mudar o tamanho (permite ajustar varias vezes seguidas).
    try { document.execCommand("styleWithCSS", false, "false"); } catch { /* noop */ }
    document.execCommand("fontSize", false, "7");
    const created: HTMLElement[] = [];
    ed.querySelectorAll('font[size="7"]').forEach((f) => {
      const s = document.createElement("span");
      s.style.fontSize = `${pt}pt`;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.replaceWith(s);
      created.push(s);
    });
    if (created.length) {
      const sel = window.getSelection();
      const nr = document.createRange();
      nr.setStartBefore(created[0]);
      nr.setEndAfter(created[created.length - 1]);
      sel?.removeAllRanges(); sel?.addRange(nr);
      selRange.current = nr.cloneRange();
    }
    fireInput(); reflectSel();
  };
  // Fonte/tamanho/cor: aplica na SELECAO se estiver editando texto; senao na CAIXA inteira
  // (style.fontSize/fontFamily/textColor). Resolve o "aumentar fonte nao funciona" com a caixa so selecionada.
  const isEditingText = () => { const ed = closestEditable(selRange.current); return !!(ed && selRange.current && !selRange.current.collapsed); };
  // Caixas que aceitam fonte/cor/tamanho pela barra normal: TEXTO e LISTA dinâmica (a tabela herda do box.style).
  const canBoxFont = (b?: Box | null) => !!b && (b.type === "TEXT" || b.type === "LIST");
  const applySize = (pt: string) => { if (!pt) return; if (isEditingText()) selFontSize(pt); else if (canBoxFont(selectedBox)) patchSelStyle({ fontSize: Number(pt) }); };
  const applyFontName = (v: string) => { if (isEditingText()) selExec("fontName", v); else if (canBoxFont(selectedBox)) patchSelStyle({ fontFamily: v || null }); };
  const applyColor = (v: string) => { if (isEditingText()) selExec("foreColor", v); else if (canBoxFont(selectedBox)) patchSelStyle({ textColor: v }); };
  // Reflete o tamanho/cor da CAIXA selecionada (quando nao esta editando texto).
  useEffect(() => {
    if (canBoxFont(selectedBox) && !isEditingText()) setSizeInput(String(selectedBox?.style?.fontSize ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selBox]);

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
      <div className="flex items-center gap-3 px-4 py-0.5 border-b border-slate-200 bg-white shrink-0">
        <Link href="/pool/print-layouts" className="text-xs text-slate-500 hover:text-slate-700">← Layouts</Link>
        {editingMeta ? (
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="text-sm font-bold text-slate-900 rounded border border-slate-300 px-2 py-0.5" />
            <label className="flex items-center gap-1 text-sm text-slate-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> padrao
            </label>
            <button onClick={saveMeta} className="rounded bg-cyan-600 px-3 py-1 text-sm text-white hover:bg-cyan-700">Salvar</button>
            <button onClick={() => { setEditingMeta(false); setName(layout.name); setIsDefault(layout.isDefault); }}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900">{layout.name}</h1>
            {layout.isDefault && <span className="rounded-full bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5">padrao</span>}
            <button onClick={() => setEditingMeta(true)} className="text-xs text-cyan-600 hover:text-cyan-800">Editar nome</button>
          </div>
        )}
        {/* Preview por orcamento REAL — escolhe qual orcamento alimenta o preview (mesmo motor do PDF).
            Vazio = tudo em branco/zero. O ultimo escolhido fica salvo (localStorage por layout). */}
        <div className="relative ml-4">
          {previewBudget ? (
            <div className="flex items-center gap-1 rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs text-cyan-800">
              <span className="font-semibold whitespace-nowrap">👁 {previewBudget.code || "orçamento"}</span>
              {previewBudget.clientPartner?.name ? <span className="text-cyan-600 max-w-[140px] truncate">— {previewBudget.clientPartner.name}</span> : null}
              <button type="button" onClick={() => { setBudgetPickerOpen(true); setBudgetQuery(""); }} className="ml-1 text-cyan-700 hover:text-cyan-900 underline">trocar</button>
              <button type="button" onClick={clearPreviewBudget} title="Ver em branco" className="text-cyan-500 hover:text-rose-600">✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setBudgetPickerOpen(true); setBudgetQuery(""); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 whitespace-nowrap">🔎 Ver orçamento no preview</button>
          )}
          {budgetPickerOpen ? (<>
            <div className="fixed inset-0 z-[68]" onClick={() => setBudgetPickerOpen(false)} />
            <div className="absolute left-0 top-full z-[69] mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              <input autoFocus value={budgetQuery} onChange={(e) => setBudgetQuery(e.target.value)} placeholder="Buscar por código ou cliente…" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
              <div className="mt-1 max-h-64 overflow-y-auto">
                {budgetResults.length === 0 ? (
                  <div className="px-2 py-3 text-[11px] italic text-slate-400">Nenhum orçamento — digite pra buscar.</div>
                ) : budgetResults.map((b) => (
                  <button key={b.id} type="button" onClick={() => pickPreviewBudget(b.id)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-cyan-50">
                    <span className="font-semibold text-slate-800">{b.code || "—"}</span>{b.clientName ? <span className="text-slate-500"> — {b.clientName}</span> : null}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-1">
                <button type="button" onClick={() => { clearPreviewBudget(); setBudgetPickerOpen(false); }} className="text-[11px] text-slate-500 hover:text-slate-800">Ver em branco</button>
                <button type="button" onClick={() => setBudgetPickerOpen(false)} className="text-[11px] text-slate-500 hover:text-slate-800">Fechar</button>
              </div>
            </div>
          </>) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {editingPage && pageIsCanvas(editingPage) ? (<>
            <button type="button" onClick={undo} disabled={!histInfo.canUndo} title="Voltar (Ctrl+Z)"
              className="h-6 w-6 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">⟲</button>
            <button type="button" onClick={redo} disabled={!histInfo.canRedo} title="Refazer (Ctrl+Y)"
              className="h-6 w-6 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">⟳</button>
            <span className="text-[11px] text-slate-400 min-w-[52px]">{saveState === "saving" ? "salvando…" : saveState === "saved" ? "salvo ✓" : ""}</span>
            <span className="h-5 w-px bg-slate-300" />
          </>) : null}
          <button onClick={() => printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })}
            className="rounded-md bg-blue-700 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-800">🖨️ Imprimir exemplo</button>
        </div>
      </div>

      {/* ABAS DA RIBBON */}
      <div className="flex items-end gap-0.5 px-2 pt-0.5 bg-slate-100 border-b border-slate-200 shrink-0">
        {["Arquivo", "Inicio", "Inserir", "Campos", "Layout", "Cab/Rodape"].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-2.5 py-0.5 text-xs rounded-t-md ${tab === t ? "bg-white font-semibold text-slate-900 border border-b-0 border-slate-200" : "text-slate-600 hover:bg-slate-200"}`}>{t}</button>
        ))}
      </div>

      {/* FAIXA DE OPCOES — cada ferramenta na aba certa (estilo Office).
          zoom encolhe TODAS as ferramentas de uma vez (~50%); flex-wrap deixa quebrar pra uma
          segunda linha em vez de rolar na horizontal (cabe tudo na largura visivel). */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-0.5 bg-white border-b border-slate-200 shrink-0" style={{ zoom: 0.7 }}>
        {tab === "Arquivo" && (<>
          <RibbonBtn icon="✏️" label="Renomear" onClick={() => setEditingMeta(true)} />
          <RibbonBtn icon="💾" label="Salvar estilo" onClick={saveBranding} />
          <RibbonBtn icon="🖨️" label="Imprimir" onClick={() => printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })} />
          <RibbonBtn icon="📑" label="Duplicar" onClick={() => toast("Duplicar: em breve", "info")} />
        </>)}
        {tab === "Inicio" && (<>
          <select value={selFmt.fontName || (canBoxFont(selectedBox) ? (selectedBox?.style?.fontFamily || "") : "")} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => applyFontName(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" title="Fonte (do trecho selecionado, ou da caixa toda se só selecionada)">
            <option value="" disabled hidden></option>
            {FONTS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          {/* Tamanho (pt): setas nativas do campo; aplica NA HORA (na seleção se editando, senão na caixa toda) */}
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Tamanho (pt) — do trecho selecionado, ou da caixa toda se só selecionada">
            <input type="number" min={5} max={200} value={sizeInput} placeholder="Tam"
              onChange={(e) => { setSizeInput(e.target.value); applySize(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applySize(sizeInput); } }}
              className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />pt
          </label>
          <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm" title="Cor do texto (trecho ou caixa toda)"><span>A</span><input type="color" value={selFmt.color} onChange={(e) => applyColor(e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("bold")} className={ribFmtBtn(selFmt.bold)} title="Negrito">B</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("italic")} className={ribFmtBtn(selFmt.italic) + " italic"} title="Italico">I</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("underline")} className={ribFmtBtn(selFmt.underline) + " underline"} title="Sublinhado">U</button>
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("justifyLeft")} className={ribFmtBtn(false)} title="Esquerda">⯇</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("justifyCenter")} className={ribFmtBtn(false)} title="Centro">≡</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selExec("justifyRight")} className={ribFmtBtn(false)} title="Direita">⯈</button>
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => patchSelStyle({ valign: "top" })} className={ribFmtBtn((selectedBox?.style as any)?.valign === "top" || !(selectedBox?.style as any)?.valign)} title="Alinhar em cima">⤒</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => patchSelStyle({ valign: "center" })} className={ribFmtBtn((selectedBox?.style as any)?.valign === "center")} title="Alinhar no meio (vertical)">⇲</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => patchSelStyle({ valign: "bottom" })} className={ribFmtBtn((selectedBox?.style as any)?.valign === "bottom")} title="Alinhar embaixo">⤓</button>
          {selectedBox?.type === "TEXT" ? (<>
            <label className="text-xs text-slate-600 flex items-center gap-1 ml-1" title="Quebra automática de linha na caixa de texto"><input type="checkbox" checked={!((selectedBox.style as any)?.noWrap)} onChange={(e) => patchSelStyle({ noWrap: !e.target.checked })} />Quebra linha</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Espaçamento entre linhas (entrelinha)">Entrelinha
              <NumInput key={`${selectedBox.id}-lh`} value={(selectedBox.style as any)?.lineHeight ?? 0} placeholder="auto" onChange={(v) => patchSelStyle({ lineHeight: v || null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
          </>) : null}
          {/* ── grupo PAGINA (tamanho/orientacao/fundo) ── */}
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Orientação (define o tamanho padrão)">Pág.
            <select value={brand.orientation || "portrait"} onChange={(e) => { const v = e.target.value; setBranding({ orientation: v, pageWidthMm: v === "landscape" ? 297 : 210, pageHeightMm: v === "landscape" ? 210 : 297 }); }} className="rounded border border-slate-300 px-1 py-1 text-sm">
              <option value="portrait">Retrato</option><option value="landscape">Paisagem</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Largura da página (mm)">L<NumInput value={pageDims(layout.branding).w} onChange={(v) => setBranding({ pageWidthMm: v || null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Altura da página (mm) — diminua p/ folha mais baixa">A<NumInput value={pageDims(layout.branding).h} onChange={(v) => setBranding({ pageHeightMm: v || null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Margem (guia tracejada no editor; só referência)">Margem<NumInput value={brand.pageMarginMm ?? 12} onChange={(v) => setBranding({ pageMarginMm: v || null })} className="w-12 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Fundo SÓ desta página">Fundo
            <select value={pageBgCfg.bgType || "solid"} onChange={(e) => setPageBg({ bgType: e.target.value })} className="rounded border border-slate-300 px-1 py-1 text-sm"><option value="solid">Sólido</option><option value="gradient">Gradiente</option></select>
            <input type="color" value={pageBgCfg.bg || "#ffffff"} onChange={(e) => setPageBg({ bg: e.target.value })} className="h-6 w-6 cursor-pointer rounded border border-slate-300 p-0" />
            {pageBgCfg.bgType === "gradient" ? <input type="color" value={pageBgCfg.bgColor2 || "#e2e8f0"} onChange={(e) => setPageBg({ bgColor2: e.target.value })} className="h-6 w-6 cursor-pointer rounded border border-slate-300 p-0" /> : null}
            <button type="button" onClick={() => setPageBg({ bg: null })} title="Sem fundo (branco)" className="text-slate-400 hover:text-slate-700">⌫</button>
          </label>
          {/* ── grupo MARCA (cores) — logo agora é só inserir IMAGEM (Inserir/Campos) ── */}
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Cor primária">Prim.<input type="color" value={brand.primaryColor || "#0f172a"} onChange={(e) => setBranding({ primaryColor: e.target.value })} className="h-6 w-6 cursor-pointer rounded border border-slate-300 p-0" /></label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Cor de destaque">Dest.<input type="color" value={brand.accentColor || "#1e3a8a"} onChange={(e) => setBranding({ accentColor: e.target.value })} className="h-6 w-6 cursor-pointer rounded border border-slate-300 p-0" /></label>
          <RibbonBtn icon="💾" label="Salvar estilo" onClick={saveBranding} />
          {/* ── grupo PAGINA (flags) ── */}
          {editingPage ? (<>
            <span className="mx-1 h-6 w-px bg-slate-300" />
            {!pageIsCanvas(editingPage) ? <RibbonBtn icon="🔓" label="Converter canvas" onClick={convertToCanvas} /> : null}
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Página ativa"><input type="checkbox" checked={editingPage.isActive !== false} onChange={(e) => savePageMeta({ isActive: e.target.checked })} />Ativa</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Quebra de página depois"><input type="checkbox" checked={editingPage.pageBreak !== false} onChange={(e) => savePageMeta({ pageBreak: e.target.checked })} />Quebra</label>
          </>) : null}
        </>)}
        {tab === "Inserir" && (<>
          <RibbonBtn icon="➕" label="Nova pagina" onClick={newCanvasPage} />
          <span className="mx-0.5 h-5 w-px bg-slate-300" />
          {editingPage && pageIsCanvas(editingPage) ? (<>
            <RibbonBtn icon="🃏" label="Card" onClick={() => addBox("CARD", {})} />
            <RibbonBtn icon="🪄" label="Grupo dinâmico" onClick={() => addBox("CARD", { dynamic: true })} />
            <RibbonBtn icon="🇹" label="Texto" onClick={() => addBox("TEXT", {})} />
            <RibbonBtn icon="🔤" label="Texto dinâmico" onClick={() => addBox("TEXT", { txtRules: [] })} />
            <RibbonBtn icon="🖼️" label="Imagem" onClick={() => addBox("IMAGE", {})} />
            <RibbonBtn icon="🖼️" label="Imagem dinâmica" onClick={() => addBox("IMAGE", { imgRules: [] })} />
            <RibbonBtn icon="📋" label="Lista dinâmica" onClick={() => addBox("LIST", { listCfg: { ...DEFAULT_LIST, columns: DEFAULT_LIST.columns.map((c) => ({ ...c })) } })} />
            <RibbonBtn icon="⭐" label="Ícone" onClick={() => setIconPicker(true)} />
            <RibbonBtn icon="🔗" label="Link" onClick={() => setLinkModal({ url: "", text: "" })} />
            <span className="mx-0.5 h-5 w-px bg-slate-300" />
            <RibbonBtn icon="📚" label="Campos & blocos" onClick={() => setTab("Campos")} />
            <span className="text-[10px] text-slate-400 ml-1">Campos/blocos do sistema na aba &quot;Campos&quot; · arraste na folha pra mover · alças pra redimensionar.</span>
          </>) : (
            <span className="text-xs text-slate-500 px-2">Crie/abra uma pagina pra inserir caixas (texto, imagem, bloco).</span>
          )}
        </>)}
        {tab === "Campos" && (
          <span className="text-xs text-slate-500 px-2">📚 Bíblia de campos &amp; blocos no painel à direita → · clique num item (ou no &quot;+&quot;) pra inserir na página. Origens: Orçamento, Ordem de Serviço, Financeiro, Cliente…</span>
        )}
        {tab === "Layout" && (selectedBox ? (() => {
          const sb = selectedBox; const sbst: any = sb.style || {};
          const { w: PW, h: PH } = pageDims(layout?.branding);
          const r1 = (v: number) => Math.round(v * 10) / 10;
          const clampN = (v: number, max: number) => Math.max(0, Math.min(max, isNaN(v) ? 0 : v));
          // GRUPO DINAMICO: card com dynamic=true (ou legado v1.15.10 = card que ja tem filhos).
          // Tem ferramentas PROPRIAS (exigencias + conteudo).
          const isDyn = sb.type === "CARD" && (!!sb.dynamic || boxes.some((b) => b.parentId === sb.id));
          const kids = isDyn ? boxes.filter((b) => b.parentId === sb.id) : [];
          // Abre a lista de candidatos (imagem/texto) carregando do box. Migra candidato antigo (v1.15.14,
          // CondRule "flat" com op no topo) pro formato {cellRef, cond}.
          const migrateCand = (c: any): DynCandidate => {
            if (c && c.cond !== undefined) return { ...c };
            if (c && c.op) return { cellRef: c.cellRef ?? null, etapa: c.etapa ?? null, kind: c.kind ?? null, cond: { match: "all", rules: [{ op: c.op, cellRef: null, etapa: null, value: c.value ?? null, text: c.text ?? null, kind: null }] } };
            return { cellRef: c?.cellRef ?? null, etapa: c?.etapa ?? null, kind: c?.kind ?? null, cond: null, text: c?.text ?? null };
          };
          const openCands = (mode: "image" | "text") => {
            setCandMode(mode);
            setCandDraft(((mode === "image" ? sb.imgRules : sb.txtRules) ?? []).map(migrateCand));
            setCandModal(true);
          };
          return (<>
            {/* ── Ferramentas PRÓPRIAS do GRUPO DINÂMICO (só quando ele está selecionado) ── */}
            {isDyn ? (<>
              <span className="self-center rounded bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white" title="Grupo dinâmico: o que você inserir com ele selecionado entra DENTRO; mover/excluir leva os campos junto; as Exigências valem pro grupo inteiro.">🪄 Grupo dinâmico</span>
              <RibbonBtn icon="⚡" label={sb.showIf ? "Exigências ✓" : "Exigências"} onClick={() => openCondFor({ kind: "showIf" }, sb.showIf)} />
              <span className="self-center max-w-[230px] truncate text-[11px] italic text-slate-500" title={`aparece se ${condText(sb.showIf)}`}>{condCount(sb.showIf) ? `aparece se ${condText(sb.showIf)}` : "aparece SEMPRE"}</span>
              {sb.showIf ? <RibbonBtn icon="🚫" label="Sempre aparece" onClick={() => patchSelBox({ showIf: null })} /> : null}
              <RibbonBtn icon="📦" label={`Conteúdo (${kids.length})`} disabled={kids.length === 0} onClick={() => { const ids = kids.map((k) => k.id); setSelBox(ids[0]); setSelSet(new Set(ids)); }} />
              <span className="mx-1 self-center h-6 w-px bg-violet-300" />
            </>) : null}
            {/* ── IMAGEM DINÂMICA — candidatos (linha + ⚡ Exigências, o MESMO modal) ── */}
            {sb.type === "IMAGE" && Array.isArray(sb.imgRules) ? (<>
              <span className="self-center rounded bg-fuchsia-600 px-2 py-0.5 text-[11px] font-bold text-white" title="Imagem dinâmica: 1º candidato (em ordem) cujas exigências batem e tem imagem manda.">🖼️ Imagem dinâmica</span>
              <RibbonBtn icon="⚡" label={sb.imgRules.length ? `Exigências (${sb.imgRules.length})` : "Exigências"} onClick={() => openCands("image")} />
              <span className="mx-1 self-center h-6 w-px bg-fuchsia-300" />
            </>) : null}
            {/* ── LISTA DINÂMICA — tabela das linhas (configura fonte/colunas/estilo) ── */}
            {sb.type === "LIST" ? (<>
              <span className="self-center rounded bg-teal-600 px-2 py-0.5 text-[11px] font-bold text-white" title="Lista dinâmica: tabela que monta sozinha as linhas do orçamento (pula vazias). Configure fonte, colunas e estilo.">📋 Lista dinâmica</span>
              <RibbonBtn icon="⚙️" label="Configurar lista" onClick={openList} />
              <span className="mx-1 self-center h-6 w-px bg-teal-300" />
            </>) : null}
            {/* ── TEXTO DINÂMICO — texto normal (edita inline) + condição (MESMO modal dos dinâmicos) ── */}
            {sb.type === "TEXT" && Array.isArray(sb.txtRules) ? (<>
              <span className="self-center rounded bg-fuchsia-600 px-2 py-0.5 text-[11px] font-bold text-white" title="Texto dinâmico: texto normal (duplo-clique pra editar, ferramentas de texto da aba Início) que só aparece quando as Exigências baterem. Mesmo modal de condição dos dinâmicos.">🔤 Texto dinâmico</span>
              <RibbonBtn icon="⚡" label={sb.showIf ? "Exigências ✓" : "Exigências"} onClick={() => openCondFor({ kind: "showIf" }, sb.showIf)} />
              <span className="self-center max-w-[230px] truncate text-[11px] italic text-slate-500" title={`aparece se ${condText(sb.showIf)}`}>{condCount(sb.showIf) ? `aparece se ${condText(sb.showIf)}` : "aparece SEMPRE"}</span>
              {sb.showIf ? <RibbonBtn icon="🚫" label="Sempre aparece" onClick={() => patchSelBox({ showIf: null })} /> : null}
              <span className="mx-1 self-center h-6 w-px bg-fuchsia-300" />
            </>) : null}
            <span className="text-[10px] uppercase tracking-wide text-slate-400">{isDyn ? "Grupo:" : "Caixa:"}</span>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Posição horizontal (mm a partir da esquerda; 0 = canto)">X<NumInput key={`${sb.id}-x`} value={r1(sb.x)} onChange={(v) => patchSelBox({ x: clampN(v, PW - sb.w) })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Posição vertical (mm a partir do topo; 0 = canto)">Y<NumInput key={`${sb.id}-y`} value={r1(sb.y)} onChange={(v) => patchSelBox({ y: clampN(v, PH - sb.h) })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Largura (mm)">L<NumInput key={`${sb.id}-w`} value={r1(sb.w)} onChange={(v) => patchSelBox({ w: clampN(v, PW - sb.x) })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Altura (mm)">A<NumInput key={`${sb.id}-h`} value={r1(sb.h)} onChange={(v) => patchSelBox({ h: clampN(v, PH - sb.y) })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
            <span className="mx-0.5 h-5 w-px bg-slate-300" />
            <RibbonBtn icon="⬄" label="Centro H" onClick={() => patchSelBox({ x: r1((PW - sb.w) / 2) })} />
            <RibbonBtn icon="⬍" label="Centro V" onClick={() => patchSelBox({ y: r1((PH - sb.h) / 2) })} />
            <RibbonBtn icon="⤒" label="Frente" onClick={() => zOrder("front")} />
            <RibbonBtn icon="⤓" label="Tras" onClick={() => zOrder("back")} />
            {/* Condição/Repetir genéricos NÃO aparecem no grupo dinâmico (ele usa "Exigências"; repetir = multiplicador, futuro) */}
            {!isDyn && !(sb.type === "TEXT" && Array.isArray(sb.txtRules)) ? <RibbonBtn icon="⚡" label={sb.showIf ? "Condicao ✓" : "Condicao"} onClick={() => openCondFor({ kind: "showIf" }, sb.showIf)} /> : null}
            {!isDyn ? <RibbonBtn icon="🔁" label={sb.band ? "Banda ✓" : "Repetir"} onClick={() => setBandModal(true)} /> : null}
            {sb.parentId ? <RibbonBtn icon="🔓" label="Soltar do grupo" onClick={() => patchSelBox({ parentId: null })} /> : null}
            {/* Caixa solta (sem grupo) + existe grupo dinamico na pagina = botao pra COLOCAR no grupo.
                Escolhe o grupo cujo retangulo contem o centro da caixa; senao o primeiro. Assim ela passa
                a acompanhar o grupo ao mover/excluir (parentId), resolvendo "a lista nao acompanhou o grupo". */}
            {!sb.parentId && sb.type !== "CARD" ? (() => {
              const groups = boxes.filter((b) => b.id !== sb.id && b.type === "CARD" && (!!b.dynamic || boxes.some((c) => c.parentId === b.id)));
              if (!groups.length) return null;
              const cx = sb.x + sb.w / 2, cy = sb.y + sb.h / 2;
              const target = groups.find((g) => cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h) || groups[0];
              return <RibbonBtn icon="📥" label="Colocar no grupo" onClick={() => patchSelBox({ parentId: target.id })} />;
            })() : null}
            {selSet.size >= 2 ? (
              <>
                <span className="mx-1 self-center h-6 w-px bg-slate-200" />
                <RibbonBtn icon="⊢" label="Alinh esq" onClick={() => alignSel("left")} />
                <RibbonBtn icon="⊟" label="Alinh centro" onClick={() => alignSel("hcenter")} />
                <RibbonBtn icon="⊣" label="Alinh dir" onClick={() => alignSel("right")} />
                <RibbonBtn icon="⊤" label="Alinh topo" onClick={() => alignSel("top")} />
                <RibbonBtn icon="⊞" label="Alinh meio" onClick={() => alignSel("vcenter")} />
                <RibbonBtn icon="⊥" label="Alinh base" onClick={() => alignSel("bottom")} />
                {selSet.size >= 3 ? (
                  <>
                    <RibbonBtn icon="⇿" label="Distrib H" onClick={() => distributeSel("h")} />
                    <RibbonBtn icon="⇳" label="Distrib V" onClick={() => distributeSel("v")} />
                  </>
                ) : null}
              </>
            ) : null}
            <span className="mx-0.5 h-5 w-px bg-slate-300" />
            <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs" title="Cor de fundo da caixa">Fundo<input type="color" value={sbst.bg || "#ffffff"} onChange={(e) => patchSelStyle({ bg: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /><button type="button" onClick={() => patchSelStyle({ bg: null })} title="Sem fundo" className="text-slate-400 hover:text-slate-700">⌫</button></label>
            <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs" title="Cor do ícone / texto da caixa">Cor<input type="color" value={sbst.textColor || "#16365C"} onChange={(e) => patchSelStyle({ textColor: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Borda (px)">Borda<NumInput key={`${sb.id}-bw`} value={sbst.borderWidth ?? 0} onChange={(v) => patchSelStyle({ borderWidth: v || null })} className="w-12 rounded border border-slate-300 px-1 py-1 text-sm" /><input type="color" value={sbst.borderColor || "#e2e8f0"} onChange={(e) => patchSelStyle({ borderColor: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Cantos (px)">Cantos<NumInput key={`${sb.id}-rad`} value={sbst.radius ?? 0} onChange={(v) => patchSelStyle({ radius: v || null })} className="w-12 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Espacamento interno (px)">Padding<NumInput key={`${sb.id}-pad`} value={sbst.padding ?? 0} onChange={(v) => patchSelStyle({ padding: v || null })} className="w-12 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Sombra"><input type="checkbox" checked={!!sbst.shadow} onChange={(e) => patchSelStyle({ shadow: e.target.checked })} />Sombra</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Opacidade (0-1)">Opac.<NumInput key={`${sb.id}-op`} value={sbst.opacity ?? 1} onChange={(v) => patchSelStyle({ opacity: v })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
            {sb.type === "TEXT" ? (
              <label className="text-xs text-slate-600 flex items-center gap-1" title="Alinhamento vertical do texto">V-align
                <select value={sbst.valign || "top"} onChange={(e) => patchSelStyle({ valign: e.target.value })} className="rounded border border-slate-300 px-1 py-1 text-sm"><option value="top">Topo</option><option value="center">Centro</option><option value="bottom">Base</option></select>
              </label>
            ) : null}
            {sb.type === "IMAGE" ? (<>
              <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">📁 Imagem<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await uploadAsset(f); patchSelBox({ url }); } catch (err: any) { toast(err.message || "Erro", "error"); } if (e.target) e.target.value = ""; }} /></label>
              <label className="text-xs text-slate-600 flex items-center gap-1" title="Ajuste da imagem">Ajuste
                <select value={sb.fit || "cover"} onChange={(e) => patchSelBox({ fit: e.target.value as any })} className="rounded border border-slate-300 px-1 py-1 text-sm"><option value="cover">Preencher (corta)</option><option value="contain">Conter (inteira)</option><option value="fill">Esticar</option></select>
              </label>
            </>) : null}
            {sb.type === "TEXT" || sb.type === "IMAGE" ? (
              <label className="text-xs text-slate-600 flex items-center gap-1" title="URL que fica ATRÁS (clicável no PDF). Aceita link, nº de WhatsApp ou @ do Instagram. Vazio = sem link.">🔗 URL (atrás)<input value={sb.href || ""} placeholder="link / número / @perfil" onChange={(e) => patchSelBox({ href: e.target.value || null })} className="w-36 rounded border border-slate-300 px-1 py-1 text-xs" /></label>
            ) : null}
            {sb.type === "TEXT" && (sb.href != null) ? (
              <label className="text-xs text-slate-600 flex items-center gap-1" title="Texto que aparece na FRENTE (a máscara do link). Ex.: @julianotriaca, (66) 99986-1234, Fale no WhatsApp.">🏷️ Rótulo (frente)<input value={(sb.html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()} placeholder="@julianotriaca / número / texto" onChange={(e) => { const t = e.target.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); patchSelBox({ html: `<p style="text-align:center">${t}</p>` }); }} className="w-40 rounded border border-slate-300 px-1 py-1 text-xs" /></label>
            ) : null}
            {sb.type === "TEXT" ? <RibbonBtn icon="🚫" label="Limpar realce" onClick={clearTextHighlight} /> : null}
            <span className="mx-0.5 h-5 w-px bg-slate-300" />
            <RibbonBtn icon="📑" label="Duplicar" onClick={duplicateSelBox} />
            <RibbonBtn icon="🗑️" label="Excluir" onClick={removeSelBox} />
          </>);
        })() : (
          <span className="text-xs text-slate-500 px-2">{editingPage && pageIsCanvas(editingPage) ? "Clique numa caixa na folha pra ver tamanho, posição e estilo aqui." : "Abra uma página canvas e selecione uma caixa."}</span>
        ))}
        {tab === "Cab/Rodape" && (<>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Editar faixa:</span>
          <RibbonBtn icon="🔝" label="Cabeçalho" onClick={() => enterRegion("header")} />
          <RibbonBtn icon="🔻" label="Rodapé" onClick={() => enterRegion("footer")} />
          {region !== "page" ? <RibbonBtn icon="↩️" label="Voltar à página" onClick={() => enterRegion("page")} /> : null}
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Altura do cabeçalho (mm)">Cab.<NumInput value={brand.headerHmm ?? 18} onChange={(v) => setBranding({ headerHmm: v || null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Altura do rodapé (mm)">Rod.<NumInput value={brand.footerHmm ?? 14} onChange={(v) => setBranding({ footerHmm: v || null })} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
          <RibbonBtn icon="💾" label="Salvar" onClick={saveBranding} />
          {editingPage && pageIsCanvas(editingPage) ? (<>
            <span className="mx-1 h-6 w-px bg-slate-300" />
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Nesta página:</span>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Mostrar o CABEÇALHO nesta página"><input type="checkbox" checked={!pageNoHeader} onChange={(e) => { const v = !e.target.checked; setPageNoHeader(v); pageHFRef.current = { ...pageHFRef.current, noHeader: v }; scheduleSave(boxes); }} />Cabeçalho</label>
            <label className="text-xs text-slate-600 flex items-center gap-1" title="Mostrar o RODAPÉ nesta página"><input type="checkbox" checked={!pageNoFooter} onChange={(e) => { const v = !e.target.checked; setPageNoFooter(v); pageHFRef.current = { ...pageHFRef.current, noFooter: v }; scheduleSave(boxes); }} />Rodapé</label>
          </>) : null}
          <span className="text-[10px] text-slate-400 ml-1">Edite como uma página: vá em <b>Inserir</b> (texto, imagem, campos). Marque/desmarque <b>Cabeçalho</b> e <b>Rodapé</b> por página — independentes (em todas ou só numa).</span>
        </>)}
      </div>

      {/* 3 PAINEIS — topo (titulo+abas+faixa) fica FIXO; aqui embaixo: paginas | folha | editor */}
      <div className="flex flex-1 min-h-0">
      {/* ESQUERDA: Paginas + estilo */}
      <div className="w-[340px] shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto p-3 space-y-2">

      {/* HIERARQUIA DE OBJETOS (camadas) — minimizada por padrao, no topo */}
      {editingPage && pageIsCanvas(editingPage) ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <button type="button" onClick={() => setObjPanelOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-slate-50 rounded-lg">
            <span className="w-3 shrink-0 text-center text-[10px] text-slate-500">{objPanelOpen ? "▾" : "▸"}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">🗂️ Objetos</span>
            {region !== "page" ? <span className="text-[9px] text-amber-600">· {region === "header" ? "cab." : "rod."}</span> : null}
            <span className="ml-auto text-[9px] text-slate-400">{boxes.length}</span>
          </button>
          {objPanelOpen ? (
            boxes.length === 0 ? (
              <div className="px-2 py-2 text-center text-[10px] text-slate-400">Sem objetos. Use <b>Inserir</b>.</div>
            ) : (
              <div className="max-h-44 overflow-y-auto border-t border-slate-100 p-1 space-y-0.5">
                {[...boxes].sort((a, b) => (a.z || 0) - (b.z || 0)).map((b) => (
                  <div key={b.id} onClick={(e) => selectBox(b.id, e.shiftKey)}
                    title="Clique pra selecionar · ✏️ renomeia · ⬆⬇ ordem"
                    className={`group flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer text-[10px] ${selBox === b.id ? "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-300" : "text-slate-700 hover:bg-slate-100"}`}>
                    <span className="w-3.5 shrink-0 text-center">{boxTypeIcon(b)}</span>
                    {objNameEdit?.id === b.id ? (
                      <input autoFocus value={objNameEdit.v} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setObjNameEdit({ id: b.id, v: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameBox(b.id, objNameEdit!.v); } else if (e.key === "Escape") setObjNameEdit(null); }}
                        onBlur={() => renameBox(b.id, objNameEdit!.v)}
                        placeholder={boxAutoLabel(b)} className="min-w-0 flex-1 rounded border border-cyan-300 px-1 py-0 text-[10px]" />
                    ) : (
                      <span className={`min-w-0 flex-1 truncate ${b.name ? "" : "italic text-slate-500"}`}>{boxLabel(b)}</span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setObjNameEdit({ id: b.id, v: b.name || "" }); }} title="Renomear objeto" className="shrink-0 text-slate-300 hover:text-cyan-600 opacity-0 group-hover:opacity-100">✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(b.id, "up"); }} title="Subir na lista" className="shrink-0 text-slate-300 hover:text-cyan-600 opacity-0 group-hover:opacity-100">⬆</button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(b.id, "down"); }} title="Descer na lista" className="shrink-0 text-slate-300 hover:text-cyan-600 opacity-0 group-hover:opacity-100">⬇</button>
                    <button onClick={(e) => { e.stopPropagation(); commitBoxes(boxes.filter((x) => x.id !== b.id)); if (selBox === b.id) setSelBox(null); }} title="Excluir objeto" className="shrink-0 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100">✕</button>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Paginas</div>
        <button onClick={newCanvasPage} className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-700">+ Pagina</button>
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
              <NumInput value={brand.fontSizePt ?? 0} onChange={(v) => setBranding({ fontSizePt: v || null })}
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
              <NumInput value={brand.pageMarginMm ?? 12} onChange={(v) => setBranding({ pageMarginMm: v || null })}
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
              onClick={() => { setShowAddPage(false); setSelectedPageId(p.id); setEditingPage(p); }}
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDragEnd={handleDragEnd}
              title="Clique para editar esta pagina (estilo PowerPoint)"
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
                    {(p.pageConfig as any)?.canvas ? (
                      <span className="rounded-full bg-cyan-100 text-cyan-700 text-[10px] px-2 py-0.5 font-semibold">CANVAS</span>
                    ) : (p.pageConfig as any)?.nodes?.length ? (
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
                  <div className="font-medium text-slate-900 flex items-center gap-1">
                    {nameEdit?.id === p.id ? (
                      <input autoFocus value={nameEdit.v} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setNameEdit({ id: p.id, v: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renamePage(p.id, nameEdit!.v); } else if (e.key === "Escape") setNameEdit(null); }}
                        onBlur={() => renamePage(p.id, nameEdit!.v)}
                        placeholder={`Página ${idx + 1}`} className="w-full rounded border border-cyan-300 px-1 py-0.5 text-sm" />
                    ) : (<>
                      <span className="truncate">{(p.pageConfig as any)?.name || `Página ${idx + 1}`}</span>
                      <button onClick={(e) => { e.stopPropagation(); setNameEdit({ id: p.id, v: (p.pageConfig as any)?.name || "" }); }} title="Renomear página" className="text-xs text-slate-400 hover:text-cyan-600">✏️</button>
                    </>)}
                  </div>
                  {p.isConditional && (
                    <div className="text-xs text-orange-600 mt-1">
                      Aparece apenas se: {JSON.stringify(p.conditionRule)}
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setPendingDelete({ id: p.id, n: idx + 1 }); }}
                  title="Remover pagina"
                  className="h-6 w-6 shrink-0 rounded text-sm text-slate-400 hover:bg-red-50 hover:text-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>{/* fim painel esquerdo (Paginas & estilo) */}

      {/* CENTRO: folha da pagina selecionada (canvas editavel, estilo PowerPoint) */}
      <div className="flex-1 min-w-0 overflow-auto bg-slate-200 flex flex-col">
        {editingPage && pageIsCanvas(editingPage) && region !== "page" ? (
          <div className="flex flex-col" style={{ height: "100%" }}>
            <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-xs text-amber-800">
              ✏️ Editando <b>{region === "header" ? "cabeçalho" : "rodapé"}</b> — vá em <b>Inserir</b>/<b>Campos</b> pra adicionar. Aparece em todas as páginas.
              <button type="button" onClick={() => enterRegion("page")} className="ml-auto rounded bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-700">↩ Voltar à página</button>
            </div>
            <div className="flex-1 min-h-0">
              <CanvasEditor boxes={boxes} data={previewData} branding={layout.branding} unit="mm"
                selBox={selBox} selSet={selSet} pageW={pageDims(layout.branding).w} pageH={region === "header" ? (brand.headerHmm ?? 18) : (brand.footerHmm ?? 14)}
                pageBg="#ffffff"
                onSelect={selectBox}
                onGroupStart={onCanvasGroupStart} onGroupMove={onCanvasGroupMove}
                onChange={onCanvasChange} onCommit={onCanvasCommit} onEditStart={() => setTab("Inicio")} />
            </div>
          </div>
        ) : editingPage && pageIsCanvas(editingPage) ? (
          <CanvasEditor boxes={boxes} data={previewData} branding={layout.branding} unit="mm" hfUnit={(brand as any)?.hfUnit === "mm" ? "mm" : "%"}
            selBox={selBox} selSet={selSet} pageW={pageDims(layout.branding).w} pageH={pageDims(layout.branding).h}
            pageBg={pageBgCss}
            hfOverlay={{ headerBoxes: brand.headerBoxes, footerBoxes: brand.footerBoxes, headerHmm: brand.headerHmm, footerHmm: brand.footerHmm }}
            onSelect={selectBox}
            onGroupStart={onCanvasGroupStart} onGroupMove={onCanvasGroupMove}
            onChange={onCanvasChange} onCommit={onCanvasCommit} onEditStart={() => setTab("Inicio")} />
        ) : showAddPage ? (
          <div className="p-4">
            <div className="mx-auto max-w-[1100px] rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-800">➕ Nova pagina (avancado)</div>
                <button type="button" onClick={() => setShowAddPage(false)} className="text-xs text-slate-500 hover:text-slate-700">✕ Fechar</button>
              </div>
              <PageEditor inline editing={null} onClose={() => setShowAddPage(false)} onSubmit={(payload) => addPage(payload)} onUploadImage={uploadAsset} />
            </div>
          </div>
        ) : editingPage ? (
          <div className="p-4 overflow-auto">
            <div className="mx-auto max-w-[1100px] space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Pagina no formato antigo. Para editar livremente (estilo PowerPoint), <button onClick={convertToCanvas} className="font-semibold underline">converter pra canvas</button>. Ela continua aparecendo na impressao.</div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-slate-800">✎ Pagina {layout.pages.findIndex((p) => p.id === editingPage!.id) + 1} <span className="font-normal text-slate-500">— editor antigo</span></div>
                  <button type="button" onClick={() => setEditingPage(null)} className="text-xs text-slate-500 hover:text-slate-700">✕ Fechar</button>
                </div>
                <PageEditor inline key={editingPage.id} editing={editingPage} onClose={() => setEditingPage(null)} onSubmit={(payload) => updatePage(editingPage!.id, payload)} onUploadImage={uploadAsset} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Selecione uma pagina a esquerda (ou crie uma nova) para editar.</div>
        )}
      </div>
      {/* DIREITA: biblioteca de campos/blocos (a "biblia") — aba Campos, so em pagina canvas */}
      {editingPage && pageIsCanvas(editingPage) && tab === "Campos" ? (
        <ReportFieldLibrary
          sourceId={SOURCE_CATALOG_ID[layout.sourceType || "POOL_BUDGET"] || "orcamento_obras"}
          onInsertText={(token) => addBox("TEXT", { html: `<p>${token}</p>` })}
          onInsertBlock={(blockType) => addBox("BLOCK", { blockType })}
          onPickLine={(layout.sourceType || "POOL_BUDGET") === "POOL_BUDGET" ? () => { setLineSel(new Set()); setEtapaSel(new Set()); setPickLine(true); } : undefined}
          onClose={() => setTab("Inserir")} />
      ) : null}

      {pickLine && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPickLine(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Inserir campo de etapa/linha</h3>
            <p className="text-[11px] text-slate-500 mb-3">Escolha a linha pelo modelo de obra e o que inserir. Vira um codigo {"{linha:Lx.atributo}"} que resolve no orcamento real na hora de imprimir.</p>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Modelo de obra</label>
            <select value={layout.templateId || ""} onChange={(e) => setLayoutTemplate(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mb-3">
              <option value="">— Escolha um modelo —</option>
              {edTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (padrao)" : ""}</option>)}
            </select>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">O que inserir</label>
            <select value={lineAttr} onChange={(e) => setLineAttr(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mb-3">
              <option value="produto">Produto / descricao (da linha)</option>
              <option value="qtd">Quantidade</option>
              <option value="valor">Valor total</option>
              <option value="unitario">Preco unitario</option>
              <option value="papel">Item (papel)</option>
              <option value="etapa">Etapa</option>
              <optgroup label="Cadastro do produto">
                <option value="prodImagem">🖼️ Imagem do produto (cadastro)</option>
                <option value="prodCodigo">Codigo do produto</option>
                <option value="prodDescricao">Descricao do cadastro</option>
                <option value="prodUnidade">Unidade</option>
              </optgroup>
              <optgroup label="Etapa agrupada (banda por etapa)">
                <option value="etapaNome">🗂️ Nome da etapa (titulo)</option>
                <option value="etapaItens">📋 Lista de produtos da etapa</option>
                <option value="etapaImagem">🖼️ Imagem da etapa</option>
                <option value="etapaTotal">Total da etapa (R$)</option>
              </optgroup>
            </select>
            <button type="button"
              onClick={() => {
                if (lineAttr === "prodImagem") addBox("IMAGE", { url: `{linha:ATUAL.prodImagem}`, fit: "contain" });
                else if (lineAttr === "etapaImagem") addBox("IMAGE", { url: `{etapa:ATUAL.imagem}`, fit: "cover" });
                else if (lineAttr === "etapaItens") addBox("TEXT", { html: `<p>{etapa:ATUAL.itens}</p>` });
                else if (lineAttr === "etapaNome") addBox("TEXT", { html: `<p><b>{etapa:ATUAL.nome}</b></p>`, style: { fontSize: 13 } });
                else if (lineAttr === "etapaTotal") addBox("TEXT", { html: `<p>{etapa:ATUAL.total}</p>` });
                else if (lineAttr === "etapa") addBox("TEXT", { html: `<p>{etapa:ATUAL.nome}</p>` });
                else addBox("TEXT", { html: `<p>{linha:ATUAL.${lineAttr}}</p>` });
                setPickLine(false);
                toast("Campo ATUAL inserido (pro item da banda)", "success");
              }}
              className="w-full mb-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">
              🔁 Inserir como <b>ATUAL</b> ({isEtapaMode ? "etapa corrente da banda" : "item corrente da banda"}) — sem escolher {isEtapaMode ? "etapa" : "linha"}
            </button>
            {isEtapaMode ? (
              // NIVEL-ETAPA: escolhe a(s) ETAPA(S) (nao linhas), na ordem do modelo, com nome amigavel.
              <>
                <p className="text-[10px] text-slate-400 mb-1">— ou escolha uma etapa específica do modelo abaixo —</p>
                <div className="rounded-lg border-2 border-violet-300 bg-violet-50 p-3">
                  <div className="text-xs font-bold text-violet-900 mb-2">
                    🗂️ Escolha a(s) etapa(s){etapaSel.size > 0 && <span className="text-violet-700"> — {etapaSel.size} selecionada(s)</span>}
                  </div>
                  {tplSections.length === 0 ? (
                    <div className="text-[11px] text-amber-700 italic px-1 py-2">Nenhuma etapa neste modelo (escolha um modelo de obra com etapas).</div>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {tplSections.map((sec) => {
                        const checked = etapaSel.has(sec);
                        const count = tplLines.filter((l) => (l.poolSection || "OUTROS") === sec).length;
                        return (
                          <label key={sec}
                            className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer transition ${checked ? "bg-violet-100 border-violet-500" : "bg-white border-slate-200 hover:border-violet-400 hover:bg-violet-50"}`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => setEtapaSel((p) => { const n = new Set(p); if (n.has(sec)) n.delete(sec); else n.add(sec); return n; })}
                              className="h-3.5 w-3.5 accent-violet-600 shrink-0" />
                            <span className="flex-1 min-w-0 text-xs font-semibold text-slate-800 truncate uppercase" title={sectionLabelFor(sec)}>{sectionLabelFor(sec)}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">{count} linha{count > 1 ? "s" : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" disabled={etapaSel.size === 0}
                      onClick={() => {
                        const secs = Array.from(etapaSel);
                        addBoxes(secs.map((sec) => {
                          if (lineAttr === "etapaImagem") return { kind: "IMAGE" as const, extra: { url: `{etapa:${sec}.imagem}`, fit: "cover" as const } };
                          if (lineAttr === "etapaItens") return { kind: "TEXT" as const, extra: { html: `<p>{etapa:${sec}.itens}</p>` } };
                          if (lineAttr === "etapaNome") return { kind: "TEXT" as const, extra: { html: `<p><b>{etapa:${sec}.nome}</b></p>`, style: { fontSize: 13 } } };
                          if (lineAttr === "etapaTotal") return { kind: "TEXT" as const, extra: { html: `<p>{etapa:${sec}.total}</p>` } };
                          return { kind: "TEXT" as const, extra: { html: `<p>{etapa:${sec}.nome}</p>` } }; // "etapa"
                        }));
                        setPickLine(false);
                        if (secs.length) toast(`${secs.length} campo(s) de etapa inserido(s)`, "success");
                      }}
                      className="rounded bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1 text-xs font-semibold">
                      Aplicar {etapaSel.size > 0 && `(${etapaSel.size})`}
                    </button>
                    <button type="button" onClick={() => setPickLine(false)} className="text-[10px] text-violet-700 hover:text-violet-900 underline">Cancelar</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] text-slate-400 mb-1">— ou escolha uma linha específica do modelo abaixo —</p>
                <LineRefPicker
                  icon="📄" specKey={null} combine="sum" refKind="ALL"
                  lines={tplLines}
                  environmentParams={{ customSections: tplCustomSections }}
                  sectionOrder={tplSectionOrder}
                  selected={lineSel}
                  onToggle={(ref) => setLineSel((p) => { const n = new Set(p); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; })}
                  onApply={() => {
                    const refs = Array.from(lineSel);
                    // Imagem do cadastro -> caixa IMAGE com url = token; senão TEXT. addBoxes acumula (1 commit).
                    addBoxes(refs.map((ref) => lineAttr === "prodImagem"
                      ? { kind: "IMAGE" as const, extra: { url: `{linha:${ref}.prodImagem}`, fit: "contain" as const } }
                      : { kind: "TEXT" as const, extra: { html: `<p>{linha:${ref}.${lineAttr}}</p>` } }));
                    setPickLine(false);
                    if (refs.length) toast(`${refs.length} campo(s) de linha inserido(s)`, "success");
                  }}
                  onCancel={() => setPickLine(false)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {condModal && selectedBox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setCondModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">⚡ {condTarget.kind === "cand" ? `Exigências do candidato ${condTarget.i + 1}º` : "Condição de visibilidade"}</h3>
            <p className="text-[11px] text-slate-500 mb-3">{condTarget.kind === "cand" ? "Este candidato é usado quando TODAS/QUALQUER destas exigências baterem no orçamento." : "A caixa só aparece na impressão se as regras baterem no orçamento. No editor fica esmaecida com o selo ⚡ quando não bate."} Você pode juntar várias condições.</p>
            {/* Combinar (E/OU) — só faz sentido com 2+ regras */}
            {condDraft.rules.length > 1 ? (
              <div className="mb-2 flex items-center gap-2 text-[11px]">
                <span className="text-slate-600">Tem que bater:</span>
                <button type="button" onClick={() => setCondDraft((d) => ({ ...d, match: "all" }))}
                  className={`rounded px-2 py-0.5 ${condDraft.match !== "any" ? "bg-cyan-600 text-white font-semibold" : "bg-slate-100 text-slate-600"}`}>TODAS (E)</button>
                <button type="button" onClick={() => setCondDraft((d) => ({ ...d, match: "any" }))}
                  className={`rounded px-2 py-0.5 ${condDraft.match === "any" ? "bg-cyan-600 text-white font-semibold" : "bg-slate-100 text-slate-600"}`}>QUALQUER (OU)</button>
              </div>
            ) : null}
            <div className="space-y-2 max-h-[46vh] overflow-y-auto">
              {condDraft.rules.map((r, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {ruleCore(r, (p) => setCondRule(i, p))}
                    {condDraft.rules.length > 1 ? (
                      <button type="button" onClick={() => removeCondRule(i)} title="Remover esta condição" className="text-rose-500 hover:text-rose-700">🗑</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCondRule} className="mt-2 rounded-md border border-dashed border-cyan-300 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50">+ Adicionar condição</button>
            <p className="text-[10px] text-slate-400 mt-1">Escolha a ETAPA (escopo) — e, se quiser, uma LINHA dentro dela (filtrada). Sem etapa nem linha = olha o orçamento todo.</p>
            <div className="flex items-center justify-between mt-4">
              <button type="button" onClick={() => { if (condTarget.kind === "showIf") patchSelBox({ showIf: null }); else setCand(condTarget.i, { cond: null }); setCondModal(false); toast("Condição removida", "success"); }}
                className="text-[12px] text-rose-600 hover:underline">{condTarget.kind === "cand" ? "Sem exigência (sempre)" : "Limpar condição"}</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCondModal(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
                <button type="button" onClick={() => { saveCond(); toast("Condição aplicada", "success"); }}
                  className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor de CANDIDATOS (imagem/texto dinâmico) — linha-fonte + ⚡ Exigências (o MESMO modal) ── */}
      {candModal && selectedBox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setCandModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{candMode === "image" ? "🖼️ Imagem dinâmica" : "🔤 Texto dinâmico"} — candidatos</h3>
            <p className="text-[11px] text-slate-500 mb-3">{candMode === "image"
              ? <>O <b>1º candidato (de cima pra baixo)</b> cujas <b>exigências</b> batem (e a linha tem imagem) manda a imagem. Use ↑↓ pra ordenar a prioridade.</>
              : <>Você <b>digita o texto</b> de cada candidato e a <b>exigência</b> pra ele aparecer (ex: descrição contém "Pré-moldada" na etapa X linha Y). O <b>1º candidato (de cima pra baixo)</b> cujas exigências batem é o que aparece. Use ↑↓ pra ordenar a prioridade.</>}</p>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {candDraft.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] italic text-slate-400">Nenhum candidato ainda. Adicione o {candMode === "image" ? "1º (linha-imagem)" : "1º texto"}.</div>
              ) : candDraft.map((c, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {candMode === "text" ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5 w-4 shrink-0 text-[10px] font-bold text-fuchsia-700">{i + 1}º</span>
                        <textarea value={c.text ?? ""} onChange={(e) => setCand(i, { text: e.target.value })} rows={2} placeholder='Texto que vai aparecer quando as exigências baterem. Ex: "Piscina executada em parede pré-moldada."' className="flex-1 resize-y rounded border border-slate-300 px-2 py-1 text-sm" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-6">
                        <button type="button" onClick={() => openCondFor({ kind: "cand", i }, c.cond)} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-700 hover:bg-cyan-50">
                          <span className="text-sm leading-none">⚡</span><span className="text-[10px]">{condCount(c.cond) ? `Exigências (${condCount(c.cond)})` : "Definir exigências"}</span>
                        </button>
                        <span className="max-w-[220px] truncate text-[10px] italic text-slate-500" title={condText(c.cond)}>{condText(c.cond)}</span>
                        <span className="ml-auto flex items-center gap-0.5">
                          <button type="button" onClick={() => moveCand(i, -1)} disabled={i === 0} title="Subir prioridade" className="text-slate-500 hover:text-slate-800 disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => moveCand(i, 1)} disabled={i === candDraft.length - 1} title="Descer prioridade" className="text-slate-500 hover:text-slate-800 disabled:opacity-30">↓</button>
                          <button type="button" onClick={() => removeCand(i)} title="Remover candidato" className="text-rose-500 hover:text-rose-700">🗑</button>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-4 shrink-0 text-[10px] font-bold text-fuchsia-700">{i + 1}º</span>
                      {lineCore(c, (p) => setCand(i, p), "— Linha (imagem) —")}
                      <button type="button" onClick={() => openCondFor({ kind: "cand", i }, c.cond)}
                        className="flex min-w-[44px] flex-col items-center justify-center gap-0.5 rounded px-1.5 py-0.5 text-slate-700 hover:bg-cyan-50">
                        <span className="text-sm leading-none">⚡</span><span className="text-[9px] leading-tight text-center">{condCount(c.cond) ? `Exigências (${condCount(c.cond)})` : "Exigências"}</span>
                      </button>
                      <span className="max-w-[180px] self-center truncate text-[10px] italic text-slate-500" title={condText(c.cond)}>{condText(c.cond)}</span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <button type="button" onClick={() => moveCand(i, -1)} disabled={i === 0} title="Subir prioridade" className="text-slate-500 hover:text-slate-800 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => moveCand(i, 1)} disabled={i === candDraft.length - 1} title="Descer prioridade" className="text-slate-500 hover:text-slate-800 disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => removeCand(i)} title="Remover candidato" className="text-rose-500 hover:text-rose-700">🗑</button>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addCand} className="mt-2 rounded-md border border-dashed border-fuchsia-300 px-3 py-1.5 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-50">{candMode === "image" ? "+ Adicionar linha-candidata" : "+ Adicionar texto-candidato"}</button>
            <p className="text-[10px] text-slate-400 mt-1">{candMode === "image"
              ? "A imagem vem da LINHA escolhida em cada candidato. Sem exigências = sempre bate. Se bater mas a linha não tiver imagem, tenta o próximo."
              : "Sem exigências = sempre aparece (bom pro último, como texto padrão). Se o texto estiver vazio, tenta o próximo. Tokens como {linha:L5.produto} também funcionam dentro do texto."}</p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={() => setCandModal(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button type="button" onClick={() => { patchSelBox(candMode === "image" ? { imgRules: candDraft } : { txtRules: candDraft }); setCandModal(false); toast(candMode === "image" ? "Imagem dinâmica salva" : "Texto dinâmico salvo", "success"); }}
                className="rounded bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Configuração da LISTA DINÂMICA — fonte + colunas + estilo ── */}
      {listModal && selectedBox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setListModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-4 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">📋 Lista dinâmica</h3>
            <p className="text-[11px] text-slate-500 mb-3">Monta uma tabela com as linhas do orçamento (pula as vazias). Escolha a fonte, as colunas e o estilo.</p>
            {/* FONTE */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 mb-3">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Fonte das linhas</div>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <label className="flex items-center gap-1">Etapa
                  <select value={listDraft.etapa || ""} onChange={(e) => setListDraft((d) => ({ ...d, etapa: e.target.value || null }))} className="rounded border border-slate-300 px-2 py-1 text-sm min-w-[140px]">
                    <option value="">— Todas as etapas —</option>
                    {tplSections.map((s) => <option key={s} value={s}>{sectionLabelFor(s).toUpperCase()}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1">Tipo
                  <select value={listDraft.kind || ""} onChange={(e) => setListDraft((d) => ({ ...d, kind: (e.target.value || null) as any }))} className="rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="">Tudo</option><option value="PRODUCT">Produtos</option><option value="SERVICE">Serviços</option>
                  </select>
                </label>
                <label className="flex items-center gap-1">Máx. linhas<NumInput value={listDraft.maxRows ?? 0} placeholder="todas" onChange={(v) => setListDraft((d) => ({ ...d, maxRows: v || null }))} className="w-16 rounded border border-slate-300 px-1 py-1 text-sm" /></label>
                <label className="flex items-center gap-1" title="Pula linhas Sem Produto / vazias"><input type="checkbox" checked={listDraft.skipEmpty !== false} onChange={(e) => setListDraft((d) => ({ ...d, skipEmpty: e.target.checked }))} />Pular vazias</label>
              </div>
              {/* Linhas: TODAS ou específicas (respeita só as marcadas) */}
              <label className="flex items-center gap-1 text-xs mb-1"><input type="checkbox" checked={!listDraft.lines} onChange={(e) => setListDraft((d) => ({ ...d, lines: e.target.checked ? null : [] }))} /><b>Todas as linhas</b> da etapa/tipo</label>
              {listDraft.lines ? (() => {
                const src = tplLines.filter((l) => (!listDraft.etapa || l.poolSection === listDraft.etapa) && (!listDraft.kind || (l.kind || "PRODUCT") === listDraft.kind));
                return (
                  <div className="rounded border border-slate-200 bg-white p-1 max-h-36 overflow-y-auto text-xs">
                    {src.length === 0 ? <div className="px-1 py-2 italic text-slate-400">Nenhuma linha na etapa/tipo escolhidos.</div> : src.map((l) => {
                      const checked = (listDraft.lines || []).includes(l.cellRef);
                      return (
                        <label key={l.cellRef} className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => setListDraft((d) => ({ ...d, lines: checked ? (d.lines || []).filter((r) => r !== l.cellRef) : [...(d.lines || []), l.cellRef] }))} />
                          <span className="font-mono text-[10px] text-teal-700 w-9 shrink-0">{l.cellRef}</span>
                          <span className="truncate">{l.description || l.slotName || ""}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })() : null}
            </div>
            {/* COLUNAS — cada coluna é um CARD com os campos rotulados (vertical, mais intuitivo) */}
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Colunas <span className="font-normal text-slate-400">— fonte, tamanho e cor do texto vêm da barra <b>Início</b> (selecione a lista ou dê duplo-clique nela). Aqui ficam só estrutura, alinhamento e cor de fundo.</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {listDraft.columns.map((c, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-teal-700">Coluna {i + 1}</span>
                    <span className="flex items-center gap-1.5 text-sm">
                      <button type="button" onClick={() => moveListCol(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-slate-800 disabled:opacity-30" title="Mover ←">←</button>
                      <button type="button" onClick={() => moveListCol(i, 1)} disabled={i === listDraft.columns.length - 1} className="text-slate-500 hover:text-slate-800 disabled:opacity-30" title="Mover →">→</button>
                      <button type="button" onClick={() => removeListCol(i)} disabled={listDraft.columns.length <= 1} className="text-rose-500 hover:text-rose-700 disabled:opacity-30" title="Remover coluna">🗑</button>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                    <label className="col-span-2 flex flex-col gap-0.5 text-slate-600">Vem de
                      <select value={c.field.startsWith("prodspec:") ? "__spec__" : c.field} onChange={(e) => setListCol(i, { field: e.target.value === "__spec__" ? "prodspec:" : e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                        <optgroup label="Da linha do orçamento">
                          <option value="produto">Descrição</option>
                          <option value="qtd">Quantidade</option>
                          <option value="unidade">Unidade</option>
                          <option value="valor">Valor total</option>
                          <option value="unitario">Valor unitário</option>
                          <option value="papel">Item (papel)</option>
                        </optgroup>
                        <optgroup label="Do cadastro do produto">
                          <option value="prodCodigo">Código</option>
                          <option value="prodDescricao">Descrição do cadastro</option>
                        </optgroup>
                        <optgroup label="Especificação técnica">
                          <option value="__spec__">Especificação (chave)…</option>
                        </optgroup>
                      </select>
                    </label>
                    {c.field.startsWith("prodspec:") ? (
                      <label className="col-span-2 flex flex-col gap-0.5 text-slate-600">Chave da especificação
                        <input type="text" value={c.field.slice("prodspec:".length)} onChange={(e) => setListCol(i, { field: `prodspec:${e.target.value}` })} placeholder="ex: vazaoM3h" className="rounded border border-amber-300 px-2 py-1 text-sm" />
                      </label>
                    ) : null}
                    <label className="col-span-2 flex flex-col gap-0.5 text-slate-600">Cabeçalho
                      <input type="text" value={c.header ?? ""} placeholder={`padrão: ${LIST_FIELD_LABEL[c.field] || c.field}`} onChange={(e) => setListCol(i, { header: e.target.value || null })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                    </label>
                    <label className="flex flex-col gap-0.5 text-slate-600">Largura (mm)
                      <NumInput value={c.widthMm ?? 0} placeholder="auto" onChange={(v) => setListCol(i, { widthMm: v || null, widthPct: null })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                    </label>
                    <label className="flex flex-col gap-0.5 text-slate-600">Alinhar
                      <select value={c.align || "left"} onChange={(e) => setListCol(i, { align: e.target.value as any })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                        <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                      </select>
                    </label>
                    <div className="flex items-end gap-3">
                      <label className="flex flex-col gap-0.5 text-slate-600">Fundo
                        <span className="flex items-center gap-1"><input type="color" value={c.bg || "#ffffff"} onChange={(e) => setListCol(i, { bg: e.target.value })} className="h-6 w-7 cursor-pointer rounded border border-slate-300 p-0" /><button type="button" onClick={() => setListCol(i, { bg: null })} title="Sem fundo" className="text-slate-400 hover:text-slate-700">⌫</button></span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addListCol} className="mt-2 rounded-md border border-dashed border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50">+ Adicionar coluna</button>
            {/* ESTILO DA TABELA */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 mt-3">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Estilo da tabela</div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={listDraft.showHeader !== false} onChange={(e) => setListDraft((d) => ({ ...d, showHeader: e.target.checked }))} />Cabeçalho</label>
                <label className="flex items-center gap-1">Fundo cab.<input type="color" value={listDraft.headerBg || "#1e3a8a"} onChange={(e) => setListDraft((d) => ({ ...d, headerBg: e.target.value }))} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
                <label className="flex items-center gap-1">Cor cab.<input type="color" value={listDraft.headerColor || "#ffffff"} onChange={(e) => setListDraft((d) => ({ ...d, headerColor: e.target.value }))} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
                <label className="flex items-center gap-1" title="Altura da linha (mm)">Altura linha<NumInput value={listDraft.rowHeightMm ?? 0} placeholder="auto" onChange={(v) => setListDraft((d) => ({ ...d, rowHeightMm: v || null }))} className="w-14 rounded border border-slate-300 px-1 py-1 text-sm" />mm</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!listDraft.zebra} onChange={(e) => setListDraft((d) => ({ ...d, zebra: e.target.checked }))} />Linhas alternadas</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!listDraft.border} onChange={(e) => setListDraft((d) => ({ ...d, border: e.target.checked }))} />Bordas</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={() => setListModal(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button type="button" onClick={() => { patchSelBox({ listCfg: listDraft }); setListModal(false); toast("Lista dinâmica salva", "success"); }}
                className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {bandModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setBandModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">🔁 Banda repetidora</h3>
            <p className="text-[11px] text-slate-500 mb-3">As caixa(s) selecionada(s) viram uma <b>linha-modelo</b> que se repete por item do orçamento na impressão (e quebra de página vem na próxima fase). No conteúdo, use o token <code className="bg-slate-100 px-1 rounded">ATUAL</code> pro item corrente: <code className="bg-slate-100 px-1 rounded">{"{linha:ATUAL.produto}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{linha:ATUAL.prodImagem}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{etapa:ATUAL.nome}"}</code>.</p>
            <p className="text-[11px] text-slate-600 mb-2">{(selSet.size || (selBox ? 1 : 0))} caixa(s) selecionada(s). Repetir por:</p>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => makeBand("linhas")} className="flex-1 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-3 text-sm font-medium text-cyan-800 hover:bg-cyan-100">📄 Por linha<br /><span className="text-[10px] font-normal text-slate-500">1 cópia por produto (L1, L3…)</span></button>
              <button type="button" onClick={() => makeBand("etapas")} className="flex-1 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-3 text-sm font-medium text-cyan-800 hover:bg-cyan-100">🗂️ Por etapa<br /><span className="text-[10px] font-normal text-slate-500">1 cópia por etapa (Cascata…)</span></button>
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={clearBand} className="text-[12px] text-rose-600 hover:underline">Remover banda</button>
              <button type="button" onClick={() => setBandModal(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {iconPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setIconPicker(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Inserir ícone</h3>
            <p className="text-[11px] text-slate-500 mb-3">Clique num ícone pra inserir na folha. Depois ajuste a cor (aba Início) e o tamanho (aba Layout).</p>
            <div className="grid grid-cols-6 gap-2 max-h-72 overflow-y-auto">
              {REPORT_ICONS.map((ic) => (
                <button key={ic.name} type="button" title={ic.label}
                  onClick={() => { addBox("ICON", { icon: ic.name }); setIconPicker(false); }}
                  className="flex flex-col items-center gap-1 rounded border border-slate-200 p-2 hover:border-cyan-400 hover:bg-cyan-50">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={ic.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ic.svg }} />
                  <span className="text-[8px] text-slate-500 truncate w-full text-center">{ic.label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <button type="button" onClick={() => setIconPicker(false)} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {reportIssues.length > 0 && (
        <div className="fixed bottom-3 right-3 z-40 w-72 max-h-64 overflow-y-auto rounded-lg border border-amber-300 bg-white shadow-lg">
          <div className="flex items-center gap-1 border-b border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
            ⚠ {reportIssues.length} aviso(s) no layout
          </div>
          <ul className="space-y-1 p-1.5">
            {reportIssues.slice(0, 25).map((it, i) => (
              <li key={i} className="leading-tight">
                <span className={(it.severity === "error" ? "text-red-600" : "text-amber-700") + " font-mono text-[10px]"}>{it.token}</span>
                <span className="text-[10px] text-slate-400"> · {it.page}</span>
                <div className="text-[10px] text-slate-600">{it.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* OCULTO: render completo (#budget-pdf-area) p/ impressao — reflete os boxes ao vivo */}
      <div aria-hidden style={{ position: "absolute", left: -99999, top: 0 }}>
        <BudgetReport data={previewData} layout={{ branding: layout.branding, pages: layout.pages.map((p) => editingPage && p.id === editingPage.id && pageIsCanvas(editingPage) ? { ...p, type: "FIXED", pageConfig: { ...((p.pageConfig as any) || {}), canvas: true, unit: "mm", boxes, bg: pageBgCfg.bg ?? null, bgType: pageBgCfg.bgType || "solid", bgColor2: pageBgCfg.bgColor2 ?? null, name: pageName || null, noHeader: pageNoHeader || undefined, noFooter: pageNoFooter || undefined } } : p) }} />
      </div>

      </div>{/* fim 3 paineis */}

      {/* Modal de confirmacao de remocao (substitui window.confirm nativo) */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLinkModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-slate-900">Inserir link</div>
            <p className="mt-1 text-xs text-slate-500">A URL fica atrás (clicável no PDF). Na frente aparece só o texto.</p>
            <label className="mt-3 block text-xs font-medium text-slate-600">URL / número / @perfil (atrás)
              <input autoFocus value={linkModal.url} onChange={(e) => setLinkModal({ ...linkModal, url: e.target.value })}
                placeholder="https://… , 5566999861230 ou @julianotriaca"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Texto visível (frente)
              <input value={linkModal.text} onChange={(e) => setLinkModal({ ...linkModal, text: e.target.value })}
                placeholder="(66) 99986-1230 , @julianotriaca , Fale no WhatsApp"
                onKeyDown={(e) => { if (e.key === "Enter" && linkModal.url.trim()) { const t = (linkModal.text.trim() || linkModal.url.trim()).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); addBox("TEXT", { html: `<p style="text-align:center">${t}</p>`, href: linkModal.url.trim(), style: { fontSize: 12, textColor: "#1d4ed8" } }); setLinkModal(null); } }}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setLinkModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" disabled={!linkModal.url.trim()}
                onClick={() => { const t = (linkModal.text.trim() || linkModal.url.trim()).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); addBox("TEXT", { html: `<p style="text-align:center">${t}</p>`, href: linkModal.url.trim(), style: { fontSize: 12, textColor: "#1d4ed8" } }); setLinkModal(null); }}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed">Inserir</button>
            </div>
          </div>
        </div>
      )}
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
                  <NumInput value={pcGet("columns", 3)} onChange={(v) => pcSet("columns", Math.max(1, Math.min(6, v || 3)))}
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
