"use client";

/**
 * BudgetReportModal — liga o EngineReporter ao ORCAMENTO REAL.
 * Puxa o layout (PoolPrintLayout do orcamento, por printLayoutId) + mapeia os
 * dados reais do budget -> BudgetReportData -> renderiza <BudgetReport> -> imprime
 * via printViaClone (mesmo padrao dos datasheets: clona #budget-pdf-area pra fora
 * do modal fixed e imprime so o clone).
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { printViaClone } from "@/lib/printViaClone";
import BudgetReport, {
  BudgetReportData,
  ReportLayout,
  ReportPage,
} from "./BudgetReport";

// Layout default quando o orcamento nao tem layout configurado (ou sem paginas).
// Garante que o botao SEMPRE gera um PDF util (Capa + Itens por etapa).
const DEFAULT_PAGES: ReportPage[] = [
  { id: "d-cover", order: 1, type: "DYNAMIC", htmlContent: null, dynamicType: "COVER", pageConfig: null, isConditional: false, conditionRule: null, pageBreak: true, isActive: true },
  { id: "d-prod", order: 2, type: "DYNAMIC", htmlContent: null, dynamicType: "PRODUCTS_BY_SECTION", pageConfig: { showImages: true }, isConditional: false, conditionRule: null, pageBreak: true, isActive: true },
];

function buildReportData(budget: any, sectionLabels: Record<string, string>): BudgetReportData {
  const d = (budget?.poolDimensions ?? {}) as any;
  const items = (budget?.items ?? []).map((it: any) => ({
    poolSection: it.poolSection,
    kind: it.kind,
    description: it.description ?? "",
    slotName: it.slotName ?? null,
    qty: Number(it.qty) || 0,
    unitPriceCents: Number(it.unitPriceCents) || 0,
    totalCents: Number(it.totalCents) || 0,
    imageUrl: it.product?.imageUrl ?? it.service?.imageUrl ?? null,
  }));
  return {
    code: budget?.code ?? "",
    title: budget?.title ?? null,
    clientName: budget?.clientPartner?.name ?? null,
    clientDocument: budget?.clientPartner?.document ?? null,
    dimensions: {
      length: Number(d.length) || 0,
      width: Number(d.width) || 0,
      depth: Number(d.depth) || 0,
      area: Number(d.area) || 0,
      volume: Number(d.volume) || 0,
      perimeter: Number(d.perimeter) || 0,
    },
    subtotalCents: Number(budget?.subtotalCents) || 0,
    discountCents: Number(budget?.discountCents) || 0,
    totalCents: Number(budget?.totalCents) || 0,
    validityDays: budget?.validityDays ?? null,
    items,
    sectionOrder: budget?.sectionOrder ?? [],
    sectionLabels,
  };
}

export default function BudgetReportModal({
  budget,
  sectionLabels,
  open,
  onClose,
}: {
  budget: any;
  sectionLabels: Record<string, string>;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [layout, setLayout] = useState<ReportLayout | null>(null);
  const [loading, setLoading] = useState(false);

  const data = useMemo(() => buildReportData(budget, sectionLabels), [budget, sectionLabels]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let pages: ReportPage[] = [];
        let branding: any = null;
        if (budget?.printLayout?.id) {
          const lay = await api.get<{ branding?: any; pages?: ReportPage[] }>(
            `/pool-print-layouts/${budget.printLayout.id}`,
          );
          branding = lay?.branding ?? null;
          pages = (lay?.pages ?? []).filter((p) => p.isActive);
        }
        if (!cancelled) {
          setLayout({ branding, pages: pages.length ? pages : DEFAULT_PAGES });
        }
      } catch (err: any) {
        // Sem layout / erro -> usa o default pra o relatorio ainda sair.
        if (!cancelled) setLayout({ branding: null, pages: DEFAULT_PAGES });
        toast(err?.payload?.message || "Layout nao encontrado — usando layout padrao.", "info");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, budget?.printLayout?.id, toast]);

  if (!open) return null;

  const usingDefault = layout && layout.pages.some((p) => p.id.startsWith("d-"));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 overflow-hidden">
      {/* Toolbar (escondida no print — body>*:not(.pdf-clone-container) vira display:none) */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 shrink-0">
        <strong className="text-slate-900">🖨️ Relatorio do orcamento</strong>
        <span className="text-xs text-slate-500">{budget?.code}</span>
        {usingDefault ? (
          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            layout padrao (orcamento sem layout configurado)
          </span>
        ) : budget?.printLayout?.name ? (
          <span className="text-[11px] text-slate-600">Layout: {budget.printLayout.name}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => printViaClone({ areaId: "budget-pdf-area", cloneId: "budget-pdf-clone" })}
            disabled={loading || !layout}
            className="rounded-md bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            🖨️ Imprimir PDF
          </button>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
        </div>
      </div>

      {/* Area rolavel com o relatorio A4 */}
      <div className="flex-1 overflow-auto p-4">
        {loading || !layout ? (
          <div className="text-center text-slate-500 py-12">Carregando relatorio...</div>
        ) : (
          <BudgetReport data={data} layout={layout} />
        )}
      </div>
    </div>
  );
}
