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

/** Extras agregados das linhas das etapas (F6.2). undefined = nao tem linha relevante. */
interface AggregatedExtras {
  cascataLarguraCm?: number;
  hidromassagensQtd?: number;
  bordaInfinitaM?: number;
  bordaInfinitaAlturaM?: number;
  bordaInfinitaVazaoLminPorM?: number;
  bordaInfinitaHorasAtivaDia?: number;
}

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
      include: {
        items: {
          include: {
            product: { select: { id: true, description: true, model: true, poolType: true, technicalSpecs: true } },
          },
        },
      },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    // Agrega extras dos produtos vinculados nas linhas das etapas (F6.2):
    // - Hidromassagens (sum qty × qtdJatos)
    // - Cascata (sum qty × cascataComprimentoCm)
    // - Borda infinita (sum qty + specs do primeiro produto)
    const aggregated = this.aggregateExtrasFromItems(budget.items as any);

    const inputs = this.extractInputs(budget, aggregated);
    const tariff = await this.getEnergyTariff(companyId);

    // F6.3: equipamento vem da linha "Bomba de Calor" da etapa (operador escolheu
    // via picker ou auto-select da linha). Se nao tiver, fallback pro auto-select
    // global do simulador com candidatos do catalogo.
    const fromItem = this.extractEquipmentFromItems(budget.items as any);
    const candidates = fromItem
      ? [fromItem] // forca selectEquipment a usar SO esse candidato
      : await this.fetchBombaCalorCandidates(companyId);

    const report = this.heating.computeReport(inputs, {
      candidates,
      tariff,
      // Quando vem da linha (operador escolheu), nao inflar virtualmente
      skipVirtualMultiplier: !!fromItem,
    });

    // Marca origem do equipamento no report (UI mostra badge "da linha LX")
    if (fromItem && report.selectedEquipment) {
      (report.selectedEquipment as any).fromItemCellRef = fromItem._cellRef;
    }

    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { heatingReport: report as unknown as object },
    });

    return report;
  }

  /**
   * Procura linha do orcamento com produto poolType ~ "Bomba de Calor" / "Aquecedor"
   * e usa esse produto como candidato unico do simulador. Quando qty > 1, multiplica
   * as capacidades (operador adicionou Nx do mesmo modelo manualmente).
   *
   * Retorna undefined se nao tem nenhuma linha de bomba de calor vinculada ao catalogo.
   */
  private extractEquipmentFromItems(items: Array<{ qty: number; cellRef?: string | null; product?: { id: string; description?: string | null; model?: string | null; poolType: string | null; technicalSpecs: any } | null }>): (Parameters<HeatingService['selectEquipment']>[0][number] & { _cellRef?: string }) | undefined {
    if (!items || items.length === 0) return undefined;
    // Filtra linhas com produto vinculado tipo bomba de calor / aquecedor
    const candidates = items
      .filter((it) => {
        if (!it.product) return false;
        const pt = (it.product.poolType || '').toLowerCase();
        return pt.includes('bomba') || pt.includes('aquecedor');
      })
      .filter((it) => {
        // Garante que tem kcalHNominal pra poder usar no calculo
        const specs = (it.product?.technicalSpecs ?? {}) as Record<string, any>;
        return Number(specs.kcalHNominal) > 0;
      });
    if (candidates.length === 0) return undefined;

    // Se tiver mais de uma linha, pega a com maior capacidade total (qty × kcalHNominal)
    candidates.sort((a, b) => {
      const aSpecs = (a.product!.technicalSpecs ?? {}) as Record<string, any>;
      const bSpecs = (b.product!.technicalSpecs ?? {}) as Record<string, any>;
      const aCap = (Number(a.qty) || 1) * (Number(aSpecs.kcalHNominal) || 0);
      const bCap = (Number(b.qty) || 1) * (Number(bSpecs.kcalHNominal) || 0);
      return bCap - aCap;
    });
    const chosen = candidates[0];
    const product = chosen.product!;
    const specs = (product.technicalSpecs ?? {}) as Record<string, any>;
    const qty = Math.max(1, Number(chosen.qty) || 1);

    return {
      productId: product.id,
      modelName: qty > 1
        ? `${qty}× ${product.model || product.description || 'Bomba de Calor'}`
        : (product.model || product.description || 'Bomba de Calor'),
      kcalHNominal: (Number(specs.kcalHNominal) || 0) * qty,
      btuH: specs.btuH ? Number(specs.btuH) * qty : undefined,
      kwNominal: specs.kwNominal ? Number(specs.kwNominal) * qty : undefined,
      consumoMaxW: specs.consumoMaxW ? Number(specs.consumoMaxW) * qty : undefined,
      consumoMedioW: specs.consumoMedioW ? Number(specs.consumoMedioW) * qty : undefined,
      ratedInputPowerKW: specs.ratedInputPowerKW ? Number(specs.ratedInputPowerKW) * qty : undefined,
      copMax: Number(specs.copMax) || undefined,
      copAt50Air26: Number(specs.copAt50Air26) || undefined,
      copAt50Air15: Number(specs.copAt50Air15) || undefined,
      copCurveA: Number(specs.copCurveA) || undefined,
      copCurveB: Number(specs.copCurveB) || undefined,
      copCurveC: Number(specs.copCurveC) || undefined,
      copNominal: Number(specs.copNominal) || undefined,
      copAt50Capacity: Number(specs.copAt50Capacity) || undefined,
      _cellRef: chosen.cellRef ?? undefined,
    };
  }

  // ============ Defaults do tenant (Simulador) ============

  /** Retorna o defaultEnvironmentParams do tenant (Json). null se nao configurado. */
  async getDefaultEnvironmentParams(companyId: string): Promise<any> {
    const cfg = await this.prisma.poolModuleConfig.findUnique({
      where: { companyId },
      select: { defaultEnvironmentParams: true },
    });
    return cfg?.defaultEnvironmentParams ?? null;
  }

  /** Salva o defaultEnvironmentParams do tenant. Idempotente — upsert. */
  async saveDefaultEnvironmentParams(companyId: string, env: any) {
    return this.prisma.poolModuleConfig.upsert({
      where: { companyId },
      create: { companyId, defaultEnvironmentParams: env },
      update: { defaultEnvironmentParams: env },
    });
  }

  /**
   * Simulacao "calculo rapido" — recebe todos os inputs no body, computa o
   * relatorio mas NAO salva no banco. Util pra testar cenarios hipoteticos
   * (mudanca de UF, capa, borda, etc) sem mexer no orcamento.
   *
   * Usa candidatos e tarifa do tenant (igual computeAndSaveReport) pra que
   * o equipamento selecionado e custo mensal sejam realistas.
   */
  async simulate(companyId: string, inputs: HeatingInputs): Promise<HeatingReport> {
    const tariff = await this.getEnergyTariff(companyId);
    const candidates = await this.fetchBombaCalorCandidates(companyId);
    return this.heating.computeReport(inputs, { candidates, tariff });
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
   * Quando `aggregated` eh passado (das linhas das etapas), seus valores SOBRESCREVEM
   * os do environmentParams — operador nao precisa redigitar manualmente o que ja
   * esta no catalogo via produtos vinculados nas etapas.
   */
  private extractInputs(
    budget: { poolDimensions: any; environmentParams: any },
    aggregated?: AggregatedExtras,
  ): HeatingInputs {
    const dims = (budget.poolDimensions ?? {}) as Record<string, any>;
    const env = (budget.environmentParams ?? {}) as Record<string, any>;

    const areaM2 = Number(dims.area ?? 0);
    const volumeM3 = Number(dims.volume ?? 0);

    if (!areaM2 || !volumeM3) {
      throw new NotFoundException('Dimensoes da piscina (area, volume) nao definidas');
    }

    const uf = this.parseUF(env.uf);
    const cidade = typeof env.cidade === 'string' ? env.cidade : undefined;

    // Extras: prioridade linhas (aggregated) > env (manual) > 0
    const hidromassagensQtd = aggregated?.hidromassagensQtd ?? (Number(env.hidromassagensQtd) || 0);
    const cascataLarguraCm = aggregated?.cascataLarguraCm ?? (Number(env.cascataLarguraCm) || 0);
    const bordaInfinitaM = aggregated?.bordaInfinitaM ?? (Number(env.bordaInfinitaM) || 0);
    // Borda specs (altura/vazao/horas): linhas > env > defaults do constants
    const bordaInfinitaAlturaM = aggregated?.bordaInfinitaAlturaM ?? (Number(env.bordaInfinitaAlturaM) || undefined);
    const bordaInfinitaVazaoLminPorM = aggregated?.bordaInfinitaVazaoLminPorM ?? (Number(env.bordaInfinitaVazaoLminPorM) || undefined);
    const bordaInfinitaHorasAtivaDia = aggregated?.bordaInfinitaHorasAtivaDia ?? (Number(env.bordaInfinitaHorasAtivaDia) || undefined);

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
      hidromassagensQtd,
      cascataLarguraCm,
      bordaInfinitaM,
      bordaInfinitaAlturaM,
      bordaInfinitaVazaoLminPorM,
      bordaInfinitaHorasAtivaDia,
      horasFuncionamentoDia: Number(env.horasFuncionamentoDia) || HEATING_OPERATION_DEFAULTS.hoursPerDay,
      taxaFuncionamento: Number(env.taxaFuncionamento) || HEATING_OPERATION_DEFAULTS.taxaFuncionamento,
    };
  }

  /**
   * Agrega extras dos produtos vinculados nas linhas das etapas (F6.2).
   * - Cascata: sum(qty × produto.cascataComprimentoCm) — qty em UN, comprimento total em cm
   * - Hidromassagem/SPA: sum(qty × produto.qtdJatos) — qtde total de jatos
   * - Borda Infinita: sum(qty) = comprimento total em metros; specs (altura/vazao/horas)
   *   vem do PRIMEIRO produto encontrado (todas as bordas tendem a ter mesmas specs).
   *
   * Retorna undefined em campo se nao tiver nenhuma linha relevante (deixa env decidir).
   * O matching de poolType eh case-insensitive + substring (cobre "Bomba de Calor",
   * "Kit SPA", "Cascata Inox", etc).
   */
  private aggregateExtrasFromItems(items: Array<{ qty: number; product?: { poolType: string | null; technicalSpecs: any } | null }>): AggregatedExtras {
    const out: AggregatedExtras = {};

    let cascataTotal = 0; let cascataCount = 0;
    let hidroTotal = 0; let hidroCount = 0;
    let bordaTotal = 0; let bordaCount = 0;
    let bordaFirstAltura: number | undefined;
    let bordaFirstVazao: number | undefined;
    let bordaFirstHoras: number | undefined;

    for (const it of items || []) {
      const product = it.product;
      if (!product) continue;
      const pt = (product.poolType || '').toLowerCase();
      const specs = (product.technicalSpecs ?? {}) as Record<string, any>;
      const qty = Number(it.qty) || 0;
      if (qty <= 0) continue;

      // Cascata
      if (pt.includes('cascata')) {
        const cm = Number(specs.cascataComprimentoCm) || 0;
        if (cm > 0) {
          cascataTotal += qty * cm;
          cascataCount++;
        }
      }
      // Hidromassagem / SPA
      else if (pt.includes('hidromassagem') || pt.includes('spa') || pt.includes('jato')) {
        const jatos = Number(specs.qtdJatos) || 0;
        if (jatos > 0) {
          hidroTotal += qty * jatos;
          hidroCount++;
        }
      }
      // Borda Infinita
      else if (pt.includes('borda')) {
        // qty da linha = comprimento em metros
        bordaTotal += qty;
        bordaCount++;
        // Primeiro produto define specs (altura/vazao/horas)
        if (bordaCount === 1) {
          if (typeof specs.bordaAlturaQuedaM === 'number') bordaFirstAltura = specs.bordaAlturaQuedaM;
          if (typeof specs.bordaVazaoLminPorM === 'number') bordaFirstVazao = specs.bordaVazaoLminPorM;
          if (typeof specs.bordaHorasAtivaDia === 'number') bordaFirstHoras = specs.bordaHorasAtivaDia;
        }
      }
    }

    if (cascataCount > 0) out.cascataLarguraCm = cascataTotal;
    if (hidroCount > 0) out.hidromassagensQtd = hidroTotal;
    if (bordaCount > 0) {
      out.bordaInfinitaM = bordaTotal;
      if (bordaFirstAltura != null) out.bordaInfinitaAlturaM = bordaFirstAltura;
      if (bordaFirstVazao != null) out.bordaInfinitaVazaoLminPorM = bordaFirstVazao;
      if (bordaFirstHoras != null) out.bordaInfinitaHorasAtivaDia = bordaFirstHoras;
    }

    return out;
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
          copMax: Number(specs.copMax) || undefined,
          copAt50Air26: Number(specs.copAt50Air26) || undefined,
          copAt50Air15: Number(specs.copAt50Air15) || undefined,
          copCurveA: Number(specs.copCurveA) || undefined,
          copCurveB: Number(specs.copCurveB) || undefined,
          copCurveC: Number(specs.copCurveC) || undefined,
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
