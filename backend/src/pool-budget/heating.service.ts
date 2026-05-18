// Servico de calculo de aquecimento (Trocador de Calor / Bomba de Calor).
//
// Implementa metodo HIBRIDO:
// - Base: fisica termodinamica TAB006 (perda termica por evaporacao + outras)
// - Extras: rule-of-thumb da planilha original Tholz (hidromassagem/cascata/borda)
// - Selecao: por carga maxima do mes mais critico (TAB006 Calculation A32)
// - Comparativo: GLP/GN/Eletrico com eficiencias tipicas (planilha original / AstralPool)
//
// Ver memory/project_heating_simulator_plan.md pra contexto completo.

import { Injectable } from '@nestjs/common';
import {
  BORDA_INFINITA,
  CLIMATE_BY_UF,
  CLIMATE_DATA,
  ClimateCity,
  CONVERSIONS,
  EQUIPMENT_SELECTION,
  EXTRAS_KCAL_H,
  FonteEnergia,
  getActiveMonths,
  HEATING_OPERATION_DEFAULTS,
  OTHER_LOSSES_FACTOR,
  pressaoSaturadaPa,
  SAFETY_MARGIN,
  TipoConstrucao,
  TipoPiscina,
  UFCode,
  UtilizacaoAno,
  UtilizacaoSemana,
  VentoLevel,
  WATER_PROPS,
  WIND_SPEED_BY_LEVEL,
  BETA_INV,
} from './heating-constants';

// ============ TIPOS DE I/O ============

export interface HeatingInputs {
  // Dimensoes
  areaM2: number;
  volumeM3: number;

  // Localizacao
  uf: UFCode;
  cidade?: string; // se vazio/nao-encontrada → usa capital

  // Configuracao da piscina
  tempAguaDesejada: number; // °C (final)
  tempAguaInicial?: number; // °C (se vazio, usa media do estado)
  vento: VentoLevel;
  tipoConstrucao: TipoConstrucao;
  tipoPiscina: TipoPiscina;
  capaTermica: boolean;
  utilizacaoAno: UtilizacaoAno;
  utilizacaoSemana: UtilizacaoSemana;

  // Extras
  hidromassagensQtd?: number;
  cascataLarguraCm?: number;
  bordaInfinitaM?: number;
  // Borda infinita: altura de queda da agua, vazao e horas/dia que a bomba fica ativa.
  // Defaults: 0.5m altura, 30 L/min/m vazao, 24h ativa.
  bordaInfinitaAlturaM?: number;
  bordaInfinitaVazaoLminPorM?: number;
  bordaInfinitaHorasAtivaDia?: number;

  // Operacao
  horasFuncionamentoDia?: number; // default 15
  taxaFuncionamento?: number; // 0..1, default 0.5
}

export interface MonthlyHeatLoss {
  /** Indice 0=jan, 11=dez */
  monthIndex: number;
  /** Temperatura ambiente daquele mes (°C) */
  tempAr: number;
  /** Umidade relativa daquele mes (0..1) */
  humidity: number;
  /** Perda principal (evaporacao) em kW */
  qsKw: number;
  /** Outras perdas (radiacao/conducao) em kW */
  qsExtraKw: number;
  /** Extras (hidro/cascata/borda) em kW */
  qsExtrasKw: number;
  /** Total = qs + qsExtra + qsExtras em kW */
  qtotalKw: number;
}

export interface EquipmentSpecs {
  productId: string;
  modelName: string; // ex: "Tholz X23-14C"
  kcalHNominal?: number; // capacidade kcal/h (cadastro do produto)
  btuH?: number; // capacidade Btu/h
  kwNominal?: number; // capacidade em kW
  // Consumo eletrico
  consumoMaxW?: number; // W medio em maxima carga
  consumoMedioW?: number; // W medio em uso normal
  ratedInputPowerKW?: number; // kW medio (TAB006 Specification line 29)
  // COP (Coefficient of Performance) — varia com condicao
  copMax?: number; // COP maximo em condicao ideal (ar 26°C, carga baixa) — valor "de marketing"
  copAt50Air26?: number; // COP em 50% capacidade, ar 26°C (verao tipico)
  copAt50Air15?: number; // COP em 50% capacidade, ar 15°C (inverno brasileiro — uso real)
  // Legados (compat)
  copNominal?: number;
  copAt50Capacity?: number;
}

export interface MonthlyConsumption {
  monthIndex: number;
  monthName: string;
  /** kWh consumidos no mes (estimativa) */
  kwhConsumido: number;
  /** Custo em centavos */
  custoBRLCents: number;
}

export interface ComparativoFonte {
  fonte: FonteEnergia;
  kcalAnualEstimado: number;
  consumoAnual: number; // unidades dependem da fonte (kWh, Kg GLP, m³ GN)
  consumoUnidade: string; // 'kWh' | 'Kg' | 'm³'
  custoAnualBRLCents: number;
}

export interface TariffInput {
  kwhBRLCents: number; // R$/kWh em centavos
  glpKgBRLCents: number;
  gnM3BRLCents: number;
}

export interface HeatingReport {
  computedAt: string; // ISO

  // Inputs resolvidos
  cityResolved: { uf: UFCode; name: string }; // cidade efetivamente usada
  inputs: HeatingInputs;

  // Resultado por mes
  monthlyHeatLoss: MonthlyHeatLoss[]; // 12 entries

  // Dimensionamento
  qtotalMaxKw: number; // mes mais critico
  qtotalAvgKw: number; // media dos meses ativos
  qtotalMonthCritical: number; // indice do mes mais critico
  calorNecessarioKcalH: number; // qtotalMaxKw * 860 (para auto-select)
  calorNecessarioBtuH: number;

  // Equipamento (preenchido pelo selectEquipment se passado)
  selectedEquipment?: EquipmentSpecs & { loadRatio: number; isAdequate: boolean };

  // Performance (preenchido se selectedEquipment passado)
  timeToHeatHours?: number; // tempo total ate temp desejada (descontando perdas continuas)
  degreesPerHour?: number; // °C/h em media
  timeToHeatInfeasible?: boolean; // true se perda >= capacidade (equipamento nao aquece)
  copEstimated?: number;

  // Consumo + custo
  monthlyConsumption?: MonthlyConsumption[]; // 12 entries
  annualKwh?: number;
  annualCostBRLCents?: number;
  initialHeatingCostBRLCents?: number;

  // Comparativo
  comparativo?: ComparativoFonte[];
}

// ============ SERVICE ============

@Injectable()
export class HeatingService {
  // ----- 1. Resolucao de dados climaticos -----

  /**
   * Pega dados climaticos da cidade especificada (ou capital do UF se nao informada
   * ou nao encontrada). Retorna a cidade resolvida + dados de temp/umidade mensal.
   */
  getClimateData(uf: UFCode, cidade?: string): { city: ClimateCity; resolved: { uf: UFCode; name: string } } {
    const ufData = CLIMATE_BY_UF[uf];
    if (!ufData) {
      throw new Error(`UF ${uf} nao encontrado na base climatica. UFs disponiveis: ${CLIMATE_DATA.map((c) => c.uf).join(', ')}`);
    }
    if (cidade && cidade.trim()) {
      const found = ufData.cities.find(
        (c) => c.name.toLowerCase().trim() === cidade.toLowerCase().trim(),
      );
      if (found) {
        return { city: found, resolved: { uf, name: found.name } };
      }
    }
    return { city: ufData.capital, resolved: { uf, name: ufData.capital.name } };
  }

  /** Lista todas UFs + cidades disponiveis (pra dropdown). */
  listAvailableCities(): { uf: UFCode; ufName: string; cities: string[] }[] {
    return CLIMATE_DATA.map((c) => ({
      uf: c.uf,
      ufName: c.ufName,
      cities: [c.capital.name, ...c.cities.map((x) => x.name)],
    }));
  }

  // ----- 2. Calculo da perda termica mensal -----

  /**
   * Computa Qs (perda principal) + Qs' (outras) + extras para os 12 meses.
   *
   * Formula base TAB006 Calculadora!F25:
   *   Qs(kW) = (1/β) × ρ × γ × (0.0174×Vw + 0.0229) × (Pb - Pq) × As / 3600
   *
   * Onde:
   *   β = 133.32 (constante mmHg→Pa)
   *   ρ = densidade agua = 1 kg/L
   *   γ = calor latente vaporizacao = 2266 kJ/kg (variavel por estacao, usamos valor anual)
   *   Vw = velocidade vento na superficie (m/s)
   *   Pb = pressao saturada vapor a TEMP_AGUA (Pa) — Magnus formula
   *   Pq = pressao saturada vapor a TEMP_AR × umidade relativa do mes (Pa)
   *   As = area superficie d'agua (m²)
   *
   * Capa termica: reduz drasticamente a perda por evaporacao (~60% de reducao —
   * planilha original usa fator 1.6 sem capa vs 1.02 com capa = ratio 0.638).
   */
  computeMonthlyHeatLoss(inputs: HeatingInputs): MonthlyHeatLoss[] {
    const { city } = this.getClimateData(inputs.uf, inputs.cidade);

    // Velocidade do vento (sobrescrita por tipoConstrucao FECHADA = INTERNA)
    const ventoEfetivo: VentoLevel = inputs.tipoConstrucao === 'FECHADA' ? 'INTERNA' : inputs.vento;
    const vw = WIND_SPEED_BY_LEVEL[ventoEfetivo];

    // Pressao saturada do vapor a temperatura da agua (constante pra todos os meses)
    const pb = pressaoSaturadaPa(inputs.tempAguaDesejada);

    // Vento factor (TAB006 F25)
    const ventoFactor = 0.0174 * vw + 0.0229;

    // Capa termica: ~36% de reducao da evaporacao (planilha original: 1.02/1.6 = 0.6375)
    // TAB006 nao considera capa no calculo de evaporacao — esse fator vem da planilha
    // original Tholz X-23 / AstralPool, que sao consistentes entre si.
    const capaFactor = inputs.capaTermica ? 0.6375 : 1.0;

    // NOTA: tipoPiscina (PRIVATIVA/COLETIVA) nao afeta a perda termica fisica.
    // Mantido no DTO so pra UI/PDF (info documental).

    // Extras simples (rule-of-thumb planilha original) — em Kcal/h convertidos pra kW.
    // Sao constantes (nao variam com clima do mes).
    const hidroQty = Number(inputs.hidromassagensQtd) || 0;
    const cascataCm = Number(inputs.cascataLarguraCm) || 0;
    const extrasFixosKcalH =
      hidroQty * EXTRAS_KCAL_H.hidromassagemEach +
      cascataCm * EXTRAS_KCAL_H.cascataPerCm;
    const extrasFixosKw = extrasFixosKcalH / CONVERSIONS.KWH_TO_KCAL;

    // Borda infinita: modelo fisico (depende de Tar/umidade do mes — varia mes a mes).
    const bordaM = Number(inputs.bordaInfinitaM) || 0;
    const alturaQuedaM = Number(inputs.bordaInfinitaAlturaM) || BORDA_INFINITA.DEFAULT_ALTURA_M;
    const vazaoLminPorM = Number(inputs.bordaInfinitaVazaoLminPorM) || BORDA_INFINITA.DEFAULT_VAZAO_LMIN_M;
    const horasAtivaDia = Number(inputs.bordaInfinitaHorasAtivaDia) || BORDA_INFINITA.DEFAULT_HORAS_ATIVA_DIA;
    // Area do filme de queda d'agua (m²). Multiplicador captura texturizacao/turbulencia.
    const areaFilmeM2 = bordaM * alturaQuedaM * BORDA_INFINITA.FILME_FACTOR;
    // Fator vazao: vazao baixa = filme fino, vazao alta plateua.
    const vazaoFactor = bordaM > 0
      ? Math.max(BORDA_INFINITA.VAZAO_FACTOR_MIN, Math.min(BORDA_INFINITA.VAZAO_FACTOR_MAX, vazaoLminPorM / BORDA_INFINITA.VAZAO_REFERENCIA_LMIN_M))
      : 0;
    // Fator tempo: se a bomba da borda fica ligada so X horas/dia, a perda diaria
    // (e portanto a media horaria que vai no calculo de Qtotal contínuo) cai
    // proporcionalmente. 24h = sempre ligada, sem reducao.
    const tempoBordaFactor = Math.max(0, Math.min(1, horasAtivaDia / 24));

    const result: MonthlyHeatLoss[] = [];
    for (let m = 0; m < 12; m++) {
      const tempAr = city.tempMonthly[m];
      const humidity = city.humidityMonthly[m];

      // Pressao parcial vapor no ar = pressao saturada × umidade relativa
      const pq = pressaoSaturadaPa(tempAr) * humidity;

      // Diferenca de pressao (driver da evaporacao)
      const deltaP = Math.max(0, pb - pq);

      // Qs principal (superficie da piscina). capaFactor aplicado.
      const qsKw =
        BETA_INV *
        WATER_PROPS.densityKgPerL *
        WATER_PROPS.latentHeatKjPerKg *
        ventoFactor *
        deltaP *
        inputs.areaM2 *
        capaFactor /
        3600;

      // Borda infinita: mesma fisica mas sem capa (filme exposto) + multiplicador
      // de vazao + fator de horas ativas/dia (bomba ligada 24h vs partido).
      const qsBordaKw = areaFilmeM2 > 0
        ? (BETA_INV *
            WATER_PROPS.densityKgPerL *
            WATER_PROPS.latentHeatKjPerKg *
            ventoFactor *
            deltaP *
            areaFilmeM2 *
            vazaoFactor *
            tempoBordaFactor /
            3600)
        : 0;

      // Extras (hidromassagem + cascata fixos) + borda (varia por mes)
      const extrasMesKw = extrasFixosKw + qsBordaKw;

      // Outras perdas (TAB006 R17): 20% sobre evaporacao principal
      const qsExtraKw = qsKw * OTHER_LOSSES_FACTOR;

      const qtotalKw = qsKw + qsExtraKw + extrasMesKw;

      result.push({
        monthIndex: m,
        tempAr,
        humidity,
        qsKw: round1(qsKw),
        qsExtraKw: round1(qsExtraKw),
        qsExtrasKw: round1(extrasMesKw),
        qtotalKw: round1(qtotalKw),
      });
    }
    return result;
  }

  // ----- 3. Selecao do equipamento -----

  /**
   * Escolhe o equipamento com base em Qtotal max do periodo ativo.
   * Filtra candidatos por kcalHNominal × CONVERSIONS.WATT_TO_KCAL_H ≥ Qtotal_max × 860.
   * Ordena por loadRatio mais proximo de MAX_LOAD_RATIO (folga ~30%).
   *
   * NOTA: candidatos devem vir do auto-select ja filtrados por poolType="Bomba de Calor"
   * (ou similar) e ter kcalHNominal no technicalSpecs.
   */
  selectEquipment(
    candidates: Array<{
      productId: string;
      modelName: string;
      kcalHNominal: number;
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
    }>,
    qtotalMaxKw: number,
    _mode: UtilizacaoAno,
  ): (EquipmentSpecs & { loadRatio: number; isAdequate: boolean }) | undefined {
    if (candidates.length === 0) return undefined;
    const qtotalKcalH = qtotalMaxKw * CONVERSIONS.KWH_TO_KCAL;

    const scored = candidates
      .filter((c) => c.kcalHNominal > 0)
      .map((c) => {
        const capacidadeKcalH = c.kcalHNominal;
        const loadRatio = qtotalKcalH / capacidadeKcalH;
        const isAdequate =
          loadRatio <= EQUIPMENT_SELECTION.MAX_LOAD_RATIO &&
          loadRatio >= EQUIPMENT_SELECTION.MIN_LOAD_RATIO;
        return { ...c, loadRatio, isAdequate };
      })
      .sort((a, b) => {
        // Prioriza adequados (folga 30-70%). Depois ordena por loadRatio mais alto
        // dentro do limite (equipamento menor que ainda atende).
        if (a.isAdequate && !b.isAdequate) return -1;
        if (!a.isAdequate && b.isAdequate) return 1;
        if (a.isAdequate && b.isAdequate) {
          return b.loadRatio - a.loadRatio; // maior loadRatio (equip menor)
        }
        // Ambos inadequados: prioriza o que esta MAIS PROXIMO do limite max
        const da = Math.abs(a.loadRatio - EQUIPMENT_SELECTION.MAX_LOAD_RATIO);
        const db = Math.abs(b.loadRatio - EQUIPMENT_SELECTION.MAX_LOAD_RATIO);
        return da - db;
      });

    return scored[0];
  }

  // ----- 4. Tempo de aquecimento + COP -----

  /**
   * Tempo total pra elevar a temperatura inicial -> desejada.
   * Formula (TAB006 Hoja1!B9-B12):
   *   energiaTotalKj = SHC × volume × 1000 × ΔT     (ja em kJ)
   *   tempoHoras = energiaTotalKj / (capacidadeBtuH × kJ/btu / 3600)
   *
   * Onde:
   *   SHC = 4.2 kJ/(kg·°C) (calor especifico da agua)
   *   capacidadeBtuH ≈ capacidadeKcalH × 3.9683
   */
  computeTimeToHeat(
    volumeM3: number,
    deltaT: number,
    capacidadeKcalH: number,
    perdaKcalH: number = 0,
  ): { hours: number; degreesPerHour: number; isInfeasible: boolean } {
    if (capacidadeKcalH <= 0 || deltaT <= 0) return { hours: 0, degreesPerHour: 0, isInfeasible: false };

    // Capacidade efetiva = capacidade total - perda termica continua durante o aquecimento.
    // O aquecedor cobre as perdas primeiro; o que sobra eleva a temperatura.
    // Se perda >= capacidade → impossivel aquecer (equipamento subdimensionado).
    const capacidadeEfetivaKcalH = capacidadeKcalH - perdaKcalH;
    if (capacidadeEfetivaKcalH <= 0) {
      return { hours: Infinity, degreesPerHour: 0, isInfeasible: true };
    }

    const energiaKj = WATER_PROPS.specificHeatKjPerKgC * volumeM3 * 1000 * deltaT;
    // capacidade Kcal/h → kJ/h: (Kcal/h ÷ 860) = kW, × 3600 = kJ/h
    const capacidadeKjH = (capacidadeEfetivaKcalH / CONVERSIONS.KWH_TO_KCAL) * 3600;
    const hours = energiaKj / capacidadeKjH;
    return { hours: round2(hours), degreesPerHour: round2(deltaT / hours), isInfeasible: false };
  }

  // ----- 5. Consumo mensal + custos -----

  /**
   * Calcula consumo mensal de energia (kWh) e custo (R$/mes) baseado no equipamento
   * selecionado, horas de operacao por dia, taxa de funcionamento e tarifa de energia.
   *
   * Formula simplificada (TAB006 Hoja1):
   *   consumoKwhDia = ratedInputPowerKW × horas × taxa
   *   consumoKwhMes = consumoKwhDia × dias_no_mes
   *   custoMes = consumoKwhMes × R$/kWh
   *
   * Pra perdas mensais mais altas (inverno), aumenta o consumo proporcional ao Qtotal/Qmedia.
   */
  computeMonthlyConsumption(
    monthly: MonthlyHeatLoss[],
    qtotalAvgKw: number,
    ratedInputPowerKW: number,
    hoursPerDay: number,
    taxaFuncionamento: number,
    tariff: TariffInput,
  ): MonthlyConsumption[] {
    const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    return monthly.map((m) => {
      // Escala consumo pelo Qtotal do mes relativo a media
      const monthScale = qtotalAvgKw > 0 ? m.qtotalKw / qtotalAvgKw : 1;
      const kwhDia = ratedInputPowerKW * hoursPerDay * taxaFuncionamento * monthScale;
      const kwhMes = kwhDia * monthDays[m.monthIndex];
      const custoBRLCents = Math.round((kwhMes * tariff.kwhBRLCents));
      return {
        monthIndex: m.monthIndex,
        monthName: monthNames[m.monthIndex],
        kwhConsumido: round1(kwhMes),
        custoBRLCents,
      };
    });
  }

  // ----- 6. Comparativo de custos por fonte -----

  /**
   * Compara o custo anual em diferentes fontes de aquecimento, pra mesma necessidade
   * de Kcal totais no ano.
   */
  computeComparativo(
    qtotalAnualKwh: number,
    copBombaCalor: number,
    tariff: TariffInput,
  ): ComparativoFonte[] {
    const qtotalAnualKcal = qtotalAnualKwh * CONVERSIONS.KWH_TO_KCAL;

    // Bomba de calor: consumo eletrico = qtotalKwh / COP
    const bombaConsumoKwh = copBombaCalor > 0 ? qtotalAnualKwh / copBombaCalor : qtotalAnualKwh;
    const bombaCusto = Math.round(bombaConsumoKwh * tariff.kwhBRLCents);

    // Eletrico direto (resistencia): consumo = qtotal / eficiencia
    const eletConsumoKwh = qtotalAnualKwh / CONVERSIONS.ELETRICO_EFICIENCIA;
    const eletCusto = Math.round(eletConsumoKwh * tariff.kwhBRLCents);

    // GLP: consumo = qtotal_kcal / (PCi × eficiencia)
    const glpConsumoKg = qtotalAnualKcal / (CONVERSIONS.GLP_KCAL_PER_KG * CONVERSIONS.GLP_EFICIENCIA);
    const glpCusto = Math.round(glpConsumoKg * tariff.glpKgBRLCents);

    // GN: consumo = qtotal_kcal / (PCi × eficiencia)
    const gnConsumoM3 = qtotalAnualKcal / (CONVERSIONS.GN_KCAL_PER_M3 * CONVERSIONS.GN_EFICIENCIA);
    const gnCusto = Math.round(gnConsumoM3 * tariff.gnM3BRLCents);

    return [
      { fonte: 'BOMBA_CALOR', kcalAnualEstimado: qtotalAnualKcal, consumoAnual: round1(bombaConsumoKwh), consumoUnidade: 'kWh', custoAnualBRLCents: bombaCusto },
      { fonte: 'GLP', kcalAnualEstimado: qtotalAnualKcal, consumoAnual: round1(glpConsumoKg), consumoUnidade: 'Kg', custoAnualBRLCents: glpCusto },
      { fonte: 'GN', kcalAnualEstimado: qtotalAnualKcal, consumoAnual: round1(gnConsumoM3), consumoUnidade: 'm³', custoAnualBRLCents: gnCusto },
      { fonte: 'ELETRICO', kcalAnualEstimado: qtotalAnualKcal, consumoAnual: round1(eletConsumoKwh), consumoUnidade: 'kWh', custoAnualBRLCents: eletCusto },
    ];
  }

  // ----- 7. Orquestrador completo -----

  /**
   * Computa relatorio completo de aquecimento.
   * Aceita candidatos de equipamento + tarifa de energia opcionais.
   */
  computeReport(
    inputs: HeatingInputs,
    options?: {
      candidates?: Parameters<HeatingService['selectEquipment']>[0];
      tariff?: TariffInput;
    },
  ): HeatingReport {
    const { resolved } = this.getClimateData(inputs.uf, inputs.cidade);

    // 1. Perda termica mensal
    const monthly = this.computeMonthlyHeatLoss(inputs);

    // 2. Q max/avg considerando modo de utilizacao (ano todo / verao / inverno)
    const activeMonths = getActiveMonths(inputs.utilizacaoAno);
    const activeQs = activeMonths.map((m) => monthly[m].qtotalKw);
    const qtotalMaxRawKw = Math.max(...activeQs);
    const qtotalAvgKw = activeQs.reduce((s, v) => s + v, 0) / activeQs.length;
    const qtotalMonthCritical = monthly.findIndex((m) => m.qtotalKw === qtotalMaxRawKw);

    // Aplica margem de seguranca (TAB006 P21 / planilha original 1.2)
    const margin = SAFETY_MARGIN[inputs.utilizacaoAno];
    const qtotalMaxKw = qtotalMaxRawKw * margin;

    // Calor necessario em kcal/h (pra auto-select usando kcalHNominal)
    const calorNecessarioKcalH = qtotalMaxKw * CONVERSIONS.KWH_TO_KCAL;
    const calorNecessarioBtuH = qtotalMaxKw * CONVERSIONS.KW_TO_BTU;

    const report: HeatingReport = {
      computedAt: new Date().toISOString(),
      cityResolved: resolved,
      inputs,
      monthlyHeatLoss: monthly,
      qtotalMaxKw: round1(qtotalMaxKw),
      qtotalAvgKw: round1(qtotalAvgKw),
      qtotalMonthCritical,
      calorNecessarioKcalH: Math.round(calorNecessarioKcalH),
      calorNecessarioBtuH: Math.round(calorNecessarioBtuH),
    };

    // 3. Selecao do equipamento
    if (options?.candidates && options.candidates.length > 0) {
      const sel = this.selectEquipment(options.candidates, qtotalMaxKw, inputs.utilizacaoAno);
      if (sel) {
        report.selectedEquipment = sel;

        // 4. Tempo de aquecimento + COP
        // Usa Qtotal medio como perda durante o aquecimento (estimativa pratica).
        // Quando borda infinita/cascata estao ligadas, a perda continua reduz a
        // capacidade efetiva do equipamento e o tempo pode subir muito (ou ficar
        // infeasible se a carga passar de 100% no mes critico).
        const tempIni = inputs.tempAguaInicial ?? this.getDefaultTempInicial(inputs.uf, inputs.cidade);
        const deltaT = Math.max(0, inputs.tempAguaDesejada - tempIni);
        const perdaMediaKcalH = qtotalAvgKw * CONVERSIONS.KWH_TO_KCAL;
        const time = this.computeTimeToHeat(inputs.volumeM3, deltaT, sel.kcalHNominal ?? 0, perdaMediaKcalH);
        report.timeToHeatHours = time.hours;
        report.degreesPerHour = time.degreesPerHour;
        report.timeToHeatInfeasible = time.isInfeasible;
        // COP usado nos calculos de consumo: prioriza ar 15°C (inverno BR, conservador).
        // copAt50Capacity (legado) tipicamente ja eh o valor de ar 15°C.
        report.copEstimated = sel.copAt50Air15 ?? sel.copAt50Capacity ?? sel.copNominal ?? 0;

        // 5. Consumo + custo
        if (options.tariff) {
          const hoursPerDay = inputs.horasFuncionamentoDia ?? HEATING_OPERATION_DEFAULTS.hoursPerDay;
          const taxa = inputs.taxaFuncionamento ?? HEATING_OPERATION_DEFAULTS.taxaFuncionamento;
          const ratedKw = sel.ratedInputPowerKW ?? (sel.consumoMedioW ? sel.consumoMedioW / 1000 : 0);
          if (ratedKw > 0) {
            const consumption = this.computeMonthlyConsumption(monthly, qtotalAvgKw, ratedKw, hoursPerDay, taxa, options.tariff);
            report.monthlyConsumption = consumption;
            report.annualKwh = round1(consumption.reduce((s, c) => s + c.kwhConsumido, 0));
            report.annualCostBRLCents = consumption.reduce((s, c) => s + c.custoBRLCents, 0);

            // Custo de aquecimento inicial (1 vez, energia pra subir tempIni → tempDesejada)
            const initialKwh = ratedKw * (report.timeToHeatHours ?? 0);
            report.initialHeatingCostBRLCents = Math.round(initialKwh * options.tariff.kwhBRLCents);

            // 6. Comparativo
            const qAnualKwh = activeQs.reduce((s, v) => s + v, 0) * 24 * 30 / 12; // estimativa simplificada (24h × 30d ×12) — TODO refinar
            report.comparativo = this.computeComparativo(qAnualKwh, report.copEstimated, options.tariff);
          }
        }
      }
    }

    return report;
  }

  // ----- Helpers -----

  /** Temperatura media inicial sugerida = temp ambiente media anual do estado (TAB006 P15). */
  private getDefaultTempInicial(uf: UFCode, cidade?: string): number {
    const { city } = this.getClimateData(uf, cidade);
    const avgTemp = city.tempMonthly.reduce((s, t) => s + t, 0) / 12;
    // TAB006 sugere ~5°C abaixo da media (a agua acompanha o ar com defasagem)
    return Math.round(avgTemp - 5);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
