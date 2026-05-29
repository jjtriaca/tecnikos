/**
 * thermal-demand.service.ts (v1.12.84) — calculo CENTRAL de demanda termica
 * da piscina + oferta solar + horas de operacao da bomba. Unico ponto de
 * verdade pra qualquer tela que precise saber:
 *   - quanta energia (kWh/mes) a piscina demanda pra manter temp alvo
 *   - quanto os coletores ofertam por mes (kWh/mes solar)
 *   - cobertura solar (fracao da demanda atendida pelo sol)
 *   - horas/dia de operacao da bomba (= tempo de sol necessario pra repor perda)
 *   - consumo eletrico mensal da bomba (potencia × horas × 30)
 *
 * Fatores considerados (TODOS) — ver memory/sistema_impressao_pdf_simulador.md:
 *   1. Capa termica (mult perdas)
 *   2. Vento (mult perdas + evaporacao)
 *   3. Temp inicial e alvo (ΔT define demanda termica)
 *   4. Orientacao + inclinacao do telhado (fator de ganho solar)
 *   5. Localizacao climatica (UF/cidade → tempAr[12], radSol[12], humidity[12])
 *   6. Producao por m² do coletor (kwhPorM2 + eficiencia)
 *   7. Area de perda + volume da piscina
 *   8. Tipo de construcao (aberta/coberta/climatizada)
 *   9. Tipo de piscina (privativa/coletiva/spa)
 *  10. Utilizacao (ano todo/verao/inverno · mes todo/FDS)
 *  11. Extras (hidromassagem, cascata, borda infinita) — cada um com qty + horas
 *  12. Qtd coletores instalados (define oferta total)
 *  13. Latitude (via UF) — define duracao sol + inclinacao ideal
 *  14. Umidade relativa (mensal) — afeta evaporacao
 *
 * Estrategia: REUSA HeatingService.computeHeatingReport() por composicao.
 * Esse cobre TUDO de perdas (Tabela78). Aqui acrescentamos:
 *   - oferta solar (qtd × area × radSol × eficiencia × fator_instalacao)
 *   - metricas derivadas (cobertura, horas bomba, consumo bomba)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { HeatingService, HeatingInputs, MonthlyHeatLoss } from './heating.service';
import { ClimateDataService } from './climate-data.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SOLAR_LATITUDE_ABS_BY_UF,
  SOLAR_DEFAULT_COLETOR_EFICIENCIA,
  calcFatorInstalacao,
} from './solar-constants';

// ============ Constantes do modelo simplificado de perdas (v1.12.90) ============
//
// Substitui o heating.service.computeMonthlyHeatLoss (Tabela78) que estava
// inflando perdas 5-10x. Calibrado com literatura Carrier/ASHRAE pra valores
// realistas (150-600 W/m² total).

// Perda termica BASE (W/m²) — perda media 24h em condicoes de referencia
// (vento moderado, alvo 35°C, T_amb 22°C, construcao aberta).
const PERDA_BASE_WM2 = {
  COM_CAPA: 120,   // SIM — capa reduz evaporacao em ~64% (literatura)
  SEM_CAPA: 330,   // NAO — evaporacao + conveccao + radiacao plenas
};
const VENTO_MULT: Record<string, number> = {
  NULO: 0.5, FRACO: 0.7, MODERADO: 1.0, FORTE: 1.5, INTERNA: 0.5,
};
const CONSTRUCAO_MULT: Record<string, number> = {
  ABERTA: 1.0,
  COBERTA: 0.7,        // teto reduz radiacao + vento na superficie
  FECHADA: 0.7,        // sinonimo de coberta (legado)
  CLIMATIZADA: 0.5,    // ambiente controlado, menor perda
};
const DELTA_T_BASE = 13;       // °C — ΔT(35 alvo − 22 ambiente) referencia
const MIN_PERDA_WM2 = 30;      // floor — sempre tem alguma perda residual

// Extras (kW por unidade, em uso continuo). Multiplicado por (horas/168).
const EXTRAS_KW_REF = {
  hidromassagemPorUnidade: 4.0,   // SPA medio
  cascataPorMetroLargura: 3.0,    // ~3 kW por metro de borda
  bordaInfinitaPorMetro: 2.0,     // ~2 kW por metro linear
};

// v1.12.91: floor minimo do fator de utilizacao da bomba.
// Modela controlador diferencial padrao (liga quando T_coletor > T_piscina + ΔT_min,
// desliga quando volta a equalizar). Bomba opera ~85% do HSE independente da
// cobertura solar (mesmo quando piscina ja atingiu alvo, controlador continua
// circulando enquanto coletor estiver mais quente).
// Sem floor, em meses de verao com qSolar >> qPerdas, fator caia pra 30-40%
// gerando 1-2h/dia de operacao — irrealista pra instalacoes brasileiras.
const FLOOR_FATOR_BOMBA = 0.85;

// v1.12.91: multiplicador "horas reais de operacao" sobre o HSP_inclinado.
// HSP (Horas de Sol Pleno) eh sol DIRETO equivalente — bomba opera tambem em
// horas de luminosidade DIFUSA (manha cedo, tarde com sol baixo), por isso o
// total real eh ~1.3x o HSP. Tipico de instalacoes brasileiras.
const FATOR_HORAS_OPERACAO_REAL = 1.3;

// v1.12.93: rendimento medio de bombas centrifugas de piscina.
// Bomba real consome mais potencia eletrica do que entrega na agua (perdas
// mecanicas + perdas no motor). Rendimento global tipico: 60-75%.
// Conversao: P_eletrica = P_mecanica / rendimento
//          = (cv × 0.7355) / 0.65
// Antes: assumimos rendimento 100% (subestimava consumo ~50%).
const RENDIMENTO_BOMBA_MEDIO = 0.65;

// v1.12.93: fator de vazao na operacao da bomba.
// Bomba com vazao MAIOR que a necessaria circula a agua mais rapido,
// fazendo o coletor esfriar mais rapido — controlador diferencial desliga
// antes. Inversamente: bomba sub-dimensionada opera mais tempo.
//
// Modelo: fatorVazao = clamp(0.7, 1.3, vazaoSolar / vazaoBomba)
//  - vazaoBomba >> vazaoSolar: clamp 0.7 (controlador tem histerese, nao
//    desliga instantaneo)
//  - vazaoBomba << vazaoSolar: clamp 1.3 (nao opera mais que +30%)
const FATOR_VAZAO_MIN = 0.7;
const FATOR_VAZAO_MAX = 1.3;

export interface ThermalDemandInputs {
  // Reusa HeatingInputs como base — todos os campos de perdas, extras, uso, clima
  heating: HeatingInputs;

  // Radiacao solar mensal (kWh/m²/dia). Buscar via ClimateDataService antes
  // de chamar este service. Se omitido, usa 5 (media BR) — fallback fraco.
  radSolPorMes?: number[]; // length 12

  // Solar — opcional (so se quiser oferta + consumo bomba)
  solar?: {
    qtdColetores: number;
    coletor: {
      areaM2: number;           // area unitaria do coletor (ex: 4.48)
      kwhPorM2: number;         // kWh/mes/m² (producao especifica cadastrada)
      eficiencia: number;       // 0..1 (default 0.75)
    };
    orientacaoTelhado?: string; // N/NE/L/SE/S/SO/O/NO
    inclinacaoTelhadoGraus?: number;
    bomba?: {
      potenciaCv: number;       // pra calcular consumo eletrico
      vazaoM3h?: number;        // v1.12.93: pra calcular fator de vazao
    };
    vazaoSolarM3h?: number;     // v1.12.93: vazao solar necessaria (do solar report)
  };
}

export interface ThermalDemandMonthly {
  monthIndex: number;
  monthName: string;
  tempAmbiente: number;
  humidity: number;

  // === Demanda termica (perdas) ===
  qPerdasKwhDia: number;        // kWh/dia perdidos pela piscina (todas as perdas integradas 24h)
  qPerdasKwhMes: number;        // × 30

  // === Oferta solar (se coletor informado) ===
  hseHorasDia?: number;         // Horas de Sol Equivalente do mes (= radSol)
  qSolarKwhDia?: number;        // kWh/dia que os coletores entregam (= qtd × area × radSol × ef × fInst)
  qSolarKwhMes?: number;
  coberturaSolarPct?: number;   // qSolar / qPerdas × 100

  // === Bomba (se solar.bomba informado) ===
  fatorUtilizacaoBomba?: number; // 0..1 — fracao do HSE que a bomba precisa operar
  bombaHorasDia?: number;        // HSE × min(1, qPerdas/qSolar)
  bombaConsumoKwhMes?: number;   // potencia_kW × horas_dia × 30
}

export interface ThermalDemandReport {
  monthly: ThermalDemandMonthly[];

  // === Anuais (medias) ===
  qPerdasMediaKwhDia: number;
  qPerdasMediaKwhMes: number;
  qPerdasPicoKwhDia: number;     // mes critico (geralmente inverno)

  // === Solar ===
  qSolarMediaKwhDia?: number;
  qSolarMediaKwhMes?: number;
  coberturaSolarMediaPct?: number;

  // === Bomba ===
  bombaHorasDiaMedio?: number;
  bombaConsumoKwhMesMedio?: number;
  bombaPotenciaKW?: number;

  // === Inputs ecoados pra debug + UI ===
  inputs: {
    tempAlvo: number;
    tempInicial?: number;
    capaTermica: boolean;
    vento: string;
    tipoConstrucao?: string;
    areaM2: number;
    volumeM3: number;
    qtdColetores?: number;
    areaTotalColetorM2?: number;
    orientacaoTelhado?: string;
    inclinacaoTelhadoGraus?: number;
    fatorInstalacao?: number;
    // v1.12.90: componentes da formula simplificada (pra debug)
    perdaBaseWm2?: number;
    ventoMult?: number;
    construcaoMult?: number;
    deltaTBaseAnualMult?: number;
    extrasKwTotal?: number;
    // v1.12.91: Indice Solarimetrico Ajustado
    hspInclinadoMedio?: number;
    floorFatorBomba?: number;
    fatorHorasOperacaoReal?: number;
    // v1.12.93: rendimento bomba + fator vazao
    rendimentoBomba?: number;
    vazaoBombaM3h?: number;
    vazaoSolarM3h?: number;
    fatorVazao?: number;
  };
}

@Injectable()
export class ThermalDemandService {
  constructor(
    private readonly heating: HeatingService,
    private readonly climateData: ClimateDataService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Atalho: monta inputs a partir de um PoolBudget (le environmentParams,
   * poolDimensions, solarReport, climate) e calcula. Aceita overrides pra UI
   * testar cenarios sem salvar.
   */
  async computeForBudget(
    budgetId: string,
    companyId: string,
    overrides?: {
      tempAlvo?: number;
      tempInicial?: number;
      capaTermica?: boolean;
      vento?: 'FRACO' | 'MODERADO' | 'FORTE';
      qtdColetores?: number;
      orientacaoTelhado?: string;
      inclinacaoTelhadoGraus?: number;
      potenciaCv?: number; // bomba selecionada
      vazaoBombaM3h?: number; // v1.12.93: pra fator de vazao
      areaPiscinaM2?: number;
      volumeM3?: number;
    },
  ): Promise<ThermalDemandReport> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { poolDimensions: true, environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    const dims = (budget.poolDimensions ?? {}) as Record<string, any>;
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const solarReport = (env.solarReport ?? {}) as Record<string, any>;
    const solarOverride = (env.solarOverride ?? {}) as Record<string, any>;

    const uf = (env.uf ?? 'SP') as string;
    const cidade = (env.cidade ?? null) as string | null;

    // === Clima do tenant ===
    const climate = await this.climateData.findForLookup(companyId, uf, cidade);
    const radSolPorMes = climate?.radSol ?? new Array(12).fill(5);
    // v1.12.90: passa temp/humidity pra formula simplificada (perda escala com ΔT-ambiente)
    const tempByMonth = climate?.temp ?? new Array(12).fill(22);
    const humidityByMonth = climate?.humidity ?? new Array(12).fill(0.65);

    // === Coletor (do solarReport persistido) ===
    const sel = solarReport.selectedCollector as Record<string, any> | undefined;
    const coletorAreaM2 = Number(sel?.areaM2) || 4.48;
    const coletorKwhPorM2 = Number(sel?.kwhPorM2) || 0;
    const coletorEficiencia = Number(sel?.eficiencia) || SOLAR_DEFAULT_COLETOR_EFICIENCIA;

    const qtdColetoresEfetivo =
      overrides?.qtdColetores ??
      Number(solarReport.qtdColetores) ?? 0;

    // === Inputs unificados ===
    const inputs: ThermalDemandInputs = {
      heating: {
        areaM2: overrides?.areaPiscinaM2 ?? Number(dims.area) ?? 0,
        volumeM3: overrides?.volumeM3 ?? Number(dims.volume) ?? 0,
        uf: uf as any,
        cidade: cidade ?? undefined,
        tempAguaDesejada: overrides?.tempAlvo ?? Number(env.temperaturaAguaDesejada) ?? 30,
        tempAguaInicial: overrides?.tempInicial ?? (env.temperaturaInicialAgua as number | undefined),
        vento: (overrides?.vento ??
          ((env.velocidadeVento ?? env.vento ?? 'MODERADO') as string).toUpperCase()) as any,
        tipoConstrucao: ((env.tipoConstrucao ?? 'ABERTA') as string).toUpperCase() as any,
        tipoPiscina: ((env.tipoPiscina ?? 'PRIVATIVA') as string).toUpperCase() as any,
        capaTermica: overrides?.capaTermica ?? (env.capaTermica !== false),
        utilizacaoAno: ((env.utilizacaoAno ?? 'ANO_TODO') as string).toUpperCase() as any,
        utilizacaoSemana: ((env.utilizacaoSemana ?? 'MES_TODO') as string).toUpperCase() as any,
        hidromassagensQtd: Number(env.hidromassagensQtd) || 0,
        hidromassagemHorasSemana: env.hidromassagemHorasSemana != null ? Number(env.hidromassagemHorasSemana) : undefined,
        cascataLarguraCm: Number(env.cascataLarguraCm) || 0,
        cascataHorasSemana: env.cascataHorasSemana != null ? Number(env.cascataHorasSemana) : undefined,
        bordaInfinitaM: Number(env.bordaInfinitaM) || 0,
        bordaInfinitaAlturaM: env.bordaInfinitaAlturaM != null ? Number(env.bordaInfinitaAlturaM) : undefined,
        bordaInfinitaVazaoLminPorM: env.bordaInfinitaVazaoLminPorM != null ? Number(env.bordaInfinitaVazaoLminPorM) : undefined,
        bordaInfinitaHorasAtivaDia: env.bordaInfinitaHorasAtivaDia != null ? Number(env.bordaInfinitaHorasAtivaDia) : undefined,
      },
      radSolPorMes,
      ...(qtdColetoresEfetivo > 0 && coletorKwhPorM2 > 0
        ? {
            solar: {
              qtdColetores: qtdColetoresEfetivo,
              coletor: {
                areaM2: coletorAreaM2,
                kwhPorM2: coletorKwhPorM2,
                eficiencia: coletorEficiencia,
              },
              orientacaoTelhado:
                overrides?.orientacaoTelhado ?? (env.orientacaoTelhado as string | undefined),
              inclinacaoTelhadoGraus:
                overrides?.inclinacaoTelhadoGraus ?? (env.inclinacaoTelhadoGraus as number | undefined),
              ...(overrides?.potenciaCv != null && {
                bomba: {
                  potenciaCv: overrides.potenciaCv,
                  // v1.12.93: vazao da bomba (do form) pra calcular fator de vazao
                  vazaoM3h: overrides.vazaoBombaM3h,
                },
              }),
              // v1.12.93: vazao solar necessaria (do solar report) pra fator de vazao
              vazaoSolarM3h: Number(solarReport.vazaoTotalM3h) || undefined,
            },
          }
        : {}),
    };

    // Anexa clima pre-resolvido — usado pela formula simplificada (sem dep do Prisma).
    (inputs as any)._climateTempByMonth = tempByMonth;
    (inputs as any)._climateHumidityByMonth = humidityByMonth;
    return this.compute(inputs);
  }

  /**
   * Calcula demanda termica + oferta solar + consumo bomba em UM lugar.
   * Resultado consumido por: card da bomba do Simulador Solar, dimensionamento
   * de bomba de calor, comparativo de fontes, futuro DRE termico.
   */
  /**
   * v1.12.90: calculo simplificado de perdas termicas (W/m² calibrado vs
   * literatura). Substitui heating.service.computeMonthlyHeatLoss que estava
   * inflando perdas ~5-10x (BETA_INV de conversao mmHg gerava 1500 W/m² absurdo
   * pra piscina sem capa, quando o real eh 250-400 W/m²).
   *
   * Modelo: perda = base(capa) × vento × construcao × ΔT(alvo-ambiente)/13
   * + extras (hidro, cascata, borda) ponderados por horas de uso.
   *
   * Retorna formato compativel com MonthlyHeatLoss[] pra nao quebrar resto do flow.
   */
  private computeSimplifiedLosses(
    h: HeatingInputs,
    climateTempByMonth: number[],
    climateHumidityByMonth: number[],
  ): MonthlyHeatLoss[] {
    const baseWm2 = h.capaTermica ? PERDA_BASE_WM2.COM_CAPA : PERDA_BASE_WM2.SEM_CAPA;
    const ventoMult = VENTO_MULT[String(h.vento).toUpperCase()] ?? 1.0;
    const construMult = CONSTRUCAO_MULT[String(h.tipoConstrucao).toUpperCase()] ?? 1.0;

    // Extras (constantes pelo ano — ponderado por horas de uso/semana)
    const hidroQty = Number(h.hidromassagensQtd) || 0;
    const hidroHs = h.hidromassagemHorasSemana != null ? Number(h.hidromassagemHorasSemana) : 6;
    const hidroKw = hidroQty * EXTRAS_KW_REF.hidromassagemPorUnidade
                    * Math.max(0, Math.min(1, hidroHs / 168));

    const cascCm = Number(h.cascataLarguraCm) || 0;
    const cascHs = h.cascataHorasSemana != null ? Number(h.cascataHorasSemana) : 6;
    const cascKw = (cascCm / 100) * EXTRAS_KW_REF.cascataPorMetroLargura
                    * Math.max(0, Math.min(1, cascHs / 168));

    const bordaM = Number(h.bordaInfinitaM) || 0;
    const bordaHd = h.bordaInfinitaHorasAtivaDia != null ? Number(h.bordaInfinitaHorasAtivaDia) : 24;
    const bordaKw = bordaM * EXTRAS_KW_REF.bordaInfinitaPorMetro
                    * Math.max(0, Math.min(1, bordaHd / 24));

    const extrasKwTotal = hidroKw + cascKw + bordaKw;

    const result: MonthlyHeatLoss[] = [];
    for (let m = 0; m < 12; m++) {
      const tempAr = climateTempByMonth[m] ?? 22;
      const humidity = climateHumidityByMonth[m] ?? 0.65;

      // ΔT escala linear (0 quando alvo = ambiente, 1 quando ΔT = 13°C, >1 quando maior)
      const deltaT = Math.max(0, h.tempAguaDesejada - tempAr);
      const deltaTMult = Math.max(0.1, deltaT / DELTA_T_BASE);

      // W/m² efetivo + floor
      const wPorM2 = Math.max(
        MIN_PERDA_WM2,
        baseWm2 * ventoMult * construMult * deltaTMult,
      );

      // kW da piscina (W/m² × area / 1000)
      const qPiscinaKw = (wPorM2 * h.areaM2) / 1000;
      const qsKw = qPiscinaKw; // compat com schema MonthlyHeatLoss
      const qsExtraKw = 0;     // ja incluso na qPiscinaKw
      const qtotalKw = qsKw + extrasKwTotal;

      result.push({
        monthIndex: m,
        tempAr,
        humidity,
        qsKw: Math.round(qsKw * 10) / 10,
        qsExtraKw,
        qsExtrasKw: Math.round(extrasKwTotal * 10) / 10,
        qtotalKw: Math.round(qtotalKw * 10) / 10,
      });
    }
    return result;
  }

  compute(inputs: ThermalDemandInputs): ThermalDemandReport {
    // === 1) Perdas mensais via formula simplificada (v1.12.90) ===
    // Antes usava heating.service.computeMonthlyHeatLoss (Tabela78) que estava
    // inflando perdas 5-10x devido a confusao de unidades (BETA_INV mmHg).
    // Buscar climate pra ter tempAr + humidity por mes.
    // Como o compute() puro nao tem PrismaService, recebemos os dados via inputs.heating
    // ja resolvidos OU usamos defaults. computeForBudget pre-carrega o climate.
    const climateTempByMonth = (inputs as any)._climateTempByMonth as number[] | undefined
      ?? new Array(12).fill(22);
    const climateHumidityByMonth = (inputs as any)._climateHumidityByMonth as number[] | undefined
      ?? new Array(12).fill(0.65);
    const monthlyLoss: MonthlyHeatLoss[] = this.computeSimplifiedLosses(
      inputs.heating,
      climateTempByMonth,
      climateHumidityByMonth,
    );

    // === 2) Oferta solar (se coletor fornecido) ===
    let fatorInstalacao = 1;
    let areaTotalColetorM2: number | undefined;
    let qSolarPorM2DiaCalc: ((rad: number) => number) | null = null;

    if (inputs.solar) {
      const s = inputs.solar;
      const eficiencia = s.coletor.eficiencia ?? SOLAR_DEFAULT_COLETOR_EFICIENCIA;
      areaTotalColetorM2 = s.qtdColetores * s.coletor.areaM2;
      const latAbs = SOLAR_LATITUDE_ABS_BY_UF[inputs.heating.uf];
      fatorInstalacao = calcFatorInstalacao(
        s.orientacaoTelhado,
        s.inclinacaoTelhadoGraus,
        latAbs,
      );
      // qSolar/dia (kWh) = area_total × radSol (kWh/m²/dia) × eficiencia × fator_instalacao
      qSolarPorM2DiaCalc = (radSol: number) => radSol * eficiencia * fatorInstalacao;
    }

    // v1.12.93: potencia eletrica = potencia mecanica / rendimento (~0.65 medio).
    // Antes assumia rendimento 100%, subestimava o consumo eletrico em ~50%.
    const potenciaKW = inputs.solar?.bomba
      ? (inputs.solar.bomba.potenciaCv * 0.7355) / RENDIMENTO_BOMBA_MEDIO
      : undefined;

    // === 3) Montagem do mensal ===
    const MES_NOMES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const radSolByMonth = inputs.radSolPorMes && inputs.radSolPorMes.length === 12
      ? inputs.radSolPorMes
      : new Array(12).fill(5);

    const monthly: ThermalDemandMonthly[] = monthlyLoss.map((m, i) => {
      // qtotalKw eh potencia instantanea (kW) — integrar 24h pra kWh/dia
      const qPerdasKwhDia = m.qtotalKw * 24;
      const qPerdasKwhMes = qPerdasKwhDia * 30;

      const out: ThermalDemandMonthly = {
        monthIndex: i,
        monthName: MES_NOMES[i],
        tempAmbiente: m.tempAr,
        humidity: m.humidity,
        qPerdasKwhDia: round1(qPerdasKwhDia),
        qPerdasKwhMes: round1(qPerdasKwhMes),
      };

      if (qSolarPorM2DiaCalc && areaTotalColetorM2 != null) {
        const hse = radSolByMonth[i];
        const qSolarKwhDia = areaTotalColetorM2 * qSolarPorM2DiaCalc(hse);
        const qSolarKwhMes = qSolarKwhDia * 30;
        const cobertura = qPerdasKwhDia > 0 ? (qSolarKwhDia / qPerdasKwhDia) * 100 : 0;

        out.hseHorasDia = round2(hse);
        out.qSolarKwhDia = round1(qSolarKwhDia);
        out.qSolarKwhMes = round1(qSolarKwhMes);
        out.coberturaSolarPct = round1(cobertura);

        if (potenciaKW != null) {
          // v1.12.93: fator de vazao da bomba.
          // Bomba com vazao > vazao necessaria → coletor esfria mais rapido →
          // controlador diferencial desliga antes → bomba opera menos horas.
          // Inversamente: bomba sub-dimensionada opera mais.
          //
          //   fatorVazao = clamp(0.7, 1.3, vazaoSolar / vazaoBomba)
          const vazaoSolar = inputs.solar?.vazaoSolarM3h ?? 0;
          const vazaoBomba = inputs.solar?.bomba?.vazaoM3h ?? 0;
          const fatorVazao = (vazaoBomba > 0 && vazaoSolar > 0)
            ? Math.max(FATOR_VAZAO_MIN, Math.min(FATOR_VAZAO_MAX, vazaoSolar / vazaoBomba))
            : 1.0;

          //  fatorBase = min(1, qPerdas/qSolar)
          //  fator = max(FLOOR_FATOR_BOMBA, fatorBase)
          //  horasDia = HSE × fator × FATOR_HORAS_OPERACAO_REAL × fatorVazao
          const fatorBase = qSolarKwhDia > 0 ? Math.min(1, qPerdasKwhDia / qSolarKwhDia) : 1;
          const fator = Math.max(FLOOR_FATOR_BOMBA, fatorBase);
          const horasDia = hse * fator * FATOR_HORAS_OPERACAO_REAL * fatorVazao;
          const consumoKwhMes = potenciaKW * horasDia * 30;

          out.fatorUtilizacaoBomba = round2(fator);
          out.bombaHorasDia = round2(horasDia);
          out.bombaConsumoKwhMes = round1(consumoKwhMes);
        }
      }
      return out;
    });

    // === 4) Agregados anuais ===
    const qPerdasMediaKwhDia = monthly.reduce((s, m) => s + m.qPerdasKwhDia, 0) / 12;
    const qPerdasPicoKwhDia = Math.max(...monthly.map((m) => m.qPerdasKwhDia));

    const solarMonths = monthly.filter((m) => m.qSolarKwhDia != null);
    const qSolarMediaKwhDia = solarMonths.length
      ? solarMonths.reduce((s, m) => s + (m.qSolarKwhDia ?? 0), 0) / solarMonths.length
      : undefined;
    const coberturaSolarMediaPct = solarMonths.length
      ? solarMonths.reduce((s, m) => s + (m.coberturaSolarPct ?? 0), 0) / solarMonths.length
      : undefined;

    const bombaMonths = monthly.filter((m) => m.bombaHorasDia != null);
    const bombaHorasDiaMedio = bombaMonths.length
      ? bombaMonths.reduce((s, m) => s + (m.bombaHorasDia ?? 0), 0) / bombaMonths.length
      : undefined;
    const bombaConsumoKwhMesMedio = bombaMonths.length
      ? bombaMonths.reduce((s, m) => s + (m.bombaConsumoKwhMes ?? 0), 0) / bombaMonths.length
      : undefined;

    return {
      monthly,
      qPerdasMediaKwhDia: round1(qPerdasMediaKwhDia),
      qPerdasMediaKwhMes: round1(qPerdasMediaKwhDia * 30),
      qPerdasPicoKwhDia: round1(qPerdasPicoKwhDia),
      ...(qSolarMediaKwhDia != null && {
        qSolarMediaKwhDia: round1(qSolarMediaKwhDia),
        qSolarMediaKwhMes: round1(qSolarMediaKwhDia * 30),
      }),
      ...(coberturaSolarMediaPct != null && { coberturaSolarMediaPct: round1(coberturaSolarMediaPct) }),
      ...(bombaHorasDiaMedio != null && { bombaHorasDiaMedio: round2(bombaHorasDiaMedio) }),
      ...(bombaConsumoKwhMesMedio != null && { bombaConsumoKwhMesMedio: round1(bombaConsumoKwhMesMedio) }),
      ...(potenciaKW != null && { bombaPotenciaKW: round2(potenciaKW) }),
      inputs: {
        tempAlvo: inputs.heating.tempAguaDesejada,
        tempInicial: inputs.heating.tempAguaInicial,
        capaTermica: inputs.heating.capaTermica,
        vento: inputs.heating.vento,
        tipoConstrucao: inputs.heating.tipoConstrucao,
        areaM2: inputs.heating.areaM2,
        volumeM3: inputs.heating.volumeM3,
        qtdColetores: inputs.solar?.qtdColetores,
        areaTotalColetorM2,
        orientacaoTelhado: inputs.solar?.orientacaoTelhado,
        inclinacaoTelhadoGraus: inputs.solar?.inclinacaoTelhadoGraus,
        fatorInstalacao: round2(fatorInstalacao),
        // v1.12.90: componentes da formula simplificada pra debug
        perdaBaseWm2: inputs.heating.capaTermica ? PERDA_BASE_WM2.COM_CAPA : PERDA_BASE_WM2.SEM_CAPA,
        ventoMult: VENTO_MULT[String(inputs.heating.vento).toUpperCase()] ?? 1.0,
        construcaoMult: CONSTRUCAO_MULT[String(inputs.heating.tipoConstrucao).toUpperCase()] ?? 1.0,
        deltaTBaseAnualMult: round2(
          monthlyLoss.reduce((s, m) => s + Math.max(0, inputs.heating.tempAguaDesejada - m.tempAr) / DELTA_T_BASE, 0) / 12
        ),
        extrasKwTotal: round1(monthlyLoss[0]?.qsExtrasKw ?? 0),
        // v1.12.91: Indice Solarimetrico Ajustado + fatores de operacao
        hspInclinadoMedio: monthly.length > 0
          ? round2(monthly.reduce((s, m) => s + (m.hseHorasDia ?? 0) * fatorInstalacao, 0) / monthly.length)
          : undefined,
        floorFatorBomba: FLOOR_FATOR_BOMBA,
        fatorHorasOperacaoReal: FATOR_HORAS_OPERACAO_REAL,
        rendimentoBomba: RENDIMENTO_BOMBA_MEDIO,
        vazaoBombaM3h: inputs.solar?.bomba?.vazaoM3h,
        vazaoSolarM3h: inputs.solar?.vazaoSolarM3h,
        fatorVazao: (() => {
          const vs = inputs.solar?.vazaoSolarM3h ?? 0;
          const vb = inputs.solar?.bomba?.vazaoM3h ?? 0;
          if (vb <= 0 || vs <= 0) return undefined;
          return round2(Math.max(FATOR_VAZAO_MIN, Math.min(FATOR_VAZAO_MAX, vs / vb)));
        })(),
      },
    };
  }

}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
