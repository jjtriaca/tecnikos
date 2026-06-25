"use client";

/**
 * Sandbox do EngineReporter — /dev/print-test-orcamento (publico, mock, sem backend).
 * Mesmo padrao do /dev/print-test (datasheet solar): permite ver/depurar o relatorio
 * do orcamento + a impressao A4 sem login. Edite os mocks abaixo pra testar layouts.
 */
import BudgetReport, { BudgetReportData, ReportLayout } from "@/components/pool/report/BudgetReport";
import { printViaClone } from "@/lib/printViaClone";

// Imagem mock auto-contida (data-URI SVG) — evita dependencia externa no sandbox.
const mockImg = (label: string, color: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='180'><rect width='240' height='180' fill='${color}'/><text x='120' y='95' font-size='18' fill='white' text-anchor='middle' font-family='sans-serif'>${label}</text></svg>`,
  );

const MOCK_DATA: BudgetReportData = {
  code: "ORCP-00001",
  title: "Piscina Pre moldada",
  clientName: "Anderson da Silva Prado",
  clientDocument: "123.456.789-00",
  dimensions: { length: 7, width: 3, depth: 1.4, area: 28.5, volume: 33.3, perimeter: 20 },
  subtotalCents: 18561520,
  discountCents: 0,
  totalCents: 18705932,
  validityDays: 30,
  sectionOrder: ["CONSTRUCAO", "FILTRO", "CASCATA", "AQUECIMENTO", "ACIONAMENTOS"],
  sectionLabels: {
    CONSTRUCAO: "Construcao",
    FILTRO: "Filtragem",
    CASCATA: "Cascata",
    AQUECIMENTO: "Aquecimento",
    ACIONAMENTOS: "Acionamentos eletricos",
  },
  items: [
    { poolSection: "CONSTRUCAO", kind: "PRODUCT", description: "Kit piscina pre-moldada 7x3", qty: 1, unitPriceCents: 9800000, totalCents: 9800000 },
    { poolSection: "CONSTRUCAO", kind: "SERVICE", description: "Mao de obra de instalacao", slotName: "Servico", qty: 1, unitPriceCents: 3200000, totalCents: 3200000 },
    { poolSection: "FILTRO", kind: "PRODUCT", description: "Conjunto Filtrante 1/2 cv", qty: 1, unitPriceCents: 1850000, totalCents: 1850000, imageUrl: mockImg("Filtro", "#0e7490") },
    // CASCATA com produto + qtd>0 -> entra COM imagem (o coracao da ideia)
    { poolSection: "CASCATA", kind: "PRODUCT", description: "Kit Cascata Inox Embutir 120cm", slotName: "Cascata", qty: 1, unitPriceCents: 1280000, totalCents: 1280000, imageUrl: mockImg("Cascata 120cm", "#0369a1") },
    // item com qty 0 -> NAO entra
    { poolSection: "CASCATA", kind: "PRODUCT", description: "Refletor adicional", qty: 0, unitPriceCents: 45000, totalCents: 0 },
    // Sem Produto -> NAO entra
    { poolSection: "ACIONAMENTOS", kind: "PRODUCT", description: "Sem Produto", qty: 0, unitPriceCents: 0, totalCents: 0 },
    { poolSection: "ACIONAMENTOS", kind: "PRODUCT", description: "Quadro eletrico 24 polos", qty: 1, unitPriceCents: 505760, totalCents: 505760, imageUrl: mockImg("Quadro", "#334155") },
  ],
};

const MOCK_LAYOUT: ReportLayout = {
  name: "Padrao",
  branding: { primaryColor: "#0f172a", accentColor: "#1e3a8a" },
  pages: [
    { id: "p1", order: 1, type: "DYNAMIC", htmlContent: null, dynamicType: "COVER", pageConfig: null, isConditional: false, conditionRule: null, pageBreak: true, isActive: true },
    { id: "p2", order: 2, type: "DYNAMIC", htmlContent: null, dynamicType: "PRODUCTS_BY_SECTION", pageConfig: { showImages: true }, isConditional: false, conditionRule: null, pageBreak: true, isActive: true },
    {
      id: "p3", order: 3, type: "FIXED",
      htmlContent:
        "<h2 style='font-size:18px;font-weight:800;color:#1e3a8a;margin:0 0 8px'>Proposta para {clientName}</h2>" +
        "<p>Orcamento <b>{budgetCode}</b> — piscina de <b>{poolArea} m²</b> ({poolVolume} m³), {poolLength}×{poolWidth} m.</p>" +
        "<p>Validade da proposta: <b>{validityDays} dias</b> · Emitido em {date}.</p>" +
        "<p style='margin-top:14px;font-size:15px'>Valor total: <strong style='color:#1e3a8a'>{budgetTotal}</strong></p>",
      dynamicType: null, pageConfig: null, isConditional: false, conditionRule: null, pageBreak: false, isActive: true,
    },
  ],
};

export default function PrintTestOrcamentoPage() {
  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh", padding: "16px" }}>
      <div
        className="rp-toolbar"
        style={{ maxWidth: "210mm", margin: "0 auto 12px", display: "flex", gap: 8, alignItems: "center" }}
      >
        <strong style={{ color: "#0f172a" }}>Sandbox EngineReporter</strong>
        <span style={{ color: "#64748b", fontSize: 12 }}>(mock, publico — edite os mocks no arquivo)</span>
        <button
          onClick={() => printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })}
          style={{ marginLeft: "auto", background: "#1e3a8a", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}
        >
          🖨️ Imprimir PDF
        </button>
      </div>
      <BudgetReport data={MOCK_DATA} layout={MOCK_LAYOUT} />
    </div>
  );
}
