// Motor de calculo do Aquecimento Solar. Replica formulas da planilha original
// (SOLAR + CALCULOS_SOLAR de ANDREIA SANTANA - Solis Piscinas).
//
// Service puro (sem Prisma). Recebe inputs + dados climaticos + coletor como parametros.
// Integracao com banco / PoolBudget fica em SolarBudgetService.

import { Injectable } from '@nestjs/common';
import {
  SOLAR_MULT_CAPA,
  SOLAR_MULT_VENTO,
  SOLAR_PERDA_BASE_MENSAL,
  SOLAR_EFICIENCIA_PADRAO,
  SOLAR_INSOLACAO_HORAS_PADRAO,
  SOLAR_FATOR_ENERGIA_KCAL,
  SOLAR_DELTA_REF_PADRAO,
  SOLAR_VAZAO_FATOR,
  SOLAR_BATERIA_MIN_COLETORES,
  SOLAR_BATERIA_MAX_COLETORES,
  SOLAR_VAZAO_DOBRA_BATERIAS,
  SOLAR_DEFAULT_COLETOR_AREA_M2,
  SOLAR_DEFAULT_COLETOR_KWH_M2,
  SOLAR_DEFAULT_COLETOR_EFICIENCIA,
} from './solar-constants';

// ============ TIPOS ============

export interface SolarInputs {
  // Dimensoes da piscina
  areaPiscinaM2: number;
  volumeM3: number;

  // Configuracao do aquecimento
  tempDesejada: number;        // 20-40 °C
  capa: 'SIM' | 'NAO';
  vento: 'FRACO' | 'MODERADO' | 'FORTE';

  // Slider J42 da planilha — extra coletores 0-10 (cada unidade = +10% area)
  extraColetoresPct: number;

  // Dados climaticos resolvidos (vem do ClimateData via SolarBudgetService)
  // - tempAmbiente: temp do ar mensal °C (jan..dez)
  // - radSol: kWh/m²/dia mensal (jan..dez)
  climate: {
    name: string;          // ex: "Cuiaba", "Sao Paulo"
    tempAmbiente: number[]; // 12 valores
    radSol: number[];       // 12 valores
  };

  // Coletor escolhido — pode vir do Product (technicalSpecs) ou padrao
  coletor: {
    productId?: string;
    modelName: string;
    areaM2: number;        // m²/coletor
    kwhPorM2?: number;      // kWh/m² (default SOLAR_DEFAULT_COLETOR_KWH_M2)
    eficiencia?: number;    // 0..1 (default SOLAR_DEFAULT_COLETOR_EFICIENCIA)
  };
}

export interface SolarMonthlyRow {
  monthIndex: number;             // 0..11
  monthName: string;
  tempAmbiente: number;            // °C
  radSol: number;                  // kWh/m²/dia
  perdaCorrigidaPorDia: number;    // °C/dia perdidos durante a noite
  ganhoDia: number;                // °C/dia ganho com sol
  // Simulacao 4 dias consecutivos (1 dia ensolarado + 3 noites de perda)
  tempInicial1d: number;
  tempFinal1d: number;
  tempFinal2d: number;
  tempFinal3d: number;
  tempFinal4d: number;
}

export interface SolarReport {
  computedAt: string;
  resolved: { uf?: string; cidade?: string; name: string };

  // ===== Dimensionamento (SOLAR!H34:H40) =====
  areaPiscinaM2: number;
  m2ColetorNecessario: number;      // H35
  qtdColetores: number;              // H36 = coletoresPorBateria * numBaterias
  qtdInicial: number;                // antes de redistribuir em baterias
  numBaterias: number;               // H37
  coletoresPorBateria: number;
  vazaoTotalM3h: number;             // H38
  areaTotalColetoresM2: number;      // H39
  percentualCobertura: number;       // H40 (%)

  // ===== Coletor selecionado =====
  selectedCollector: {
    productId?: string;
    modelName: string;
    areaM2: number;
    kwhPorM2: number;
    eficiencia: number;
    kcalHTotal: number; // soma de todos coletores
  };

  // ===== 12 meses + resumo =====
  monthly: SolarMonthlyRow[];
  monthlyAvgGanho: number;            // °C/dia medio
  monthlyMinTempFinal: number;        // pior mes (menor temp final 4d)
  monthlyMaxTempFinal: number;        // melhor mes

  // ===== Energia + custo (Fase futura — Comparativo) =====
  energiaSolarKcalH: number;          // CALCULOS_SOLAR!L9
  kcalPara1Grau: number;              // CALCULOS_SOLAR!L8

  // Inputs ecoados pro frontend
  inputs: SolarInputs;
}

// ============ SERVICE ============

@Injectable()
export class SolarService {
  /** Replicacao fiel das formulas SOLAR!H34:H40 + CALCULOS_SOLAR!L8:L12. */
  computeSolarReport(inputs: SolarInputs): SolarReport {
    const area = inputs.areaPiscinaM2;
    const volume = inputs.volumeM3;
    const tempDesejada = inputs.tempDesejada;
    const multCapa = SOLAR_MULT_CAPA[inputs.capa];
    const multVento = SOLAR_MULT_VENTO[inputs.vento];

    // === H35: m² de coletor necessario ===
    // = mult_capa × (1 + extra × 0.1) × area_piscina
    const m2Necessario = multCapa * (1 + (inputs.extraColetoresPct ?? 0) * 0.1) * area;

    // === H36: qtd coletores (organiza em baterias 5-8) ===
    const areaColetor = inputs.coletor.areaM2 || SOLAR_DEFAULT_COLETOR_AREA_M2;
    const qtdInicial = Math.round(m2Necessario / areaColetor);
    const numBaterias = qtdInicial === 0 ? 0 : Math.ceil(qtdInicial / SOLAR_BATERIA_MAX_COLETORES);
    const coletoresPorBateria = numBaterias === 0
      ? 0
      : Math.max(SOLAR_BATERIA_MIN_COLETORES, Math.min(SOLAR_BATERIA_MAX_COLETORES, Math.round(qtdInicial / numBaterias)));
    const qtdTotal = coletoresPorBateria * numBaterias;

    // === H38: vazao (m³/h) ===
    const vazaoBase = coletoresPorBateria * areaColetor * SOLAR_VAZAO_FATOR;
    const vazaoTotal = numBaterias >= SOLAR_VAZAO_DOBRA_BATERIAS ? vazaoBase * 2 : vazaoBase;

    // === H39: m² total dos coletores ===
    const areaTotal = qtdTotal * areaColetor;

    // === H40: % cobertura ===
    const percentualCobertura = area > 0 ? (areaTotal / area) * 100 : 0;

    // === CALCULOS_SOLAR!L8: kcal pra elevar 1°C todo o volume ===
    // L8 = L3 × 1000 = volume_m³ × 1000 kg × 1 kcal/(kg·°C)
    const kcalPara1Grau = volume * 1000;

    // === CALCULOS_SOLAR!L9: energia solar produzida em kcal/h ===
    // L9 = area_total × RadSol × 1400 × eficiencia / insolacao_horas
    // Mas como aqui usamos radSol mensal, calculamos por mes mais abaixo.
    // Para o resumo "L9", uso a media anual da radSol.
    const eficiencia = inputs.coletor.eficiencia ?? SOLAR_DEFAULT_COLETOR_EFICIENCIA;
    const insolacaoH = SOLAR_INSOLACAO_HORAS_PADRAO;
    const radSolMedia = inputs.climate.radSol.reduce((s, v) => s + v, 0) / 12;
    const energiaSolarKcalH = (areaTotal * radSolMedia * SOLAR_FATOR_ENERGIA_KCAL * eficiencia) / insolacaoH;

    // === Tabela78 / Tabela72 — perdas + ganhos mensais com simulacao 4 dias ===
    const monthly: SolarMonthlyRow[] = [];
    for (let m = 0; m < 12; m++) {
      const perdaBase = SOLAR_PERDA_BASE_MENSAL[m];
      const perdaCorrigida = perdaBase * multCapa * multVento;
      const tempAmb = inputs.climate.tempAmbiente[m];
      const radSol = inputs.climate.radSol[m];

      // Ganho por dia (°C/dia) — formula da planilha SOLAR!M51-M62:
      //   ganho = radSol × EnergiaSolar_kcal_hora / kcal_para_1grau
      // ATENCAO: planilha usa EnergiaSolar_kcal_hora global (anual), entao
      // o "ganho dia" eh proporcional à radSol DAQUELE mes vs RadSol media.
      const ganhoDia = kcalPara1Grau > 0
        ? (radSol * energiaSolarKcalH) / kcalPara1Grau
        : 0;

      // Simulacao 4 dias (Tabela72):
      //   Temp inicial 1d = tempAmb (estado natural antes do aquecimento)
      //   Temp final 1d = MIN(tempDesejada, tempInicial1d + ganhoDia)
      //   Temp inicial 2d = tempFinal1d - perdaCorrigida (noite)
      //   Temp final 2d = MIN(tempDesejada, tempInicial2d + ganhoDia)
      //   ... e assim por 3 noites
      const tempInicial1d = tempAmb;
      const tempFinal1d = Math.min(tempDesejada, tempInicial1d + ganhoDia);
      const tempFinal2d = Math.min(tempDesejada, Math.max(0, tempFinal1d - perdaCorrigida) + ganhoDia);
      const tempFinal3d = Math.min(tempDesejada, Math.max(0, tempFinal2d - perdaCorrigida) + ganhoDia);
      const tempFinal4d = Math.min(tempDesejada, Math.max(0, tempFinal3d - perdaCorrigida) + ganhoDia);

      monthly.push({
        monthIndex: m,
        monthName: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m],
        tempAmbiente: tempAmb,
        radSol,
        perdaCorrigidaPorDia: perdaCorrigida,
        ganhoDia,
        tempInicial1d,
        tempFinal1d,
        tempFinal2d,
        tempFinal3d,
        tempFinal4d,
      });
    }

    const ganhoAvg = monthly.reduce((s, r) => s + r.ganhoDia, 0) / 12;
    const tempFinalMin = Math.min(...monthly.map((r) => r.tempFinal4d));
    const tempFinalMax = Math.max(...monthly.map((r) => r.tempFinal4d));

    return {
      computedAt: new Date().toISOString(),
      resolved: { name: inputs.climate.name },
      areaPiscinaM2: area,
      m2ColetorNecessario: round2(m2Necessario),
      qtdColetores: qtdTotal,
      qtdInicial,
      numBaterias,
      coletoresPorBateria,
      vazaoTotalM3h: round2(vazaoTotal),
      areaTotalColetoresM2: round2(areaTotal),
      percentualCobertura: round1(percentualCobertura),
      selectedCollector: {
        productId: inputs.coletor.productId,
        modelName: inputs.coletor.modelName,
        areaM2: areaColetor,
        kwhPorM2: inputs.coletor.kwhPorM2 ?? SOLAR_DEFAULT_COLETOR_KWH_M2,
        eficiencia,
        kcalHTotal: round0((inputs.coletor.kwhPorM2 ?? SOLAR_DEFAULT_COLETOR_KWH_M2) * areaTotal * 860),
      },
      monthly: monthly.map((r) => ({
        ...r,
        tempAmbiente: round1(r.tempAmbiente),
        radSol: round2(r.radSol),
        perdaCorrigidaPorDia: round2(r.perdaCorrigidaPorDia),
        ganhoDia: round2(r.ganhoDia),
        tempInicial1d: round1(r.tempInicial1d),
        tempFinal1d: round1(r.tempFinal1d),
        tempFinal2d: round1(r.tempFinal2d),
        tempFinal3d: round1(r.tempFinal3d),
        tempFinal4d: round1(r.tempFinal4d),
      })),
      monthlyAvgGanho: round2(ganhoAvg),
      monthlyMinTempFinal: round1(tempFinalMin),
      monthlyMaxTempFinal: round1(tempFinalMax),
      energiaSolarKcalH: round0(energiaSolarKcalH),
      kcalPara1Grau,
      inputs,
    };
  }
}

function round0(n: number): number { return Math.round(n); }
function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
