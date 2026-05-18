// Wrapper sobre HeatingService que integra com Prisma (PoolBudget + EnergyTariff + Product).
// Responsabilidades:
// - Resolve inputs do simulador a partir do PoolBudget (environmentParams + poolDimensions)
// - Busca candidatos (produtos com poolType=Bomba de Calor) e tarifa do tenant
// - Salva o report no PoolBudget.heatingReport (cache)
//
// HeatingService permanece puro pra ser testavel sem DB.

import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HeatingService, HeatingInputs, HeatingReport, TariffInput } from './heating.service';
import { UpsertEnergyTariffDto } from './dto/energy-tariff.dto';
import { HEATING_OPERATION_DEFAULTS, UFCode, VentoLevel, TipoConstrucao, TipoPiscina, UtilizacaoAno, UtilizacaoSemana, CLIMATE_BY_UF } from './heating-constants';

const DEFAULT_TARIFF: TariffInput = {
  kwhBRLCents: 115, // R$ 1.15/kWh
  glpKgBRLCents: 850, // R$ 8.50/Kg
  gnM3BRLCents: 850, // R$ 8.50/m³
};

@Injectable()
export class HeatingBudgetService {
  private readonly logger = new Logger(HeatingBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly heating: HeatingService,
  ) {}

  // ============ EnergyTariff ============

  /** Retorna a tarifa ativa do tenant. Se nao existir, retorna defaults do sistema. */
  async getEnergyTariff(companyId: string): Promise<TariffInput & { id?: string; isDefault?: boolean }> {
    const tariff = await this.prisma.energyTariff.findFirst({
      where: { companyId, isActive: true },
      orderBy: { validFrom: 'desc' },
    });
    if (!tariff) {
      return { ...DEFAULT_TARIFF, isDefault: true };
    }
    return {
      id: tariff.id,
      kwhBRLCents: tariff.kwhBRLCents,
      glpKgBRLCents: tariff.glpKgBRLCents,
      gnM3BRLCents: tariff.gnM3BRLCents,
    };
  }

  /** Cria/atualiza tarifa do tenant (singleton). Desativa registros anteriores. */
  async upsertEnergyTariff(companyId: string, dto: UpsertEnergyTariffDto) {
    // Desativa anterior
    await this.prisma.energyTariff.updateMany({
      where: { companyId, isActive: true },
      data: { isActive: false, validTo: new Date() },
    });
    // Cria nova
    return this.prisma.energyTariff.create({
      data: {
        companyId,
        kwhBRLCents: dto.kwhBRLCents,
        glpKgBRLCents: dto.glpKgBRLCents,
        gnM3BRLCents: dto.gnM3BRLCents,
      },
    });
  }

  // ============ HeatingReport ============

  /**
   * Computa o relatorio do simulador pro orcamento.
   * Le environmentParams + poolDimensions do PoolBudget, busca candidatos
   * (produtos com poolType=Bomba de Calor) e tarifa, e salva o resultado em
   * PoolBudget.heatingReport.
   */
  async computeAndSaveReport(budgetId: string, companyId: string): Promise<HeatingReport> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    const inputs = this.extractInputs(budget);
    const tariff = await this.getEnergyTariff(companyId);
    const candidates = await this.fetchBombaCalorCandidates(companyId);

    const report = this.heating.computeReport(inputs, { candidates, tariff });

    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { heatingReport: report as unknown as object },
    });

    return report;
  }

  /**
   * Retorna o report cacheado se valido, senao recomputa.
   * "Valido" = computado nas ultimas 24h E os inputs nao mudaram desde a computacao.
   * Por simplicidade no F1: sempre recomputa quando solicitado via GET (cache visivel
   * mas nao bloqueia recomputo). F4 pode otimizar.
   */
  async getReport(budgetId: string, companyId: string): Promise<HeatingReport> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { heatingReport: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    if (budget.heatingReport) {
      return budget.heatingReport as unknown as HeatingReport;
    }
    return this.computeAndSaveReport(budgetId, companyId);
  }

  // ============ Helpers ============

  /**
   * Extrai inputs do simulador do PoolBudget. Le poolDimensions + environmentParams.
   * Aplica defaults pra campos faltantes.
   */
  private extractInputs(budget: { poolDimensions: any; environmentParams: any }): HeatingInputs {
    const dims = (budget.poolDimensions ?? {}) as Record<string, any>;
    const env = (budget.environmentParams ?? {}) as Record<string, any>;

    const areaM2 = Number(dims.area ?? 0);
    const volumeM3 = Number(dims.volume ?? 0);

    if (!areaM2 || !volumeM3) {
      throw new NotFoundException('Dimensoes da piscina (area, volume) nao definidas');
    }

    const uf = this.parseUF(env.uf);
    const cidade = typeof env.cidade === 'string' ? env.cidade : undefined;

    return {
      areaM2,
      volumeM3,
      uf,
      cidade,
      tempAguaDesejada: Number(env.temperaturaAguaDesejada ?? 30),
      tempAguaInicial: typeof env.temperaturaInicialAgua === 'number' ? env.temperaturaInicialAgua : undefined,
      vento: this.parseVento(env.velocidadeVento),
      tipoConstrucao: this.parseTipoConstrucao(env.tipoConstrucao),
      tipoPiscina: this.parseTipoPiscina(env.tipoPiscina),
      capaTermica: this.parseBoolean(env.capaTermica),
      utilizacaoAno: this.parseUtilizacaoAno(env.utilizacaoAno),
      utilizacaoSemana: this.parseUtilizacaoSemana(env.utilizacaoSemana),
      hidromassagensQtd: Number(env.hidromassagensQtd) || 0,
      cascataLarguraCm: Number(env.cascataLarguraCm) || 0,
      bordaInfinitaM: Number(env.bordaInfinitaM) || 0,
      bordaInfinitaAlturaM: Number(env.bordaInfinitaAlturaM) || undefined,
      bordaInfinitaVazaoLminPorM: Number(env.bordaInfinitaVazaoLminPorM) || undefined,
      horasFuncionamentoDia: Number(env.horasFuncionamentoDia) || HEATING_OPERATION_DEFAULTS.hoursPerDay,
      taxaFuncionamento: Number(env.taxaFuncionamento) || HEATING_OPERATION_DEFAULTS.taxaFuncionamento,
    };
  }

  /** Busca produtos com poolType=Bomba de Calor + technicalSpecs.kcalHNominal preenchido. */
  private async fetchBombaCalorCandidates(companyId: string): Promise<Parameters<HeatingService['selectEquipment']>[0]> {
    // poolType pode variar (Bomba de Calor, Bomba de calor, Aquecedor por bomba)
    // Filtramos broadly por poolType ILIKE %bomba% OR %aquecedor%
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { poolType: { contains: 'Bomba', mode: 'insensitive' } },
          { poolType: { contains: 'Aquecedor', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        description: true,
        model: true,
        technicalSpecs: true,
      },
    });
    return products
      .map((p) => {
        const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
        const kcalH = Number(specs.kcalHNominal);
        if (!kcalH || kcalH <= 0) return null;
        return {
          productId: p.id,
          modelName: p.model || p.description || 'Modelo sem nome',
          kcalHNominal: kcalH,
          btuH: Number(specs.btuH) || undefined,
          kwNominal: Number(specs.kwNominal) || undefined,
          consumoMaxW: Number(specs.consumoMaxW) || undefined,
          consumoMedioW: Number(specs.consumoMedioW) || undefined,
          ratedInputPowerKW: Number(specs.ratedInputPowerKW) || undefined,
          copNominal: Number(specs.copNominal) || undefined,
          copAt50Capacity: Number(specs.copAt50Capacity) || undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  // ----- Parsers (string/boolean/numero → tipos do simulador) -----

  private parseUF(value: any): UFCode {
    if (typeof value === 'string' && value in CLIMATE_BY_UF) return value as UFCode;
    return 'SP'; // default — Sao Paulo
  }

  private parseVento(value: any): VentoLevel {
    if (typeof value === 'string') {
      const v = value.toUpperCase().trim();
      if (v === 'NULO' || v === 'FRACO' || v === 'MODERADO' || v === 'FORTE') return v;
      if (v === 'BAIXO') return 'FRACO';
      if (v === 'INTERNA') return 'INTERNA';
    }
    return 'MODERADO';
  }

  private parseTipoConstrucao(value: any): TipoConstrucao {
    if (typeof value === 'string' && value.toUpperCase().trim() === 'FECHADA') return 'FECHADA';
    return 'ABERTA';
  }

  private parseTipoPiscina(value: any): TipoPiscina {
    if (typeof value === 'string' && value.toUpperCase().trim() === 'COLETIVA') return 'COLETIVA';
    return 'PRIVATIVA';
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.toUpperCase().trim();
      return v === 'SIM' || v === 'TRUE' || v === '1';
    }
    return false;
  }

  private parseUtilizacaoAno(value: any): UtilizacaoAno {
    if (typeof value === 'string') {
      const v = value.toUpperCase().trim().replace(/ /g, '_');
      if (v === 'VERAO' || v === 'INVERNO') return v;
    }
    return 'ANO_TODO';
  }

  private parseUtilizacaoSemana(value: any): UtilizacaoSemana {
    if (typeof value === 'string') {
      const v = value.toUpperCase().trim().replace(/ /g, '_');
      if (v === 'FIM_DE_SEMANA') return v;
    }
    return 'MES_TODO';
  }
}
