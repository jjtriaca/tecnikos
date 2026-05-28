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
    };
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
    areaM2: number;
    volumeM3: number;
    qtdColetores?: number;
    areaTotalColetorM2?: number;
    orientacaoTelhado?: string;
    inclinacaoTelhadoGraus?: number;
    fatorInstalacao?: number;
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
                bomba: { potenciaCv: overrides.potenciaCv },
              }),
            },
          }
        : {}),
    };

    return this.compute(inputs);
  }

  /**
   * Calcula demanda termica + oferta solar + consumo bomba em UM lugar.
   * Resultado consumido por: card da bomba do Simulador Solar, dimensionamento
   * de bomba de calor, comparativo de fontes, futuro DRE termico.
   */
  compute(inputs: ThermalDemandInputs): ThermalDemandReport {
    // === 1) Perdas mensais via HeatingService (Tabela78) ===
    // Usa computeMonthlyHeatLoss diretamente (atalho — nao precisa do report completo).
    const monthlyLoss: MonthlyHeatLoss[] = this.heating.computeMonthlyHeatLoss(inputs.heating);

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

    const potenciaKW = inputs.solar?.bomba ? inputs.solar.bomba.potenciaCv * 0.7355 : undefined;

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
          // Bomba opera enquanto coletor estiver mais quente que piscina.
          // Modelo: horasDia = HSE × min(1, qPerdas/qSolar)
          //  - qSolar >= qPerdas → bomba opera fracao necessaria do sol
          //  - qSolar  < qPerdas → bomba opera o sol inteiro (limitado por HSE)
          const fatorBase = qSolarKwhDia > 0 ? Math.min(1, qPerdasKwhDia / qSolarKwhDia) : 1;
          const horasDia = hse * fatorBase;
          const consumoKwhMes = potenciaKW * horasDia * 30;

          out.fatorUtilizacaoBomba = round2(fatorBase);
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
        areaM2: inputs.heating.areaM2,
        volumeM3: inputs.heating.volumeM3,
        qtdColetores: inputs.solar?.qtdColetores,
        areaTotalColetorM2,
        orientacaoTelhado: inputs.solar?.orientacaoTelhado,
        inclinacaoTelhadoGraus: inputs.solar?.inclinacaoTelhadoGraus,
        fatorInstalacao: round2(fatorInstalacao),
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
