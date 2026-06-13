"use client";
// Simulador de Aquecimento (Solar / Bomba de Calor).
// Modal full-screen com abas. Ordem: Solar | Bomba de Calor | Comparativo.
// Ver memory/project_heating_simulator_plan.md pra contexto.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, getAccessToken } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { AutoSelectModal, type AutoSelectRule, type CatalogConfig } from "@/app/(dashboard)/quotes/pool/[id]/page";
import SolarRulesModal from "@/components/pool/SolarRulesModal";
import { HelpHint } from "@/components/ui/HelpHint";

// Dica do vento — fator que MAIS pesa no dimensionamento da bomba de calor.
const VENTO_HINT = "O VENTO e o que MAIS pesa no dimensionamento da bomba de calor — a evaporacao a Moderado e ~40% maior que a Fraco, podendo mudar a quantidade de bombas. Escolha pela exposicao do LOCAL: Fraco = piscina abrigada por muros/cerca/casa (maioria dos quintais); Moderado = area parcialmente aberta; Forte = muito exposto (sitio, litoral, descampado).";

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
  // Vazao de agua (m³/h) recomendada da bomba de calor — faixa [min, max] do cadastro.
  // Dimensiona a bomba de circulacao. Ausente -> card avisa e nao dimensiona.
  vazaoMinM3h?: number;
  vazaoMaxM3h?: number;
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
  imageUrl?: string | null;
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
  // Horas de operacao da bomba de calor por mes (demanda-dirigida) — dimensiona o
  // consumo da bomba de CIRCULACAO. 12 valores (0 em mes inativo). Ver heating.service.
  operatingHoursPerMonth?: number[];
  operatingHoursPerDayAvg?: number;
  // Detalhamento mes a mes (validacao): perda bruta, ganho solar e demanda liquida (kWh/dia).
  operatingHoursDebug?: { perdaKwhDia: number; ganhoSolarKwhDia: number; demandaLiquidaKwhDia: number; horasDia: number }[];
  comparativo?: ComparativoFonte[];
  extrasDetected?: ExtrasDetected;
  // FASE 2 — Borda Infinita: agua dos reservatorios somada ao volume a aquecer.
  bordaVolumeExtraM3?: number;
  bordaSuperficieAbertaM2?: number;
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
  // v1.12.88: difere chamadas a onSaved pro momento de fechar o modal.
  // Antes, cada recompute (extras, capa, vento, dropdown, etc) disparava
  // onSaved → pai fazia await load() → refetch do budget → rerender pesado
  // do modal → scroll resetava pro topo enquanto operador editava.
  // Agora: marca pendingReloadRef e so chama onSaved no handleClose.
  const pendingReloadRef = useRef(false);
  const notifyPendingSave = useCallback(() => {
    pendingReloadRef.current = true;
  }, []);
  const handleClose = useCallback(() => {
    if (pendingReloadRef.current) {
      pendingReloadRef.current = false;
      // Notifica o pai (que faz load()) pra refletir no orcamento as mudancas feitas no
      // Simulador — ex: linha com formula "bombaCalorQty" reflete a Quant nova de bombas.
      // BUG ate v1.13.51: chamava notifyPendingSave() (so RE-setava o ref) em vez de
      // onSaved() -> o orcamento NUNCA recarregava ao fechar, a linha ficava no valor antigo
      // (qty=1) apesar do banco ja estar correto (qty=2). v1.13.52.
      onSaved?.();
    }
    onClose();
  }, [onSaved, onClose]);
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
  const [heatingRule, setHeatingRule] = useState<AutoSelectRule | null>(null);
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

  // Salva regra de auto-selecao da bomba de calor + recarrega candidatos + recomputa report.
  const saveHeatingRule = useCallback(async (rule: AutoSelectRule | null) => {
    try {
      await api.post("/pool-budgets/heating/rule", { rule });
      setHeatingRule(rule);
      try { const cands = await api.get<HeatingCandidate[]>("/pool-budgets/heating/candidates"); setCandidates(cands); } catch { /* ignora */ }
      try { const r = await api.post<HeatingReport>(`/pool-budgets/${budget.id}/heating-report/recompute`); setReport(r); } catch { /* ignora */ }
    } catch (e: any) {
      setError(String(e?.message ?? "Erro ao salvar regra da bomba de calor"));
    }
  }, [budget.id]);
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
    api.get<{ rule: AutoSelectRule | null }>("/pool-budgets/heating/rule")
      .then((r) => setHeatingRule(r?.rule ?? null))
      .catch(() => setHeatingRule(null));
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
      notifyPendingSave();
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
      notifyPendingSave();
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
    extras?: { orientacaoTelhado?: string; inclinacaoTelhadoGraus?: number; temperaturaAguaInicial?: number; alturaTelhadoM?: number; areaPiscinaM2?: number; volumeM3?: number; capa?: 'SIM' | 'NAO'; vento?: 'FRACO' | 'MODERADO' | 'FORTE' },
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
        capa?: 'SIM' | 'NAO';
        vento?: 'FRACO' | 'MODERADO' | 'FORTE';
      } = {
        extraColetoresPct: extraPct ?? solarExtraPct,
        tempDesejada: Number(tempAguaDesejada),
        // v1.12.83: envia capa/vento atuais do form pro backend usar no calculo + persistir.
        // Antes esses campos nao iam, backend usava env do banco e ignorava mudanca da UI.
        capa: capaTermica ? 'SIM' : 'NAO',
        vento: normEnum(vento, ['FRACO', 'MODERADO', 'FORTE'], 'MODERADO') as 'FRACO' | 'MODERADO' | 'FORTE',
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
      notifyPendingSave();
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
      notifyPendingSave();
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
    // FASE 2 — volume inicial do calculo-rapido = piscina + agua dos reservatorios da borda.
    setQuickVolume((Number(dims.volume) || 0) + (Number((dims as any).bordaVolumeExtraM3) || 0));
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
        notifyPendingSave();
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
      notifyPendingSave();
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
            <button onClick={handleClose}
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
            <BombaCalorTab
              onPendingSave={notifyPendingSave}
              budget={budget}
              report={report}
              loading={loading}
              recomputing={saving}
              candidates={candidates}
              changeEquipment={changeEquipment}
              changingEquipment={changingEquipment}
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
              tempAguaInicial={tempAguaInicial}
              setTempAguaInicial={setTempAguaInicial}
              tipoPiscina={tipoPiscina}
              setTipoPiscina={setTipoPiscina}
              tipoConstrucao={tipoConstrucao}
              setTipoConstrucao={setTipoConstrucao}
              onRecompute={handleSaveAndRecompute}
              headerImage={solarHeaderImage}
              headerImageUploading={headerImageUploading}
              onUploadHeaderImage={uploadSolarHeaderImage}
              onRemoveHeaderImage={removeSolarHeaderImage}
              catalog={catalog ?? []}
              heatingRule={heatingRule}
              onSaveHeatingRule={saveHeatingRule}
              cascataHorasSemana={cascataHorasSemana}
              onChangeCascataHoras={touchAndSetCascata}
              hidromassagemHorasSemana={hidromassagemHorasSemana}
              onChangeHidroHoras={touchAndSetHidro}
              bordaInfinitaHorasAtivaDia={bordaInfinitaHorasAtivaDia}
              onChangeBordaHoras={touchAndSetBorda}
            />
          )}

          {activeTab === "solar" && (
            <SolarTab
              onPendingSave={notifyPendingSave}
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
  coletorRule, bombaRule, onSaveColetorRule, onSaveBombaRule, onPendingSave,
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
  onPendingSave?: () => void;
}) {
  const dims = budget.poolDimensions ?? {};
  const area = Number(dims.area) || 0;
  // FASE 2 — volume total = piscina + agua dos reservatorios da Borda Infinita. Usado como
  // base do override do recalculo solar (senao o backend perde a borda ao receber o override).
  const volume = (Number(dims.volume) || 0) + (Number((dims as any).bordaVolumeExtraM3) || 0);
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
  const initPipeComprimento = Number(initPipe?.inputs?.comprimentoM) || 30;
  const initPipeDesnivel = Number(initPipe?.inputs?.desnivelM) || 4;
  const initPipeResult = initPipe?.result ?? null;
  const [orientacaoTelhado, setOrientacaoTelhado] = useState<string>(initOrient);
  const [inclinacaoTelhado, setInclinacaoTelhado] = useState<number>(initIncl);
  const [temperaturaInicial, setTemperaturaInicial] = useState<number>(initTempIni);
  const [pipeComprimento, setPipeComprimento] = useState<number>(initPipeComprimento);
  const [pipeDesnivel, setPipeDesnivel] = useState<number>(initPipeDesnivel);
  const [pipeResult, setPipeResult] = useState<any | null>(initPipeResult);
  const [pipeRecomputing, setPipeRecomputing] = useState(false);

  // v1.13.29: recalcula a tubulacao no 1o acesso (defaults 30/4) pra nao mostrar "preencha"
  // com os campos ja preenchidos. !pipeResult evita re-rodar depois de ja ter calculado.
  useEffect(() => {
    if (pipeComprimento > 0 && !pipeResult && (report?.vazaoTotalM3h || 0) > 0) recomputePipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.vazaoTotalM3h]);

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
    indicator: { value: number; label: string; groupLabel?: string; color: string; unit: string } | null;
  }
  const initSelectedBombaId = (budget.environmentParams as any)?.solarReport?.selectedBombaId ?? null;
  const initBombaManuallySelected = (budget.environmentParams as any)?.solarReport?.bombaManuallySelected === true;
  const [bombaCandidates, setBombaCandidates] = useState<BombaCandidate[]>([]);
  const [selectedBombaId, setSelectedBombaId] = useState<string | null>(initSelectedBombaId);
  const [bombaManuallySelected, setBombaManuallySelected] = useState<boolean>(initBombaManuallySelected);
  // v1.13.55: N em paralelo da recirc solar (auto = teto(vazaoAlvo/vazaoBomba); operador ajusta).
  const [selectedBombaQty, setSelectedBombaQty] = useState<number>(Math.max(1, Math.round(Number((budget.environmentParams as any)?.solarReport?.selectedBombaQty) || 1)));
  const [bombaCandidatesLoading, setBombaCandidatesLoading] = useState(false);

  // v1.12.63: regras solares configuraveis
  const [showSolarRulesModal, setShowSolarRulesModal] = useState(false);
  const [activeRule, setActiveRule] = useState<{ id: string; name: string } | null>(null);

  // v1.12.78: tarifa de energia (R$/kWh em centavos). Default 95 = R$ 0,95/kWh.
  // Armazenada em Company.systemConfig.pool.tarifaKwhBRLCents (tenant global).
  const [tarifaKwhBRLCents, setTarifaKwhBRLCents] = useState<number>(95);

  // v1.12.84: report da demanda termica unificada (thermal-demand). Calculo
  // central que considera TODOS os 14 fatores: capa, vento, ΔT, telhado,
  // clima, eficiencia coletor, extras (cascata/hidro/borda). Substitui o
  // calculo local de consumo da bomba — agora vem direto do backend.
  type ThermalDemandReport = {
    monthly: Array<{
      monthIndex: number; monthName: string; tempAmbiente: number;
      qPerdasKwhDia: number; qPerdasKwhMes: number;
      qSolarKwhDia?: number; qSolarKwhMes?: number;
      coberturaSolarPct?: number;
      fatorUtilizacaoBomba?: number; bombaHorasDia?: number; bombaConsumoKwhMes?: number;
      hseHorasDia?: number;
    }>;
    qPerdasMediaKwhDia: number; qPerdasMediaKwhMes: number; qPerdasPicoKwhDia: number;
    qSolarMediaKwhDia?: number; qSolarMediaKwhMes?: number; coberturaSolarMediaPct?: number;
    bombaHorasDiaMedio?: number; bombaConsumoKwhMesMedio?: number; bombaPotenciaKW?: number;
    inputs: {
      tempAlvo: number; tempInicial?: number; capaTermica: boolean; vento: string;
      tipoConstrucao?: string;
      areaM2: number; volumeM3: number;
      qtdColetores?: number; areaTotalColetorM2?: number;
      orientacaoTelhado?: string; inclinacaoTelhadoGraus?: number; fatorInstalacao?: number;
      perdaBaseWm2?: number; ventoMult?: number; construcaoMult?: number;
      deltaTBaseAnualMult?: number; extrasKwTotal?: number;
      hspInclinadoMedio?: number; floorFatorBomba?: number; fatorHorasOperacaoReal?: number;
      rendimentoBomba?: number;
      vazaoBombaM3h?: number; vazaoSolarM3h?: number; fatorVazao?: number;
    };
  };
  const [thermalReport, setThermalReport] = useState<ThermalDemandReport | null>(null);

  // Recalcula thermal-demand sempre que o report solar, bomba ou inputs criticos mudam.
  // v1.12.89: agora envia TAMBEM capa e vento atuais do form (antes lia so do banco,
  // que tinha delay de save do recomputeSolar — quando vento mudava na UI, demand
  // ainda usava valor antigo do banco).
  useEffect(() => {
    if (!report || !selectedBombaId) { setThermalReport(null); return; }
    const selBomba = bombaCandidates.find((b) => b.productId === selectedBombaId) ?? bombaCandidates[0];
    if (!selBomba?.potenciaCv) { setThermalReport(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await api.post<ThermalDemandReport>(`/pool-budgets/${budget.id}/thermal-demand`, {
          tempAlvo: Number(tempAguaDesejada),
          tempInicial: Number.isFinite(temperaturaInicial) ? temperaturaInicial : undefined,
          capaTermica,
          vento: normEnum(vento, ['FRACO', 'MODERADO', 'FORTE'], 'MODERADO'),
          qtdColetores: Math.round(Number(report.qtdColetores) || 0),
          orientacaoTelhado,
          inclinacaoTelhadoGraus: Number.isFinite(inclinacaoTelhado) ? inclinacaoTelhado : undefined,
          potenciaCv: selBomba.potenciaCv,
          // v1.12.93: vazao da bomba pra calcular fator de vazao (bomba com
          // mais vazao circula mais rapido → coletor esfria → controlador desliga antes)
          vazaoBombaM3h: selBomba.vazaoM3h,
        });
        if (!cancelled) setThermalReport(r);
      } catch {
        if (!cancelled) setThermalReport(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget.id, report?.computedAt, report?.qtdColetores, selectedBombaId, tempAguaDesejada, temperaturaInicial, orientacaoTelhado, inclinacaoTelhado, capaTermica, vento]);
  const [showTarifaPopover, setShowTarifaPopover] = useState(false);
  const [tarifaInputValue, setTarifaInputValue] = useState<string>("0,95");
  const [tarifaSaving, setTarifaSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ tarifaKwhBRLCents: number }>("/pool-budgets/solar-tarifa-kwh");
        if (!cancelled && Number.isFinite(r.tarifaKwhBRLCents)) {
          setTarifaKwhBRLCents(r.tarifaKwhBRLCents);
          setTarifaInputValue((r.tarifaKwhBRLCents / 100).toFixed(2).replace(".", ","));
        }
      } catch {
        // mantem default 95
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const saveTarifa = async () => {
    const norm = tarifaInputValue.replace(",", ".").trim();
    const reais = Number(norm);
    if (!Number.isFinite(reais) || reais <= 0 || reais > 1000) {
      alert("Tarifa invalida. Use valor entre R$ 0,01 e R$ 1.000,00.");
      return;
    }
    const cents = Math.round(reais * 100);
    setTarifaSaving(true);
    try {
      const r = await api.patch<{ tarifaKwhBRLCents: number }>("/pool-budgets/solar-tarifa-kwh", { tarifaKwhBRLCents: cents });
      setTarifaKwhBRLCents(r.tarifaKwhBRLCents);
      setShowTarifaPopover(false);
    } catch (err: any) {
      alert(`Erro ao salvar tarifa: ${err?.message ?? err}`);
    } finally {
      setTarifaSaving(false);
    }
  };

  // Resolve regra ativa (badge "Regra: X" abaixo do diagrama). Re-resolve quando
  // muda o coletor selecionado ou quando o operador edita as regras no modal.
  const reloadActiveRule = useCallback(async () => {
    try {
      const res = await api.get<{ rule: { id: string; name: string } | null }>(
        `/pool-budgets/${budget.id}/solar-active-rule`,
      );
      setActiveRule(res?.rule ?? null);
    } catch {
      setActiveRule(null);
    }
  }, [budget.id]);
  useEffect(() => {
    if (!report) return;
    reloadActiveRule();
  }, [report, reloadActiveRule, selectedCollectorId]);

  // v1.12.62: distincao entre escolha MANUAL (operador clicou no dropdown) vs
  // DEFAULT (primeiro candidato sugerido pela regra). Sem isso, ao reduzir vazao
  // a bomba grande ficava "ainda passando" na regra e nao voltava ao default.
  // Re-roda quando pipeResult muda (altura nova) ou report.vazaoTotalM3h muda.
  useEffect(() => {
    if (!report || !report.vazaoTotalM3h || report.vazaoTotalM3h <= 0) {
      setBombaCandidates([]);
      return;
    }
    let cancelled = false;
    setBombaCandidatesLoading(true);
    // v1.13.55: maxParalelo=6 inclui bombas menores usaveis com N em paralelo.
    api.get<{ candidates: BombaCandidate[] }>(`/pool-budgets/${budget.id}/solar-bomba-candidates?maxParalelo=6`)
      .then((res) => {
        if (cancelled) return;
        const candidates = res?.candidates ?? [];
        setBombaCandidates(candidates);
        if (candidates.length === 0) {
          setSelectedBombaId(null);
          return;
        }
        // Se foi escolha manual E a bomba escolhida ainda esta na lista → preserva.
        // Caso contrario adota o default. Manual obsoleta (saiu da lista) → limpa no servidor.
        if (bombaManuallySelected && selectedBombaId) {
          const stillValid = candidates.some((c) => c.productId === selectedBombaId);
          if (stillValid) return;
          setBombaManuallySelected(false);
          api.post(`/pool-budgets/${budget.id}/solar-bomba-selection`, { productId: null })
            .catch((err) => console.warn('Falha ao limpar bomba manual obsoleta:', err));
        }
        // Default inteligente (display): menor bomba que atende SOZINHA (N=1); se nenhuma atende,
        // a MAIOR (minimiza N). Auto-N = teto(vazaoAlvo/vazaoBomba). Sem persistir (manual=false
        // implicito; persiste quando o operador clica no dropdown). v1.13.55.
        const alvo = Number(report.vazaoTotalM3h) || 0;
        const meetsAlone = candidates.filter((c) => (c.vazaoM3h || 0) >= alvo - 0.01);
        const def = meetsAlone.length ? meetsAlone[0] : [...candidates].sort((a, b) => (b.vazaoM3h || 0) - (a.vazaoM3h || 0))[0];
        setSelectedBombaId(def.productId);
        setSelectedBombaQty(Math.max(1, Math.min(6, Math.ceil(alvo / (def.vazaoM3h || alvo)))));
      })
      .catch(() => {
        if (!cancelled) setBombaCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setBombaCandidatesLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget.id, report?.vazaoTotalM3h, pipeResult?.alturaManometricaTotal, bombaRule?.where, bombaRule?.orderBy, bombaRule?.filterPoolType, bombaRule?.filterDescription, JSON.stringify(bombaRule?.indicator)]);

  async function handleSelectBomba(productId: string | null) {
    setSelectedBombaId(productId);
    setBombaManuallySelected(productId !== null);
    // v1.13.55: auto-N pra bomba escolhida = teto(vazaoAlvo/vazaoBomba), clamp [1,6].
    const alvo = Number(report?.vazaoTotalM3h) || 0;
    const p = bombaCandidates.find((c) => c.productId === productId);
    const n = productId && p ? Math.max(1, Math.min(6, Math.ceil(alvo / (p.vazaoM3h || alvo)))) : 1;
    setSelectedBombaQty(n);
    try {
      // manual=true ao escolher pelo dropdown, productId=null limpa a flag.
      await api.post(`/pool-budgets/${budget.id}/solar-bomba-selection`, { productId, manual: productId !== null, qty: n });
      // v1.13.52: o endpoint agora recalcula (linhas com useSolarBomba vinculam) — marca
      // reload pendente pro orcamento refletir ao fechar o Simulador.
      onPendingSave?.();
    } catch (err) {
      console.warn('Falha ao salvar selectedBombaId:', err);
    }
  }
  // v1.13.55: operador ajusta o N (em paralelo) manualmente — persiste com o produto atual.
  async function handleSetBombaQty(n: number) {
    const qty = Math.max(1, Math.min(6, Math.round(Number(n) || 1)));
    setSelectedBombaQty(qty);
    if (!selectedBombaId) return;
    try {
      await api.post(`/pool-budgets/${budget.id}/solar-bomba-selection`, { productId: selectedBombaId, manual: bombaManuallySelected, qty });
      onPendingSave?.();
    } catch (err) {
      console.warn('Falha ao salvar qty da bomba:', err);
    }
  }

  // v1.12.87: sincronia do pipe foi movida pro backend (computeAndSaveReport ja
  // recalcula o pipe quando ha solarPipe configurado, e o endpoint
  // /solar-report/recompute retorna solarPipeAfter junto). UseEffect anterior
  // (v1.12.86) sofria race condition e foi removido. O `report` aqui ja vem
  // com a propriedade solarPipeAfter populada pelo backend — o useEffect
  // abaixo so atualiza o state local.
  useEffect(() => {
    const pipeAfter = (report as any)?.solarPipeAfter?.result;
    if (pipeAfter) {
      setPipeResult(pipeAfter);
    }
  }, [report]);

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
  // v1.12.77: removido pdfPreviewMode + botao 👁️ PDF — redundante com o botao Imprimir
  // (Chrome ja abre print preview automatico, mesmo resultado visual).

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
  // v1.12.72: helper compartilhado — clona #solar-pdf-area pra dentro do body.
  // Resolve IDs duplicados (gradients SVG) prefixando todos os IDs internos.
  // Usado tanto pelo Preview (visualizar) quanto pelo Print (clone fica no DOM
  // durante window.print, evita que o Chrome tente printar o original enterrado
  // dentro do modal `fixed inset-0 overflow-hidden`, que duplica em 2 paginas).
  const createPdfClone = (cloneClassName: string): HTMLElement | null => {
    const original = document.getElementById("solar-pdf-area");
    if (!original) return null;
    const container = document.createElement("div");
    container.className = `solar-pdf-clone-container ${cloneClassName}`;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.id = "solar-pdf-clone";
    const prefix = "clone-";
    clone.querySelectorAll('[id]').forEach((el) => {
      const oldId = el.getAttribute('id')!;
      el.setAttribute('id', `${prefix}${oldId}`);
    });
    clone.querySelectorAll('[fill], [stroke]').forEach((el) => {
      ['fill', 'stroke'].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v?.startsWith('url(#')) {
          const ref = v.slice(5, -1);
          el.setAttribute(attr, `url(#${prefix}${ref})`);
        }
      });
    });
    container.appendChild(clone);
    document.body.appendChild(container);
    // v1.12.74: forca remocao do min-h-[1120px] da tela (cloneNode preserva
    // classes do Tailwind, e a regra `min-height: 0` no CSS pode nao vencer
    // por especificidade). Aqui zeramos no DOM direto.
    clone.style.minHeight = "0";
    clone.style.height = "auto";
    return container;
  };

  // v1.12.72: impressao SEMPRE via clone no body — soluciona o problema das 2
  // paginas porque o original esta dentro de um modal fixed+overflow-hidden que
  // confunde o motor de print do Chrome. CSS @media print + html.printing-mode
  // mostra so o clone, escondendo todo o resto (inclusive o original).
  const printViaClone = () => {
    // Cleanup defensivo: garante zero clones residuais antes de criar o novo
    document.querySelectorAll(".solar-pdf-clone-container").forEach((el) => el.remove());

    const container = createPdfClone("printing-clone");
    if (!container) return;

    document.documentElement.classList.add("printing-mode");

    const cleanupAfterPrint = () => {
      document.documentElement.classList.remove("printing-mode");
      document.querySelectorAll(".solar-pdf-clone-container").forEach((el) => el.remove());
      window.removeEventListener("afterprint", cleanupAfterPrint);
    };
    window.addEventListener("afterprint", cleanupAfterPrint);

    // Pequeno delay pro browser pintar o clone + computar layout
    setTimeout(() => {
      window.print();
      // Fallback: se afterprint nao disparar (alguns browsers), limpa em 1s
      setTimeout(() => {
        if (document.documentElement.classList.contains("printing-mode")) {
          cleanupAfterPrint();
        }
      }, 1000);
    }, 50);
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando dados solares...</div>;
  }

  const selectedMonth = report?.monthly?.[selectedMonthIdx];
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  // v1.12.68: slug do tenant extraido do hostname (ex: "sls.tecnikos.com.br" -> "sls").
  // Usado pra carregar a logo da empresa via endpoint publico /api/public/tenant/:slug/logo/:variant.
  const tenantSlug = typeof window !== "undefined"
    ? (window.location.hostname.split('.')[0] || null)
    : null;

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
              // v1.12.65: inclui TODOS os campos editaveis manualmente no recompute —
              // antes so passava area/volume, entao mudar orientacao/inclinacao/temp.inicial
              // no formulario nao surtia efeito (backend lia valor antigo do banco).
              const extras: {
                areaPiscinaM2?: number;
                volumeM3?: number;
                orientacaoTelhado?: string;
                inclinacaoTelhadoGraus?: number;
                temperaturaAguaInicial?: number;
              } = {};
              if (dimManual) {
                if (Number.isFinite(dispArea) && dispArea > 0) extras.areaPiscinaM2 = dispArea;
                if (Number.isFinite(dispVolume) && dispVolume > 0) extras.volumeM3 = dispVolume;
              }
              if (orientacaoTelhado) extras.orientacaoTelhado = orientacaoTelhado;
              if (Number.isFinite(inclinacaoTelhado)) extras.inclinacaoTelhadoGraus = inclinacaoTelhado;
              if (Number.isFinite(temperaturaInicial) && temperaturaInicial > 0) extras.temperaturaAguaInicial = temperaturaInicial;
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
          <button onClick={printViaClone}
            className="rounded border border-slate-300 bg-white text-slate-700 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 transition shadow-sm whitespace-nowrap">
            🖨️ Imprimir
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
          <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* v1.12.68: logo do tenant a esquerda. Usa endpoint publico que serve a logo
                  pela variant 'icon-192' (quadrada, mas funciona como mark identitario). */}
              {tenantSlug && (
                <img
                  src={`/api/public/tenant/${tenantSlug}/logo/icon-192`}
                  alt="Logo"
                  className="h-10 w-10 rounded bg-white/10 object-contain flex-shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.18em] text-amber-300 font-medium">Aquecimento solar para piscinas</div>
                <h2 className="text-base font-bold mt-0.5 leading-tight">Dimensionamento para Coletor Solar</h2>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300">Orçamento</div>
              <div className="text-xl font-bold tabular-nums leading-tight">{budget.code ?? "—"}</div>
              <div className="text-[10px] text-slate-300 mt-0.5">{today}</div>
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
                  {/* Linha 5: dropdown Modo de dimensão da piscina — escondido no print (v1.12.71) */}
                  <div className="mt-1 print:hidden">
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
                      <ConfigFieldBig label="Vento" manual={cfgManual} hint={VENTO_HINT}>
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
                    {/* L3: Cidade | Estado (2 cards pra alinhar com a coluna Dimensoes — Tipo Piscina | Tipo Construcao) */}
                    <div className="grid grid-cols-2 gap-1">
                      <ConfigFieldBig label="Cidade" manual={cfgManual}>
                        <select value={cidade} onChange={(e) => setCidade(e.target.value)}
                          disabled={!uf || !cfgManual}
                          className={`w-full bg-transparent text-[10.5px] font-bold leading-[1.1] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed print:hidden h-[14px] -mt-0.5 ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="">{uf ? "Capital" : "Selecione UF"}</option>
                          {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <span className="hidden print:inline-block text-[10.5px] font-bold text-slate-900 leading-[1.1]">{cidade || "—"}</span>
                      </ConfigFieldBig>
                      <ConfigFieldBig label="Estado" manual={cfgManual}>
                        <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); }}
                          disabled={!cfgManual}
                          className={`w-full bg-transparent text-[10.5px] font-bold leading-[1.1] focus:outline-none disabled:cursor-not-allowed print:hidden h-[14px] -mt-0.5 ${cfgManual ? "text-emerald-900" : "text-slate-900"}`}>
                          <option value="">--</option>
                          {availableUfs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
                        </select>
                        <span className="hidden print:inline-block text-[10.5px] font-bold text-slate-900 leading-[1.1]">{uf || "—"}</span>
                      </ConfigFieldBig>
                    </div>
                    {/* L4: Temp. inicial | Temp. final — cor amber (auto) ou verde (manual) */}
                    <div className="grid grid-cols-2 gap-1">
                      <BigHighlightInput label="Temp. inicial" value={temperaturaInicial} onChange={setTemperaturaInicial} unit="°C" min={5} max={40} manual={cfgManual} />
                      <BigHighlightInput label="Temp. final" value={tempAguaDesejada} onChange={setTempAguaDesejada} unit="°C" min={20} max={40} manual={cfgManual} />
                    </div>
                    {/* L5: dropdown Modo da configuração do aquecimento — escondido no print (v1.12.71) */}
                    <div className="print:hidden">
                      <SelectCard label="Modo da configuração do aquecimento" value={modoConfigAquec}
                        options={[{ v: "AUTOMATICO", l: "Automático" }, { v: "MANUAL", l: "Manual" }]}
                        onChange={(v) => setModoConfigAquec(v)} fullWidth />
                    </div>
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
                    // v1.12.74: imagem ainda saia maior que os cards no print —
                    // reduzido de 58mm pra 52mm pra alinhar com a base dos cards
                    // e liberar espaco que causava 2a pagina em branco.
                    // v1.12.75: trocado `h-full + max-h-[52mm]` por `h-[52mm]` fixo —
                    // h-full depende da altura da grid row (items-stretch). Se col-span-8
                    // ficar curto, a row encolhe e a imagem com h-full some. Altura fixa
                    // resolve definitivamente.
                    <div className="w-full aspect-square print:aspect-auto print:h-[52mm] rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
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
              Print: fundo branco + texto azul + borda (sem depender de "Gráficos de segundo plano")
              v1.12.74: print:mb-1 pra criar respiro entre banner e cards (estavam encostados) */}
          <div className="bg-blue-900 text-white px-5 py-1.5 print:mb-1">
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
                  {/* v1.12.55: diagrama em card de tamanho FIXO (170px de altura) — escala interna */}
                  {/* v1.12.64: badge da regra no TOPO (header) + warnings de erro/info abaixo do header */}
                  {report.numBaterias > 0 && (
                    <div className="mt-1.5 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-[8.5px] uppercase tracking-wider font-bold text-slate-600 flex-shrink-0">
                          Diagrama da instalação
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {activeRule ? (
                            <button
                              type="button"
                              onClick={() => setShowSolarRulesModal(true)}
                              title={`Regra aplicada: ${activeRule.name}. Clique para gerenciar.`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-cyan-300 bg-cyan-50 text-[9px] font-semibold text-cyan-800 hover:bg-cyan-100 print:hidden truncate max-w-[120px]"
                            >
                              <span className="text-cyan-600">●</span>
                              <span className="truncate">{activeRule.name}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowSolarRulesModal(true)}
                              title="Nenhuma regra solar específica para este coletor. Usando padrões do sistema."
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-[9px] font-semibold text-amber-800 hover:bg-amber-100 print:hidden"
                            >
                              <span>⚠</span>
                              <span>sem regra</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowSolarRulesModal(true)}
                            title="Cadastrar / editar regras de dimensionamento por modelo de coletor"
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 hover:text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50 print:hidden flex-shrink-0"
                          >
                            ⚙ Regras
                          </button>
                        </div>
                      </div>

                      {/* v1.12.64: bandagem de erros/info relativa a regra solar (filtra warnings que falam sobre regra/tipo/modelo) */}
                      {Array.isArray(report.warnings) && report.warnings.length > 0 && (
                        <div className="mb-1.5 space-y-0.5">
                          {report.warnings
                            .filter((w) => /regra|tipo|modelo|usando padroes|coletor "/i.test(w.message))
                            .slice(0, 3)
                            .map((w, idx) => (
                              <div
                                key={idx}
                                className={`text-[9px] leading-snug rounded px-1.5 py-1 border ${
                                  w.severity === "warning"
                                    ? "bg-amber-50 border-amber-200 text-amber-900"
                                    : "bg-sky-50 border-sky-200 text-sky-900"
                                }`}
                              >
                                <span className="font-bold mr-1">
                                  {w.severity === "warning" ? "⚠" : "ℹ"}
                                </span>
                                {w.message}
                              </div>
                            ))}
                        </div>
                      )}

                      <BatteryDiagram
                        numRamos={report.numRamosParalelos ?? 1}
                        batPorRamo={report.batPorRamo ?? report.numBaterias}
                        coletoresPorBateria={report.coletoresPorBateria}
                      />
                    </div>
                  )}

                  {/* v1.12.66: sem regra cadastrada para o coletor → numBaterias=0.
                      Substitui o diagrama por mensagem de erro orientando o operador. */}
                  {report.numBaterias === 0 && (
                    <div className="mt-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-amber-700 text-base leading-none">⚠</span>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-amber-900">
                          Diagrama da instalação — sem dimensionamento
                        </div>
                      </div>
                      <p className="text-[11px] leading-snug text-amber-900 mb-2">
                        O sistema não tem regra cadastrada pra dimensionar baterias e vazão deste coletor.
                        Verifique os warnings acima e:
                      </p>
                      <ul className="text-[11px] leading-snug text-amber-900 space-y-1 list-disc list-outside ml-4">
                        <li>
                          Confirme que o coletor selecionado tem os campos <strong>Tipo</strong> e{" "}
                          <strong>Modelo</strong> preenchidos em <em>Cadastros &gt; Produtos &gt; aba Piscina</em>
                        </li>
                        <li>
                          Cadastre uma regra solar pra esse modelo no botão <strong>⚙ Regras</strong> abaixo
                        </li>
                      </ul>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowSolarRulesModal(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 print:hidden"
                        >
                          ⚙ Cadastrar regra agora
                        </button>
                      </div>
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

                  {/* v1.12.55: slider substituido por stepper −/+. Clique discreto, sem drag. */}
                  <div>
                    <SectionLabel>Aumento da eficiência (coletores extras)</SectionLabel>
                    <div className="mt-1 flex items-center gap-1.5 print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0, extraPct - 1);
                          setExtraPct(next);
                          onRecompute(next, undefined);
                        }}
                        disabled={extraPct <= 0}
                        className="w-7 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-sm font-bold leading-none flex items-center justify-center transition shadow-sm"
                        title="Diminuir"
                      >−</button>
                      <div className="bg-emerald-50 border border-emerald-300 rounded px-3 py-0.5 text-[12px] font-bold text-emerald-800 tabular-nums min-w-[56px] text-center">
                        +{extraPct} <span className="text-[9px] text-emerald-600">({extraPct * 10}%)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(10, extraPct + 1);
                          setExtraPct(next);
                          onRecompute(next, undefined);
                        }}
                        disabled={extraPct >= 10}
                        className="w-7 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-sm font-bold leading-none flex items-center justify-center transition shadow-sm"
                        title="Aumentar"
                      >+</button>
                      <span className="text-[9px] text-slate-500 italic ml-2">Aumenta a eficiência em meses frios (0–10).</span>
                    </div>
                    {/* v1.12.69: versao print do extra. Sem o stepper interativo, mostra so o valor + percentual. */}
                    <div className="hidden print:block mt-1">
                      <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-300 rounded px-3 py-1 text-[11px] font-bold text-emerald-800">
                        +{extraPct} coletor{extraPct === 1 ? "" : "es"} extras <span className="text-[10px] text-emerald-600">({extraPct * 10}%)</span>
                      </div>
                      <span className="text-[9px] text-slate-600 italic ml-2">Aumenta a eficiência em meses frios.</span>
                    </div>
                  </div>

                  {/* v1.12.34: bloco Tubulacao — calculadora de perda de carga.
                      v1.12.38: movido pra ANTES da Bomba — o calculo da tubulacao
                      eh pre-requisito (altura manometrica) pra escolher a bomba certa.
                      Operador informa comprimento (ida+volta) + desnivel. Backend
                      calcula altura manometrica total (Darcy-Weisbach + Haaland) e
                      persiste em environmentParams.solarPipe + alturaTelhadoM.
                      A auto-selecao da bomba usa esse valor. */}
                  <div>
                    <SectionLabel>🚰 Tubulação — perda de carga</SectionLabel>
                    <div className="mt-1 rounded border border-slate-200 bg-slate-50/50 p-1.5 space-y-1">
                      <div className="grid grid-cols-2 gap-1.5 items-center print:hidden">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap" title="Comprimento total da tubulacao em metros (ida + volta).">
                            Comp. (m)
                          </label>
                          <input
                            type="number" step="0.5" min="0"
                            value={pipeComprimento || ""}
                            onChange={(e) => setPipeComprimento(Number(e.target.value) || 0)}
                            onBlur={() => recomputePipe({ comprimentoM: pipeComprimento })}
                            placeholder="30"
                            className="flex-1 min-w-0 rounded border border-slate-300 px-1.5 py-0.5 text-[12px] font-semibold focus:border-amber-500 focus:outline-none h-6"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap" title="Altura geometrica do telhado em metros (desnivel).">
                            Desnív. (m)
                          </label>
                          <input
                            type="number" step="0.5" min="0"
                            value={pipeDesnivel || ""}
                            onChange={(e) => setPipeDesnivel(Number(e.target.value) || 0)}
                            onBlur={() => recomputePipe({ desnivelM: pipeDesnivel })}
                            placeholder="4"
                            className="flex-1 min-w-0 rounded border border-slate-300 px-1.5 py-0.5 text-[12px] font-semibold focus:border-amber-500 focus:outline-none h-6"
                          />
                        </div>
                      </div>
                      {/* v1.12.69: no print, mostra Comp+Desniv como texto simples (sem input) */}
                      <div className="hidden print:flex gap-3 text-[9px] uppercase tracking-wider text-slate-600 font-semibold">
                        <span>Comp.: <span className="text-slate-900 normal-case font-bold text-[10px]">{pipeComprimento || 0} m</span></span>
                        <span>Desnív.: <span className="text-slate-900 normal-case font-bold text-[10px]">{pipeDesnivel || 0} m</span></span>
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
                              = {pipeResult.perdaDinamica?.toFixed(2)} mca tubulação
                              {(pipeResult as any).perdaBateriasMca > 0 && (
                                <> + {(pipeResult as any).perdaBateriasMca.toFixed(2)} mca baterias<span className="text-[8.5px] opacity-75"> ({report.coletoresPorBateria}col × {report.batPorRamo ?? report.numBaterias}série)</span></>
                              )}
                              {" "}+ {pipeDesnivel} m desnível · velocidade <span className={veloCls}>{pipeResult.velocidade?.toFixed(2)} m/s</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <label className={`text-[10px] uppercase tracking-wider font-bold ${labelCls}`}>📏 Tubo:</label>
                              <span className={`text-[11px] font-semibold ${valueCls}`}>{pipeResult.material ?? 'PVC'}</span>
                              {/* Select interativo na tela */}
                              <select
                                value={dnAtual}
                                onChange={(e) => recomputePipe({ diametroMm: Number(e.target.value) })}
                                className={`text-xs font-bold rounded border px-2 py-0.5 print:hidden ${velocidadeAlta ? 'border-red-400 bg-white text-red-900' : 'border-amber-400 bg-white text-amber-900'} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                              >
                                {availableDns.map((d) => (
                                  <option key={d} value={d}>{d} mm DN</option>
                                ))}
                              </select>
                              {/* Valor texto no print */}
                              <span className={`hidden print:inline-block text-xs font-bold ${valueCls}`}>{dnAtual} mm DN</span>
                              {pipeResult.diametroAutoPicked
                                ? <span className="text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">auto</span>
                                : <span className="text-[9px] uppercase tracking-wider text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">manual</span>}
                              {pipeResult.diametroInternoMm && <span className={`text-[10px] ${subCls}`}>(DI {pipeResult.diametroInternoMm} mm)</span>}
                              <button
                                type="button"
                                onClick={() => recomputePipe({ diametroMm: null })}
                                className="text-[10px] underline text-slate-500 hover:text-slate-700 print:hidden"
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
                          ) : (<>
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
                                if (c.indicator) {
                                  const decimals = Math.abs(c.indicator.value) < 10 ? 1 : 0;
                                  const formatted = c.indicator.value.toFixed(decimals).replace('.', ',');
                                  parts.push(`${formatted}${c.indicator.unit} (${c.indicator.label})`);
                                }
                                return <option key={c.productId} value={c.productId}>{parts.join(' · ')}</option>;
                              })}
                            </select>
                            {/* v1.13.55: Quant. (N em paralelo) + vazao total vs alvo */}
                            {(() => {
                              const sb = bombaCandidates.find((b) => b.productId === selectedBombaId) ?? bombaCandidates[0];
                              if (!sb) return null;
                              const alvo = Number(report.vazaoTotalM3h) || 0;
                              const total = (sb.vazaoM3h || 0) * selectedBombaQty;
                              const ok = total >= alvo - 0.01;
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1 print:hidden">
                                  <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Quant.</span>
                                  <input type="number" min={1} max={6} value={selectedBombaQty} onChange={(e) => handleSetBombaQty(Number(e.target.value) || 1)} className="w-9 rounded border border-slate-300 px-1 py-0.5 text-[11px] font-bold text-center" />
                                  {selectedBombaQty > 1 && <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">⚡ {selectedBombaQty}× em paralelo</span>}
                                  <span className={"text-[10px] font-bold " + (ok ? "text-emerald-600" : "text-red-600")}>Vazão total {total.toFixed(1)} m³/h {ok ? "≥" : "<"} {alvo.toFixed(1)} alvo</span>
                                </div>
                              );
                            })()}
                          </>)}
                        </div>
                      </div>
                      {/* v1.12.53: card com imagem + specs da bomba selecionada (mesmo padrao do coletor) */}
                      {bombaCandidates.length > 0 && (() => {
                        const selBomba = bombaCandidates.find((b) => b.productId === selectedBombaId) ?? bombaCandidates[0];
                        if (!selBomba) return null;

                        // v1.12.84: usa thermal-demand do backend quando disponivel (cobre
                        // TODOS os 14 fatores via Tabela78). Fallback pro calculo local
                        // (HSE × min(1, perda/ganho)) quando o endpoint nao retornou ainda.
                        const consumoFromBackend = thermalReport && thermalReport.bombaConsumoKwhMesMedio != null
                          ? {
                              hseMedio: thermalReport.bombaHorasDiaMedio ?? 0,
                              horasDiaMedio: thermalReport.bombaHorasDiaMedio ?? 0,
                              fatorMedio: thermalReport.monthly[0]?.fatorUtilizacaoBomba ?? 0,
                              floorByTarget: 0,
                              tempAlvo: Number(tempAguaDesejada) || 30,
                              potenciaKW: thermalReport.bombaPotenciaKW ?? 0,
                              kwhMes: thermalReport.bombaConsumoKwhMesMedio,
                              custoMesCents: thermalReport.bombaConsumoKwhMesMedio * tarifaKwhBRLCents,
                            }
                          : null;

                        // v1.12.80: consumo eletrico com 2 ajustes em cima de v1.12.79.
                        //
                        // 1) ESCALA TERMICA — perda escala com ΔT(alvo − ambiente). Backend
                        //    calcula perdaCorrigidaPorDia em °C/dia FIXO (so depende de mes,
                        //    capa, vento), mas perda real e proporcional ao ΔT. Sem isso,
                        //    mudar temp_alvo de 35→30°C nao afetava o consumo da bomba.
                        //
                        // 2) FLOOR VARIAVEL POR TEMP_ALVO — controlador diferencial padrao nao
                        //    mede temp_alvo. Roda enquanto T_coletor > T_piscina + ΔT_min.
                        //    Quando alvo eh alto (35°C+), sistema raramente atinge alvo →
                        //    bomba opera quase todo HSE. Quando alvo eh baixo (25°C), piscina
                        //    bate o alvo cedo e operador eventualmente desliga manual.
                        //    Floor reflete esse minimo de operacao por temperatura alvo:
                        //      25°C → 0.20 / 30°C → 0.50 / 35°C → 0.70 / 38°C → 0.85
                        //      formula: clamp(0.20, 0.85, 0.20 + 0.10 × (tempAlvo − 25))
                        const computeConsumo = () => {
                          const cv = selBomba.potenciaCv;
                          if (cv == null || cv <= 0) return null;
                          if (!report?.monthly?.length) return null;
                          const potenciaKW = cv * 0.7355;
                          const tempAlvo = Number(tempAguaDesejada) || 30;
                          const DELTA_T_BASE = 13; // ΔT tipico (35°C alvo − 22°C ambiente)
                          // v1.12.82: floor mais suave (era 0.20 + 0.10× → cap 0.85 a 35°C, dominava demais).
                          // Agora: 25°C→0.10 / 30°C→0.30 / 35°C→0.50 / 38°C+→0.50 (cap). Mudar coletores
                          // extras volta a influenciar o consumo (antes ambos batiam no floor alto).
                          const floorByTarget = Math.max(0.10, Math.min(0.50, 0.10 + 0.04 * (tempAlvo - 25)));

                          let kwhAno = 0;
                          let horasAno = 0;
                          let hseTotal = 0;
                          let fatorTotal = 0;
                          let mesesValidos = 0;
                          for (const m of report.monthly) {
                            const hse = Number(m.radSol) || 0;
                            const perdaBase = Number(m.perdaCorrigidaPorDia) || 0;
                            const ganho = Number(m.ganhoDia) || 0;
                            const tempAmb = Number(m.tempAmbiente) || 22;
                            if (hse <= 0) continue;

                            // Escala termica: perda real ∝ ΔT(alvo − ambiente)
                            const deltaT = Math.max(1, tempAlvo - tempAmb);
                            const escalaTermica = deltaT / DELTA_T_BASE;
                            const perdaEscalada = perdaBase * escalaTermica;

                            const fatorBase = ganho > 0 ? Math.min(1, perdaEscalada / ganho) : 1;
                            // Floor: bomba sempre opera o minimo, conforme temp alvo
                            const fator = Math.max(floorByTarget, fatorBase);

                            const horasDia = hse * fator;
                            const horasMes = horasDia * 30;
                            kwhAno += potenciaKW * horasMes;
                            horasAno += horasMes;
                            hseTotal += hse;
                            fatorTotal += fator;
                            mesesValidos++;
                          }
                          if (mesesValidos === 0) return null;
                          const kwhMesMedio = kwhAno / 12;
                          const horasDiaMedio = horasAno / (12 * 30);
                          const hseMedio = hseTotal / mesesValidos;
                          const fatorMedio = fatorTotal / mesesValidos;
                          const custoMesCents = kwhMesMedio * tarifaKwhBRLCents;
                          return { hseMedio, horasDiaMedio, fatorMedio, floorByTarget, tempAlvo, potenciaKW, kwhMes: kwhMesMedio, custoMesCents };
                        };
                        // v1.12.84: prefere thermal-demand do backend (Tabela78 completa)
                        const consumo = consumoFromBackend ?? computeConsumo();

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
                                    // v1.12.67: tons -500/-600 deixam laranja e amarelo VISUALMENTE
                                    // distintos de vermelho. Antes orange-700 (#c2410c) parecia
                                    // vermelho-marrom, confundindo operador (Justo aparentava ruim).
                                    selBomba.indicator.color === 'emerald' ? 'text-emerald-600' :
                                    selBomba.indicator.color === 'green' ? 'text-green-600' :
                                    selBomba.indicator.color === 'lime' ? 'text-lime-600' :
                                    selBomba.indicator.color === 'yellow' ? 'text-yellow-600' :
                                    selBomba.indicator.color === 'orange' ? 'text-orange-500' :
                                    selBomba.indicator.color === 'amber' ? 'text-amber-600' :
                                    selBomba.indicator.color === 'red' ? 'text-red-600' :
                                    'text-slate-700'
                                  }`}>
                                    {(() => {
                                      const v = selBomba.indicator.value;
                                      // v1.12.66: usa 1 decimal pra valores < 10 (evita "0%" quando eh 0,3%)
                                      const decimals = Math.abs(v) < 10 ? 1 : 0;
                                      const formatted = v.toFixed(decimals).replace('.', ',');
                                      const group = selBomba.indicator.groupLabel || 'Indicador';
                                      return `${group}: ${formatted}${selBomba.indicator.unit} (${selBomba.indicator.label})`;
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* v1.12.78: consumo eletrico mensal estimado */}
                              {consumo && (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                  <div className="text-[10px] text-slate-700 leading-tight">
                                    <span className="text-slate-500">⚡ Consumo médio:</span>{" "}
                                    <span className="font-bold tabular-nums text-slate-900">{consumo.kwhMes.toFixed(0)}</span>
                                    <span className="text-[9px] font-semibold text-slate-500"> kWh/mês</span>
                                    <span className="text-[9px] text-slate-500 ml-1.5" title={`Fator utilizacao bomba: ${(consumo.fatorMedio * 100).toFixed(0)}% do tempo de sol (HSE medio ${consumo.hseMedio.toFixed(1)}h/dia · floor por temp alvo ${consumo.tempAlvo}°C = ${(consumo.floorByTarget * 100).toFixed(0)}% · escala termica por ΔT(alvo-ambiente))`}>({consumo.horasDiaMedio.toFixed(1)}h bomba/dia · {(consumo.potenciaKW).toFixed(2)} kW)</span>
                                  </div>
                                  <div className="relative flex items-center gap-1">
                                    <div className="text-[11px] font-bold tabular-nums text-amber-700">
                                      R$ {(consumo.custoMesCents / 100).toFixed(2)}<span className="text-[9px] font-semibold text-amber-600">/mês</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTarifaInputValue((tarifaKwhBRLCents / 100).toFixed(2).replace(".", ","));
                                        setShowTarifaPopover((v) => !v);
                                      }}
                                      title={`Tarifa atual: R$ ${(tarifaKwhBRLCents / 100).toFixed(2)}/kWh. Clique para alterar.`}
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 print:hidden"
                                    >
                                      💡
                                    </button>
                                    {showTarifaPopover && (
                                      <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-300 rounded-lg shadow-lg p-3 w-[240px] print:hidden">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">Tarifa de energia (R$/kWh)</div>
                                        <input
                                          type="text"
                                          value={tarifaInputValue}
                                          onChange={(e) => setTarifaInputValue(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === "Enter") saveTarifa(); if (e.key === "Escape") setShowTarifaPopover(false); }}
                                          autoFocus
                                          placeholder="0,95"
                                          className="w-full rounded border border-slate-300 px-2 py-1 text-[12px] font-semibold focus:border-amber-500 focus:outline-none"
                                        />
                                        <div className="text-[9px] text-slate-500 mt-1 leading-tight">Tarifa aplicada a todos os orcamentos do tenant.</div>
                                        <div className="mt-2 flex gap-1.5 justify-end">
                                          <button
                                            type="button"
                                            onClick={() => setShowTarifaPopover(false)}
                                            disabled={tarifaSaving}
                                            className="text-[10px] px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                                          >Cancelar</button>
                                          <button
                                            type="button"
                                            onClick={saveTarifa}
                                            disabled={tarifaSaving}
                                            className="text-[10px] px-2 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:bg-slate-300"
                                          >{tarifaSaving ? "Salvando..." : "Salvar"}</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* v1.12.89: PAINEL DEBUG (print:hidden) — mostra os valores que vem do
                                  backend thermal-demand pra diagnosticar saturacao do fator. Remover
                                  apos validar que o calculo varia conforme esperado. */}
                              {thermalReport && (
                                <div className="mt-1 pt-1 border-t border-dashed border-violet-200 text-[6px] text-violet-700 print:hidden leading-[1.15]">
                                  <div className="font-bold text-violet-800 mb-0.5 text-[7px]">🐛 DEBUG thermal-demand</div>
                                  <div className="grid grid-cols-4 gap-x-1.5 gap-y-0">
                                    <div>qPerdas méd: <span className="font-semibold tabular-nums">{thermalReport.qPerdasMediaKwhDia?.toFixed(1)}</span></div>
                                    <div>qPerdas pico: <span className="font-semibold tabular-nums">{thermalReport.qPerdasPicoKwhDia?.toFixed(1)}</span></div>
                                    <div>qSolar méd: <span className="font-semibold tabular-nums">{thermalReport.qSolarMediaKwhDia?.toFixed(1) ?? '—'}</span></div>
                                    <div>Cob solar: <span className="font-semibold tabular-nums">{thermalReport.coberturaSolarMediaPct?.toFixed(0) ?? '—'}%</span></div>
                                    <div>Fator: <span className={`font-semibold tabular-nums ${(thermalReport.monthly[0]?.fatorUtilizacaoBomba ?? 0) >= 0.99 ? 'text-red-600' : ''}`}>{((thermalReport.monthly[0]?.fatorUtilizacaoBomba ?? 0) * 100).toFixed(0)}%{(thermalReport.monthly[0]?.fatorUtilizacaoBomba ?? 0) >= 0.99 && '⚠'}</span></div>
                                    <div>HSE: <span className="font-semibold tabular-nums">{((thermalReport.monthly.reduce((s,m)=>s+(m.hseHorasDia||0),0))/(thermalReport.monthly.length||1)).toFixed(1)}h</span></div>
                                    <div>Capa: <span className="font-semibold">{thermalReport.inputs?.capaTermica ? 'SIM' : 'NÃO'}</span></div>
                                    <div>Vento: <span className="font-semibold">{thermalReport.inputs?.vento}</span></div>
                                    <div>Qtd col: <span className="font-semibold tabular-nums">{thermalReport.inputs?.qtdColetores ?? '—'}</span></div>
                                    <div>Area col: <span className="font-semibold tabular-nums">{thermalReport.inputs?.areaTotalColetorM2?.toFixed(1) ?? '—'}m²</span></div>
                                    <div>fInst: <span className="font-semibold tabular-nums">{thermalReport.inputs?.fatorInstalacao?.toFixed(2) ?? '—'}</span></div>
                                    <div>T_alvo: <span className="font-semibold tabular-nums">{thermalReport.inputs?.tempAlvo}°C</span></div>
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-dashed border-violet-200 font-bold text-[6.5px]">Fórmula perdas v1.12.90:</div>
                                  <div className="grid grid-cols-4 gap-x-1.5 gap-y-0">
                                    <div>Base: <span className="font-semibold tabular-nums">{thermalReport.inputs?.perdaBaseWm2 ?? '—'}</span> W/m²</div>
                                    <div>×Vento: <span className="font-semibold tabular-nums">{thermalReport.inputs?.ventoMult?.toFixed(2) ?? '—'}</span></div>
                                    <div>×Constr: <span className="font-semibold tabular-nums">{thermalReport.inputs?.construcaoMult?.toFixed(2) ?? '—'}</span></div>
                                    <div>×ΔT: <span className="font-semibold tabular-nums">{thermalReport.inputs?.deltaTBaseAnualMult?.toFixed(2) ?? '—'}</span></div>
                                    <div>Extras: <span className="font-semibold tabular-nums">{thermalReport.inputs?.extrasKwTotal?.toFixed(1) ?? '0'}kW</span></div>
                                    <div className="col-span-3">Wm² efetivo: <span className="font-semibold tabular-nums">{((thermalReport.inputs?.perdaBaseWm2 ?? 0) * (thermalReport.inputs?.ventoMult ?? 1) * (thermalReport.inputs?.construcaoMult ?? 1) * (thermalReport.inputs?.deltaTBaseAnualMult ?? 1)).toFixed(0)} W/m²</span></div>
                                  </div>
                                  <div className="mt-0.5 pt-0.5 border-t border-dashed border-violet-200 font-bold text-[6.5px]">Bomba v1.12.93:</div>
                                  <div className="grid grid-cols-4 gap-x-1.5 gap-y-0">
                                    <div>HSE: <span className="font-semibold tabular-nums">{((thermalReport.monthly.reduce((s,m)=>s+(m.hseHorasDia||0),0))/(thermalReport.monthly.length||1)).toFixed(2)}h</span></div>
                                    <div>Floor: <span className="font-semibold tabular-nums">{((thermalReport.inputs?.floorFatorBomba ?? 0) * 100).toFixed(0)}%</span></div>
                                    <div>×Real: <span className="font-semibold tabular-nums">{thermalReport.inputs?.fatorHorasOperacaoReal?.toFixed(2) ?? '—'}</span></div>
                                    <div>=h/dia: <span className="font-semibold tabular-nums">{thermalReport.bombaHorasDiaMedio?.toFixed(2) ?? '—'}h</span></div>
                                    <div>Pot elétr: <span className="font-semibold tabular-nums">{thermalReport.bombaPotenciaKW?.toFixed(2) ?? '—'}kW</span></div>
                                    <div>Rend: <span className="font-semibold tabular-nums">{thermalReport.inputs?.rendimentoBomba?.toFixed(2) ?? '0.65'}</span></div>
                                    {thermalReport.inputs?.fatorVazao != null && (
                                      <>
                                        <div>Vaz bomba: <span className="font-semibold tabular-nums">{thermalReport.inputs?.vazaoBombaM3h?.toFixed(2) ?? '—'}</span></div>
                                        <div>Vaz solar: <span className="font-semibold tabular-nums">{thermalReport.inputs?.vazaoSolarM3h?.toFixed(2) ?? '—'}</span></div>
                                        <div className="col-span-4">×Fator vazão: <span className={`font-semibold tabular-nums ${thermalReport.inputs.fatorVazao < 0.85 ? 'text-emerald-600' : thermalReport.inputs.fatorVazao > 1.15 ? 'text-red-600' : ''}`}>{thermalReport.inputs.fatorVazao.toFixed(2)}</span> <span className="text-violet-400">(vazaoSolar/vazaoBomba)</span></div>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-violet-500 italic mt-0.5 leading-tight">HSP_inclinado ({thermalReport.inputs?.hspInclinadoMedio?.toFixed(2) ?? '—'}h) só em qSolar (oferta), não nas horas da bomba.</div>
                                  {thermalReport.monthly[0]?.fatorUtilizacaoBomba != null && thermalReport.monthly[0].fatorUtilizacaoBomba >= 0.99 && (
                                    <div className="mt-0.5 text-red-700 font-semibold text-[6.5px]">
                                      ⚠ Saturado: qPerdas ({thermalReport.qPerdasMediaKwhDia.toFixed(0)}) ≥ qSolar ({thermalReport.qSolarMediaKwhDia?.toFixed(0)}).
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="text-[9px] text-slate-500 mt-1 leading-tight">
                        {bombaCandidates.length > 0 ? (
                          <>{bombaCandidates.length} candidata(s) atendem · 1 selecionada · ordem pela regra ✨ · vazão {report.vazaoTotalM3h?.toFixed(2)} m³/h{pipeResult ? ` + altura ${pipeResult.alturaManometricaTotal?.toFixed(2)} mca` : ''}</>
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
                  v1.12.67: mantem cor original no PDF (era forcado branco antes)
                  v1.12.74: print:mb-1 pra respiro entre banner e gráfico/tabela */}
              <div className="bg-blue-900 text-white px-5 py-1.5 flex items-center gap-3 print:mb-1">
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

              {/* ============ GRAFICO + TABELA ============
                  v1.12.73: print:items-start + print:py-1 pra evitar items-stretch esticando
                  os cards verticalmente quando ha espaco sobrando — geram espaco branco no fim. */}
              <section className="grid grid-cols-12 gap-3 px-5 py-3 print:py-1 border-b border-slate-200 avoid-break items-stretch print:items-start">
                <div className="col-span-7 flex flex-col">
                  {selectedMonth && (
                    <SolarChart row={selectedMonth} tempDesejada={tempAguaDesejada} monthName={selectedMonth.monthName} />
                  )}
                </div>
                <div className="col-span-5 flex flex-col">
                  <div className="border border-slate-200 rounded overflow-hidden h-full flex flex-col print:h-auto">
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

      {/* v1.12.77: removida toolbar de Pre-visualizacao PDF (era redundante — Chrome
          ja abre Print Preview automatico quando clica Imprimir). */}

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

      {/* v1.12.63: modal de regras solares (acessado pelo botao ⚙ Regras no Diagrama de Instalacao). */}
      <SolarRulesModal
        open={showSolarRulesModal}
        onClose={() => setShowSolarRulesModal(false)}
        onChanged={async () => {
          await reloadActiveRule();
          // Force recompute do report pra refletir novas regras
          if (selectedCollectorId !== undefined) {
            onRecompute(undefined, selectedCollectorId);
          }
        }}
      />

      {/* CSS Print: A4 portrait, 1 pagina garantida.
          - color-adjust: exact preserva fundos escuros do header/banner
          - tamanhos compactos pra todo conteudo caber em ~270mm de altura util
          - blocos com avoid-break nao podem quebrar entre paginas */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }

          /* v1.12.72: PRINT SEMPRE via clone no body (#solar-pdf-clone).
             O original (#solar-pdf-area) esta enterrado dentro do modal
             "fixed inset-0 overflow-hidden", que confunde o motor de print do
             Chrome e gera 2 paginas. Solucao: printViaClone() cria um clone
             em document.body com classe .printing-clone, adiciona
             html.printing-mode e printa SO o clone.

             v1.12.75: ESCONDER COM display:none, nao visibility:hidden.
             visibility:hidden mantem o elemento no layout flow — o #solar-pdf-area
             original (1163px altura natural) ocupava espaco no body e causava
             2a pagina em branco no print (overflow ~40px do A4 portrait).
             display:none remove do flow, o clone (1029px) cabe em 1 pagina. */
          html.printing-mode body > *:not(.solar-pdf-clone-container) {
            display: none !important;
          }
          html.printing-mode .solar-pdf-clone-container.printing-clone,
          html.printing-mode .solar-pdf-clone-container.printing-clone * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Container do clone — fluxo normal direto no topo da pagina */
          html.printing-mode .solar-pdf-clone-container.printing-clone {
            position: static !important;
            width: 100% !important;
            padding: 0 !important; margin: 0 !important;
            background: #fff !important;
            display: block !important;
          }
          html.printing-mode #solar-pdf-clone {
            width: 100% !important;
            padding: 3mm !important; margin: 0 !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            min-height: 0 !important;
            height: auto !important;
            box-shadow: none !important;
            border: 0 !important;
            display: block !important;
          }

          /* Avoid page breaks dentro dos blocos principais */
          .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }

          /* Espacador flex-1 some no print — tanto o filho direto quanto qualquer
             nested (v1.12.74: havia <div className="flex-1"/> dentro do banner
             SIMULACAO empurrando conteudo pra 2a pagina) */
          html.printing-mode #solar-pdf-clone > div.flex-1,
          html.printing-mode #solar-pdf-clone .flex-1:not(section):not([class*="col-span"]):empty {
            display: none !important;
            flex: none !important;
            height: 0 !important;
            min-height: 0 !important;
          }
          /* v1.12.74: garante que o clone nao tem min-height residual da classe min-h-[1120px] */
          html.printing-mode #solar-pdf-clone[class*="min-h-"] {
            min-height: 0 !important;
          }

          /* Header mantem cor (gradiente azul-preto + branco) */
          html.printing-mode #solar-pdf-clone header {
            display: flex !important;
            visibility: visible !important;
            padding: 4px 16px !important;
            background: linear-gradient(to right, #0f172a, #1e3a8a) !important;
            color: #ffffff !important;
          }
          html.printing-mode #solar-pdf-clone header h2,
          html.printing-mode #solar-pdf-clone header div { color: #ffffff !important; }
          html.printing-mode #solar-pdf-clone header .text-amber-300 { color: #fcd34d !important; }
          html.printing-mode #solar-pdf-clone header .text-slate-300 { color: #cbd5e1 !important; }

          /* Banners coloridos */
          html.printing-mode #solar-pdf-clone .bg-blue-900 {
            background-color: #1e3a8a !important;
            color: #ffffff !important;
          }
          html.printing-mode #solar-pdf-clone .bg-blue-900 * { color: #ffffff !important; }

          /* Compactacao agressiva pra caber em 1 pagina A4 (~1093px util) */
          html.printing-mode #solar-pdf-clone section { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #solar-pdf-clone footer { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #solar-pdf-clone .px-5 { padding-left: 10px !important; padding-right: 10px !important; }

          /* Esconde controles interativos */
          html.printing-mode #solar-pdf-clone .print-hide-interactive { display: none !important; }
          html.printing-mode #solar-pdf-clone .print-show-value { display: inline-block !important; }
          html.printing-mode #solar-pdf-clone select { display: none !important; }
          html.printing-mode #solar-pdf-clone input[type=range] { display: none !important; }

          /* Tailwind print:* classes (aplicadas no clone) */
          html.printing-mode #solar-pdf-clone .print\\:inline-block { display: inline-block !important; }
          html.printing-mode #solar-pdf-clone .print\\:hidden { display: none !important; }
          html.printing-mode #solar-pdf-clone .print\\:bg-white { background: #fff !important; background-image: none !important; }
          html.printing-mode #solar-pdf-clone .print\\:text-blue-900 { color: #1e3a8a !important; }
          html.printing-mode #solar-pdf-clone .print\\:text-amber-700 { color: #b45309 !important; }
          html.printing-mode #solar-pdf-clone .print\\:text-slate-600 { color: #475569 !important; }
          html.printing-mode #solar-pdf-clone .print\\:border-b-4 { border-bottom-width: 4px !important; }
          html.printing-mode #solar-pdf-clone .print\\:border-y { border-top-width: 1px !important; border-bottom-width: 1px !important; border-top-style: solid !important; border-bottom-style: solid !important; }
          html.printing-mode #solar-pdf-clone .print\\:border-blue-900 { border-color: #1e3a8a !important; }

          /* SVG do grafico — limita a 60mm (era 80mm, gerava overflow pra pag 2) */
          html.printing-mode #solar-pdf-clone svg { max-height: 60mm !important; width: 100% !important; height: auto !important; }
          html.printing-mode #solar-pdf-clone img { max-height: none !important; }

          /* v1.12.73: classes print:* especificas do Tailwind usadas pra controlar
             altura/aspect-ratio da imagem do coletor + gráfico no print */
          html.printing-mode #solar-pdf-clone .print\\:aspect-auto { aspect-ratio: auto !important; }
          html.printing-mode #solar-pdf-clone .print\\:h-full { height: 100% !important; }
          html.printing-mode #solar-pdf-clone .print\\:h-auto { height: auto !important; }
          html.printing-mode #solar-pdf-clone .print\\:max-h-\\[52mm\\] { max-height: 52mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:max-h-\\[58mm\\] { max-height: 58mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:max-h-\\[62mm\\] { max-height: 62mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:items-start { align-items: flex-start !important; }
          html.printing-mode #solar-pdf-clone .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          html.printing-mode #solar-pdf-clone .print\\:p-1 { padding: 0.25rem !important; }
          html.printing-mode #solar-pdf-clone .print\\:mb-1 { margin-bottom: 0.25rem !important; }

          /* Classe .print\\:hidden geral aplicada via Tailwind no JSX */
          .print\\:hidden { display: none !important; }

          /* === FALLBACK: se printing-mode nao foi adicionado (chamada direta a window.print)
             usa o original. Mantido pra compat — botoes novos sempre usam printViaClone(). === */
          html:not(.printing-mode) body * { visibility: hidden; }
          html:not(.printing-mode) #solar-pdf-area,
          html:not(.printing-mode) #solar-pdf-area * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html:not(.printing-mode) #solar-pdf-area {
            width: 100%; padding: 3mm !important; margin: 0;
            font-size: 10px; line-height: 1.2;
            min-height: 0 !important; height: auto !important;
            box-shadow: none !important; border: 0 !important;
          }
        }

        /* v1.12.77: removido bloco "simulating-print" inteiro — era do botao 👁️ PDF
           que foi extinto. Pra debug futuro do print, usar /dev/print-test. */

        /* === Tela: escala o datasheet proporcionalmente em viewports grandes ===
           PDF/print mantem A4 inalterado (zoom: 1 forcado em @media print). */
        @media (min-width: 1024px) { .solar-screen-wrapper { zoom: 1.15; } }
        @media (min-width: 1280px) { .solar-screen-wrapper { zoom: 1.30; } }
        @media (min-width: 1536px) { .solar-screen-wrapper { zoom: 1.50; } }
        @media (min-width: 1792px) { .solar-screen-wrapper { zoom: 1.70; } }
        @media print { .solar-screen-wrapper { zoom: 1 !important; } }
      ` }} />
    </>
  );
}

// ============ Graficos do datasheet V1 (curva sazonal + donut) — data-driven ============
// Arredonda pra um numero "redondo" (1/2/2,5/5/10 × 10^n) pra cima/baixo — eixo Y limpo.
function dsNiceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * base;
}
// Catmull-Rom -> cubic bezier: curva suave passando por todos os pontos.
function dsSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}` : "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
function dsAbbrevMonth(name: string): string {
  return (name || "").slice(0, 3).replace(/^\w/, (c) => c.toUpperCase());
}
function dsMoney(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Curva sazonal de consumo (area + linha suave + pico destacado), escalada pelos dados reais.
function SeasonalCurve({ monthly, criticalIndex }: {
  monthly: { monthName: string; kwhConsumido: number; custoBRLCents: number }[];
  criticalIndex: number;
}) {
  const X0 = 44, X1 = 512, YT = 20, YB = 148;
  const vals = monthly.map((m) => Number(m.kwhConsumido) || 0);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(1, ...vals);
  const span = Math.max(1, maxVal - minVal);
  // teto/piso JUSTOS (arredondados ao "step") pra curva preencher a altura — pico perto do topo, vale perto da base
  const step = dsNiceCeil(span / 4) || 1;
  const scaleMin = Math.max(0, Math.floor((minVal - span * 0.2) / step) * step);
  const scaleMax = Math.ceil((maxVal + span * 0.12) / step) * step;
  const range = Math.max(1, scaleMax - scaleMin);
  const xFor = (i: number) => X0 + (i / 11) * (X1 - X0);
  const yFor = (v: number) => YB - ((v - scaleMin) / range) * (YB - YT);
  const pts = monthly.map((m, i) => ({ x: xFor(i), y: yFor(Number(m.kwhConsumido) || 0) }));
  const line = dsSmoothPath(pts);
  const area = `${line} L${X1.toFixed(1)},${YB} L${X0.toFixed(1)},${YB} Z`;
  const grid: { y: number; val: number }[] = [];
  for (let g = scaleMin + step; g <= scaleMax + 0.5; g += step) grid.push({ y: YB - ((g - scaleMin) / range) * (YB - YT), val: Math.round(g) });
  const ci = criticalIndex >= 0 && criticalIndex < pts.length ? criticalIndex : vals.indexOf(maxVal);
  const peak = pts[ci] ?? pts[0];
  const cm = monthly[ci];
  const calloutText = cm ? `${dsAbbrevMonth(cm.monthName)} ${Math.round(cm.kwhConsumido).toLocaleString("pt-BR")} kWh · R$ ${dsMoney(cm.custoBRLCents)}` : "";
  const calloutW = Math.min(220, Math.max(96, calloutText.length * 4.9 + 14));
  const calloutCx = Math.max(X0 + calloutW / 2, Math.min(X1 - calloutW / 2, peak.x));
  return (
    <svg viewBox="0 0 520 168" width="100%" className="ds-curve" style={{ display: "block", marginTop: 4 }} preserveAspectRatio="none">
      {grid.map((g, i) => (<line key={i} x1={X0} y1={g.y} x2={X1} y2={g.y} stroke={i === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />))}
      {grid.map((g, i) => (<text key={`t${i}`} x={X0 - 4} y={g.y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{g.val.toLocaleString("pt-BR")}</text>))}
      <path d={area} fill="#ecfeff" />
      <path d={line} fill="none" stroke="#0e7490" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <line x1={peak.x} y1={peak.y} x2={peak.x} y2={YB} stroke="#0e7490" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
      {pts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={i === ci ? 3.4 : 1.8} fill="#0e7490" stroke={i === ci ? "#fff" : undefined} strokeWidth={i === ci ? 1.5 : undefined} />))}
      <rect x={calloutCx - calloutW / 2} y={6} width={calloutW} height={17} rx={4} fill="#0e7490" />
      <text x={calloutCx} y={17.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">{calloutText}</text>
      <g fontSize={8} fill="#64748b" textAnchor="middle">
        {monthly.map((m, i) => (<text key={i} x={xFor(i)} y={161} fill={i === ci ? "#0e7490" : "#64748b"} fontWeight={i === ci ? 700 : undefined}>{dsAbbrevMonth(m.monthName)}</text>))}
      </g>
    </svg>
  );
}

// Donut da composicao do consumo anual: bomba de calor vs recirculacao.
function ConsumoDonut({ bombaKwh, recircKwh }: { bombaKwh: number; recircKwh: number }) {
  const total = Math.max(1, bombaKwh + recircKwh);
  const C = 2 * Math.PI * 32; // ~201.06
  const bombaLen = (bombaKwh / total) * C;
  const recircLen = (recircKwh / total) * C;
  return (
    <svg viewBox="0 0 84 84" width={84} height={84} className="ds-donut">
      <circle cx={42} cy={42} r={32} fill="none" stroke="#f1f5f9" strokeWidth={14} />
      <circle cx={42} cy={42} r={32} fill="none" stroke="#0e7490" strokeWidth={14} strokeDasharray={`${bombaLen.toFixed(1)} ${(C - bombaLen).toFixed(1)}`} transform="rotate(-90 42 42)" />
      <circle cx={42} cy={42} r={32} fill="none" stroke="#f59e0b" strokeWidth={14} strokeDasharray={`${recircLen.toFixed(1)} ${(C - recircLen).toFixed(1)}`} strokeDashoffset={`${(-bombaLen).toFixed(1)}`} transform="rotate(-90 42 42)" />
      <text x={42} y={40} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">{Math.round(total).toLocaleString("pt-BR")}</text>
      <text x={42} y={51} textAnchor="middle" fontSize={7.5} fill="#64748b">kWh/ano</text>
    </svg>
  );
}

// ---- Campos V1 do datasheet (.pico / amber) com swap tela<->print (ds-edit/ds-print) ----
const dsDec = (n: number, d = 2) => Number(n || 0).toFixed(d).replace(".", ",");
function PicoVal({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="pico"><div className="lbl">{label}</div><div className="v num">{value}</div></div>;
}
function PicoSel({ label, value, options, onChange, disabled, placeholder }: {
  label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const cur = options.find((o) => o.v === value)?.l ?? (value || placeholder || "—");
  return (
    <div className="pico">
      <div className="lbl">{label}</div>
      <select className="ds-edit" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: "transparent", border: 0, outline: "none", color: disabled ? "#94a3b8" : "#047857", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 700, lineHeight: 1.2, fontFamily: "inherit" }}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <span className="ds-print v">{cur}</span>
    </div>
  );
}
function AmberStat({ label, value, unit }: { label: string; value: React.ReactNode; unit: string }) {
  return (
    <div style={{ border: "1.5px solid #fcd34d", borderRadius: 4, padding: "3px 6px", background: "#fffbeb" }}>
      <div className="lbl" style={{ color: "#b45309" }}>{label}</div>
      <div className="num" style={{ fontSize: 14, fontWeight: 800, color: "#78350f", lineHeight: 1.15 }}>{value} <span style={{ fontSize: 9 }}>{unit}</span></div>
    </div>
  );
}
function AmberInput({ label, value, unit, min, max, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <div style={{ border: "1.5px solid #fcd34d", borderRadius: 4, padding: "3px 6px", background: "#fffbeb" }}>
      <div className="lbl" style={{ color: "#b45309" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <input className="ds-edit num" type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value) || 0)} style={{ width: 36, border: 0, background: "transparent", outline: "none", fontSize: 14, fontWeight: 800, color: "#047857", lineHeight: 1.15, padding: 0, fontFamily: "inherit" }} />
        <span className="ds-print num" style={{ fontSize: 14, fontWeight: 800, color: "#78350f", lineHeight: 1.15 }}>{value}</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#78350f" }}>{unit}</span>
      </div>
    </div>
  );
}
function CompactExtraCard({ icon, name, extra, horasValue, onChangeHoras, hoursUnit }: {
  icon: string; name: string; extra: ExtraDetected; horasValue: number; onChangeHoras: (n: number) => void; hoursUnit: string;
}) {
  const impactKw = extra.impactKw ?? 0;
  const falta = extra.status === "IDENTIFICADA_FALTANDO_INFO";
  return (
    <div className="ex" title={extra.message}>
      <span className="exn">{name}</span>
      <span className="exr">
        <span style={{ fontSize: 12 }}>{icon}</span>
        {falta
          ? <span style={{ fontSize: 7, color: "#b45309", fontWeight: 700 }}>falta info</span>
          : <span style={{ fontSize: 8.5, color: "#0e7490", fontWeight: 700 }} className="num">+{dsDec(impactKw)}</span>}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 1, lineHeight: 1 }}>
        <span className="ds-edit" style={{ display: "inline-flex" }}><input type="number" value={horasValue} min={0} max={hoursUnit.includes("dia") ? 24 : 168} step={1} onChange={(e) => onChangeHoras(Number(e.target.value) || 0)} style={{ width: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 8, fontWeight: 700, textAlign: "center", padding: "0 1px", color: "#0f172a", fontFamily: "inherit" }} className="num" /></span>
        <span className="ds-print num" style={{ fontSize: 8, fontWeight: 700, color: "#0f172a" }}>{horasValue}</span>
        <span style={{ fontSize: 6.5, color: "#64748b" }}>{hoursUnit}</span>
      </span>
    </div>
  );
}

// ============ Aba Bomba de Calor (clone visual da aba Solar; so os calculos mudam) ============
function BombaCalorTab({
  budget, report, loading, recomputing,
  candidates, changeEquipment, changingEquipment,
  uf, cidade, setUf, setCidade, availableUfs, availableCities,
  capaTermica, setCapaTermica, vento, setVento,
  tempAguaDesejada, setTempAguaDesejada,
  tempAguaInicial, setTempAguaInicial,
  tipoPiscina, setTipoPiscina, tipoConstrucao, setTipoConstrucao,
  onRecompute,
  headerImage, headerImageUploading, onUploadHeaderImage, onRemoveHeaderImage,
  catalog, heatingRule, onSaveHeatingRule,
  cascataHorasSemana, onChangeCascataHoras, hidromassagemHorasSemana, onChangeHidroHoras,
  bordaInfinitaHorasAtivaDia, onChangeBordaHoras, onPendingSave,
}: {
  budget: BudgetForHeating;
  report: HeatingReport | null;
  loading: boolean;
  recomputing: boolean;
  candidates: HeatingCandidate[];
  changeEquipment: (productId: string | null, qty?: number) => void | Promise<void>;
  changingEquipment: boolean;
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
  tempAguaInicial: number | "";
  setTempAguaInicial: (n: number | "") => void;
  tipoPiscina: string;
  setTipoPiscina: (v: string) => void;
  tipoConstrucao: string;
  setTipoConstrucao: (v: string) => void;
  onRecompute: () => void | Promise<void>;
  headerImage: string | null;
  headerImageUploading: boolean;
  onUploadHeaderImage: (file: File) => void | Promise<void>;
  onRemoveHeaderImage: () => void | Promise<void>;
  catalog: CatalogConfig[];
  heatingRule: AutoSelectRule | null;
  onSaveHeatingRule: (rule: AutoSelectRule | null) => void | Promise<void>;
  cascataHorasSemana: number;
  onChangeCascataHoras: (n: number) => void;
  hidromassagemHorasSemana: number;
  onChangeHidroHoras: (n: number) => void;
  bordaInfinitaHorasAtivaDia: number;
  onChangeBordaHoras: (n: number) => void;
  onPendingSave?: () => void;
}) {
  const dims = (budget.poolDimensions ?? {}) as any;
  const dispArea = Number(dims.area) || 0;
  // FASE 2 — volume mostrado = piscina + agua dos reservatorios da Borda Infinita.
  const volumeBasinM3 = Number(dims.volume) || 0;
  const bordaVolumeExtraM3 = Number(report?.bordaVolumeExtraM3) || 0;
  const dispVolume = Number((volumeBasinM3 + bordaVolumeExtraM3).toFixed(2));
  const dispLen = Number(dims.length) || 0;
  const dispWid = Number(dims.width) || 0;
  const dispProfMin = Number(dims.depthMin ?? dims.profundidadeMinima) || 0;
  const dispProfMax = Number(dims.depthMax ?? dims.profundidadeMaxima ?? dims.depth) || 0;
  const cfgManual = true;
  const tempIniDisplay = typeof tempAguaInicial === "number" ? tempAguaInicial : 22;

  const [manualZoom, setManualZoom] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("bomba:manualZoom");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0.5 && n <= 2.5 ? n : null;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (manualZoom == null) window.localStorage.removeItem("bomba:manualZoom");
    else window.localStorage.setItem("bomba:manualZoom", String(manualZoom));
  }, [manualZoom]);

  const [showEquipPicker, setShowEquipPicker] = useState(false);
  const [showHeatingRulePicker, setShowHeatingRulePicker] = useState(false);

  // Regra INDEPENDENTE da bomba de CIRCULACAO do calor (Trocador). Usa a MESMA formula do
  // Solar, mas config propria (/pool-budgets/heating/bomba-rule). Se vazia, backend cai pra
  // do Solar (fallback). ruleVersion forca o card a re-buscar candidatos ao salvar.
  const [showTrocadorRulePicker, setShowTrocadorRulePicker] = useState(false);
  const [recircConsumo, setRecircConsumo] = useState<{ kwhAno: number; custoAnoCents: number } | null>(null);
  const [trocadorBombaRule, setTrocadorBombaRule] = useState<AutoSelectRule | null>(null);
  const [trocadorRuleVersion, setTrocadorRuleVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api.get<{ rule: AutoSelectRule | null }>("/pool-budgets/heating/bomba-rule")
      .then((r) => { if (!cancelled) setTrocadorBombaRule(r?.rule ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const saveTrocadorBombaRule = async (rule: AutoSelectRule | null) => {
    try {
      await api.post("/pool-budgets/heating/bomba-rule", { rule });
      setTrocadorBombaRule(rule);
      setTrocadorRuleVersion((v) => v + 1);
    } catch (err: any) {
      alert(`Erro ao salvar regra da bomba de circulação: ${err?.message ?? err}`);
    }
  };

  // Clona #bomba-pdf-area pra dentro do body (mesmo mecanismo do Solar — resolve
  // IDs duplicados e o problema das 2 paginas do modal fixed+overflow-hidden).
  const createPdfClone = (cloneClassName: string): HTMLElement | null => {
    const original = document.getElementById("bomba-pdf-area");
    if (!original) return null;
    const container = document.createElement("div");
    container.className = `bomba-pdf-clone-container ${cloneClassName}`;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.id = "bomba-pdf-clone";
    const prefix = "clone-";
    clone.querySelectorAll('[id]').forEach((el) => {
      const oldId = el.getAttribute('id')!;
      el.setAttribute('id', `${prefix}${oldId}`);
    });
    container.appendChild(clone);
    document.body.appendChild(container);
    clone.style.minHeight = "0";
    clone.style.height = "auto";
    return container;
  };
  const printViaClone = () => {
    document.querySelectorAll(".bomba-pdf-clone-container").forEach((el) => el.remove());
    const container = createPdfClone("printing-clone");
    if (!container) return;
    document.documentElement.classList.add("printing-mode");
    const cleanupAfterPrint = () => {
      document.documentElement.classList.remove("printing-mode");
      document.querySelectorAll(".bomba-pdf-clone-container").forEach((el) => el.remove());
      window.removeEventListener("afterprint", cleanupAfterPrint);
    };
    window.addEventListener("afterprint", cleanupAfterPrint);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (document.documentElement.classList.contains("printing-mode")) cleanupAfterPrint();
      }, 1000);
    }, 50);
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando dados...</div>;
  }

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const tenantSlug = typeof window !== "undefined" ? (window.location.hostname.split('.')[0] || null) : null;
  const localName = cidade || (availableUfs.find((u) => u.uf === uf)?.ufName) || "—";
  const eq = report?.selectedEquipment ?? null;

  return (
    <>
      {/* === Toolbar === */}
      <div className="mb-2 flex items-center justify-between gap-2 print:hidden">
        <div className="text-[10.5px] text-slate-500">
          Edite UF, capa, vento, temperatura e clique <span className="font-semibold text-slate-700">Recalcular</span>.
          <a href="/settings/climate-data" className="ml-1.5 text-cyan-700 hover:underline">Editar climáticos</a>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded border border-slate-300 bg-white px-0.5 py-0" title="Zoom">
            <button type="button" onClick={() => setManualZoom((z) => Math.max(0.6, Math.round(((z ?? 1) - 0.1) * 10) / 10))} className="w-5 h-5 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100">−</button>
            <button type="button" onClick={() => setManualZoom(null)} className="px-1 h-5 rounded text-[9px] font-semibold text-slate-600 hover:bg-slate-100 tabular-nums min-w-[36px]" title="Resetar zoom">{manualZoom != null ? `${Math.round(manualZoom * 100)}%` : "Auto"}</button>
            <button type="button" onClick={() => setManualZoom((z) => Math.min(2.5, Math.round(((z ?? 1) + 0.1) * 10) / 10))} className="w-5 h-5 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100">+</button>
          </div>
          <button onClick={() => onRecompute()} disabled={recomputing || !uf} className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:bg-slate-300 transition shadow-sm whitespace-nowrap">
            {recomputing ? "Recalculando..." : "Recalcular"}
          </button>
          <button onClick={printViaClone} className="rounded border border-slate-300 bg-white text-slate-700 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 transition shadow-sm whitespace-nowrap">🖨️ Imprimir</button>
        </div>
      </div>

      {/* === Folha A4 (datasheet) === */}
      <div className="mx-auto max-w-[820px] print:max-w-none bomba-screen-wrapper" style={manualZoom != null ? ({ zoom: manualZoom } as React.CSSProperties) : undefined}>
        <div id="bomba-pdf-area" className="ds-bomba bg-white border border-slate-200 shadow-sm print:border-0 print:shadow-none">

          {/* HEADER */}
          <div style={{ background: "linear-gradient(90deg,#0f172a,#1e3a8a)", color: "#fff", padding: "7px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {tenantSlug && (
                <img src={`/api/public/tenant/${tenantSlug}/logo/icon-192`} alt="Logo" style={{ height: 30, width: 30, borderRadius: 6, background: "rgba(255,255,255,.1)", objectFit: "contain", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".18em", color: "#fcd34d", fontWeight: 600 }}>Aquecimento para piscinas</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 1, lineHeight: 1.1 }}>Dimensionamento para Bomba de Calor</div>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".18em", color: "#cbd5e1" }}>Orçamento</div>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.05 }} className="num">{budget.code ?? "—"}</div>
              <div style={{ fontSize: 9, color: "#cbd5e1" }}>{today}</div>
            </div>
          </div>

          {/* CLIENTE + EXTRAS + DIM/CONFIG + IMAGEM */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, padding: "7px 18px", borderBottom: "1px solid #e2e8f0" }} className="avoid-break">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* nome / Projeto / Local + extras minicards a direita */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 11.5 }}>{budget.clientPartner?.name ?? "—"}</div>
                  <div style={{ fontSize: 10.5, color: "#334155", marginTop: 2 }}><span className="lbl">Projeto:</span> {budget.title || "—"}</div>
                  <div style={{ fontSize: 10.5, color: "#334155", marginTop: 1 }}><span className="lbl">Local:</span> {localName}</div>
                </div>
                {(() => {
                  const ed = report?.extrasDetected;
                  if (!ed) return null;
                  const cards: React.ReactNode[] = [];
                  if (ed.cascata.status !== "NAO_IDENTIFICADA") cards.push(<CompactExtraCard key="casc" icon="🌊" name="Cascata" extra={ed.cascata} horasValue={cascataHorasSemana} onChangeHoras={onChangeCascataHoras} hoursUnit="h/sem" />);
                  if (ed.hidromassagem.status !== "NAO_IDENTIFICADA") cards.push(<CompactExtraCard key="hidro" icon="💦" name="SPA" extra={ed.hidromassagem} horasValue={hidromassagemHorasSemana} onChangeHoras={onChangeHidroHoras} hoursUnit="h/sem" />);
                  if (ed.bordaInfinita.status !== "NAO_IDENTIFICADA") cards.push(<CompactExtraCard key="borda" icon="🏞" name="Borda" extra={ed.bordaInfinita} horasValue={bordaInfinitaHorasAtivaDia} onChangeHoras={onChangeBordaHoras} hoursUnit="h/dia" />);
                  if (!cards.length) return null;
                  return (
                    <div style={{ flexShrink: 0, maxWidth: 210 }}>
                      <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#94a3b8", fontWeight: 700, marginBottom: 3, textAlign: "right" }}>Extras · kW no calor</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>{cards}</div>
                    </div>
                  );
                })()}
              </div>
              {/* dimensoes + configuracao */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 9 }}>
                <div>
                  <div className="sec">Dimensões da piscina</div>
                  <div className="grid2" style={{ marginTop: 5 }}>
                    <PicoVal label="Comp." value={dsDec(dispLen)} />
                    <PicoVal label="Larg." value={dsDec(dispWid)} />
                    <PicoVal label="Prof. mín" value={dsDec(dispProfMin)} />
                    <PicoVal label="Prof. máx" value={dsDec(dispProfMax)} />
                    <PicoSel label="Tipo piscina" value={tipoPiscina} options={[{ v: "PRIVATIVA", l: "Privativa" }, { v: "COLETIVA", l: "Coletiva" }, { v: "CLINICA_SPA", l: "Clínica SPA" }]} onChange={(v) => setTipoPiscina(v)} />
                    <PicoSel label="Construção" value={tipoConstrucao} options={[{ v: "ABERTA", l: "Aberta" }, { v: "COBERTA", l: "Coberta" }, { v: "CLIMATIZADA", l: "Climatizada" }]} onChange={(v) => setTipoConstrucao(v)} />
                  </div>
                  <div className="grid2" style={{ marginTop: 5 }}>
                    <AmberStat label="Área" value={dsDec(dispArea)} unit="m²" />
                    <AmberStat label="Volume" value={dsDec(dispVolume)} unit="m³" />
                  </div>
                  {bordaVolumeExtraM3 > 0 && (
                    <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.15, color: "#0e7490" }}>🌊 Volume inclui <b>+{dsDec(bordaVolumeExtraM3)} m³</b> da borda infinita</div>
                  )}
                </div>
                <div>
                  <div className="sec">Configuração do aquecimento</div>
                  <div className="grid2" style={{ marginTop: 5 }}>
                    <PicoSel label="Capa térmica" value={capaTermica ? "SIM" : "NAO"} options={[{ v: "SIM", l: "Sim" }, { v: "NAO", l: "Não" }]} onChange={(v) => setCapaTermica(v === "SIM")} />
                    <PicoSel label="Vento" value={vento} options={[{ v: "FRACO", l: "Fraco" }, { v: "MODERADO", l: "Moderado" }, { v: "FORTE", l: "Forte" }]} onChange={(v) => setVento(v)} />
                  </div>
                  <div className="grid2" style={{ marginTop: 5 }}>
                    <PicoSel label="Cidade" value={cidade} options={availableCities.map((c) => ({ v: c, l: c }))} onChange={(v) => setCidade(v)} disabled={!uf} placeholder={uf ? "Capital" : "Selecione UF"} />
                    <PicoSel label="Estado" value={uf} options={availableUfs.map((u) => ({ v: u.uf, l: u.uf }))} onChange={(v) => { setUf(v); setCidade(""); }} placeholder="--" />
                  </div>
                  <div className="grid2" style={{ marginTop: 5 }}>
                    <AmberInput label="Temp. inicial" value={tempIniDisplay} unit="°C" min={5} max={40} onChange={(n) => setTempAguaInicial(n)} />
                    <AmberInput label="Temp. final" value={tempAguaDesejada} unit="°C" min={20} max={40} onChange={(n) => setTempAguaDesejada(n)} />
                  </div>
                  {/* Barra ΔT (aquecimento) */}
                  <div style={{ marginTop: 4, border: "1.5px solid #fcd34d", borderRadius: 4, padding: "2px 7px", background: "#fffbeb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 8.5, fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: ".03em" }}>Aquecimento ΔT</span><span style={{ fontSize: 11, fontWeight: 800, color: "#78350f" }} className="num">+{Math.max(0, tempAguaDesejada - tempIniDisplay).toFixed(0)} <span style={{ fontSize: 7.5 }}>°C</span></span></div>
                    <div style={{ height: 6, borderRadius: 3, marginTop: 2, background: "linear-gradient(90deg,#38bdf8 0%,#fbbf24 55%,#f97316 100%)" }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              {(() => {
                const selProd = candidates.find((c) => c.productId === eq?.productId);
                const productImg = selProd?.imageUrl ?? null;
                if (productImg) {
                  return (
                    <div className="w-full aspect-square print:aspect-auto print:h-[52mm] rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={productImg} alt={eq?.modelName ?? "Bomba de Calor"} className="w-full h-full object-contain" />
                    </div>
                  );
                }
                return (
                  <HeaderImageBlock imageUrl={headerImage} uploading={headerImageUploading} onUpload={onUploadHeaderImage} onRemove={onRemoveHeaderImage} />
                );
              })()}
            </div>
          </div>

          {/* BANNER DIMENSIONAMENTO */}
          <div className="banner">Dimensionamento</div>

          {report ? (
            <>
              {(() => {
                const demandaKw = report.qtotalMaxKw;
                const loadR = eq?.loadRatio ?? 0;
                const capacidadeKw = loadR > 0 ? demandaKw / loadR : (Number(eq?.kwNominal) || 0) * Math.max(1, eq?.quantity || 1);
                const folgaPct = demandaKw > 0 && capacidadeKw > 0 ? Math.round((capacidadeKw / demandaKw - 1) * 100) : 0;
                const demandaPct = capacidadeKw > 0 ? Math.min(100, (demandaKw / capacidadeKw) * 100) : 0;
                const loadPct = Math.min(100, Math.max(0, loadR * 100));
                const copVals = eq ? [
                  { lbl: "COP máx", v: Number(eq.copMax) || 0, bar: "#475569", txt: "#475569" },
                  { lbl: "Verão 50%", v: Number(eq.copAt50Air26) || 0, bar: "#d97706", txt: "#b45309" },
                  { lbl: "Inverno 50%", v: Number(eq.copAt50Air15) || 0, bar: "#0e7490", txt: "#0e7490" },
                ].filter((c) => c.v > 0) : [];
                const copRef = Math.max(1, ...copVals.map((c) => c.v));
                const vazaoStr = (() => {
                  const q = Math.max(1, eq?.quantity || 1);
                  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
                  const vmin = Number(eq?.vazaoMinM3h) > 0 ? Number(eq?.vazaoMinM3h) * q : 0;
                  const vmax = Number(eq?.vazaoMaxM3h) > 0 ? Number(eq?.vazaoMaxM3h) * q : 0;
                  if (vmin <= 0 && vmax <= 0) return "—";
                  if (vmax > vmin && vmin > 0) return `${fmt(vmin)} – ${fmt(vmax)}`;
                  return fmt(vmin || vmax);
                })();
                return (
                <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 14, padding: "7px 18px", borderBottom: "1px solid #e2e8f0" }} className="avoid-break">
                  {/* ESQUERDA: resultado + COP + capacidade x demanda */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div className="sec">Resultado do cálculo</div>
                    <div style={{ marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0", background: "#fffbeb" }}><span className="lbl" style={{ color: "#92400e" }}>Calor necessário · mês crítico</span><span style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }} className="num">{report.calorNecessarioKcalH.toLocaleString("pt-BR")} <span style={{ fontSize: 8, color: "#a16207" }}>Kcal/h</span></span></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Potência térmica</span><span style={{ fontSize: 11, fontWeight: 800 }} className="num">{report.qtotalMaxKw.toFixed(1).replace(".", ",")} <span style={{ fontSize: 8, color: "#64748b" }}>kW</span></span></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Equivalente</span><span style={{ fontSize: 11, fontWeight: 800 }} className="num">{report.calorNecessarioBtuH.toLocaleString("pt-BR")} <span style={{ fontSize: 8, color: "#64748b" }}>Btu/h</span></span></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Vazão de água · mín–máx</span><span style={{ fontSize: 11, fontWeight: 800 }} className="num">{vazaoStr} <span style={{ fontSize: 8, color: "#64748b" }}>m³/h</span></span></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Mês crítico</span><span style={{ fontSize: 11, fontWeight: 800, color: "#0e7490" }}>{MESES[report.qtotalMonthCritical] ?? "—"}</span></div>
                    </div>
                    {copVals.length > 0 && (
                      <>
                        <div className="sec" style={{ marginTop: 9 }}>Rendimento (COP) por estação</div>
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                          {copVals.map((c) => (
                            <div key={c.lbl} style={{ display: "grid", gridTemplateColumns: "62px 1fr 30px", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 9, color: c.txt, fontWeight: 600 }}>{c.lbl}</span>
                              <div style={{ height: 9, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${(c.v / copRef) * 100}%`, height: "100%", background: c.bar }}></div></div>
                              <span style={{ fontSize: 10, fontWeight: 800, textAlign: "right", color: c.txt }} className="num">{dsDec(c.v, 1)}</span>
                            </div>
                          ))}
                        </div>
                        {report.copEstimated && report.copEstimated > 0 ? (<div style={{ marginTop: 6, borderRadius: 4, background: "#ecfeff", border: "1px solid #cffafe", padding: "4px 7px", fontSize: 9.5, color: "#155e75" }}>COP efetivo no clima local <strong className="num">{dsDec(report.copEstimated, 1)}</strong> · varia mês a mês com a temperatura do ar</div>) : null}
                      </>
                    )}
                    {capacidadeKw > 0 && demandaKw > 0 && (
                      <>
                        <div className="sec" style={{ marginTop: 9 }}>Capacidade × Demanda</div>
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "62px 1fr 52px", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>Demanda</span><div style={{ height: 11, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${demandaPct}%`, height: "100%", background: "#94a3b8" }}></div></div><span style={{ fontSize: 9.5, fontWeight: 800, textAlign: "right" }} className="num">{dsDec(demandaKw, 1)} kW</span></div>
                          <div style={{ display: "grid", gridTemplateColumns: "62px 1fr 52px", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, color: "#047857", fontWeight: 600 }}>Capacidade</span><div style={{ height: 11, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: "100%", height: "100%", background: "#047857" }}></div></div><span style={{ fontSize: 9.5, fontWeight: 800, textAlign: "right", color: "#047857" }} className="num">{dsDec(capacidadeKw, 1)} kW</span></div>
                          {folgaPct !== 0 && (<div style={{ display: "flex", justifyContent: "flex-end" }}><span className="chip" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }}>{folgaPct > 0 ? "+" : ""}{folgaPct}% de folga</span></div>)}
                        </div>
                      </>
                    )}
                  </div>
                  {/* DIREITA: equipamento + tubulacao + bomba de circulacao */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {eq ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div className="sec" style={{ flex: 1 }}>{eq.fromOverride ? "Bomba de calor (manual)" : eq.fromItemCellRef ? "Bomba de calor (da linha)" : "Bomba de calor selecionada"}</div>
                          <button type="button" className="ds-edit" onClick={() => setShowHeatingRulePicker(true)} title="Configurar regra de auto-seleção da bomba de calor" style={{ fontSize: 11, fontWeight: 700, padding: "0 5px", borderRadius: 4, border: "1px solid #e2e8f0", color: "#94a3b8", background: "#fff", cursor: "pointer" }}>✨</button>
                        </div>
                        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                            <button type="button" className="ds-edit" onClick={() => setShowEquipPicker(!showEquipPicker)} style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 5, padding: "2px 7px", fontSize: 12.5, fontWeight: 800, color: "#0f172a", cursor: "pointer", textAlign: "left" }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }} title={eq.modelName}>{eq.modelName}</span>
                              <span style={{ fontSize: 10, color: "#64748b", flexShrink: 0 }}>{showEquipPicker ? "▲" : "▼"}</span>
                            </button>
                            <span className="ds-print" style={{ fontSize: 12.5, fontWeight: 800 }}>{eq.modelName}</span>
                            {showEquipPicker && (
                              <div className="absolute z-50 left-0 top-full mt-2 rounded-xl border-2 border-emerald-200 bg-white shadow-xl p-3 max-h-96 overflow-y-auto w-[520px] max-w-[90vw]">
                                <div className="text-[11px] font-semibold uppercase text-slate-500 mb-2">Trocar equipamento</div>
                                {eq.fromOverride && (
                                  <button type="button" onClick={() => changeEquipment(null)} disabled={changingEquipment} className="w-full text-left px-3 py-2 mb-2 rounded-lg border border-violet-300 bg-violet-50 hover:bg-violet-100 text-sm font-semibold text-violet-900 disabled:opacity-50">↺ Voltar pra seleção automática</button>
                                )}
                                <div className="space-y-1">
                                  {candidates.length === 0 && (<div className="text-xs text-slate-500 px-2 py-3">Nenhum produto Bomba de Calor com kcalHNominal. Configure a regra no ✨.</div>)}
                                  {[...candidates].sort((a, b) => a.kcalHNominal - b.kcalHNominal).map((c) => (
                                    <button key={c.productId} type="button" onClick={() => { changeEquipment(c.productId, 1); setShowEquipPicker(false); }} disabled={changingEquipment} className={`w-full text-left px-3 py-2 rounded-lg border text-sm disabled:opacity-50 ${c.productId === eq.productId ? "border-emerald-400 bg-emerald-50 font-semibold" : "border-slate-200 hover:bg-slate-50"}`}>
                                      {c.modelName} <span className="text-[11px] text-slate-500">· {c.kcalHNominal.toLocaleString("pt-BR")} Kcal/h</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <span className="ds-edit"><EquipmentQuantityInput productId={eq.productId} currentQty={eq.quantity} onChangeQty={(newQty) => changeEquipment(eq.productId, newQty)} disabled={changingEquipment} /></span>
                          {eq.quantity > 1 ? (<span className="chip" style={{ background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" }}>⚡ {eq.quantity}× em paralelo</span>) : (<span className="chip">1 unidade</span>)}
                        </div>
                        <div className="card" style={{ marginTop: 5, padding: "7px 8px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                            <div style={{ background: "#f8fafc", borderRadius: 4, padding: "4px 7px" }}><div className="lbl">Capacidade</div><div style={{ fontSize: 11, fontWeight: 800 }} className="num">{eq.kcalHNominal?.toLocaleString("pt-BR")} Kcal/h</div></div>
                            {eq.kwNominal ? <div style={{ background: "#f8fafc", borderRadius: 4, padding: "4px 7px" }}><div className="lbl">Pot. térmica</div><div style={{ fontSize: 11, fontWeight: 800 }} className="num">{eq.kwNominal} kW</div></div> : null}
                            {eq.ratedInputPowerKW ? <div style={{ background: "#f8fafc", borderRadius: 4, padding: "4px 7px" }}><div className="lbl">Consumo médio</div><div style={{ fontSize: 11, fontWeight: 800 }} className="num">{eq.ratedInputPowerKW} kW</div></div> : null}
                          </div>
                          <div style={{ marginTop: 7, display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                            <div style={{ fontSize: 10, color: "#047857", whiteSpace: "nowrap" }}>Carga <strong className="num" style={{ fontSize: 12 }}>{(eq.loadRatio * 100).toFixed(0)}%</strong> · <span>{eq.isAdequate ? "folga adequada" : "fora da faixa"}</span></div>
                            <div style={{ position: "relative", height: 12, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}><div style={{ position: "absolute", left: "60%", width: "25%", top: 0, bottom: 0, background: "#ecfdf5" }}></div><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${loadPct}%`, background: eq.isAdequate ? "#047857" : "#d97706", borderRadius: "4px 0 0 4px" }}></div><div style={{ position: "absolute", left: `${loadPct}%`, top: -2, bottom: -2, width: 2, background: "#0f172a" }}></div></div>
                          </div>
                          <div style={{ marginTop: 5, fontSize: 9.5, color: "#475569", borderTop: "1px solid #f1f5f9", paddingTop: 4 }}>
                            {report.timeToHeatInfeasible
                              ? <span style={{ color: "#be123c", fontWeight: 700 }}>⛔ Não aquece nas condições atuais</span>
                              : <>Aquece de <strong className="num" style={{ color: "#0f172a" }}>{tempIniDisplay} → {tempAguaDesejada} °C</strong> em <strong className="num" style={{ color: "#0f172a" }}>{report.timeToHeatHours && isFinite(report.timeToHeatHours) ? Math.floor(report.timeToHeatHours) : "—"} h</strong>{report.degreesPerHour ? <span style={{ color: "#94a3b8" }}> ({dsDec(report.degreesPerHour)} °C/h)</span> : null} · zona ideal de carga 60–85% (faixa verde)</>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ borderRadius: 8, border: "1px solid #fcd34d", background: "#fffbeb", padding: "8px 12px", fontSize: 12, color: "#92400e" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><strong>Nenhum equipamento compatível.</strong><button type="button" className="ds-edit" onClick={() => setShowHeatingRulePicker(true)} style={{ color: "#7c3aed", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "none", border: 0 }}>✨ Configurar</button></div>
                        <div style={{ marginTop: 2, fontSize: 10.5 }}>Cadastre Bomba de Calor com kcalHNominal e configure a regra de auto-seleção (✨).</div>
                      </div>
                    )}
                    {report.selectedEquipment && (
                      <TrocadorPumpPipeCard
                        budgetId={budget.id}
                        sel={report.selectedEquipment}
                        operatingHoursPerMonth={report.operatingHoursPerMonth}
                        operatingHoursPerDayAvg={report.operatingHoursPerDayAvg}
                        onOpenRulePicker={() => setShowTrocadorRulePicker(true)}
                        ruleVersion={trocadorRuleVersion}
                        onConsumoChange={setRecircConsumo}
                        initialBombaId={(budget.environmentParams as any)?.trocadorBombaId ?? null}
                        initialBombaQty={(budget.environmentParams as any)?.trocadorBombaQty ?? 1}
                        initialVazaoOper={(budget.environmentParams as any)?.trocadorBombaVazaoOperM3h ?? null}
                        initialPipe={(budget.environmentParams as any)?.trocadorPipe ?? null}
                        onChanged={onPendingSave}
                      />
                    )}
                  </div>
                </div>
                );
              })()}

              {/* BANNER SIMULACAO */}
              <div className="banner">Simulação de consumo mensal</div>
              {report.monthlyConsumption && report.monthlyConsumption.length > 0 ? (() => {
                const mc = report.monthlyConsumption!;
                const critIdx = mc.findIndex((m) => m.monthIndex === report.qtotalMonthCritical);
                const bombaKwh = report.annualKwh ?? 0;
                const recircKwh = recircConsumo?.kwhAno ?? 0;
                const totalKwh = bombaKwh + recircKwh;
                const totalCostCents = (report.annualCostBRLCents ?? 0) + (recircConsumo?.custoAnoCents ?? 0);
                const bombaPct = totalKwh > 0 ? Math.round((bombaKwh / totalKwh) * 100) : 100;
                const recircPct = 100 - bombaPct;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 14, padding: "7px 18px" }} className="avoid-break">
                    {/* ESQUERDA: 4 stats + curva sazonal + donut */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
                        <div style={{ border: "1px solid #cffafe", background: "#ecfeff", borderRadius: 8, padding: "4px 8px" }}><div className="lbl" style={{ color: "#0e7490" }}>Bomba calor · ano</div><div style={{ fontSize: 15, fontWeight: 800, color: "#155e75", lineHeight: 1.1 }} className="num">{bombaKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div><div style={{ fontSize: 8, color: "#0e7490", fontWeight: 600 }}>kWh</div></div>
                        <div style={{ border: "1px solid #cffafe", background: "#ecfeff", borderRadius: 8, padding: "4px 8px" }}><div className="lbl" style={{ color: "#0e7490" }}>Recirculação · ano</div><div style={{ fontSize: 15, fontWeight: 800, color: "#155e75", lineHeight: 1.1 }} className="num">{recircKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div><div style={{ fontSize: 8, color: "#0e7490", fontWeight: 600 }}>kWh</div></div>
                        <div style={{ border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 8, padding: "4px 8px" }}><div className="lbl" style={{ color: "#c2410c" }}>Consumo TOTAL · ano</div><div style={{ fontSize: 15, fontWeight: 800, color: "#9a3412", lineHeight: 1.1 }} className="num">{totalKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div><div style={{ fontSize: 8, color: "#c2410c", fontWeight: 600 }}>kWh (bomba+recirc)</div></div>
                        <div style={{ border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 8, padding: "4px 8px" }}><div className="lbl" style={{ color: "#c2410c" }}>Custo total · ano</div><div style={{ fontSize: 13.5, fontWeight: 800, color: "#9a3412", lineHeight: 1.1 }} className="num">{fmtBRL(totalCostCents)}</div><div style={{ fontSize: 8, color: "#c2410c", fontWeight: 600 }}>por ano</div></div>
                      </div>
                      <div className="card" style={{ marginTop: 8, padding: "7px 9px 4px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}><div className="sec" style={{ border: 0, padding: 0 }}>Curva sazonal de consumo · kWh/mês</div><div style={{ fontSize: 9, color: "#64748b" }}>pico no <b style={{ color: "#0e7490" }}>inverno</b></div></div>
                        <SeasonalCurve monthly={mc} criticalIndex={critIdx} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center", marginTop: 7, border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px" }}>
                        <ConsumoDonut bombaKwh={bombaKwh} recircKwh={recircKwh} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div className="lbl" style={{ marginBottom: 1 }}>Composição do consumo anual</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#0e7490" }}></span>Bomba de calor</span><span style={{ fontSize: 10 }}><b className="num">{bombaKwh.toLocaleString("pt-BR")}</b> kWh · <b style={{ color: "#0e7490" }}>{bombaPct}%</b></span></div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }}></span>Recirculação</span><span style={{ fontSize: 10 }}><b className="num">{recircKwh.toLocaleString("pt-BR")}</b> kWh · <b style={{ color: "#b45309" }}>{recircPct}%</b></span></div>
                          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 9.5, color: "#64748b" }}>Custo da bomba (ano)</span><span style={{ fontSize: 10.5, fontWeight: 800, color: "#b45309" }} className="num">{fmtBRL(report.annualCostBRLCents ?? 0)}</span></div>
                        </div>
                      </div>
                    </div>
                    {/* DIREITA: tabela mensal */}
                    <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <table style={{ fontSize: 10 }}>
                        <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}><th style={{ textAlign: "left", padding: "4px 9px", fontSize: 9, color: "#334155", fontWeight: 700 }}>Mês</th><th style={{ textAlign: "right", padding: "4px 9px", fontSize: 9, color: "#334155", fontWeight: 700 }}>kWh</th><th style={{ textAlign: "right", padding: "4px 9px", fontSize: 9, color: "#334155", fontWeight: 700 }}>R$</th></tr></thead>
                        <tbody>
                          {mc.map((m, i) => { const isCrit = i === critIdx; return (
                            <tr key={m.monthIndex} style={{ borderBottom: "1px solid #f1f5f9", background: isCrit ? "#cffafe" : undefined }}>
                              <td style={{ padding: "3.4px 9px", color: isCrit ? "#155e75" : "#334155", fontWeight: isCrit ? 800 : undefined }}>{m.monthName}{isCrit ? " ▲" : ""}</td>
                              <td style={{ padding: "3.4px 9px", textAlign: "right", color: isCrit ? "#155e75" : undefined, fontWeight: isCrit ? 800 : undefined }} className="num">{Math.round(m.kwhConsumido).toLocaleString("pt-BR")}</td>
                              <td style={{ padding: "3.4px 9px", textAlign: "right", color: isCrit ? "#0e7490" : "#047857", fontWeight: isCrit ? 800 : 700 }} className="num">{dsMoney(m.custoBRLCents)}</td>
                            </tr>
                          ); })}
                          <tr style={{ background: "#f1f5f9" }}><td style={{ padding: "5px 9px", color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap" }}>Total bomba de calor:</td><td style={{ padding: "5px 9px", textAlign: "right", color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap" }} className="num">{bombaKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span style={{ fontSize: 8, fontWeight: 600, color: "#64748b" }}>kWh</span></td><td style={{ padding: "5px 9px", textAlign: "right", color: "#0e7490", fontWeight: 800, whiteSpace: "nowrap" }} className="num">{fmtBRL(report.annualCostBRLCents ?? 0)}</td></tr>
                        </tbody>
                      </table>
                      <div style={{ padding: "5px 9px", borderTop: "1px solid #e2e8f0", fontSize: 8.5, color: "#64748b", lineHeight: 1.35 }}>Valores da <b style={{ color: "#0e7490" }}>bomba de calor</b>. Recirculação adiciona <b className="num" style={{ color: "#0f172a" }}>{recircKwh.toLocaleString("pt-BR")} kWh</b> ao ano → total geral <b className="num" style={{ color: "#9a3412" }}>{totalKwh.toLocaleString("pt-BR")} kWh / {fmtBRL(totalCostCents)}</b>.</div>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ padding: "12px 18px", fontSize: 13, color: "#64748b" }}>{eq ? "Equipamento sem ratedInputPowerKW no cadastro — não dá pra estimar consumo." : "Selecione um equipamento pra estimar o consumo."}</div>
              )}

              {/* FOOTER */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, padding: "6px 18px", borderTop: "1px solid #e2e8f0", alignItems: "stretch" }} className="avoid-break">
                <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.45, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".08em", color: "#475569", fontWeight: 700, marginBottom: 3 }}>Observações</div>
                  <div>Dimensionamento conforme NBR 10.339. Capacidade da bomba de calor selecionada para o mês mais frio (crítico) da localidade. Consumo estimado com COP ajustado pela temperatura média de cada mês (clima local) e tarifa de energia configurada no sistema. A curva sazonal evidencia o maior consumo nos meses mais frios, quando o ΔT é maior e o COP cai.</div>
                </div>
                <div style={{ border: "1px solid #fecaca", borderRadius: 8, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
                  <div style={{ background: "#b91c1c", color: "#fff", padding: "3px 8px" }}><div style={{ fontSize: 9, fontWeight: 800, lineHeight: 1.1 }}>NBR 10339:2018 — ABNT</div><div style={{ fontSize: 7.5, color: "#fecaca", lineHeight: 1.1 }}>Faixas de temperatura por uso</div></div>
                  <div style={{ padding: "4px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", fontSize: 8.5, lineHeight: 1.5, flex: 1, alignContent: "center" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#475569" }}>SPA</span><span style={{ fontWeight: 800 }} className="num">36–38°</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#475569" }}>Competição</span><span style={{ fontWeight: 800 }} className="num">25–28°</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#475569" }}>Recreação</span><span style={{ fontWeight: 800 }} className="num">27–29°</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#475569" }}>Bebês/Hidro</span><span style={{ fontWeight: 800 }} className="num">30–34°</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#475569" }}>Crianças</span><span style={{ fontWeight: 800 }} className="num">29–32°</span></div>
                    <div style={{ color: "#b91c1c", fontWeight: 700 }}>⚠ médico &gt;38°</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mx-5 my-6 rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 print:hidden">
              {uf ? "Clique em Recalcular para gerar o dimensionamento." : "Selecione UF e cidade para começar."}
            </div>
          )}
        </div>
      </div>

      {/* Modal AutoSelect — regra da BOMBA DE CALOR (✨). Mesmo componente do orcamento/solar. */}
      {showHeatingRulePicker && (
        <AutoSelectModal
          initialRule={heatingRule ?? null}
          catalog={catalog ?? []}
          dimensions={budget.poolDimensions}
          environmentParams={budget.environmentParams}
          heatingReport={report}
          siblingVars={{}}
          sectionItems={[]}
          itemDescription="Bomba de Calor (Simulador)"
          currentProductName={eq?.modelName ?? null}
          onClose={() => setShowHeatingRulePicker(false)}
          onSave={async (rule: AutoSelectRule) => { await onSaveHeatingRule(rule); setShowHeatingRulePicker(false); }}
          onClear={async () => { await onSaveHeatingRule(null); setShowHeatingRulePicker(false); }}
        />
      )}

      {/* Modal AutoSelect — regra INDEPENDENTE da BOMBA DE CIRCULACAO do calor (✨ no card da
          bomba de circulação). Mesma formula do Solar, config própria. */}
      {showTrocadorRulePicker && (
        <AutoSelectModal
          initialRule={trocadorBombaRule ?? null}
          catalog={catalog ?? []}
          dimensions={budget.poolDimensions}
          environmentParams={budget.environmentParams}
          heatingReport={report}
          siblingVars={(() => {
            // Preview do modal usa as MESMAS vars da regra: injeta vazao-alvo (vazaoMin × qtd)
            // como vazaoSolarM3h E vazaoMax × qtd como vazaoMaxM3h, pros templates "Bomba de
            // circulacao (Bomba de Calor)" e o indicador "dentro x fora da vazao" preverem
            // certo (senao pegariam a vazao da solar = 0).
            const q = Math.max(1, eq?.quantity || 1);
            const vmin = Number(eq?.vazaoMinM3h) > 0 ? Number(eq?.vazaoMinM3h) * q : 0;
            const vmax = Number(eq?.vazaoMaxM3h) > 0 ? Number(eq?.vazaoMaxM3h) * q : 0;
            const out: Record<string, number> = {};
            if (vmin > 0) out.vazaoSolarM3h = vmin;
            if (vmax > 0) out.vazaoMaxM3h = vmax;
            return out;
          })()}
          sectionItems={[]}
          itemDescription="Bomba de circulação (Bomba de Calor)"
          currentProductName={null}
          onClose={() => setShowTrocadorRulePicker(false)}
          onSave={async (rule: AutoSelectRule) => { await saveTrocadorBombaRule(rule); setShowTrocadorRulePicker(false); }}
          onClear={async () => { await saveTrocadorBombaRule(null); setShowTrocadorRulePicker(false); }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* === V1 "curva sazonal" datasheet (.ds-bomba) — base, vale tela E print === */
        .ds-bomba { width:100%; background:#fff; color:#0f172a; font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; font-size:11px; line-height:1.3; }
        .ds-bomba * { box-sizing:border-box; }
        .ds-bomba .num { font-variant-numeric: tabular-nums; }
        .ds-bomba .lbl { font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; font-weight:700; line-height:1; }
        .ds-bomba .sec { font-size:8.5px; text-transform:uppercase; letter-spacing:.14em; color:#64748b; font-weight:700; border-bottom:1px solid #e2e8f0; padding-bottom:3px; }
        .ds-bomba .banner { background:#1e3a8a; color:#fff; padding:5px 18px; font-size:9px; text-transform:uppercase; letter-spacing:.18em; font-weight:700; }
        .ds-bomba .card { border:1px solid #e2e8f0; border-radius:8px; background:#fff; }
        .ds-bomba .chip { display:inline-flex; align-items:center; gap:4px; border:1px solid #e2e8f0; background:#f1f5f9; color:#475569; border-radius:4px; font-size:9px; font-weight:700; padding:1px 7px; }
        .ds-bomba .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
        .ds-bomba .pico { border:1px solid #e2e8f0; border-radius:4px; padding:3px 6px; background:#fff; }
        .ds-bomba .pico .lbl { color:#64748b; }
        .ds-bomba .pico .v { font-size:11px; font-weight:700; color:#0f172a; line-height:1.2; }
        .ds-bomba table { width:100%; border-collapse:collapse; }
        .ds-bomba .ex { display:inline-flex; flex-direction:column; align-items:center; gap:1px; border:1px solid #bae6fd; background:#f0f9ff; border-radius:5px; padding:2px 6px 3px; line-height:1; }
        .ds-bomba .exn { font-size:7px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.02em; line-height:1; }
        .ds-bomba .exr { display:inline-flex; align-items:center; gap:3px; line-height:1; }
        /* swap tela <-> impressao: ds-edit = controle editavel (so na tela), ds-print = valor estatico (so no print) */
        .ds-bomba .ds-print { display:none; }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }

          /* v1.12.72: PRINT SEMPRE via clone no body (#bomba-pdf-clone).
             O original (#bomba-pdf-area) esta enterrado dentro do modal
             "fixed inset-0 overflow-hidden", que confunde o motor de print do
             Chrome e gera 2 paginas. Solucao: printViaClone() cria um clone
             em document.body com classe .printing-clone, adiciona
             html.printing-mode e printa SO o clone.

             v1.12.75: ESCONDER COM display:none, nao visibility:hidden.
             visibility:hidden mantem o elemento no layout flow — o #bomba-pdf-area
             original (1163px altura natural) ocupava espaco no body e causava
             2a pagina em branco no print (overflow ~40px do A4 portrait).
             display:none remove do flow, o clone (1029px) cabe em 1 pagina. */
          html.printing-mode body > *:not(.bomba-pdf-clone-container) {
            display: none !important;
          }
          html.printing-mode .bomba-pdf-clone-container.printing-clone,
          html.printing-mode .bomba-pdf-clone-container.printing-clone * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Container do clone — fluxo normal direto no topo da pagina */
          html.printing-mode .bomba-pdf-clone-container.printing-clone {
            position: static !important;
            width: 100% !important;
            padding: 0 !important; margin: 0 !important;
            background: #fff !important;
            display: block !important;
          }
          html.printing-mode #bomba-pdf-clone {
            width: 100% !important;
            padding: 3mm !important; margin: 0 !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            min-height: 0 !important;
            height: auto !important;
            box-shadow: none !important;
            border: 0 !important;
            display: block !important;
          }

          /* Avoid page breaks dentro dos blocos principais */
          .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }

          /* Espacador flex-1 some no print — tanto o filho direto quanto qualquer
             nested (v1.12.74: havia <div className="flex-1"/> dentro do banner
             SIMULACAO empurrando conteudo pra 2a pagina) */
          html.printing-mode #bomba-pdf-clone > div.flex-1,
          html.printing-mode #bomba-pdf-clone .flex-1:not(section):not([class*="col-span"]):empty {
            display: none !important;
            flex: none !important;
            height: 0 !important;
            min-height: 0 !important;
          }
          /* v1.12.74: garante que o clone nao tem min-height residual da classe min-h-[1120px] */
          html.printing-mode #bomba-pdf-clone[class*="min-h-"] {
            min-height: 0 !important;
          }

          /* Header mantem cor (gradiente azul-preto + branco) */
          html.printing-mode #bomba-pdf-clone header {
            display: flex !important;
            visibility: visible !important;
            padding: 4px 16px !important;
            background: linear-gradient(to right, #0f172a, #1e3a8a) !important;
            color: #ffffff !important;
          }
          html.printing-mode #bomba-pdf-clone header h2,
          html.printing-mode #bomba-pdf-clone header div { color: #ffffff !important; }
          html.printing-mode #bomba-pdf-clone header .text-amber-300 { color: #fcd34d !important; }
          html.printing-mode #bomba-pdf-clone header .text-slate-300 { color: #cbd5e1 !important; }

          /* Banners coloridos */
          html.printing-mode #bomba-pdf-clone .bg-blue-900 {
            background-color: #1e3a8a !important;
            color: #ffffff !important;
          }
          html.printing-mode #bomba-pdf-clone .bg-blue-900 * { color: #ffffff !important; }

          /* Compactacao agressiva pra caber em 1 pagina A4 (~1093px util) */
          html.printing-mode #bomba-pdf-clone section { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #bomba-pdf-clone footer { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #bomba-pdf-clone .px-5 { padding-left: 10px !important; padding-right: 10px !important; }

          /* v1.13.47: compactacao EXTRA — a aba Bomba de Calor tem card de bomba de circulacao +
             tubulacao no dimensionamento E tabela de consumo de 12 meses (conteudo a mais que o
             Solar), entao estourava pra 2a pagina (~1233px). Medido no /dev/print-test-bomba:
             estes 4 ajustes baixam pra ~1084px (cabe em A4 com folga). */
          html.printing-mode #bomba-pdf-clone table td, html.printing-mode #bomba-pdf-clone table th { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #bomba-pdf-clone .p-2\\.5 { padding: 5px !important; }
          html.printing-mode #bomba-pdf-clone .mt-2 { margin-top: 3px !important; }
          html.printing-mode #bomba-pdf-clone .mt-2\\.5 { margin-top: 3px !important; }
          html.printing-mode #bomba-pdf-clone .mt-1\\.5 { margin-top: 4px !important; }

          /* Esconde controles interativos */
          html.printing-mode #bomba-pdf-clone .print-hide-interactive { display: none !important; }
          html.printing-mode #bomba-pdf-clone .print-show-value { display: inline-block !important; }
          html.printing-mode #bomba-pdf-clone select { display: none !important; }
          html.printing-mode #bomba-pdf-clone input[type=range] { display: none !important; }

          /* Tailwind print:* classes (aplicadas no clone) */
          html.printing-mode #bomba-pdf-clone .print\\:inline-block { display: inline-block !important; }
          html.printing-mode #bomba-pdf-clone .print\\:hidden { display: none !important; }
          html.printing-mode #bomba-pdf-clone .print\\:bg-white { background: #fff !important; background-image: none !important; }
          html.printing-mode #bomba-pdf-clone .print\\:text-blue-900 { color: #1e3a8a !important; }
          html.printing-mode #bomba-pdf-clone .print\\:text-amber-700 { color: #b45309 !important; }
          html.printing-mode #bomba-pdf-clone .print\\:text-slate-600 { color: #475569 !important; }
          html.printing-mode #bomba-pdf-clone .print\\:border-b-4 { border-bottom-width: 4px !important; }
          html.printing-mode #bomba-pdf-clone .print\\:border-y { border-top-width: 1px !important; border-bottom-width: 1px !important; border-top-style: solid !important; border-bottom-style: solid !important; }
          html.printing-mode #bomba-pdf-clone .print\\:border-blue-900 { border-color: #1e3a8a !important; }

          /* SVG do grafico — limita a 60mm (era 80mm, gerava overflow pra pag 2) */
          html.printing-mode #bomba-pdf-clone svg { max-height: 60mm !important; width: 100% !important; height: auto !important; }
          /* V1: a regra svg acima distorceria donut/curva — neutralizar pra cada um */
          html.printing-mode #bomba-pdf-clone svg.ds-donut { width: 84px !important; height: 84px !important; max-height: none !important; }
          html.printing-mode #bomba-pdf-clone svg.ds-curve { width: 100% !important; height: auto !important; max-height: none !important; }
          /* V1: swap editavel -> estatico no print */
          html.printing-mode #bomba-pdf-clone .ds-edit { display: none !important; }
          html.printing-mode #bomba-pdf-clone .ds-print { display: inline !important; }
          html.printing-mode #bomba-pdf-clone img { max-height: none !important; }

          /* v1.12.73: classes print:* especificas do Tailwind usadas pra controlar
             altura/aspect-ratio da imagem do coletor + gráfico no print */
          html.printing-mode #bomba-pdf-clone .print\\:aspect-auto { aspect-ratio: auto !important; }
          html.printing-mode #bomba-pdf-clone .print\\:h-full { height: 100% !important; }
          html.printing-mode #bomba-pdf-clone .print\\:h-auto { height: auto !important; }
          html.printing-mode #bomba-pdf-clone .print\\:max-h-\\[52mm\\] { max-height: 52mm !important; }
          html.printing-mode #bomba-pdf-clone .print\\:max-h-\\[58mm\\] { max-height: 58mm !important; }
          html.printing-mode #bomba-pdf-clone .print\\:max-h-\\[62mm\\] { max-height: 62mm !important; }
          html.printing-mode #bomba-pdf-clone .print\\:items-start { align-items: flex-start !important; }
          html.printing-mode #bomba-pdf-clone .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          html.printing-mode #bomba-pdf-clone .print\\:p-1 { padding: 0.25rem !important; }
          html.printing-mode #bomba-pdf-clone .print\\:mb-1 { margin-bottom: 0.25rem !important; }

          /* Classe .print\\:hidden geral aplicada via Tailwind no JSX */
          .print\\:hidden { display: none !important; }

          /* === FALLBACK: se printing-mode nao foi adicionado (chamada direta a window.print)
             usa o original. Mantido pra compat — botoes novos sempre usam printViaClone(). === */
          html:not(.printing-mode) body * { visibility: hidden; }
          html:not(.printing-mode) #bomba-pdf-area,
          html:not(.printing-mode) #bomba-pdf-area * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html:not(.printing-mode) #bomba-pdf-area {
            width: 100%; padding: 3mm !important; margin: 0;
            font-size: 10px; line-height: 1.2;
            min-height: 0 !important; height: auto !important;
            box-shadow: none !important; border: 0 !important;
          }
        }

        /* v1.12.77: removido bloco "simulating-print" inteiro — era do botao 👁️ PDF
           que foi extinto. Pra debug futuro do print, usar /dev/print-test. */

        /* === Tela: escala o datasheet proporcionalmente em viewports grandes ===
           PDF/print mantem A4 inalterado (zoom: 1 forcado em @media print). */
        @media (min-width: 1024px) { .bomba-screen-wrapper { zoom: 1.15; } }
        @media (min-width: 1280px) { .bomba-screen-wrapper { zoom: 1.30; } }
        @media (min-width: 1536px) { .bomba-screen-wrapper { zoom: 1.50; } }
        @media (min-width: 1792px) { .bomba-screen-wrapper { zoom: 1.70; } }
        @media print { .bomba-screen-wrapper { zoom: 1 !important; } }
      ` }} />
    </>
  );
}


function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px] leading-tight">
      <span className="text-slate-600 font-semibold w-12 shrink-0">{label}:</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}

// ============ Componentes do redesign profissional do SolarTab ============

interface TrocadorBombaCandidate {
  productId: string; description: string; salePriceCents: number; poolType: string | null;
  imageUrl: string | null; vazaoM3h: number; pressaoTrabalhoMca: number; potenciaCv: number | null;
  hasPumpCurve: boolean; indicator: { value: number; label: string; color: string; unit: string; groupLabel?: string } | null;
}

// Bomba de circulacao + tubulacao da aba Bomba de Calor — PARIDADE com a bomba de
// recirculacao do Solar: dropdown + card (imagem/specs/preco/indicador) + CONSUMO
// ELETRICO MENSAL (kWh/mes + R$/mes, tarifa editavel no 💡, tenant global compartilhada
// com o Solar). A vazao-alvo vem da bomba de calor SELECIONADA (vazaoMinM3h × qtd).
// A bomba de circulacao roda JUNTO com a bomba de calor, entao o consumo usa as HORAS
// REAIS de operacao por mes (operatingHoursPerMonth, demanda-dirigida): inverno funciona
// mais, verao menos, e bomba de calor mais potente -> menos horas (atinge o alvo mais
// rapido). Sem vazao cadastrada -> avisa e nao dimensiona. Reusa /trocador-pipe/recompute
// + /trocador-bomba-candidates (endpoints do nucleo do Solar).
function TrocadorPumpPipeCard({ budgetId, sel, operatingHoursPerMonth, operatingHoursPerDayAvg, onOpenRulePicker, ruleVersion, onConsumoChange, initialBombaId, initialBombaQty, initialVazaoOper, initialPipe, onChanged }: {
  budgetId: string;
  sel?: { vazaoMinM3h?: number; vazaoMaxM3h?: number; quantity?: number } | null;
  operatingHoursPerMonth?: number[];
  operatingHoursPerDayAvg?: number;
  onOpenRulePicker?: () => void;
  ruleVersion?: number;
  onConsumoChange?: (c: { kwhAno: number; custoAnoCents: number } | null) => void;
  // v1.13.52: productId persistido (environmentParams.trocadorBombaId) — restaura a escolha.
  initialBombaId?: string | null;
  // v1.13.55: N em paralelo persistido (environmentParams.trocadorBombaQty) — restaura a qtd.
  initialBombaQty?: number | null;
  // v1.13.59: vazao de operacao total persistida (environmentParams.trocadorBombaVazaoOperM3h)
  // — evita re-persistir/recalcular a toa ao abrir o Simulador quando nada mudou.
  initialVazaoOper?: number | null;
  // v1.13.57 (Chunk C): tubo persistido (environmentParams.trocadorPipe = { inputs, result }).
  // Restaura comprimento/desnivel/DN salvos — antes resetavam a 30/4 (pendencia v1.13.12).
  initialPipe?: { inputs?: { comprimentoM?: number; desnivelM?: number; vazaoM3h?: number } | null; result?: any } | null;
  // v1.13.52: chamado quando a bomba selecionada e persistida — parent marca reload pendente.
  onChanged?: () => void;
}) {
  const qty = Math.max(1, Number(sel?.quantity) || 1);
  const vMin = Number(sel?.vazaoMinM3h) || 0;
  const vMax = Number(sel?.vazaoMaxM3h) || 0;
  const hasVazao = vMin > 0;
  const vazaoAlvo = Number((vMin * qty).toFixed(2));
  const vazaoMaxTotal = vMax > 0 ? Number((vMax * qty).toFixed(2)) : 0;

  // v1.13.57 (Chunk C): inicia do tubo persistido (env.trocadorPipe) — antes resetava a 30/4
  // a cada abertura (efemero). Sem persistido, mantem os defaults 30/4.
  const [comprimento, setComprimento] = useState<number>(Number(initialPipe?.inputs?.comprimentoM) || 30);
  const [desnivel, setDesnivel] = useState<number>(
    Number.isFinite(Number(initialPipe?.inputs?.desnivelM)) ? Number(initialPipe?.inputs?.desnivelM) : 4,
  );
  const [pipeResult, setPipeResult] = useState<any | null>(initialPipe?.result ?? null);
  const [pipeBusy, setPipeBusy] = useState(false);
  const [candidates, setCandidates] = useState<TrocadorBombaCandidate[]>([]);
  const [selBombaId, setSelBombaId] = useState<string | null>(initialBombaId ?? null);
  // v1.13.55: N em paralelo da recirc (auto = teto(vazaoAlvo/vazaoBomba); operador ajusta).
  const [selBombaQty, setSelBombaQty] = useState<number>(Math.max(1, Math.round(Number(initialBombaQty) || 1)));
  const [candLoading, setCandLoading] = useState(false);

  // Tarifa de energia (R$/kWh em centavos) — tenant global, MESMA do Solar (💡).
  const [tarifaKwhBRLCents, setTarifaKwhBRLCents] = useState<number>(95);
  const [showTarifaPopover, setShowTarifaPopover] = useState(false);
  const [tarifaInputValue, setTarifaInputValue] = useState<string>("0,95");
  const [tarifaSaving, setTarifaSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.get<{ tarifaKwhBRLCents: number }>("/pool-budgets/solar-tarifa-kwh")
      .then((r) => {
        if (cancelled || !Number.isFinite(r?.tarifaKwhBRLCents)) return;
        setTarifaKwhBRLCents(r.tarifaKwhBRLCents);
        setTarifaInputValue((r.tarifaKwhBRLCents / 100).toFixed(2).replace(".", ","));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const saveTarifa = async () => {
    const norm = tarifaInputValue.replace(",", ".").trim();
    const reais = Number(norm);
    if (!Number.isFinite(reais) || reais <= 0 || reais > 1000) {
      alert("Tarifa invalida. Use valor entre R$ 0,01 e R$ 1.000,00.");
      return;
    }
    const cents = Math.round(reais * 100);
    setTarifaSaving(true);
    try {
      const r = await api.patch<{ tarifaKwhBRLCents: number }>("/pool-budgets/solar-tarifa-kwh", { tarifaKwhBRLCents: cents });
      setTarifaKwhBRLCents(r.tarifaKwhBRLCents);
      setShowTarifaPopover(false);
    } catch (err: any) {
      alert(`Erro ao salvar tarifa: ${err?.message ?? err}`);
    } finally {
      setTarifaSaving(false);
    }
  };

  async function recompute(diametroMm?: number | null) {
    if (!hasVazao || !comprimento || comprimento <= 0) { setPipeResult(null); return; }
    setPipeBusy(true);
    try {
      const body: Record<string, unknown> = { comprimentoM: comprimento, desnivelM: desnivel || 0, vazaoM3h: vazaoAlvo };
      if (diametroMm != null) body.diametroMm = diametroMm;
      const res = await api.post<{ result: any }>(`/pool-budgets/${budgetId}/trocador-pipe/recompute`, body);
      setPipeResult(res?.result ?? null);
      // v1.13.57 (Chunk C): o endpoint persiste env.trocadorPipe + recalcula (linha do tubo
      // reflete o novo DN). Marca reload pendente pro orcamento atualizar ao fechar o Simulador.
      onChanged?.();
    } catch { setPipeResult(null); } finally { setPipeBusy(false); }
  }

  // altura = perda de OPERACAO (atrito; circuito fechado, o sifao cancela a carga estatica
  // depois que circula). alturaInercia = desnivel: a bomba precisa VENCER o desnivel pra
  // ROMPER A INERCIA e estabelecer a circulacao (encher a coluna ate o ponto alto). Se a
  // bomba nao alcanca o desnivel, NAO circula — mesmo em circuito fechado. Por isso a SELECAO
  // usa max(atrito, desnivel): a bomba tem que dar conta dos dois (rodar + romper a inercia).
  const altura = Number(pipeResult?.alturaManometricaTotal) || 0;
  const alturaInercia = Number(desnivel) || 0;
  const alturaSelecao = Math.max(altura, alturaInercia);
  useEffect(() => {
    if (!hasVazao || vazaoAlvo <= 0) { setCandidates([]); return; }
    let cancelled = false; setCandLoading(true);
    // maxParalelo=6: inclui bombas menores usaveis com N em paralelo (v1.13.55). Default
    // inteligente: menor bomba que atende SOZINHA (N=1); se nenhuma atende sozinha, a MAIOR
    // (minimiza N). Auto-N = teto(vazaoAlvo / vazaoBomba), clamp [1,6].
    api.get<{ candidates: TrocadorBombaCandidate[] }>(`/pool-budgets/${budgetId}/trocador-bomba-candidates?vazao=${vazaoAlvo}&altura=${alturaSelecao}&vazaoMax=${vazaoMaxTotal}&maxParalelo=6`)
      .then((res) => {
        if (cancelled) return;
        const cs = res?.candidates ?? [];
        setCandidates(cs);
        if (cs.length && !cs.some((c) => c.productId === selBombaId)) {
          const meetsAlone = cs.filter((c) => (c.vazaoM3h || 0) >= vazaoAlvo - 0.01);
          const def = meetsAlone.length ? meetsAlone[0] : [...cs].sort((a, b) => (b.vazaoM3h || 0) - (a.vazaoM3h || 0))[0];
          setSelBombaId(def.productId);
          setSelBombaQty(Math.max(1, Math.min(6, Math.ceil(vazaoAlvo / (def.vazaoM3h || vazaoAlvo)))));
        }
      })
      .catch(() => { if (!cancelled) setCandidates([]); })
      .finally(() => { if (!cancelled) setCandLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId, vazaoAlvo, alturaSelecao, vazaoMaxTotal, hasVazao, ruleVersion]);

  // v1.13.52: persiste a bomba selecionada (default automatico OU escolha manual no dropdown)
  // em environmentParams.trocadorBombaId. Linhas do orcamento com regra "useTrocadorBomba"
  // vinculam direto a esse produto; o endpoint recalcula os totais. onChanged marca reload
  // pendente pro orcamento refletir ao fechar o Simulador.
  // v1.13.59: a chave inclui a vazao de OPERACAO total (ponto de operacao x N) — persiste tambem
  // quando so o pipe muda (mesma bomba/qty, vazao de operacao nova) pro indicador da linha bater.
  const lastPersistedBombaRef = useRef<string>(`${initialBombaId ?? ''}|${Math.max(1, Math.round(Number(initialBombaQty) || 1))}|${(Number(initialVazaoOper) || 0).toFixed(2)}`);
  useEffect(() => {
    if (!selBombaId) return;
    const cand = candidates.find((c) => c.productId === selBombaId);
    // operTotalStr vazio enquanto os candidatos nao carregaram — persiste productId/qty mesmo
    // assim, sem vazaoOperM3h (backend mantem o valor existente). Quando o candidato aparece,
    // re-persiste com a vazao de operacao real (key muda).
    const operTotalStr = cand ? ((cand.vazaoM3h || 0) * selBombaQty).toFixed(2) : '';
    const key = `${selBombaId}|${selBombaQty}|${operTotalStr}`;
    if (key === lastPersistedBombaRef.current) return;
    lastPersistedBombaRef.current = key;
    const body: Record<string, unknown> = { productId: selBombaId, qty: selBombaQty };
    if (cand) body.vazaoOperM3h = Number(operTotalStr);
    api.post(`/pool-budgets/${budgetId}/trocador-bomba-selection`, body)
      .then(() => onChanged?.())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId, selBombaId, selBombaQty, candidates]);

  // v1.13.29: recalcula a tubulacao no 1o acesso (defaults 30/4) pra nao mostrar "preencha".
  // v1.13.57 (Chunk C): com persistencia, recalcula tambem quando o tubo salvo foi dimensionado
  // pra OUTRA vazao (operador trocou a bomba de calor) — evita DN obsoleto alimentando o
  // auto-select. Tubo salvo com a mesma vazao = mantem (sem reescrever).
  useEffect(() => {
    if (!hasVazao || comprimento <= 0) return;
    const savedVazao = Number(initialPipe?.inputs?.vazaoM3h) || 0;
    if (!pipeResult || (savedVazao > 0 && Math.abs(savedVazao - vazaoAlvo) > 0.01)) recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVazao, vazaoAlvo]);

  // v1.13.30: reporta o consumo eletrico anual da bomba de recirculacao pro pai (BombaCalorTab),
  // que soma com o da bomba de calor (Bomba de calor + Recirculacao = Total). ANTES do return
  // antecipado abaixo por causa da regra de hooks. Recalcula o consumo da bomba selecionada.
  useEffect(() => {
    if (!onConsumoChange) return;
    const sb = candidates.find((cc) => cc.productId === selBombaId) ?? candidates[0] ?? null;
    const hMes = Array.isArray(operatingHoursPerMonth) && operatingHoursPerMonth.length === 12 ? operatingHoursPerMonth : null;
    if (!sb || sb.potenciaCv == null || sb.potenciaCv <= 0 || !hMes) { onConsumoChange(null); return; }
    const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const pkW = (sb.potenciaCv * 0.7355) / 0.65;
    let kwhAno = 0;
    for (let i = 0; i < 12; i++) kwhAno += pkW * (Number(hMes[i]) || 0) * MD[i];
    onConsumoChange({ kwhAno: Math.round(kwhAno), custoAnoCents: Math.round(kwhAno * tarifaKwhBRLCents) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, selBombaId, operatingHoursPerMonth, tarifaKwhBRLCents]);

  if (!hasVazao) {
    return (
      <div className="avoid-break">
        <SectionLabel>🚰 Bomba de circulação + tubulação</SectionLabel>
        <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          ⚠ A bomba de calor selecionada não tem <b>vazão de água</b> cadastrada. Preencha a <b>Vazão mínima</b> (e máxima) no cadastro do produto (aba Piscina · aquecimentos) para dimensionar a bomba de circulação e os tubos.
        </div>
      </div>
    );
  }

  const velAlta = (pipeResult?.velocidade ?? 0) >= 2.5;
  const dns: number[] = pipeResult?.availableDiametersMm ?? [32, 40, 50, 60, 75];
  const dnAtual = pipeResult?.diametroDnMm ?? dns.find((d) => d >= 50) ?? dns[0];
  const selB = candidates.find((c) => c.productId === selBombaId) ?? candidates[0] ?? null;

  // Consumo eletrico mensal da bomba de circulacao (paridade com o Solar). A bomba roda
  // JUNTO com a bomba de calor, entao usa as HORAS REAIS de operacao por mes (demanda-
  // dirigida, vindas do backend em operatingHoursPerMonth): inverno mais, verao menos,
  // e bomba de calor mais potente -> menos horas. P_eletrica_kW = cv × 0.7355 / 0.65
  // (rendimento medio, MESMA constante do Solar — RENDIMENTO_BOMBA_MEDIO). Consumo medio
  // mensal = (Σ P × horas_mes × dias_mes) / 12, mesmo padrao do Solar (anual / 12).
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const horasMesArr = Array.isArray(operatingHoursPerMonth) && operatingHoursPerMonth.length === 12
    ? operatingHoursPerMonth
    : null;
  const consumo = selB && selB.potenciaCv != null && selB.potenciaCv > 0 && horasMesArr
    ? (() => {
        const potenciaKW = (selB.potenciaCv * 0.7355) / 0.65;
        let kwhAno = 0;
        const horasAtivas: number[] = [];
        for (let i = 0; i < 12; i++) {
          const h = Number(horasMesArr[i]) || 0;
          kwhAno += potenciaKW * h * MONTH_DAYS[i];
          if (h > 0) horasAtivas.push(h);
        }
        const kwhMes = kwhAno / 12;
        const custoMesCents = kwhMes * tarifaKwhBRLCents;
        const horasDiaMedio = Number(operatingHoursPerDayAvg) > 0
          ? Number(operatingHoursPerDayAvg)
          : (horasAtivas.length ? horasAtivas.reduce((s, h) => s + h, 0) / horasAtivas.length : 0);
        const horasMin = horasAtivas.length ? Math.min(...horasAtivas) : 0;
        const horasMax = horasAtivas.length ? Math.max(...horasAtivas) : 0;
        return { potenciaKW, kwhMes, custoMesCents, horasDiaMedio, horasMin, horasMax };
      })()
    : null;

  return (
    <div className="avoid-break" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* TUBULAÇÃO — card V1 ambar compacto (label + mca no topo, comp/desnív/tubo numa linha) */}
      <div style={{ border: `1px solid ${velAlta ? "#fca5a5" : "#fcd34d"}`, borderRadius: 8, background: velAlta ? "#fef2f2" : "#fffbeb", padding: "5px 8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".07em", color: velAlta ? "#b91c1c" : "#92400e", fontWeight: 700 }}>Tubulação — perda de carga</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: velAlta ? "#b91c1c" : "#78350f" }} className="num" title="Maior entre o atrito (operação) e o desnível (romper a inércia pra começar a circular). A bomba precisa produzir pelo menos isto.">{pipeResult ? alturaSelecao.toFixed(2) : "—"} <span style={{ fontSize: 8.5, fontWeight: 700 }}>mca</span></div>
        </div>
        {pipeResult ? (
          <div style={{ fontSize: 8.5, color: velAlta ? "#b91c1c" : "#92400e", marginTop: 1 }}>= {pipeResult.perdaDinamica?.toFixed(2)} mca de atrito · circuito fechado{desnivel > 0 ? ` — opera no atrito, mas vence ${desnivel} m pra romper a inércia` : ""} · vel. {pipeResult.velocidade?.toFixed(2)} m/s</div>
        ) : (
          <div style={{ fontSize: 8.5, color: "#92400e", marginTop: 1, fontStyle: "italic" }}>{pipeBusy ? "Calculando…" : "Preencha comprimento + desnível para escolher o tubo."}</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: "#92400e", display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "#a16207", fontWeight: 700 }}>Comp.</span><input className="ds-edit num" type="number" step="0.5" min={0} value={comprimento || ""} onChange={(e) => setComprimento(Number(e.target.value) || 0)} onBlur={() => recompute()} placeholder="30" style={{ width: 32, border: "1px solid #fcd34d", borderRadius: 3, background: "#fff", fontSize: 9, fontWeight: 700, color: "#78350f", padding: "0 2px", textAlign: "center", fontFamily: "inherit" }} /><b className="ds-print num" style={{ color: "#78350f" }}>{comprimento}</b> m</span>
          <span style={{ fontSize: 9, color: "#92400e", display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "#a16207", fontWeight: 700 }}>Desnív.</span><input className="ds-edit num" type="number" step="0.5" min={0} value={desnivel || ""} onChange={(e) => setDesnivel(Number(e.target.value) || 0)} onBlur={() => recompute()} placeholder="2" style={{ width: 32, border: "1px solid #fcd34d", borderRadius: 3, background: "#fff", fontSize: 9, fontWeight: 700, color: "#78350f", padding: "0 2px", textAlign: "center", fontFamily: "inherit" }} /><b className="ds-print num" style={{ color: "#78350f" }}>{desnivel}</b> m</span>
          {pipeResult ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}><b style={{ color: "#92400e", fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>Tubo de {pipeResult.material ?? "PVC"}:</b><select className="ds-edit num" value={dnAtual} onChange={(e) => recompute(Number(e.target.value))} style={{ fontSize: 10.5, fontWeight: 700, color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, background: "#fff", padding: "0 2px", fontFamily: "inherit" }}>{dns.map((d) => <option key={d} value={d}>{d} mm DN</option>)}</select><b className="ds-print num" style={{ fontSize: 10.5, color: "#78350f" }}>{dnAtual} mm DN</b>{pipeResult.diametroAutoPicked ? <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "#047857", background: "#d1fae5", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>auto</span> : <button type="button" className="ds-edit" onClick={() => recompute(null)} style={{ fontSize: 9, textDecoration: "underline", color: "#64748b", background: "none", border: 0, cursor: "pointer" }}>↺ auto</button>}</span>
          ) : <span />}
        </div>
        {velAlta && <div style={{ marginTop: 4, borderRadius: 4, background: "#fee2e2", border: "1px solid #fca5a5", padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#b91c1c", textAlign: "center" }}>⚠ Velocidade {pipeResult?.velocidade?.toFixed(2)} m/s acima de 2,5 — aumente o diâmetro</div>}
      </div>
      {/* BOMBA DE CIRCULAÇÃO — card V1 compacto (img 64px + specs 2col + consumo) */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: "5px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748b", fontWeight: 700 }}>Bomba de circulação recomendada</div>
          {onOpenRulePicker && (<button type="button" className="ds-edit" onClick={onOpenRulePicker} title="Configurar a regra de seleção da bomba de circulação — INDEPENDENTE do Solar (mesma fórmula). Sem regra própria, cai pra a do Solar." style={{ fontSize: 11, fontWeight: 700, padding: "0 5px", borderRadius: 4, border: "1px solid #e2e8f0", color: "#94a3b8", background: "#fff", cursor: "pointer" }}>✨</button>)}
        </div>
        {candidates.length === 0 ? (
          <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.3 }}>{candLoading ? "Carregando candidatos…" : `Nenhuma bomba do catálogo atende vazão ≥ ${vazaoAlvo} m³/h${alturaSelecao > 0 ? ` e ${alturaSelecao.toFixed(1)} mca (atrito + romper a inércia)` : ""}. Configure a regra no ✨.`}</div>
        ) : (
          <>
            <select className="ds-edit num" value={selBombaId ?? ""} onChange={(e) => { const id = e.target.value || null; setSelBombaId(id); const p = candidates.find((c) => c.productId === id); if (p) setSelBombaQty(Math.max(1, Math.min(6, Math.ceil(vazaoAlvo / (p.vazaoM3h || vazaoAlvo))))); }} style={{ width: "100%", borderRadius: 4, border: "1px solid #cbd5e1", background: "#fffbeb", padding: "2px 6px", fontSize: 10.5, fontWeight: 600, marginBottom: 4, fontFamily: "inherit" }}>
              {candidates.map((c) => { const parts = [c.description]; if (c.potenciaCv != null) parts.push(`${c.potenciaCv} cv`); parts.push(`${c.vazaoM3h.toFixed(1)} m³/h`); parts.push(`${c.pressaoTrabalhoMca.toFixed(1)} mca`); if (c.hasPumpCurve) parts.push("📈 curva"); return <option key={c.productId} value={c.productId}>{parts.join(" · ")}</option>; })}
            </select>
            {selB && (() => {
              const totalVazao = (selB.vazaoM3h || 0) * selBombaQty;
              const ok = totalVazao >= vazaoAlvo - 0.01;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "#64748b", fontWeight: 700 }}>Quant.</span>
                  <input className="ds-edit num" type="number" min={1} max={6} value={selBombaQty} onChange={(e) => setSelBombaQty(Math.max(1, Math.min(6, Math.round(Number(e.target.value) || 1))))} style={{ width: 36, border: "1px solid #cbd5e1", borderRadius: 4, padding: "1px 4px", fontSize: 10.5, fontWeight: 700, textAlign: "center", fontFamily: "inherit" }} />
                  <b className="ds-print num" style={{ fontSize: 10.5 }}>{selBombaQty}×</b>
                  {selBombaQty > 1 && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 3, padding: "1px 5px" }}>⚡ {selBombaQty}× em paralelo</span>}
                  <span style={{ fontSize: 9, fontWeight: 700, color: ok ? "#059669" : "#dc2626" }} className="num">Vazão total {totalVazao.toFixed(1)} m³/h {ok ? "≥" : "<"} {vazaoAlvo.toFixed(1)} alvo</span>
                </div>
              );
            })()}
            {selB && ((vazaoMaxTotal > 0 && selB.vazaoM3h > vazaoMaxTotal) || (alturaInercia > 0 && selB.pressaoTrabalhoMca < alturaInercia) || (altura > 0 && selB.pressaoTrabalhoMca < altura)) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 9.5, marginBottom: 3 }}>
                {vazaoMaxTotal > 0 && selB.vazaoM3h > vazaoMaxTotal && <span style={{ color: "#d97706", fontWeight: 600 }}>⚠ acima da vazão máx ({vazaoMaxTotal})</span>}
                {alturaInercia > 0 && selB.pressaoTrabalhoMca < alturaInercia && <span style={{ color: "#dc2626", fontWeight: 600 }}>⚠ não rompe a inércia: {selB.pressaoTrabalhoMca.toFixed(1)} mca &lt; desnível {alturaInercia.toFixed(1)} m</span>}
                {altura > 0 && selB.pressaoTrabalhoMca < altura && <span style={{ color: "#dc2626", fontWeight: 600 }}>⚠ pressão &lt; atrito {altura.toFixed(1)} mca</span>}
              </div>
            )}
            {selB && (
              <div style={{ display: "flex", gap: 9, alignItems: "stretch" }}>
                <div style={{ width: 64, flexShrink: 0, border: "1px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {selB.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selB.imageUrl} alt={selB.description} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : <span style={{ fontSize: 8, color: "#94a3b8" }}>Sem img</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.15 }}>{selB.description}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 12px", marginTop: 3, fontSize: 9, color: "#334155" }}>
                    {selB.potenciaCv != null && <div><span style={{ color: "#64748b" }}>Potência</span> <b className="num">{selB.potenciaCv} cv</b></div>}
                    <div><span style={{ color: "#64748b" }}>Vazão</span> <b className="num">{selB.vazaoM3h.toFixed(2)} m³/h</b></div>
                    <div><span style={{ color: "#64748b" }}>Pressão</span> <b className="num">{selB.pressaoTrabalhoMca.toFixed(2)} mca</b></div>
                    {selB.hasPumpCurve && <div style={{ color: "#047857", fontWeight: 700 }}>📈 com curva característica</div>}
                    {selB.indicator && (
                      <div style={{ gridColumn: "1 / -1", fontWeight: 700, color: selB.indicator.color === 'emerald' ? '#059669' : selB.indicator.color === 'green' ? '#16a34a' : selB.indicator.color === 'lime' ? '#65a30d' : selB.indicator.color === 'yellow' ? '#ca8a04' : selB.indicator.color === 'orange' ? '#f97316' : selB.indicator.color === 'amber' ? '#d97706' : selB.indicator.color === 'red' ? '#dc2626' : '#334155' }}>
                        {(() => { const v = selB.indicator.value; const decimals = Math.abs(v) < 10 ? 1 : 0; const formatted = v.toFixed(decimals).replace('.', ','); const group = selB.indicator.groupLabel || 'Dimensionamento'; return `${group}: ${formatted}${selB.indicator.unit} (${selB.indicator.label})`; })()}
                      </div>
                    )}
                  </div>
                  {consumo ? (
                    <div style={{ marginTop: 4, paddingTop: 3, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 9, color: "#334155" }}><span style={{ color: "#64748b" }}>⚡ Consumo</span> <b className="num" style={{ fontSize: 11 }}>{consumo.kwhMes.toFixed(0)}</b> <span style={{ fontSize: 8, color: "#64748b" }}>kWh/mês</span> <span style={{ fontSize: 8, color: "#94a3b8" }} title={`Média ${consumo.horasDiaMedio.toFixed(1)} h/dia, varia ${consumo.horasMin.toFixed(1)}–${consumo.horasMax.toFixed(1)} h/dia. P = ${selB.potenciaCv} cv × 0,7355 / 0,65 = ${consumo.potenciaKW.toFixed(2)} kW. Média anual / 12.`}>({consumo.horasDiaMedio.toFixed(1)}h/dia · {consumo.potenciaKW.toFixed(2)} kW)</span></div>
                      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }} className="num">R$ {(consumo.custoMesCents / 100).toFixed(2)}<span style={{ fontSize: 8, color: "#d97706" }}>/mês</span></div>
                        <button type="button" className="ds-edit" onClick={() => { setTarifaInputValue((tarifaKwhBRLCents / 100).toFixed(2).replace(".", ",")); setShowTarifaPopover((v) => !v); }} title={`Tarifa atual: R$ ${(tarifaKwhBRLCents / 100).toFixed(2)}/kWh.`} style={{ fontSize: 9, fontWeight: 700, padding: "0 4px", borderRadius: 4, border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", cursor: "pointer" }}>💡</button>
                        {showTarifaPopover && (
                          <div className="ds-edit" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 20, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.12)", padding: 10, width: 220 }}>
                            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".05em", color: "#475569", fontWeight: 700, marginBottom: 5 }}>Tarifa de energia (R$/kWh)</div>
                            <input type="text" value={tarifaInputValue} onChange={(e) => setTarifaInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveTarifa(); if (e.key === "Escape") setShowTarifaPopover(false); }} autoFocus placeholder="0,95" style={{ width: "100%", borderRadius: 4, border: "1px solid #cbd5e1", padding: "4px 6px", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }} />
                            <div style={{ fontSize: 8.5, color: "#64748b", marginTop: 3 }}>Tarifa aplicada a todos os orcamentos do tenant.</div>
                            <div style={{ marginTop: 6, display: "flex", gap: 5, justifyContent: "flex-end" }}>
                              <button type="button" onClick={() => setShowTarifaPopover(false)} disabled={tarifaSaving} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}>Cancelar</button>
                              <button type="button" onClick={saveTarifa} disabled={tarifaSaving} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "#d97706", color: "#fff", fontWeight: 700, border: 0, cursor: "pointer" }}>{tarifaSaving ? "Salvando..." : "Salvar"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 4, paddingTop: 3, borderTop: "1px solid #f1f5f9", fontSize: 9, color: "#94a3b8" }}>{selB && selB.potenciaCv != null && selB.potenciaCv > 0 ? "Estimando as horas de operação…" : "Cadastre a potência (cv) da bomba para o consumo elétrico."}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
    <div className={`rounded px-1.5 py-0.5 border leading-tight flex flex-col justify-center ${colors.border} ${colors.bg}`} style={{ height: '32px' }}>
      <div className={`text-[7.5px] uppercase tracking-wide ${colors.labelText} font-semibold leading-[1.05]`}>{label}</div>
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
function ConfigFieldBig({ label, children, manual, hint }: { label: string; children: React.ReactNode; manual?: boolean; hint?: string }) {
  const colors = manual
    ? { border: "border-emerald-300", bg: "bg-emerald-50", label: "text-emerald-700" }
    : { border: "border-slate-200", bg: "bg-white", label: "text-slate-500" };
  return (
    <div className={`rounded border px-1.5 py-0.5 leading-tight overflow-hidden flex flex-col justify-center ${colors.border} ${colors.bg}`} style={{ height: '32px' }}>
      <div className={`flex items-center gap-0.5 text-[7px] uppercase tracking-tight font-semibold leading-[1.05] ${colors.label}`} title={label}>{label}{hint && <HelpHint text={hint} width={300} />}</div>
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
    <div className={`rounded border border-slate-200 bg-white px-1.5 py-0.5 leading-tight overflow-hidden flex flex-col justify-center ${fullWidth ? "w-full" : ""}`} style={{ height: '32px' }}>
      <div className="text-[7px] uppercase tracking-tight text-slate-500 font-semibold leading-[1.05]" title={label}>{label}</div>
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
    <div className={`rounded border ${colors.border} ${colors.bg} px-1.5 py-0.5 flex flex-col justify-center overflow-hidden`} style={{ height: '32px' }}>
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
  // Exibe no maximo 2 casas (area/volume nao precisam de mais — evita "57,52000000" / float noise).
  const shown = Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
  return (
    <div className={`rounded border ${colors.border} ${colors.bg} px-1.5 py-0.5 flex flex-col justify-center overflow-hidden`} style={{ height: '32px' }}>
      <div className={`text-[8px] uppercase tracking-wide ${colors.labelText} font-semibold leading-tight`}>{label}</div>
      <div className="flex items-baseline gap-1 leading-tight">
        <input type="number" min={min} max={max} value={shown}
          onChange={(e) => onChange(Number(e.target.value) || min)}
          disabled={!manual}
          className={`bg-transparent text-[13px] font-bold ${colors.valueText} tabular-nums leading-none focus:outline-none w-full min-w-0 print:hidden disabled:cursor-not-allowed`}
          style={{ height: '14px', padding: 0, margin: 0, border: 0, minHeight: 0 }} />
        <span className={`hidden print:inline-block text-[13px] font-bold ${colors.valueText} tabular-nums leading-none`}>{shown}</span>
        <span className={`text-[9.5px] font-semibold ${colors.unitText}`}>{unit}</span>
      </div>
    </div>
  );
}

// v1.12.58: diagrama compacto + coletores VISUAIS dentro de cada bateria.
//  - Cada bateria renderiza N retangulos verdes (placas solares) lado a lado
//  - Container 140px (era 220px): 95% dos casos tem ≤3 baterias, espaco sobrando
//  - SVG escala uniformemente: 1-2 baterias ocupam o espaco todo, 10+ ficam pequenas
function BatteryDiagram({
  numRamos, batPorRamo, coletoresPorBateria,
}: {
  numRamos: number;
  batPorRamo: number;
  coletoresPorBateria: number;
}) {
  if (numRamos <= 0 || batPorRamo <= 0) return null;
  // Dimensoes das placas solares dentro da bateria
  const colW = 8;
  const colH = 24;
  const colGap = 2;
  const batPadX = 6;
  const batPadY = 6;
  const batW = batPadX * 2 + coletoresPorBateria * colW + Math.max(0, coletoresPorBateria - 1) * colGap;
  const batH = batPadY * 2 + colH + 10; // +10 pro label "5 col." embaixo
  const gapH = 18; // entre baterias em serie (horizontal)
  const gapV = 14; // entre ramos (vertical)
  const padLeft = 44;
  const padRight = 44;
  const padTop = 8;
  const padBottom = 18; // pros labels ALIM/RET
  const svgW = padLeft + batPorRamo * batW + Math.max(0, batPorRamo - 1) * gapH + padRight;
  const svgH = padTop + numRamos * batH + Math.max(0, numRamos - 1) * gapV + padBottom;
  const trunkXIn = padLeft - 18;
  const trunkXOut = svgW - padRight + 18;
  const trunkYTop = padTop + batH / 2;
  const trunkYBot = svgH - padBottom - batH / 2;
  const showTroncos = numRamos > 1;
  return (
    <div className="w-full" style={{ height: 140 }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
        {/* Tronco vertical de alimentacao (azul, esquerda) */}
        {showTroncos && (
          <line x1={trunkXIn} y1={trunkYTop} x2={trunkXIn} y2={trunkYBot} stroke="#0284c7" strokeWidth={2.5} strokeLinecap="round" />
        )}
        {/* Tronco vertical de retorno (vermelho, direita) */}
        {showTroncos && (
          <line x1={trunkXOut} y1={trunkYTop} x2={trunkXOut} y2={trunkYBot} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
        )}
        {/* "Pé" da alimentacao descendo pra label ALIMENTACAO */}
        <line x1={trunkXIn} y1={trunkYBot} x2={trunkXIn} y2={svgH - 10} stroke="#0284c7" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={trunkXOut} y1={trunkYBot} x2={trunkXOut} y2={svgH - 10} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />

        {/* Ramos (linhas horizontais) */}
        {Array.from({ length: numRamos }).map((_, r) => {
          const yMid = padTop + r * (batH + gapV) + batH / 2;
          const xFirst = padLeft;
          const xLast = padLeft + batPorRamo * batW + Math.max(0, batPorRamo - 1) * gapH;
          return (
            <g key={r}>
              <line x1={trunkXIn} y1={yMid} x2={xFirst} y2={yMid} stroke="#0284c7" strokeWidth={2} strokeLinecap="round" />
              <line x1={xLast} y1={yMid} x2={trunkXOut} y2={yMid} stroke="#dc2626" strokeWidth={2} strokeLinecap="round" />
              {Array.from({ length: batPorRamo }).map((__, b) => {
                const x = padLeft + b * (batW + gapH);
                const yTop = yMid - batH / 2;
                return (
                  <g key={b}>
                    {/* Caixa da bateria (amarela) */}
                    <rect x={x} y={yTop} width={batW} height={batH} rx={3} ry={3} fill="#fef3c7" stroke="#d97706" strokeWidth={1.2} />
                    {/* v1.12.60: coletor solar de piscina realista (estilo Solis Trópicos):
                        - Corpo preto polipropileno
                        - Cabeçotes superior/inferior espessos (tubos coletores)
                        - 8 mangueiras verticais paralelas finas (estrias)
                        - Highlight sutil pra efeito 3D */}
                    {Array.from({ length: coletoresPorBateria }).map((___, c) => {
                      const colX = x + batPadX + c * (colW + colGap);
                      const colY = yTop + batPadY;
                      const cabHeadH = 2.4; // espessura dos cabeçotes (tubos coletores)
                      const numMangueiras = 8;
                      return (
                        <g key={c}>
                          {/* Corpo preto do coletor (entre os cabeçotes) */}
                          <rect x={colX} y={colY + cabHeadH - 0.3} width={colW} height={colH - 2 * cabHeadH + 0.6} fill="#0a0a0a" />
                          {/* Estrias verticais (mangueiras paralelas) — linhas claras sobre fundo preto */}
                          {Array.from({ length: numMangueiras }).map((____, m) => {
                            const mx = colX + 0.5 + (m + 0.5) * ((colW - 1) / numMangueiras);
                            return (
                              <line key={m}
                                x1={mx} y1={colY + cabHeadH}
                                x2={mx} y2={colY + colH - cabHeadH}
                                stroke="#1f2937" strokeWidth={0.25} strokeLinecap="round" />
                            );
                          })}
                          {/* Cabeçote superior (tubo coletor preto com leve highlight) */}
                          <rect x={colX - 0.3} y={colY} width={colW + 0.6} height={cabHeadH} rx={0.6} ry={0.6} fill="#171717" stroke="#000" strokeWidth={0.35} />
                          <line x1={colX} y1={colY + 0.4} x2={colX + colW} y2={colY + 0.4} stroke="#3f3f46" strokeWidth={0.3} strokeLinecap="round" />
                          {/* Cabeçote inferior (idem) */}
                          <rect x={colX - 0.3} y={colY + colH - cabHeadH} width={colW + 0.6} height={cabHeadH} rx={0.6} ry={0.6} fill="#171717" stroke="#000" strokeWidth={0.35} />
                          <line x1={colX} y1={colY + colH - cabHeadH + 0.4} x2={colX + colW} y2={colY + colH - cabHeadH + 0.4} stroke="#3f3f46" strokeWidth={0.3} strokeLinecap="round" />
                          {/* Borda externa do coletor */}
                          <rect x={colX - 0.3} y={colY} width={colW + 0.6} height={colH} rx={0.6} ry={0.6} fill="none" stroke="#000" strokeWidth={0.5} />
                        </g>
                      );
                    })}
                    {/* Label "5 col." abaixo das placas, dentro da caixa */}
                    <text x={x + batW / 2} y={yTop + batH - 3} fontSize={7.5} fontWeight={800} fill="#78350f" textAnchor="middle" className="tabular-nums">{coletoresPorBateria} col.</text>
                    {/* Conexao serial cinza tracejada entre baterias do ramo */}
                    {b < batPorRamo - 1 && (
                      <line x1={x + batW} y1={yMid} x2={x + batW + gapH} y2={yMid} stroke="#64748b" strokeWidth={2} strokeDasharray="3 2" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Labels ALIMENTACAO e RETORNO */}
        <text x={trunkXIn - 3} y={svgH - 2} fontSize={5.5} fontWeight={800} fill="#0369a1" textAnchor="start" className="uppercase tracking-wider">Alimentação</text>
        <text x={trunkXOut + 3} y={svgH - 2} fontSize={5.5} fontWeight={800} fill="#b91c1c" textAnchor="end" className="uppercase tracking-wider">Retorno</text>
      </svg>
    </div>
  );
}

// Kpi padronizado com o estilo de StatCompact. v1.12.55: super compacto.
function Kpi({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`rounded px-1.5 py-0.5 border flex items-baseline justify-between gap-1 ${accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <span className="text-[8px] uppercase tracking-wide text-slate-500 font-semibold leading-tight">{label}</span>
      <span className={`tabular-nums font-bold leading-tight ${accent ? "text-amber-800" : "text-slate-900"}`}>
        <span className="text-[11px]">{value}</span>
        <span className={`text-[8.5px] font-medium ml-0.5 ${accent ? "text-amber-700" : "text-slate-500"}`}>{unit}</span>
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
    <div className="relative border border-slate-200 rounded overflow-hidden bg-slate-50 aspect-square w-full flex items-center justify-center print:bg-white print:aspect-auto print:h-[52mm]">
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
    // v1.12.73: no print, altura compacta (~60mm) pra evitar espaco em branco
    // sobrando abaixo do card que empurra conteudo pra pagina 2.
    <div className="border border-slate-200 rounded bg-white p-2 print:p-1 print:border-slate-300 flex-1 flex flex-col print:max-h-[62mm]">
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
