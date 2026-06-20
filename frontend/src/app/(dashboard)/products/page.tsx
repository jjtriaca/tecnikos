"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { fmtCurrency } from "@/components/ui/CurrencyInput";
import { FieldLabel } from "@/components/ui/HelpHint";
import FilterBar from "@/components/ui/FilterBar";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import Pagination from "@/components/ui/Pagination";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { FilterDefinition, ColumnDefinition } from "@/lib/types/table";
import type { Product, ProductEquivalent } from "@/types/product";
import { UNIT_OPTIONS, ORIGIN_OPTIONS } from "@/types/product";
import { toTitleCase } from "@/lib/brazil-utils";

/* ── Types ────────────────────────────────────────────── */

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(cents: number | undefined | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseBRLToCents(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function centsToInputStr(cents: number | undefined | null): string {
  if (cents == null || cents === 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function computeMargin(costCents: number, salePriceCents: number): number | null {
  if (!costCents || costCents <= 0) return null;
  return ((salePriceCents - costCents) / costCents) * 100;
}

/* ── Modal Tab type ───────────────────────────────────── */

type ModalTab = "geral" | "impostos" | "margem" | "equivalentes" | "estoque" | "piscina";

const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "impostos", label: "Impostos" },
  { id: "margem", label: "Margem" },
  { id: "equivalentes", label: "Equivalentes" },
  { id: "estoque", label: "Estoque" },
  { id: "piscina", label: "🌊 Piscina" },
];

/* ── Filter definitions ───────────────────────────────── */

// Filtros dinamicos: alguns selects sao alimentados por DISTINCT do backend
// (Categoria, Marca, Tipo Piscina) — buildProductFilters monta o array com as
// opcoes carregadas. Os demais sao estaticos.
function buildProductFilters(opts: {
  categories: string[];
  brands: string[];
  poolTypes: string[];
}): FilterDefinition[] {
  const toOptions = (arr: string[]) => arr.map((v) => ({ value: v, label: v }));
  return [
    {
      key: "poolType",
      label: "Tipo (Piscina)",
      type: "select",
      options: toOptions(opts.poolTypes),
    },
    {
      key: "category",
      label: "Categoria",
      type: "select",
      options: toOptions(opts.categories),
    },
    {
      key: "brand",
      label: "Marca",
      type: "select",
      options: toOptions(opts.brands),
    },
    {
      key: "usage",
      label: "Usado em",
      type: "select",
      options: [
        { value: "sale", label: "Venda" },
        { value: "work", label: "Obra" },
        { value: "both", label: "Venda + Obra" },
      ],
    },
    {
      key: "finalidade",
      label: "Finalidade",
      type: "select",
      options: [
        { value: "USO_CONSUMO", label: "Uso/Consumo" },
        { value: "REVENDA", label: "Revenda" },
        { value: "ATIVO_IMOBILIZADO", label: "Ativo Imobilizado" },
        { value: "MATERIA_PRIMA", label: "Materia Prima" },
        { value: "MATERIAL_OBRA", label: "Material Obra" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ATIVO", label: "Ativo" },
        { value: "INATIVO", label: "Inativo" },
      ],
    },
  ];
}

/* ── Column definitions ───────────────────────────────── */

const FINALIDADE_OPTIONS = [
  { value: "USO_CONSUMO", label: "Uso/Consumo" },
  { value: "REVENDA", label: "Revenda" },
  { value: "ATIVO_IMOBILIZADO", label: "Ativo Imobilizado" },
  { value: "MATERIA_PRIMA", label: "Mat. Prima" },
  { value: "MATERIAL_OBRA", label: "Material Obra" },
];

const FINALIDADE_BADGE: Record<string, string> = {
  USO_CONSUMO: "bg-sky-50 text-sky-700 border-sky-200",
  REVENDA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ATIVO_IMOBILIZADO: "bg-purple-50 text-purple-700 border-purple-200",
  MATERIA_PRIMA: "bg-amber-50 text-amber-700 border-amber-200",
  MATERIAL_OBRA: "bg-orange-50 text-orange-700 border-orange-200",
};

function buildProductColumns(): ColumnDefinition<Product>[] {
  return [
    {
      id: "actions",
      label: "Ações",
      render: () => null as any,
    },
    {
      id: "code",
      label: "Código",
      sortable: true,
      render: (p) => (
        <span className="text-sm font-medium text-slate-900">
          {p.code || "—"}
        </span>
      ),
    },
    {
      id: "description",
      label: "Descricao",
      sortable: true,
      // Padrao Tecnikos: descricao ocupa todo o espaco disponivel da coluna.
      // Se nao couber, trunca proporcional + tooltip 'title' mostra completa no hover.
      // NUNCA usar max-w fixo (forca truncar antes da hora).
      render: (p) => (
        <span className="text-sm text-slate-900 truncate block w-full" title={p.description}>
          {p.description}
        </span>
      ),
    },
    {
      id: "finalidade",
      label: "Finalidade",
      sortable: true,
      sortKey: "finalidade",
      render: (p) => {
        const fin = p.finalidade;
        if (!fin) return <span className="text-sm text-slate-400">—</span>;
        const opt = FINALIDADE_OPTIONS.find((o) => o.value === fin);
        const badge = FINALIDADE_BADGE[fin] || "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badge}`}>
            {opt?.label || fin}
          </span>
        );
      },
    },
    {
      id: "brand",
      label: "Marca",
      sortable: true,
      render: (p) => (
        <span className="text-sm text-slate-700">{p.brand || "—"}</span>
      ),
    },
    {
      id: "unit",
      label: "Unidade",
      sortable: true,
      render: (p) => (
        <span className="text-xs font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
          {p.unit}
        </span>
      ),
    },
    {
      id: "costCents",
      label: "Custo",
      sortable: true,
      align: "right",
      render: (p) => (
        <span className="text-sm text-slate-700">{formatCurrency(p.costCents)}</span>
      ),
    },
    {
      id: "salePriceCents",
      label: "Preco Venda",
      sortable: true,
      align: "right",
      render: (p) => (
        <span className="text-sm font-semibold text-blue-700">
          {formatCurrency(p.salePriceCents)}
        </span>
      ),
    },
    {
      id: "currentStock",
      label: "Estoque",
      sortable: true,
      align: "right",
      render: (p) => {
        const isLow = p.minStock != null && p.currentStock <= p.minStock;
        return (
          <span className={`text-sm font-medium ${isLow ? "text-red-600" : "text-slate-700"}`}>
            {p.currentStock}
            {isLow && (
              <span className="ml-1 text-[10px] text-red-500 font-normal">baixo</span>
            )}
          </span>
        );
      },
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (p) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
            p.status === "ATIVO"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-slate-100 text-slate-500 border-slate-200"
          }`}
        >
          {p.status === "ATIVO" ? "Ativo" : "Inativo"}
        </span>
      ),
    },
  ];
}

/* ══════════════════════════════════════════════════════════
   EMPTY FORM STATE
   ══════════════════════════════════════════════════════════ */

interface ProductForm {
  code: string;
  barcode: string;
  description: string;
  brand: string;
  model: string;
  unit: string;
  ncm: string;
  cest: string;
  origin: string;
  category: string;
  icmsRate: string;
  ipiRate: string;
  pisRate: string;
  cofinsRate: string;
  csosn: string;
  cfop: string;
  cst: string;
  cstPis: string;
  cstCofins: string;
  costCents: string;
  salePriceCents: string;
  finalidade: string;
  minStock: string;
  maxStock: string;
  location: string;
  status: string;
  // Tipo no modulo Piscina (Cascata, Aquecedor, Conjunto de filtragem, etc.)
  // Alimenta dropdown de filtro no AutoSelectModal de orcamento.
  poolType: string;
  // Quantidade padrao ao escolher esse produto numa linha do orcamento de piscina.
  // Vazio = sem padrao (fluxo usa 1). Linha do orcamento fica amarela se qty != defaultQty.
  defaultQty: string;
  // Specs tecnicas (Modulo Piscina) — strings pra inputs, viram numero no payload
  specVazaoM3h: string;       // m³/h (filtros, bombas)
  specTuboEntradaMm: string;  // mm (todos equipamentos hidraulicos — chave do auto-select de tubos)
  // ====== Specs detalhadas do Simulador de Aquecimento (F3+) ======
  specKcalHNominal: string;    // kcal/h nominal (capacidade real, alimenta auto-select preciso)
  specKwNominal: string;       // kW termico (capacidade)
  specBtuH: string;            // BTU/h (capacidade)
  // Vazao de agua que a bomba de calor exige no trocador (janela min/max). Usada pra
  // selecionar a bomba de circulacao pela curva (vazao alvo dentro de [min, max]).
  specVazaoMinM3h: string;     // m3/h vazao minima de agua na bomba de calor
  specVazaoMaxM3h: string;     // m3/h vazao maxima de agua na bomba de calor
  specRatedInputPowerKW: string; // kW consumo eletrico medio (em 15°C ambiente)
  specCopMax: string;          // COP maximo em condicao ideal (marketing — ar 26°C, carga baixa)
  specCopAt50Air26: string;    // COP em 50% carga, ar 26°C (verao tipico)
  specCopAt50Air15: string;    // COP em 50% carga, ar 15°C (inverno BR — usado no calculo)
  // Coeficientes do polinomio COP(carga) = A·x² + B·x + C (TAB006 Tholz)
  specCopCurveA: string;
  specCopCurveB: string;
  specCopCurveC: string;
  // Coletor Solar — specs alinhadas com etiqueta Procel/Inmetro PBE Coletor Piscina
  // - areaM2 / kwhPorM2 / eficiencia alimentam o motor (solar.service.ts)
  // - classe / pressao / material sao informativos (vao pro PDF do orcamento)
  specColetorAreaM2: string;         // m² (Area externa do coletor — Procel)
  specKwhPorM2: string;              // kWh/mes·m² (Producao Especifica PMEe — Procel)
  specEficiencia: string;            // UI em % (0..100); storage como fracao 0..1
  specClasseEficiencia: string;      // 'A'..'E' (Classificacao PBE — Procel)
  specPressaoFuncionamentokPa: string; // kPa (Pressao de Funcionamento — Procel)
  // Trocador de Calor — specs que alimentam a aba Trocador do Simulador.
  // Capacidade reusa o campo "Kcal/h nominal" acima (kcalHNominal).
  specTrocadorMaterial: string;        // 'INOX' | 'TITANIO' | '' (informativo + resistencia)
  specTrocadorEficiencia: string;      // UI em % (0..100); storage como fracao 0..1 (eficiencia de troca)
  specTrocadorVazaoPrimariaM3h: string;   // m³/h lado quente (caldeira / bomba de calor)
  specTrocadorVazaoSecundariaM3h: string; // m³/h lado piscina (alvo da bomba secundaria)
  specTrocadorPerdaCargaMca: string;   // mca — perda de carga interna do trocador (entra no MCA)
  specTrocadorPressaoMaxMca: string;   // mca — pressao maxima de trabalho do lado primario
  // Specs especificas por tipo de equipamento (F6.2 — agregadas pelo Simulador)
  specQtdJatos: string;            // Hidromassagem/SPA — qtde de jatos do kit
  specCascataComprimentoCm: string; // Cascata — comprimento do bocal em cm
  specBordaAlturaQuedaM: string;    // Borda Infinita — altura da queda d'agua
  specBordaVazaoLminPorM: string;   // Borda Infinita — vazao de transbordamento
  specBordaHorasAtivaDia: string;   // Borda Infinita — horas/dia que a bomba fica ativa
  // =================================================================
  specPotenciaCv: string;     // CV (motores)
  specPotenciaWatts: string;  // W (refletores/iluminacao) — Fonte 12V le potenciaWatts
  specVoltagem: string;       // V (eletricos)
  specAmperagem: string;      // A (eletricos)
  specBifTrif: string;        // 'Bif' | 'Trif' | '' (tipo eletrico)
  specBifTrifConta: string;   // numero — quantos espacos ocupa no quadro de distribuicao
  specTempoMontagemH: string; // horas — tempo padrao de montagem/instalacao do equipamento
  specPressaoTrabalhoMca: string; // MCA (metros de coluna d'agua) — pressao maxima de trabalho da bomba
  linkedServiceId: string;    // Servico vinculado (instalacao/montagem). Vazio = sem vinculo.
  pumpCurve: Array<{ vazaoM3h: string; alturaMca: string }>; // Curva caracteristica da bomba (pares vazao, altura)
}

const EMPTY_FORM: ProductForm = {
  code: "",
  barcode: "",
  description: "",
  brand: "",
  model: "",
  unit: "UN",
  ncm: "",
  cest: "",
  origin: "0",
  category: "",
  icmsRate: "",
  ipiRate: "",
  pisRate: "",
  cofinsRate: "",
  csosn: "",
  cfop: "",
  cst: "",
  cstPis: "",
  cstCofins: "",
  costCents: "",
  salePriceCents: "",
  finalidade: "",
  minStock: "",
  maxStock: "",
  location: "",
  status: "ATIVO",
  poolType: "",
  defaultQty: "1",
  specVazaoM3h: "",
  specTuboEntradaMm: "",
  specKcalHNominal: "",
  specKwNominal: "",
  specBtuH: "",
  specVazaoMinM3h: "",
  specVazaoMaxM3h: "",
  specRatedInputPowerKW: "",
  specCopMax: "",
  specCopAt50Air26: "",
  specCopAt50Air15: "",
  specCopCurveA: "",
  specCopCurveB: "",
  specCopCurveC: "",
  specColetorAreaM2: "",
  specKwhPorM2: "",
  specEficiencia: "",
  specClasseEficiencia: "",
  specPressaoFuncionamentokPa: "",
  specTrocadorMaterial: "",
  specTrocadorEficiencia: "",
  specTrocadorVazaoPrimariaM3h: "",
  specTrocadorVazaoSecundariaM3h: "",
  specTrocadorPerdaCargaMca: "",
  specTrocadorPressaoMaxMca: "",
  specQtdJatos: "",
  specCascataComprimentoCm: "",
  specBordaAlturaQuedaM: "",
  specBordaVazaoLminPorM: "",
  specBordaHorasAtivaDia: "",
  specPotenciaCv: "",
  specPotenciaWatts: "",
  specVoltagem: "",
  specAmperagem: "",
  specBifTrif: "",
  specBifTrifConta: "",
  specTempoMontagemH: "",
  specPressaoTrabalhoMca: "",
  linkedServiceId: "",
  pumpCurve: [],
};

function productToForm(p: Product): ProductForm {
  return {
    code: p.code || "",
    barcode: p.barcode || "",
    description: p.description,
    brand: p.brand || "",
    model: p.model || "",
    unit: p.unit,
    ncm: p.ncm || "",
    cest: p.cest || "",
    origin: p.origin || "0",
    category: p.category || "",
    icmsRate: p.icmsRate != null ? String(p.icmsRate) : "",
    ipiRate: p.ipiRate != null ? String(p.ipiRate) : "",
    pisRate: p.pisRate != null ? String(p.pisRate) : "",
    cofinsRate: p.cofinsRate != null ? String(p.cofinsRate) : "",
    csosn: p.csosn || "",
    cfop: p.cfop || "",
    cst: p.cst || "",
    cstPis: p.cstPis || "",
    cstCofins: p.cstCofins || "",
    costCents: centsToInputStr(p.costCents),
    salePriceCents: centsToInputStr(p.salePriceCents),
    finalidade: p.finalidade || "",
    minStock: p.minStock != null ? String(p.minStock) : "",
    maxStock: p.maxStock != null ? String(p.maxStock) : "",
    location: p.location || "",
    status: p.status,
    poolType: (p as any).poolType || "",
    defaultQty: (p as any).defaultQty != null ? String((p as any).defaultQty) : "",
    specVazaoM3h: numericSpecToStr(p.technicalSpecs?.vazaoM3h),
    specTuboEntradaMm: numericSpecToStr(p.technicalSpecs?.tuboEntradaMm),
    specKcalHNominal: numericSpecToStr(p.technicalSpecs?.kcalHNominal),
    specKwNominal: numericSpecToStr(p.technicalSpecs?.kwNominal),
    specBtuH: numericSpecToStr(p.technicalSpecs?.btuH),
    specVazaoMinM3h: numericSpecToStr(p.technicalSpecs?.vazaoMinM3h),
    specVazaoMaxM3h: numericSpecToStr(p.technicalSpecs?.vazaoMaxM3h),
    specRatedInputPowerKW: numericSpecToStr(p.technicalSpecs?.ratedInputPowerKW),
    specCopMax: numericSpecToStr(p.technicalSpecs?.copMax),
    specCopAt50Air26: numericSpecToStr(p.technicalSpecs?.copAt50Air26),
    specCopAt50Air15: numericSpecToStr(p.technicalSpecs?.copAt50Air15),
    specCopCurveA: numericSpecToStr(p.technicalSpecs?.copCurveA),
    specCopCurveB: numericSpecToStr(p.technicalSpecs?.copCurveB),
    specCopCurveC: numericSpecToStr(p.technicalSpecs?.copCurveC),
    specColetorAreaM2: numericSpecToStr(p.technicalSpecs?.areaM2 ?? p.technicalSpecs?.coletorAreaM2),
    specKwhPorM2: numericSpecToStr(p.technicalSpecs?.kwhPorM2 ?? p.technicalSpecs?.kwhM2),
    specClasseEficiencia: typeof p.technicalSpecs?.classeEficiencia === 'string' ? p.technicalSpecs.classeEficiencia : "",
    specPressaoFuncionamentokPa: numericSpecToStr(p.technicalSpecs?.pressaoFuncionamentokPa),
    specTrocadorMaterial: typeof p.technicalSpecs?.trocadorMaterial === 'string' ? p.technicalSpecs.trocadorMaterial : "",
    specTrocadorVazaoPrimariaM3h: numericSpecToStr(p.technicalSpecs?.vazaoPrimariaM3h),
    specTrocadorVazaoSecundariaM3h: numericSpecToStr(p.technicalSpecs?.vazaoSecundariaM3h),
    specTrocadorPerdaCargaMca: numericSpecToStr(p.technicalSpecs?.perdaCargaTrocadorMca),
    specTrocadorPressaoMaxMca: numericSpecToStr(p.technicalSpecs?.pressaoMaxTrocadorMca),
    // Eficiencia de troca do trocador: fracao 0..1 → UI em %. Ex: 0.85 → "85"
    specTrocadorEficiencia: (() => {
      const v = p.technicalSpecs?.trocadorEficiencia;
      if (v == null) return "";
      const n = Number(v);
      if (!Number.isFinite(n)) return "";
      return String(Math.round(n * 1000) / 10);
    })(),
    // Eficiencia: storage como fracao 0..1 → UI em % (0..100). Ex: 0.732 → "73.2"
    specEficiencia: (() => {
      const v = p.technicalSpecs?.eficiencia;
      if (v == null) return "";
      const n = Number(v);
      if (!Number.isFinite(n)) return "";
      return String(Math.round(n * 1000) / 10); // 0.732 → 73.2
    })(),
    specQtdJatos: numericSpecToStr(p.technicalSpecs?.qtdJatos),
    specCascataComprimentoCm: numericSpecToStr(p.technicalSpecs?.cascataComprimentoCm),
    specBordaAlturaQuedaM: numericSpecToStr(p.technicalSpecs?.bordaAlturaQuedaM),
    specBordaVazaoLminPorM: numericSpecToStr(p.technicalSpecs?.bordaVazaoLminPorM),
    specBordaHorasAtivaDia: numericSpecToStr(p.technicalSpecs?.bordaHorasAtivaDia),
    specPotenciaCv: numericSpecToStr(p.technicalSpecs?.potenciaCv),
    specPotenciaWatts: numericSpecToStr(p.technicalSpecs?.potenciaWatts),
    specVoltagem: numericSpecToStr(p.technicalSpecs?.voltagem),
    specAmperagem: numericSpecToStr(p.technicalSpecs?.amperagem),
    specBifTrif: typeof p.technicalSpecs?.bifTrif === 'string' ? p.technicalSpecs.bifTrif : "",
    specBifTrifConta: numericSpecToStr(p.technicalSpecs?.bifTrifConta),
    specTempoMontagemH: numericSpecToStr(p.technicalSpecs?.tempoMontagemH),
    specPressaoTrabalhoMca: numericSpecToStr(p.technicalSpecs?.pressaoTrabalhoMca),
    linkedServiceId: (p as any).linkedServiceId ?? "",
    pumpCurve: Array.isArray((p as any).pumpCurve)
      ? (p as any).pumpCurve.map((pt: any) => ({
          vazaoM3h: pt?.vazaoM3h != null ? String(pt.vazaoM3h) : "",
          alturaMca: pt?.alturaMca != null ? String(pt.alturaMca) : "",
        }))
      : [],
  };
}

function numericSpecToStr(v: unknown): string {
  if (v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

// Monta o objeto technicalSpecs a partir dos campos do form. Preserva chaves
// existentes (ex: campos seedados da planilha que nao temos no form ainda — eficiencia,
// bifTrifConta, etc) — so atualiza as que aparecem como inputs.
function buildTechnicalSpecs(f: ProductForm, existing?: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...(existing || {}) };
  const setOrUnset = (key: string, raw: string) => {
    if (raw.trim() === "") {
      delete merged[key];
    } else {
      const n = parseFloat(raw.replace(",", "."));
      if (Number.isFinite(n)) merged[key] = n;
    }
  };
  setOrUnset("vazaoM3h", f.specVazaoM3h);
  setOrUnset("tuboEntradaMm", f.specTuboEntradaMm);
  setOrUnset("kcalHNominal", f.specKcalHNominal);
  setOrUnset("kwNominal", f.specKwNominal);
  setOrUnset("btuH", f.specBtuH);
  setOrUnset("vazaoMinM3h", f.specVazaoMinM3h);
  setOrUnset("vazaoMaxM3h", f.specVazaoMaxM3h);
  setOrUnset("ratedInputPowerKW", f.specRatedInputPowerKW);
  setOrUnset("copMax", f.specCopMax);
  setOrUnset("copAt50Air26", f.specCopAt50Air26);
  setOrUnset("copAt50Air15", f.specCopAt50Air15);
  setOrUnset("copCurveA", f.specCopCurveA);
  setOrUnset("copCurveB", f.specCopCurveB);
  setOrUnset("copCurveC", f.specCopCurveC);
  setOrUnset("areaM2", f.specColetorAreaM2);
  setOrUnset("kwhPorM2", f.specKwhPorM2);
  setOrUnset("pressaoFuncionamentokPa", f.specPressaoFuncionamentokPa);
  // classeEficiencia eh string — salva direto ou remove se vazio
  if (f.specClasseEficiencia.trim()) merged.classeEficiencia = f.specClasseEficiencia.trim().toUpperCase();
  else delete merged.classeEficiencia;
  // Eficiencia: UI em % → storage como fracao 0..1. Ex: 73.2 → 0.732
  if (f.specEficiencia.trim() === "") {
    delete merged.eficiencia;
  } else {
    const pct = parseFloat(f.specEficiencia.replace(",", "."));
    if (Number.isFinite(pct)) merged.eficiencia = Math.round(pct * 10) / 1000; // 73.2 → 0.732
  }
  // Trocador de Calor
  setOrUnset("vazaoPrimariaM3h", f.specTrocadorVazaoPrimariaM3h);
  setOrUnset("vazaoSecundariaM3h", f.specTrocadorVazaoSecundariaM3h);
  setOrUnset("perdaCargaTrocadorMca", f.specTrocadorPerdaCargaMca);
  setOrUnset("pressaoMaxTrocadorMca", f.specTrocadorPressaoMaxMca);
  // trocadorMaterial eh string (INOX/TITANIO/'')
  if (f.specTrocadorMaterial.trim() === "") delete merged.trocadorMaterial;
  else merged.trocadorMaterial = f.specTrocadorMaterial.trim().toUpperCase();
  // trocadorEficiencia: UI em % → storage como fracao 0..1. Ex: 85 → 0.85
  if (f.specTrocadorEficiencia.trim() === "") {
    delete merged.trocadorEficiencia;
  } else {
    const tpct = parseFloat(f.specTrocadorEficiencia.replace(",", "."));
    if (Number.isFinite(tpct)) merged.trocadorEficiencia = Math.round(tpct * 10) / 1000;
  }
  setOrUnset("qtdJatos", f.specQtdJatos);
  setOrUnset("cascataComprimentoCm", f.specCascataComprimentoCm);
  setOrUnset("bordaAlturaQuedaM", f.specBordaAlturaQuedaM);
  setOrUnset("bordaVazaoLminPorM", f.specBordaVazaoLminPorM);
  setOrUnset("bordaHorasAtivaDia", f.specBordaHorasAtivaDia);
  setOrUnset("potenciaCv", f.specPotenciaCv);
  setOrUnset("potenciaWatts", f.specPotenciaWatts);
  setOrUnset("voltagem", f.specVoltagem);
  setOrUnset("amperagem", f.specAmperagem);
  setOrUnset("bifTrifConta", f.specBifTrifConta);
  setOrUnset("tempoMontagemH", f.specTempoMontagemH);
  setOrUnset("pressaoTrabalhoMca", f.specPressaoTrabalhoMca);
  // bifTrif eh string (Bif/Trif/'') — nao usa setOrUnset que so trata numeros
  if (f.specBifTrif.trim() === "") {
    delete merged.bifTrif;
  } else {
    merged.bifTrif = f.specBifTrif.trim();
  }
  return merged;
}

function formToPayload(f: ProductForm, existingSpecs?: Record<string, any>) {
  return {
    code: f.code || undefined,
    barcode: f.barcode || undefined,
    description: f.description,
    brand: f.brand || undefined,
    // `|| undefined` apagava o "limpar campo": "" virava undefined e o Prisma ignorava
    // (campo nunca zerava). `?? null` envia null explicito -> backend grava null -> limpa.
    model: f.model?.trim() || null,
    unit: f.unit,
    ncm: f.ncm || undefined,
    cest: f.cest || undefined,
    origin: f.origin || undefined,
    category: f.category || undefined,
    icmsRate: f.icmsRate ? parseFloat(f.icmsRate) : undefined,
    ipiRate: f.ipiRate ? parseFloat(f.ipiRate) : undefined,
    pisRate: f.pisRate ? parseFloat(f.pisRate) : undefined,
    cofinsRate: f.cofinsRate ? parseFloat(f.cofinsRate) : undefined,
    csosn: f.csosn || undefined,
    cfop: f.cfop || undefined,
    cst: f.cst || undefined,
    cstPis: f.cstPis || undefined,
    cstCofins: f.cstCofins || undefined,
    costCents: f.costCents ? parseBRLToCents(f.costCents) : undefined,
    salePriceCents: f.salePriceCents ? parseBRLToCents(f.salePriceCents) : undefined,
    finalidade: f.finalidade || undefined,
    minStock: f.minStock ? parseInt(f.minStock, 10) : undefined,
    maxStock: f.maxStock ? parseInt(f.maxStock, 10) : undefined,
    location: f.location || undefined,
    status: f.status,
    // Tipo no modulo Piscina (Cascata, Aquecedor, etc.) — campo top-level, indexado.
    // Alimenta dropdown de filtro do AutoSelectModal de orcamento de piscina.
    poolType: f.poolType.trim() || undefined,
    // Quantidade padrao no orcamento de piscina. Vazio = sem padrao (fluxo usa 1).
    defaultQty: f.defaultQty.trim() === "" ? null : parseFloat(f.defaultQty.replace(",", ".")),
    // Servico vinculado (instalacao/montagem). Vazio = sem vinculo. null limpa vinculo.
    linkedServiceId: f.linkedServiceId || null,
    // Curva da bomba — filtra pontos vazios, converte pra numero. Array vazio = sem curva.
    pumpCurve: (() => {
      const pts = (f.pumpCurve || [])
        .map((p) => ({
          vazaoM3h: parseFloat(String(p.vazaoM3h).replace(",", ".")),
          alturaMca: parseFloat(String(p.alturaMca).replace(",", ".")),
        }))
        .filter((p) => Number.isFinite(p.vazaoM3h) && Number.isFinite(p.alturaMca))
        .sort((a, b) => a.alturaMca - b.alturaMca);
      return pts.length > 0 ? pts : null;
    })(),
    // Inclui technicalSpecs no payload. Preserva chaves existentes que nao
    // tem input no form (eficiencia, bifTrifConta, multiplicador, etc seedadas
    // da planilha) — so atualiza as chaves expostas como inputs.
    technicalSpecs: buildTechnicalSpecs(f, existingSpecs),
  };
}

/* ══════════════════════════════════════════════════════════
   ACTIONS DROPDOWN
   ══════════════════════════════════════════════════════════ */

function ActionsDropdown({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 100;
      const fitsBelow = rect.bottom + menuHeight < window.innerHeight;
      setPos({
        top: fitsBelow ? rect.bottom + 4 : rect.top - menuHeight - 4,
        left: Math.max(8, rect.right - 168),
      });
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <div ref={wrapperRef}>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          className="fixed z-50 min-w-[168px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
          style={{ top: pos.top, left: pos.left }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit(product);
            }}
            className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete(product);
            }}
            className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function ProductsPage() {
  const tp = useTableParams({ defaultSortBy: "description", defaultSortOrder: "asc" });
  const columns = buildProductColumns();
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout(
    "products-v2",
    columns,
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  // Tipos de produto Piscina ja cadastrados (alimenta datalist do dropdown
  // "Tipo (Piscina)" no formulario de cadastro).
  const [poolTypes, setPoolTypes] = useState<string[]>([]);
  const [showPoolTypesManager, setShowPoolTypesManager] = useState(false);
  // Mapa tipo → campos obrigatorios. Carregado de /pool-types/manage. Usado pra
  // (1) marcar asterisco vermelho nos campos obrigatorios; (2) auto-expandir
  // CollapsibleCards que tem ao menos 1 campo obrigatorio; (3) validar antes do
  // submit (backend tambem valida).
  const [poolTypeRequiredMap, setPoolTypeRequiredMap] = useState<Record<string, string[]>>({});

  // Servicos do tenant que podem ser vinculados ao produto (modulo Piscina).
  // Carregado 1x no mount. Usado no select "Servico vinculado" do form. v1.12.22.
  const [linkableServices, setLinkableServices] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);

  // Recarrega pool types + mapa de obrigatorios — chamado depois de CRUD no
  // modal de gerenciamento pra refletir mudancas no datalist e no form atual.
  const reloadPoolTypes = useCallback(async () => {
    try {
      const [list, manage] = await Promise.all([
        api.get<string[]>("/products/pool-types"),
        api.get<Array<{ name: string; requiredFields: string[] }>>("/products/pool-types/manage").catch(() => []),
      ]);
      setPoolTypes(Array.isArray(list) ? list : []);
      const map: Record<string, string[]> = {};
      for (const row of manage ?? []) {
        if (row.requiredFields?.length) map[row.name] = row.requiredFields;
      }
      setPoolTypeRequiredMap(map);
    } catch {
      setPoolTypes([]);
      setPoolTypeRequiredMap({});
    }
  }, []);
  // Opcoes pros filtros da lista (DISTINCT do backend).
  const [filterOptions, setFilterOptions] = useState<{ categories: string[]; brands: string[]; poolTypes: string[] }>({ categories: [], brands: [], poolTypes: [] });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  // v1.12.32.1: modal arrastavel pelo header. Reseta posicao quando reabre.
  const [modalDragPos, setModalDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const modalDragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [modalDragging, setModalDragging] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("geral");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>({ ...EMPTY_FORM });
  // Capacidade (kcal/h · kW · BTU/h) = mesmo valor em 3 unidades. Ligado: preenche um -> os
  // outros se auto-completam pela conversao. Operador desmarca pra editar individual.
  const [autoSyncCapacity, setAutoSyncCapacity] = useState(true);
  const [saving, setSaving] = useState(false);

  // Equivalents state (within modal)
  const [equivalents, setEquivalents] = useState<ProductEquivalent[]>([]);
  const [equivLoading, setEquivLoading] = useState(false);
  const [showEquivForm, setShowEquivForm] = useState(false);
  const [equivForm, setEquivForm] = useState({
    supplierId: "",
    supplierCode: "",
    supplierDescription: "",
    lastPriceCents: "",
  });

  // Stock adjustment state (within modal)
  const [stockDelta, setStockDelta] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [adjustingStock, setAdjustingStock] = useState(false);

  const { toast } = useToast();

  /* ── Load products ──────────────────────────────────── */

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const qs = tp.buildQueryString();
      const result = await api.get<PaginatedResponse<Product>>(`/products?${qs}`);
      setProducts(result.data);
      setMeta(result.meta);
    } catch {
      toast("Erro ao carregar produtos.", "error");
    } finally {
      setLoading(false);
    }
  }, [tp.buildQueryString, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Carrega tipos ja cadastrados pra alimentar dropdown da aba Piscina +
  // mapa de campos obrigatorios por tipo (asterisco/auto-expandir/validacao).
  useEffect(() => {
    reloadPoolTypes();
  }, [reloadPoolTypes]);

  // Carrega opcoes pros filtros da lista (DISTINCT de category, brand, poolType).
  useEffect(() => {
    api.get<{ categories: string[]; brands: string[]; poolTypes: string[] }>("/products/filter-options")
      .then((r) => setFilterOptions(r || { categories: [], brands: [], poolTypes: [] }))
      .catch(() => setFilterOptions({ categories: [], brands: [], poolTypes: [] }));
  }, []);

  // v1.12.32.1: handlers do drag do modal. Listeners globais pra capturar
  // movimentos mesmo quando o cursor sai do header.
  useEffect(() => {
    if (!modalDragging) return;
    const onMove = (e: MouseEvent) => {
      setModalDragPos({
        x: e.clientX - modalDragOffset.current.x,
        y: e.clientY - modalDragOffset.current.y,
      });
    };
    const onUp = () => setModalDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
  }, [modalDragging]);

  // Reseta a posicao toda vez que o modal abre.
  useEffect(() => {
    if (modalOpen) setModalDragPos({ x: 0, y: 0 });
  }, [modalOpen]);

  // Carrega servicos do tenant que podem ser vinculados ao produto (filtra
  // pelos que sao usados no modulo Piscina). v1.12.22.
  useEffect(() => {
    api.get<{ data: Array<{ id: string; name: string; code?: string | null }> }>("/services?usage=pool&limit=500")
      .then((r) => setLinkableServices((r?.data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code ?? null }))))
      .catch(() => setLinkableServices([]));
  }, []);

  const productFilters = useMemo(() => buildProductFilters(filterOptions), [filterOptions]);

  // Specs obrigatorias do tipo atualmente selecionado no form.
  const currentRequiredSpecs = useMemo(() => {
    const t = (form.poolType ?? "").trim();
    if (!t) return new Set<string>();
    return new Set(poolTypeRequiredMap[t] ?? []);
  }, [form.poolType, poolTypeRequiredMap]);

  // Blocks que tem ao menos 1 spec obrigatoria pelo tipo atual (auto-expandir).
  const blocksWithRequired = useMemo(() => {
    const out = new Set<string>();
    for (const key of currentRequiredSpecs) {
      const b = SPEC_BLOCK_BY_KEY[key];
      if (b) out.add(b);
    }
    return out;
  }, [currentRequiredSpecs]);

  /* ── Load equivalents for a product ─────────────────── */

  const loadEquivalents = useCallback(async (productId: string) => {
    try {
      setEquivLoading(true);
      const result = await api.get<ProductEquivalent[]>(
        `/products/${productId}/equivalents`,
      );
      setEquivalents(result);
    } catch {
      setEquivalents([]);
    } finally {
      setEquivLoading(false);
    }
  }, []);

  /* ── Open modal ─────────────────────────────────────── */

  function openNewProduct() {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setEquivalents([]);
    setModalTab("geral");
    setShowEquivForm(false);
    setStockDelta("");
    setStockReason("");
    setModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setForm(productToForm(product));
    setEquivalents(product.equivalents || []);
    setModalTab("geral");
    setShowEquivForm(false);
    setStockDelta("");
    setStockReason("");
    setModalOpen(true);
    if (product.id) {
      loadEquivalents(product.id);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setEquivalents([]);
    setShowEquivForm(false);
  }

  /* ── Save product ───────────────────────────────────── */

  async function handleSave() {
    if (!form.description.trim()) {
      toast("Descricao e obrigatoria.", "error");
      return;
    }
    // Valida campos obrigatorios pelo poolType selecionado. Backend tambem
    // valida (defesa em camadas) mas frontend bloqueia antes da request.
    if (currentRequiredSpecs.size > 0) {
      const missing: string[] = [];
      for (const key of currentRequiredSpecs) {
        const formField = SPEC_KEY_TO_FORM_FIELD[key];
        if (!formField) continue;
        const val = (form as any)[formField];
        if (val === undefined || val === null || String(val).trim() === "") {
          missing.push(SPEC_LABEL_BY_KEY[key] ?? key);
        }
      }
      if (missing.length > 0) {
        toast(
          `Faltam preencher: ${missing.join(", ")}. Aba Piscina → secao(oes) destacada(s).`,
          "error",
        );
        // Se modal estiver na aba Geral, leva pra Piscina
        if (modalTab !== "piscina") setModalTab("piscina");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = formToPayload(form, editingProduct?.technicalSpecs);
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
        toast("Produto atualizado com sucesso!", "success");
      } else {
        await api.post("/products", payload);
        toast("Produto criado com sucesso!", "success");
      }
      closeModal();
      await loadProducts();
    } catch {
      toast("Erro ao salvar produto.", "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Add equivalent ─────────────────────────────────── */

  async function handleAddEquivalent() {
    if (!editingProduct) return;
    if (!equivForm.supplierCode.trim()) {
      toast("Código do fornecedor e obrigatório.", "error");
      return;
    }
    try {
      await api.post(`/products/${editingProduct.id}/equivalents`, {
        supplierId: equivForm.supplierId || undefined,
        supplierCode: equivForm.supplierCode,
        supplierDescription: equivForm.supplierDescription || undefined,
        lastPriceCents: equivForm.lastPriceCents
          ? parseBRLToCents(equivForm.lastPriceCents)
          : undefined,
      });
      toast("Equivalente adicionado!", "success");
      setEquivForm({ supplierId: "", supplierCode: "", supplierDescription: "", lastPriceCents: "" });
      setShowEquivForm(false);
      await loadEquivalents(editingProduct.id);
    } catch {
      toast("Erro ao adicionar equivalente.", "error");
    }
  }

  /* ── Remove equivalent ──────────────────────────────── */

  async function handleRemoveEquivalent(equivId: string) {
    if (!editingProduct) return;
    try {
      await api.del(`/products/${editingProduct.id}/equivalents/${equivId}`);
      toast("Equivalente removido.", "success");
      await loadEquivalents(editingProduct.id);
    } catch {
      toast("Erro ao remover equivalente.", "error");
    }
  }

  /* ── Adjust stock ───────────────────────────────────── */

  async function handleStockAdjust() {
    if (!editingProduct) return;
    const delta = parseInt(stockDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast("Informe uma quantidade valida (+/-).", "error");
      return;
    }
    setAdjustingStock(true);
    try {
      await api.post(`/products/${editingProduct.id}/stock`, {
        delta,
        reason: stockReason || undefined,
      });
      toast("Estoque ajustado com sucesso!", "success");
      setStockDelta("");
      setStockReason("");
      // Reload the product to get updated stock
      const updated = await api.get<Product>(`/products/${editingProduct.id}`);
      setEditingProduct(updated);
      await loadProducts();
    } catch {
      toast("Erro ao ajustar estoque.", "error");
    } finally {
      setAdjustingStock(false);
    }
  }

  /* ── Delete product ────────────────────────────────── */

  async function handleDeleteProduct(product: Product) {
    if (!confirm(`Deseja excluir o produto "${product.description}"?`)) return;
    try {
      await api.del(`/products/${product.id}`);
      toast("Produto excluido com sucesso.", "success");
      loadProducts();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao excluir produto.", "error");
    }
  }

  /* ── Computed margin ────────────────────────────────── */

  const costVal = parseBRLToCents(form.costCents);
  const saleVal = parseBRLToCents(form.salePriceCents);
  const margin = computeMargin(costVal, saleVal);

  /* ── Form field helpers ─────────────────────────────── */

  // Auto-conversao de capacidade: kcal/h <-> kW <-> BTU/h (1 kW = 860 kcal/h = 3412 BTU/h).
  // O operador digita a unidade que o datasheet traz e os outros 2 se preenchem. Quando
  // autoSyncCapacity esta OFF, edita cada um individualmente (so seta o campo de origem).
  function syncCapacity(source: 'kcal' | 'kw' | 'btu', raw: string) {
    const v = parseFloat(String(raw).replace(',', '.'));
    setForm((prev) => {
      const next = { ...prev };
      if (source === 'kcal') next.specKcalHNominal = raw;
      else if (source === 'kw') next.specKwNominal = raw;
      else next.specBtuH = raw;
      if (autoSyncCapacity && Number.isFinite(v) && v > 0) {
        const kcal = source === 'kcal' ? v : source === 'kw' ? v * 860 : v / 3.9683;
        if (source !== 'kcal') next.specKcalHNominal = String(Math.round(kcal));
        if (source !== 'kw') next.specKwNominal = String(Number((kcal / 860).toFixed(2)));
        if (source !== 'btu') next.specBtuH = String(Math.round(kcal * 3.9683));
      }
      return next;
    });
  }

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500">
            Cadastro de produtos, precos, impostos e estoque.
          </p>
        </div>
        <button
          onClick={openNewProduct}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Produto
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <FilterBar
        filters={productFilters}
        values={tp.filters}
        onChange={tp.setFilter}
        onReset={tp.resetFilters}
        search={tp.search}
        onSearchChange={tp.setSearch}
        searchPlaceholder="Buscar por codigo, descricao, marca..."
      />

      {/* ── Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            {tp.search || Object.keys(tp.filters).length > 0
              ? "Nenhum produto encontrado com os filtros selecionados."
              : "Nenhum produto cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <table
            className="text-sm"
            style={{ tableLayout: "fixed", minWidth: "900px", width: "max-content" }}
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {orderedColumns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    index={idx}
                    columnId={col.id}
                    onReorder={reorderColumns}
                    onResize={setColumnWidth}
                    width={columnWidths[col.id]}
                    className={col.headerClassName || ""}
                  >
                    {col.sortable ? (
                      <SortableHeader
                        as="div"
                        label={col.label}
                        column={col.sortKey || col.id}
                        currentColumn={tp.sort.column}
                        currentOrder={tp.sort.order}
                        onToggle={tp.toggleSort}
                        align={col.align}
                      />
                    ) : (
                      <div
                        className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {col.label}
                      </div>
                    )}
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openEditProduct(p)}
                  className="border-b border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {orderedColumns.map((col) => {
                    const w = columnWidths[col.id];
                    const tdStyle: React.CSSProperties = w
                      ? {
                          width: `${w}px`,
                          minWidth: `${w}px`,
                          maxWidth: `${w}px`,
                          overflow: "hidden",
                        }
                      : {};
                    if (col.id === "actions") {
                      return (
                        <td key={col.id} style={tdStyle} className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center">
                            <ActionsDropdown
                              product={p}
                              onEdit={openEditProduct}
                              onDelete={handleDeleteProduct}
                            />
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.id}
                        style={tdStyle}
                        className={`py-3 px-4 ${col.className || ""} ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {col.render(p)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination meta={meta} onPageChange={tp.setPage} />

      {/* ══════════════════════════════════════════════════
         PRODUCT MODAL (Create / Edit)
         ══════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col"
            style={{ transform: `translate(${modalDragPos.x}px, ${modalDragPos.y}px)` }}
          >
            {/* Modal Header — arrastavel (v1.12.32.1). Tudo no header (exceto botao X) inicia drag. */}
            <div
              className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0 cursor-move select-none"
              onMouseDown={(e) => {
                // Ignora drag se clicou no botao de fechar
                if ((e.target as HTMLElement).closest('button')) return;
                modalDragOffset.current = {
                  x: e.clientX - modalDragPos.x,
                  y: e.clientY - modalDragPos.y,
                };
                setModalDragging(true);
              }}
              title="Arraste pra mover o modal"
            >
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="text-slate-400 text-sm" title="Arrastavel">⋮⋮</span>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-600 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex gap-1 border-b border-slate-200 px-6 shrink-0">
              {MODAL_TABS.map((tab) => {
                // Only show equivalentes and estoque tabs when editing
                if ((tab.id === "equivalentes" || tab.id === "estoque") && !editingProduct) {
                  return null;
                }
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      modalTab === tab.id
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Barra fixa de contexto: mostra qual produto esta sendo editado pra que
                o gestor nao perca referencia ao trocar de aba. Aparece so em modo edicao
                (no modo criacao ainda nao ha description definido). */}
            {editingProduct && (
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-2.5 shrink-0">
                {editingProduct.code && (
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-slate-300 rounded px-2 py-0.5 shrink-0">
                    {editingProduct.code}
                  </span>
                )}
                <span className="text-sm font-semibold text-slate-900 truncate flex-1 min-w-0" title={editingProduct.description}>
                  {editingProduct.description}
                </span>
                {editingProduct.brand && (
                  <span className="text-xs text-slate-600 shrink-0 hidden sm:inline" title="Marca">
                    {editingProduct.brand}
                  </span>
                )}
                <span className="text-[10px] font-medium text-slate-600 bg-slate-200 rounded px-1.5 py-0.5 shrink-0">
                  {editingProduct.unit}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 border ${
                  editingProduct.status === 'ATIVO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  {editingProduct.status}
                </span>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* ── Tab: Geral ─────────────────────────── */}
              {modalTab === "geral" && (
                <>
                  {/* Imagem do produto — aparece no inicio da aba Geral */}
                  {editingProduct ? (
                    <ProductImageBlock
                      productId={editingProduct.id}
                      currentImageUrl={editingProduct.imageUrl ?? null}
                      onChange={async () => { await loadProducts(); }}
                    />
                  ) : (
                    <div className="mb-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      📷 <strong>Imagem do produto:</strong> salve o produto primeiro. Depois reabra pra fazer upload.
                    </div>
                  )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={labelClass}>Código de Barras</label>
                    <input
                      type="text"
                      value={form.barcode}
                      onChange={(e) => setField("barcode", e.target.value)}
                      placeholder="EAN / GTIN"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>
                      Descricao <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      onBlur={() => setField("description", toTitleCase(form.description || ""))}
                      placeholder="Nome / descricao do produto"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Marca</label>
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                      onBlur={() => setField("brand", toTitleCase(form.brand || ""))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <FieldLabel
                      tone="cyan"
                      help="Modelo do produto (ex: 'Tropicos', 'Linha Premium', 'Acqualight'). Use o MESMO nome em produtos da mesma linha tecnica — isso permite agrupar regras por modelo. ATENCAO em COLETORES SOLARES: sem este campo preenchido, o produto NAO aparece nas Regras Solares do Simulador (modulo Piscina) e usa apenas os padroes do sistema."
                    >
                      Modelo
                    </FieldLabel>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setField("model", e.target.value)}
                      onBlur={() => setField("model", toTitleCase(form.model || ""))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Unidade</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setField("unit", e.target.value)}
                      className={inputClass}
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>NCM</label>
                    <input
                      type="text"
                      value={form.ncm}
                      onChange={(e) => setField("ncm", e.target.value)}
                      placeholder="Ex: 8471.30.19"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CEST</label>
                    <input
                      type="text"
                      value={form.cest}
                      onChange={(e) => setField("cest", e.target.value)}
                      placeholder="Ex: 21.063.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Origem</label>
                    <select
                      value={form.origin}
                      onChange={(e) => setField("origin", e.target.value)}
                      className={inputClass}
                    >
                      {ORIGIN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Categoria</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setField("category", e.target.value)}
                      onBlur={() => setField("category", toTitleCase(form.category || ""))}
                      placeholder="Ex: Elétrico, Hidráulico..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Finalidade</label>
                    <select
                      value={form.finalidade}
                      onChange={(e) => setField("finalidade", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">— Selecione —</option>
                      {FINALIDADE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setField("status", e.target.value)}
                      className={inputClass}
                    >
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </div>
                </div>
                </>
              )}

              {/* ── Tab: Impostos ──────────────────────── */}
              {modalTab === "impostos" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={labelClass}>ICMS %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.icmsRate}
                      onChange={(e) => setField("icmsRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>IPI %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.ipiRate}
                      onChange={(e) => setField("ipiRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>PIS %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.pisRate}
                      onChange={(e) => setField("pisRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>COFINS %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.cofinsRate}
                      onChange={(e) => setField("cofinsRate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CSOSN</label>
                    <input
                      type="text"
                      value={form.csosn}
                      onChange={(e) => setField("csosn", e.target.value)}
                      placeholder="Ex: 102"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CFOP</label>
                    <input
                      type="text"
                      value={form.cfop}
                      onChange={(e) => setField("cfop", e.target.value)}
                      placeholder="Ex: 5102"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CST ICMS</label>
                    <input
                      type="text"
                      value={form.cst}
                      onChange={(e) => setField("cst", e.target.value)}
                      placeholder="Ex: 00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CST PIS</label>
                    <input
                      type="text"
                      value={form.cstPis}
                      onChange={(e) => setField("cstPis", e.target.value)}
                      placeholder="Ex: 01"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CST COFINS</label>
                    <input
                      type="text"
                      value={form.cstCofins}
                      onChange={(e) => setField("cstCofins", e.target.value)}
                      placeholder="Ex: 01"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Margem ────────────────────────── */}
              {modalTab === "margem" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Custo (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.costCents}
                        onChange={(e) => setField("costCents", e.target.value)}
                        onBlur={(e) => setField("costCents", fmtCurrency(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Preco Venda (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.salePriceCents}
                        onChange={(e) => setField("salePriceCents", e.target.value)}
                        onBlur={(e) => setField("salePriceCents", fmtCurrency(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Margem %</label>
                      <div
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                          margin != null && margin >= 0
                            ? "border-green-200 bg-green-50 text-green-700"
                            : margin != null && margin < 0
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {margin != null ? `${margin.toFixed(2)}%` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Read-only reference prices */}
                  {editingProduct &&
                    (editingProduct.lastPurchasePriceCents != null ||
                      editingProduct.averageCostCents != null) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">
                          Precos de Referencia
                        </h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {editingProduct.lastPurchasePriceCents != null && (
                            <div>
                              <span className="text-xs text-slate-500">Último Preco de Compra</span>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(editingProduct.lastPurchasePriceCents)}
                              </p>
                            </div>
                          )}
                          {editingProduct.averageCostCents != null && (
                            <div>
                              <span className="text-xs text-slate-500">Custo Medio</span>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(editingProduct.averageCostCents)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* ── Tab: Equivalentes ──────────────────── */}
              {modalTab === "equivalentes" && editingProduct && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Produtos Equivalentes
                      <span className="ml-2 text-xs font-normal text-slate-600">
                        {equivalents.length} cadastrado{equivalents.length !== 1 ? "s" : ""}
                      </span>
                    </h4>
                    <button
                      onClick={() => setShowEquivForm(!showEquivForm)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      {showEquivForm ? "Cancelar" : "+ Adicionar"}
                    </button>
                  </div>

                  {/* Inline add form */}
                  {showEquivForm && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Fornecedor (ID)</label>
                          <input
                            type="text"
                            value={equivForm.supplierId}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierId: e.target.value })
                            }
                            placeholder="ID do fornecedor"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Código <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={equivForm.supplierCode}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierCode: e.target.value })
                            }
                            placeholder="Código no fornecedor"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Descricao</label>
                          <input
                            type="text"
                            value={equivForm.supplierDescription}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, supplierDescription: e.target.value })
                            }
                            onBlur={() =>
                              setEquivForm({ ...equivForm, supplierDescription: toTitleCase(equivForm.supplierDescription || "") })
                            }
                            placeholder="Descricao no fornecedor"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Último Preco (R$)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={equivForm.lastPriceCents}
                            onChange={(e) =>
                              setEquivForm({ ...equivForm, lastPriceCents: e.target.value })}
                            onBlur={(e) =>
                              setEquivForm({ ...equivForm, lastPriceCents: fmtCurrency(e.target.value) })
                            }
                            placeholder="0,00"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddEquivalent}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                          Salvar Equivalente
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Equivalents table */}
                  {equivLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-12 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
                        />
                      ))}
                    </div>
                  ) : equivalents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                      <p className="text-sm text-slate-600">
                        Nenhum equivalente cadastrado para este produto.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Fornecedor
                            </th>
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Código
                            </th>
                            <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase text-slate-600">
                              Descricao
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600">
                              Último Preco
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600">
                              Última Compra
                            </th>
                            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase text-slate-600 w-[60px]">
                              &nbsp;
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {equivalents.map((eq) => (
                            <tr
                              key={eq.id}
                              className="border-b border-slate-100 hover:bg-slate-100 transition-colors"
                            >
                              <td className="py-2.5 px-4 text-slate-700">
                                {eq.supplier?.name || eq.supplierId || "—"}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-900">
                                {eq.supplierCode}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {eq.supplierDescription || "—"}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-700">
                                {formatCurrency(eq.lastPriceCents)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-500">
                                {formatDate(eq.lastPurchaseDate)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => handleRemoveEquivalent(eq.id)}
                                  className="rounded p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Remover"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Estoque ───────────────────────── */}
              {modalTab === "estoque" && editingProduct && (
                <div className="space-y-6">
                  {/* Current stock info */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">
                      Estoque Atual
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                      <div>
                        <span className="text-xs text-slate-500">Quantidade</span>
                        <p className="text-2xl font-bold text-slate-900">
                          {editingProduct.currentStock}
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Estoque Minimo</label>
                        <input
                          type="number"
                          value={form.minStock}
                          onChange={(e) => setField("minStock", e.target.value)}
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Estoque Maximo</label>
                        <input
                          type="number"
                          value={form.maxStock}
                          onChange={(e) => setField("maxStock", e.target.value)}
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Localizacao</label>
                        <input
                          type="text"
                          value={form.location}
                          onChange={(e) => setField("location", e.target.value)}
                          onBlur={() => setField("location", toTitleCase(form.location || ""))}
                          placeholder="Ex: Prateleira A3"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock adjustment form */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">
                      Ajustar Estoque
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>
                          Quantidade (+/-)
                        </label>
                        <input
                          type="number"
                          value={stockDelta}
                          onChange={(e) => setStockDelta(e.target.value)}
                          placeholder="Ex: +10 ou -5"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-slate-600">
                          Positivo para entrada, negativo para saida
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Motivo</label>
                        <input
                          type="text"
                          value={stockReason}
                          onChange={(e) => setStockReason(e.target.value)}
                          placeholder="Ex: Compra fornecedor, Perda, Inventario..."
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleStockAdjust}
                        disabled={adjustingStock || !stockDelta}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {adjustingStock ? "Ajustando..." : "Confirmar Ajuste"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Piscina (specs tecnicas) ────────── */}
              {modalTab === "piscina" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
                    <p className="text-xs text-slate-700">
                      Especificacoes tecnicas usadas pelo <strong>auto-selecao do produto</strong> no orcamento de piscina.
                      Preencha apenas os campos relevantes pro tipo de produto (filtro, bomba, aquecedor, kit SPA, cascata, etc).
                      Campos em branco nao sao usados.
                    </p>
                  </div>

                  <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-5">
                    <h4 className="text-xs font-semibold text-violet-900 uppercase mb-2">
                      🏷 Tipo do produto (Piscina)
                    </h4>
                    <p className="text-[11px] text-slate-700 mb-3 leading-tight">
                      Categoria do produto no modulo Piscina (ex: <em>Cascata</em>, <em>Conjunto de filtragem</em>, <em>Aquecedor</em>,
                      <em> Tubos cascata</em>, <em>Quadro eletrico</em>, <em>Disjuntor</em>). O orcamento de piscina usa esse tipo
                      pra filtrar candidatos na auto-selecao. Digite um tipo novo livremente — ele passa a aparecer no dropdown depois.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <FieldLabel
                            tone="cyan"
                            className="mb-0"
                            help="Tipo do produto no contexto Piscina (ex: 'Coletor Solar Piscina', 'Bombas diversas', 'Cascata', 'Aquecedor'). Define filtros e regras automaticas do modulo Piscina. ATENCAO em COLETORES SOLARES: este campo precisa ser preenchido pra o produto entrar no dropdown do Simulador Solar e pra criar Regras Solares por modelo. Use o botao Gerenciar tipos pra padronizar nomes entre produtos."
                          >
                            Tipo
                          </FieldLabel>
                          <button
                            type="button"
                            onClick={() => setShowPoolTypesManager(true)}
                            title="Gerenciar tipos (adicionar, renomear, excluir)"
                            className="text-[10px] font-semibold text-violet-700 hover:text-violet-900 hover:underline inline-flex items-center gap-1"
                          >
                            ⚙ Gerenciar tipos
                          </button>
                        </div>
                        <input
                          type="text"
                          list="poolTypeOptions"
                          value={form.poolType}
                          onChange={(e) => setField("poolType", e.target.value)}
                          placeholder="Ex: Cascata, Aquecedor, Conjunto de filtragem..."
                          className={inputClass}
                        />
                        <datalist id="poolTypeOptions">
                          {poolTypes.map((t) => <option key={t} value={t} />)}
                        </datalist>
                        {poolTypes.length > 0 && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            {poolTypes.length} tipo(s) ja cadastrado(s). Comece a digitar pra ver sugestoes.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Quantidade padrao</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.defaultQty}
                          onChange={(e) => setField("defaultQty", e.target.value)}
                          placeholder="Ex: 1 (padrao)"
                          className={inputClass}
                        />
                        <p className="mt-1 text-[10px] text-slate-600 leading-tight">
                          Qty usada ao escolher esse produto numa linha do orcamento de piscina.
                          Vazio = sem padrao (sistema usa 1). Se operador editar a qty, a linha fica
                          <span className="bg-amber-100 text-amber-800 px-1 rounded mx-0.5">amarela</span>
                          (fora do padrao).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase mb-4">⏱ Tempo de instalacao</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('tempoMontagemH')} help="Tempo padrao de montagem/instalacao desse equipamento. Usado pra calcular automaticamente o servico de montagem no orcamento de piscina. Equipamentos pequenos vs grandes podem ter tempos bem diferentes.">
                          Tempo padrao de montagem (horas)
                        </FieldLabel>
                        <input
                          type="number" step="0.5" min="0"
                          value={form.specTempoMontagemH}
                          onChange={(e) => setField("specTempoMontagemH", e.target.value)}
                          placeholder="Ex: 4 (filtro pequeno), 10 (aquecedor grande)"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel help="Servico que o orcamento usa pra instalar/montar este produto. Quando uma linha de servico no orcamento tem auto-selecao 'Seguir produto da linha X', le este vinculo pra escolher o Service correto.">
                          Servico vinculado
                        </FieldLabel>
                        <select
                          value={form.linkedServiceId}
                          onChange={(e) => setField("linkedServiceId", e.target.value)}
                          className={inputClass}
                        >
                          <option value="">— Sem vinculo —</option>
                          {linkableServices.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code ? `${s.code} · ` : ""}{s.name}
                            </option>
                          ))}
                        </select>
                        {linkableServices.length === 0 && (
                          <p className="mt-1 text-[10px] text-slate-500 italic">Nenhum servico marcado como &ldquo;usado em Piscina&rdquo;. Cadastre servicos com a flag ativa.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <CollapsibleCard title="🚿 Hidraulico — Filtros, Bombas, Aquecedores, SPA, Cascata" defaultOpen={blocksWithRequired.has('hidraulico')}>
                    {/* v1.12.32.1: pressao de trabalho (MCA) eh redundante quando a bomba tem
                        curva cadastrada (a altura maxima = primeiro/ultimo ponto da curva).
                        Esconde o campo quando ha curva. */}
                    {(() => {
                      const hasCurve = form.pumpCurve.length > 0;
                      const cols = hasCurve ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
                      return (
                        <div className={`grid grid-cols-1 ${cols} gap-4`}>
                          <div>
                            <FieldLabel required={currentRequiredSpecs.has('vazaoM3h')} help="Vazao maxima do equipamento (litros por hora dividido por 1000). Em obras de piscina, usada APENAS pra dimensionar vazao de ralo de fundo e tempo de filtragem (volume / vazao). NAO eh usada pra calculo de perdas de carga nem altura manometrica — pra isso a auto-selecao da bomba interpola a curva caracteristica cadastrada no card abaixo.">
                              Vazao maxima (m³/h)
                            </FieldLabel>
                            <input type="number" step="0.1" value={form.specVazaoM3h} onChange={(e) => setField("specVazaoM3h", e.target.value)} placeholder="Ex: 9" className={inputClass} />
                          </div>
                          {!hasCurve && (
                            <div>
                              <FieldLabel required={currentRequiredSpecs.has('pressaoTrabalhoMca')} help="Pressao maxima de trabalho da bomba em MCA (metros de coluna d'agua). Para bombas com curva caracteristica cadastrada abaixo, este campo deixa de ser usado — a curva tem precisao maior.">
                                Pressao de trabalho (MCA)
                              </FieldLabel>
                              <input type="number" step="0.1" value={form.specPressaoTrabalhoMca} onChange={(e) => setField("specPressaoTrabalhoMca", e.target.value)} placeholder="Ex: 12, 18, 25" className={inputClass} />
                            </div>
                          )}
                          <div>
                            <FieldLabel required={currentRequiredSpecs.has('tuboEntradaMm')} help="Diametro da conexao hidraulica em milimetros. Auto-selecao de tubos usa esse campo pra escolher o tubo correto (mesma medida do equipamento principal da etapa).">
                              Tubo de entrada (mm)
                            </FieldLabel>
                            <input type="number" step="1" value={form.specTuboEntradaMm} onChange={(e) => setField("specTuboEntradaMm", e.target.value)} placeholder="Ex: 50, 60, 75" className={inputClass} />
                          </div>
                        </div>
                      );
                    })()}
                  </CollapsibleCard>

                  {/* v1.12.32: curva caracteristica da bomba — DEPOIS do Hidraulico.
                      Aparece quando poolType comeca com "Bomba" (ex: "Bomba", "Bomba de Calor",
                      "Bomba hidraulica"). Auto-selecao interpola esta curva. */}
                  {/^bomba/i.test(form.poolType) && (() => {
                    // v1.12.38: contador de pontos vs minimo obrigatorio (6 default).
                    // Mostra cor + faltam X pra atingir o minimo.
                    const validPoints = form.pumpCurve.filter((p) =>
                      Number.isFinite(parseFloat(String(p.vazaoM3h).replace(",", "."))) &&
                      Number.isFinite(parseFloat(String(p.alturaMca).replace(",", ".")))
                    ).length;
                    const isCurvaRequired = currentRequiredSpecs.has('pumpCurve');
                    const minPts = 6;
                    const isComplete = validPoints >= minPts;
                    const cardTitle = isCurvaRequired
                      ? `📈 Curva da bomba * (${validPoints}/${minPts} pontos${!isComplete ? ` · faltam ${minPts - validPoints}` : ''})`
                      : `📈 Curva da bomba (${validPoints} pontos)`;
                    return (
                    <CollapsibleCard title={cardTitle} defaultOpen={form.pumpCurve.length > 0 || isCurvaRequired}>
                      <p className="text-[11px] text-slate-600 mb-2">
                        Pares (vazão, altura manométrica) da curva caracteristica. Voce encontra no manual da bomba — tabela &ldquo;Caracteristicas hidraulicas&rdquo;. A auto-selecao interpola esta curva.
                      </p>
                      {isCurvaRequired && !isComplete && (
                        <div className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] text-red-800">
                          ⚠ Tipo &ldquo;{form.poolType}&rdquo; exige no mínimo {minPts} pontos. Faltam <span className="font-bold">{minPts - validPoints}</span>.
                        </div>
                      )}
                      {isCurvaRequired && isComplete && (
                        <div className="mb-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800">
                          ✓ Mínimo de {minPts} pontos atendido.
                        </div>
                      )}
                      <div className="overflow-x-auto rounded border border-slate-200">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-600">
                            <tr>
                              <th className="px-2 py-1 text-center w-10">#</th>
                              <th className="px-2 py-1 text-left">Vazao (m³/h)</th>
                              <th className="px-2 py-1 text-left">Altura (mca)</th>
                              <th className="px-2 py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {form.pumpCurve.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-2 py-3 text-center text-[10px] text-slate-500 italic">
                                  Sem curva. Clique &ldquo;+ Ponto&rdquo;.
                                </td>
                              </tr>
                            ) : (
                              form.pumpCurve.map((point, idx) => (
                                <tr key={idx}>
                                  <td className="px-2 py-0.5 text-center text-[10px] text-slate-500 tabular-nums">{idx + 1}</td>
                                  <td className="px-2 py-0.5">
                                    <input
                                      type="number" step="0.1" min="0"
                                      value={point.vazaoM3h}
                                      onChange={(e) => {
                                        const next = [...form.pumpCurve];
                                        next[idx] = { ...next[idx], vazaoM3h: e.target.value };
                                        setField("pumpCurve", next);
                                      }}
                                      placeholder="18.2"
                                      className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-0.5">
                                    <input
                                      type="number" step="0.5" min="0"
                                      value={point.alturaMca}
                                      onChange={(e) => {
                                        const next = [...form.pumpCurve];
                                        next[idx] = { ...next[idx], alturaMca: e.target.value };
                                        setField("pumpCurve", next);
                                      }}
                                      placeholder="2"
                                      className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-0.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = form.pumpCurve.filter((_, i) => i !== idx);
                                        setField("pumpCurve", next);
                                      }}
                                      title="Remover"
                                      className="text-rose-500 hover:text-rose-700 px-0.5 rounded hover:bg-rose-50 text-xs"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setField("pumpCurve", [...form.pumpCurve, { vazaoM3h: "", alturaMca: "" }]);
                        }}
                        className="mt-2 text-[11px] font-semibold text-blue-700 hover:text-blue-900 border border-blue-300 hover:border-blue-500 rounded px-2 py-0.5 bg-blue-50 hover:bg-blue-100"
                      >
                        + Ponto
                      </button>
                    </CollapsibleCard>
                    );
                  })()}

                  {/* Specs especificas por tipo de equipamento — alimentam o Simulador automatico (F6.2) */}
                  {/^cascata/i.test(form.poolType) && (
                    <CollapsibleCard title="🌊 Cascata — Spec especifica" defaultOpen={blocksWithRequired.has('cascata')}>
                      <div className="max-w-sm">
                        <FieldLabel required={currentRequiredSpecs.has('cascataComprimentoCm')} tone="cyan" help="Comprimento do bocal de cascata em centimetros. O Simulador de Aquecimento agrega a soma de qty × comprimento das linhas de Cascata pra calcular a perda termica extra. Ex: Cascata Inox 100cm = 100.">
                          Comprimento do bocal (cm) ✓
                        </FieldLabel>
                        <input type="number" step="1" value={form.specCascataComprimentoCm} onChange={(e) => setField("specCascataComprimentoCm", e.target.value)} placeholder="Ex: 100, 150, 200" className={inputClass} />
                      </div>
                    </CollapsibleCard>
                  )}

                  {(/^kit spa/i.test(form.poolType) || /hidromassagem/i.test(form.poolType) || /\bjato/i.test(form.poolType)) && (
                    <CollapsibleCard title="🛁 SPA / Hidromassagem — Spec especifica" defaultOpen={blocksWithRequired.has('spa')}>
                      <div className="max-w-sm">
                        <FieldLabel required={currentRequiredSpecs.has('qtdJatos')} tone="cyan" help="Quantidade de jatos do kit. Simulador agrega qty × jatos das linhas pra calcular perda extra (cada jato adiciona ~150 Kcal/h). Ex: Kit SPA Master = 8 jatos.">
                          Quantidade de jatos ✓
                        </FieldLabel>
                        <input type="number" step="1" min="0" value={form.specQtdJatos} onChange={(e) => setField("specQtdJatos", e.target.value)} placeholder="Ex: 4, 6, 8" className={inputClass} />
                      </div>
                    </CollapsibleCard>
                  )}

                  {/borda/i.test(form.poolType) && (
                    <CollapsibleCard title="💧 Borda Infinita — Specs especificas" defaultOpen={blocksWithRequired.has('borda')}>
                      <div className="text-[11px] text-slate-500 mb-3">
                        Estes campos alimentam o Simulador automaticamente. O comprimento total vira da soma das qty das linhas de Borda Infinita das etapas. Altura/vazao/horas sao do primeiro produto encontrado.
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <FieldLabel required={currentRequiredSpecs.has('bordaAlturaQuedaM')} tone="cyan" help="Altura da queda d'agua da borda ate o reservatorio. Maior altura = mais area de filme exposta ao ar = mais evaporacao. Canaleta nivelada: ~0.1m. Cascata baixa: 0.5m. Cascata alta: 1.5m.">
                            Altura de queda (m) ✓
                          </FieldLabel>
                          <input type="number" step="0.05" min="0.05" max="3" value={form.specBordaAlturaQuedaM} onChange={(e) => setField("specBordaAlturaQuedaM", e.target.value)} placeholder="Ex: 0.5" className={inputClass} />
                        </div>
                        <div>
                          <FieldLabel required={currentRequiredSpecs.has('bordaVazaoLminPorM')} tone="cyan" help="Vazao da bomba de transbordamento por metro linear. Mais vazao = filme mais espesso/largo = mais evaporacao. Tipico: 20-40 L/min/m (bomba 0.5cv). Plateua acima de 60.">
                            Vazao (L/min por metro) ✓
                          </FieldLabel>
                          <input type="number" step="5" min="5" max="120" value={form.specBordaVazaoLminPorM} onChange={(e) => setField("specBordaVazaoLminPorM", e.target.value)} placeholder="Ex: 30" className={inputClass} />
                        </div>
                        <div>
                          <FieldLabel required={currentRequiredSpecs.has('bordaHorasAtivaDia')} tone="cyan" help="Quantas horas por dia a bomba da borda fica ligada. 24h = sempre. Reduza se a bomba desliga (capa fechada/noite). Multiplica a perda diaria por (horas/24).">
                            Horas/dia ativa ✓
                          </FieldLabel>
                          <input type="number" step="1" min="0" max="24" value={form.specBordaHorasAtivaDia} onChange={(e) => setField("specBordaHorasAtivaDia", e.target.value)} placeholder="Ex: 24" className={inputClass} />
                        </div>
                      </div>
                    </CollapsibleCard>
                  )}

                  <CollapsibleCard title="🔥 Aquecimento — Bombas de Calor, Solar, Trocadores" defaultOpen={blocksWithRequired.has('aquecimento') || blocksWithRequired.has('coletorSolar')}>
                    {/* Capacidade nominal — usada no Simulador.
                        Identificacao do produto como "coletor solar" / "bomba de calor" /
                        etc agora eh feita pelo Tipo (poolType) — campo livre gerenciavel
                        via ⚙ Gerenciar tipos. Nada filtra por technicalSpecs.tipoEquipamento. */}
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <h5 className="text-[11px] font-bold text-slate-500 uppercase">Capacidade de aquecimento</h5>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none" title="Ligado: digite em UMA unidade (a que o datasheet traz) e as outras se preenchem pela conversao. Desmarque pra editar cada uma na mao.">
                        <input type="checkbox" checked={autoSyncCapacity} onChange={(e) => setAutoSyncCapacity(e.target.checked)} className="accent-cyan-600" />
                        🔗 Auto-converter (kcal · kW · BTU)
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('kcalHNominal')} tone="cyan" help="Capacidade nominal de aquecimento em Kcal/h — numero principal do calculo (o Simulador seleciona o modelo por kcalHNominal >= calor necessario). Com o auto-converter LIGADO, basta preencher kW OU BTU/h que este se completa sozinho. Ex Tholz X23-40C = 34.400 Kcal/h (= 136.500 BTU, ar 26°C Turbo).">
                          Kcal/h nominal ✓
                        </FieldLabel>
                        <input type="number" step="100" value={form.specKcalHNominal} onChange={(e) => syncCapacity('kcal', e.target.value)} placeholder="Ex: 34400" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('kwNominal')} help="Potencia termica em kW (= Kcal/h ÷ 860). Datasheets costumam dar a capacidade em kW ou BTU — preencha aqui e o Kcal/h se completa (auto-converter ligado).">
                          kW térmico
                        </FieldLabel>
                        <input type="number" step="0.1" value={form.specKwNominal} onChange={(e) => syncCapacity('kw', e.target.value)} placeholder="Ex: 40" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('btuH')} help="Capacidade em BTU/h (= Kcal/h × 3,9683). Comum em datasheets (ex: Tholz X23 lista a capacidade em BTU por condicao/modo). Preencha aqui e o Kcal/h se completa.">
                          BTU/h
                        </FieldLabel>
                        <input type="number" step="1000" value={form.specBtuH} onChange={(e) => syncCapacity('btu', e.target.value)} placeholder="Ex: 136500" className={inputClass} />
                      </div>
                    </div>

                    {/* Vazao de agua exigida pela bomba de calor (janela min/max). So aparece
                        pra Bomba de Calor. Alimenta a selecao futura da bomba de circulacao pela curva. */}
                    {/bomba\s*de\s*calor/i.test(form.poolType) && (
                      <>
                        <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 mt-2">Vazao de agua (m³/h)</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 max-w-md">
                          <div>
                            <FieldLabel required={currentRequiredSpecs.has('vazaoMinM3h')} help="Vazao MINIMA de agua que deve passar pela bomba de calor (trocador). Abaixo disso o equipamento corta / nao troca calor direito. Usada pra dimensionar a bomba de circulacao. No datasheet: linha 'Fluxo de agua (m³/h)' — o primeiro numero da faixa. Ex Tholz X23-40C: Fluxo 12~18 -> minima 12.">
                              Vazao minima
                            </FieldLabel>
                            <input type="number" step="0.1" min="0" value={form.specVazaoMinM3h} onChange={(e) => setField("specVazaoMinM3h", e.target.value)} placeholder="Ex: 12" className={inputClass} />
                          </div>
                          <div>
                            <FieldLabel required={currentRequiredSpecs.has('vazaoMaxM3h')} help="Vazao MAXIMA de agua suportada pela bomba de calor (trocador). Acima disso a perda de carga sobe demais. No datasheet: linha 'Fluxo de agua (m³/h)' — o segundo numero da faixa. Ex Tholz X23-40C: Fluxo 12~18 -> maxima 18.">
                              Vazao maxima
                            </FieldLabel>
                            <input type="number" step="0.1" min="0" value={form.specVazaoMaxM3h} onChange={(e) => setField("specVazaoMaxM3h", e.target.value)} placeholder="Ex: 18" className={inputClass} />
                          </div>
                        </div>
                      </>
                    )}
                    {/* Consumo eletrico */}
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 mt-2">Consumo eletrico</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 mb-4 max-w-sm">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('ratedInputPowerKW')} help="Consumo eletrico MEDIO em kW. Usado pra estimar custo mensal/anual. No datasheet: linha 'Potencia de entrada nominal (kW)' — costuma vir em FAIXA (min~max); use o MEIO da faixa. Ex Tholz X23-40C: 0,59~5,7 -> medio ~3,145 kW.">
                          Consumo medio (kW)
                        </FieldLabel>
                        <input type="number" step="0.1" value={form.specRatedInputPowerKW} onChange={(e) => setField("specRatedInputPowerKW", e.target.value)} placeholder="Ex: 3.145" className={inputClass} />
                      </div>
                    </div>

                    {/* COPs */}
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 mt-2">COP (Coeficiente de Performance)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('copMax')} help="COP MAXIMO (marketing) em condicao ideal. No datasheet: bloco 'Ar 26°C', linha 'COP' — o MAIOR numero da faixa (ex X23-40C: 7,3~23,0 -> 23,0). Nao representa operacao tipica.">
                          COP maximo (marketing)
                        </FieldLabel>
                        <input type="number" step="0.1" value={form.specCopMax} onChange={(e) => setField("specCopMax", e.target.value)} placeholder="Ex: 23.0" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('copAt50Air26')} help="COP em 50% capacidade com ar a 26°C — verao. No datasheet: bloco 'Ar 26°C', linha 'COP a 50% de capacidade'. Ex Tholz X23-40C = 15,0.">
                          COP 50% verao (ar 26°C)
                        </FieldLabel>
                        <input type="number" step="0.1" value={form.specCopAt50Air26} onChange={(e) => setField("specCopAt50Air26", e.target.value)} placeholder="Ex: 15.0" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('copAt50Air15')} tone="cyan" help="COP em 50% capacidade com ar a 15°C — inverno BR. USADO PRA CALCULO conservador de consumo no Simulador. No datasheet: secao 'Condicoes de desempenho', bloco 'Ar 15°C', linha 'COP a 50% de capacidade'. Ex Tholz X23-40C = 7,5.">
                          COP 50% inverno (ar 15°C) ✓
                        </FieldLabel>
                        <input type="number" step="0.1" value={form.specCopAt50Air15} onChange={(e) => setField("specCopAt50Air15", e.target.value)} placeholder="Ex: 7.5" className={inputClass} />
                      </div>
                    </div>

                    {/* Curva COP vs Carga (polinomio quadratico) — precisa pra calculo TAB006-style */}
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 mt-4">Curva COP × Carga — Polinomio quadratico</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('copCurveA')} help="Coeficiente A do polinomio COP(carga) = A·carga² + B·carga + C. Onde 'carga' eh a fracao de uso (0..1.3) e COP eh o resultado. Permite calculo TAB006-style: meses com carga alta tem COP baixo. Pra Tholz X23-40C: A=15.49.">
                          A (coef carga²)
                        </FieldLabel>
                        <input type="number" step="0.001" value={form.specCopCurveA} onChange={(e) => setField("specCopCurveA", e.target.value)} placeholder="Ex: 15.49" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('copCurveB')} help="Coeficiente B do polinomio COP(carga) = A·carga² + B·carga + C. Tipicamente NEGATIVO (COP cai com aumento de carga). Pra Tholz X23-40C: B=-37.51.">
                          B (coef carga)
                        </FieldLabel>
                        <input type="number" step="0.001" value={form.specCopCurveB} onChange={(e) => setField("specCopCurveB", e.target.value)} placeholder="Ex: -37.51" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('copCurveC')} help="Coeficiente C do polinomio COP(carga) = A·carga² + B·carga + C. Intercepto. Pra Tholz X23-40C: C=29.88.">
                          C (intercepto)
                        </FieldLabel>
                        <input type="number" step="0.001" value={form.specCopCurveC} onChange={(e) => setField("specCopCurveC", e.target.value)} placeholder="Ex: 29.88" className={inputClass} />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      <strong>Opcional</strong> — se preenchidos, o Simulador calcula consumo mensal por curva (TAB006-style). Senao, usa interpolacao linear entre COP maximo e COP 50% inverno (menos preciso). Valores TAB006:
                      X23-09C: A=16.55 B=-38.92 C=29.92 · X23-14C: A=15.95 B=-37.83 C=29.43 · X23-18C: A=0.83 B=-10.25 C=18.42 · X23-26C: A=15.80 B=-38.06 C=29.18 · X23-40C: A=15.49 B=-37.51 C=29.88
                    </p>

                    {/* Coletor Solar — specs alinhadas com etiqueta Procel/Inmetro pra
                        Coletor Solar Piscina. Producao Especifica + Eficiencia + Area
                        alimentam o solar.service.ts. Classificacao + Pressao + Material
                        sao informativos (vao pro PDF do orcamento, sem impacto no calc). */}
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 mt-4">⛅ Coletor Solar — etiqueta Procel/Inmetro (PBE)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('areaM2')} help="Area externa do coletor em m² (resultado de ensaio Procel). O motor calcula qtd de coletores = m² necessario ÷ area. Ex Solis NEW TROPICOS 3000 = 3.4 m².">
                          Area externa (m²) ✓
                        </FieldLabel>
                        <input type="number" step="0.01" value={form.specColetorAreaM2} onChange={(e) => setField("specColetorAreaM2", e.target.value)} placeholder="Ex: 3.4" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('kwhPorM2')} help="Producao Especifica (PMEe) — resultado de ensaio Procel medido em kWh por mes por m² de area do coletor. Eh o numero que define a classificacao A-E. Ex Solis NEW TROPICOS = 102,3 kWh/mes·m². Faixas: A > 98 / B 90-98 / C 80-90 / D 70-80 / E 65-70.">
                          Producao especifica (kWh/mes·m²) ✓
                        </FieldLabel>
                        <input type="number" step="0.1" value={form.specKwhPorM2} onChange={(e) => setField("specKwhPorM2", e.target.value)} placeholder="Ex: 102.3" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('eficiencia')} help="Eficiencia Energetica Media (%) — resultado de ensaio Procel. Porcentagem da radiacao convertida em calor util. Ex Solis = 73,2%. Coletor melhor = mais proximo de 100%.">
                          Eficiencia energetica media (%) ✓
                        </FieldLabel>
                        <input type="number" step="0.1" min="0" max="100" value={form.specEficiencia} onChange={(e) => setField("specEficiencia", e.target.value)} placeholder="Ex: 73,2" className={inputClass} />
                      </div>
                    </div>
                    {/* Linha 2: campos informativos da etiqueta Procel (nao afetam calculo) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('classeEficiencia')} help="Classificacao do PBE Procel — letra A a E baseada na Producao Especifica (PMEe). A: >98 kWh/mes·m². B: 90-98. C: 80-90. D: 70-80. E: 65-70.">
                          Classificacao PBE (A-E)
                        </FieldLabel>
                        <select value={form.specClasseEficiencia} onChange={(e) => setField("specClasseEficiencia", e.target.value)} className={inputClass}>
                          <option value="">— Nao informado —</option>
                          <option value="A">A (mais eficiente)</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E (menos eficiente)</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('pressaoFuncionamentokPa')} help="Pressao de Funcionamento (kPa) — resultado de ensaio Procel. Pressao maxima de trabalho que o coletor aguenta. Ex Solis NEW TROPICOS = 196 kPa (~20 mca). Valor tipico vai de 49 a 490 kPa.">
                          Pressao funcionamento (kPa)
                        </FieldLabel>
                        <input type="number" step="1" min="0" value={form.specPressaoFuncionamentokPa} onChange={(e) => setField("specPressaoFuncionamentokPa", e.target.value)} placeholder="Ex: 196" className={inputClass} />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      <strong>Obrigatorios pro Simulador Solar</strong>: Area, Producao Especifica e Eficiencia. <strong>Informativos</strong> (vao pro PDF): Classificacao e Pressao. Todos os campos espelham a <a href="https://www.gov.br/inmetro/pt-br/assuntos/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/equipamentos-de-aquecimento-solar-de-agua" target="_blank" rel="noopener" className="underline text-cyan-700">etiqueta Procel/Inmetro PBE</a>.
                    </p>

                    {/* Trocador de Calor — specs que alimentam a aba Trocador do Simulador.
                        Transfere calor de uma fonte externa (caldeira/bomba de calor) pra
                        agua da piscina. Capacidade reusa o campo "Kcal/h nominal" do topo. */}
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase mb-2 mt-4">♨️ Trocador de Calor</h5>
                    <p className="mb-3 text-[11px] text-slate-500">
                      <strong>Capacidade</strong> usa o campo <strong>Kcal/h nominal</strong> la em cima. Os campos abaixo alimentam a aba <strong>Trocador</strong> do Simulador (vazoes pra dimensionar a bomba do lado da piscina e perda de carga interna).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('trocadorMaterial')} help="Material da serpentina/feixe do trocador. INOX 316 resiste a cloro (piscina tratada). TITANIO resiste a agua salina (piscina de sal). Informativo — vai pro PDF do orcamento.">
                          Material
                        </FieldLabel>
                        <select value={form.specTrocadorMaterial} onChange={(e) => setField("specTrocadorMaterial", e.target.value)} className={inputClass}>
                          <option value="">— Nao informado —</option>
                          <option value="INOX">Inox 316 (agua tratada/cloro)</option>
                          <option value="TITANIO">Titanio (agua salina)</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('trocadorEficiencia')} help="Eficiencia de troca termica (%) — quanto do calor do lado quente passa pra agua da piscina. Trocadores tipicos ficam entre 80% e 95%. Default do Simulador = 85% se vazio.">
                          Eficiencia de troca (%)
                        </FieldLabel>
                        <input type="number" step="0.1" min="0" max="100" value={form.specTrocadorEficiencia} onChange={(e) => setField("specTrocadorEficiencia", e.target.value)} placeholder="Ex: 85" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('pressaoMaxTrocadorMca')} help="Pressao maxima de trabalho do lado primario (fonte quente) em mca. Limite que o trocador aguenta. Informativo + checagem de compatibilidade com a bomba.">
                          Pressao maxima (mca)
                        </FieldLabel>
                        <input type="number" step="0.5" min="0" value={form.specTrocadorPressaoMaxMca} onChange={(e) => setField("specTrocadorPressaoMaxMca", e.target.value)} placeholder="Ex: 30" className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('vazaoPrimariaM3h')} help="Vazao do lado PRIMARIO (fonte quente — caldeira ou retorno da bomba de calor) em m³/h, na condicao nominal. Usado pra calcular a troca termica real.">
                          Vazao primaria (m³/h)
                        </FieldLabel>
                        <input type="number" step="0.1" min="0" value={form.specTrocadorVazaoPrimariaM3h} onChange={(e) => setField("specTrocadorVazaoPrimariaM3h", e.target.value)} placeholder="Ex: 5" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('vazaoSecundariaM3h')} help="Vazao do lado SECUNDARIO (agua da piscina) em m³/h, na condicao nominal. E o ALVO da bomba secundaria que o Simulador vai dimensionar.">
                          Vazao secundaria (m³/h)
                        </FieldLabel>
                        <input type="number" step="0.1" min="0" value={form.specTrocadorVazaoSecundariaM3h} onChange={(e) => setField("specTrocadorVazaoSecundariaM3h", e.target.value)} placeholder="Ex: 6" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('perdaCargaTrocadorMca')} help="Perda de carga interna do trocador no lado da piscina (mca) na vazao nominal. O Simulador soma isso na altura manometrica total pra dimensionar a bomba (igual faz com as baterias de coletor). Default = 2 mca se vazio.">
                          Perda de carga interna (mca)
                        </FieldLabel>
                        <input type="number" step="0.1" min="0" value={form.specTrocadorPerdaCargaMca} onChange={(e) => setField("specTrocadorPerdaCargaMca", e.target.value)} placeholder="Ex: 2" className={inputClass} />
                      </div>
                    </div>
                  </CollapsibleCard>

                  <CollapsibleCard title="⚡ Eletrico — Bombas, Motores, Equipamentos" defaultOpen={blocksWithRequired.has('eletrico')}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('potenciaCv')} help="Potencia do motor em CV (cavalo-vapor). 1 CV ≈ 0.736 kW.">Potencia (CV)</FieldLabel>
                        <input type="number" step="0.1" value={form.specPotenciaCv} onChange={(e) => setField("specPotenciaCv", e.target.value)} placeholder="Ex: 0.75" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('potenciaWatts')} help="Potencia eletrica em Watts (W). Use pra refletores/iluminacao LED. A auto-selecao da Fonte 12V soma a potencia (W) das linhas dos refletores e divide por 12 pra achar a corrente.">Potencia (W)</FieldLabel>
                        <input type="number" step="1" min="0" value={form.specPotenciaWatts} onChange={(e) => setField("specPotenciaWatts", e.target.value)} placeholder="Ex: 15" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('voltagem')} help="Tensao de operacao em Volts. 220V eh padrao residencial BR, 380V eh trifasico industrial.">Voltagem (V)</FieldLabel>
                        <input type="number" step="1" value={form.specVoltagem} onChange={(e) => setField("specVoltagem", e.target.value)} placeholder="Ex: 220" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('amperagem')} help="Corrente nominal em Amperes. Usado pra dimensionar disjuntor e fiacao.">Amperagem (A)</FieldLabel>
                        <input type="number" step="0.1" value={form.specAmperagem} onChange={(e) => setField("specAmperagem", e.target.value)} placeholder="Ex: 5.1" className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('bifTrif')} help="Tipo de alimentacao eletrica. Influencia disjuntor, quadro de distribuicao e fiacao.">Tipo eletrico</FieldLabel>
                        <select value={form.specBifTrif} onChange={(e) => setField("specBifTrif", e.target.value)} className={inputClass}>
                          <option value="">— Nao se aplica —</option>
                          <option value="Bif">Bifasico (220V — 2 fases)</option>
                          <option value="Trif">Trifasico (220V/380V — 3 fases)</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel required={currentRequiredSpecs.has('bifTrifConta')} help="Quantos modulos/espacos o disjuntor ou contactor desse equipamento ocupa no quadro. Usado pra dimensionar quadro automaticamente.">Espacos no quadro</FieldLabel>
                        <input type="number" step="1" min="0" value={form.specBifTrifConta} onChange={(e) => setField("specBifTrifConta", e.target.value)} placeholder="Ex: 2 (Bif) ou 3 (Trif)" className={inputClass} />
                      </div>
                    </div>
                  </CollapsibleCard>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 shrink-0">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingProduct ? "Salvar Alteracoes" : "Criar Produto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPoolTypesManager && (
        <PoolTypesManagerModal
          onClose={() => setShowPoolTypesManager(false)}
          onChanged={reloadPoolTypes}
        />
      )}
    </div>
  );
}

// ============ Bloco de imagem do produto ============
// Upload via multipart pra POST /products/:id/image. Mostra preview.
// Usado tanto no cadastro normal quanto exibido no Simulador Solar (coletor selecionado).
function ProductImageBlock({
  productId,
  currentImageUrl,
  onChange,
}: {
  productId: string;
  currentImageUrl: string | null;
  onChange: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setPreviewUrl(currentImageUrl); }, [currentImageUrl]);

  async function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast("Use JPEG, PNG ou WebP.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Imagem muito grande (max 5MB).", "error");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ imageUrl: string }>(`/products/${productId}/image`, fd);
      setPreviewUrl(res.imageUrl);
      toast("Imagem enviada.", "success");
      await onChange();
    } catch (err: any) {
      toast(String(err?.payload?.message ?? err?.message ?? "Erro ao enviar imagem"), "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!previewUrl) return;
    if (!confirm("Remover a imagem deste produto?")) return;
    setUploading(true);
    try {
      await api.del(`/products/${productId}/image`);
      setPreviewUrl(null);
      toast("Imagem removida.", "success");
      await onChange();
    } catch (err: any) {
      toast(String(err?.payload?.message ?? err?.message ?? "Erro ao remover imagem"), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-4">
      <div className="w-24 h-24 shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden flex items-center justify-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Produto" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-slate-400 text-center px-2">Sem imagem</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900">📷 Imagem do produto</div>
        <div className="text-[11px] text-slate-600 mt-0.5">
          JPEG / PNG / WebP — max 5MB. Aparece no PDF do orçamento e no Simulador (quando o produto for o coletor solar selecionado).
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleSelectFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="rounded border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50">
            {uploading ? "Enviando..." : previewUrl ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {previewUrl && (
            <button type="button" onClick={handleRemove} disabled={uploading}
              className="rounded border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Card colapsavel reutilizavel ============
// Usado nos blocos pesados da aba Piscina (Hidraulico, Aquecimento, Eletrico, etc).
// Padrao minimizado — usuario expande clicando no header. Visual identico ao
// <div rounded-xl border> antigo, mas com triangulo indicador.
function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-5 group" {...(defaultOpen ? { open: true } : {})}>
      <summary className="text-xs font-semibold text-slate-700 uppercase cursor-pointer list-none flex items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
        <span className="text-slate-400 transition-transform inline-block group-open:rotate-90">▸</span>
        <span className="flex-1">{title}</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

// ============ Modal: Gerenciar tipos de produto Piscina ============
// Lista tipos cadastrados (DISTINCT Product.poolType + extras manuais salvos
// em Company.systemConfig.pool.extraTypes) com contagem de produtos por tipo.
// Permite adicionar, renomear (bulk update em todos produtos do tipo) e excluir
// (bulk update setando poolType=null + remove do array de extras).

interface PoolTypeRow {
  name: string;
  count: number;
  isExtra: boolean;
  requiredFields: string[];
}

// Catalogo de specs disponiveis na aba Piscina do cadastro de produto, agrupadas
// pelos blocos visuais. Usado pelo modal "Campos obrigatorios" (e tambem pelo
// auto-expandir dos CollapsibleCards no formulario do produto).
export const PRODUCT_SPECS_GROUPED: Array<{ block: string; group: string; specs: { key: string; label: string }[] }> = [
  { block: 'tempo', group: '⏱ Tempo de instalacao', specs: [
    { key: 'tempoMontagemH', label: 'Tempo de montagem (h)' },
  ]},
  { block: 'hidraulico', group: '🚿 Hidraulico', specs: [
    { key: 'vazaoM3h', label: 'Vazao (m³/h)' },
    { key: 'pressaoTrabalhoMca', label: 'Pressao de trabalho (MCA)' },
    { key: 'tuboEntradaMm', label: 'Tubo de entrada (mm)' },
  ]},
  // v1.12.38: curva da bomba como spec selecionavel pra ser obrigatoria
  // em poolType "Bomba" (ou similar). Min de pontos definido no validador (default 6).
  { block: 'bomba', group: '📈 Curva da bomba', specs: [
    { key: 'pumpCurve', label: 'Curva da bomba (min 6 pontos)' },
  ]},
  { block: 'cascata', group: '🌊 Cascata', specs: [
    { key: 'cascataComprimentoCm', label: 'Comprimento do bocal (cm)' },
  ]},
  { block: 'spa', group: '🛁 SPA / Hidromassagem', specs: [
    { key: 'qtdJatos', label: 'Qtde de jatos' },
  ]},
  { block: 'borda', group: '💧 Borda Infinita', specs: [
    { key: 'bordaAlturaQuedaM', label: 'Altura de queda (m)' },
    { key: 'bordaVazaoLminPorM', label: 'Vazao (L/min por m)' },
    { key: 'bordaHorasAtivaDia', label: 'Horas/dia ativa' },
  ]},
  { block: 'aquecimento', group: '🔥 Aquecimento', specs: [
    { key: 'kcalHNominal', label: 'Kcal/h nominal' },
    { key: 'kwNominal', label: 'kW termico' },
    { key: 'btuH', label: 'BTU/h' },
    { key: 'ratedInputPowerKW', label: 'Consumo medio (kW)' },
    { key: 'copMax', label: 'COP maximo' },
    { key: 'copAt50Air26', label: 'COP 50% verao' },
    { key: 'copAt50Air15', label: 'COP 50% inverno' },
    { key: 'copCurveA', label: 'COP A (carga²)' },
    { key: 'copCurveB', label: 'COP B (carga)' },
    { key: 'copCurveC', label: 'COP C (intercepto)' },
  ]},
  // Mesmo block 'aquecimento' (campos ficam no mesmo CollapsibleCard) — group separado
  // so pra organizar o seletor de campos obrigatorios por tipo.
  { block: 'aquecimento', group: '♨️ Trocador de Calor', specs: [
    { key: 'trocadorMaterial', label: 'Material (inox/titanio)' },
    { key: 'trocadorEficiencia', label: 'Eficiencia de troca (%)' },
    { key: 'vazaoPrimariaM3h', label: 'Vazao primaria (m³/h)' },
    { key: 'vazaoSecundariaM3h', label: 'Vazao secundaria (m³/h)' },
    { key: 'perdaCargaTrocadorMca', label: 'Perda de carga interna (mca)' },
    { key: 'pressaoMaxTrocadorMca', label: 'Pressao maxima (mca)' },
  ]},
  { block: 'coletorSolar', group: '⛅ Coletor Solar (Procel/Inmetro)', specs: [
    { key: 'areaM2', label: 'Area externa (m²)' },
    { key: 'kwhPorM2', label: 'Producao especifica (kWh/mes·m²)' },
    { key: 'eficiencia', label: 'Eficiencia energetica media (%)' },
    { key: 'classeEficiencia', label: 'Classificacao PBE (A-E)' },
    { key: 'pressaoFuncionamentokPa', label: 'Pressao funcionamento (kPa)' },
  ]},
  { block: 'eletrico', group: '⚡ Eletrico', specs: [
    { key: 'potenciaCv', label: 'Potencia (CV)' },
    { key: 'potenciaWatts', label: 'Potencia (W)' },
    { key: 'voltagem', label: 'Voltagem (V)' },
    { key: 'amperagem', label: 'Amperagem (A)' },
    { key: 'bifTrif', label: 'Tipo eletrico (Bif/Trif)' },
    { key: 'bifTrifConta', label: 'Espacos no quadro' },
  ]},
];

// Mapa key -> label pra mensagens de erro amigaveis no submit
export const SPEC_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  PRODUCT_SPECS_GROUPED.flatMap((b) => b.specs.map((s) => [s.key, s.label])),
);

// Mapa key -> nome do bloco (pra auto-expandir o CollapsibleCard certo)
export const SPEC_BLOCK_BY_KEY: Record<string, string> = Object.fromEntries(
  PRODUCT_SPECS_GROUPED.flatMap((b) => b.specs.map((s) => [s.key, b.block])),
);

// Mapa spec key (technicalSpecs.X) -> campo do form (spec...). Algumas specs tem
// nomes do form diferentes do nome da chave (ex: areaM2 -> specColetorAreaM2).
export const SPEC_KEY_TO_FORM_FIELD: Record<string, string> = {
  tempoMontagemH: 'specTempoMontagemH',
  vazaoM3h: 'specVazaoM3h',
  pressaoTrabalhoMca: 'specPressaoTrabalhoMca',
  tuboEntradaMm: 'specTuboEntradaMm',
  cascataComprimentoCm: 'specCascataComprimentoCm',
  qtdJatos: 'specQtdJatos',
  bordaAlturaQuedaM: 'specBordaAlturaQuedaM',
  bordaVazaoLminPorM: 'specBordaVazaoLminPorM',
  bordaHorasAtivaDia: 'specBordaHorasAtivaDia',
  kcalHNominal: 'specKcalHNominal',
  kwNominal: 'specKwNominal',
  btuH: 'specBtuH',
  ratedInputPowerKW: 'specRatedInputPowerKW',
  copMax: 'specCopMax',
  copAt50Air26: 'specCopAt50Air26',
  copAt50Air15: 'specCopAt50Air15',
  copCurveA: 'specCopCurveA',
  copCurveB: 'specCopCurveB',
  copCurveC: 'specCopCurveC',
  areaM2: 'specColetorAreaM2',
  kwhPorM2: 'specKwhPorM2',
  eficiencia: 'specEficiencia',
  classeEficiencia: 'specClasseEficiencia',
  pressaoFuncionamentokPa: 'specPressaoFuncionamentokPa',
  trocadorMaterial: 'specTrocadorMaterial',
  trocadorEficiencia: 'specTrocadorEficiencia',
  vazaoPrimariaM3h: 'specTrocadorVazaoPrimariaM3h',
  vazaoSecundariaM3h: 'specTrocadorVazaoSecundariaM3h',
  perdaCargaTrocadorMca: 'specTrocadorPerdaCargaMca',
  pressaoMaxTrocadorMca: 'specTrocadorPressaoMaxMca',
  potenciaCv: 'specPotenciaCv',
  potenciaWatts: 'specPotenciaWatts',
  voltagem: 'specVoltagem',
  amperagem: 'specAmperagem',
  bifTrif: 'specBifTrif',
  bifTrifConta: 'specBifTrifConta',
};

function PoolTypesManagerModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PoolTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PoolTypeRow | null>(null);
  const [editingRequiredFields, setEditingRequiredFields] = useState<PoolTypeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<PoolTypeRow[]>("/products/pool-types/manage");
      setRows(Array.isArray(r) ? r : []);
    } catch (e: any) {
      toast(String(e?.message ?? "Erro ao carregar tipos"), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.post("/products/pool-types", { name });
      setNewName("");
      setAdding(false);
      await load();
      await onChanged();
      toast(`Tipo "${name}" cadastrado`, "success");
    } catch (e: any) {
      toast(String(e?.message ?? "Erro ao adicionar tipo"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(oldName: string) {
    const newNameTrim = editingValue.trim();
    if (!newNameTrim || newNameTrim === oldName) {
      setEditingName(null);
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{ productsUpdated: number }>("/products/pool-types/rename", {
        oldName,
        newName: newNameTrim,
      });
      setEditingName(null);
      await load();
      await onChanged();
      toast(`Renomeado. ${r.productsUpdated} produto(s) atualizado(s).`, "success");
    } catch (e: any) {
      toast(String(e?.message ?? "Erro ao renomear"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRequiredFields(name: string, requiredFields: string[]) {
    setBusy(true);
    try {
      await api.post("/products/pool-types/required-fields", { name, requiredFields });
      setEditingRequiredFields(null);
      await load();
      await onChanged();
      toast(`Campos obrigatorios de "${name}" salvos.`, "success");
    } catch (e: any) {
      toast(String(e?.message ?? "Erro ao salvar campos obrigatorios"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: PoolTypeRow) {
    setBusy(true);
    try {
      const r = await api.post<{ productsCleared: number }>("/products/pool-types/delete", {
        name: row.name,
      });
      setConfirmDelete(null);
      await load();
      await onChanged();
      toast(
        r.productsCleared > 0
          ? `Tipo excluido. ${r.productsCleared} produto(s) ficaram sem tipo.`
          : `Tipo "${row.name}" excluido.`,
        "success",
      );
    } catch (e: any) {
      toast(String(e?.message ?? "Erro ao excluir"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-blue-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">⚙ Gerenciar tipos de produto (Piscina)</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Renomeie, exclua ou cadastre tipos. Renomear atualiza todos os produtos do tipo. Excluir
              deixa os produtos sem tipo (poolType = null).
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            {adding ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") { setAdding(false); setNewName(""); }
                  }}
                  placeholder="Nome do novo tipo (ex: Aquecedor)"
                  className="flex-1 rounded-lg border border-violet-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <button onClick={handleAdd} disabled={busy || !newName.trim()}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                  Adicionar
                </button>
                <button onClick={() => { setAdding(false); setNewName(""); }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="rounded-lg border border-dashed border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 w-full">
                + Adicionar tipo novo
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center text-slate-500 py-8">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-slate-500 py-8">Nenhum tipo cadastrado ainda.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              {rows.map((row) => (
                <li key={row.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  {editingName === row.name ? (
                    <>
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(row.name);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                        className="flex-1 rounded border border-violet-300 px-2 py-1 text-sm"
                      />
                      <button onClick={() => handleRename(row.name)} disabled={busy}
                        className="text-xs font-semibold text-violet-700 hover:text-violet-900">Salvar</button>
                      <button onClick={() => setEditingName(null)}
                        className="text-xs text-slate-600 hover:text-slate-900">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-slate-900">{row.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {row.count > 0 ? `${row.count} produto(s)` : "sem produtos"}
                      </span>
                      {row.requiredFields.length > 0 && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={row.requiredFields.join(", ")}>
                          {row.requiredFields.length} obrigatorio(s)
                        </span>
                      )}
                      <button
                        onClick={() => setEditingRequiredFields(row)}
                        disabled={busy}
                        title="Definir campos obrigatorios"
                        className="text-xs text-slate-500 hover:text-amber-700 px-1.5"
                      >📋</button>
                      <button
                        onClick={() => { setEditingName(row.name); setEditingValue(row.name); }}
                        disabled={busy}
                        title="Renomear"
                        className="text-xs text-slate-500 hover:text-violet-700 px-1.5"
                      >✎</button>
                      <button
                        onClick={() => setConfirmDelete(row)}
                        disabled={busy}
                        title="Excluir"
                        className="text-xs text-slate-500 hover:text-rose-700 px-1.5"
                      >🗑</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end">
          <button onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Fechar
          </button>
        </div>
      </div>

      {editingRequiredFields && (
        <RequiredFieldsModal
          row={editingRequiredFields}
          onClose={() => setEditingRequiredFields(null)}
          onSave={(fields) => handleSaveRequiredFields(editingRequiredFields.name, fields)}
          busy={busy}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-2">Excluir tipo "{confirmDelete.name}"?</h3>
            <p className="text-sm text-slate-700 mb-4">
              {confirmDelete.count > 0
                ? `${confirmDelete.count} produto(s) atualmente classificados como "${confirmDelete.name}" ficarao SEM tipo (poolType = null). Voce pode reclassificar depois.`
                : `Esse tipo nao esta em uso por nenhum produto. Sera removido da lista.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={busy}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Modal: Campos obrigatorios por tipo ============
// Marca quais specs (de PRODUCT_SPECS_GROUPED) sao obrigatorias quando o produto
// tem este poolType. Ao salvar produto sem preencher = backend lanca BadRequest
// + frontend bloqueia submit com toast e scroll pro primeiro campo faltando.

function RequiredFieldsModal({
  row,
  onClose,
  onSave,
  busy,
}: {
  row: PoolTypeRow;
  onClose: () => void;
  onSave: (fields: string[]) => void | Promise<void>;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(row.requiredFields));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(specs: { key: string }[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of specs) {
        if (allSelected) next.delete(s.key);
        else next.add(s.key);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-yellow-50">
          <h2 className="text-base font-bold text-slate-900">📋 Campos obrigatorios — tipo "{row.name}"</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Marque as specs que TODO produto deste tipo DEVE preencher. Sem isso, o sistema bloqueia o save com erro.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {PRODUCT_SPECS_GROUPED.map((bloc) => {
            const allSelected = bloc.specs.every((s) => selected.has(s.key));
            const someSelected = bloc.specs.some((s) => selected.has(s.key));
            return (
              <div key={bloc.block} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 uppercase">{bloc.group}</h3>
                  <button onClick={() => toggleGroup(bloc.specs, allSelected)}
                    className="text-[10px] font-semibold text-violet-700 hover:text-violet-900 uppercase">
                    {allSelected ? "desmarcar todos" : someSelected ? "marcar todos" : "marcar todos"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-3">
                  {bloc.specs.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 px-2 py-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(s.key)}
                        onChange={() => toggle(s.key)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{s.label}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">{s.key}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-600">
            <strong>{selected.size}</strong> campo(s) marcado(s)
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              Cancelar
            </button>
            <button onClick={() => onSave(Array.from(selected))} disabled={busy}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
