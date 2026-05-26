"use client";
// Simulador de Aquecimento (Solar / Bomba de Calor).
// Modal full-screen com abas. Ordem: Solar | Bomba de Calor | Comparativo.
// Ver memory/project_heating_simulator_plan.md pra contexto.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, getAccessToken } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { AutoSelectModal, type AutoSelectRule, type CatalogConfig } from "@/app/(dashboard)/quotes/pool/[id]/page";

// ============ Tipos ============

interface HeatingCity {
  uf: string;
  ufName: string;
  cities: string[];
}

interface MonthlyHeatLoss {
  monthIndex: number;
  tempAr: number;
  humidity: number;
  qsKw: number;
  qsExtraKw: number;
  qsExtrasKw: number;
  qtotalKw: number;
}

interface SelectedEquipment {
  productId: string;
  modelName: string;
  kcalHNominal?: number;
  btuH?: number;
  kwNominal?: number;
  consumoMaxW?: number;
  consumoMedioW?: number;
  ratedInputPowerKW?: number;
  copMax?: number;
  copAt50Air26?: number;
  copAt50Air15?: number;
  copNominal?: number;
  copAt50Capacity?: number;
  loadRatio: number;
  isAdequate: boolean;
  quantity: number;
  fromItemCellRef?: string;
  fromOverride?: boolean;
}

interface HeatingCandidate {
  productId: string;
  modelName: string;
  kcalHNominal: number;
  kwNominal?: number;
}

interface MonthlyConsumption {
  monthIndex: number;
  monthName: string;
  kwhConsumido: number;
  custoBRLCents: number;
}

interface ComparativoFonte {
  fonte: "BOMBA_CALOR" | "GLP" | "GN" | "ELETRICO";
  kcalAnualEstimado: number;
  consumoAnual: number;
  consumoUnidade: string;
  custoAnualBRLCents: number;
}

type ExtraStatus = 'NAO_IDENTIFICADA' | 'IDENTIFICADA_COMPLETA' | 'IDENTIFICADA_FALTANDO_INFO';

interface ExtraLineDetail {
  productId: string;
  productName: string;
  qty: number;
  value: number | null;
  specField: string;
}

interface ExtraDetected {
  status: ExtraStatus;
  totalValue: number;
  unit: string;
  horasSemana?: number;
  lines: ExtraLineDetail[];
  message: string;
  /** Contribuicao em kW pro calor necessario (v1.11.81) */
  impactKw?: number;
}

interface ExtrasDetected {
  cascata: ExtraDetected;
  hidromassagem: ExtraDetected;
  bordaInfinita: ExtraDetected;
}

interface HeatingReport {
  computedAt: string;
  cityResolved: { uf: string; name: string };
  inputs: any;
  monthlyHeatLoss: MonthlyHeatLoss[];
  qtotalMaxKw: number;
  qtotalAvgKw: number;
  qtotalMonthCritical: number;
  calorNecessarioKcalH: number;
  calorNecessarioBtuH: number;
  selectedEquipment?: SelectedEquipment;
  timeToHeatHours?: number;
  degreesPerHour?: number;
  timeToHeatInfeasible?: boolean;
  copEstimated?: number;
  monthlyConsumption?: MonthlyConsumption[];
  annualKwh?: number;
  annualCostBRLCents?: number;
  initialHeatingCostBRLCents?: number;
  comparativo?: ComparativoFonte[];
  extrasDetected?: ExtrasDetected;
}

interface BudgetForHeating {
  id: string;
  code: string | null;
  title: string;
  clientPartner?: { name?: string } | null;
  poolDimensions?: any;
  environmentParams?: any;
  solarHeaderImage?: string | null;
}

interface Props {
  budget: BudgetForHeating;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  // Catalog do tenant — passado pelo pai (quotes/pool/[id]/page.tsx) pra alimentar
  // o AutoSelectModal do icone ✨ no Coletor Solar. Sem isso, o modal abre com
  // catalog=[] e Tipo (Piscina)/Categoria/Candidatos ficam vazios.
  catalog?: CatalogConfig[];
}

// ============ Constantes UI ============

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const VENTO_OPTIONS = [
  { v: "NULO", label: "Nulo (sem vento)" },
  { v: "FRACO", label: "Fraco (~7 km/h)" },
  { v: "MODERADO", label: "Moderado (~15 km/h)" },
  { v: "FORTE", label: "Forte (~22 km/h)" },
];

const TIPO_CONSTRUCAO_OPTIONS = [
  { v: "ABERTA", label: "Aberta (externa, sem cobertura)" },
  { v: "FECHADA", label: "Fechada (coberta/interna)" },
];

const TIPO_PISCINA_OPTIONS = [
  { v: "PRIVATIVA", label: "Privativa" },
  { v: "COLETIVA", label: "Coletiva" },
];

const UTILIZACAO_ANO_OPTIONS = [
  { v: "ANO_TODO", label: "Ano todo" },
  { v: "VERAO", label: "So Verao (Out-Mar)" },
  { v: "INVERNO", label: "So Inverno (Abr-Set)" },
];

const UTILIZACAO_SEMANA_OPTIONS = [
  { v: "MES_TODO", label: "Mes todo" },
  { v: "FIM_DE_SEMANA", label: "So Fins de Semana" },
];

// Normaliza valor pra enum aceito pelo backend (uppercase, sem espacos extras, fallback default)
function normEnum(value: any, allowed: string[], fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.toUpperCase().trim().replace(/ /g, "_");
  // Mapeamentos legados conhecidos
  if (allowed.includes(v)) return v;
  if (v === "BAIXO" && allowed.includes("FRACO")) return "FRACO";
  if (v === "ABERTO" && allowed.includes("ABERTA")) return "ABERTA";
  if (v === "FECHADO" && allowed.includes("FECHADA")) return "FECHADA";
  return fallback;
}

// ============ Componente ============

// ============ Tipos do Simulador Solar (Fase 5) ============

interface SolarCollectorCandidate {
  productId: string;
  modelName: string;
  areaM2: number;
  kwhPorM2: number;
  eficiencia: number;
  salePriceCents?: number;
  imageUrl?: string | null;
  // Specs tecnicas obrigatorias que faltam no cadastro do produto. Quando
  // populado, dropdown marca ⚠ e recompute lanca erro com a lista de campos.
  missingSpecs?: string[];
}

interface SolarMonthlyRow {
  monthIndex: number;
  monthName: string;
  tempAmbiente: number;
  radSol: number;
  perdaCorrigidaPorDia: number;
  ganhoDia: number;
  tempInicial1d: number;
  tempFinal1d: number;
  tempInicial2d: number;
  tempFinal2d: number;
  tempInicial3d: number;
  tempFinal3d: number;
  tempInicial4d: number;
  tempFinal4d: number;
}

interface SolarReport {
  computedAt: string;
  resolved: { uf?: string; cidade?: string; name: string };
  areaPiscinaM2: number;
  m2ColetorNecessario: number;
  qtdColetores: number;
  qtdInicial: number;
  numBaterias: number;
  coletoresPorBateria: number;
  numRamosParalelos?: number;
  batPorRamo?: number;
  vazaoTotalM3h: number;
  areaTotalColetoresM2: number;
  percentualCobertura: number;
  selectedCollector: {
    productId?: string;
    modelName: string;
    areaM2: number;
    kwhPorM2: number;
    eficiencia: number;
    kcalHTotal: number;
  };
  monthly: SolarMonthlyRow[];
  monthlyAvgGanho: number;
  monthlyMinTempFinal: number;
  monthlyMaxTempFinal: number;
  energiaSolarKcalH: number;
  kcalPara1Grau: number;
  bombaRecomendada: string;
  // v1.12.29: avisos do Simulador (ex: bomba do catalogo sem vazaoM3h suficiente).
  warnings?: Array<{ severity: 'warning' | 'info'; message: string }>;
}

type TabKey = "solar" | "bomba" | "comparativo";

export function HeatingSimulatorModal({ budget, open, onClose, onSaved, catalog }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("solar");
  const [cities, setCities] = useState<HeatingCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<HeatingReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ===== Estado do Simulador Solar (Fase 5) =====
  const [solarReport, setSolarReport] = useState<SolarReport | null>(null);
  const [solarLoading, setSolarLoading] = useState(false);
  const [solarRecomputing, setSolarRecomputing] = useState(false);
  const [solarCollectors, setSolarCollectors] = useState<SolarCollectorCandidate[]>([]);
  // v5.8 — regras de auto-selecao do tenant (config global, nao por orcamento)
  const [solarColetorRule, setSolarColetorRule] = useState<AutoSelectRule | null>(null);
  const [solarBombaRule, setSolarBombaRule] = useState<AutoSelectRule | null>(null);

  // v5.9 — ref do container scrollavel pra preservar scrollTop em recomputes
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [solarExtraPct, setSolarExtraPct] = useState(0);
  const [solarSelectedCollectorId, setSolarSelectedCollectorId] = useState<string | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(5); // Junho default (mes critico)
  const [solarHeaderImage, setSolarHeaderImage] = useState<string | null>(budget.solarHeaderImage ?? null);
  const [headerImageUploading, setHeaderImageUploading] = useState(false);

  // Recarrega coletores via GET (apos salvar regra, lista nova reflete o filtro)
  const reloadSolarCollectors = useCallback(async () => {
    try {
      const cs = await api.get<SolarCollectorCandidate[]>("/pool-budgets/solar/collectors");
      setSolarCollectors(cs);
      setSolarSelectedCollectorId((prev) => {
        if (cs.length === 0) return null;
        if (prev && cs.some((c) => c.productId === prev)) return prev;
        return cs[cs.length - 1].productId;
      });
    } catch {
      setSolarCollectors([]);
    }
  }, []);

  // Salva regra do coletor no tenant + recarrega lista. Null = limpa regra.
  const saveSolarColetorRule = useCallback(async (rule: AutoSelectRule | null) => {
    try {
      await api.post("/pool-budgets/solar/collector-rule", { rule });
      setSolarColetorRule(rule);
      await reloadSolarCollectors();
    } catch (e: any) {
      setError(String(e?.message ?? "Erro ao salvar regra do coletor"));
    }
  }, [reloadSolarCollectors]);

  // Salva regra da bomba no tenant. (Bomba nao tem dropdown proprio hoje —
  // string em report.bombaRecomendada. Regra fica disponivel pra futura
  // selecao automatica via catalog.)
  const saveSolarBombaRule = useCallback(async (rule: AutoSelectRule | null) => {
    try {
      await api.post("/pool-budgets/solar/bomba-rule", { rule });
      setSolarBombaRule(rule);
    } catch (e: any) {
      setError(String(e?.message ?? "Erro ao salvar regra da bomba"));
    }
  }, []);

  // Sincroniza com budget quando o parent re-fetcha (apos onSaved)
  useEffect(() => {
    setSolarHeaderImage(budget.solarHeaderImage ?? null);
  }, [budget.solarHeaderImage]);

  // Candidatos pra dropdown de selecao manual do equipamento
  const [candidates, setCandidates] = useState<HeatingCandidate[]>([]);
  const [showEquipmentPicker, setShowEquipmentPicker] = useState<boolean>(false);
  const [changingEquipment, setChangingEquipment] = useState<boolean>(false);
  // equipmentQty removido em v1.11.84 — agora cada linha do dropdown tem seu proprio
  // input de quantidade (EquipmentCandidateRow).

  // Modo "Calculo rapido": permite editar dados da obra (volume/area/dim) e
  // calcular sem salvar no orcamento. Util pra simular cenarios hipoteticos.
  const [quickMode, setQuickMode] = useState<boolean>(false);
  const [quickVolume, setQuickVolume] = useState<number>(0);
  const [quickArea, setQuickArea] = useState<number>(0);
  const [quickLength, setQuickLength] = useState<number>(0);
  const [quickWidth, setQuickWidth] = useState<number>(0);

  // State dos inputs (sincronizado com environmentParams)
  const [uf, setUf] = useState<string>("");
  const [cidade, setCidade] = useState<string>("");
  const [tempAguaDesejada, setTempAguaDesejada] = useState<number>(30);
  const [tempAguaInicial, setTempAguaInicial] = useState<number | "">("");
  const [vento, setVento] = useState<string>("MODERADO");
  const [tipoConstrucao, setTipoConstrucao] = useState<string>("ABERTA");
  const [tipoPiscina, setTipoPiscina] = useState<string>("PRIVATIVA");
  const [capaTermica, setCapaTermica] = useState<boolean>(false);
  const [utilizacaoAno, setUtilizacaoAno] = useState<string>("ANO_TODO");
  const [utilizacaoSemana, setUtilizacaoSemana] = useState<string>("MES_TODO");
  const [hidromassagensQtd, setHidromassagensQtd] = useState<number>(0);
  // Horas/semana que cascata/hidromassagem ficam ligadas. Defaults por tipoPiscina
  // (resolvidos no carregamento): 6h Privativa, 42h Coletiva. Multiplicado por
  // horas/168 no calculo termico (peso temporal).
  const [hidromassagemHorasSemana, setHidromassagemHorasSemana] = useState<number>(6);
  const [cascataLarguraCm, setCascataLarguraCm] = useState<number>(0);
  const [cascataHorasSemana, setCascataHorasSemana] = useState<number>(6);
  // Ref de "user mexeu" — usado pra disparar auto-save apos debounce so quando o
  // usuario interage. Inicializa false; viram true quando o user clica/digita
  // no input dos cards de extras. Reset apos save bem-sucedido.
  const userTouchedExtrasRef = useRef(false);
  const [bordaInfinitaM, setBordaInfinitaM] = useState<number>(0);
  const [bordaInfinitaAlturaM, setBordaInfinitaAlturaM] = useState<number>(0.5);
  const [bordaInfinitaVazaoLminPorM, setBordaInfinitaVazaoLminPorM] = useState<number>(30);
  const [bordaInfinitaHorasAtivaDia, setBordaInfinitaHorasAtivaDia] = useState<number>(24);
  const [horasFuncionamentoDia, setHorasFuncionamentoDia] = useState<number>(15);
  const [taxaFuncionamento, setTaxaFuncionamento] = useState<number>(0.5);
  const [observacoes, setObservacoes] = useState<string>("");

  // Carrega cidades ao abrir
  useEffect(() => {
    if (!open) return;
    api.get<HeatingCity[]>("/pool-budgets/heating/cities")
      .then(setCities)
      .catch((e) => setError(String(e?.message ?? e)));
    // Carrega candidatos disponiveis pro dropdown de selecao manual
    api.get<HeatingCandidate[]>("/pool-budgets/heating/candidates")
      .then(setCandidates)
      .catch(() => setCandidates([]));
    // Solar: carrega coletores e report cacheado
    api.get<SolarCollectorCandidate[]>("/pool-budgets/solar/collectors")
      .then((cs) => {
        setSolarCollectors(cs);
        // se o orcamento ja tem solarOverride.collectorProductId, marca
        const env = budget.environmentParams ?? {};
        const solOv = (env as any).solarOverride ?? {};
        if (solOv.collectorProductId) setSolarSelectedCollectorId(solOv.collectorProductId);
        else if (cs.length > 0) setSolarSelectedCollectorId(cs[cs.length - 1].productId); // padrao = ultimo
        if (typeof solOv.extraColetoresPct === "number") setSolarExtraPct(solOv.extraColetoresPct);
      })
      .catch(() => setSolarCollectors([]));
    // v5.8: carrega regras do tenant pro AutoSelectModal pre-popular + dropdown filtrar
    api.get<{ rule: AutoSelectRule | null }>("/pool-budgets/solar/collector-rule")
      .then((r) => setSolarColetorRule(r?.rule ?? null))
      .catch(() => setSolarColetorRule(null));
    api.get<{ rule: AutoSelectRule | null }>("/pool-budgets/solar/bomba-rule")
      .then((r) => setSolarBombaRule(r?.rule ?? null))
      .catch(() => setSolarBombaRule(null));
    setSolarLoading(true);
    api.get<SolarReport | null>(`/pool-budgets/${budget.id}/solar-report`)
      .then((r) => {
        // Solar v2: report cacheado pode estar em formato antigo (sem tempInicial2d/3d/4d).
        // Se detectado, forca recompute em background pra atualizar o cache.
        if (r && r.monthly?.[0] && (r.monthly[0] as any).tempInicial2d === undefined) {
          setSolarReport(r); // exibe o antigo enquanto recompute roda
          api.post<SolarReport>(`/pool-budgets/${budget.id}/solar-report/recompute`, {})
            .then(setSolarReport)
            .catch(() => { /* mantem o antigo */ });
        } else {
          setSolarReport(r);
        }
      })
      .catch(() => setSolarReport(null))
      .finally(() => setSolarLoading(false));
  }, [open, budget.id, budget.environmentParams]);

  // Upload/remove da imagem do header da aba Solar
  async function uploadSolarHeaderImage(file: File) {
    setHeaderImageUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAccessToken();
      const res = await fetch(`/api/pool-budgets/${budget.id}/solar-header-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao enviar imagem');
      }
      const data = await res.json();
      setSolarHeaderImage(data.solarHeaderImage);
      onSaved?.();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setHeaderImageUploading(false);
    }
  }

  async function removeSolarHeaderImage() {
    if (!confirm('Remover a imagem do header?')) return;
    setHeaderImageUploading(true);
    setError(null);
    try {
      await api.del(`/pool-budgets/${budget.id}/solar-header-image`);
      setSolarHeaderImage(null);
      onSaved?.();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setHeaderImageUploading(false);
    }
  }

  // Recompute solar — chamado quando o operador muda coletor/extra/temp ou clica botao.
  // v5: aceita orientacao/inclinacao/tempInicial como overrides extras pra persistir em env.
  // v5.9: preserva scrollTop do container — re-render do setSolarReport + onSaved
  // (await load() no parent) reseta o layout e jogava o scroll pro topo.
  async function recomputeSolar(
    extraPct?: number,
    collectorId?: string | null,
    extras?: { orientacaoTelhado?: string; inclinacaoTelhadoGraus?: number; temperaturaAguaInicial?: number; alturaTelhadoM?: number; areaPiscinaM2?: number; volumeM3?: number },
  ) {
    const savedScrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    setSolarRecomputing(true);
    setError(null);
    try {
      const body: {
        extraColetoresPct?: number;
        collectorProductId?: string;
        tempDesejada?: number;
        orientacaoTelhado?: string;
        inclinacaoTelhadoGraus?: number;
        temperaturaAguaInicial?: number;
        alturaTelhadoM?: number;
        areaPiscinaM2?: number;
        volumeM3?: number;
      } = {
        extraColetoresPct: extraPct ?? solarExtraPct,
        tempDesejada: Number(tempAguaDesejada),
        ...(extras ?? {}),
      };
      // v1.12.50: envia area/volume vindos do estado MANUAL do Simulador (dispArea/dispVolume
      // do SolarTab) — passados via extras. Backend usa esses overrides em vez de
      // budget.poolDimensions. Se nao vier, usa o budget (modo AUTO). NAO altera o
      // cadastro do orcamento (poolDimensions fica intacto).
      // Fallback: se extras nao traz, usa budget.poolDimensions (modo AUTO).
      if (!Number.isFinite(body.areaPiscinaM2)) {
        const fallbackArea = Number(budget.poolDimensions?.area);
        if (Number.isFinite(fallbackArea) && fallbackArea > 0) body.areaPiscinaM2 = fallbackArea;
      }
      if (!Number.isFinite(body.volumeM3)) {
        const fallbackVolume = Number(budget.poolDimensions?.volume);
        if (Number.isFinite(fallbackVolume) && fallbackVolume > 0) body.volumeM3 = fallbackVolume;
      }
      const cid = collectorId === undefined ? solarSelectedCollectorId : collectorId;
      if (cid) body.collectorProductId = cid;
      const r = await api.post<SolarReport>(`/pool-budgets/${budget.id}/solar-report/recompute`, body);
      setSolarReport(r);
      onSaved?.();
      // Restaura scroll apos o re-render (2 RAFs pra cobrir layout + repaint do zoom CSS)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = savedScrollTop;
        });
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSolarRecomputing(false);
    }
  }

  // Troca o equipamento via override manual
  async function changeEquipment(productId: string | null, qty: number = 1) {
    setChangingEquipment(true);
    setError(null);
    try {
      const r = await api.put<HeatingReport>(`/pool-budgets/${budget.id}/heating-report/equipment`, {
        productId,
        quantity: qty,
      });
      setReport(r);
      setShowEquipmentPicker(false);
      onSaved?.();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setChangingEquipment(false);
    }
  }

  // Carrega inputs do budget ao abrir
  useEffect(() => {
    if (!open) return;
    const env = budget.environmentParams ?? {};
    setUf(env.uf ?? "");
    setCidade(env.cidade ?? "");
    setTempAguaDesejada(Number(env.temperaturaAguaDesejada) || 30);
    setTempAguaInicial(typeof env.temperaturaInicialAgua === "number" ? env.temperaturaInicialAgua : "");
    setVento(normEnum(env.velocidadeVento, ["INTERNA", "NULO", "FRACO", "MODERADO", "FORTE"], "MODERADO"));
    setTipoConstrucao(normEnum(env.tipoConstrucao, ["ABERTA", "FECHADA"], "ABERTA"));
    setTipoPiscina(normEnum(env.tipoPiscina, ["PRIVATIVA", "COLETIVA"], "PRIVATIVA"));
    setCapaTermica(env.capaTermica === true || env.capaTermica === "SIM");
    setUtilizacaoAno(normEnum(env.utilizacaoAno, ["ANO_TODO", "VERAO", "INVERNO"], "ANO_TODO"));
    setUtilizacaoSemana(normEnum(env.utilizacaoSemana, ["MES_TODO", "FIM_DE_SEMANA"], "MES_TODO"));
    setHidromassagensQtd(Number(env.hidromassagensQtd) || 0);
    // Default por tipoPiscina (6h privativa, 42h coletiva) — backend tambem aplica
    const defaultHoras = (env.tipoPiscina === "COLETIVA") ? 42 : 6;
    setHidromassagemHorasSemana(env.hidromassagemHorasSemana != null ? Number(env.hidromassagemHorasSemana) : defaultHoras);
    setCascataLarguraCm(Number(env.cascataLarguraCm) || 0);
    setCascataHorasSemana(env.cascataHorasSemana != null ? Number(env.cascataHorasSemana) : defaultHoras);
    setBordaInfinitaM(Number(env.bordaInfinitaM) || 0);
    setBordaInfinitaAlturaM(Number(env.bordaInfinitaAlturaM) || 0.5);
    setBordaInfinitaVazaoLminPorM(Number(env.bordaInfinitaVazaoLminPorM) || 30);
    setBordaInfinitaHorasAtivaDia(Number(env.bordaInfinitaHorasAtivaDia) || 24);
    setHorasFuncionamentoDia(Number(env.horasFuncionamentoDia) || 15);
    setTaxaFuncionamento(Number(env.taxaFuncionamento) || 0.5);
    setObservacoes(typeof env.heatingObservacoes === "string" ? env.heatingObservacoes : "");
    // Pre-carrega dados da obra do orcamento (usado no quickMode)
    const dims = budget.poolDimensions ?? {};
    setQuickVolume(Number(dims.volume) || 0);
    setQuickArea(Number(dims.area) || 0);
    setQuickLength(Number(dims.length) || 0);
    setQuickWidth(Number(dims.width) || 0);
    setQuickMode(false); // reseta toda vez que abre
  }, [open, budget.environmentParams, budget.poolDimensions]);

  // Carrega report ao abrir (cache do backend)
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api.get<HeatingReport>(`/pool-budgets/${budget.id}/heating-report`)
      .then((r) => {
        setReport(r);
        // v1.11.81: SEMPRE recompute em background apos exibir o cache. Garante
        // que mudancas no algoritmo (impactKw, filtro de acessorios, etc) sejam
        // refletidas sem operador precisar mexer e clicar Salvar.
        api.post<HeatingReport>(`/pool-budgets/${budget.id}/heating-report/recompute`)
          .then((fresh) => setReport(fresh))
          .catch(() => { /* fallback ao cache ja exibido */ });
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [open, budget.id]);

  const ufData = useMemo(() => cities.find((c) => c.uf === uf), [cities, uf]);
  const availableCities = ufData?.cities ?? [];

  // Auto-save com debounce (v1.11.82): quando o user mexe nas horas/sem dos cards
  // de extras (Cascata/SPA/Borda), dispara save+recompute apos 800ms de inatividade.
  // Sem precisar clicar Salvar embaixo. Salva so o trio de horas — campos isolados,
  // sem mexer no resto do environmentParams.
  const debCascataHoras = useDebounce(cascataHorasSemana, 800);
  const debHidroHoras = useDebounce(hidromassagemHorasSemana, 800);
  const debBordaHoras = useDebounce(bordaInfinitaHorasAtivaDia, 800);

  useEffect(() => {
    if (!open) return;
    if (loading) return;
    if (quickMode) return; // calculo rapido nao persiste
    if (!userTouchedExtrasRef.current) return; // so quando user interagiu
    // Salva e recomputa em background
    (async () => {
      try {
        const env = { ...(budget.environmentParams ?? {}) } as Record<string, any>;
        env.cascataHorasSemana = Number(debCascataHoras);
        env.hidromassagemHorasSemana = Number(debHidroHoras);
        env.bordaInfinitaHorasAtivaDia = Number(debBordaHoras);
        await api.put(`/pool-budgets/${budget.id}`, { environmentParams: env });
        const fresh = await api.post<HeatingReport>(`/pool-budgets/${budget.id}/heating-report/recompute`);
        setReport(fresh);
        userTouchedExtrasRef.current = false; // resetar — proximo touch dispara de novo
        onSaved?.();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debCascataHoras, debHidroHoras, debBordaHoras]);

  // Wrappers que marcam userTouched=true antes de setar o state
  const touchAndSetCascata = (v: number) => { userTouchedExtrasRef.current = true; setCascataHorasSemana(v); };
  const touchAndSetHidro = (v: number) => { userTouchedExtrasRef.current = true; setHidromassagemHorasSemana(v); };
  const touchAndSetBorda = (v: number) => { userTouchedExtrasRef.current = true; setBordaInfinitaHorasAtivaDia(v); };

  // Salva environmentParams + recomputa report (modo normal)
  async function handleSaveAndRecompute() {
    if (quickMode) return handleSimulate();
    setSaving(true);
    setError(null);
    try {
      const newEnv = {
        ...(budget.environmentParams ?? {}),
        uf,
        cidade: cidade || undefined,
        temperaturaAguaDesejada: Number(tempAguaDesejada),
        temperaturaInicialAgua: tempAguaInicial === "" ? undefined : Number(tempAguaInicial),
        velocidadeVento: normEnum(vento, ["INTERNA", "NULO", "FRACO", "MODERADO", "FORTE"], "MODERADO"),
        tipoConstrucao: normEnum(tipoConstrucao, ["ABERTA", "FECHADA"], "ABERTA"),
        tipoPiscina: normEnum(tipoPiscina, ["PRIVATIVA", "COLETIVA"], "PRIVATIVA"),
        capaTermica,
        utilizacaoAno: normEnum(utilizacaoAno, ["ANO_TODO", "VERAO", "INVERNO"], "ANO_TODO"),
        utilizacaoSemana: normEnum(utilizacaoSemana, ["MES_TODO", "FIM_DE_SEMANA"], "MES_TODO"),
        hidromassagensQtd: Number(hidromassagensQtd),
        hidromassagemHorasSemana: Number(hidromassagemHorasSemana),
        cascataLarguraCm: Number(cascataLarguraCm),
        cascataHorasSemana: Number(cascataHorasSemana),
        bordaInfinitaM: Number(bordaInfinitaM),
        bordaInfinitaAlturaM: Number(bordaInfinitaAlturaM),
        bordaInfinitaVazaoLminPorM: Number(bordaInfinitaVazaoLminPorM),
        bordaInfinitaHorasAtivaDia: Number(bordaInfinitaHorasAtivaDia),
        horasFuncionamentoDia: Number(horasFuncionamentoDia),
        taxaFuncionamento: Number(taxaFuncionamento),
        heatingObservacoes: observacoes,
      };
      await api.put(`/pool-budgets/${budget.id}`, { environmentParams: newEnv });
      const r = await api.post<HeatingReport>(`/pool-budgets/${budget.id}/heating-report/recompute`);
      setReport(r);
      onSaved?.();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  // Simulacao "calculo rapido" — envia inputs livres pro backend SEM salvar.
  async function handleSimulate() {
    setSaving(true);
    setError(null);
    try {
      const inputs = {
        areaM2: Number(quickArea),
        volumeM3: Number(quickVolume),
        uf,
        cidade: cidade || undefined,
        tempAguaDesejada: Number(tempAguaDesejada),
        tempAguaInicial: tempAguaInicial === "" ? undefined : Number(tempAguaInicial),
        vento: normEnum(vento, ["INTERNA", "NULO", "FRACO", "MODERADO", "FORTE"], "MODERADO"),
        tipoConstrucao: normEnum(tipoConstrucao, ["ABERTA", "FECHADA"], "ABERTA"),
        tipoPiscina: normEnum(tipoPiscina, ["PRIVATIVA", "COLETIVA"], "PRIVATIVA"),
        capaTermica,
        utilizacaoAno: normEnum(utilizacaoAno, ["ANO_TODO", "VERAO", "INVERNO"], "ANO_TODO"),
        utilizacaoSemana: normEnum(utilizacaoSemana, ["MES_TODO", "FIM_DE_SEMANA"], "MES_TODO"),
        hidromassagensQtd: Number(hidromassagensQtd),
        hidromassagemHorasSemana: Number(hidromassagemHorasSemana),
        cascataLarguraCm: Number(cascataLarguraCm),
        cascataHorasSemana: Number(cascataHorasSemana),
        bordaInfinitaM: Number(bordaInfinitaM),
        bordaInfinitaAlturaM: Number(bordaInfinitaAlturaM),
        bordaInfinitaVazaoLminPorM: Number(bordaInfinitaVazaoLminPorM),
        bordaInfinitaHorasAtivaDia: Number(bordaInfinitaHorasAtivaDia),
        horasFuncionamentoDia: Number(horasFuncionamentoDia),
        taxaFuncionamento: Number(taxaFuncionamento),
      };
      const r = await api.post<HeatingReport>(`/pool-budgets/heating/simulate`, inputs);
      setReport(r);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  // Restaura dados da obra do orcamento (apaga overrides do quickMode)
  function restoreFromBudget() {
    const dims = budget.poolDimensions ?? {};
    setQuickVolume(Number(dims.volume) || 0);
    setQuickArea(Number(dims.area) || 0);
    setQuickLength(Number(dims.length) || 0);
    setQuickWidth(Number(dims.width) || 0);
  }

  // Estado do bloco colapsavel "Dados do projeto" (F6.4) — inicia colapsado pra
  // apresentacao limpa com cliente (so pills resumidas).
  const [projectExpanded, setProjectExpanded] = useState<boolean>(false);

  // Helper pra mostrar enums humanamente
  const labelVento: Record<string, string> = { NULO: "Sem vento", FRACO: "Fraco", MODERADO: "Moderado", FORTE: "Forte", INTERNA: "Interna" };
  const labelUtilAno: Record<string, string> = { ANO_TODO: "Ano todo", VERAO: "Verao", INVERNO: "Inverno" };
  const labelUtilSem: Record<string, string> = { MES_TODO: "Mes todo", FIM_DE_SEMANA: "So fim de semana" };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-stretch p-4">
      <div className="flex-1 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header — v1.12.54: compactado pra liberar viewport */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50">
          <div className="flex-1 min-w-0 flex items-baseline gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex-shrink-0">🔥 Simulador de Aquecimento</h2>
            <p className="text-[11px] text-slate-600 truncate">
              <span className="font-mono">{budget.code || "—"}</span> · {budget.clientPartner?.name || "—"} · {budget.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-300 bg-white hover:bg-amber-50 cursor-pointer transition">
              <input type="checkbox" checked={quickMode} onChange={(e) => setQuickMode(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-3 w-3" />
              <span className="text-[10.5px] font-semibold text-amber-900">⚡ Cálculo rápido</span>
            </label>
            <button onClick={onClose}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition leading-none">
              ✕
            </button>
          </div>
        </div>
        {quickMode && (
          <div className="bg-amber-100 border-b border-amber-300 px-6 py-2 text-xs text-amber-900">
            <strong>⚡ Modo Calculo Rapido ativo</strong> — voce pode editar dados da obra (volume/area/dim) pra simular cenarios. Alteracoes NAO sao salvas no orcamento. Para fechar, desative o toggle.
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <TabButton active={activeTab === "solar"} onClick={() => setActiveTab("solar")}>
            ☀️ Solar
          </TabButton>
          <TabButton active={activeTab === "bomba"} onClick={() => setActiveTab("bomba")}>
            🔥 Bomba de Calor
          </TabButton>
          <TabButton active={activeTab === "comparativo"} onClick={() => setActiveTab("comparativo")}>
            📊 Comparativo
          </TabButton>
        </div>

        {/* Conteudo */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900">
              ⚠ {error}
            </div>
          )}

          {activeTab === "bomba" && (
            <div className="space-y-4">
              {/* CABECALHO COLAPSAVEL — Dados do projeto (F6.4)
                  Quando minimizado: pills compactas com infos chave pra apresentacao limpa
                  Quando expandido + quickMode: inputs editaveis (simulacao livre)
                  Quando expandido + nao quickMode: read-only com link pra Editar dados */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button type="button" onClick={() => setProjectExpanded(!projectExpanded)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base">📋</span>
                    <span className="text-sm font-bold text-slate-900">Dados do projeto</span>
                    {!projectExpanded && (
                      <div className="flex flex-wrap gap-1.5 ml-3">
                        <Pill icon="📐" text={`${(budget.poolDimensions?.volume ?? 0).toFixed(0)} m³ · ${(budget.poolDimensions?.area ?? 0).toFixed(0)} m²`} tone="slate" />
                        <Pill icon="📍" text={uf ? `${uf}${cidade ? ` — ${cidade}` : ""}` : "Sem localizacao"} tone={uf ? "cyan" : "amber"} />
                        <Pill icon="🌡" text={`${tempAguaDesejada}°C`} tone="orange" />
                        <Pill icon="⛅" text={labelVento[vento] || vento} tone="slate" />
                        <Pill icon={capaTermica ? "🧱" : "☀"} text={capaTermica ? "Com capa" : "Sem capa"} tone={capaTermica ? "emerald" : "amber"} />
                        <Pill icon="📅" text={labelUtilAno[utilizacaoAno] || utilizacaoAno} tone="slate" />
                        {(hidromassagensQtd > 0 || cascataLarguraCm > 0 || bordaInfinitaM > 0) && (
                          <Pill icon="✨" text={[
                            hidromassagensQtd > 0 ? `${hidromassagensQtd} jato${hidromassagensQtd > 1 ? "s" : ""}` : null,
                            cascataLarguraCm > 0 ? `cascata ${cascataLarguraCm}cm` : null,
                            bordaInfinitaM > 0 ? `borda ${bordaInfinitaM}m` : null,
                          ].filter(Boolean).join(" · ")} tone="cyan" />
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-slate-400 text-xs">{projectExpanded ? "▲ recolher" : "▼ expandir"}</span>
                </button>

                {projectExpanded && (
                  <div className="border-t border-slate-200 p-4 space-y-4 bg-slate-50">
                    {/* === Bloco 1: Dados da obra === */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
                        <span>📐 Dados da obra</span>
                        {!quickMode && <span className="text-[10px] text-slate-400 normal-case font-normal">Vem das dimensoes do orcamento</span>}
                      </div>
                      {quickMode ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Field label="Volume (m³)"><NumInput value={quickVolume} onChange={setQuickVolume} step={0.5} min={0.1} /></Field>
                            <Field label="Area (m²)"><NumInput value={quickArea} onChange={setQuickArea} step={0.5} min={0.1} /></Field>
                            <Field label="Comprimento (m)"><NumInput value={quickLength} onChange={setQuickLength} step={0.5} min={0} /></Field>
                            <Field label="Largura (m)"><NumInput value={quickWidth} onChange={setQuickWidth} step={0.5} min={0} /></Field>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-[11px] text-amber-700">⚡ Modo Calculo Rapido — alteracoes NAO sao salvas.</div>
                            <button onClick={restoreFromBudget} type="button" className="text-[11px] text-cyan-700 hover:underline">↩ Restaurar dados do orcamento</button>
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <ReadField label="Volume" value={`${(budget.poolDimensions?.volume ?? 0).toFixed(2)} m³`} />
                          <ReadField label="Area superficie" value={`${(budget.poolDimensions?.area ?? 0).toFixed(2)} m²`} />
                          <ReadField label="Comprimento" value={`${budget.poolDimensions?.length ?? "—"} m`} />
                          <ReadField label="Largura" value={`${budget.poolDimensions?.width ?? "—"} m`} />
                        </div>
                      )}
                    </div>

                    {/* === Bloco 2: Localizacao e clima === */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
                        <span>📍 Localizacao e clima</span>
                        {!quickMode && <span className="text-[10px] text-slate-400 normal-case font-normal">Edite via "Editar dados" do orcamento</span>}
                      </div>
                      {quickMode ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Field label="Estado (UF)">
                            <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); }}
                              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                              <option value="">Selecione...</option>
                              {cities.map((c) => <option key={c.uf} value={c.uf}>{c.uf} — {c.ufName}</option>)}
                            </select>
                          </Field>
                          <Field label="Cidade-clima">
                            <select value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={!uf}
                              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50">
                              <option value="">{availableCities[0] ? `${availableCities[0]} (capital)` : "—"}</option>
                              {availableCities.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </Field>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <ReadField label="Estado" value={uf || "—"} />
                          <ReadField label="Cidade-clima" value={cidade || (report?.cityResolved?.name ? `${report.cityResolved.name} (capital)` : "—")} />
                        </div>
                      )}
                      {report?.cityResolved && (
                        <div className="mt-2 text-[11px] text-cyan-700">Cidade-clima em uso: <strong>{report.cityResolved.name} / {report.cityResolved.uf}</strong></div>
                      )}
                    </div>

                    {/* === Bloco 3: Dados de uso === */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
                        <span>🌡 Dados de uso</span>
                        {!quickMode && <span className="text-[10px] text-slate-400 normal-case font-normal">Edite via "Editar dados" do orcamento</span>}
                      </div>
                      {quickMode ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Field label="Temp. agua desejada (°C)"><NumInput value={tempAguaDesejada} onChange={setTempAguaDesejada} step={1} min={20} max={42} /></Field>
                            <Field label="Temp. agua inicial (°C)">
                              <input type="number" value={tempAguaInicial === "" ? "" : String(tempAguaInicial)}
                                onChange={(e) => setTempAguaInicial(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
                            </Field>
                            <Field label="Velocidade vento">
                              <select value={vento} onChange={(e) => setVento(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                                {VENTO_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Tipo construcao">
                              <select value={tipoConstrucao} onChange={(e) => setTipoConstrucao(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                                {TIPO_CONSTRUCAO_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Capa termica">
                              <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={capaTermica} onChange={(e) => setCapaTermica(e.target.checked)} className="rounded border-slate-300 text-cyan-600" />
                                <span>{capaTermica ? "Sim" : "Nao"}</span>
                              </label>
                            </Field>
                            <Field label="Tipo piscina">
                              <select value={tipoPiscina} onChange={(e) => setTipoPiscina(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                                {TIPO_PISCINA_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Utilizacao ano">
                              <select value={utilizacaoAno} onChange={(e) => setUtilizacaoAno(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                                {UTILIZACAO_ANO_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Utilizacao semana">
                              <select value={utilizacaoSemana} onChange={(e) => setUtilizacaoSemana(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                                {UTILIZACAO_SEMANA_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                              </select>
                            </Field>
                          </div>
                          {/* Extras editaveis em quickMode */}
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700 mb-2">💦 Hidromassagem</div>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Qtd jatos"><NumInput value={hidromassagensQtd} onChange={setHidromassagensQtd} step={1} min={0} /></Field>
                              <Field label="Horas ligada/semana"><NumInput value={hidromassagemHorasSemana} onChange={setHidromassagemHorasSemana} step={1} min={0} max={168} /></Field>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">Default 2h/semana = uso casual. 168h = sempre ligada. Peso no calculo: horas/168.</div>
                          </div>
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700 mb-2">🌊 Cascata</div>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Largura (cm)"><NumInput value={cascataLarguraCm} onChange={setCascataLarguraCm} step={1} min={0} /></Field>
                              <Field label="Horas ligada/semana"><NumInput value={cascataHorasSemana} onChange={setCascataHorasSemana} step={1} min={0} max={168} /></Field>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">Default 2h/semana = uso decorativo casual. Peso no calculo: horas/168.</div>
                          </div>
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700 mb-2">💧 Borda infinita</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <Field label="Comprimento (m)"><NumInput value={bordaInfinitaM} onChange={setBordaInfinitaM} step={0.5} min={0} /></Field>
                              <Field label="Altura queda (m)"><NumInput value={bordaInfinitaAlturaM} onChange={setBordaInfinitaAlturaM} step={0.1} min={0.1} max={3} /></Field>
                              <Field label="Vazao (L/min·m)"><NumInput value={bordaInfinitaVazaoLminPorM} onChange={setBordaInfinitaVazaoLminPorM} step={5} min={5} max={120} /></Field>
                              <Field label="Horas/dia ativa"><NumInput value={bordaInfinitaHorasAtivaDia} onChange={setBordaInfinitaHorasAtivaDia} step={1} min={0} max={24} /></Field>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <Field label="Horas funcionamento/dia"><NumInput value={horasFuncionamentoDia} onChange={setHorasFuncionamentoDia} step={1} min={1} max={24} /></Field>
                            <Field label="Taxa funcionamento (0-1)"><NumInput value={taxaFuncionamento} onChange={setTaxaFuncionamento} step={0.1} min={0.1} max={1} /></Field>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <ReadField label="Temp. desejada" value={`${tempAguaDesejada}°C`} />
                            <ReadField label="Temp. inicial" value={tempAguaInicial === "" ? "auto (clima)" : `${tempAguaInicial}°C`} />
                            <ReadField label="Vento" value={labelVento[vento] || vento} />
                            <ReadField label="Construcao" value={tipoConstrucao === "ABERTA" ? "Aberta" : "Fechada"} />
                            <ReadField label="Capa termica" value={capaTermica ? "Sim" : "Nao"} />
                            <ReadField label="Tipo piscina" value={tipoPiscina === "PRIVATIVA" ? "Privativa" : "Coletiva"} />
                            <ReadField label="Utilizacao ano" value={labelUtilAno[utilizacaoAno] || utilizacaoAno} />
                            <ReadField label="Utilizacao semana" value={labelUtilSem[utilizacaoSemana] || utilizacaoSemana} />
                          </div>
                          {/* Extras agregados das linhas */}
                          {(hidromassagensQtd > 0 || cascataLarguraCm > 0 || bordaInfinitaM > 0) && (
                            <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                              <div className="text-[11px] font-semibold text-cyan-900 mb-1.5">✨ Extras (agregados das linhas das etapas)</div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <div className="text-[10px] text-cyan-700">Hidromassagens</div>
                                  <div className="font-bold text-cyan-900">{hidromassagensQtd} jato(s) · {hidromassagemHorasSemana}h/sem</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-cyan-700">Cascata (largura total)</div>
                                  <div className="font-bold text-cyan-900">{cascataLarguraCm} cm · {cascataHorasSemana}h/sem</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-cyan-700">Borda infinita</div>
                                  <div className="font-bold text-cyan-900">{bordaInfinitaM} m · {bordaInfinitaAlturaM}m queda · {bordaInfinitaHorasAtivaDia}h/dia</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Botao de acao (so em quickMode) */}
                    {quickMode && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleSaveAndRecompute} disabled={saving || loading || !uf}
                          className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
                          {saving ? "Calculando..." : "⚡ Calcular (nao salva)"}
                        </button>
                      </div>
                    )}
                    {!quickMode && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Edite os dados no orcamento (botao "Editar dados" no header). O Simulador recalcula automaticamente.</span>
                        <button type="button" onClick={handleSaveAndRecompute} disabled={saving || loading}
                          className="text-[11px] text-cyan-700 hover:underline disabled:text-slate-400">
                          {saving ? "Recalculando..." : "↻ Recalcular agora"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECAO 4 — Dimensionamento */}
              <Section title="4. Dimensionamento" icon="📊">
                {loading ? (
                  <div className="text-sm text-slate-500">Carregando relatorio...</div>
                ) : report ? (
                  <>
                    {/* Card "Calor necessario" — v1.11.81: agora com cards de extras AO LADO
                        (so quando identificados), mostrando contribuicao kW de cada um. Layout
                        responsivo: em telas pequenas empilha, em desktop fica lado a lado. */}
                    {(() => {
                      const ed = report.extrasDetected;
                      const hasAnyExtra = ed && (
                        ed.cascata.status !== "NAO_IDENTIFICADA" ||
                        ed.hidromassagem.status !== "NAO_IDENTIFICADA" ||
                        ed.bordaInfinita.status !== "NAO_IDENTIFICADA"
                      );
                      return (
                        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-cyan-50 via-orange-50 to-emerald-50 px-4 py-3 mb-3">
                          <div className={`grid gap-4 items-center ${hasAnyExtra ? "lg:grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
                            {/* Bloco esquerdo: numeros principais */}
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Calor necessario · mes critico</div>
                              <div className="flex items-baseline gap-3 flex-wrap">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold text-cyan-700 tabular-nums">{report.calorNecessarioKcalH.toLocaleString("pt-BR")}</span>
                                  <span className="text-xs font-semibold text-cyan-700">Kcal/h</span>
                                </div>
                                <span className="text-slate-300">·</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold text-orange-700 tabular-nums">{report.qtotalMaxKw.toFixed(1)}</span>
                                  <span className="text-xs font-semibold text-orange-700">kW</span>
                                </div>
                                <span className="text-slate-300">·</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold text-emerald-700 tabular-nums">{report.calorNecessarioBtuH.toLocaleString("pt-BR")}</span>
                                  <span className="text-xs font-semibold text-emerald-700">Btu/h</span>
                                </div>
                              </div>
                            </div>
                            {/* Bloco direito: cards de extras (so identificados) */}
                            {hasAnyExtra && (
                              <div className="flex flex-wrap gap-2 lg:justify-end">
                                {ed!.cascata.status !== "NAO_IDENTIFICADA" && (
                                  <ExtraImpactCard
                                    icon="🌊"
                                    title="Cascata"
                                    extra={ed!.cascata}
                                    horasValue={cascataHorasSemana}
                                    onChangeHoras={touchAndSetCascata}
                                  />
                                )}
                                {ed!.hidromassagem.status !== "NAO_IDENTIFICADA" && (
                                  <ExtraImpactCard
                                    icon="💦"
                                    title="SPA"
                                    extra={ed!.hidromassagem}
                                    horasValue={hidromassagemHorasSemana}
                                    onChangeHoras={touchAndSetHidro}
                                  />
                                )}
                                {ed!.bordaInfinita.status !== "NAO_IDENTIFICADA" && (
                                  <ExtraImpactCard
                                    icon="🏞"
                                    title="Borda"
                                    extra={ed!.bordaInfinita}
                                    horasValue={bordaInfinitaHorasAtivaDia}
                                    onChangeHoras={touchAndSetBorda}
                                    hoursLabel="h/dia"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tabela mensal compacta */}
                    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Mes</th>
                            {MESES.map((m) => <th key={m} className="px-1.5 py-1.5 text-center font-semibold text-slate-700">{m}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-2 py-1.5 font-medium text-slate-700">Temp ar (°C)</td>
                            {report.monthlyHeatLoss.map((m, i) => (
                              <td key={i} className="px-1.5 py-1.5 text-center text-slate-600 tabular-nums">{m.tempAr.toFixed(1)}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-2 py-1.5 font-medium text-slate-700">Umidade</td>
                            {report.monthlyHeatLoss.map((m, i) => (
                              <td key={i} className="px-1.5 py-1.5 text-center text-slate-600 tabular-nums">{(m.humidity * 100).toFixed(0)}%</td>
                            ))}
                          </tr>
                          <tr className="bg-orange-50">
                            <td className="px-2 py-1.5 font-semibold text-orange-900">Qtotal (kW)</td>
                            {report.monthlyHeatLoss.map((m, i) => {
                              const isCritical = i === report.qtotalMonthCritical;
                              return (
                                <td key={i} className={`px-1.5 py-1.5 text-center tabular-nums font-mono ${isCritical ? "bg-orange-200 font-bold text-orange-900" : "text-orange-900"}`}>
                                  {m.qtotalKw.toFixed(1)}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Mes critico: <strong>{MESES[report.qtotalMonthCritical]}</strong> ({report.monthlyHeatLoss[report.qtotalMonthCritical].qtotalKw.toFixed(1)} kW). Aplicada margem de seguranca conforme utilizacao.
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Preencha dados e clique em "Salvar e calcular" pra ver o dimensionamento.</div>
                )}
              </Section>

              {/* SECAO 5 — Equipamento selecionado */}
              <Section title="5. Equipamento selecionado" icon="🔧">
                {report?.selectedEquipment ? (
                  <div className="flex items-start gap-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                          {report.selectedEquipment.fromOverride ? "Equipamento (escolha manual)" :
                            report.selectedEquipment.fromItemCellRef ? "Equipamento da linha do orcamento" : "Modelo recomendado"}
                        </div>
                        {report.selectedEquipment.fromOverride && (
                          <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-900 border border-violet-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            ✋ MANUAL
                          </span>
                        )}
                        {report.selectedEquipment.fromItemCellRef && (
                          <span className="inline-flex items-center gap-1 bg-cyan-100 text-cyan-900 border border-cyan-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            📎 {report.selectedEquipment.fromItemCellRef}
                          </span>
                        )}
                        {report.selectedEquipment.quantity > 1 && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            ⚡ {report.selectedEquipment.quantity}× UNIDADES EM PARALELO
                          </span>
                        )}
                      </div>
                      {/* Dropdown clickable no nome + input Qtd ao lado (v1.11.87 — repos.) */}
                      <div className="mt-1 flex items-center gap-3 flex-wrap">
                        <div className="relative inline-flex items-center">
                          <button type="button" onClick={() => setShowEquipmentPicker(!showEquipmentPicker)}
                            className="flex items-center gap-2 text-xl font-bold text-emerald-900 hover:text-emerald-700 transition text-left">
                            <span>{report.selectedEquipment.modelName}</span>
                            <span className="text-sm text-emerald-700">{showEquipmentPicker ? "▲" : "▼"}</span>
                          </button>
                        {showEquipmentPicker && (
                          <div className="absolute z-50 left-0 top-full mt-2 rounded-xl border-2 border-emerald-200 bg-white shadow-xl p-3 max-h-96 overflow-y-auto w-[560px] max-w-[90vw]">
                            <div className="text-[11px] font-semibold uppercase text-slate-500 mb-2">Trocar equipamento</div>
                            {report.selectedEquipment.fromOverride && (
                              <button type="button" onClick={() => changeEquipment(null)} disabled={changingEquipment}
                                className="w-full text-left px-3 py-2 mb-2 rounded-lg border border-violet-300 bg-violet-50 hover:bg-violet-100 text-sm font-semibold text-violet-900 disabled:opacity-50">
                                ↺ Voltar pra selecao automatica
                              </button>
                            )}
                            {/* Lista de candidatos com input de quantidade por linha (v1.11.84).
                                Antes tinha um seletor global de quantidade no topo e duplicava cada
                                equipamento como "2× X23-09C, 3× X23-09C..." — UI confusa. Agora:
                                lista simples dos equipamentos UNICOS, cada um com Qtd: [_] ao lado. */}
                            <div className="space-y-1">
                              {candidates.length === 0 && (
                                <div className="text-xs text-slate-500 px-2 py-3">
                                  Nenhum produto cadastrado tipo Bomba de Calor com kcalHNominal preenchido.
                                </div>
                              )}
                              {[...candidates].sort((a, b) => a.kcalHNominal - b.kcalHNominal).map((c) => (
                                <EquipmentCandidateRow
                                  key={c.productId}
                                  candidate={c}
                                  isCurrentSelected={c.productId === report.selectedEquipment?.productId}
                                  currentSelectedQty={report.selectedEquipment?.quantity ?? 1}
                                  onSelect={(qty) => changeEquipment(c.productId, qty)}
                                  disabled={changingEquipment}
                                />
                              ))}
                            </div>
                            {changingEquipment && (
                              <div className="mt-2 text-center text-[11px] text-slate-500">Recalculando...</div>
                            )}
                          </div>
                        )}
                        </div>
                        {/* Input Qtd ao lado do nome (v1.11.86) — debounce 600ms dispara
                            selectEquipmentOverride com mesmo productId + nova qty.
                            Sincronia bidirecional vai propagar pra linha L44 do orcamento. */}
                        <EquipmentQuantityInput
                          productId={report.selectedEquipment.productId}
                          currentQty={report.selectedEquipment.quantity}
                          onChangeQty={(newQty) => changeEquipment(report.selectedEquipment!.productId, newQty)}
                          disabled={changingEquipment}
                        />
                      </div>
                      {report.selectedEquipment.quantity > 1 && (
                        <div className="mt-1 text-[11px] text-amber-800">
                          Nenhum modelo unico cobre a demanda. Sistema sugere {report.selectedEquipment.quantity} unidades do maior modelo disponivel operando em paralelo. Capacidade combinada = {report.selectedEquipment.kcalHNominal?.toLocaleString("pt-BR")} Kcal/h.
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <SmallStat label="Capacidade" value={`${report.selectedEquipment.kcalHNominal?.toLocaleString("pt-BR")} Kcal/h`} />
                        {report.selectedEquipment.kwNominal && <SmallStat label="Potencia termica" value={`${report.selectedEquipment.kwNominal} kW`} />}
                        {report.selectedEquipment.ratedInputPowerKW && <SmallStat label="Consumo medio" value={`${report.selectedEquipment.ratedInputPowerKW} kW`} />}
                      </div>

                      {/* COP em 3 condicoes */}
                      <div className="mt-3 rounded-lg bg-white border border-emerald-200 p-2">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mb-1.5">Coeficiente de Performance (COP)</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {report.selectedEquipment.copMax !== undefined && report.selectedEquipment.copMax > 0 && (
                            <div className="rounded bg-slate-50 px-2 py-1.5">
                              <div className="text-[10px] text-slate-500">Maximo (marketing)</div>
                              <div className="font-bold text-slate-700 tabular-nums">{report.selectedEquipment.copMax}</div>
                              <div className="text-[9px] text-slate-400">ar 26°C, carga baixa</div>
                            </div>
                          )}
                          {report.selectedEquipment.copAt50Air26 !== undefined && report.selectedEquipment.copAt50Air26 > 0 && (
                            <div className="rounded bg-amber-50 px-2 py-1.5">
                              <div className="text-[10px] text-amber-700">Verao (50% carga)</div>
                              <div className="font-bold text-amber-900 tabular-nums">{report.selectedEquipment.copAt50Air26}</div>
                              <div className="text-[9px] text-amber-700/70">ar 26°C real</div>
                            </div>
                          )}
                          {report.selectedEquipment.copAt50Air15 !== undefined && report.selectedEquipment.copAt50Air15 > 0 && (
                            <div className="rounded bg-cyan-50 px-2 py-1.5 ring-1 ring-cyan-200">
                              <div className="text-[10px] text-cyan-700">Inverno (50% carga) ✓</div>
                              <div className="font-bold text-cyan-900 tabular-nums">{report.selectedEquipment.copAt50Air15}</div>
                              <div className="text-[9px] text-cyan-700/70">ar 15°C — usado no calculo</div>
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 text-[10px] text-slate-500">
                          O COP de marketing eh teorico em condicao ideal. Pra calculo conservador de consumo no Brasil, usamos o COP em ar 15°C.
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-emerald-700">
                        Carga: <strong>{(report.selectedEquipment.loadRatio * 100).toFixed(0)}%</strong>
                        {report.selectedEquipment.isAdequate
                          ? <span className="ml-2 text-emerald-700">✓ Folga adequada (30-70%)</span>
                          : <span className="ml-2 text-amber-700">⚠ Fora da faixa ideal</span>}
                      </div>
                      {report.timeToHeatInfeasible ? (
                        <div className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                          <strong>⛔ Equipamento nao consegue aquecer a piscina nas condicoes atuais.</strong>
                          <div className="mt-0.5">A perda termica continua (evaporacao + extras como borda infinita) excede a capacidade do modelo selecionado. Considere: reduzir a temperatura desejada, adicionar capa termica, ou escolher equipamento de maior capacidade.</div>
                        </div>
                      ) : report.timeToHeatHours !== undefined && report.timeToHeatHours > 0 && isFinite(report.timeToHeatHours) ? (
                        <div className={`mt-2 text-xs ${report.timeToHeatHours > 48 ? "text-amber-800" : "text-emerald-800"}`}>
                          Tempo de elevacao: <strong>{Math.floor(report.timeToHeatHours)}h {Math.round((report.timeToHeatHours % 1) * 60)}min</strong>
                          {report.degreesPerHour && <> · {report.degreesPerHour.toFixed(2)} °C/h</>}
                          {report.timeToHeatHours > 48 && <span className="ml-2">⚠ Tempo elevado — folga apertada, perdas continuas pesam.</span>}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <strong>Nenhum equipamento compativel no catalogo.</strong>
                    <div className="mt-1 text-xs">
                      Cadastre produtos com <code className="rounded bg-amber-100 px-1">poolType = "Bomba de Calor"</code> e <code className="rounded bg-amber-100 px-1">technicalSpecs.kcalHNominal</code> preenchido.
                    </div>
                  </div>
                )}
              </Section>

              {/* SECAO 6 — Consumo mensal e custos */}
              <Section title="6. Consumo mensal e custos estimados" icon="💰">
                {report?.monthlyConsumption && report.monthlyConsumption.length > 0 ? (
                  <>
                    {/* 4 cards de totais */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <BigStatLegacy label="Consumo anual" value={(report.annualKwh ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} unit="kWh/ano" emphasis="cyan" />
                      <BigStatLegacy label="Custo medio mensal" value={fmtBRL(Math.round((report.annualCostBRLCents ?? 0) / 12))} unit="por mes" emphasis="orange" />
                      <BigStatLegacy label="Custo anual operacao" value={fmtBRL(report.annualCostBRLCents ?? 0)} unit="por ano" emphasis="orange" />
                      <BigStatLegacy label="Custo aquec. inicial" value={fmtBRL(report.initialHeatingCostBRLCents ?? 0)} unit="1a vez" emphasis="emerald" />
                    </div>

                    {/* Tabela mensal */}
                    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-semibold text-slate-700">Mes</th>
                            <th className="px-3 py-1.5 text-right font-semibold text-slate-700">Qtotal (kW)</th>
                            <th className="px-3 py-1.5 text-right font-semibold text-slate-700">Consumo (kWh)</th>
                            <th className="px-3 py-1.5 text-right font-semibold text-slate-700">Custo (R$)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.monthlyConsumption.map((m) => {
                            const qm = report.monthlyHeatLoss[m.monthIndex];
                            const isCritical = m.monthIndex === report.qtotalMonthCritical;
                            return (
                              <tr key={m.monthIndex} className={isCritical ? "bg-orange-50" : ""}>
                                <td className="px-3 py-1.5 font-medium text-slate-700">{m.monthName}{isCritical && <span className="ml-2 text-[10px] text-orange-700">(critico)</span>}</td>
                                <td className="px-3 py-1.5 text-right text-orange-900 tabular-nums">{qm.qtotalKw.toFixed(1)}</td>
                                <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">{m.kwhConsumido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 tabular-nums">{fmtBRL(m.custoBRLCents)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-100 font-bold">
                            <td className="px-3 py-2 text-slate-900">Total anual</td>
                            <td className="px-3 py-2 text-right text-orange-900 tabular-nums">—</td>
                            <td className="px-3 py-2 text-right text-slate-900 tabular-nums">{(report.annualKwh ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                            <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">{fmtBRL(report.annualCostBRLCents ?? 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Calculo usa tarifa de energia configurada em <a href="/settings/energy-tariff" className="text-cyan-700 hover:underline" target="_blank" rel="noopener">Configuracoes → Tarifas de Energia</a>.
                      Horas: {horasFuncionamentoDia}h/dia · Taxa: {(taxaFuncionamento * 100).toFixed(0)}%.
                    </div>
                  </>
                ) : report?.selectedEquipment ? (
                  <div className="text-sm text-slate-500">
                    Equipamento sem <code className="rounded bg-slate-100 px-1">ratedInputPowerKW</code> no cadastro — nao foi possivel estimar consumo. Adicione o campo no <code className="rounded bg-slate-100 px-1">technicalSpecs</code> do produto.
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Calculo de consumo requer equipamento selecionado.</div>
                )}
              </Section>

              {/* SECAO 7 — Observacoes */}
              <Section title="7. Observacoes" icon="📝">
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4}
                  placeholder="Anote condicoes especiais da obra, premissas de calculo, recomendacoes ao cliente, etc. Este texto aparece no PDF do orcamento."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none resize-y" />
                <div className="mt-1 text-[11px] text-slate-500">
                  Salvo junto com os outros campos ao clicar em "Salvar e calcular".
                </div>
              </Section>
            </div>
          )}

          {activeTab === "solar" && (
            <SolarTab
              budget={budget}
              report={solarReport}
              loading={solarLoading}
              recomputing={solarRecomputing}
              collectors={solarCollectors}
              extraPct={solarExtraPct}
              setExtraPct={setSolarExtraPct}
              selectedCollectorId={solarSelectedCollectorId}
              setSelectedCollectorId={setSolarSelectedCollectorId}
              selectedMonthIdx={selectedMonthIdx}
              setSelectedMonthIdx={setSelectedMonthIdx}
              uf={uf}
              cidade={cidade}
              setUf={setUf}
              setCidade={setCidade}
              availableUfs={cities}
              availableCities={availableCities}
              capaTermica={capaTermica}
              setCapaTermica={setCapaTermica}
              vento={vento}
              setVento={setVento}
              tempAguaDesejada={tempAguaDesejada}
              setTempAguaDesejada={setTempAguaDesejada}
              onRecompute={recomputeSolar}
              headerImage={solarHeaderImage}
              headerImageUploading={headerImageUploading}
              onUploadHeaderImage={uploadSolarHeaderImage}
              onRemoveHeaderImage={removeSolarHeaderImage}
              catalog={catalog ?? []}
              coletorRule={solarColetorRule}
              bombaRule={solarBombaRule}
              onSaveColetorRule={saveSolarColetorRule}
              onSaveBombaRule={saveSolarBombaRule}
            />
          )}

          {activeTab === "comparativo" && (
            <div className="space-y-4">
              <Section title="Comparativo de custos por fonte de energia" icon="📊">
                {report?.comparativo && report.comparativo.length > 0 ? (
                  <ComparativoChart comparativo={report.comparativo} />
                ) : (
                  <div className="text-sm text-slate-500">
                    {report?.selectedEquipment
                      ? "Comparativo indisponivel — requer equipamento com ratedInputPowerKW e tarifa de energia configurada."
                      : "Selecione equipamento na aba 'Bomba de Calor' pra gerar o comparativo."}
                  </div>
                )}
              </Section>

              <Section title="Como o comparativo eh calculado" icon="ℹ️">
                <div className="text-xs text-slate-600 space-y-2">
                  <p>Compara o custo anual em diferentes fontes de aquecimento pra a mesma necessidade calorica:</p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li><strong>Bomba de Calor</strong>: consumo eletrico ÷ COP do equipamento (em geral economiza 70-85% vs aquecedor eletrico direto)</li>
                    <li><strong>GLP</strong>: poder calorifico 11.100 Kcal/Kg × eficiencia 84% (botijao P13 dividido por 13Kg)</li>
                    <li><strong>Gas Natural</strong>: poder calorifico 8.800 Kcal/m³ × eficiencia 70%</li>
                    <li><strong>Eletrico</strong>: resistencia direta, eficiencia 95%, sem COP (consumo = energia)</li>
                  </ul>
                  <p className="pt-1">Tarifas configuradas em <a href="/settings/energy-tariff" className="text-cyan-700 hover:underline" target="_blank" rel="noopener">Configuracoes → Tarifas de Energia</a>.</p>
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Aba Solar (Fase 5 + v2: layout fiel a planilha + PDF) ============

const SOLAR_MONTH_NAMES_FULL = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function SolarTab({
  budget, report, loading, recomputing, collectors,
  extraPct, setExtraPct, selectedCollectorId, setSelectedCollectorId,
  selectedMonthIdx, setSelectedMonthIdx,
  uf, cidade, setUf, setCidade, availableUfs, availableCities,
  capaTermica, setCapaTermica, vento, setVento,
  tempAguaDesejada, setTempAguaDesejada,
  onRecompute,
  headerImage, headerImageUploading, onUploadHeaderImage, onRemoveHeaderImage,
  catalog,
  coletorRule, bombaRule, onSaveColetorRule, onSaveBombaRule,
}: {
  budget: BudgetForHeating;
  report: SolarReport | null;
  loading: boolean;
  recomputing: boolean;
  collectors: SolarCollectorCandidate[];
  extraPct: number;
  setExtraPct: (n: number) => void;
  selectedCollectorId: string | null;
  setSelectedCollectorId: (id: string | null) => void;
  selectedMonthIdx: number;
  setSelectedMonthIdx: (i: number) => void;
  uf: string;
  cidade: string;
  setUf: (v: string) => void;
  setCidade: (v: string) => void;
  availableUfs: HeatingCity[];
  availableCities: string[];
  capaTermica: boolean;
  setCapaTermica: (v: boolean) => void;
  vento: string;
  setVento: (v: string) => void;
  tempAguaDesejada: number;
  setTempAguaDesejada: (n: number) => void;
  onRecompute: (extraPct?: number, collectorId?: string | null, extras?: { orientacaoTelhado?: string; inclinacaoTelhadoGraus?: number; temperaturaAguaInicial?: number; alturaTelhadoM?: number; areaPiscinaM2?: number; volumeM3?: number }) => void | Promise<void>;
  headerImage: string | null;
  headerImageUploading: boolean;
  onUploadHeaderImage: (file: File) => void | Promise<void>;
  onRemoveHeaderImage: () => void | Promise<void>;
  catalog: CatalogConfig[];
  coletorRule: AutoSelectRule | null;
  bombaRule: AutoSelectRule | null;
  onSaveColetorRule: (rule: AutoSelectRule | null) => void | Promise<void>;
  onSaveBombaRule: (rule: AutoSelectRule | null) => void | Promise<void>;
}) {
  const dims = budget.poolDimensions ?? {};
  const area = Number(dims.area) || 0;
  const volume = Number(dims.volume) || 0;
  const len = Number(dims.length) || 0;
  const wid = Number(dims.width) || 0;
  const profMin = Number(dims.depthMin ?? dims.profundidadeMinima) || 0;
  const profMax = Number(dims.depthMax ?? dims.profundidadeMaxima ?? dims.depth) || 0;
  const tipoPiscinaTxt = (budget.environmentParams as any)?.tipoPiscina ?? "PRIVATIVA";

  // Orientacao + inclinacao do telhado + temperatura inicial (UI only por enquanto — serao persistidos
  // em environmentParams na fase futura quando o motor do solar usar esses dados no calculo)
  const initOrient = (budget.environmentParams as any)?.orientacaoTelhado ?? "N";
  const initIncl = Number((budget.environmentParams as any)?.inclinacaoTelhadoGraus) || 20;
  const initTempIni = Number((budget.environmentParams as any)?.temperaturaAguaInicial) || 22;
  // v1.12.34: bloco Tubulacao. Comprimento + Desnivel sao inputs do operador.
  // Backend calcula altura manometrica total (perda dinamica + desnivel) via
  // Darcy-Weisbach + Haaland (igual planilha Solis). Resultado persiste em
  // environmentParams.solarPipe e tambem em environmentParams.alturaTelhadoM
  // (que alimenta a var alturaTelhadoMca pra auto-selecao da bomba).
  const initPipe = (budget.environmentParams as any)?.solarPipe ?? {};
  const initPipeComprimento = Number(initPipe?.inputs?.comprimentoM) || 0;
  const initPipeDesnivel = Number(initPipe?.inputs?.desnivelM) || 0;
  const initPipeResult = initPipe?.result ?? null;
  const [orientacaoTelhado, setOrientacaoTelhado] = useState<string>(initOrient);
  const [inclinacaoTelhado, setInclinacaoTelhado] = useState<number>(initIncl);
  const [temperaturaInicial, setTemperaturaInicial] = useState<number>(initTempIni);
  const [pipeComprimento, setPipeComprimento] = useState<number>(initPipeComprimento);
  const [pipeDesnivel, setPipeDesnivel] = useState<number>(initPipeDesnivel);
  const [pipeResult, setPipeResult] = useState<any | null>(initPipeResult);
  const [pipeRecomputing, setPipeRecomputing] = useState(false);

  // v1.12.43: dropdown de candidatos a bomba. Substitui a string fixa "Bomba recomendada"
  // por lista real do catalogo filtrada pela bombaRule (vazaoSolarM3h + alturaTelhadoMca).
  // Backend interpola pumpCurve em vazaoM3h/pressaoTrabalhoMca quando candidato tem curva.
  interface BombaCandidate {
    productId: string;
    description: string;
    salePriceCents: number;
    poolType: string | null;
    imageUrl: string | null;
    vazaoM3h: number;
    pressaoTrabalhoMca: number;
    potenciaCv: number | null;
    hasPumpCurve: boolean;
    indicator: { value: number; label: string; color: string; unit: string } | null;
  }
  const initSelectedBombaId = (budget.environmentParams as any)?.solarReport?.selectedBombaId ?? null;
  const [bombaCandidates, setBombaCandidates] = useState<BombaCandidate[]>([]);
  const [selectedBombaId, setSelectedBombaId] = useState<string | null>(initSelectedBombaId);
  const [bombaCandidatesLoading, setBombaCandidatesLoading] = useState(false);

  // Carrega candidatos sempre que ha solarReport + alturaTelhadoMca disponiveis.
  // Re-roda quando pipeResult muda (altura nova) ou report.vazaoTotalM3h muda.
  useEffect(() => {
    if (!report || !report.vazaoTotalM3h || report.vazaoTotalM3h <= 0) {
      setBombaCandidates([]);
      return;
    }
    let cancelled = false;
    setBombaCandidatesLoading(true);
    api.get<{ candidates: BombaCandidate[] }>(`/pool-budgets/${budget.id}/solar-bomba-candidates`)
      .then((res) => {
        if (cancelled) return;
        setBombaCandidates(res?.candidates ?? []);
        // Se nao tem selecao salva, ou a selecao salva nao passa mais na regra,
        // adota o primeiro candidato (default da regra).
        if (res?.candidates && res.candidates.length > 0) {
          const stillValid = selectedBombaId && res.candidates.some((c) => c.productId === selectedBombaId);
          if (!stillValid) setSelectedBombaId(res.candidates[0].productId);
        } else {
          setSelectedBombaId(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBombaCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setBombaCandidatesLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget.id, report?.vazaoTotalM3h, pipeResult?.alturaManometricaTotal, bombaRule?.where, bombaRule?.orderBy, bombaRule?.filterPoolType, bombaRule?.filterDescription]);

  async function handleSelectBomba(productId: string | null) {
    setSelectedBombaId(productId);
    try {
      await api.post(`/pool-budgets/${budget.id}/solar-bomba-selection`, { productId });
    } catch (err) {
      console.warn('Falha ao salvar selectedBombaId:', err);
    }
  }

  async function recomputePipe(overrides?: { comprimentoM?: number; desnivelM?: number; diametroMm?: number | null }) {
    const comp = overrides?.comprimentoM ?? pipeComprimento;
    const desn = overrides?.desnivelM ?? pipeDesnivel;
    if (comp <= 0 || desn < 0) return;
    setPipeRecomputing(true);
    try {
      const body: any = { comprimentoM: comp, desnivelM: desn };
      // diametroMm: undefined = auto-pick. number = forca o diametro. null = volta pra auto.
      if (overrides && 'diametroMm' in overrides && overrides.diametroMm) {
        body.diametroMm = overrides.diametroMm;
      }
      const r = await api.post<{ inputs: any; result: any }>(`/pool-budgets/${budget.id}/solar-pipe/recompute`, body);
      setPipeResult(r.result);
    } catch {
      // silencia — se vazaoM3h for 0 (Simulador nao rodou ainda), backend pode dar erro
    } finally {
      setPipeRecomputing(false);
    }
  }

  // v5.5 — Tipo piscina + Tipo construção + Modos de dimensão/configuração (UI only por enquanto).
  // Modo AUTOMATICO: campos vem do orcamento, readonly, cor amber (padrao).
  // Modo MANUAL: libera edicao + cor verde nos cards highlight (Area/Volume e Temp Inicial/Final).
  const initTipoPisc = (budget.environmentParams as any)?.tipoPiscina ?? "PRIVATIVA";
  const initTipoConstr = (budget.environmentParams as any)?.tipoConstrucao ?? "ABERTA";
  // v1.12.52: se ha solarOverride salvo, o modo MANUAL e inferido automaticamente.
  const initModoDim = (budget.environmentParams as any)?.modoDimensao
    ?? ((budget.environmentParams as any)?.solarOverride ? "MANUAL" : "AUTOMATICO");
  const initModoCfg = (budget.environmentParams as any)?.modoConfigAquec ?? "AUTOMATICO";
  const [tipoPiscinaSel, setTipoPiscinaSel] = useState<string>(initTipoPisc);
  const [tipoConstrucao, setTipoConstrucao] = useState<string>(initTipoConstr);
  const [modoDimensao, setModoDimensao] = useState<string>(initModoDim);
  const [modoConfigAquec, setModoConfigAquec] = useState<string>(initModoCfg);
  const dimManual = modoDimensao === "MANUAL";
  const cfgManual = modoConfigAquec === "MANUAL";

  // v5.5 — Overrides das dimensões quando modo = MANUAL (UI only). Inicializados das props.
  // v1.12.52 — se existir solarOverride salvo no environmentParams, usa esses valores
  //            como inicial (e marca modo MANUAL automaticamente — feito no initModoDim acima).
  const savedOverride = (budget.environmentParams as any)?.solarOverride;
  const initAreaOverride = Number(savedOverride?.areaPiscinaM2) > 0 ? Number(savedOverride.areaPiscinaM2) : area;
  const initVolumeOverride = Number(savedOverride?.volumeM3) > 0 ? Number(savedOverride.volumeM3) : volume;
  const [lenOverride, setLenOverride] = useState<number>(len);
  const [widOverride, setWidOverride] = useState<number>(wid);
  const [profMinOverride, setProfMinOverride] = useState<number>(profMin);
  const [profMaxOverride, setProfMaxOverride] = useState<number>(profMax);
  const [areaOverride, setAreaOverride] = useState<number>(initAreaOverride);
  const [volumeOverride, setVolumeOverride] = useState<number>(initVolumeOverride);
  const [savingOverride, setSavingOverride] = useState(false);
  // Indica se ha um override salvo no banco (controla visibilidade do botao "Limpar override")
  const [hasSavedOverride, setHasSavedOverride] = useState<boolean>(!!savedOverride);

  async function handleSaveOverride() {
    setSavingOverride(true);
    try {
      const body: { areaPiscinaM2?: number; volumeM3?: number } = {};
      if (Number.isFinite(areaOverride) && areaOverride > 0) body.areaPiscinaM2 = areaOverride;
      if (Number.isFinite(volumeOverride) && volumeOverride > 0) body.volumeM3 = volumeOverride;
      await api.post(`/pool-budgets/${budget.id}/solar-override`, body);
      setHasSavedOverride(Object.keys(body).length > 0);
    } catch (err) {
      console.warn('Falha ao salvar solarOverride:', err);
    } finally {
      setSavingOverride(false);
    }
  }

  async function handleClearOverride() {
    setSavingOverride(true);
    try {
      await api.post(`/pool-budgets/${budget.id}/solar-override`, {});
      setHasSavedOverride(false);
    } catch (err) {
      console.warn('Falha ao limpar solarOverride:', err);
    } finally {
      setSavingOverride(false);
    }
  }
  const dispLen = dimManual ? lenOverride : len;
  const dispWid = dimManual ? widOverride : wid;
  const dispProfMin = dimManual ? profMinOverride : profMin;
  const dispProfMax = dimManual ? profMaxOverride : profMax;
  const dispArea = dimManual ? areaOverride : area;
  const dispVolume = dimManual ? volumeOverride : volume;
  // v5.3 — modal de selecao do coletor (abrira ao clicar ✨)
  const [showColetorPicker, setShowColetorPicker] = useState(false);
  // v5.7 — modal de auto-selecao da bomba hidraulica (✨ ao lado da Bomba recomendada)
  const [showBombaPicker, setShowBombaPicker] = useState(false);
  // v5.3 — pre-visualizacao do PDF dentro da propria pagina.
  // Clona o #solar-pdf-area pra dentro do body via JS quando ativa, pra fugir dos containers Next.js.
  const [pdfPreviewMode, setPdfPreviewMode] = useState(false);

  // v5.9 — zoom manual do datasheet, alem do zoom automatico por viewport (CSS).
  // Persistido em localStorage. null = usa o auto via CSS @media (lg/xl/2xl).
  const [manualZoom, setManualZoom] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("solar:manualZoom");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0.5 && n <= 2.5 ? n : null;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (manualZoom == null) window.localStorage.removeItem("solar:manualZoom");
    else window.localStorage.setItem("solar:manualZoom", String(manualZoom));
  }, [manualZoom]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const cleanup = () => {
      document.documentElement.classList.remove("simulating-print");
      document.querySelectorAll(".solar-pdf-clone-container").forEach((el) => el.remove());
    };
    if (!pdfPreviewMode) { cleanup(); return; }
    const original = document.getElementById("solar-pdf-area");
    if (!original) return;
    const container = document.createElement("div");
    container.className = "solar-pdf-clone-container";
    const clone = original.cloneNode(true) as HTMLElement;
    clone.id = "solar-pdf-clone";
    container.appendChild(clone);
    document.body.appendChild(container);
    document.documentElement.classList.add("simulating-print");
    return cleanup;
  }, [pdfPreviewMode]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando dados solares...</div>;
  }

  const selectedMonth = report?.monthly?.[selectedMonthIdx];
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const localName = cidade || (availableUfs.find((u) => u.uf === uf)?.ufName) || "—";

  return (
    <>
      {/* === Toolbar — v1.12.54: compactado === */}
      <div className="mb-2 flex items-center justify-between gap-2 print:hidden">
        <div className="text-[10.5px] text-slate-500">
          Edite UF, capa, vento, temperatura e clique <span className="font-semibold text-slate-700">Recalcular</span>.
          <a href="/settings/climate-data" className="ml-1.5 text-cyan-700 hover:underline">Editar climáticos</a>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded border border-slate-300 bg-white px-0.5 py-0" title="Zoom">
            <button type="button"
              onClick={() => setManualZoom((z) => Math.max(0.6, Math.round(((z ?? 1) - 0.1) * 10) / 10))}
              className="w-5 h-5 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100">−</button>
            <button type="button"
              onClick={() => setManualZoom(null)}
              className="px-1 h-5 rounded text-[9px] font-semibold text-slate-600 hover:bg-slate-100 tabular-nums min-w-[36px]"
              title="Resetar zoom">{manualZoom != null ? `${Math.round(manualZoom * 100)}%` : "Auto"}</button>
            <button type="button"
              onClick={() => setManualZoom((z) => Math.min(2.5, Math.round(((z ?? 1) + 0.1) * 10) / 10))}
              className="w-5 h-5 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100">+</button>
          </div>
          <button onClick={() => {
              const extras: { areaPiscinaM2?: number; volumeM3?: number } = {};
              if (dimManual) {
                if (Number.isFinite(dispArea) && dispArea > 0) extras.areaPiscinaM2 = dispArea;
                if (Number.isFinite(dispVolume) && dispVolume > 0) extras.volumeM3 = dispVolume;
              }
              onRecompute(undefined, undefined, extras);
            }} disabled={recomputing || !uf}
            className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:bg-slate-300 transition shadow-sm whitespace-nowrap">
            {recomputing ? "Recalculando..." : "Recalcular"}
          </button>
          {dimManual && (
            <button onClick={handleSaveOverride} disabled={savingOverride}
              title="Salvar área/volume manuais (não altera o cadastro do orçamento)"
              className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 transition shadow-sm print:hidden whitespace-nowrap">
              {savingOverride ? "..." : (hasSavedOverride ? "💾 Atualizar" : "💾 Salvar")}
            </button>
          )}
          {dimManual && hasSavedOverride && (
            <button onClick={handleClearOverride} disabled={savingOverride}
              title="Remove o override salvo"
              className="rounded bg-white border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:bg-slate-200 transition shadow-sm print:hidden whitespace-nowrap">
              ✕ Limpar
            </button>
          )}
          <button onClick={() => setPdfPreviewMode(true)}
            className="rounded border border-blue-300 bg-blue-50 text-blue-800 px-2 py-1 text-[11px] font-semibold hover:bg-blue-100 transition shadow-sm whitespace-nowrap">
            👁️ PDF
          </button>
          <button onClick={() => window.print()}
            className="rounded border border-slate-300 bg-white text-slate-700 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 transition shadow-sm whitespace-nowrap">
            Imprimir
          </button>
        </div>
      </div>

      {/* === Folha A4 (datasheet) ===
          Tela: max-w-[820px] + altura A4 via wrapper (sem min-h direto no solar-pdf-area)
          Print: o min-h fica num wrapper.solar-screen-only, neutralizado via display:contents */}
      <div
        className="mx-auto max-w-[820px] print:max-w-none solar-screen-wrapper"
        style={manualZoom != null ? ({ zoom: manualZoom } as React.CSSProperties) : undefined}
      >
        <div id="solar-pdf-area" className="bg-white text-slate-900 font-sans border border-slate-200 shadow-sm print:border-0 print:shadow-none flex flex-col min-h-[1120px]">

          {/* ============ HEADER BANNER ============
              Tela: gradient slate-900 → blue-900 com texto branco
              Print: fundo BRANCO com texto azul escuro + borda inferior (funciona mesmo sem
              "Gráficos de segundo plano" marcado no painel do Chrome) */}
          <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-5 py-3 flex items-center justify-between print:bg-white print:text-blue-900 print:border-b-4 print:border-blue-900">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-amber-300 font-medium print:text-amber-700">Aquecimento solar para piscinas</div>
              <h2 className="text-base font-bold mt-0.5 leading-tight print:text-blue-900">Dimensionamento para Coletor Solar</h2>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300 print:text-slate-600">Orçamento</div>
              <div className="text-xl font-bold tabular-nums leading-tight print:text-blue-900">{budget.code ?? "—"}</div>
              <div className="text-[10px] text-slate-300 mt-0.5 print:text-slate-600">{today}</div>
            </div>
          </header>

          {/* ============ LADO ESQUERDO (Cliente + Dim+NBR | Config) + IMAGEM ============
              Esquerda (8 col): Cliente/Obra em cima, Dim+NBR | Config em 2 cols (h-full pra alinhar)
              Direita (4 col): Imagem aspect-square (menor) */}
          <section className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-200 avoid-break">
            <div className="col-span-8 flex flex-col gap-2">
              {/* Cliente / Obra — sem SectionLabel (titulo redundante) pra ganhar altura */}
              <div className="text-[11px] leading-tight">
                <div className="font-bold text-slate-900 text-[12px]">{budget.clientPartner?.name ?? "—"}</div>
                <div className="text-slate-700 mt-0.5 flex flex-wrap gap-x-4">
                  <span><span className="text-slate-500 uppercase text-[8.5px] tracking-wide font-semibold">Local:</span> {localName}</span>
                  <span><span className="text-slate-500 uppercase text-[8.5px] tracking-wide font-semibold">Projeto:</span> {budget.title || "—"}</span>
                </div>
              </div>

              {/* Dimensoes+NBR | Configuracao em 2 colunas — h-full pra alinhar altura */}
              <div className="grid grid-cols-2 gap-3 items-stretch flex-1">
                {/* Dimensoes — layout do print: 4 cards top (Comp/Larg/ProfMin/ProfMax) +
                    2 cards tipo (Privativa/Aberta) + 2 cards GRANDES highlight (Area/Volume) +
                    dropdown Automatico/manual (modo seleção do coletor) */}
                <div className="flex flex-col h-full">
                  <div className="flex items-baseline justify-between gap-2">
                    <SectionLabel>Dimensões da piscina</SectionLabel>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {/* Linha 1: COMP. | LARG. */}
                    <StatEditable label="Comp." value={dispLen} onChange={setLenOverride} unit="m" manual={dimManual} />
                    <StatEditable label="Larg." value={dispWid} onChange={setWidOverride} unit="m" manual={dimManual} />
                    {/* Linha 2: PROF.MIN | PROF.MAX */}
                    <StatEditable label="Prof. mín" value={dispProfMin} onChange={setProfMinOverride} unit="m" manual={dimManual} />
                    <StatEditable label="Prof. máx" value={dispProfMax} onChange={setProfMaxOverride} unit="m" manual={dimManual} />
                  </div>
                  {/* Linha 3: Tipo piscina | Tipo construção (compactos) */}
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <SelectCard label="Tipo de piscina" value={tipoPiscinaSel}
                      options={[{ v: "PRIVATIVA", l: "Privativa" }, { v: "COLETIVA", l: "Coletiva" }, { v: "CLINICA_SPA", l: "Clínica SPA" }]}
                      onChange={(v) => setTipoPiscinaSel(v)} />
                    <SelectCard label="Tipo de construção" value={tipoConstrucao}
                      options={[{ v: "ABERTA", l: "Aberta" }, { v: "COBERTA", l: "Coberta" }, { v: "CLIMATIZADA", l: "Climatizada" }]}
                      onChange={(v) => setTipoConstrucao(v)} />
                  </div>
                  {/* Linha 4: AREA | VOLUME — cor amber (auto) ou verde+editavel (manual) */}
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <BigHighlightInput label="Área" value={dispArea} onChange={setAreaOverride} unit="m²" min={0} max={9999} manual={dimManual} />
                    <BigHighlightInput label="Volume" value={dispVolume} onChange={setVolumeOverride} unit="m³" min={0} max={99999} manual={dimManual} />
                  </div>
                  {/* Linha 5: dropdown Modo de dimensão da piscina */}
                  <div className="mt-1">
                    <SelectCard label="Modo de dimensão da piscina" value={modoDimensao}
                      options={[{ v: "AUTOMATICO", l: "Automático" }, { v: "MANUAL", l: "Manual" }]}
                      onChange={(v) => setModoDimensao(v)} fullWidth />
                  </div>
                  {((budget.environmentParams as any)?.hidromassagensQtd > 0 ||
                    (budget.environmentParams as any)?.cascataLarguraCm > 0 ||
                    (budget.environmentParams as any)?.bordaInfinitaM > 0) && (
                    <div className="mt-1.5 text-[8.5px] text-slate-600 flex gap-3 leading-tight">
                      {(budget.environmentParams as any)?.hidromassagensQtd > 0 && <span>Hidromass.: <b>{(budget.environmentParams as any).hidromassagensQtd}</b></span>}
                      {(budget.environmentParams as any)?.cascataLarguraCm > 0 && <span>Cascata: <b>{(budget.environmentParams as any).cascataLarguraCm} cm</b></span>}
                      {(budget.environmentParams as any)?.bordaInfinitaM > 0 && <span>Borda inf.: <b>{(budget.environmentParams as any).bordaInfinitaM} m</b></span>}
                    </div>
                  )}
                </div>

                {/* Configuracao — mesmo padrao compacto da Dimensoes (label dentro, fonte pequena).
                    Quando cfgManual=true: borda verde + editavel. Quando AUTO: cinza + disabled. */}
                <div className="flex flex-col h-full">
                  <SectionLabel>Configuração do aquecimento</SectionLabel>
                  <div className="mt-1 space-y-1 flex-1">
                    {/* L1: Capa | Vento */}
                    <div className="grid grid-cols-2 gap-1">
                      <ConfigFieldBig label="Capa térmica" manual={cfgManual}>
                        <select value={capaTermica ? "SIM" : "NAO"} onChange={(e) => setCapaTermica(e.target.value === "SIM")}
                          disabled={!cfgManual}
                          className={`w-full bg-transparent text-[10.5px] font-bold leading-[1.1] focus:outline-none print:hidden h-[14px] -mt-0.5 disabled:cursor-not-allowed ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                        <span className="hidden print:inline-block text-[10.5px] font-bold text-slate-900 leading-[1.1]">{capaTermica ? "Sim" : "Não"}</span>
                      </ConfigFieldBig>
                      <ConfigFieldBig label="Vento" manual={cfgManual}>
                        <select value={vento} onChange={(e) => setVento(e.target.value)}
                          disabled={!cfgManual}
                          className={`w-full bg-transparent text-[10.5px] font-bold leading-[1.1] focus:outline-none print:hidden h-[14px] -mt-0.5 capitalize disabled:cursor-not-allowed ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="FRACO">Fraco</option>
                          <option value="MODERADO">Moderado</option>
                          <option value="FORTE">Forte</option>
                        </select>
                        <span className="hidden print:inline-block text-[10.5px] font-bold text-slate-900 leading-[1.1] capitalize">{vento.toLowerCase()}</span>
                      </ConfigFieldBig>
                    </div>
                    {/* L2: Orientação | Inclinação */}
                    <div className="grid grid-cols-2 gap-1">
                      <ConfigFieldBig label="Orientação telhado" manual={cfgManual}>
                        <select value={orientacaoTelhado} onChange={(e) => setOrientacaoTelhado(e.target.value)}
                          disabled={!cfgManual}
                          className={`w-full bg-transparent text-[10.5px] font-bold leading-[1.1] focus:outline-none print:hidden h-[14px] -mt-0.5 disabled:cursor-not-allowed ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="N">Norte</option>
                          <option value="NE">Nordeste</option>
                          <option value="L">Leste</option>
                          <option value="SE">Sudeste</option>
                          <option value="S">Sul</option>
                          <option value="SO">Sudoeste</option>
                          <option value="O">Oeste</option>
                          <option value="NO">Noroeste</option>
                        </select>
                        <span className="hidden print:inline-block text-[10.5px] font-bold text-slate-900 leading-[1.1]">{({ N: "Norte", NE: "Nordeste", L: "Leste", SE: "Sudeste", S: "Sul", SO: "Sudoeste", O: "Oeste", NO: "Noroeste" } as Record<string, string>)[orientacaoTelhado] ?? orientacaoTelhado}</span>
                      </ConfigFieldBig>
                      <ConfigFieldBig label="Inclinação" manual={cfgManual}>
                        <div className="flex items-baseline gap-0.5 w-full">
                          <input type="number" min={0} max={60} value={inclinacaoTelhado}
                            onChange={(e) => setInclinacaoTelhado(Number(e.target.value) || 0)}
                            disabled={!cfgManual}
                            className={`flex-1 bg-transparent text-[10.5px] font-bold leading-[1.1] tabular-nums focus:outline-none print:hidden w-0 min-w-0 disabled:cursor-not-allowed ${cfgManual ? "text-emerald-900" : "text-slate-900"}`} />
                          <span className="hidden print:inline-block text-[10.5px] font-bold text-slate-900 leading-[1.1] tabular-nums flex-1">{inclinacaoTelhado}</span>
                          <span className={`text-[9px] ${cfgManual ? "text-emerald-600" : "text-slate-500"}`}>°</span>
                        </div>
                      </ConfigFieldBig>
                    </div>
                    {/* L3: Cidade / Estado */}
                    <ConfigFieldBig label="Cidade / Estado" manual={cfgManual}>
                      <div className="flex gap-1 w-full items-center">
                        <select value={cidade} onChange={(e) => setCidade(e.target.value)}
                          disabled={!uf || !cfgManual}
                          className={`flex-1 min-w-0 bg-transparent text-[11.5px] font-bold leading-[1.15] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed print:hidden h-[16px] -mt-0.5 ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="">{uf ? "Capital" : "Selecione UF"}</option>
                          {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); }}
                          disabled={!cfgManual}
                          className={`w-12 bg-transparent text-[11.5px] font-bold leading-[1.15] focus:outline-none disabled:cursor-not-allowed print:hidden h-[16px] -mt-0.5 ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="">--</option>
                          {availableUfs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
                        </select>
                        <span className="hidden print:inline-block text-[11.5px] font-bold text-slate-900 leading-[1.15] flex-1">{cidade || "—"}</span>
                        <span className="hidden print:inline-block text-[11.5px] font-bold text-slate-900 leading-[1.15] w-10">{uf || "—"}</span>
                      </div>
                    </ConfigFieldBig>
                    {/* L4: Temp. inicial | Temp. final — cor amber (auto) ou verde (manual) */}
                    <div className="grid grid-cols-2 gap-1">
                      <BigHighlightInput label="Temp. inicial" value={temperaturaInicial} onChange={setTemperaturaInicial} unit="°C" min={5} max={40} manual={cfgManual} />
                      <BigHighlightInput label="Temp. final" value={tempAguaDesejada} onChange={setTempAguaDesejada} unit="°C" min={20} max={40} manual={cfgManual} />
                    </div>
                    {/* L5: dropdown Modo da configuração do aquecimento (mesmo padrao do Modo de dimensão) */}
                    <SelectCard label="Modo da configuração do aquecimento" value={modoConfigAquec}
                      options={[{ v: "AUTOMATICO", l: "Automático" }, { v: "MANUAL", l: "Manual" }]}
                      onChange={(v) => setModoConfigAquec(v)} fullWidth />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-4">
              {/* v5.9: prioriza imagem do produto coletor selecionado. Fallback pra
                  imagem cadastrada manualmente no orcamento (legado solarHeaderImage). */}
              {(() => {
                const selectedColetor = collectors.find((c) => c.productId === selectedCollectorId);
                const productImg = selectedColetor?.imageUrl ?? null;
                if (productImg) {
                  return (
                    <div className="w-full aspect-square rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={productImg} alt={selectedColetor?.modelName ?? "Coletor"} className="w-full h-full object-contain" />
                    </div>
                  );
                }
                return (
                  <HeaderImageBlock
                    imageUrl={headerImage}
                    uploading={headerImageUploading}
                    onUpload={onUploadHeaderImage}
                    onRemove={onRemoveHeaderImage}
                  />
                );
              })()}
            </div>
          </section>

          {/* v5.5 — CIDADE/ORIENTAÇÃO/INCLINAÇÃO voltaram pra dentro da Configuração do Aquecimento.
              Espaço em branco foi deslocado pra logo acima do gráfico das temperaturas. */}

          {/* v5.5 — Espacejador movido pra entre o banner SIMULACAO TERMICA MENSAL e o grafico/tabela.
              Antes ficava aqui (acima de DIMENSIONAMENTO), agora sai do fluxo pra empurrar o gráfico pra baixo. */}

          {/* ============ TITULO BANNER DIMENSIONAMENTO ============
              Print: fundo branco + texto azul + borda (sem depender de "Gráficos de segundo plano") */}
          <div className="bg-blue-900 text-white px-5 py-1.5 print:bg-white print:text-blue-900 print:border-y print:border-blue-900">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold">Dimensionamento</span>
          </div>

          {report ? (
            <>
              {/* ============ KPIs (coluna estreita) + COLETOR/SLIDER/BOMBA (coluna larga) ============ */}
              <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break">
                {/* Esquerda — KPIs em coluna estreita */}
                <div className="col-span-5 grid grid-cols-1 gap-1">
                  <Kpi label="Área da piscina" value={report.areaPiscinaM2.toFixed(2).replace(".", ",")} unit="m²" />
                  <Kpi label="m² necessário de coletor" value={String(Math.round(report.m2ColetorNecessario))} unit="m²" />
                  <Kpi label="Qtd. de coletores" value={report.qtdColetores.toFixed(1).replace(".", ",")} unit="un" accent />
                  <Kpi label="Coletores por bateria" value={String(report.coletoresPorBateria)} unit="un" />
                  <Kpi label="Baterias (total)" value={String(report.numBaterias)} unit="un" />
                  <Kpi label="Baterias em série" value={String(report.batPorRamo ?? report.numBaterias)} unit="un" />
                  <Kpi label="Baterias em paralelo" value={String((report.numRamosParalelos ?? 1) > 1 ? report.numRamosParalelos : 0)} unit="un" />
                  <Kpi label="Vazão necessária" value={report.vazaoTotalM3h.toFixed(2).replace(".", ",")} unit="m³/h" />
                  <Kpi label="Cobertura piscina × coletores" value={report.percentualCobertura.toFixed(1).replace(".", ",")} unit="%" />
                  {/* v1.12.53: diagrama visual da configuracao de baterias — ramos paralelos × baterias em serie */}
                  {report.numBaterias > 0 && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-2.5">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-600 mb-1.5">
                        Diagrama da instalação
                      </div>
                      <BatteryDiagram
                        numRamos={report.numRamosParalelos ?? 1}
                        batPorRamo={report.batPorRamo ?? report.numBaterias}
                        coletoresPorBateria={report.coletoresPorBateria}
                      />
                    </div>
                  )}
                </div>

                {/* Direita — Coletor + slider + bomba */}
                <div className="col-span-7 flex flex-col gap-2">
                  <div>
                    <SectionLabel>Coletor selecionado</SectionLabel>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {/* Botao ✨ — abre modal de selecao detalhada do coletor */}
                      <button type="button"
                        onClick={() => setShowColetorPicker(true)}
                        title="Escolher coletor (lista com especificações)"
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-300 print:hidden flex-shrink-0">
                        ✨
                      </button>
                      <select value={selectedCollectorId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          setSelectedCollectorId(id);
                          onRecompute(undefined, id);
                        }}
                        className="flex-1 min-w-0 bg-amber-50 border border-amber-200 rounded text-[12px] font-semibold px-2 py-1 print:hidden">
                        <option value="">— Padrão —</option>
                        {collectors.map((c) => (
                          <option key={c.productId} value={c.productId}>
                            {(c.missingSpecs && c.missingSpecs.length > 0) ? "⚠ " : ""}{c.modelName}
                          </option>
                        ))}
                      </select>
                      <div className="hidden print:block text-[12px] font-semibold bg-amber-50 px-2 py-1 border border-amber-200 rounded flex-1">
                        {report.selectedCollector.modelName}
                      </div>
                    </div>
                    {/* Aviso de specs faltando no coletor selecionado (lido do GET /collectors) */}
                    {(() => {
                      const sel = collectors.find((c) => c.productId === selectedCollectorId)
                        ?? (selectedCollectorId == null ? collectors[collectors.length - 1] : null);
                      const missing = sel?.missingSpecs ?? [];
                      if (missing.length === 0) return null;
                      const labels: Record<string, string> = {
                        areaM2: "Área externa (m²)",
                        kwhPorM2: "Produção específica (kWh/mês·m²)",
                        eficiencia: "Eficiência energética média (%)",
                      };
                      return (
                        <div className="mt-1.5 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[10.5px] text-red-800 print:hidden">
                          <strong>⚠ Cadastro incompleto:</strong> faltam {missing.map((k) => labels[k] ?? k).join(", ")} em <a href="/products" className="underline font-semibold">/products</a> (aba Especificações técnicas). O cálculo solar não rodará até completar.
                        </div>
                      );
                    })()}
                    {collectors.length === 0 && !coletorRule && (
                      <div className="mt-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10.5px] text-amber-900 print:hidden">
                        <strong>⚠ Regra de auto-selecao nao configurada.</strong> Sem filtro definido, nenhum produto eh listado. Clique no <button type="button" onClick={() => setShowColetorPicker(true)} className="underline font-bold text-violet-700 hover:text-violet-900">✨ pra configurar</button> qual filtro (tipo / descricao / categoria) escolhe os coletores do catalogo.
                      </div>
                    )}
                    {collectors.length === 0 && coletorRule && (
                      <div className="mt-1.5 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[10.5px] text-red-800 print:hidden">
                        <strong>⚠ Nenhum produto passa na regra atual.</strong> Revise o filtro no <button type="button" onClick={() => setShowColetorPicker(true)} className="underline font-bold">✨</button> ou ajuste produtos em <a href="/products" className="underline font-semibold">/products</a>.
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionLabel>Aumento da eficiência (coletores extras)</SectionLabel>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input type="range" min={0} max={10} step={1} value={extraPct}
                        onChange={(e) => setExtraPct(Number(e.target.value))}
                        onPointerUp={(e) => onRecompute(Number((e.target as HTMLInputElement).value), undefined)}
                        onKeyUp={(e) => onRecompute(Number((e.target as HTMLInputElement).value), undefined)}
                        className="flex-1 print:hidden accent-amber-500" />
                      <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 text-xs font-bold text-emerald-700 tabular-nums w-10 text-center">+{extraPct}</div>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 italic">Aumenta a eficiência em meses frios.</div>
                  </div>

                  {/* v1.12.34: bloco Tubulacao — calculadora de perda de carga.
                      v1.12.38: movido pra ANTES da Bomba — o calculo da tubulacao
                      eh pre-requisito (altura manometrica) pra escolher a bomba certa.
                      Operador informa comprimento (ida+volta) + desnivel. Backend
                      calcula altura manometrica total (Darcy-Weisbach + Haaland) e
                      persiste em environmentParams.solarPipe + alturaTelhadoM.
                      A auto-selecao da bomba usa esse valor. */}
                  <div className="print:hidden">
                    <SectionLabel>🚰 Tubulação — perda de carga</SectionLabel>
                    <div className="mt-1 rounded border border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mb-0.5" title="Comprimento total da tubulacao em metros (ida + volta).">
                            Comprimento (m)
                          </label>
                          <input
                            type="number" step="0.5" min="0"
                            value={pipeComprimento || ""}
                            onChange={(e) => setPipeComprimento(Number(e.target.value) || 0)}
                            onBlur={() => recomputePipe({ comprimentoM: pipeComprimento })}
                            placeholder="Ex: 30"
                            className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs font-semibold focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mb-0.5" title="Altura geometrica do telhado em metros (desnivel).">
                            Desnível (m)
                          </label>
                          <input
                            type="number" step="0.5" min="0"
                            value={pipeDesnivel || ""}
                            onChange={(e) => setPipeDesnivel(Number(e.target.value) || 0)}
                            onBlur={() => recomputePipe({ desnivelM: pipeDesnivel })}
                            placeholder="Ex: 4"
                            className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs font-semibold focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      {pipeResult ? (() => {
                        const velocidadeAlta = (pipeResult.velocidade ?? 0) >= 2.5;
                        const availableDns: number[] = pipeResult.availableDiametersMm ?? [32, 40, 50, 60, 75];
                        // Fallback: se result salvo nao tem diametroDnMm (dado antigo), pega do input
                        const dnAtual = pipeResult.diametroDnMm
                          ?? (pipeResult as any)?.inputs?.diametroMm
                          ?? availableDns.find((d) => d >= 50) ?? availableDns[0];
                        // cardCls: vermelho se velocidade alta; senao amber
                        const cardCls = velocidadeAlta
                          ? "rounded border border-red-400 bg-red-50 px-2 py-1.5"
                          : "rounded border border-amber-300 bg-amber-50 px-2 py-1.5";
                        const labelCls = velocidadeAlta ? "text-red-800" : "text-amber-800";
                        const valueCls = velocidadeAlta ? "text-red-900" : "text-amber-900";
                        const subCls = velocidadeAlta ? "text-red-800" : "text-amber-800";
                        const veloCls = velocidadeAlta ? "font-bold text-red-700" : "";
                        return (
                          <div className={cardCls}>
                            <div className="flex items-baseline justify-between gap-2">
                              <div className={`text-[8.5px] uppercase tracking-wider font-bold ${labelCls}`}>Altura manométrica total</div>
                              <div className={`text-base font-bold tabular-nums leading-none ${valueCls}`}>{pipeResult.alturaManometricaTotal?.toFixed(2)} <span className="text-[10px] font-semibold">mca</span></div>
                            </div>
                            <div className={`text-[9.5px] mt-0.5 ${subCls}`}>
                              = {pipeResult.perdaDinamica?.toFixed(2)} mca perda dinâmica + {pipeDesnivel} m desnível · velocidade <span className={veloCls}>{pipeResult.velocidade?.toFixed(2)} m/s</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <label className={`text-[10px] uppercase tracking-wider font-bold ${labelCls}`}>📏 Tubo:</label>
                              <span className={`text-[11px] font-semibold ${valueCls}`}>{pipeResult.material ?? 'PVC'}</span>
                              <select
                                value={dnAtual}
                                onChange={(e) => recomputePipe({ diametroMm: Number(e.target.value) })}
                                className={`text-xs font-bold rounded border px-2 py-0.5 ${velocidadeAlta ? 'border-red-400 bg-white text-red-900' : 'border-amber-400 bg-white text-amber-900'} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                              >
                                {availableDns.map((d) => (
                                  <option key={d} value={d}>{d} mm DN</option>
                                ))}
                              </select>
                              {pipeResult.diametroAutoPicked
                                ? <span className="text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">auto</span>
                                : <span className="text-[9px] uppercase tracking-wider text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">manual</span>}
                              {pipeResult.diametroInternoMm && <span className={`text-[10px] ${subCls}`}>(DI {pipeResult.diametroInternoMm} mm)</span>}
                              <button
                                type="button"
                                onClick={() => recomputePipe({ diametroMm: null })}
                                className="text-[10px] underline text-slate-500 hover:text-slate-700"
                                title="Volta a deixar o sistema escolher o tubo ideal pela vazao"
                              >
                                ↺ deixar automatico
                              </button>
                            </div>
                            {velocidadeAlta && (
                              <div className="mt-2 rounded bg-red-100 border border-red-300 px-2 py-1.5 text-[11px] font-bold text-red-800 uppercase tracking-wide text-center">
                                ⚠ Velocidade {pipeResult.velocidade?.toFixed(2)} m/s acima do limite de 2,5 m/s — AUMENTE O DIÂMETRO DO TUBO
                              </div>
                            )}
                            <div className={`text-[9px] mt-1 italic ${velocidadeAlta ? 'text-red-700' : 'text-amber-700'}`}>Defaults: PVC, fator 20%, 10 joelhos, 4 tês, 1 registro, 1 válvula.</div>
                          </div>
                        );
                      })() : (
                        <div className="text-[10px] text-slate-500 italic">
                          {pipeRecomputing ? 'Calculando…' : 'Preencha comprimento e desnível pra o sistema escolher o melhor tubo + calcular a altura manométrica.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* v1.12.43: dropdown com candidatos reais.
                      v1.12.53: layout reorganizado com imagem da bomba (mesmo padrao do coletor). */}
                  <div>
                    <SectionLabel>Bomba recomendada</SectionLabel>
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <button type="button"
                          onClick={() => setShowBombaPicker(true)}
                          title="Configurar auto-seleção da bomba (filtra por vazão calculada e altura manométrica)"
                          className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-300 print:hidden flex-shrink-0">
                          ✨
                        </button>
                        <div className="flex-1">
                          {bombaCandidates.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                              <div className="text-[12px] font-bold text-slate-900 leading-tight">
                                {bombaCandidatesLoading ? 'Carregando candidatos...' : (report.bombaRecomendada || 'Nenhum candidato no catálogo')}
                              </div>
                              <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                                {bombaCandidatesLoading
                                  ? 'Avaliando catálogo contra a regra...'
                                  : `Nenhuma bomba do catálogo atende a regra atual (vazão ≥ ${report.vazaoTotalM3h?.toFixed(2)} m³/h${pipeResult ? ` e pressão ≥ ${pipeResult.alturaManometricaTotal?.toFixed(2)} mca` : ''}). Edite no ✨ ou cadastre bombas compatíveis.`}
                              </div>
                            </div>
                          ) : (
                            <select
                              value={selectedBombaId ?? ''}
                              onChange={(e) => handleSelectBomba(e.target.value || null)}
                              className="w-full rounded border border-slate-300 bg-amber-50 px-2 py-1 text-[12px] font-semibold print:hidden">
                              {bombaCandidates.map((c) => {
                                const parts: string[] = [c.description];
                                if (c.potenciaCv != null) parts.push(`${c.potenciaCv} cv`);
                                parts.push(`${c.vazaoM3h.toFixed(1)} m³/h`);
                                parts.push(`${c.pressaoTrabalhoMca.toFixed(1)} mca`);
                                if (c.hasPumpCurve) parts.push('📈 curva');
                                if (c.indicator) parts.push(`${c.indicator.label}: ${c.indicator.value.toFixed(0)}${c.indicator.unit}`);
                                return <option key={c.productId} value={c.productId}>{parts.join(' · ')}</option>;
                              })}
                            </select>
                          )}
                        </div>
                      </div>
                      {/* v1.12.53: card com imagem + specs da bomba selecionada (mesmo padrao do coletor) */}
                      {bombaCandidates.length > 0 && (() => {
                        const selBomba = bombaCandidates.find((b) => b.productId === selectedBombaId) ?? bombaCandidates[0];
                        if (!selBomba) return null;
                        return (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 flex gap-3 items-start shadow-sm">
                            {/* Imagem da bomba (mesma estetica do coletor — quadrada, contain) */}
                            <div className="w-24 h-24 flex-shrink-0 rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                              {selBomba.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={selBomba.imageUrl} alt={selBomba.description} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-[9px] text-slate-400 text-center px-1">Sem imagem</div>
                              )}
                            </div>
                            {/* Specs */}
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-bold text-slate-900 leading-tight truncate">{selBomba.description}</div>
                              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-700">
                                {selBomba.potenciaCv != null && (
                                  <div><span className="text-slate-500">Potência:</span> <span className="font-semibold tabular-nums">{selBomba.potenciaCv} cv</span></div>
                                )}
                                <div><span className="text-slate-500">Vazão:</span> <span className="font-semibold tabular-nums">{selBomba.vazaoM3h.toFixed(2)} m³/h</span></div>
                                <div><span className="text-slate-500">Pressão:</span> <span className="font-semibold tabular-nums">{selBomba.pressaoTrabalhoMca.toFixed(2)} mca</span></div>
                                {selBomba.salePriceCents > 0 && (
                                  <div><span className="text-slate-500">Preço:</span> <span className="font-semibold tabular-nums">R$ {(selBomba.salePriceCents / 100).toFixed(2)}</span></div>
                                )}
                                {selBomba.hasPumpCurve && <div className="text-[9px] text-emerald-700 font-semibold">📈 com curva característica</div>}
                                {selBomba.indicator && (
                                  <div className={`text-[10px] font-semibold ${
                                    selBomba.indicator.color === 'emerald' ? 'text-emerald-700' :
                                    selBomba.indicator.color === 'green' ? 'text-green-700' :
                                    selBomba.indicator.color === 'yellow' ? 'text-yellow-700' :
                                    selBomba.indicator.color === 'orange' ? 'text-orange-700' :
                                    selBomba.indicator.color === 'red' ? 'text-red-700' :
                                    'text-slate-700'
                                  }`}>
                                    {selBomba.indicator.label}: {selBomba.indicator.value.toFixed(0)}{selBomba.indicator.unit} ({selBomba.indicator.label})
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="text-[9px] text-slate-500 mt-1 leading-tight">
                        {bombaCandidates.length > 0 ? (
                          <>{bombaCandidates.length} bomba(s) atendem · ordem definida pela regra ✨ · vazão {report.vazaoTotalM3h?.toFixed(2)} m³/h{pipeResult ? ` + altura ${pipeResult.alturaManometricaTotal?.toFixed(2)} mca` : ''}</>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* v1.12.29: avisos do Simulador (catalogo do tenant) — bombas sem vazao,
                      sem bomba que atenda vazaoTotal, regra solarBombaRule nao configurada. */}
                  {report.warnings && report.warnings.length > 0 && (
                    <div className="space-y-1.5 print:hidden">
                      {report.warnings.map((w, i) => (
                        <div key={i} className={
                          "rounded px-3 py-2 text-[11px] leading-snug border " +
                          (w.severity === 'warning'
                            ? "bg-amber-50 border-amber-300 text-amber-900"
                            : "bg-slate-50 border-slate-200 text-slate-700")
                        }>
                          <span className="font-bold mr-1">{w.severity === 'warning' ? '⚠' : 'ℹ'}</span>
                          {w.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ============ TITULO BANNER SIMULACAO ============
                  Print: fundo branco + texto azul + borda (independente de config Chrome) */}
              <div className="bg-blue-900 text-white px-5 py-1.5 flex items-center gap-3 print:bg-white print:text-blue-900 print:border-y print:border-blue-900">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold">Simulação térmica mensal</span>
                <div className="flex items-center gap-1.5 print:hidden">
                  <span className="text-[9px] text-blue-200 uppercase tracking-wide">Gráfico:</span>
                  <select value={selectedMonthIdx} onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                    className="bg-amber-50 border border-amber-200 text-[10px] font-semibold text-slate-900 px-1.5 py-0.5 rounded focus:border-amber-500 focus:outline-none">
                    {SOLAR_MONTH_NAMES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <span className="hidden print:inline text-[10px] text-slate-600">— {selectedMonth ? selectedMonth.monthName : ""}</span>
              </div>

              {/* v5.5 — Espacejador que empurra o grafico+tabela pra baixo se sobrar espaco na folha A4.
                  Antes ficava acima do banner DIMENSIONAMENTO. Movido pra cá conforme pedido do user. */}
              <div className="flex-1" />

              {/* ============ GRAFICO + TABELA ============ */}
              <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break items-stretch">
                <div className="col-span-7 flex flex-col">
                  {selectedMonth && (
                    <SolarChart row={selectedMonth} tempDesejada={tempAguaDesejada} monthName={selectedMonth.monthName} />
                  )}
                </div>
                <div className="col-span-5 flex flex-col">
                  <div className="border border-slate-200 rounded overflow-hidden h-full flex flex-col">
                    <table className="w-full text-[9.5px] tabular-nums">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">Mês</th>
                          <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">Amb.</th>
                          <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">1° dia</th>
                          <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">2° dia</th>
                          <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">3° dia</th>
                          <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">4° dia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.monthly.map((r, idx) => (
                          <tr key={r.monthIndex}
                            onClick={() => setSelectedMonthIdx(r.monthIndex)}
                            className={`cursor-pointer transition ${
                              selectedMonthIdx === r.monthIndex
                                ? "bg-amber-100 print:bg-amber-100"
                                : idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                            } hover:bg-amber-50 print:hover:bg-transparent`}>
                            <td className="px-1.5 py-0.5 font-semibold text-slate-900 text-[9.5px] capitalize">{r.monthName.toLowerCase()}</td>
                            <td className="px-1.5 py-0.5 text-right text-slate-600">{r.tempAmbiente.toFixed(1).replace(".", ",")}</td>
                            <td className="px-1.5 py-0.5 text-right font-semibold">{r.tempFinal1d.toFixed(1).replace(".", ",")}</td>
                            <td className="px-1.5 py-0.5 text-right font-semibold">{r.tempFinal2d.toFixed(1).replace(".", ",")}</td>
                            <td className="px-1.5 py-0.5 text-right font-semibold">{r.tempFinal3d.toFixed(1).replace(".", ",")}</td>
                            <td className="px-1.5 py-0.5 text-right font-semibold">{r.tempFinal4d.toFixed(1).replace(".", ",")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* ============ FOOTER ============ */}
              <footer className="px-5 py-2 bg-slate-50 print:bg-white">
                <div className="grid grid-cols-12 gap-3 items-start">
                  {/* Observacoes — 7 cols */}
                  <div className="col-span-7">
                    <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Observações</div>
                    <ol className="text-[8.5px] text-slate-700 leading-tight space-y-0.5 list-decimal list-inside">
                      <li>Os valores acima são estimativos e podem sofrer variações conforme temperatura ambiente real.</li>
                      <li>Perda térmica acima do tolerado (sem capa, vento forte) reduz a temperatura final.</li>
                      <li>Dias frios e nublados podem reiniciar o ciclo de aquecimento.</li>
                    </ol>
                  </div>

                  {/* NBR card — movido pra ca, ao lado das Observacoes — 5 cols */}
                  <div className="col-span-5">
                    <div className="rounded border border-red-200 overflow-hidden bg-white print:bg-white">
                      <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-700 text-white px-2 py-1 print:bg-red-700">
                        <div className="text-[9.5px] font-bold leading-tight">
                          NBR 10339:2018 — ABNT
                        </div>
                        <div className="text-[8px] text-red-100 leading-tight">
                          Faixas de temperatura recomendadas por uso
                        </div>
                      </div>
                      <div className="px-1.5 py-1 grid grid-cols-2 gap-x-2 text-[8px] leading-[1.15]">
                        <div className="flex justify-between">
                          <span className="text-slate-600">SPA</span>
                          <span className="font-bold text-slate-900 tabular-nums">36–38°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Competição</span>
                          <span className="font-bold text-slate-900 tabular-nums">25–28°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Recreação</span>
                          <span className="font-bold text-slate-900 tabular-nums">27–29°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Bebês/Hidro</span>
                          <span className="font-bold text-slate-900 tabular-nums">30–34°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Crianças</span>
                          <span className="font-bold text-slate-900 tabular-nums">29–32°</span>
                        </div>
                        <div className="text-red-700 font-medium">⚠ médico &gt;38°</div>
                      </div>
                    </div>
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <div className="mx-5 my-6 rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 print:hidden">
              {uf ? "Clique em Recalcular dimensionamento para gerar o relatorio." : "Selecione UF e cidade para comecar."}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar do pre-visualizacao via Portal (renderiza direto no body, sobrevive ao display:none) */}
      {pdfPreviewMode && typeof document !== "undefined" && createPortal(
        <div className="pdf-preview-toolbar">
          <span>📄 Pré-visualização PDF — como ficará impresso em A4</span>
          <button onClick={() => setPdfPreviewMode(false)}
            className="bg-white text-blue-900 font-bold px-2 py-0.5 rounded text-[11px] hover:bg-amber-50">
            ✕ Fechar
          </button>
          <button onClick={() => window.print()}
            className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded text-[11px] hover:bg-amber-600">
            🖨️ Imprimir agora
          </button>
        </div>,
        document.body
      )}

      {/* Modal AutoSelect REAL (reusa do orcamento) — abre via icone ✨ ao lado do dropdown.
          Permite configurar regra de auto-selecao do coletor (filtro de tipo, criterio, ordenacao). */}
      {showColetorPicker && (
        <AutoSelectModal
          initialRule={coletorRule ?? null}
          catalog={catalog ?? []}
          dimensions={budget.poolDimensions}
          environmentParams={budget.environmentParams}
          heatingReport={report}
          siblingVars={{}}
          sectionItems={[]}
          itemDescription="Coletor Solar (Simulador Solar)"
          currentProductName={collectors.find((c) => c.productId === selectedCollectorId)?.modelName ?? null}
          onClose={() => setShowColetorPicker(false)}
          onSave={async (rule: AutoSelectRule) => {
            await onSaveColetorRule(rule);
            setShowColetorPicker(false);
          }}
          onClear={async () => {
            await onSaveColetorRule(null);
            setShowColetorPicker(false);
          }}
        />
      )}

      {/* Modal AutoSelect da Bomba hidraulica (v5.7). Usa o mesmo componente do
          orcamento. Template prefereido: "🚰 Bomba do Coletor Solar (vazao do
          simulador)" — vazaoM3h >= vazaoSolarM3h (vem de report.vazaoTotalM3h). */}
      {showBombaPicker && (
        <AutoSelectModal
          initialRule={bombaRule ?? null}
          catalog={catalog ?? []}
          dimensions={budget.poolDimensions}
          environmentParams={budget.environmentParams}
          heatingReport={report}
          siblingVars={{}}
          sectionItems={[]}
          itemDescription="Bomba do Coletor Solar (Simulador Solar)"
          currentProductName={report?.bombaRecomendada ?? null}
          onClose={() => setShowBombaPicker(false)}
          onSave={async (rule: AutoSelectRule) => {
            await onSaveBombaRule(rule);
            setShowBombaPicker(false);
          }}
          onClear={async () => {
            await onSaveBombaRule(null);
            setShowBombaPicker(false);
          }}
        />
      )}

      {/* CSS Print: A4 portrait, 1 pagina garantida.
          - color-adjust: exact preserva fundos escuros do header/banner
          - tamanhos compactos pra todo conteudo caber em ~270mm de altura util
          - blocos com avoid-break nao podem quebrar entre paginas */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Esconde tudo exceto a area do PDF */
          body * { visibility: hidden; }
          #solar-pdf-area, #solar-pdf-area * { visibility: visible !important; }

          /* Preserva cores e backgrounds (header dark, banners) */
          #solar-pdf-area, #solar-pdf-area * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Usa fluxo normal (sem position absolute) — top:0 + margin @page cortava o header */
          html, body { background: #fff !important; }
          #solar-pdf-area {
            width: 100%;
            padding: 0; margin: 0;
            font-size: 10px;
            line-height: 1.2;
            min-height: 0 !important;          /* libera o min-h-[1120px] da tela */
            height: auto !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          @page { size: A4 portrait; margin: 4mm; }
          html, body { margin: 0 !important; padding: 0 !important; }

          /* Avoid page breaks dentro dos blocos principais */
          .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }

          /* CRITICO: usa atributo+id pra max specificity. Zera min-h e flex-1 espacejador */
          div#solar-pdf-area[id="solar-pdf-area"] {
            min-height: 0 !important;
            height: auto !important;
            display: block !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          #solar-pdf-area > div.flex-1 {
            display: none !important;
            flex: none !important;
            height: 0 !important;
            min-height: 0 !important;
          }
          /* Header banner no print — fundo BRANCO com texto AZUL e borda azul.
             Funciona independente de "Gráficos de segundo plano" do Chrome estar marcado ou não. */
          #solar-pdf-area header {
            background-color: #fff !important;
            background-image: none !important;
            color: #1e3a8a !important;
            border-bottom: 4px solid #1e3a8a !important;
            display: flex !important;
            visibility: visible !important;
            padding: 8px 16px !important;
          }
          #solar-pdf-area header h2,
          #solar-pdf-area header div {
            visibility: visible !important;
            color: #1e3a8a !important;
          }
          #solar-pdf-area header .text-amber-300 { color: #b45309 !important; }
          #solar-pdf-area header .text-slate-300 { color: #475569 !important; }

          /* Compacta secoes pra caber em 1 pagina A4 (1123px @ 96dpi - 16mm margem = ~1063px util) */
          #solar-pdf-area section { padding-top: 4px !important; padding-bottom: 4px !important; }
          #solar-pdf-area footer { padding-top: 3px !important; padding-bottom: 3px !important; }
          #solar-pdf-area header { padding-top: 6px !important; padding-bottom: 6px !important; }
          #solar-pdf-area .px-5 { padding-left: 10px !important; padding-right: 10px !important; }

          /* Esconde controles interativos (select/input) e mostra o equivalente print:block (texto puro) */
          #solar-pdf-area .print-hide-interactive { display: none !important; }
          #solar-pdf-area .print-show-value { display: inline-block !important; }

          /* SVG do grafico — limita altura mas acomoda altura aumentada do v5 (~85mm) */
          #solar-pdf-area svg { max-height: 80mm; width: 100%; height: auto; }

          /* Imagem do header — quadrada compact */
          #solar-pdf-area img { max-height: 38mm; }

          /* Banners DIMENSIONAMENTO / SIMULACAO TERMICA MENSAL no print: fundo branco + texto azul + borda */
          #solar-pdf-area .bg-blue-900,
          #solar-pdf-area .bg-slate-900 {
            background-color: #fff !important;
            background-image: none !important;
            color: #1e3a8a !important;
            border-top: 1px solid #1e3a8a !important;
            border-bottom: 1px solid #1e3a8a !important;
          }
          #solar-pdf-area .bg-blue-900 *,
          #solar-pdf-area .bg-slate-900 * { color: #1e3a8a !important; }
          #solar-pdf-area .bg-blue-200 { color: #475569 !important; }

          /* Esconde elementos da UI interativa */
          .print\\:hidden { display: none !important; }
        }

        /* === Simulacao do @media print — usado pelo botao "Pre-visualizar PDF" ===
           Estrategia: clone JS do #solar-pdf-area dentro de .solar-pdf-clone-container
           inserido direto no body. Tudo o resto do body fica escondido. */
        html.simulating-print body { background: #6b7280 !important; overflow: auto !important; }
        html.simulating-print body > *:not(.solar-pdf-clone-container):not(.pdf-preview-toolbar) { display: none !important; }
        html.simulating-print .solar-pdf-clone-container {
          display: block !important;
          padding: 30px 0 30px 0 !important;
          min-height: 100vh !important;
        }
        html.simulating-print .solar-pdf-clone-container #solar-pdf-clone {
          margin: 0 auto !important;
          width: 210mm !important;
          max-width: 210mm !important;
          background: #fff !important;
          box-shadow: 0 6px 32px rgba(0,0,0,0.4) !important;
          font-size: 10px !important; line-height: 1.2 !important;
          padding: 0 !important;
          min-height: 0 !important; height: auto !important;
          display: block !important;
          border: 0 !important;
        }
        html.simulating-print #solar-pdf-clone > div.flex-1 { display: none !important; }
        html.simulating-print #solar-pdf-clone section { padding-top: 4px !important; padding-bottom: 4px !important; }
        html.simulating-print #solar-pdf-clone footer { padding-top: 3px !important; padding-bottom: 3px !important; }
        html.simulating-print #solar-pdf-clone header { padding-top: 6px !important; padding-bottom: 6px !important; }
        html.simulating-print #solar-pdf-clone .px-5 { padding-left: 10px !important; padding-right: 10px !important; }
        html.simulating-print #solar-pdf-clone svg { max-height: 80mm !important; width: 100% !important; height: auto !important; }
        html.simulating-print #solar-pdf-clone img { max-height: 38mm !important; }
        html.simulating-print #solar-pdf-clone select { display: none !important; }
        html.simulating-print #solar-pdf-clone input[type=range] { display: none !important; }
        /* Ativa as classes print:* do Tailwind no modo simulacao */
        html.simulating-print #solar-pdf-clone .print\\:inline-block { display: inline-block !important; }
        html.simulating-print #solar-pdf-clone .print\\:hidden { display: none !important; }
        html.simulating-print #solar-pdf-clone .print\\:bg-white { background: #fff !important; background-image: none !important; }
        html.simulating-print #solar-pdf-clone .print\\:text-blue-900 { color: #1e3a8a !important; }
        html.simulating-print #solar-pdf-clone .print\\:text-amber-700 { color: #b45309 !important; }
        html.simulating-print #solar-pdf-clone .print\\:text-slate-600 { color: #475569 !important; }
        html.simulating-print #solar-pdf-clone .print\\:border-b-4 { border-bottom-width: 4px !important; }
        html.simulating-print #solar-pdf-clone .print\\:border-y { border-top-width: 1px !important; border-bottom-width: 1px !important; border-top-style: solid !important; border-bottom-style: solid !important; }
        html.simulating-print #solar-pdf-clone .print\\:border-blue-900 { border-color: #1e3a8a !important; }

        /* Toolbar fixa pra fechar a pre-visualizacao (sai do display:none geral) */
        html.simulating-print body > .pdf-preview-toolbar-wrapper { display: block !important; }
        html.simulating-print .pdf-preview-toolbar {
          display: flex !important;
          position: fixed !important;
          top: 10px !important; left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 10000 !important;
          background: #1e3a8a !important;
          color: #fff !important;
          padding: 6px 14px !important;
          border-radius: 6px !important;
          gap: 12px !important;
          align-items: center !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
          font-size: 12px !important;
          font-family: ui-sans-serif, system-ui, sans-serif !important;
        }
        .pdf-preview-toolbar { display: none; }

        /* === Tela: escala o datasheet proporcionalmente em viewports grandes ===
           PDF/print mantem A4 inalterado (zoom: 1 forcado em @media print e
           em html.simulating-print abaixo). So afeta a visualizacao na tela. */
        @media (min-width: 1024px) { .solar-screen-wrapper { zoom: 1.15; } }
        @media (min-width: 1280px) { .solar-screen-wrapper { zoom: 1.30; } }
        @media (min-width: 1536px) { .solar-screen-wrapper { zoom: 1.50; } }
        @media (min-width: 1792px) { .solar-screen-wrapper { zoom: 1.70; } }
        @media print { .solar-screen-wrapper { zoom: 1 !important; } }
        html.simulating-print .solar-screen-wrapper { zoom: 1 !important; }
      ` }} />
    </>
  );
}

// ============ Subcomponentes da aba Solar (Fase v2) ============

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px] leading-tight">
      <span className="text-slate-600 font-semibold w-12 shrink-0">{label}:</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}

// ============ Componentes do redesign profissional do SolarTab ============

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-semibold border-b border-slate-200 pb-0.5">
      {children}
    </div>
  );
}

function DataRow({ term, desc, emphasize }: { term: string; desc: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 leading-tight">
      <dt className="text-[9px] uppercase tracking-wide text-slate-500 w-14 shrink-0 font-semibold">{term}</dt>
      <dd className={emphasize ? "text-[12px] font-bold text-slate-900" : "text-[11px] text-slate-800 font-semibold"}>{desc}</dd>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded px-1.5 py-px border leading-tight ${highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="text-[7.5px] uppercase tracking-wide text-slate-500 font-semibold leading-[1.1]">{label}</div>
      <div className={`text-[10.5px] tabular-nums font-bold leading-[1.1] ${highlight ? "text-amber-800" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

// v5.5 — Versao editavel do Stat (Comp/Larg/Prof.min/Prof.max). Quando manual=false fica disabled (cinza),
// quando manual=true vira verde editavel.
function StatEditable({ label, value, onChange, unit, manual }: {
  label: string; value: number; onChange: (n: number) => void; unit: string; manual?: boolean;
}) {
  const colors = manual
    ? { border: "border-emerald-300", bg: "bg-emerald-50", labelText: "text-emerald-700", valueText: "text-emerald-900", unitText: "text-emerald-600" }
    : { border: "border-slate-200", bg: "bg-white", labelText: "text-slate-500", valueText: "text-slate-900", unitText: "text-slate-500" };
  return (
    <div className={`rounded px-1.5 py-px border leading-tight ${colors.border} ${colors.bg}`}>
      <div className={`text-[7.5px] uppercase tracking-wide ${colors.labelText} font-semibold leading-[1.1]`}>{label}</div>
      <div className="flex items-baseline gap-0.5">
        <input type="number" step="0.01" value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          disabled={!manual}
          className={`bg-transparent text-[10.5px] tabular-nums font-bold leading-[1.1] focus:outline-none w-full min-w-0 print:hidden disabled:cursor-not-allowed ${colors.valueText}`}
          style={{ height: '12px', padding: 0, margin: 0, border: 0, minHeight: 0 }} />
        <span className={`hidden print:inline-block text-[10.5px] tabular-nums font-bold leading-[1.1] ${colors.valueText}`}>{value.toFixed(2).replace(".", ",")}</span>
        <span className={`text-[8.5px] font-semibold ${colors.unitText}`}>{unit}</span>
      </div>
    </div>
  );
}

// Versao mais compacta do Stat: label e valor inline (label small, value bold)
function StatCompact({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded px-1.5 py-0.5 border flex items-baseline justify-between gap-1 ${highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <span className="text-[8px] uppercase tracking-wide text-slate-500 font-semibold leading-tight">{label}</span>
      <span className={`text-[10.5px] tabular-nums font-bold leading-tight ${highlight ? "text-amber-800" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function NbrRow({ tipo, range }: { tipo: string; range: string }) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-0.5">
      <span className="text-slate-600">{tipo}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{range}</span>
    </div>
  );
}

function NbrBadge({ tipo, range }: { tipo: string; range: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center leading-tight">
      <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold truncate">{tipo}</div>
      <div className="text-[10px] font-bold text-slate-900 tabular-nums">{range}</div>
    </div>
  );
}

// Modal de selecao do coletor — lista detalhada com especs + recomendacao baseada na area da piscina.
// Versao simplificada do AutoSelectModal (que esta em quotes/pool/[id]/page.tsx).
function ColetorPickerModal({
  collectors, selectedCollectorId, areaPiscina, onSelect, onClose,
}: {
  collectors: SolarCollectorCandidate[];
  selectedCollectorId: string | null;
  areaPiscina: number;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  // Cobertura ideal = 1.5x area piscina (folga de 50% pra dias frios)
  const areaIdeal = areaPiscina * 1.5;

  // Calcula recomendacao: menor coletor que cobre areaIdeal × 6 unidades (qtd media)
  const recomendado = collectors.find((c) => c.areaM2 * 6 >= areaIdeal) ?? collectors[collectors.length - 1];

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-amber-300 font-semibold">Selecionar coletor solar</div>
            <h3 className="text-base font-bold leading-tight mt-0.5">Coletores disponíveis</h3>
            <div className="text-[11px] text-slate-300 mt-0.5">Área da piscina: <b className="text-white">{areaPiscina.toFixed(2).replace(".", ",")} m²</b> · Cobertura ideal: <b className="text-amber-200">{areaIdeal.toFixed(1).replace(".", ",")} m²</b></div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none px-2">×</button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {collectors.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              Nenhum coletor cadastrado. Cadastre em <a href="/products" className="text-cyan-700 underline">Produtos</a> com tipo <b>Coletor Solar — Piscina</b>.
            </div>
          ) : (
            <div className="space-y-2">
              {collectors.map((c) => {
                const isSelected = c.productId === selectedCollectorId;
                const isRecomendado = c.productId === recomendado.productId;
                return (
                  <button key={c.productId} type="button"
                    onClick={() => onSelect(c.productId)}
                    className={`w-full text-left rounded-lg border p-3 transition ${
                      isSelected
                        ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                        : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{c.modelName}</span>
                          {isRecomendado && (
                            <span className="text-[9px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                              ★ Recomendado
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[9px] uppercase tracking-wide bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold">
                              ✓ Selecionado
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-1.5 text-[11px]">
                          <div>
                            <span className="text-slate-500 uppercase text-[9px] tracking-wide">Área</span>
                            <div className="font-semibold text-slate-900 tabular-nums">{c.areaM2.toFixed(2).replace(".", ",")} m²</div>
                          </div>
                          <div>
                            <span className="text-slate-500 uppercase text-[9px] tracking-wide">kWh/m²</span>
                            <div className="font-semibold text-slate-900 tabular-nums">{c.kwhPorM2.toFixed(1).replace(".", ",")}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 uppercase text-[9px] tracking-wide">Eficiência</span>
                            <div className="font-semibold text-slate-900 tabular-nums">{(c.eficiencia * 100).toFixed(1).replace(".", ",")}%</div>
                          </div>
                        </div>
                      </div>
                      {c.salePriceCents != null && (
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-wide text-slate-500">Preço/un</div>
                          <div className="text-sm font-bold text-emerald-700 tabular-nums">R$ {(c.salePriceCents / 100).toFixed(2).replace(".", ",")}</div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-600">
            Cobertura ideal calculada como <b>1,5×</b> a área da piscina (folga para meses frios).
          </div>
          <button onClick={onClose}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function NbrInline({ tipo, range }: { tipo: string; range: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 leading-tight">
      <span className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">{tipo}</span>
      <span className="font-bold text-slate-900 tabular-nums">{range}</span>
    </span>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

// v5.5 — Mesmo padrao compacto do Stat/SelectCard (Dimensoes) — label 7px, valor 10.5px, padding mínimo.
// Cor cinza (auto/disabled) ou verde (manual/editavel) baseado em prop manual.
function ConfigFieldBig({ label, children, manual }: { label: string; children: React.ReactNode; manual?: boolean }) {
  const colors = manual
    ? { border: "border-emerald-300", bg: "bg-emerald-50", label: "text-emerald-700" }
    : { border: "border-slate-200", bg: "bg-white", label: "text-slate-500" };
  return (
    <div className={`rounded border px-1.5 py-px leading-tight overflow-hidden ${colors.border} ${colors.bg}`}>
      <div className={`text-[7px] uppercase tracking-tight font-semibold leading-[1.1] whitespace-nowrap truncate ${colors.label}`}>{label}</div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

// v5.5 — Card compacto com dropdown integrado (Tipo piscina / Tipo construção / Modo coletor).
// Wrapper flex pra dar mesma altura dos ConfigFieldBig (envolve o select pra comprimir altura nativa).
function SelectCard({ label, value, options, onChange, readOnly, fullWidth }: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}) {
  const currentLabel = options.find((o) => o.v === value)?.l ?? value;
  return (
    <div className={`rounded border border-slate-200 bg-white px-1.5 py-px leading-tight overflow-hidden ${fullWidth ? "w-full" : ""}`}>
      <div className="text-[7px] uppercase tracking-tight text-slate-500 font-semibold leading-[1.1] whitespace-nowrap truncate">{label}</div>
      {readOnly ? (
        <div className="flex items-center h-[14px]">
          <span className="text-[9.5px] font-bold text-slate-900 leading-[1.1]">{currentLabel}</span>
        </div>
      ) : (
        <div className="flex items-center h-[14px]">
          <select value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent text-[9.5px] font-bold text-slate-900 leading-[1.1] focus:outline-none print:hidden appearance-auto">
            {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      )}
      <span className="hidden print:inline-block text-[9.5px] font-bold text-slate-900 leading-[1.1]">{currentLabel}</span>
    </div>
  );
}

// v5.5 — Card compacto pra Area e Volume (highlight amber, altura fixa pra alinhar com BigHighlightInput)
function BigHighlight({ label, value, unit, manual }: { label: string; value: string; unit: string; manual?: boolean }) {
  const colors = manual
    ? { border: "border-emerald-300", bg: "bg-emerald-50", labelText: "text-emerald-700", valueText: "text-emerald-900", unitText: "text-emerald-700" }
    : { border: "border-amber-300", bg: "bg-amber-50", labelText: "text-amber-700", valueText: "text-amber-900", unitText: "text-amber-700" };
  return (
    <div className={`rounded border ${colors.border} ${colors.bg} px-1.5 py-0.5 flex flex-col justify-center overflow-hidden`} style={{ height: '29px' }}>
      <div className={`text-[8px] uppercase tracking-wide ${colors.labelText} font-semibold leading-tight`}>{label}</div>
      <div className="flex items-baseline gap-1 leading-tight">
        <span className={`text-[13px] font-bold ${colors.valueText} tabular-nums leading-none`}>{value}</span>
        <span className={`text-[9.5px] font-semibold ${colors.unitText}`}>{unit}</span>
      </div>
    </div>
  );
}

// v5.5 — Versao editavel do BigHighlight pra Temp. inicial / Temp. final (cor amber auto / verde manual)
function BigHighlightInput({ label, value, onChange, unit, min, max, manual }: {
  label: string; value: number; onChange: (n: number) => void; unit: string; min: number; max: number; manual?: boolean;
}) {
  const colors = manual
    ? { border: "border-emerald-300", bg: "bg-emerald-50", labelText: "text-emerald-700", valueText: "text-emerald-900", unitText: "text-emerald-700" }
    : { border: "border-amber-300", bg: "bg-amber-50", labelText: "text-amber-700", valueText: "text-amber-900", unitText: "text-amber-700" };
  return (
    <div className={`rounded border ${colors.border} ${colors.bg} px-1.5 py-0.5 flex flex-col justify-center overflow-hidden`} style={{ height: '29px' }}>
      <div className={`text-[8px] uppercase tracking-wide ${colors.labelText} font-semibold leading-tight`}>{label}</div>
      <div className="flex items-baseline gap-1 leading-tight">
        <input type="number" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value) || min)}
          disabled={!manual}
          className={`bg-transparent text-[13px] font-bold ${colors.valueText} tabular-nums leading-none focus:outline-none w-full min-w-0 print:hidden disabled:cursor-not-allowed`}
          style={{ height: '14px', padding: 0, margin: 0, border: 0, minHeight: 0 }} />
        <span className={`hidden print:inline-block text-[13px] font-bold ${colors.valueText} tabular-nums leading-none`}>{value}</span>
        <span className={`text-[9.5px] font-semibold ${colors.unitText}`}>{unit}</span>
      </div>
    </div>
  );
}

// v1.12.53: diagrama SVG da configuracao de baterias. Mostra entrada (top), N ramos
// verticais (cada um com M baterias em serie), retorno (bottom). Cada bateria leva
// o numero de coletores. Ajuda o operador a entender a topologia da instalacao.
function BatteryDiagram({
  numRamos, batPorRamo, coletoresPorBateria,
}: {
  numRamos: number;
  batPorRamo: number;
  coletoresPorBateria: number;
}) {
  if (numRamos <= 0 || batPorRamo <= 0) return null;
  const ramoW = 60;
  const ramoGap = 24;
  const batH = 38;
  const batGap = 10;
  const trunkH = 22;
  const padding = 16;
  const svgW = numRamos * ramoW + (numRamos - 1) * ramoGap + padding * 2;
  const svgH = trunkH * 2 + batPorRamo * batH + (batPorRamo - 1) * batGap + 16;
  const trunkY1 = trunkH / 2 + 8;
  const trunkY2 = svgH - trunkH / 2 - 8;
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
      {/* Tronco de entrada (alimentacao) */}
      <line x1={padding} y1={trunkY1} x2={svgW - padding} y2={trunkY1} stroke="#0284c7" strokeWidth={3} strokeLinecap="round" />
      <text x={padding} y={trunkY1 - 6} fontSize={9} fontWeight={700} fill="#0369a1" className="uppercase">Alimentação</text>
      {/* Tronco de retorno */}
      <line x1={padding} y1={trunkY2} x2={svgW - padding} y2={trunkY2} stroke="#dc2626" strokeWidth={3} strokeLinecap="round" />
      <text x={padding} y={trunkY2 + 14} fontSize={9} fontWeight={700} fill="#b91c1c" className="uppercase">Retorno</text>
      {/* Ramos */}
      {Array.from({ length: numRamos }).map((_, r) => {
        const x = padding + r * (ramoW + ramoGap);
        const xMid = x + ramoW / 2;
        return (
          <g key={r}>
            {/* Linha vertical conectando entrada → primeira bat e ultima bat → retorno */}
            <line x1={xMid} y1={trunkY1} x2={xMid} y2={trunkY1 + 10} stroke="#0284c7" strokeWidth={2} />
            <line x1={xMid} y1={trunkY2 - 10} x2={xMid} y2={trunkY2} stroke="#dc2626" strokeWidth={2} />
            {Array.from({ length: batPorRamo }).map((__, b) => {
              const y = trunkY1 + 10 + b * (batH + batGap);
              return (
                <g key={b}>
                  {/* Caixa da bateria */}
                  <rect x={x} y={y} width={ramoW} height={batH} rx={4} ry={4} fill="#fef3c7" stroke="#d97706" strokeWidth={1.5} />
                  <text x={xMid} y={y + 16} fontSize={9} fontWeight={700} fill="#92400e" textAnchor="middle">Bateria</text>
                  <text x={xMid} y={y + 30} fontSize={11} fontWeight={800} fill="#78350f" textAnchor="middle" className="tabular-nums">{coletoresPorBateria} col.</text>
                  {/* Conexao serial entre baterias do mesmo ramo */}
                  {b < batPorRamo - 1 && (
                    <line x1={xMid} y1={y + batH} x2={xMid} y2={y + batH + batGap} stroke="#64748b" strokeWidth={2} strokeDasharray="2 2" />
                  )}
                </g>
              );
            })}
            {/* Label do ramo */}
            <text x={xMid} y={trunkY2 + 26} fontSize={8.5} fontWeight={600} fill="#475569" textAnchor="middle" className="uppercase tracking-wider">Ramo {r + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Kpi padronizado com o estilo de StatCompact: label uppercase pequena + valor bold inline + unit discreta
function Kpi({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`rounded px-2 py-1 border flex items-baseline justify-between gap-1 ${accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <span className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold leading-tight">{label}</span>
      <span className={`tabular-nums font-bold leading-tight ${accent ? "text-amber-800" : "text-slate-900"}`}>
        <span className="text-[12px]">{value}</span>
        <span className={`text-[9px] font-medium ml-0.5 ${accent ? "text-amber-700" : "text-slate-500"}`}>{unit}</span>
      </span>
    </div>
  );
}

// Bloco do header da aba Solar: upload de imagem (foto/render da piscina ou logo).
// - Com imagem: mostra a imagem + botoes "Trocar"/"Remover" (escondidos no print)
// - Sem imagem: dropzone clicavel "Adicionar imagem" (substituido pelo logo padrao no print)
function HeaderImageBlock({
  imageUrl, uploading, onUpload, onRemove,
}: {
  imageUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handlePick = () => fileRef.current?.click();
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="relative border border-slate-200 rounded overflow-hidden bg-slate-50 aspect-square w-full flex items-center justify-center print:bg-white">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Imagem do orcamento" className="w-full h-full object-contain" />
          <div className="absolute top-1 right-1 flex gap-1 print:hidden">
            <button onClick={handlePick} disabled={uploading}
              className="rounded bg-white/95 text-slate-700 border border-slate-300 px-2 py-0.5 text-[9px] font-semibold hover:bg-white shadow-sm uppercase tracking-wide">
              Trocar
            </button>
            <button onClick={onRemove} disabled={uploading}
              className="rounded bg-white/95 text-red-700 border border-red-200 px-2 py-0.5 text-[9px] font-semibold hover:bg-red-50 shadow-sm uppercase tracking-wide">
              Remover
            </button>
          </div>
        </>
      ) : (
        <>
          <button onClick={handlePick} disabled={uploading} type="button"
            className="w-full h-full min-h-[88px] flex flex-col items-center justify-center text-slate-500 hover:bg-white transition print:hidden border border-dashed border-slate-300 rounded">
            <svg className="w-7 h-7 text-slate-400 mb-1" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <div className="text-[10px] font-semibold">{uploading ? "Enviando..." : "Adicionar imagem"}</div>
            <div className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">Quadrada (ex: 600×600px)</div>
            <div className="text-[8px] text-slate-400 leading-tight">JPEG · PNG · WebP — max 5MB</div>
          </button>
          {/* No print sem imagem: bloco vazio discreto */}
          <div className="hidden print:flex flex-col items-center justify-center text-center py-2 px-3 text-slate-400 text-[10px]">
            <div className="text-[9px] uppercase tracking-wide">Sem imagem</div>
          </div>
        </>
      )}
    </div>
  );
}

function RowField({ label, value, valueEditable, highlight, children }: {
  label: string;
  value?: string;
  valueEditable?: boolean;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
      <span className="text-slate-700 leading-tight">{label}</span>
      {children ? (
        <span>{children}</span>
      ) : (
        <span className={`px-2 py-0.5 font-semibold tabular-nums ${highlight ? "bg-yellow-50 border border-slate-300" : ""}`}>
          {value}
        </span>
      )}
    </div>
  );
}

// Grafico SVG profissional: linha suave da temperatura ao longo de 4 dias.
// 8 pontos (inicio/fim de cada dia). Linha pontilhada marca a temperatura desejada.
function SolarChart({ row, tempDesejada, monthName }: { row: SolarMonthlyRow; tempDesejada: number; monthName?: string }) {
  // Fallback defensivo pra reports cacheados antigos sem tempInicial2d/3d/4d
  const perda = Number(row.perdaCorrigidaPorDia) || 0;
  const tempIni1 = Number(row.tempInicial1d) || 0;
  const tempFim1 = Number(row.tempFinal1d) || 0;
  const tempIni2 = row.tempInicial2d != null ? Number(row.tempInicial2d) : Math.max(0, tempFim1 - perda);
  const tempFim2 = Number(row.tempFinal2d) || 0;
  const tempIni3 = row.tempInicial3d != null ? Number(row.tempInicial3d) : Math.max(0, tempFim2 - perda);
  const tempFim3 = Number(row.tempFinal3d) || 0;
  const tempIni4 = row.tempInicial4d != null ? Number(row.tempInicial4d) : Math.max(0, tempFim3 - perda);
  const tempFim4 = Number(row.tempFinal4d) || 0;

  const pts = [
    { y: tempIni1, label: "Inicial" },
    { y: tempFim1, label: "Final" },
    { y: tempIni2, label: "Inicial" },
    { y: tempFim2, label: "Final" },
    { y: tempIni3, label: "Inicial" },
    { y: tempFim3, label: "Final" },
    { y: tempIni4, label: "Inicial" },
    { y: tempFim4, label: "Final" },
  ];

  // Dimensoes aumentadas pra dar mais "presenca visual" ao grafico (componente principal do PDF)
  const W = 600;
  const H = 340;
  const padL = 38, padR = 18, padT = 36, padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  // Ignora valores zerados ao calcular yMin/yMax pra evitar escala distorcida (mock/dados quebrados)
  const validYs = pts.map((p) => p.y).filter((y) => y > 5);
  const yMax = Math.max(40, tempDesejada + 2, ...(validYs.length ? validYs : [40]));
  const yMin = Math.max(15, Math.min(20, Math.floor(Math.min(...(validYs.length ? validYs : [20])) - 2)));
  const stepX = innerW / (pts.length - 1);
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  // Curva suave usando cubic bezier (catmull-rom alternativa simples)
  const smoothPath = (() => {
    const parts: string[] = [];
    pts.forEach((p, i) => {
      if (i === 0) {
        parts.push(`M ${xOf(i).toFixed(1)} ${yOf(p.y).toFixed(1)}`);
      } else {
        const prev = pts[i - 1];
        const x0 = xOf(i - 1), y0 = yOf(prev.y);
        const x1 = xOf(i), y1 = yOf(p.y);
        const cpx1 = x0 + stepX * 0.5;
        const cpx2 = x1 - stepX * 0.5;
        parts.push(`C ${cpx1.toFixed(1)} ${y0.toFixed(1)}, ${cpx2.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`);
      }
    });
    return parts.join(" ");
  })();
  const areaPath = `${smoothPath} L ${xOf(pts.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xOf(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  // Ticks Y de 5 em 5 dentro do range
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / 5) * 5; v <= yMax; v += 5) yTicks.push(v);

  return (
    <div className="border border-slate-200 rounded bg-white p-2 print:border-slate-300 flex-1 flex flex-col">
      {monthName && (
        <div className="px-1 pb-1 flex items-baseline justify-between">
          <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Variação térmica em 4 dias</span>
          <span className="text-[11px] font-bold text-blue-900 capitalize">{monthName.toLowerCase()}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto flex-1" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Fundo aguado: gradient azul claro representando agua da piscina */}
          <linearGradient id="poolWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>
          {/* Linha principal: gradient vertical de azul-claro (fria) embaixo → laranja-quente em cima */}
          <linearGradient id="tempLine" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="35%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#fbbf24" />
            <stop offset="80%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          {/* Area sob a curva — laranja translucido pra dar 'brilho' acima da agua */}
          <linearGradient id="tempArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.42" />
            <stop offset="60%" stopColor="#fcd34d" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#dbeafe" stopOpacity="0" />
          </linearGradient>
          {/* Sombra suave do ponto */}
          <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Frame de "agua" */}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="url(#poolWater)" />

        {/* Grid Y — linhas brancas finas tipo 'ondulacao na agua' */}
        {yTicks.map((v) => (
          <line key={v} x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)} stroke="#fff" strokeWidth="0.8" strokeOpacity="0.85" />
        ))}
        {/* Labels Y — fora do frame, slate */}
        {yTicks.map((v) => (
          <text key={`y${v}`} x={padL - 6} y={yOf(v) + 4} fontSize="11" fill="#475569" textAnchor="end" fontWeight="600">
            {v}°
          </text>
        ))}

        {/* Linha meta (tempDesejada) — verde dasharray + badge */}
        {tempDesejada >= yMin && tempDesejada <= yMax && (
          <g>
            <line x1={padL} y1={yOf(tempDesejada)} x2={W - padR} y2={yOf(tempDesejada)}
              stroke="#10b981" strokeWidth="1.4" strokeDasharray="5 3" />
            <rect x={padL + 2} y={yOf(tempDesejada) - 14} width="72" height="14" fill="#10b981" rx="2" />
            <text x={padL + 38} y={yOf(tempDesejada) - 3} fontSize="10.5" fill="#fff" textAnchor="middle" fontWeight="700" letterSpacing="0.5">
              META {tempDesejada}°
            </text>
          </g>
        )}

        {/* Stems verticais (estilo Excel original) — finos azul claro, do eixo ate o ponto */}
        {pts.map((p, i) => (
          <line key={`stem-${i}`} x1={xOf(i)} y1={padT + innerH} x2={xOf(i)} y2={yOf(p.y) + 4}
            stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.55" strokeDasharray="2 2" />
        ))}

        {/* Area sob a curva — gradient laranja/translucido */}
        <path d={areaPath} fill="url(#tempArea)" stroke="none" />

        {/* Linha principal — gradient vertical (frio → quente) */}
        <path d={smoothPath} fill="none" stroke="url(#tempLine)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos — branco com borda gradient (efeito 'bolinha' destacada) + label azul em cima */}
        {pts.map((p, i) => {
          // Cor do ponto: degrada do azul (frio) ao laranja (quente)
          const t = (p.y - yMin) / (yMax - yMin);
          const dotColor = t < 0.35 ? "#0ea5e9" : t < 0.6 ? "#fbbf24" : "#f97316";
          return (
            <g key={i}>
              <circle cx={xOf(i)} cy={yOf(p.y)} r="6" fill="url(#dotGlow)" />
              <circle cx={xOf(i)} cy={yOf(p.y)} r="4.5" fill={dotColor} stroke="#fff" strokeWidth="2" />
              {/* Label valor com badge azul-marinho (estilo Excel) */}
              <g transform={`translate(${xOf(i)}, ${yOf(p.y) - 14})`}>
                <rect x="-20" y="-10" width="40" height="14" fill="#1e3a8a" rx="2" />
                <text x="0" y="1" fontSize="10.5" fontWeight="700" fill="#fff" textAnchor="middle">
                  {p.y.toFixed(1).replace(".", ",")}°
                </text>
              </g>
            </g>
          );
        })}

        {/* Eixo X bottom-bar — barra azul marinho */}
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#1e3a8a" strokeWidth="1.5" />

        {/* Labels eixo X — "DIA 1/2/3/4" centralizado a cada par */}
        {[0, 1, 2, 3].map((d) => {
          const xCenter = (xOf(d * 2) + xOf(d * 2 + 1)) / 2;
          return (
            <g key={d}>
              <text x={xCenter} y={padT + innerH + 20} fontSize="12" fontWeight="700" fill="#1e3a8a" textAnchor="middle" letterSpacing="1.2">
                DIA {d + 1}
              </text>
              <text x={xOf(d * 2)} y={padT + innerH + 34} fontSize="9.5" fill="#64748b" textAnchor="middle" fontWeight="500">início</text>
              <text x={xOf(d * 2 + 1)} y={padT + innerH + 34} fontSize="9.5" fill="#64748b" textAnchor="middle" fontWeight="500">fim</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============ Subcomponentes ============

function TabButton({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
        active ? "border-orange-500 text-orange-700 bg-white" :
        disabled ? "border-transparent text-slate-400 cursor-not-allowed" :
        "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white"
      }`}>
      {children}
    </button>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <div className="mt-0.5 text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}

function NumInput({ value, onChange, step, min, max }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <input type="number" value={value} step={step} min={min} max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none tabular-nums" />
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</div>
      <div className="text-sm font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

// Componente BigStat novo do Resumo Térmico — cards horizontais alinhados, estilo Bomba de Calor
function BigStat({ color, label, value, unit }: { color: "emerald" | "blue" | "amber" | "violet"; label: string; value: string; unit: string }) {
  const colors = {
    emerald: { border: "border-emerald-200", labelText: "text-emerald-700", valueText: "text-emerald-900", unitText: "text-emerald-600", bg: "bg-white" },
    blue: { border: "border-blue-200", labelText: "text-blue-700", valueText: "text-blue-900", unitText: "text-blue-600", bg: "bg-white" },
    amber: { border: "border-amber-300", labelText: "text-amber-700", valueText: "text-amber-900", unitText: "text-amber-600", bg: "bg-white" },
    violet: { border: "border-violet-200", labelText: "text-violet-700", valueText: "text-violet-900", unitText: "text-violet-600", bg: "bg-white" },
  }[color];
  return (
    <div className={`rounded border ${colors.border} ${colors.bg} px-2 py-1.5 flex flex-col`}>
      <div className={`text-[8.5px] uppercase tracking-wide ${colors.labelText} font-semibold leading-tight`}>{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`text-[18px] font-bold ${colors.valueText} tabular-nums leading-none`}>{value}</span>
        <span className={`text-[9.5px] font-medium ${colors.unitText}`}>{unit}</span>
      </div>
    </div>
  );
}

// Versao legada (mantida pra nao quebrar refs antigas)
function BigStatLegacy({ label, value, unit, emphasis }: { label: string; value: string; unit: string; emphasis: "cyan" | "orange" | "emerald" }) {
  const cls = emphasis === "cyan" ? "border-cyan-200 from-cyan-50 to-blue-50 text-cyan-900" :
              emphasis === "orange" ? "border-orange-200 from-orange-50 to-amber-50 text-orange-900" :
              "border-emerald-200 from-emerald-50 to-teal-50 text-emerald-900";
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 shadow-sm ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs opacity-70">{unit}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">{label}</div>
      <div className="text-sm font-bold text-emerald-900 tabular-nums">{value}</div>
    </div>
  );
}

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Input "Quant." ao lado do nome do equipamento selecionado (v1.11.86).
 *  Debounce 600ms — operador digita "2" → aguarda → dispara override com nova qty.
 *  Sincronia bidirecional propaga pra linha do orcamento. */
function EquipmentQuantityInput({
  productId,
  currentQty,
  onChangeQty,
  disabled,
}: {
  productId: string;
  currentQty: number;
  onChangeQty: (qty: number) => void;
  disabled: boolean;
}) {
  const [localQty, setLocalQty] = useState<number>(currentQty);
  const debouncedQty = useDebounce(localQty, 600);
  const userChangedRef = useRef(false);

  // Sincroniza com mudancas externas (ex: user trocou o equipamento, qty volta pro novo default)
  useEffect(() => {
    setLocalQty(currentQty);
    userChangedRef.current = false;
  }, [currentQty, productId]);

  // Dispara mudanca apos debounce — so se o user mexeu
  useEffect(() => {
    if (!userChangedRef.current) return;
    if (debouncedQty === currentQty) return;
    onChangeQty(debouncedQty);
    userChangedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQty]);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-emerald-300 px-2 py-0.5">
      <label className="text-[11px] font-semibold text-emerald-700">Quant.</label>
      <input
        type="number"
        value={localQty}
        onChange={(e) => {
          userChangedRef.current = true;
          setLocalQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)));
        }}
        min={1}
        max={20}
        step={1}
        disabled={disabled}
        className="w-12 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-base font-bold text-slate-900 tabular-nums text-center disabled:bg-slate-100"
      />
    </div>
  );
}

/** Linha do dropdown "Trocar equipamento" — v1.11.86 compacta.
 *  Lista so com nome + capacidade unitaria. Sem input de qty (qty fica no card
 *  do equipamento selecionado em outro lugar). Click seleciona com qty atual ou 1. */
function EquipmentCandidateRow({
  candidate,
  isCurrentSelected,
  currentSelectedQty,
  onSelect,
  disabled,
}: {
  candidate: HeatingCandidate;
  isCurrentSelected: boolean;
  currentSelectedQty: number;
  onSelect: (qty: number) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(isCurrentSelected ? currentSelectedQty : 1)}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
        isCurrentSelected ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 truncate">{candidate.modelName}</span>
        <span className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
          {candidate.kcalHNominal.toLocaleString("pt-BR")} Kcal/h
          {candidate.kwNominal != null ? ` · ${candidate.kwNominal} kW` : ""}
        </span>
      </div>
    </button>
  );
}

/** Card compacto ao lado do "Calor necessario" mostrando contribuicao individual
 *  de cada extra (Cascata/SPA/Borda) em kW + horas/sem editavel + status visual.
 *  Substitui o ExtraDetectedCard antigo (maior) — v1.11.81. */
function ExtraImpactCard({
  icon,
  title,
  extra,
  horasValue,
  onChangeHoras,
  hoursLabel,
}: {
  icon: string;
  title: string;
  extra: ExtraDetected;
  horasValue: number;
  onChangeHoras: (n: number) => void;
  hoursLabel?: string;
}) {
  const tone = extra.status === "IDENTIFICADA_COMPLETA"
    ? { border: "border-emerald-300", bg: "bg-emerald-50", title: "text-emerald-900", muted: "text-emerald-700" }
    : extra.status === "IDENTIFICADA_FALTANDO_INFO"
    ? { border: "border-amber-300", bg: "bg-amber-50", title: "text-amber-900", muted: "text-amber-700" }
    : { border: "border-slate-200", bg: "bg-white", title: "text-slate-700", muted: "text-slate-500" };

  const impactKw = extra.impactKw ?? 0;
  const isPaid = extra.status === "IDENTIFICADA_FALTANDO_INFO";

  return (
    <div
      className={`rounded-lg border ${tone.border} ${tone.bg} px-2.5 py-1.5 min-w-[140px] max-w-[220px]`}
      title={extra.message}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-sm">{icon}</span>
          <span className={`text-[11px] font-semibold ${tone.title}`}>{title}</span>
        </div>
        {!isPaid && impactKw > 0 && (
          <span className={`text-xs font-bold tabular-nums ${tone.title}`}>+{impactKw.toFixed(2)} kW</span>
        )}
        {isPaid && (
          <span className="text-[9px] font-bold uppercase text-amber-700">FALTA INFO</span>
        )}
      </div>
      {extra.status !== "IDENTIFICADA_FALTANDO_INFO" && extra.totalValue > 0 && (
        <div className={`text-[10px] ${tone.muted} truncate`}>{extra.totalValue} {extra.unit}</div>
      )}
      <div className="flex items-center gap-1 mt-1">
        <input
          type="number"
          value={horasValue}
          onChange={(e) => onChangeHoras(Number(e.target.value) || 0)}
          min={0}
          max={hoursLabel?.includes("dia") ? 24 : 168}
          step={1}
          className="w-12 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900 tabular-nums"
        />
        <span className={`text-[10px] ${tone.muted}`}>{hoursLabel ?? "h/sem"}</span>
      </div>
    </div>
  );
}

function ExtraDetectedCard({
  icon,
  title,
  extra,
  horasValue,
  onChangeHoras,
  hoursLabel,
  readOnly,
}: {
  icon: string;
  title: string;
  extra: ExtraDetected;
  horasValue: number;
  onChangeHoras: (n: number) => void;
  hoursLabel?: string;
  readOnly?: boolean;
}) {
  const tone = extra.status === "IDENTIFICADA_COMPLETA"
    ? { border: "border-emerald-200", bg: "bg-emerald-50", title: "text-emerald-900", label: "text-emerald-700" }
    : extra.status === "IDENTIFICADA_FALTANDO_INFO"
    ? { border: "border-amber-300", bg: "bg-amber-50", title: "text-amber-900", label: "text-amber-700" }
    : { border: "border-slate-200", bg: "bg-slate-50", title: "text-slate-600", label: "text-slate-500" };

  return (
    <div className={`rounded-lg border ${tone.border} ${tone.bg} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className={`text-sm font-semibold ${tone.title}`}>{title}</span>
        </div>
        {extra.status === "IDENTIFICADA_COMPLETA" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">OK</span>
        )}
        {extra.status === "IDENTIFICADA_FALTANDO_INFO" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700">FALTA INFO</span>
        )}
      </div>

      {extra.status === "NAO_IDENTIFICADA" && (
        <div className="text-xs text-slate-600">{extra.message}</div>
      )}

      {extra.status === "IDENTIFICADA_FALTANDO_INFO" && (
        <div className="text-xs text-amber-900 leading-snug">{extra.message}</div>
      )}

      {extra.status === "IDENTIFICADA_COMPLETA" && (
        <>
          <div className={`text-xs ${tone.label}`}>
            Total: <strong className={tone.title}>{extra.totalValue} {extra.unit}</strong>
          </div>
          {extra.lines.length > 0 && (
            <div className="text-[10px] text-slate-600 leading-tight">
              {extra.lines.map((l, i) => (
                <div key={i} className="truncate" title={`${l.qty}× ${l.productName} (${l.value} ${extra.unit})`}>
                  • {l.qty}× <span className="font-medium">{l.productName}</span> ({l.value} {extra.unit})
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-emerald-200">
            <label className={`text-[11px] font-medium ${tone.label} whitespace-nowrap`}>
              {hoursLabel ?? "horas/semana"}:
            </label>
            <input
              type="number"
              value={horasValue}
              onChange={(e) => onChangeHoras(Number(e.target.value) || 0)}
              disabled={readOnly}
              min={0}
              max={hoursLabel?.includes("dia") ? 24 : 168}
              step={1}
              className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-sm font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </>
      )}
    </div>
  );
}

function Pill({ icon, text, tone }: { icon: string; text: string; tone: "slate" | "cyan" | "amber" | "orange" | "emerald" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}>
      <span>{icon}</span><span className="font-medium">{text}</span>
    </span>
  );
}

function ComparativoChart({ comparativo }: { comparativo: ComparativoFonte[] }) {
  const fonteInfo: Record<ComparativoFonte["fonte"], { label: string; color: string; bg: string; emoji: string }> = {
    BOMBA_CALOR: { label: "Bomba de Calor", color: "emerald", bg: "bg-emerald-500", emoji: "🔥" },
    GLP: { label: "Gas GLP", color: "orange", bg: "bg-orange-500", emoji: "🔶" },
    GN: { label: "Gas Natural", color: "amber", bg: "bg-amber-500", emoji: "🟡" },
    ELETRICO: { label: "Eletrico (resistencia)", color: "rose", bg: "bg-rose-500", emoji: "⚡" },
  };

  const maxCost = Math.max(...comparativo.map((c) => c.custoAnualBRLCents));
  const bombaCost = comparativo.find((c) => c.fonte === "BOMBA_CALOR")?.custoAnualBRLCents ?? 0;

  // Ordena por custo (menor = melhor)
  const sorted = [...comparativo].sort((a, b) => a.custoAnualBRLCents - b.custoAnualBRLCents);

  return (
    <div className="space-y-4">
      {/* Barras visuais */}
      <div className="space-y-3">
        {sorted.map((c) => {
          const info = fonteInfo[c.fonte];
          const widthPercent = maxCost > 0 ? (c.custoAnualBRLCents / maxCost) * 100 : 0;
          const isBomba = c.fonte === "BOMBA_CALOR";
          const economiaVsBomba = bombaCost > 0 && !isBomba ? ((c.custoAnualBRLCents - bombaCost) / bombaCost) * 100 : 0;

          return (
            <div key={c.fonte} className={`rounded-lg border ${isBomba ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.emoji}</span>
                  <span className={`font-semibold ${isBomba ? "text-emerald-900" : "text-slate-700"}`}>{info.label}</span>
                  {isBomba && <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-semibold">RECOMENDADO</span>}
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold tabular-nums ${isBomba ? "text-emerald-900" : "text-slate-900"}`}>{fmtBRL(c.custoAnualBRLCents)}</div>
                  <div className="text-[10px] text-slate-500">por ano</div>
                </div>
              </div>
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`absolute inset-y-0 left-0 ${info.bg} rounded-full transition-all`}
                  style={{ width: `${widthPercent}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{c.consumoAnual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} {c.consumoUnidade}/ano</span>
                {!isBomba && economiaVsBomba > 0 && (
                  <span className="text-rose-600 font-semibold">+{economiaVsBomba.toFixed(0)}% vs Bomba</span>
                )}
                {isBomba && <span className="text-emerald-600 font-semibold">— mais economica</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo economia */}
      {bombaCost > 0 && (
        <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Economia vs outras fontes</div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {comparativo.filter((c) => c.fonte !== "BOMBA_CALOR").map((c) => {
              const economy = c.custoAnualBRLCents - bombaCost;
              const economyPct = c.custoAnualBRLCents > 0 ? (economy / c.custoAnualBRLCents) * 100 : 0;
              const info = fonteInfo[c.fonte];
              return (
                <div key={c.fonte} className="rounded-lg bg-white border border-emerald-200 p-2">
                  <div className="text-[10px] text-slate-500">vs {info.label}</div>
                  <div className="text-lg font-bold text-emerald-700 tabular-nums">{fmtBRL(economy)}</div>
                  <div className="text-[11px] text-emerald-600">economia/ano ({economyPct.toFixed(0)}%)</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
