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
import { BombaDatasheetBlock } from "./HeatingDatasheets";

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
};

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
  imageUrl?: string | null; // produto/servico vinculado (vem do findOne)
};

export type BudgetReportData = {
  code: string;
  title?: string | null;
  clientName?: string | null;
  clientDocument?: string | null;
  dimensions?: {
    length?: number; width?: number; depth?: number;
    area?: number; volume?: number; perimeter?: number;
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

const num = (v: number | undefined | null, casas = 2) =>
  (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas });

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

/** Resolve {placeholders} (mesmas chaves do editor pool/print-layouts). */
function resolvePlaceholders(html: string, data: BudgetReportData): string {
  const d = data.dimensions || {};
  const map: Record<string, string> = {
    "{clientName}": data.clientName || "",
    "{clientDocument}": data.clientDocument || "",
    "{budgetCode}": data.code || "",
    "{budgetTitle}": data.title || "",
    "{budgetTotal}": brl(data.totalCents),
    "{poolLength}": num(d.length),
    "{poolWidth}": num(d.width),
    "{poolDepth}": num(d.depth),
    "{poolArea}": num(d.area),
    "{poolVolume}": num(d.volume),
    "{poolPerimeter}": num(d.perimeter),
    "{validityDays}": String(data.validityDays ?? ""),
    "{date}": new Date().toLocaleDateString("pt-BR"),
  };
  return html.replace(/\{[a-zA-Z]+\}/g, (m) => (m in map ? map[m] : m));
}

// ── Blocos ───────────────────────────────────────────────────────────────────
function CoverBlock({ data, branding }: { data: BudgetReportData; branding?: ReportBranding | null }) {
  const primary = branding?.primaryColor || "#0f172a";
  const accent = branding?.accentColor || "#1e3a8a";
  const d = data.dimensions || {};
  return (
    <div className="rp-cover">
      <div
        className="rp-cover-header"
        style={{ background: `linear-gradient(to right, ${primary}, ${accent})` }}
      >
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="logo" className="rp-logo" />
        ) : null}
        <div className="rp-cover-title">PROPOSTA DE PISCINA</div>
        <div className="rp-cover-code">{data.code}</div>
      </div>
      <div className="rp-cover-body">
        <div className="rp-cover-client">
          <div className="rp-label">Cliente</div>
          <div className="rp-client-name">{data.clientName || "—"}</div>
          {data.clientDocument ? <div className="rp-muted">{data.clientDocument}</div> : null}
        </div>
        <div className="rp-cover-dims">
          {[
            ["Comprimento", `${num(d.length)} m`],
            ["Largura", `${num(d.width)} m`],
            ["Profundidade", `${num(d.depth)} m`],
            ["Area", `${num(d.area)} m²`],
            ["Volume", `${num(d.volume)} m³`],
            ["Perimetro", `${num(d.perimeter)} m`],
          ].map(([k, v]) => (
            <div className="rp-dim" key={k}>
              <div className="rp-dim-k">{k}</div>
              <div className="rp-dim-v">{v}</div>
            </div>
          ))}
        </div>
        <div className="rp-cover-total" style={{ borderColor: accent }}>
          <span>Valor total</span>
          <strong style={{ color: accent }}>{brl(data.totalCents)}</strong>
        </div>
      </div>
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
    case "COVER": return <CoverBlock data={data} branding={branding} />;
    case "PRODUCTS_BY_SECTION": return <ProductsBySectionBlock data={data} config={config} />;
    case "BUDGET_SUMMARY": return <BudgetSummaryBlock data={data} />;
    case "TERMS_CONDITIONS": return <TermsBlock data={data} config={config} />;
    case "PHOTOS_GALLERY": return <PhotosGalleryBlock data={data} config={config} />;
    case "INSTALLMENTS": return <InstallmentsBlock data={data} />;
    case "CUSTOM_TABLE": return <CustomTableBlock config={config} />;
    case "HEATING_BOMBA": return <BombaDatasheetBlock data={data} />;
    case "TEXT": return <FixedBlock html={config?.html || ""} data={data} />;
    case "IMAGE":
      // eslint-disable-next-line @next/next/no-img-element
      return config?.url ? <img src={config.url} alt={config?.alt || ""} style={{ maxWidth: "100%", borderRadius: 6, display: "block" }} /> : <div className="rp-empty">Imagem sem URL.</div>;
    default: return <TodoBlock kind={blockType || "?"} />;
  }
}

// Renderizador RECURSIVO de um no (card/row/block). Cards/rows seguram filhos (aninhamento).
function ReportNodeView({ node, data, branding }: { node: ReportNode; data: BudgetReportData; branding?: ReportBranding | null }) {
  const st = node.style || {};
  if (node.kind === "block") {
    return <div className="rp-node-block" style={{ flex: st.flex || undefined }}>{renderBlockByType(node.blockType, data, node.config, branding)}</div>;
  }
  if (node.kind === "row") {
    return (
      <div className="rp-node-row" style={{ gap: `${st.gap ?? 8}px`, alignItems: (st.align as any) || "stretch", flex: st.flex || undefined }}>
        {(node.children || []).map((c) => <ReportNodeView key={c.id} node={c} data={data} branding={branding} />)}
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
  };
  return <div className="rp-node-card" style={cardStyle}>{(node.children || []).map((c) => <ReportNodeView key={c.id} node={c} data={data} branding={branding} />)}</div>;
}

export function CompositionNodes({ nodes, data, branding }: { nodes: ReportNode[]; data: BudgetReportData; branding?: ReportBranding | null }) {
  return <>{(nodes || []).map((n) => <ReportNodeView key={n.id} node={n} data={data} branding={branding} />)}</>;
}

// Preview de uma composicao (lista de nodes) — usado no modal do editor pra ver ao vivo
// enquanto monta os cards. NAO usa #budget-pdf-area (evita id duplicado com o preview
// principal); as classes .rp-* sao globais (injetadas pelo BudgetReport da pagina). Inclui
// o CSS de novo por seguranca (idempotente). Box A4-ish (210mm) so visual.
export function CompositionPreview({ nodes, data }: { nodes: ReportNode[]; data: BudgetReportData }) {
  return (
    <div style={{ background: "#f1f5f9", padding: "10px", borderRadius: 8, overflow: "auto" }}>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div style={{ width: "190mm", maxWidth: "100%", margin: "0 auto", background: "#fff", padding: "10mm", boxShadow: "0 1px 8px rgba(0,0,0,.12)", color: "#0f172a", fontSize: "11px", lineHeight: 1.35 }}>
        {nodes && nodes.length ? <CompositionNodes nodes={nodes} data={data} /> : <div className="rp-empty">Adicione cards/blocos pra ver aqui.</div>}
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
export default function BudgetReport({ data, layout }: { data: BudgetReportData; layout: ReportLayout }) {
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
          pages.map((page) => (
            <div className="report-page" key={page.id} style={pageStyle}>
              {header ? <div className="rp-gheader" dangerouslySetInnerHTML={{ __html: resolvePlaceholders(header, data) }} /> : null}
              <div className="rp-page-body">{renderPageContent(page, data, branding)}</div>
              {footer ? <div className="rp-gfooter" dangerouslySetInnerHTML={{ __html: resolvePlaceholders(footer, data) }} /> : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}
