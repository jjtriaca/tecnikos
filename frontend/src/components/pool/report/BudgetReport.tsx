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
};

export type ReportLayout = {
  id?: string;
  name?: string;
  branding?: ReportBranding | null;
  pages: ReportPage[];
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
  totalCents: number;
  validityDays?: number | null;
  items: ReportItem[];
  /** ordem das etapas (PoolBudget.sectionOrder) */
  sectionOrder?: string[];
  /** mapa chave-da-etapa -> rotulo exibido (SECTION_LABEL + customSections) */
  sectionLabels?: Record<string, string>;
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

function renderPageContent(page: ReportPage, data: BudgetReportData, branding?: ReportBranding | null) {
  if (page.type === "FIXED") return <FixedBlock html={page.htmlContent || ""} data={data} />;
  switch (page.dynamicType) {
    case "COVER":
      return <CoverBlock data={data} branding={branding} />;
    case "PRODUCTS_BY_SECTION":
      return <ProductsBySectionBlock data={data} config={page.pageConfig} />;
    default:
      return <TodoBlock kind={page.dynamicType || "?"} />;
  }
}

// ── CSS (bíblia de impressao + estilo do relatorio) ──────────────────────────
const REPORT_CSS = `
/* Pagina A4 (tela e print) */
#budget-pdf-area .report-page {
  width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 12mm;
  background: #fff; margin: 0 auto 8mm; box-shadow: 0 1px 10px rgba(0,0,0,.14);
  position: relative; overflow: hidden; color: #0f172a;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11px; line-height: 1.35;
}
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
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div id="budget-pdf-area">
        {pages.length === 0 ? (
          <div className="report-page"><div className="rp-empty">Layout sem paginas ativas.</div></div>
        ) : (
          pages.map((page) => (
            <div className="report-page" key={page.id}>
              {renderPageContent(page, data, branding)}
            </div>
          ))
        )}
      </div>
    </>
  );
}
