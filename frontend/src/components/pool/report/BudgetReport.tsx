"use client";

/**
 * BudgetReport — RENDERIZADOR do EngineReporter (a peca que faltava).
 *
 * Recebe (budget + layout.pages) e monta o A4 imprimivel em #budget-pdf-area.
 * Pra cada pagina, em ordem: avalia a CONDICAO (conditionRule), e:
 *   - FIXED   -> resolve os {placeholders} do htmlContent
 *   - DYNAMIC -> chama o bloco correspondente ao dynamicType (registry abaixo)
 *
 * Trilhos do sistema (REGRA #9): reusa o modelo PoolPrintLayout/PoolPrintPage
 * (mesmos tipos do editor pool/print-layouts), o enum dynamicType, e o padrao
 * de impressao printViaClone + CSS da bíblia (memory/sistema_impressao_pdf_simulador.md).
 *
 * O parent (sandbox /dev/print-test-orcamento ou o modal do orcamento) imprime com
 *   printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BombaDatasheetBlock, SolarDatasheetBlock } from "./HeatingDatasheets";
import { getReportIcon } from "./reportIcons";

// ── Tipos (espelham Page/Layout do editor) ──────────────────────────────────
export type ReportPage = {
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

export type ReportBranding = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  footerHtml?: string | null;
  // v1.14.15 — estilo global do relatorio (aplicado a todas as paginas):
  fontSizePt?: number | null;   // tamanho base da fonte (pt)
  textColor?: string | null;    // cor do texto
  bgColor?: string | null;      // cor de fundo da pagina
  bgType?: string | null;       // "solid" | "gradient"
  bgColor2?: string | null;     // 2a cor do gradiente
  orientation?: string | null;  // "portrait" | "landscape"
  pageMarginMm?: number | null; // margem interna da pagina (mm), default 12
  headerHtml?: string | null;   // cabecalho (HTML com {placeholders}), em toda pagina
  // Logo — CAPA, CABECALHO e RODAPE sao INDEPENDENTES (cada um com on/off, tamanho e lado):
  logoSizeCover?: number | null;   // altura da logo na CAPA (default 64)
  logoAlign?: string | null;       // posicao da logo na CAPA: left|center|right (default right)
  headerLogo?: boolean | null;     // mostrar logo no CABECALHO (default true)
  logoSizeHeader?: number | null;  // altura da logo no CABECALHO (default 34)
  headerLogoSide?: string | null;  // lado da logo no cabecalho: left|right (default right)
  headerOnCover?: boolean | null;  // mostrar o cabecalho tambem na CAPA (default false)
  logoFooter?: boolean | null;     // mostrar logo no RODAPE (default false)
  logoSizeFooter?: number | null;  // altura da logo no RODAPE (default 28)
  footerLogoSide?: string | null;  // lado da logo no rodape: left|right (default right)
  footerOnCover?: boolean | null;  // mostrar o rodape tambem na CAPA (default false)
};

// alinhamento (left/center/right) -> flexbox
function logoFlexAlign(a?: string | null): "flex-start" | "center" | "flex-end" {
  return a === "left" ? "flex-start" : a === "center" ? "center" : "flex-end";
}

export type ReportLayout = {
  id?: string;
  name?: string;
  branding?: ReportBranding | null;
  pages: ReportPage[];
};

// Composicao por cards (v1.14.16): uma pagina pode ter pageConfig.nodes = ReportNode[]
// (arvore aninhavel). card/row = container; block = conteudo (texto/imagem/bloco dinamico).
export type ReportNode = {
  id: string;
  kind: "card" | "row" | "block";
  style?: {
    bg?: string | null; borderColor?: string | null; borderWidth?: number | null;
    radius?: number | null; padding?: number | null; gap?: number | null;
    align?: string | null; flex?: number | null; shadow?: boolean | null; textColor?: string | null;
    // posicionamento (tudo editavel — nada fixo):
    width?: string | null;        // largura do card (ex: "60%", "100%", "120mm")
    selfAlign?: string | null;    // posicao do card na pagina: left | center | right
    marginTop?: number | null;    // espaco acima (px)
    marginBottom?: number | null; // espaco abaixo (px)
    justify?: string | null;      // row: distribuicao das colunas (start|center|end|between)
    textAlign?: string | null;    // alinhamento do texto dentro do no (left|center|right|justify)
    fontSize?: number | null;     // tamanho do texto do bloco/card inteiro (pt) — aplica em tudo dentro
    height?: number | null;       // altura do card (px) — permite imagem preencher 100%
    widthPx?: number | null;      // largura EXATA do card (px) — sobrepoe width (%)
    wrap?: boolean | null;        // row: quebrar colunas em telas pequenas (flex-wrap)
    bleed?: boolean | null;       // card: sangria (cancela padding da pagina, fundo ate as bordas) — capa
  } | null;
  children?: ReportNode[];        // card / row
  blockType?: string | null;      // block: TEXT | IMAGE | COVER | PRODUCTS_BY_SECTION | BUDGET_SUMMARY | ...
  config?: any;                   // config do bloco (html, url, opcoes)
};

export type ReportItem = {
  poolSection: string;
  kind?: string | null;
  description: string;
  slotName?: string | null;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  imageUrl?: string | null; // produto/servico vinculado (vem do findOne) — usado em {linha:Lx.prodImagem}
  cellRef?: string | null;  // endereco estavel da linha (L1, L2, L130) — usado em {linha:Lx.campo}
  // Campos do CADASTRO do produto/servico vinculado (Fase 1a blocos dinamicos) — {linha:Lx.prodCodigo|prodDescricao|prodUnidade|prodSpec:<key>}
  productCode?: string | null;
  productDesc?: string | null;       // descricao/nome do cadastro (pode diferir da descricao da linha)
  productUnit?: string | null;
  productSpecs?: Record<string, any> | null; // technicalSpecs (Json livre)
  hasProduct?: boolean;              // tem produto/servico vinculado (pra condicao "tem produto")
};

export type BudgetReportData = {
  code: string;
  title?: string | null;
  clientName?: string | null;
  clientTradeName?: string | null;
  clientDocument?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  clientNeighborhood?: string | null;
  clientCity?: string | null;
  clientState?: string | null;
  clientZip?: string | null;
  company?: {
    name?: string | null; tradeName?: string | null; cnpj?: string | null; ie?: string | null;
    phone?: string | null; email?: string | null; address?: string | null; city?: string | null; ownerName?: string | null;
  } | null;
  budgetDate?: string | null;
  dimensions?: {
    length?: number; width?: number; depth?: number;
    area?: number; volume?: number; perimeter?: number;
    maxDepth?: number; comprimentoTotal?: number; larguraTotal?: number;
    cantos?: number; perimetroExternoBorda?: number; perimetroParedesInternas?: number;
    areaParedeEFundo?: number; areaParedeM2?: number;
    radierM2?: number; radierM3?: number; escavacaoM3?: number;
  } | null;
  subtotalCents?: number;
  discountCents?: number;
  taxesCents?: number;
  discountPercent?: number | null;
  totalCents: number;
  termsConditions?: string | null;
  equipmentWarranty?: string | null;
  workWarranty?: string | null;
  paymentTerms?: string | null;
  installments?: { label: string; dueLabel?: string | null; valueCents: number }[];
  validityDays?: number | null;
  items: ReportItem[];
  /** ordem das etapas (PoolBudget.sectionOrder) */
  sectionOrder?: string[];
  /** mapa chave-da-etapa -> rotulo exibido (SECTION_LABEL + customSections) */
  sectionLabels?: Record<string, string>;
  /** report cacheado da Bomba de Calor (PoolBudget.heatingReport) — datasheet */
  heatingReport?: any;
  /** report cacheado do Solar (environmentParams.solarReport) — datasheet */
  solarReport?: any;
  /** params do ambiente (config do aquecimento) — datasheet */
  environmentParams?: any;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const brl = (cents: number) =>
  `R$ ${((cents || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (v: number | undefined | null, casas = 2, min = 0) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: Math.max(casas, min) });
// Medida fisica (comprimento/area/volume): sempre 2 casas pra nao sair "7" pelado (vira "7,00").
const dim = (v: number | undefined | null) => num(v, 2, 2);

/** Itens com qty>0 (o "tem produto e qtd>0" = entra no relatorio). */
function activeItems(items: ReportItem[]): ReportItem[] {
  return (items || []).filter((it) => Number(it.qty) > 0 && it.description && it.description !== "Sem Produto" && it.description !== "Sem Servico");
}

/** Agrupa itens ATIVOS por etapa, na ordem do sectionOrder (resto no fim). */
function groupBySection(data: BudgetReportData): { key: string; label: string; items: ReportItem[] }[] {
  const order = data.sectionOrder && data.sectionOrder.length ? data.sectionOrder : null;
  const byKey = new Map<string, ReportItem[]>();
  for (const it of activeItems(data.items)) {
    if (!byKey.has(it.poolSection)) byKey.set(it.poolSection, []);
    byKey.get(it.poolSection)!.push(it);
  }
  const keys = Array.from(byKey.keys());
  keys.sort((a, b) => {
    const ia = order ? order.indexOf(a) : -1;
    const ib = order ? order.indexOf(b) : -1;
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return keys.map((k) => ({
    key: k,
    label: (data.sectionLabels && data.sectionLabels[k]) || k,
    items: byKey.get(k)!,
  }));
}

/** Avalia a condicao da pagina. v0: conditionRule = { requires: [etapaKeys] } -> todas precisam ter item ativo. */
function pageShows(page: ReportPage, data: BudgetReportData): boolean {
  if (!page.isActive) return false;
  if (!page.isConditional || !page.conditionRule) return true;
  const requires: string[] = Array.isArray(page.conditionRule.requires) ? page.conditionRule.requires : [];
  if (!requires.length) return true;
  const presentes = new Set(activeItems(data.items).map((it) => it.poolSection));
  return requires.every((r) => presentes.has(r));
}

/** Avalia a condicao de visibilidade da CAIXA (Fase 1b blocos dinamicos). Sem showIf => sempre mostra.
 *  Alvo = linha (cellRef) OU etapa (poolSection) OU todas. op = presenca de produto / comparacao de qtd. */
export function boxShows(box: Box, data: BudgetReportData): boolean {
  const c = box.showIf;
  if (!c || !c.op) return true;
  const items = data.items || [];
  let targets: ReportItem[];
  if (c.cellRef) targets = items.filter((x) => (x.cellRef || "").toUpperCase() === (c.cellRef || "").toUpperCase());
  else if (c.etapa) targets = items.filter((x) => (x.poolSection || "").toUpperCase() === (c.etapa || "").toUpperCase());
  else targets = items;
  const hasProd = targets.some((t) => t.hasProduct || (t.qty || 0) > 0);
  const qty = targets.reduce((s, t) => s + (t.qty || 0), 0);
  const v = c.value ?? 0;
  switch (c.op) {
    case "hasProduct": return hasProd;
    case "noProduct": return !hasProd;
    case "qtyGt": return qty > v;
    case "qtyGte": return qty >= v;
    case "qtyEq": return qty === v;
    case "qtyLte": return qty <= v;
    case "qtyLt": return qty < v;
    default: return true;
  }
}

/** Resumo legivel da condicao (selo/tooltip no editor). */
function condSummary(c?: Box["showIf"]): string {
  if (!c) return "";
  const alvo = c.cellRef ? `linha ${c.cellRef}` : c.etapa ? `etapa ${c.etapa}` : "qualquer linha";
  const v = c.value ?? 0;
  const ops: Record<string, string> = { hasProduct: "tem produto", noProduct: "sem produto", qtyGt: `qtd > ${v}`, qtyGte: `qtd ≥ ${v}`, qtyEq: `qtd = ${v}`, qtyLte: `qtd ≤ ${v}`, qtyLt: `qtd < ${v}` };
  return `Mostrar só se ${alvo}: ${ops[c.op] || c.op}`;
}

/** Coleção sobre a qual a banda repete: lista de REFs (cellRef das linhas OU codigos de etapa). */
function bandCollection(source: "linhas" | "etapas", data: BudgetReportData): string[] {
  const items = activeItems(data.items || []);
  if (source === "linhas") return items.filter((it) => it.cellRef).map((it) => (it.cellRef || "").toUpperCase());
  const seen = new Set<string>(); const out: string[] = [];
  for (const it of items) { const s = (it.poolSection || "").toUpperCase(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } }
  return out;
}

/** Substitui o ref ATUAL no conteudo de uma caixa da banda pelo ref do item corrente. */
function applyBandRef(s: string | undefined, ref: string): string | undefined {
  return s ? s.replace(/ATUAL/g, ref) : s;
}

/** Expande as BANDAS (Fase 2) para IMPRESSAO: cada banda vira N copias (1 por item da colecao),
 *  empilhadas em Y (offset = i * altura da banda), com ATUAL trocado pelo ref do item. */
function expandBandsForPrint(boxes: Box[], data: BudgetReportData): Box[] {
  const bandMap = new Map<string, Box[]>();
  const normal: Box[] = [];
  for (const b of boxes) {
    if (b.band?.id) { const arr = bandMap.get(b.band.id) || []; arr.push(b); bandMap.set(b.band.id, arr); }
    else normal.push(b);
  }
  const out: Box[] = [...normal];
  for (const bboxes of bandMap.values()) {
    const source = bboxes[0].band!.source;
    const top = Math.min(...bboxes.map((b) => b.y));
    const height = Math.max(...bboxes.map((b) => b.y + b.h)) - top;
    const refs = bandCollection(source, data);
    refs.forEach((ref, i) => {
      for (const b of bboxes) {
        out.push({ ...b, id: `${b.id}__b${i}`, y: b.y + i * height, band: null,
          html: applyBandRef(b.html, ref), url: applyBandRef(b.url, ref) });
      }
    });
  }
  return out;
}

/** Rotulo da etapa (poolSection) — usa sectionLabels do orcamento, senao o proprio codigo. */
function sectionLabel(data: BudgetReportData, section: string): string {
  const labels = (data.sectionLabels || {}) as Record<string, string>;
  return labels[section] || labels[(section || "").toUpperCase()] || section || "";
}

/** Resolve tokens ENDERECADOS de etapa/linha:
 *   {linha:L130.produto|descricao|qtd|valor|unitario|papel|etapa}
 *   {etapa:CASCATA.total|linhas|nome}
 *  Retorna string ja formatada, "" se o alvo nao existe, ou null se nao casa (deixa o token cru). */
function resolveAddressedToken(token: string, data: BudgetReportData): string | null {
  const inner = token.slice(1, -1); // tira { }
  const items = data.items || [];
  let m = inner.match(/^linha:([A-Za-z]?\d+)\.([a-zA-Z]+(?::[\w.-]+)?)$/);
  if (m) {
    const ref = m[1].toUpperCase();
    const raw = m[2];
    const field = raw.toLowerCase();
    const it = items.find((x) => (x.cellRef || "").toUpperCase() === ref);
    if (!it) return "";
    // Campo do cadastro do produto: {linha:Lx.prodSpec:vazaoM3h} — chave preserva o case original
    if (field.startsWith("prodspec:")) {
      const key = raw.slice(raw.indexOf(":") + 1);
      const specs = (it.productSpecs || {}) as Record<string, any>;
      const v = specs[key];
      return v == null ? "" : (typeof v === "number" ? num(v) : String(v));
    }
    switch (field) {
      case "produto": case "descricao": case "item": case "nome": return it.description || "";
      case "qtd": case "quantidade": case "qty": return num(it.qty);
      case "valor": case "total": return brl(it.totalCents);
      case "unitario": case "preco": case "unit": return brl(it.unitPriceCents);
      case "papel": case "slot": return it.slotName || "";
      case "etapa": case "secao": return sectionLabel(data, it.poolSection);
      // ── Campos do CADASTRO do produto/servico vinculado (Fase 1a) ──
      case "prodimagem": case "prodimg": case "imagem": return it.imageUrl || "";
      case "prodcodigo": case "codigo": return it.productCode || "";
      case "proddescricao": case "proddesc": return it.productDesc || "";
      case "produnidade": case "produnit": case "unidade": return it.productUnit || "";
      default: return "";
    }
  }
  m = inner.match(/^etapa:([A-Za-z0-9_-]+)\.([a-zA-Z]+)$/);
  if (m) {
    const sec = m[1].toUpperCase();
    const field = m[2].toLowerCase();
    const list = items.filter((x) => (x.poolSection || "").toUpperCase() === sec);
    switch (field) {
      case "total": case "valor": return brl(list.reduce((s, x) => s + (x.totalCents || 0), 0));
      case "linhas": case "qtd": case "count": return String(list.length);
      case "nome": case "rotulo": case "etapa": return sectionLabel(data, sec);
      default: return "";
    }
  }
  return null;
}

/** Contexto de campos (ja FORMATADO) p/ o resolver generico por path: budget.* / client.* /
 *  company.* / budget.pool.*. SO expoe o que ja esta no relatorio (seguro — nada do banco cru). */
function buildFieldContext(data: BudgetReportData): Record<string, any> {
  const d = data.dimensions || {};
  return {
    budget: {
      code: data.code || "", title: data.title || "", date: data.budgetDate || "",
      total: brl(data.totalCents), subtotal: brl(data.subtotalCents),
      discount: brl(data.discountCents), taxes: brl(data.taxesCents),
      validityDays: String(data.validityDays ?? ""), paymentTerms: data.paymentTerms || "",
      termsConditions: data.termsConditions || "", equipmentWarranty: data.equipmentWarranty || "",
      workWarranty: data.workWarranty || "",
      pool: {
        length: dim(d.length), width: dim(d.width), depth: dim(d.depth), maxDepth: dim(d.maxDepth),
        area: dim(d.area), volume: dim(d.volume), perimeter: dim(d.perimeter),
        lengthTotal: dim(d.comprimentoTotal), widthTotal: dim(d.larguraTotal), corners: dim(d.cantos),
        perimeterExt: dim(d.perimetroExternoBorda), wallPerimeter: dim(d.perimetroParedesInternas),
        wallFloorArea: dim(d.areaParedeEFundo), wallArea: dim(d.areaParedeM2),
        radierArea: dim(d.radierM2), radierVolume: dim(d.radierM3), excavation: dim(d.escavacaoM3),
      },
    },
    client: {
      name: data.clientName || "", tradeName: data.clientTradeName || "", document: data.clientDocument || "",
      phone: data.clientPhone || "", email: data.clientEmail || "", address: data.clientAddress || "",
      neighborhood: data.clientNeighborhood || "", city: data.clientCity || "",
      state: data.clientState || "", zip: data.clientZip || "",
    },
    company: {
      name: data.company?.name || "", tradeName: data.company?.tradeName || "", cnpj: data.company?.cnpj || "",
      ie: data.company?.ie || "", phone: data.company?.phone || "", email: data.company?.email || "",
      address: data.company?.address || "", city: data.company?.city || "", ownerName: data.company?.ownerName || "",
    },
  };
}

/** Resolve token por PATH pontilhado ({budget.pool.area}, {client.city}). Anda no contexto;
 *  retorna a string formatada, ou null se nao for path valido (deixa o token cru). */
function resolveContextPath(token: string, data: BudgetReportData): string | null {
  const inner = token.slice(1, -1);
  if (!inner.includes(".") || inner.includes(":")) return null; // so paths a.b.c (nao linha:/etapa:)
  let cur: any = buildFieldContext(data);
  for (const part of inner.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = cur[part];
    else return null;
  }
  return (cur == null || typeof cur === "object") ? null : String(cur);
}

/** Resolve {placeholders} (mesmas chaves do editor pool/print-layouts) + tokens enderecados + paths. */
function resolvePlaceholders(html: string, data: BudgetReportData): string {
  const d = data.dimensions || {};
  const map: Record<string, string> = {
    "{clientName}": data.clientName || "",
    "{clientTradeName}": data.clientTradeName || "",
    "{clientDocument}": data.clientDocument || "",
    "{clientPhone}": data.clientPhone || "",
    "{clientEmail}": data.clientEmail || "",
    "{clientAddress}": data.clientAddress || "",
    "{clientNeighborhood}": data.clientNeighborhood || "",
    "{clientCity}": data.clientCity || "",
    "{clientState}": data.clientState || "",
    "{clientZip}": data.clientZip || "",
    "{companyName}": data.company?.name || "",
    "{companyTradeName}": data.company?.tradeName || "",
    "{companyCnpj}": data.company?.cnpj || "",
    "{companyIe}": data.company?.ie || "",
    "{companyPhone}": data.company?.phone || "",
    "{companyEmail}": data.company?.email || "",
    "{companyAddress}": data.company?.address || "",
    "{companyCity}": data.company?.city || "",
    "{companyOwnerName}": data.company?.ownerName || "",
    "{budgetCode}": data.code || "",
    "{budgetDate}": data.budgetDate || new Date().toLocaleDateString("pt-BR"),
    "{budgetTitle}": data.title || "",
    "{budgetTotal}": brl(data.totalCents),
    "{budgetSubtotal}": brl(data.subtotalCents),
    "{budgetDiscount}": brl(data.discountCents),
    "{budgetTaxes}": brl(data.taxesCents),
    "{paymentTerms}": data.paymentTerms || "",
    "{termsConditions}": data.termsConditions || "",
    "{equipmentWarranty}": data.equipmentWarranty || "",
    "{workWarranty}": data.workWarranty || "",
    "{poolLength}": dim(d.length),
    "{poolWidth}": dim(d.width),
    "{poolDepth}": dim(d.depth),
    "{poolArea}": dim(d.area),
    "{poolVolume}": dim(d.volume),
    "{poolPerimeter}": dim(d.perimeter),
    "{poolMaxDepth}": dim(d.maxDepth),
    "{poolLengthTotal}": dim(d.comprimentoTotal),
    "{poolWidthTotal}": dim(d.larguraTotal),
    "{poolCorners}": dim(d.cantos),
    "{poolPerimeterExt}": dim(d.perimetroExternoBorda),
    "{poolWallPerimeter}": dim(d.perimetroParedesInternas),
    "{poolWallFloorArea}": dim(d.areaParedeEFundo),
    "{poolWallArea}": dim(d.areaParedeM2),
    "{poolRadierArea}": dim(d.radierM2),
    "{poolRadierVolume}": dim(d.radierM3),
    "{poolExcavation}": dim(d.escavacaoM3),
    "{validityDays}": String(data.validityDays ?? ""),
    "{solicitante}": (data.environmentParams as any)?.solicitante || data.clientName || "",
    "{climateCity}": (data.environmentParams as any)?.cidade || "",
    "{climateState}": (data.environmentParams as any)?.regiaoSolar || "",
    "{date}": new Date().toLocaleDateString("pt-BR"),
  };
  return html.replace(/\{[a-zA-Z][\w.:-]*\}/g, (m) => {
    if (m in map) return map[m];
    const addressed = resolveAddressedToken(m, data);
    if (addressed != null) return addressed;
    const path = resolveContextPath(m, data);
    if (path != null) return path;
    return m; // token desconhecido: deixa cru (nao quebra o texto)
  });
}

// ── Blocos ───────────────────────────────────────────────────────────────────
// Capa comercial (estilo "Proposta Comercial"): logo topo-direita, titulo grande,
// bloco do cliente (Nome/Cidade/Data/Solicitante/Orcamento) e validade no rodape.
// Auto-preenche por orcamento. Titulo configuravel via config.title.
function CoverBlock({ data, branding, config }: { data: BudgetReportData; branding?: ReportBranding | null; config?: any }) {
  // Capa fiel ao PDF SLS: pagina inteira em CINZA (full-bleed via margem negativa que cancela o
  // padding do .report-page), logo topo-direita, titulo grande preto, bloco do cliente embaixo-
  // esquerda (labels em negrito) e rodape de validade centralizado. `coverBg` configuravel
  // (default cinza SLS) — friction: nao da pra dar fundo so na capa pela tela (bg global e geral).
  const title = config?.title || "Proposta Comercial";
  const bg = config?.coverBg || "#8c8c8c";               // cinza do PDF (configuravel via pageConfig)
  const titleColor = config?.titleColor || "#111827";    // titulo preto
  const dateStr = data.budgetDate || new Date().toLocaleDateString("pt-BR");
  const days = data.validityDays ?? 7;
  const rows: [string, string][] = [
    ["Nome", data.clientName || "—"],
    ["Cidade", data.clientCity || "—"],
    ["Data", dateStr],
    ["Solicitante", data.clientName || "—"],
    ["Orcamento no", data.code || "—"],
  ];
  return (
    <div style={{
      margin: "-12mm", padding: "16mm 16mm 10mm", background: bg, minHeight: "273mm",
      display: "flex", flexDirection: "column", boxSizing: "border-box",
      WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
    }}>
      {/* logo (posicao/tamanho configuraveis; default topo-direita 64px) */}
      <div style={{ display: "flex", justifyContent: logoFlexAlign(branding?.logoAlign), minHeight: branding?.logoSizeCover || 64 }}>
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="logo" style={{ height: branding?.logoSizeCover || 64, objectFit: "contain" }} />
        ) : null}
      </div>
      {/* espacador acima do titulo (posiciona ~40% como no modelo) */}
      <div style={{ flex: 1 }} />
      {/* titulo grande */}
      <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.08, color: titleColor, maxWidth: "62%" }}>{title}</div>
      {/* espacador maior empurra o bloco do cliente pra ~73% */}
      <div style={{ flex: 1.4 }} />
      {/* bloco do cliente */}
      <div style={{ fontSize: 12, lineHeight: 1.9, color: "#111827" }}>
        {rows.map(([k, v]) => (
          <div key={k}><span style={{ fontWeight: 700 }}>{k}:</span> {v}</div>
        ))}
      </div>
      {/* folga ate o rodape (rodape vai pro fim da pagina) */}
      <div style={{ flex: 0.5 }} />
      {/* rodape: se "mostrar rodape na capa" estiver ligado, usa o rodape configuravel
          (conteudo + logo opcional); senao, o texto de validade padrao. */}
      {branding?.footerOnCover ? (
        <div style={{ marginTop: "10mm", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexDirection: branding?.footerLogoSide === "left" ? "row-reverse" : "row", fontSize: 9, color: "#1f2937" }}>
          <div style={{ flex: 1, textAlign: "center" }} dangerouslySetInnerHTML={{ __html: branding?.footerHtml ? resolvePlaceholders(branding.footerHtml, data) : "" }} />
          {branding?.logoFooter && branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="logo" style={{ height: branding?.logoSizeFooter || 28, objectFit: "contain", flexShrink: 0 }} />
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: "10mm", fontSize: 9, color: "#1f2937", textAlign: "center" }}>
          A validade da proposta e de {days} dias. Apos esse periodo, favor consultar se houve alteracao no valor da proposta.
        </div>
      )}
    </div>
  );
}

function ProductsBySectionBlock({ data, config }: { data: BudgetReportData; config?: any }) {
  const groups = groupBySection(data);
  const showImages = config?.showImages !== false; // default: mostra imagem
  if (!groups.length) return <div className="rp-empty">Nenhum item selecionado.</div>;
  return (
    <div className="rp-products">
      <div className="rp-section-banner" style={{ background: "#1e3a8a" }}>ITENS DO ORCAMENTO</div>
      {groups.map((g) => {
        const comImagem = g.items.filter((it) => showImages && it.imageUrl);
        return (
          <div className="rp-group avoid-break" key={g.key}>
            <div className="rp-group-title">{g.label}</div>
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th-desc">Item</th>
                  <th className="rp-th-qty">Qtd</th>
                  <th className="rp-th-val">Valor un.</th>
                  <th className="rp-th-val">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((it, i) => (
                  <tr key={i}>
                    <td className="rp-td-desc">{it.description}{it.slotName ? <span className="rp-slot"> · {it.slotName}</span> : null}</td>
                    <td className="rp-td-qty">{num(it.qty)}</td>
                    <td className="rp-td-val">{brl(it.unitPriceCents)}</td>
                    <td className="rp-td-val">{brl(it.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {comImagem.length ? (
              <div className="rp-imgs">
                {comImagem.map((it, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <figure className="rp-fig" key={i}>
                    <img src={it.imageUrl!} alt={it.description} className="rp-prod-img" />
                    <figcaption>{it.description}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FixedBlock({ html, data }: { html: string; data: BudgetReportData }) {
  return <div className="rp-fixed" dangerouslySetInnerHTML={{ __html: resolvePlaceholders(html || "", data) }} />;
}

function TodoBlock({ kind }: { kind: string }) {
  return <div className="rp-todo">Bloco &quot;{kind}&quot; — em construcao</div>;
}

// Subtotal por etapa (soma dos itens ativos de cada etapa).
function sectionTotals(data: BudgetReportData): { key: string; label: string; totalCents: number }[] {
  return groupBySection(data).map((g) => ({
    key: g.key, label: g.label,
    totalCents: g.items.reduce((s, it) => s + (it.totalCents || 0), 0),
  }));
}

function BudgetSummaryBlock({ data }: { data: BudgetReportData }) {
  const secs = sectionTotals(data);
  const sub = data.subtotalCents ?? secs.reduce((s, x) => s + x.totalCents, 0);
  const disc = data.discountCents || 0;
  const tax = data.taxesCents || 0;
  return (
    <div className="rp-summary">
      <div className="rp-section-banner" style={{ background: "#1e3a8a" }}>RESUMO DO ORCAMENTO</div>
      <table className="rp-table">
        <thead><tr><th className="rp-th-desc">Etapa</th><th className="rp-th-val">Valor</th></tr></thead>
        <tbody>
          {secs.map((s) => (<tr key={s.key}><td className="rp-td-desc">{s.label}</td><td className="rp-td-val">{brl(s.totalCents)}</td></tr>))}
        </tbody>
      </table>
      <div className="rp-totals">
        <div className="rp-total-row"><span>Subtotal</span><span>{brl(sub)}</span></div>
        {disc > 0 ? <div className="rp-total-row"><span>Desconto</span><span>- {brl(disc)}</span></div> : null}
        {tax > 0 ? <div className="rp-total-row"><span>Impostos</span><span>{brl(tax)}</span></div> : null}
        <div className="rp-total-row rp-total-grand"><span>TOTAL</span><span>{brl(data.totalCents)}</span></div>
      </div>
    </div>
  );
}

function TermsBlock({ data, config }: { data: BudgetReportData; config?: any }) {
  const title: string = config?.title || "Termos e condicoes";
  const items: [string, string | null | undefined][] = [
    ["Garantia dos equipamentos", data.equipmentWarranty],
    ["Garantia do servico", data.workWarranty],
    ["Condicoes de pagamento", data.paymentTerms],
  ];
  const shown = items.filter(([, v]) => v && String(v).trim());
  return (
    <div className="rp-terms">
      <div className="rp-section-banner" style={{ background: "#1e3a8a" }}>{title.toUpperCase()}</div>
      {data.termsConditions ? <div className="rp-terms-text">{data.termsConditions.split("\n").map((p, i) => <p key={i}>{p}</p>)}</div> : null}
      {shown.map(([k, v]) => (<div className="rp-term-item" key={k}><div className="rp-term-k">{k}</div><div className="rp-term-v">{v}</div></div>))}
      {data.validityDays ? <p className="rp-muted" style={{ marginTop: 8 }}>Proposta valida por {data.validityDays} dias.</p> : null}
      {!data.termsConditions && !shown.length ? <div className="rp-empty">Sem termos cadastrados.</div> : null}
    </div>
  );
}

function PhotosGalleryBlock({ data, config }: { data: BudgetReportData; config?: any }) {
  const imgs = activeItems(data.items).filter((it) => it.imageUrl);
  const cols = Number(config?.columns) || 3;
  return (
    <div className="rp-gallery">
      <div className="rp-section-banner" style={{ background: "#1e3a8a" }}>{String(config?.title || "Galeria de fotos").toUpperCase()}</div>
      {imgs.length ? (
        <div className="rp-gallery-grid" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
          {imgs.map((it, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <figure className="rp-gfig" key={i}><img src={it.imageUrl!} alt={it.description} className="rp-gimg" /><figcaption>{it.description}</figcaption></figure>
          ))}
        </div>
      ) : <div className="rp-empty">Nenhuma imagem nos itens (cadastre a foto no produto).</div>}
    </div>
  );
}

function InstallmentsBlock({ data }: { data: BudgetReportData }) {
  const parc = data.installments || [];
  return (
    <div className="rp-inst">
      <div className="rp-section-banner" style={{ background: "#1e3a8a" }}>PLANO DE PAGAMENTO</div>
      {parc.length ? (
        <table className="rp-table">
          <thead><tr><th className="rp-th-desc">Parcela</th><th>Vencimento</th><th className="rp-th-val">Valor</th></tr></thead>
          <tbody>
            {parc.map((p, i) => (<tr key={i}><td className="rp-td-desc">{p.label}</td><td>{p.dueLabel || "—"}</td><td className="rp-td-val">{brl(p.valueCents)}</td></tr>))}
          </tbody>
        </table>
      ) : data.paymentTerms ? <div className="rp-terms-text"><p>{data.paymentTerms}</p></div> : <div className="rp-empty">Sem plano de pagamento.</div>}
    </div>
  );
}

function CustomTableBlock({ config }: { config?: any }) {
  const title: string = config?.title || "";
  const columns: string[] = Array.isArray(config?.columns) ? config.columns : [];
  const rows: any[][] = Array.isArray(config?.rows) ? config.rows : [];
  if (!rows.length) return <div className="rp-empty">Tabela personalizada vazia — configure titulo, colunas e linhas no JSON da pagina.</div>;
  return (
    <div className="rp-custom">
      {title ? <div className="rp-section-banner" style={{ background: "#1e3a8a" }}>{title.toUpperCase()}</div> : null}
      <table className="rp-table">
        {columns.length ? <thead><tr>{columns.map((c, i) => <th key={i} className={i === 0 ? "rp-th-desc" : "rp-th-val"}>{c}</th>)}</tr></thead> : null}
        <tbody>{rows.map((r, i) => <tr key={i}>{(Array.isArray(r) ? r : [r]).map((c, j) => <td key={j} className={j === 0 ? "rp-td-desc" : "rp-td-val"}>{String(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// Renderiza UM bloco por tipo. Reusado pela pagina (DYNAMIC) E pelos nos "block" da composicao.
function renderBlockByType(blockType: string | null | undefined, data: BudgetReportData, config: any, branding?: ReportBranding | null) {
  switch (blockType) {
    case "COVER": return <CoverBlock data={data} branding={branding} config={config} />;
    case "PRODUCTS_BY_SECTION": return <ProductsBySectionBlock data={data} config={config} />;
    case "BUDGET_SUMMARY": return <BudgetSummaryBlock data={data} />;
    case "TERMS_CONDITIONS": return <TermsBlock data={data} config={config} />;
    case "PHOTOS_GALLERY": return <PhotosGalleryBlock data={data} config={config} />;
    case "INSTALLMENTS": return <InstallmentsBlock data={data} />;
    case "CUSTOM_TABLE": return <CustomTableBlock config={config} />;
    case "HEATING_BOMBA": return <BombaDatasheetBlock data={data} />;
    case "HEATING_SOLAR": return <SolarDatasheetBlock data={data} />;
    case "TEXT": return <FixedBlock html={config?.html || ""} data={data} />;
    case "IMAGE": {
      if (!config?.url) return <div className="rp-empty">Imagem sem URL.</div>;
      const radius = config?.radius != null ? `${config.radius}px` : 6;
      // PREENCHER CARD: imagem absoluta ocupa 100%x100% do card (card precisa ter Altura,
      // fixa ou herdada do "esticar" da linha). object-fit:cover NAO distorce — só corta a sobra.
      if (config?.fill || config?.fit === "fill") {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={config.url} alt={config?.alt || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: radius }} />;
      }
      // TAMANHO POR CAMPOS Largura(w) x Altura(h) em px. Com o cadeado de proporcao LIGADO
      // (no editor) o w:h ja vem na proporcao certa -> object-fit:fill nao distorce. Desligado =
      // caixa exata. So um dos campos = o outro fica "auto" (mantem proporcao). Fallback: width legado.
      const w = config?.w; const h = config?.h;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={config.url} alt={config?.alt || ""} style={{ width: w ? `${w}px` : config?.width || "auto", height: h ? `${h}px` : "auto", maxWidth: "100%", objectFit: "fill", borderRadius: radius, display: "block" }} />;
    }
    default: return <TodoBlock kind={blockType || "?"} />;
  }
}

// Renderizador RECURSIVO de um no (card/row/block). Cards/rows seguram filhos (aninhamento).
// Etapa B (WYSIWYG): quando onSelectNode existe, cada no fica CLICAVEL na folha e ganha
// contorno quando selecionado. stopPropagation faz o clique pegar o no mais INTERNO
// (bloco/linha) em vez do card-pai. Sem onSelectNode = render normal (impressao/preview).
// Editavel IN-PLACE SEM barra propria (Etapa C / unificacao): so a area de texto. A barra de
// formatacao e a aba "Inicio" do ribbon (age na selecao via .rp-inline-edit). innerHTML setado
// so na montagem (keyed por node.id) -> digitar/execCommand nao reseta o cursor.
function InlineEditable({ html, onChange, onCommit }: { html: string; onChange: (html: string) => void; onCommit?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) { ref.current.innerHTML = html || ""; ref.current.focus(); }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  const emit = () => onChange(ref.current?.innerHTML || "");
  return (
    <div ref={ref} className="rp-inline-edit" contentEditable suppressContentEditableWarning
      onInput={emit} onBlur={() => { emit(); onCommit?.(); }}
      style={{ outline: "2px dashed #06b6d4", outlineOffset: "2px", minHeight: "1em", cursor: "text" }} />
  );
}

// onEditText: edicao IN-PLACE (Etapa C). Quando presente e o bloco TEXT esta selecionado,
// o proprio texto vira editavel na FOLHA (InlineEditable; formata pela aba Inicio) — sem abrir
// painel separado. Edita o HTML CRU (com {placeholders}); resolve so na renderizacao final.
type NodeSelProps = { selectedId?: string | null; onSelectNode?: (id: string) => void; onEditText?: (id: string, html: string) => void };
function ReportNodeView({ node, data, branding, selectedId, onSelectNode, onEditText }: { node: ReportNode; data: BudgetReportData; branding?: ReportBranding | null } & NodeSelProps) {
  const st = node.style || {};
  const selStyle = onSelectNode
    ? { cursor: "pointer" as const, outline: selectedId === node.id ? "2px solid #06b6d4" : undefined, outlineOffset: "1px" }
    : null;
  const childProps: NodeSelProps & { data: BudgetReportData; branding?: ReportBranding | null } = { data, branding, selectedId, onSelectNode, onEditText };
  if (node.kind === "block") {
    const editingText = !!onEditText && node.blockType === "TEXT" && selectedId === node.id;
    const bcfg: any = node.config || {};
    const isImg = node.blockType === "IMAGE";
    const isFillImg = isImg && (bcfg.fill || bcfg.fit === "fill");
    // Imagem (modo nao-preencher): o bloco vira flex pra alinhar a imagem H x V dentro do card.
    // height:100% so surte efeito quando o card tem altura definida (senao colapsa pra auto — ok).
    const toFlex = (a?: string) => (a === "center" ? "center" : a === "right" || a === "bottom" ? "flex-end" : "flex-start");
    const imgAlign = isImg && !isFillImg ? { display: "flex", height: "100%", justifyContent: toFlex(bcfg.alignH), alignItems: toFlex(bcfg.alignV) } : null;
    return (
      <div className="rp-node-block" style={{ flex: st.flex || undefined, textAlign: (st.textAlign as any) || undefined, fontSize: st.fontSize ? `${st.fontSize}pt` : undefined, ...(imgAlign || {}), ...selStyle }}
        onClick={onSelectNode ? (e) => { e.stopPropagation(); onSelectNode(node.id); } : undefined}>
        {editingText
          ? <InlineEditable key={node.id} html={node.config?.html || ""} onChange={(html) => onEditText!(node.id, html)} />
          : renderBlockByType(node.blockType, data, node.config, branding)}
      </div>
    );
  }
  if (node.kind === "row") {
    return (
      <div className="rp-node-row" style={{ gap: `${st.gap ?? 8}px`, alignItems: (st.align as any) || "stretch", justifyContent: st.justify === "center" ? "center" : st.justify === "end" ? "flex-end" : st.justify === "between" ? "space-between" : st.justify === "around" ? "space-around" : st.justify === "start" ? "flex-start" : undefined, flexWrap: st.wrap ? "wrap" : undefined, flex: st.flex || undefined, ...selStyle }}
        onClick={onSelectNode ? (e) => { e.stopPropagation(); onSelectNode(node.id); } : undefined}>
        {(node.children || []).map((c) => <ReportNodeView key={c.id} node={c} {...childProps} />)}
      </div>
    );
  }
  // card
  const cardStyle: any = {
    background: st.bg || undefined,
    border: st.borderWidth ? `${st.borderWidth}px solid ${st.borderColor || "#e2e8f0"}` : undefined,
    borderRadius: st.radius != null ? `${st.radius}px` : undefined,
    padding: st.padding != null ? `${st.padding}px` : undefined,
    color: st.textColor || undefined,
    boxShadow: st.shadow ? "0 1px 6px rgba(0,0,0,.12)" : undefined,
    flex: st.flex || undefined,
    // posicionamento do card na pagina (editavel): largura EXATA (px) sobrepoe a largura (%)
    width: st.widthPx != null ? `${st.widthPx}px` : st.width || undefined,
    marginTop: st.marginTop != null ? `${st.marginTop}px` : undefined,
    marginBottom: st.marginBottom != null ? `${st.marginBottom}px` : undefined,
    marginLeft: st.selfAlign === "center" || st.selfAlign === "right" ? "auto" : undefined,
    marginRight: st.selfAlign === "center" || st.selfAlign === "left" ? "auto" : undefined,
    textAlign: (st.textAlign as any) || undefined,
    fontSize: st.fontSize ? `${st.fontSize}pt` : undefined,
    // altura fixa do card (px) — opcional; permite imagem "Preencher card" com altura definida.
    // position:relative SEMPRE: ancora a imagem absoluta ("Preencher card") tanto na altura fixa
    // quanto na altura herdada do "esticar" da linha (imagem ao lado do texto preenche a coluna).
    // overflow:hidden corta o excedente do cover e respeita o arredondamento.
    height: st.height != null ? `${st.height}px` : undefined,
    position: "relative",
    overflow: st.height != null ? "hidden" : undefined,
    // SANGRIA (capa cheia): cancela o padding de 12mm da pagina -> fundo vai ate as bordas.
    // vira flex-column pra usar espacadores (flex:1) e posicionar titulo/rodape; ocupa a folha toda.
    ...(st.bleed
      ? { margin: "-12mm", width: "auto", borderRadius: 0, minHeight: st.height != null ? undefined : "297mm", display: "flex", flexDirection: "column" }
      : {}),
    ...selStyle,
  };
  return (
    <div className="rp-node-card" style={cardStyle}
      onClick={onSelectNode ? (e) => { e.stopPropagation(); onSelectNode(node.id); } : undefined}>
      {(node.children || []).map((c) => <ReportNodeView key={c.id} node={c} {...childProps} />)}
    </div>
  );
}

export function CompositionNodes({ nodes, data, branding, selectedId, onSelectNode, onEditText }: { nodes: ReportNode[]; data: BudgetReportData; branding?: ReportBranding | null } & NodeSelProps) {
  return <>{(nodes || []).map((n) => <ReportNodeView key={n.id} node={n} data={data} branding={branding} selectedId={selectedId} onSelectNode={onSelectNode} onEditText={onEditText} />)}</>;
}

// Preview de uma composicao (lista de nodes) — usado no modal do editor pra ver ao vivo
// enquanto monta os cards. NAO usa #budget-pdf-area (evita id duplicado com o preview
// principal); as classes .rp-* sao globais (injetadas pelo BudgetReport da pagina). Inclui
// o CSS de novo por seguranca (idempotente). Box A4-ish (210mm) so visual.
export function CompositionPreview({ nodes, data, selectedId, onSelectNode, onEditText }: { nodes: ReportNode[]; data: BudgetReportData } & NodeSelProps) {
  return (
    <div style={{ background: "#f1f5f9", padding: "10px", borderRadius: 8, overflow: "auto" }}>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div style={{ width: "190mm", maxWidth: "100%", margin: "0 auto", background: "#fff", padding: "10mm", boxShadow: "0 1px 8px rgba(0,0,0,.12)", color: "#0f172a", fontSize: "11px", lineHeight: 1.35 }}>
        {nodes && nodes.length ? <CompositionNodes nodes={nodes} data={data} selectedId={selectedId} onSelectNode={onSelectNode} onEditText={onEditText} /> : <div className="rp-empty">Adicione cards/blocos pra ver aqui.</div>}
      </div>
    </div>
  );
}

// ── CANVAS (estilo PowerPoint): caixas livres x,y,w,h em % da folha A4 ────────
// Uma pagina "canvas" guarda pageConfig = { canvas:true, boxes:Box[] }. Cada Box e
// absolutamente posicionado em % da folha (mesmo valor na tela e na impressao A4).
export type Box = {
  id: string;
  type: "TEXT" | "IMAGE" | "BLOCK" | "CARD" | "ICON";
  name?: string;                              // rotulo do objeto na hierarquia (camadas)
  x: number; y: number; w: number; h: number; // mm a partir do canto sup-esq (unit:"mm")
  z?: number;
  html?: string;                              // TEXT (HTML cru com {placeholders})
  href?: string | null;                       // link clicavel da caixa toda (TEXT/IMAGE) — vira <a> no PDF
  url?: string; fit?: "cover" | "contain" | "fill"; // IMAGE
  icon?: string;                              // ICON (nome na biblioteca reportIcons; cor = style.textColor)
  blockType?: string; config?: any;           // BLOCK (PRODUCTS_BY_SECTION, COVER, ...)
  // Condicao de visibilidade (Fase 1b blocos dinamicos) — caixa so aparece se a regra bater no orcamento.
  // Alvo: cellRef (linha Lx) OU etapa (poolSection). op compara presenca de produto / quantidade.
  showIf?: {
    cellRef?: string | null;
    etapa?: string | null;
    op: "hasProduct" | "noProduct" | "qtyGt" | "qtyGte" | "qtyEq" | "qtyLte" | "qtyLt";
    value?: number | null;
  } | null;
  // BANDA REPETIDORA (Fase 2 blocos dinamicos) — caixas com o MESMO band.id sao a linha-modelo.
  // source: repete a banda por LINHA (cada item com cellRef) ou por ETAPA (cada poolSection).
  // No conteudo, o token ATUAL vira o ref do item corrente: {linha:ATUAL.produto}, {etapa:ATUAL.nome}.
  band?: { id: string; source: "linhas" | "etapas" } | null;
  style?: {
    bg?: string | null; borderColor?: string | null; borderWidth?: number | null;
    radius?: number | null; padding?: number | null; textColor?: string | null;
    fontSize?: number | null; fontFamily?: string | null; lineHeight?: number | null;
    align?: string | null; valign?: string | null; shadow?: boolean | null; opacity?: number | null; noWrap?: boolean | null;
  } | null;
};

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

// Dimensoes da pagina (mm). Default por orientacao: retrato A4 210x297, paisagem 297x210.
// Largura/altura customizadas (pageWidthMm/pageHeightMm) sobrepoem.
export function pageDims(branding?: ReportBranding | null): { w: number; h: number } {
  const land = branding?.orientation === "landscape";
  const w = (branding as any)?.pageWidthMm ?? (land ? 297 : 210);
  const h = (branding as any)?.pageHeightMm ?? (land ? 210 : 297);
  return { w, h };
}

function boxRectStyle(b: Box, unit: "mm" | "%" = "%"): CSSProperties {
  const st = b.style || {};
  const u = unit === "mm" ? "mm" : "%";
  return {
    position: "absolute", boxSizing: "border-box",
    left: `${b.x}${u}`, top: `${b.y}${u}`, width: `${b.w}${u}`, height: `${b.h}${u}`,
    zIndex: b.z || 1,
    background: st.bg || undefined,
    border: st.borderWidth ? `${st.borderWidth}px solid ${st.borderColor || "#e2e8f0"}` : undefined,
    borderRadius: st.radius != null ? `${st.radius}px` : undefined,
    padding: st.padding != null ? `${st.padding}px` : undefined,
    color: st.textColor || undefined,
    fontSize: st.fontSize ? `${st.fontSize}pt` : undefined,
    fontFamily: st.fontFamily || undefined,
    lineHeight: st.lineHeight != null ? st.lineHeight : undefined,
    boxShadow: st.shadow ? "0 1px 6px rgba(0,0,0,.18)" : undefined,
    opacity: st.opacity != null ? st.opacity : undefined,
    overflow: "hidden",
  };
}

// Conteudo interno de um Box (compartilhado entre render de impressao e editor).
function BoxContent({ box, data, branding, editingText, onEditText, onEditCommit, editor }: { box: Box; data: BudgetReportData; branding?: ReportBranding | null; editingText?: boolean; onEditText?: (id: string, html: string) => void; onEditCommit?: () => void; editor?: boolean }) {
  const st = box.style || {};
  // No EDITOR o link NAO e clicavel (pointer-events:none) p/ permitir selecionar/arrastar/duplo-clique.
  // So vira link de verdade no read-only (impressao/preview).
  const wrapLink = (inner: ReactNode) => (box.href && !editingText)
    ? <a href={normalizeHref(box.href)} target="_blank" rel="noopener" style={{ display: "block", width: "100%", height: "100%", color: "inherit", textDecoration: "none", pointerEvents: editor ? "none" : undefined }}>{inner}</a>
    : inner;
  if ((box.type as string) === "CARD") return null; // card = retangulo (bg/borda via boxRectStyle); conteudo vem de outras caixas
  if (box.type === "TEXT") {
    const wrap = (st as any).noWrap ? "nowrap" : "normal";
    if (editingText && onEditText) return <div style={{ width: "100%", height: "100%", whiteSpace: wrap, overflow: "hidden" }}><InlineEditable key={box.id} html={box.html || ""} onChange={(h) => onEditText(box.id, h)} onCommit={onEditCommit} /></div>;
    const valign = st.valign === "center" ? "center" : st.valign === "bottom" ? "flex-end" : "flex-start";
    return wrapLink(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: valign, textAlign: (st.align as any) || undefined, whiteSpace: wrap }} dangerouslySetInnerHTML={{ __html: resolvePlaceholders(box.html || "", data) }} />);
  }
  if (box.type === "IMAGE") {
    // url pode ser ESTATICA ou um TOKEN ligado ao cadastro (ex: {linha:L130.prodImagem}) — resolve.
    const src = box.url && box.url.includes("{") ? resolvePlaceholders(box.url, data).trim() : (box.url || "");
    if (!src) return <div className="rp-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 9, color: "#94a3b8", textAlign: "center", padding: 4 }}>{box.url && box.url.includes("{") ? "Imagem do produto (sem imagem nesta linha)" : "Imagem"}</div>;
    // eslint-disable-next-line @next/next/no-img-element
    return wrapLink(<img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: (box.fit as any) || "cover", display: "block" }} />);
  }
  if ((box.type as string) === "ICON") {
    const ic = getReportIcon(box.icon);
    const color = st.textColor || ic?.color || (branding as any)?.primaryColor || "#16365C";
    if (!ic) return <div className="rp-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>Ícone</div>;
    return wrapLink(
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        style={{ width: "100%", height: "100%", color, display: "block" }}
        dangerouslySetInnerHTML={{ __html: ic.svg }} />,
    );
  }
  return <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>{renderBlockByType(box.blockType, data, box.config, branding)}</div>;
}
// Normaliza link: numero->wa.me, @->instagram, senao https:// (igual ao selLink antigo).
function normalizeHref(url: string): string {
  let href = (url || "").trim();
  if (!href) return "#";
  const digits = href.replace(/[^\d]/g, "");
  if (/^@/.test(href)) return `https://instagram.com/${href.replace(/^@/, "")}`;
  if (/whats|wa\.me/i.test(href)) return href.startsWith("http") ? href : `https://wa.me/${digits}`;
  if (!/^https?:\/\//i.test(href)) return digits.length >= 10 ? `https://wa.me/55${digits}` : `https://${href}`;
  return href;
}

// Render READ-ONLY de uma pagina canvas (impressao / preview / miniatura).
export function CanvasPage({ boxes, data, branding, unit = "%" }: { boxes: Box[]; data: BudgetReportData; branding?: ReportBranding | null; unit?: "mm" | "%" }) {
  return (
    <div className="rp-canvas" style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
      {expandBandsForPrint([...(boxes || [])], data).sort((a, b) => (a.z || 0) - (b.z || 0)).filter((b) => boxShows(b, data)).map((b) => (
        <div key={b.id} style={boxRectStyle(b, unit)}><BoxContent box={b} data={data} branding={branding} /></div>
      ))}
    </div>
  );
}

// Moldura interativa de UM box no editor: clicar seleciona, arrastar move, alcas
// redimensionam, duplo-clique no TEXT edita. Geometria em % via rect do canvas pai.
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
function handleStyle(h: string): CSSProperties {
  const base: CSSProperties = { position: "absolute", width: 10, height: 10, background: "#fff", border: "1.5px solid #06b6d4", borderRadius: 2, zIndex: 50 };
  const m = -5;
  if (h.includes("n")) base.top = m; if (h.includes("s")) base.bottom = m;
  if (h.includes("w")) base.left = m; if (h.includes("e")) base.right = m;
  if (h === "n" || h === "s") { base.left = "50%"; base.marginLeft = -5; }
  if (h === "e" || h === "w") { base.top = "50%"; base.marginTop = -5; }
  const cursors: Record<string, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize" };
  base.cursor = cursors[h];
  return base;
}
function BoxFrame({ box, selected, multi, editing, canvasRef, lockAspect, unit = "mm", pageW = 210, pageH = 297, others = [], onGuides, onSelect, onStartEdit, onChange, onCommit, groupMove, onGroupStart, onGroupMove, hasCond, condHidden, bandLabel, children }: {
  box: Box; selected: boolean; multi?: boolean; editing: boolean; canvasRef: React.RefObject<HTMLDivElement>; lockAspect?: boolean;
  unit?: "mm" | "%"; pageW?: number; pageH?: number; others?: Box[]; onGuides?: (g: { o: "v" | "h"; p: number }[]) => void;
  onSelect: (additive?: boolean) => void; onStartEdit: () => void; onChange: (b: Box) => void; onCommit: () => void;
  groupMove?: boolean; onGroupStart?: () => void; onGroupMove?: (dx: number, dy: number) => void;
  hasCond?: boolean; condHidden?: boolean; bandLabel?: string; children: React.ReactNode;
}) {
  const draggedRef = useRef(false);
  const begin = (mode: string) => (e: React.PointerEvent) => {
    if (editing) return;
    // SEM preventDefault aqui: senao o navegador suprime o dblclick (= nao da pra editar).
    e.stopPropagation();
    if (e.shiftKey) e.preventDefault(); // shift = multi-selecao: impede o navegador de selecionar TEXTO
    const startShift = e.shiftKey;
    // Caixa que JA esta no grupo (multi) + sem shift: NAO colapsa a selecao agora — mantem o grupo pra arrastar junto.
    // Se for so um clique (sem arrastar), colapsa pra caixa unica no pointerup.
    if (startShift) onSelect(true);
    else if (!groupMove) onSelect(false);
    draggedRef.current = false;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const start = { sx: e.clientX, sy: e.clientY, b: { ...box } };
    const ratio = box.h ? box.w / box.h : 1;
    // dominio: mm (0..pageW/H) ou % (0..100). Converte px do gesto p/ a unidade.
    const maxX = unit === "mm" ? pageW : 100, maxY = unit === "mm" ? pageH : 100, minSz = unit === "mm" ? 5 : 3;
    let dragging = false;
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      onGuides?.([]);
      if (commit && dragging) onCommit();
    };
    const onMove = (ev: PointerEvent) => {
      const ddx = ev.clientX - start.sx, ddy = ev.clientY - start.sy;
      if (!dragging && Math.abs(ddx) + Math.abs(ddy) < 4) return; // threshold: clique nao move
      if (!dragging) { dragging = true; draggedRef.current = true; document.body.style.userSelect = "none"; if (mode === "move" && groupMove) onGroupStart?.(); }
      const dux = (ddx / rect.width) * maxX;
      const duy = (ddy / rect.height) * maxY;
      let { x, y, w, h } = start.b;
      // ── Mover o GRUPO inteiro (multi-selecao): desloca todas as caixas selecionadas pelo mesmo delta. ──
      if (mode === "move" && groupMove && onGroupMove) { onGuides?.([]); onGroupMove(round2(dux), round2(duy)); return; }
      if (mode === "move") {
        x = clampN(start.b.x + dux, 0, maxX - start.b.w);
        y = clampN(start.b.y + duy, 0, maxY - start.b.h);
        // ── Guias inteligentes + snap (estilo PowerPoint/Canva). Alt arrastando = livre. ──
        if (!ev.altKey) {
          const T = unit === "mm" ? 1.5 : 1.2; // limiar de encaixe
          const bw = start.b.w, bh = start.b.h;
          const myX = [{ e: x, off: 0 }, { e: x + bw / 2, off: bw / 2 }, { e: x + bw, off: bw }];
          const myY = [{ e: y, off: 0 }, { e: y + bh / 2, off: bh / 2 }, { e: y + bh, off: bh }];
          const tX: number[] = [0, maxX / 2, maxX]; // bordas + centro da pagina
          const tY: number[] = [0, maxY / 2, maxY];
          for (const o of others) { tX.push(o.x, o.x + o.w / 2, o.x + o.w); tY.push(o.y, o.y + o.h / 2, o.y + o.h); }
          let bX: { d: number; nx: number; line: number } | null = null;
          for (const m of myX) for (const t of tX) { const d = Math.abs(m.e - t); if (d <= T && (!bX || d < bX.d)) bX = { d, nx: t - m.off, line: t }; }
          let bY: { d: number; ny: number; line: number } | null = null;
          for (const m of myY) for (const t of tY) { const d = Math.abs(m.e - t); if (d <= T && (!bY || d < bY.d)) bY = { d, ny: t - m.off, line: t }; }
          const g: { o: "v" | "h"; p: number }[] = [];
          if (bX) { x = clampN(bX.nx, 0, maxX - bw); g.push({ o: "v", p: bX.line }); }
          if (bY) { y = clampN(bY.ny, 0, maxY - bh); g.push({ o: "h", p: bY.line }); }
          onGuides?.(g);
        } else onGuides?.([]);
      }
      else {
        if (mode.includes("e")) w = clampN(start.b.w + dux, minSz, maxX - start.b.x);
        if (mode.includes("s")) h = clampN(start.b.h + duy, minSz, maxY - start.b.y);
        if (mode.includes("w")) { const nw = clampN(start.b.w - dux, minSz, start.b.x + start.b.w); x = start.b.x + (start.b.w - nw); w = nw; }
        if (mode.includes("n")) { const nh = clampN(start.b.h - duy, minSz, start.b.y + start.b.h); y = start.b.y + (start.b.h - nh); h = nh; }
        if (lockAspect && ratio && (mode === "se" || mode === "ne" || mode === "sw" || mode === "nw")) h = w / ratio;
      }
      onChange({ ...start.b, x: round2(x), y: round2(y), w: round2(w), h: round2(h) });
    };
    const onUp = () => {
      if (groupMove && !startShift && !draggedRef.current) onSelect(false);
      // 2o clique numa caixa de TEXTO JA selecionada (sem arrastar) = editar — resolve "card pequeno"
      // onde as alcas cobrem o corpo e o duplo-clique nao dispara.
      else if (selected && !startShift && !draggedRef.current && !editing && box.type === "TEXT") onStartEdit();
      finish(true);
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { if (mode === "move" && groupMove && onGroupMove) onGroupMove(0, 0); else onChange({ ...start.b }); draggedRef.current = false; finish(false); } };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
  };
  return (
    <div style={{ ...boxRectStyle(box, unit), cursor: editing ? "text" : "move", opacity: condHidden ? 0.32 : undefined, outline: (selected || multi) ? "2px solid #06b6d4" : (hasCond ? "1.5px dashed #f59e0b" : undefined), outlineOffset: multi && !selected ? 1 : 0, boxShadow: (selected || multi) ? "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(6,182,212,0.45)" : undefined }}
      onPointerDown={begin("move")}
      onClick={(e) => { e.stopPropagation(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
      {children}
      {hasCond ? (
        <div title={condSummary(box.showIf)} style={{ position: "absolute", top: -7, left: -7, zIndex: 40, background: condHidden ? "#b45309" : "#f59e0b", color: "#fff", borderRadius: 9, fontSize: 9, lineHeight: "15px", height: 15, padding: "0 4px", fontWeight: 700, boxShadow: "0 1px 3px rgba(0,0,0,.3)", pointerEvents: "none", whiteSpace: "nowrap" }}>⚡{condHidden ? " oculto" : ""}</div>
      ) : null}
      {bandLabel ? (
        <div title="Banda repetidora — esta linha-modelo se repete por item no orçamento (na impressão). Aqui no editor você vê só o modelo." style={{ position: "absolute", top: -7, right: -7, zIndex: 40, background: "#2563eb", color: "#fff", borderRadius: 9, fontSize: 9, lineHeight: "15px", height: 15, padding: "0 4px", fontWeight: 700, boxShadow: "0 1px 3px rgba(0,0,0,.3)", pointerEvents: "none", whiteSpace: "nowrap" }}>{bandLabel}</div>
      ) : null}
      {selected && !editing ? HANDLES.map((h) => (<div key={h} style={handleStyle(h)} onPointerDown={begin(h)} />)) : null}
    </div>
  );
}

// Editor de canvas (uma pagina) — usado no centro do editor. Renderiza a folha A4
// (aspect-ratio) e os boxes interativos. onChange = update ao vivo; onCommit = passo
// de historico (undo/redo) no fim do gesto. Edicao de texto inline via duplo-clique.
export function CanvasEditor({ boxes, data, branding, selBox, selSet, pageW, pageH, pageBg, unit = "mm", hfUnit = "%", onSelect, onChange, onCommit, onEditStart, onGroupStart, onGroupMove, hfOverlay }: {
  boxes: Box[]; data: BudgetReportData; branding?: ReportBranding | null; selBox: string | null; selSet?: Set<string>;
  pageW?: number; pageH?: number; pageBg?: string; unit?: "mm" | "%"; hfUnit?: "mm" | "%";
  onSelect: (id: string | null, additive?: boolean) => void; onChange: (b: Box) => void; onCommit: () => void; onEditStart?: (id: string) => void;
  onGroupStart?: () => void; onGroupMove?: (dx: number, dy: number) => void;
  hfOverlay?: { headerBoxes?: Box[]; footerBoxes?: Box[]; headerHmm?: number; footerHmm?: number };
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ o: "v" | "h"; p: number }[]>([]); // guias inteligentes (snap)
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selBox !== editingId) setEditingId(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selBox]);
  const W = pageW || 210, H = pageH || 297;
  return (
    // Folha no TAMANHO REAL (mm) -> proporcao IDENTICA a impressao (fonte vs pagina). Rola
    // no painel (overflow auto) quando passa do espaco.
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, background: "#475569", overflow: "auto" }}>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div ref={canvasRef}
        style={{ position: "relative", isolation: "isolate", width: `${W}mm`, height: `${H}mm`, background: pageBg || "#fff", boxShadow: "0 2px 18px rgba(0,0,0,.35)", overflow: "hidden", flexShrink: 0, color: "#0f172a", fontSize: "11px", lineHeight: 1.35 }}
        onPointerDown={(e) => { if (e.target === canvasRef.current) { onSelect(null); setEditingId(null); } }}>
        {/* Guia das MARGENS (so no editor; nao imprime) — tracejado do recuo */}
        {((branding as any)?.pageMarginMm ?? 12) > 0 ? (
          <div style={{ position: "absolute", inset: `${(branding as any)?.pageMarginMm ?? 12}mm`, border: "1px dashed #cbd5e1", pointerEvents: "none", zIndex: 0 }} />
        ) : null}
        {/* Cabecalho/Rodape como SOBREPOSICAO esmaecida (contexto; nao editavel aqui) */}
        {hfOverlay?.headerBoxes && hfOverlay.headerBoxes.length ? (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${hfOverlay.headerHmm ?? 18}mm`, overflow: "hidden", opacity: 0.55, pointerEvents: "none", borderBottom: "1px dashed #cbd5e1" }}>
            <CanvasPage boxes={hfOverlay.headerBoxes} data={data} branding={branding} unit={hfUnit || "%"} />
          </div>
        ) : null}
        {hfOverlay?.footerBoxes && hfOverlay.footerBoxes.length ? (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${hfOverlay.footerHmm ?? 14}mm`, overflow: "hidden", opacity: 0.55, pointerEvents: "none", borderTop: "1px dashed #cbd5e1" }}>
            <CanvasPage boxes={hfOverlay.footerBoxes} data={data} branding={branding} unit={hfUnit || "%"} />
          </div>
        ) : null}
        {[...(boxes || [])].sort((a, b) => (a.z || 0) - (b.z || 0)).map((b) => (
          <BoxFrame key={b.id} box={b} selected={selBox === b.id} multi={!!selSet && selSet.has(b.id) && b.id !== selBox} editing={editingId === b.id} canvasRef={canvasRef} unit={unit || "mm"} pageW={W} pageH={H}
            hasCond={!!b.showIf} condHidden={!!b.showIf && !boxShows(b, data)}
            bandLabel={b.band ? (b.band.source === "linhas" ? `🔁 ×${bandCollection("linhas", data).length} (linha)` : `🔁 ×${bandCollection("etapas", data).length} (etapa)`) : undefined}
            others={(boxes || []).filter((x) => x.id !== b.id)} onGuides={setGuides}
            groupMove={!!selSet && selSet.has(b.id) && selSet.size > 1} onGroupStart={onGroupStart} onGroupMove={onGroupMove}
            onSelect={(additive) => onSelect(b.id, additive)}
            onStartEdit={() => { if (b.type === "TEXT") { setEditingId(b.id); onEditStart?.(b.id); } }}
            onChange={onChange} onCommit={onCommit}>
            <BoxContent box={b} data={data} branding={branding} editingText={editingId === b.id} onEditText={(id, html) => onChange({ ...b, html })} onEditCommit={onCommit} editor />
          </BoxFrame>
        ))}
        {/* Guias inteligentes (snap ao arrastar) — linha magenta; nao imprime */}
        {guides.map((g, i) => g.o === "v" ? (
          <div key={`g${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${(g.p / W) * 100}%`, width: 1, background: "#e11d8f", pointerEvents: "none", zIndex: 50 }} />
        ) : (
          <div key={`g${i}`} style={{ position: "absolute", left: 0, right: 0, top: `${(g.p / H) * 100}%`, height: 1, background: "#e11d8f", pointerEvents: "none", zIndex: 50 }} />
        ))}
        {(!boxes || boxes.length === 0) ? <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontStyle: "italic" }}>Use a aba Inserir pra adicionar caixas (texto, imagem, bloco).</div> : null}
      </div>
    </div>
  );
}

function renderPageContent(page: ReportPage, data: BudgetReportData, branding?: ReportBranding | null) {
  // Composicao por cards: se a pagina tem pageConfig.nodes, renderiza a arvore (independe do tipo).
  const nodes = page.pageConfig && (page.pageConfig as any).nodes;
  if (Array.isArray(nodes) && nodes.length) return <CompositionNodes nodes={nodes} data={data} branding={branding} />;
  if (page.type === "FIXED") return <FixedBlock html={page.htmlContent || ""} data={data} />;
  return renderBlockByType(page.dynamicType, data, page.pageConfig, branding);
}

// ── CSS (bíblia de impressao + estilo do relatorio) ──────────────────────────
const REPORT_CSS = `
/* Pagina A4 (tela e print) */
#budget-pdf-area .report-page {
  width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 12mm;
  background: #fff; margin: 0 auto 8mm; box-shadow: 0 1px 10px rgba(0,0,0,.14);
  position: relative; overflow: hidden; color: #0f172a;
  display: flex; flex-direction: column;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11px; line-height: 1.35;
}
#budget-pdf-area .rp-page-body { flex: 1 1 auto; min-height: 0; }
#budget-pdf-area .rp-gheader { border-bottom: 1px solid rgba(100,116,139,.35); padding-bottom: 4px; margin-bottom: 8px; font-size: .9em; }
#budget-pdf-area .rp-gfooter { border-top: 1px solid rgba(100,116,139,.35); padding-top: 4px; margin-top: 8px; font-size: .8em; text-align: center; }
/* Capa */
.rp-cover-header { color:#fff; padding:14mm 12mm; margin:-12mm -12mm 8mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.rp-logo { height:36px; margin-bottom:8px; }
.rp-cover-title { font-size:24px; font-weight:800; letter-spacing:.04em; }
.rp-cover-code { opacity:.85; margin-top:4px; font-size:12px; }
.rp-cover-body { display:flex; flex-direction:column; gap:10mm; }
.rp-label { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; }
.rp-client-name { font-size:18px; font-weight:700; }
.rp-muted { color:#64748b; }
.rp-cover-dims { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.rp-dim { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; }
.rp-dim-k { font-size:10px; color:#64748b; }
.rp-dim-v { font-size:15px; font-weight:700; }
.rp-cover-total { display:flex; justify-content:space-between; align-items:center; border:2px solid; border-radius:10px; padding:12px 16px; font-size:16px; }
/* Produtos por etapa */
.rp-section-banner { color:#fff; font-weight:700; letter-spacing:.05em; padding:6px 12px; border-radius:6px; margin-bottom:8px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.rp-group { margin-bottom:10px; }
.rp-group-title { font-weight:700; font-size:13px; color:#1e3a8a; border-bottom:2px solid #e2e8f0; padding-bottom:3px; margin-bottom:5px; }
.rp-table { width:100%; border-collapse:collapse; }
.rp-table th, .rp-table td { padding:4px 6px; border-bottom:1px solid #eef2f7; text-align:left; }
.rp-th-qty,.rp-td-qty,.rp-th-val,.rp-td-val { text-align:right; white-space:nowrap; }
.rp-table thead th { font-size:10px; text-transform:uppercase; color:#64748b; border-bottom:1px solid #cbd5e1; }
.rp-slot { color:#94a3b8; }
.rp-imgs { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.rp-fig { width:34mm; margin:0; text-align:center; }
.rp-prod-img { width:34mm; height:26mm; object-fit:cover; border:1px solid #e2e8f0; border-radius:6px; }
.rp-fig figcaption { font-size:9px; color:#64748b; margin-top:2px; }
.rp-empty,.rp-todo { color:#94a3b8; font-style:italic; padding:8px 0; }
/* Resumo */
.rp-totals { margin-top:10px; max-width:62mm; margin-left:auto; }
.rp-total-row { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #eef2f7; }
.rp-total-grand { border-top:2px solid #1e3a8a; border-bottom:0; font-size:15px; font-weight:800; color:#1e3a8a; padding-top:6px; }
/* Termos */
.rp-terms-text p { margin:0 0 6px; }
.rp-term-item { margin-top:8px; }
.rp-term-k { font-size:11px; font-weight:700; color:#1e3a8a; }
.rp-term-v { white-space:pre-wrap; }
/* Galeria */
.rp-gallery-grid { display:grid; gap:8px; margin-top:8px; }
.rp-gfig { margin:0; text-align:center; }
.rp-gimg { width:100%; height:42mm; object-fit:cover; border:1px solid #e2e8f0; border-radius:8px; }
.rp-gfig figcaption { font-size:9px; color:#64748b; margin-top:3px; }
/* Composicao por cards (arvore aninhavel) */
.rp-node-card { margin-bottom:8px; }
.rp-node-row { display:flex; margin-bottom:8px; }
.rp-node-row > * { min-width:0; flex:1 1 0; }
.rp-node-block { min-width:0; }
.rp-node-card:last-child, .rp-node-row:last-child, .rp-node-block:last-child { margin-bottom:0; }

/* ── IMPRESSAO (bíblia: display:none, A4, color-adjust) ── */
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { margin:0; padding:0; background:#fff; }
  html.printing-mode body > *:not(.pdf-clone-container) { display:none !important; }
  html.printing-mode .pdf-clone-container { position:static; width:100%; margin:0; padding:0; background:#fff; display:block; }
  html.printing-mode #budget-pdf-clone { width:100%; min-height:0; height:auto; box-shadow:none; border:0; display:block; }
  html.printing-mode #budget-pdf-clone .report-page {
    width:100%; min-height:0; box-shadow:none; margin:0; padding:12mm;
    page-break-after:always; break-after:page;
  }
  html.printing-mode #budget-pdf-clone .report-page:last-child { page-break-after:auto; break-after:auto; }
  .avoid-break { page-break-inside:avoid; break-inside:avoid; }
  tr { page-break-inside:avoid; }
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`;

// ── Componente ───────────────────────────────────────────────────────────────
export default function BudgetReport({ data, layout, editable, selectedPageId, onSelectPage }: { data: BudgetReportData; layout: ReportLayout; editable?: boolean; selectedPageId?: string | null; onSelectPage?: (id: string) => void }) {
  const branding = layout.branding;
  const pages = [...(layout.pages || [])]
    .filter((p) => pageShows(p, data))
    .sort((a, b) => a.order - b.order);
  // Estilo global (branding) aplicado a TODA pagina: fonte, tamanho, cor, fundo.
  const pageStyle = {
    fontFamily: branding?.fontFamily || undefined,
    fontSize: branding?.fontSizePt ? `${branding.fontSizePt}pt` : undefined,
    color: branding?.textColor || undefined,
    background: branding?.bgType === "gradient"
      ? `linear-gradient(135deg, ${branding?.bgColor || "#ffffff"}, ${branding?.bgColor2 || "#e2e8f0"})`
      : (branding?.bgColor || undefined),
  };
  const header = branding?.headerHtml?.trim();
  const footer = branding?.footerHtml?.trim();
  // Orientacao (paisagem) + margem da pagina: override por cima do REPORT_CSS (portrait/12mm).
  const marginMm = branding?.pageMarginMm;
  const extraCss =
    (branding?.orientation === "landscape"
      ? `@page { size: A4 landscape; } #budget-pdf-area .report-page { width: 297mm; min-height: 200mm; }`
      : "") +
    (marginMm != null && marginMm >= 0
      ? ` #budget-pdf-area .report-page, html.printing-mode #budget-pdf-clone .report-page { padding: ${marginMm}mm; }`
      : "");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      {extraCss ? <style dangerouslySetInnerHTML={{ __html: extraCss }} /> : null}
      <div id="budget-pdf-area">
        {pages.length === 0 ? (
          <div className="report-page"><div className="rp-empty">Layout sem paginas ativas.</div></div>
        ) : (
          pages.map((page) => {
            // Capa (COVER) e full-bleed: NAO leva cabecalho/rodape. As demais paginas levam o
            // cabecalho global = texto (ex: "Orcamento no: {budgetCode}") a esquerda + LOGO a direita.
            const isCover = page.type === "DYNAMIC" && page.dynamicType === "COVER";
            // Capa em COMPOSICAO (sangria): um card de topo com style.bleed = pagina full-bleed
            // (capa montada por cards) -> tambem NAO leva cabecalho/rodape global.
            const pageNodes = (page as any)?.pageConfig?.nodes;
            const hasBleed = Array.isArray(pageNodes) && pageNodes.some((n: any) => n?.style?.bleed);
            const chrome = !isCover && !hasBleed;
            const hLogo = branding?.headerLogo !== false && !!branding?.logoUrl;   // cabecalho: default ON
            const fLogo = !!branding?.logoFooter && !!branding?.logoUrl;           // rodape: default OFF
            const showHeader = chrome && (!!header || hLogo);
            const showFooter = chrome && (!!footer || fLogo);
            // Pagina CANVAS (caixas livres): sem cabecalho/rodape/padding; altura A4 definida
            // (pra % dos boxes resolver); CanvasPage posiciona os boxes em absoluto.
            const isCanvas = !!(page.pageConfig as any)?.canvas;
            if (isCanvas) {
              const { w: cW, h: cH } = pageDims(branding);
              // Fundo POR PAGINA (pageConfig.bg/bgType/bgColor2); cai pro fundo global so se a pagina nao definir.
              const pc = page.pageConfig as any;
              const cbg = pc?.bgType === "gradient"
                ? `linear-gradient(135deg, ${pc.bg || "#ffffff"}, ${pc.bgColor2 || "#e2e8f0"})`
                : (pc?.bg || (pageStyle as any).background || "#ffffff");
              return (
                <div className="report-page rp-canvas-page" key={page.id}
                  id={editable ? `rp-page-${page.id}` : undefined}
                  style={{ ...pageStyle, background: cbg, padding: 0, position: "relative", width: `${cW}mm`, height: `${cH}mm`, minHeight: `${cH}mm`, overflow: "hidden",
                    ...(editable ? { cursor: "pointer", outline: selectedPageId === page.id ? "3px solid #06b6d4" : undefined, outlineOffset: "3px" } : {}) }}
                  onClick={editable && onSelectPage ? () => onSelectPage(page.id) : undefined}>
                  <CanvasPage boxes={(page.pageConfig as any).boxes || []} data={data} branding={branding} unit={pc?.unit === "mm" ? "mm" : "%"} />
                  {/* Cabecalho/Rodape (faixas de caixas) — INDEPENDENTES por pagina (noHeader/noFooter; noHF legado esconde os 2) */}
                  {!(pc?.noHF || pc?.noHeader) && Array.isArray((branding as any)?.headerBoxes) && (branding as any).headerBoxes.length ? (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${(branding as any)?.headerHmm ?? 18}mm`, overflow: "hidden" }}>
                      <CanvasPage boxes={(branding as any).headerBoxes} data={data} branding={branding} unit={(branding as any)?.hfUnit === "mm" ? "mm" : "%"} />
                    </div>
                  ) : null}
                  {!(pc?.noHF || pc?.noFooter) && Array.isArray((branding as any)?.footerBoxes) && (branding as any).footerBoxes.length ? (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(branding as any)?.footerHmm ?? 14}mm`, overflow: "hidden" }}>
                      <CanvasPage boxes={(branding as any).footerBoxes} data={data} branding={branding} unit={(branding as any)?.hfUnit === "mm" ? "mm" : "%"} />
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
            <div className="report-page" key={page.id}
              id={editable ? `rp-page-${page.id}` : undefined}
              style={{ ...pageStyle, ...(editable ? { cursor: "pointer", outline: selectedPageId === page.id ? "3px solid #06b6d4" : undefined, outlineOffset: "3px" } : {}) }}
              onClick={editable && onSelectPage ? () => onSelectPage(page.id) : undefined}>
              {showHeader ? (
                <div className="rp-gheader" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexDirection: branding?.headerLogoSide === "left" ? "row-reverse" : "row" }}>
                  <div dangerouslySetInnerHTML={{ __html: header ? resolvePlaceholders(header, data) : "" }} />
                  {hLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding!.logoUrl!} alt="logo" style={{ height: branding?.logoSizeHeader || 34, objectFit: "contain", flexShrink: 0 }} />
                  ) : null}
                </div>
              ) : null}
              <div className="rp-page-body">{renderPageContent(page, data, branding)}</div>
              {showFooter ? (
                <div className="rp-gfooter" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexDirection: branding?.footerLogoSide === "left" ? "row-reverse" : "row" }}>
                  <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: footer ? resolvePlaceholders(footer, data) : "" }} />
                  {fLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding!.logoUrl!} alt="logo" style={{ height: branding?.logoSizeFooter || 28, objectFit: "contain", flexShrink: 0 }} />
                  ) : null}
                </div>
              ) : null}
            </div>
          );})
        )}
      </div>
    </>
  );
}
