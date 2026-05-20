"use client";
// Simulador de Aquecimento (Solar / Bomba de Calor).
// Modal full-screen com abas. Ordem: Solar | Bomba de Calor | Comparativo.
// Ver memory/project_heating_simulator_plan.md pra contexto.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, getAccessToken } from "@/lib/api";
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
  solarHeaderImage?: string | null;
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
  const [solarHeaderImage, setSolarHeaderImage] = useState<string | null>(budget.solarHeaderImage ?? null);
  const [headerImageUploading, setHeaderImageUploading] = useState(false);

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
              headerImage={solarHeaderImage}
              headerImageUploading={headerImageUploading}
              onUploadHeaderImage={uploadSolarHeaderImage}
              onRemoveHeaderImage={removeSolarHeaderImage}
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
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
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
  headerImage: string | null;
  headerImageUploading: boolean;
  onUploadHeaderImage: (file: File) => void | Promise<void>;
  onRemoveHeaderImage: () => void | Promise<void>;
}) {
  const dims = budget.poolDimensions ?? {};
  const area = Number(dims.area) || 0;
  const volume = Number(dims.volume) || 0;
  const len = Number(dims.length) || 0;
  const wid = Number(dims.width) || 0;
  const profMin = Number(dims.depthMin ?? dims.profundidadeMinima) || 0;
  const profMax = Number(dims.depthMax ?? dims.profundidadeMaxima ?? dims.depth) || 0;
  const tipoPiscinaTxt = (budget.environmentParams as any)?.tipoPiscina ?? "PRIVATIVA";

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando dados solares...</div>;
  }

  const selectedMonth = report?.monthly?.[selectedMonthIdx];
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const localName = cidade || (availableUfs.find((u) => u.uf === uf)?.ufName) || "—";

  return (
    <>
      {/* === Toolbar — fora da area PDF, escondida no print === */}
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        <div className="text-[11px] text-slate-500">
          Edite UF, capa, vento, temperatura e clique <span className="font-semibold text-slate-700">Recalcular</span>.
          <a href="/settings/climate-data" className="ml-2 text-cyan-700 hover:underline">Editar dados climaticos</a>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onRecompute()} disabled={recomputing || !uf}
            className="rounded-md bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:bg-slate-300 transition shadow-sm">
            {recomputing ? "Recalculando..." : "Recalcular dimensionamento"}
          </button>
          <button onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white text-slate-700 px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-50 transition shadow-sm">
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* === Folha A4 (datasheet) ===
          Container central com max-w aproximando 210mm (~794px). Borda + sombra na tela
          dão sensação de "folha". No print, ocupa A4 inteiro sem nada disso. */}
      <div className="mx-auto max-w-[820px] print:max-w-none">
        <div id="solar-pdf-area" className="bg-white text-slate-900 font-sans border border-slate-200 shadow-sm print:border-0 print:shadow-none">

          {/* ============ HEADER BANNER ============ */}
          <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-5 py-3 flex items-center justify-between print:bg-slate-900 print:text-white">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-amber-300 font-medium">Aquecimento solar para piscinas</div>
              <h2 className="text-base font-bold mt-0.5 leading-tight">Dimensionamento Coletor Solar</h2>
              <div className="text-[10px] text-slate-300 mt-0.5">Conforme NBR 10339:2018 — ABNT</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300">Orcamento</div>
              <div className="text-xl font-bold tabular-nums leading-tight">{budget.code ?? "—"}</div>
              <div className="text-[10px] text-slate-300 mt-0.5">{today}</div>
            </div>
          </header>

          {/* ============ CLIENTE + IMAGEM PRODUTO ============ */}
          <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break">
            <div className="col-span-7">
              <SectionLabel>Cliente / Obra</SectionLabel>
              <dl className="mt-1.5 grid grid-cols-1 gap-y-1 text-[11px]">
                <DataRow term="Nome" desc={budget.clientPartner?.name ?? "—"} emphasize />
                <DataRow term="Local" desc={localName} />
                <DataRow term="Projeto" desc={budget.title || "—"} />
              </dl>
            </div>
            <div className="col-span-5">
              <HeaderImageBlock
                imageUrl={headerImage}
                uploading={headerImageUploading}
                onUpload={onUploadHeaderImage}
                onRemove={onRemoveHeaderImage}
              />
            </div>
          </section>

          {/* ============ SPECS — PISCINA + CONFIGURACAO ============ */}
          <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break">
            {/* PISCINA — 5 col */}
            <div className="col-span-5">
              <SectionLabel>Dimensoes da piscina</SectionLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Stat label="Comprimento" value={`${len.toFixed(2).replace(".", ",")} m`} />
                <Stat label="Largura" value={`${wid.toFixed(2).replace(".", ",")} m`} />
                <Stat label="Prof. min" value={`${profMin.toFixed(2).replace(".", ",")} m`} />
                <Stat label="Prof. max" value={`${profMax.toFixed(2).replace(".", ",")} m`} />
                <Stat label="Area total" value={`${area.toFixed(2).replace(".", ",")} m²`} highlight />
                <Stat label="Volume" value={`${volume.toFixed(2).replace(".", ",")} m³`} highlight />
              </div>
              <div className="mt-1.5 text-[9px] text-slate-500 uppercase tracking-wide">Tipo: <span className="text-slate-700 font-semibold">{tipoPiscinaTxt}</span></div>
            </div>

            {/* CONFIGURACAO — 4 col */}
            <div className="col-span-4">
              <SectionLabel>Configuracao</SectionLabel>
              <div className="mt-1.5 space-y-1">
                <ConfigRow label="Temp. final">
                  <input type="number" min={20} max={40} value={tempAguaDesejada}
                    onChange={(e) => setTempAguaDesejada(Number(e.target.value) || 30)}
                    className="w-14 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-[11px] font-semibold text-center tabular-nums focus:border-amber-500 focus:outline-none" />
                  <span className="text-[10px] text-slate-500 ml-1">°C</span>
                </ConfigRow>
                <ConfigRow label="UF / Cidade">
                  <div className="flex gap-1">
                    <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); }}
                      className="bg-amber-50 border border-amber-200 rounded text-[11px] font-semibold px-1 py-0.5">
                      <option value="">--</option>
                      {availableUfs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
                    </select>
                    <select value={cidade} onChange={(e) => setCidade(e.target.value)}
                      disabled={!uf}
                      className="bg-amber-50 border border-amber-200 rounded text-[11px] font-semibold px-1 py-0.5 flex-1 disabled:opacity-50">
                      <option value="">{uf ? "Capital" : "—"}</option>
                      {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </ConfigRow>
                <ConfigRow label="Capa termica">
                  <select value={capaTermica ? "SIM" : "NAO"} onChange={(e) => setCapaTermica(e.target.value === "SIM")}
                    className="bg-amber-50 border border-amber-200 rounded text-[11px] font-semibold px-1.5 py-0.5">
                    <option value="SIM">Sim</option>
                    <option value="NAO">Nao</option>
                  </select>
                </ConfigRow>
                <ConfigRow label="Vento">
                  <select value={vento} onChange={(e) => setVento(e.target.value)}
                    className="bg-amber-50 border border-amber-200 rounded text-[11px] font-semibold px-1.5 py-0.5">
                    <option value="FRACO">Fraco</option>
                    <option value="MODERADO">Moderado</option>
                    <option value="FORTE">Forte</option>
                  </select>
                </ConfigRow>
                {((budget.environmentParams as any)?.hidromassagensQtd > 0 ||
                  (budget.environmentParams as any)?.cascataLarguraCm > 0 ||
                  (budget.environmentParams as any)?.bordaInfinitaM > 0) && (
                  <div className="pt-1 mt-1 border-t border-slate-100 text-[9.5px] text-slate-600 space-y-0.5">
                    {(budget.environmentParams as any)?.hidromassagensQtd > 0 && <div>Hidromassagens: <span className="font-semibold">{(budget.environmentParams as any).hidromassagensQtd}</span></div>}
                    {(budget.environmentParams as any)?.cascataLarguraCm > 0 && <div>Cascata: <span className="font-semibold">{(budget.environmentParams as any).cascataLarguraCm} cm</span></div>}
                    {(budget.environmentParams as any)?.bordaInfinitaM > 0 && <div>Borda infinita: <span className="font-semibold">{(budget.environmentParams as any).bordaInfinitaM} m</span></div>}
                  </div>
                )}
              </div>
            </div>

            {/* NBR — 3 col */}
            <div className="col-span-3">
              <SectionLabel>Referencia NBR 10339</SectionLabel>
              <div className="mt-1.5 space-y-0.5 text-[9px] leading-tight">
                <NbrRow tipo="SPA" range="36 a 38°C" />
                <NbrRow tipo="Competicao" range="25 a 28°C" />
                <NbrRow tipo="Recreacao" range="27 a 29°C" />
                <NbrRow tipo="Bebes/Hidro" range="30 a 34°C" />
                <NbrRow tipo="Criancas" range="29 a 32°C" />
              </div>
              <div className="mt-1.5 text-[8px] text-amber-700 leading-tight italic">
                Recomenda-se acompanhamento medico para temperaturas acima de 38°C.
              </div>
            </div>
          </section>

          {/* ============ TITULO BANNER DIMENSIONAMENTO ============ */}
          <div className="bg-slate-900 text-white px-5 py-1.5 flex items-center justify-between print:bg-slate-900 print:text-white">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold">Dimensionamento</span>
            <span className="text-[10px] text-slate-300">Coletor Solar Solis Piscinas</span>
          </div>

          {report ? (
            <>
              {/* ============ KPIs ============ */}
              <section className="grid grid-cols-6 gap-2 px-5 py-3 border-b border-slate-200 avoid-break">
                <Kpi label="Area piscina" value={report.areaPiscinaM2.toFixed(2).replace(".", ",")} unit="m²" />
                <Kpi label="m² necessario" value={String(Math.round(report.m2ColetorNecessario))} unit="m²" />
                <Kpi label="Coletores" value={report.qtdColetores.toFixed(1).replace(".", ",")} unit="un" accent />
                <Kpi label="Baterias" value={String(report.numBaterias)} unit="un" />
                <Kpi label="Vazao" value={report.vazaoTotalM3h.toFixed(2).replace(".", ",")} unit="m³/h" />
                <Kpi label="Cobertura" value={report.percentualCobertura.toFixed(1).replace(".", ",")} unit="%" />
              </section>

              {/* ============ COLETOR + BOMBA ============ */}
              <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break">
                <div className="col-span-7">
                  <SectionLabel>Coletor selecionado</SectionLabel>
                  <div className="mt-1.5">
                    <select value={selectedCollectorId ?? ""} onChange={(e) => setSelectedCollectorId(e.target.value || null)}
                      className="w-full bg-amber-50 border border-amber-200 rounded text-[12px] font-semibold px-2 py-1 print:hidden">
                      <option value="">— Padrao —</option>
                      {collectors.map((c) => (
                        <option key={c.productId} value={c.productId}>
                          {c.modelName} ({c.areaM2.toFixed(2)} m²)
                        </option>
                      ))}
                    </select>
                    <div className="hidden print:block text-[12px] font-semibold bg-amber-50 px-2 py-1 border border-amber-200 rounded">
                      {report.selectedCollector.modelName} ({report.selectedCollector.areaM2.toFixed(2)} m²)
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold">Coletores extras</span>
                    <input type="range" min={0} max={10} step={1} value={extraPct}
                      onChange={(e) => setExtraPct(Number(e.target.value))}
                      className="flex-1 print:hidden accent-amber-500" />
                    <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 text-xs font-bold text-emerald-700 tabular-nums w-9 text-center">+{extraPct}</div>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 italic">Aumenta a eficiencia em meses frios.</div>
                </div>
                <div className="col-span-5">
                  <SectionLabel>Bomba recomendada</SectionLabel>
                  <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                    <div className="text-[12px] font-bold text-slate-900 leading-tight">{report.bombaRecomendada}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                      Mapeado pela vazao calculada. Operador ajusta o modelo exato no orcamento final.
                    </div>
                  </div>
                </div>
              </section>

              {/* ============ TITULO BANNER SIMULACAO ============ */}
              <div className="bg-slate-900 text-white px-5 py-1.5 flex items-center justify-between print:bg-slate-900 print:text-white">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold">Simulacao termica mensal</span>
                <div className="flex items-center gap-2 print:hidden">
                  <span className="text-[9px] text-slate-300 uppercase tracking-wide">Grafico do mes:</span>
                  <select value={selectedMonthIdx} onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded">
                    {SOLAR_MONTH_NAMES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <span className="hidden print:inline text-[10px] text-slate-300">{selectedMonth ? selectedMonth.monthName : ""}</span>
              </div>

              {/* ============ GRAFICO + TABELA ============ */}
              <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break">
                <div className="col-span-7">
                  {selectedMonth && (
                    <SolarChart row={selectedMonth} tempDesejada={tempAguaDesejada} />
                  )}
                </div>
                <div className="col-span-5">
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <table className="w-full text-[9px] tabular-nums">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">Mes</th>
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
              <footer className="px-5 py-2.5 bg-slate-50 print:bg-white">
                <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Observacoes</div>
                <ol className="text-[8.5px] text-slate-700 leading-tight space-y-0.5 list-decimal list-inside">
                  <li>Os valores acima sao estimativos e podem sofrer variacoes conforme temperatura ambiente real.</li>
                  <li>Perda termica acima do tolerado (sem capa, vento forte) reduz a temperatura final.</li>
                  <li>Dias frios e nublados podem reiniciar o ciclo de aquecimento.</li>
                </ol>
              </footer>
            </>
          ) : (
            <div className="mx-5 my-6 rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 print:hidden">
              {uf ? "Clique em Recalcular dimensionamento para gerar o relatorio." : "Selecione UF e cidade para comecar."}
            </div>
          )}
        </div>
      </div>

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

          #solar-pdf-area {
            position: absolute; left: 0; top: 0;
            width: 100%; padding: 0; margin: 0;
            font-size: 10px;
            line-height: 1.2;
          }
          @page { size: A4 portrait; margin: 6mm; }

          /* Avoid page breaks dentro dos blocos principais */
          .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }

          /* Reduz padding das secoes pra caber em 1 pagina */
          #solar-pdf-area section { padding-top: 6px !important; padding-bottom: 6px !important; }
          #solar-pdf-area footer { padding-top: 4px !important; padding-bottom: 4px !important; }
          #solar-pdf-area header { padding-top: 8px !important; padding-bottom: 8px !important; }

          /* SVG do grafico — limita altura */
          #solar-pdf-area svg { max-height: 52mm; width: 100%; height: auto; }

          /* Imagem do header — proporcao mantida, altura controlada */
          #solar-pdf-area img { max-height: 28mm; }

          /* Esconde elementos da UI interativa */
          .print\\:hidden { display: none !important; }
        }
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
    <div className={`rounded px-2 py-1 border ${highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold leading-tight">{label}</div>
      <div className={`text-[12px] tabular-nums font-bold leading-tight ${highlight ? "text-amber-800" : "text-slate-900"}`}>{value}</div>
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

function Kpi({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`rounded border ${accent ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"} px-2 py-1.5 text-center`}>
      <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold leading-tight">{label}</div>
      <div className={`mt-0.5 text-base font-bold tabular-nums leading-none ${accent ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
      <div className={`text-[9px] font-medium mt-0.5 ${accent ? "text-amber-600" : "text-slate-500"}`}>{unit}</div>
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
    <div className="relative border border-slate-200 rounded overflow-hidden bg-slate-50 h-full min-h-[88px] flex items-center justify-center print:bg-white">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Imagem do orcamento" className="w-full h-full max-h-[120px] object-contain" />
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
            <div className="text-[8.5px] text-slate-400 mt-0.5">JPEG · PNG · WebP — max 5MB</div>
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

// Grafico estilo planilha: 8 pontos (4 dias × inicio/fim), area montanha laranja/amarela com labels
function SolarChart({ row, tempDesejada }: { row: SolarMonthlyRow; tempDesejada: number }) {
  // Fallback defensivo: report cacheado antigo nao tinha tempInicial2d/3d/4d.
  // Interpola usando a formula: tempInicial(n+1) = max(0, tempFinal(n) - perdaCorrigidaPorDia)
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
    { x: "Temp Inicial 1° Dia", y: tempIni1 },
    { x: "Temp Final 1° Dia",   y: tempFim1 },
    { x: "Temp Inicial 2° Dia", y: tempIni2 },
    { x: "Temp Final 2° Dia",   y: tempFim2 },
    { x: "Temp Inicial 3° Dia", y: tempIni3 },
    { x: "Temp Final 3° Dia",   y: tempFim3 },
    { x: "Temp Inicial 4° Dia", y: tempIni4 },
    { x: "Temp Final 4° Dia",   y: tempFim4 },
  ];
  const W = 560;
  const H = 220;
  const padL = 28, padR = 12, padT = 24, padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const yMin = 20;
  const yMax = Math.max(40, tempDesejada + 2);
  const stepX = innerW / (pts.length - 1);
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.y).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xOf(pts.length - 1).toFixed(1)} ${padT + innerH} L ${xOf(0).toFixed(1)} ${padT + innerH} Z`;

  return (
    <div className="border border-slate-300 print:border-slate-400 rounded-sm bg-blue-50/30 p-2 print:bg-white">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#fef08a" stopOpacity="0.3" />
          </linearGradient>
          <marker id="arrUp" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,10 L5,0 L10,10 z" fill="#3b82f6" />
          </marker>
        </defs>
        {/* Grid Y */}
        {[20, 25, 30, 35, 40].filter((v) => v <= yMax).map((v) => (
          <g key={v}>
            <line x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)} stroke="#e2e8f0" strokeDasharray="2 2" />
            <text x={padL - 4} y={yOf(v) + 3} fontSize="9" fill="#94a3b8" textAnchor="end">({v}°)</text>
          </g>
        ))}
        {/* Area gradient */}
        <path d={areaPath} fill="url(#solarGrad)" stroke="none" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#f97316" strokeWidth="2.5" />
        {/* Pontos + labels + flechas */}
        {pts.map((p, i) => {
          const isInicial = i % 2 === 0;
          return (
            <g key={i}>
              {/* Flecha vertical em pontos iniciais (estilo planilha) */}
              {isInicial && (
                <line x1={xOf(i)} y1={padT + innerH} x2={xOf(i)} y2={yOf(p.y) + 4}
                  stroke="#3b82f6" strokeWidth="1" markerEnd="url(#arrUp)" />
              )}
              {/* Ponto */}
              <circle cx={xOf(i)} cy={yOf(p.y)} r="3" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
              {/* Label valor */}
              <text x={xOf(i)} y={yOf(p.y) - 8} fontSize="10" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">
                ({p.y.toFixed(2).replace(".", ",")}°)
              </text>
              {/* Label eixo X (rotacionado) */}
              <text x={xOf(i)} y={padT + innerH + 14} fontSize="8" fill="#475569" textAnchor="middle">
                {p.x.split(" ").slice(0, 2).join(" ")}
              </text>
              <text x={xOf(i)} y={padT + innerH + 24} fontSize="8" fill="#475569" textAnchor="middle">
                {p.x.split(" ").slice(2).join(" ")}
              </text>
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
