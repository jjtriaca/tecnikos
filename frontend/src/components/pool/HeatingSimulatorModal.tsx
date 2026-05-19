"use client";
// Simulador de Aquecimento (Solar / Bomba de Calor).
// Modal full-screen com abas. Ordem: Solar | Bomba de Calor | Comparativo.
// Ver memory/project_heating_simulator_plan.md pra contexto.

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

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
}

interface Props {
  budget: BudgetForHeating;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
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
  tempFinal2d: number;
  tempFinal3d: number;
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
}

type TabKey = "solar" | "bomba" | "comparativo";

export function HeatingSimulatorModal({ budget, open, onClose, onSaved }: Props) {
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
  const [solarExtraPct, setSolarExtraPct] = useState(0);
  const [solarSelectedCollectorId, setSolarSelectedCollectorId] = useState<string | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(5); // Junho default (mes critico)

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
    setSolarLoading(true);
    api.get<SolarReport | null>(`/pool-budgets/${budget.id}/solar-report`)
      .then((r) => setSolarReport(r))
      .catch(() => setSolarReport(null))
      .finally(() => setSolarLoading(false));
  }, [open, budget.id, budget.environmentParams]);

  // Recompute solar — chamado quando o operador muda coletor/extra/temp ou clica botao
  async function recomputeSolar(extraPct?: number, collectorId?: string | null) {
    setSolarRecomputing(true);
    setError(null);
    try {
      const body: { extraColetoresPct?: number; collectorProductId?: string; tempDesejada?: number } = {
        extraColetoresPct: extraPct ?? solarExtraPct,
        tempDesejada: Number(tempAguaDesejada),
      };
      const cid = collectorId === undefined ? solarSelectedCollectorId : collectorId;
      if (cid) body.collectorProductId = cid;
      const r = await api.post<SolarReport>(`/pool-budgets/${budget.id}/solar-report/recompute`, body);
      setSolarReport(r);
      onSaved?.();
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">🔥 Simulador de Aquecimento</h2>
            <p className="text-xs text-slate-600 truncate">
              <span className="font-mono">{budget.code || "—"}</span> · {budget.clientPartner?.name || "—"} · {budget.title}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Calculo Rapido */}
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 cursor-pointer transition">
              <input type="checkbox" checked={quickMode} onChange={(e) => setQuickMode(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
              <span className="text-xs font-semibold text-amber-900">⚡ Calculo rapido</span>
            </label>
            <button onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition">
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
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
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
                      <BigStat label="Consumo anual" value={(report.annualKwh ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} unit="kWh/ano" emphasis="cyan" />
                      <BigStat label="Custo medio mensal" value={fmtBRL(Math.round((report.annualCostBRLCents ?? 0) / 12))} unit="por mes" emphasis="orange" />
                      <BigStat label="Custo anual operacao" value={fmtBRL(report.annualCostBRLCents ?? 0)} unit="por ano" emphasis="orange" />
                      <BigStat label="Custo aquec. inicial" value={fmtBRL(report.initialHeatingCostBRLCents ?? 0)} unit="1a vez" emphasis="emerald" />
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

// ============ Aba Solar (Fase 5) ============

function SolarTab({
  budget, report, loading, recomputing, collectors,
  extraPct, setExtraPct, selectedCollectorId, setSelectedCollectorId,
  selectedMonthIdx, setSelectedMonthIdx,
  uf, cidade, setUf, setCidade, availableUfs, availableCities,
  capaTermica, setCapaTermica, vento, setVento,
  tempAguaDesejada, setTempAguaDesejada,
  onRecompute,
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
  onRecompute: (extraPct?: number, collectorId?: string | null) => void | Promise<void>;
}) {
  const dims = budget.poolDimensions ?? {};
  const area = Number(dims.area) || 0;
  const volume = Number(dims.volume) || 0;

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando dados solares...</div>;
  }

  const selectedMonth = report?.monthly?.[selectedMonthIdx];

  return (
    <div className="space-y-4">
      {/* === 1. Dados do projeto === */}
      <Section title="1. Dados do projeto" icon="🏊">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <ReadField label="Cliente" value={budget.clientPartner?.name ?? "—"} />
          <ReadField label="Codigo" value={budget.code ?? "—"} />
          <ReadField label="Area piscina" value={`${area.toFixed(2)} m²`} />
          <ReadField label="Volume" value={`${volume.toFixed(2)} m³`} />
        </div>
      </Section>

      {/* === 2. Localizacao e clima === */}
      <Section title="2. Localizacao e clima" icon="📍">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="UF">
            <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— Selecione —</option>
              {availableUfs.map((u) => <option key={u.uf} value={u.uf}>{u.uf} · {u.ufName}</option>)}
            </select>
          </Field>
          <Field label="Cidade">
            <select value={cidade} onChange={(e) => setCidade(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={!uf}>
              <option value="">{uf ? "Padrao do estado" : "Selecione UF primeiro"}</option>
              {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Edite valores em <a href="/settings/climate-data" className="text-cyan-700 underline">Configuracoes → Dados Climaticos</a> pra ajustar radiacao solar / temperatura mensal.
        </div>
      </Section>

      {/* === 3. Dados de aquecimento === */}
      <Section title="3. Dados de aquecimento" icon="🔥">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Temperatura final desejada (°C)" hint="20 a 40°C — recomendado 28-32°C">
            <NumInput value={tempAguaDesejada} onChange={setTempAguaDesejada} step={1} min={20} max={40} />
          </Field>
          <Field label="Capa termica">
            <select value={capaTermica ? "SIM" : "NAO"} onChange={(e) => setCapaTermica(e.target.value === "SIM")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="SIM">SIM (recomendado)</option>
              <option value="NAO">NAO (precisa 80% mais coletor)</option>
            </select>
          </Field>
          <Field label="Vento">
            <select value={vento} onChange={(e) => setVento(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="FRACO">Fraco</option>
              <option value="MODERADO">Moderado</option>
              <option value="FORTE">Forte</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* === 4. Selecao do coletor === */}
      <Section title="4. Coletor selecionado" icon="☀️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Modelo do coletor" hint={collectors.length === 0 ? "Cadastre produtos com tipoEquipamento=SOLAR" : `${collectors.length} modelo(s) disponivel(eis)`}>
            <select value={selectedCollectorId ?? ""} onChange={(e) => setSelectedCollectorId(e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— Padrao (Solis 4.00) —</option>
              {collectors.map((c) => (
                <option key={c.productId} value={c.productId}>
                  {c.modelName} · {c.areaM2.toFixed(2)} m² · η {(c.eficiencia * 100).toFixed(1)}%
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Extra coletores: +${(extraPct * 10).toFixed(0)}% (J42 da planilha)`} hint="Aumenta a area de coletor pra maior eficiencia / dias frios">
            <input type="range" min={0} max={10} step={1} value={extraPct}
              onChange={(e) => setExtraPct(Number(e.target.value))}
              className="w-full" />
            <div className="text-[10px] text-slate-500 mt-1">0 = minimo, 10 = +100% (dobro de coletores)</div>
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={() => onRecompute()}
            disabled={recomputing || !uf}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:bg-slate-300 transition">
            {recomputing ? "Recalculando..." : "☀️ Recalcular dimensionamento"}
          </button>
        </div>
      </Section>

      {/* === 5. Dimensionamento === */}
      {report ? (
        <>
          <Section title="5. Dimensionamento" icon="📐">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <BigStat label="m² coletor necessario" value={report.m2ColetorNecessario.toFixed(1)} unit="m²" emphasis="orange" />
              <BigStat label="Qtd coletores" value={String(report.qtdColetores)} unit="un" emphasis="cyan" />
              <BigStat label="Num baterias" value={String(report.numBaterias)} unit="bat" emphasis="emerald" />
              <BigStat label="Vazao total" value={report.vazaoTotalM3h.toFixed(2)} unit="m³/h" emphasis="cyan" />
              <BigStat label="m² total coletores" value={report.areaTotalColetoresM2.toFixed(2)} unit="m²" emphasis="emerald" />
              <BigStat label="% area piscina" value={report.percentualCobertura.toFixed(1)} unit="%" emphasis="orange" />
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <strong>{report.coletoresPorBateria}</strong> coletores por bateria · <strong>{report.selectedCollector.modelName}</strong> ({report.selectedCollector.areaM2.toFixed(2)} m²/un)
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                Capacidade total: <strong>{report.selectedCollector.kcalHTotal.toLocaleString("pt-BR")}</strong> kcal/h · η <strong>{(report.selectedCollector.eficiencia * 100).toFixed(1)}%</strong>
              </div>
            </div>
          </Section>

          {/* === 6. Tabela mensal === */}
          <Section title="6. Manutencao da temperatura (12 meses)" icon="📅">
            <div className="overflow-x-auto">
              <table className="text-xs tabular-nums w-full">
                <thead>
                  <tr className="text-slate-600 border-b border-slate-200">
                    <th className="text-left p-1.5 font-semibold">Mes</th>
                    <th className="text-right p-1.5 font-semibold" title="Temp ambiente media">T amb °C</th>
                    <th className="text-right p-1.5 font-semibold" title="Radiacao solar diaria">RadSol kWh</th>
                    <th className="text-right p-1.5 font-semibold" title="Ganho de temperatura por dia ensolarado">Ganho/dia °C</th>
                    <th className="text-right p-1.5 font-semibold" title="Perda noturna estimada">Perda/noite °C</th>
                    <th className="text-right p-1.5 font-semibold">T fim 1°dia</th>
                    <th className="text-right p-1.5 font-semibold">T fim 2°dia</th>
                    <th className="text-right p-1.5 font-semibold">T fim 3°dia</th>
                    <th className="text-right p-1.5 font-semibold">T fim 4°dia</th>
                  </tr>
                </thead>
                <tbody>
                  {report.monthly.map((r) => {
                    const cold = r.tempFinal4d < tempAguaDesejada - 2;
                    return (
                      <tr key={r.monthIndex}
                        className={`border-b border-slate-100 cursor-pointer hover:bg-amber-50 ${selectedMonthIdx === r.monthIndex ? "bg-amber-100" : ""}`}
                        onClick={() => setSelectedMonthIdx(r.monthIndex)}>
                        <td className="p-1.5 font-semibold">{r.monthName}</td>
                        <td className="p-1.5 text-right">{r.tempAmbiente.toFixed(1)}</td>
                        <td className="p-1.5 text-right">{r.radSol.toFixed(1)}</td>
                        <td className="p-1.5 text-right text-emerald-700">{r.ganhoDia.toFixed(2)}</td>
                        <td className="p-1.5 text-right text-rose-600">{r.perdaCorrigidaPorDia.toFixed(2)}</td>
                        <td className="p-1.5 text-right">{r.tempFinal1d.toFixed(1)}</td>
                        <td className="p-1.5 text-right">{r.tempFinal2d.toFixed(1)}</td>
                        <td className="p-1.5 text-right">{r.tempFinal3d.toFixed(1)}</td>
                        <td className={`p-1.5 text-right font-bold ${cold ? "text-rose-700" : "text-emerald-700"}`}>
                          {r.tempFinal4d.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <SmallStat label="Ganho medio" value={`${report.monthlyAvgGanho.toFixed(2)} °C/dia`} />
              <SmallStat label="Pior mes (4° dia)" value={`${report.monthlyMinTempFinal.toFixed(1)} °C`} />
              <SmallStat label="Melhor mes (4° dia)" value={`${report.monthlyMaxTempFinal.toFixed(1)} °C`} />
            </div>
            {selectedMonth && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>📌 {selectedMonth.monthName} selecionado:</strong> dia ensolarado ganha {selectedMonth.ganhoDia.toFixed(2)} °C, perde {selectedMonth.perdaCorrigidaPorDia.toFixed(2)} °C/noite. Apos 4 dias com 3 noites de perda, a piscina chega a <strong>{selectedMonth.tempFinal4d.toFixed(1)} °C</strong>.
              </div>
            )}
          </Section>

          {/* === 7. Observacoes === */}
          <Section title="7. Observacoes" icon="ℹ️">
            <div className="text-xs text-slate-700 space-y-1.5">
              <p><strong>Os valores acima sao estimativos e poderao sofrer variacoes caso:</strong></p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Haja alteracao da temperatura media mensal do ambiente.</li>
                <li>A perda termica da piscina por dia seja acima do tolerado (uso intenso, capa termica nao usada, vento forte).</li>
                <li>Dias frios e chuvosos poderao reiniciar o ciclo de aquecimento do 1° dia.</li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                Calculo baseado na metodologia Solis Piscinas + radiacao solar do Atlas Brasileiro de Energia Solar (CRESESB/INPE). Constantes: eficiencia coletor 0.65 padrao, insolacao 5h util/dia, vazao 0.254 m³/h por m² de coletor.
              </p>
            </div>
          </Section>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {uf ? "Clique em 'Recalcular dimensionamento' pra gerar o relatorio solar." : "Selecione UF + cidade pra comecar."}
        </div>
      )}
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

function BigStat({ label, value, unit, emphasis }: { label: string; value: string; unit: string; emphasis: "cyan" | "orange" | "emerald" }) {
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
