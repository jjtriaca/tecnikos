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
import { HeatingService, HeatingInputs, HeatingReport, TariffInput, ExtrasDetected, ExtraLineDetail, ExtraDetected } from './heating.service';
import { UpsertEnergyTariffDto } from './dto/energy-tariff.dto';
import { HEATING_OPERATION_DEFAULTS, UFCode, VentoLevel, TipoConstrucao, TipoPiscina, UtilizacaoAno, UtilizacaoSemana, CLIMATE_BY_UF, getExtraDefaultHorasSemana } from './heating-constants';

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
  // Detalhes por linha pra construcao do ExtrasDetected (v1.11.75)
  cascataLines?: ExtraLineDetail[];
  hidromassagemLines?: ExtraLineDetail[];
  bordaInfinitaLines?: ExtraLineDetail[];
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
  /**
   * Override manual do equipamento (F6.x — operador clica no dropdown do card
   * pra trocar a bomba de calor selecionada). Salva no environmentParams.heatingOverride
   * e recomputa o report. Passar productId=null limpa o override (volta pra auto-select).
   */
  async selectEquipmentOverride(
    budgetId: string,
    companyId: string,
    productId: string | null,
    quantity: number = 1,
  ): Promise<HeatingReport> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const newEnv = { ...env };
    const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
    if (productId) {
      newEnv.heatingOverride = { productId, quantity: qty };
    } else {
      delete newEnv.heatingOverride;
    }
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { environmentParams: newEnv as any, heatingReport: null as any },
    });

    // v1.11.85: Sincronia bidirecional. Quando operador troca o equipamento no
    // Simulador, ATUALIZA tambem a linha "Bomba de Calor" do orcamento (productId
    // + qty). Sem isso, simulador e linha ficam dessincronizados — operador veria
    // "2× X23-40C" no simulador e qty=1 da linha original no orcamento.
    if (productId) {
      await this.syncBombaCalorLineToOverride(budgetId, companyId, productId, qty);
    } else {
      // "Voltar pra selecao automatica" — limpa formula manual da linha + manualUnlink.
      // No proximo recalc, processItem aplica auto-select e seta qty=defaultQty do produto.
      await this.clearBombaCalorLineOverride(budgetId);
    }

    return this.computeAndSaveReport(budgetId, companyId);
  }

  /**
   * Sincroniza a linha "Bomba de Calor" do orcamento com o override do simulador.
   * Acha a linha (poolType ~ bomba/aquecedor com kcalHNominal preenchido) e atualiza
   * productId + qty + unitPriceCents + description. Se nao existir linha (orcamento
   * sem etapa de aquecimento), nao faz nada — operador adiciona a linha quando quiser.
   * v1.11.85.
   */
  private async syncBombaCalorLineToOverride(
    budgetId: string,
    companyId: string,
    productId: string,
    qty: number,
  ): Promise<void> {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      include: {
        product: { select: { id: true, poolType: true, technicalSpecs: true, description: true, model: true, salePriceCents: true, unit: true } },
      },
    });
    const bombaLines = items.filter((it) => {
      if (!it.product) return false;
      const pt = (it.product.poolType || '').toLowerCase();
      const specs = (it.product.technicalSpecs ?? {}) as Record<string, any>;
      return (pt.includes('bomba') || pt.includes('aquecedor')) && Number(specs.kcalHNominal) > 0;
    });
    if (bombaLines.length === 0) return;

    // Pega a linha com maior capacidade total (mesmo criterio do extractEquipmentFromItems)
    bombaLines.sort((a, b) => {
      const aSpecs = (a.product!.technicalSpecs ?? {}) as Record<string, any>;
      const bSpecs = (b.product!.technicalSpecs ?? {}) as Record<string, any>;
      const aCap = (Number(a.qty) || 1) * (Number(aSpecs.kcalHNominal) || 0);
      const bCap = (Number(b.qty) || 1) * (Number(bSpecs.kcalHNominal) || 0);
      return bCap - aCap;
    });
    const line = bombaLines[0];

    // Busca o produto novo pra usar dados atualizados (preco, descricao, unit)
    const newProduct = await this.prisma.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
      select: { id: true, description: true, model: true, salePriceCents: true, unit: true },
    });
    if (!newProduct) return;

    // v1.11.95: Atualiza linha via formula "bombaCalorQty" (variavel) em vez de
    // literal. A formula referencia heatingReport.selectedEquipment.quantity — quando
    // user muda Quant no Simulador OU clica "voltar auto", a formula reavalia e
    // qty da linha se atualiza automaticamente. Nao precisa de sync explicito mais.
    const formulaExpr = 'bombaCalorQty';
    const unitPrice = newProduct.salePriceCents ?? line.unitPriceCents;
    await this.prisma.poolBudgetItem.update({
      where: { id: line.id },
      data: {
        productId: newProduct.id,
        formulaExpr,
        qty, // valor atual — recalc reavalia a formula proximo run
        qtyCalculated: qty,
        unitPriceCents: unitPrice,
        unit: newProduct.unit ?? line.unit,
        description: newProduct.model || newProduct.description || line.description,
        totalCents: Math.round(qty * unitPrice),
        manualUnlink: true,
      },
    });
  }

  /**
   * Limpa a sobrescrita manual da linha "Bomba de Calor" quando o operador clica
   * "Voltar pra selecao automatica" no Simulador. Limpa formulaExpr + manualUnlink
   * pra que o proximo recalc rode auto-select normal. v1.11.88.
   */
  private async clearBombaCalorLineOverride(budgetId: string): Promise<void> {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      include: {
        product: { select: { id: true, poolType: true, technicalSpecs: true } },
      },
    });
    const bombaLines = items.filter((it) => {
      if (!it.product) return false;
      const pt = (it.product.poolType || '').toLowerCase();
      return pt.includes('bomba') || pt.includes('aquecedor');
    });
    if (bombaLines.length === 0) return;
    // v1.11.95: NAO apaga formula nem qty da linha. Apenas remove o flag manualUnlink.
    // A formula="bombaCalorQty" continua amarrando a linha ao Simulador — quando o
    // override do env eh limpado (no caller), a quantity volta pra auto e a formula
    // reavalia. Linha e Simulador ficam sincronizados via formula.
    for (const line of bombaLines) {
      await this.prisma.poolBudgetItem.update({
        where: { id: line.id },
        data: { manualUnlink: false },
      });
    }
  }

  /**
   * Lista candidatos disponiveis pra dropdown de selecao manual (F6.x).
   * Retorna todos os Bomba de Calor / Aquecedor com kcalHNominal preenchido.
   */
  async listCandidates(companyId: string): Promise<Array<{ productId: string; modelName: string; kcalHNominal: number; kwNominal?: number }>> {
    const list = await this.fetchBombaCalorCandidates(companyId);
    return list.map((c) => ({
      productId: c.productId,
      modelName: c.modelName,
      kcalHNominal: c.kcalHNominal,
      kwNominal: c.kwNominal,
    }));
  }

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

    // Prioridade do equipamento:
    // 1. Override manual (operador clicou no dropdown do card) — environmentParams.heatingOverride
    // 2. Linha "Bomba de Calor" da etapa (F6.3)
    // 3. Auto-select global do simulador
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const override = env.heatingOverride as { productId: string; quantity: number } | undefined;
    const fromOverride = override?.productId
      ? await this.extractEquipmentFromOverride(companyId, override.productId, Number(override.quantity) || 1)
      : undefined;
    const fromItem = !fromOverride ? this.extractEquipmentFromItems(budget.items as any) : undefined;
    const candidates = fromOverride
      ? [fromOverride]
      : fromItem
      ? [fromItem]
      : await this.fetchBombaCalorCandidates(companyId);

    const report = this.heating.computeReport(inputs, {
      candidates,
      tariff,
      // Override ou linha — operador escolheu, nao inflar virtualmente
      skipVirtualMultiplier: !!(fromOverride || fromItem),
    });

    // Marca origem do equipamento no report
    if (report.selectedEquipment) {
      if (fromOverride) {
        (report.selectedEquipment as any).fromOverride = true;
      } else if (fromItem) {
        (report.selectedEquipment as any).fromItemCellRef = fromItem._cellRef;
      }
    }

    // Status dos extras (cascata/hidromassagem/borda) com mensagens user-friendly +
    // impactKw (contribuicao individual no calor necessario)
    report.extrasDetected = this.buildExtrasDetected(aggregated, inputs.tipoPiscina, inputs, report);

    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { heatingReport: report as unknown as object },
    });

    return report;
  }

  /**
   * Busca um produto especifico por ID (override manual do operador no dropdown
   * do card "Modelo recomendado"). Multiplica capacidades pela quantity se >1.
   */
  private async extractEquipmentFromOverride(
    companyId: string,
    productId: string,
    quantity: number,
  ): Promise<(Parameters<HeatingService['selectEquipment']>[0][number]) | undefined> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
      select: { id: true, description: true, model: true, technicalSpecs: true },
    });
    if (!product) return undefined;
    const specs = (product.technicalSpecs ?? {}) as Record<string, any>;
    const kcalH = Number(specs.kcalHNominal);
    if (!kcalH || kcalH <= 0) return undefined;
    const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
    // v1.11.87: capacidades JA multiplicadas pelo qty (capacidade total no candidato),
    // E passa quantity como campo separado pra selectEquipment preservar no resultado.
    // Antes quantity hardcoded como 1 dessincronizava UI ("2x" no nome mas qty=1 no input).
    return {
      productId: product.id,
      modelName: qty > 1
        ? `${qty}× ${product.model || product.description || 'Bomba de Calor'}`
        : (product.model || product.description || 'Bomba de Calor'),
      kcalHNominal: kcalH * qty,
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
      quantity: qty,
    };
  }

  /**
   * Procura linha do orcamento com produto poolType ~ "Bomba de Calor" / "Aquecedor"
   * e usa esse produto como candidato unico do simulador. Quando qty > 1, multiplica
   * as capacidades (operador adicionou Nx do mesmo modelo manualmente).
   *
   * Retorna undefined se nao tem nenhuma linha de bomba de calor vinculada ao catalogo.
   */
  private extractEquipmentFromItems(items: Array<{ qty: number; cellRef?: string | null; manualUnlink?: boolean; product?: { id: string; description?: string | null; model?: string | null; poolType: string | null; technicalSpecs: any } | null }>): (Parameters<HeatingService['selectEquipment']>[0][number] & { _cellRef?: string }) | undefined {
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
    // v1.11.96: Quando linha em modo AUTO (manualUnlink=false), passa qty=1 unitario
    // pra selectEquipment decidir o multiplicador. Senao a qty da linha (vinda da
    // formula bombaCalorQty) entra em loop com selectedEquipment.quantity.
    // Manual: respeita qty da linha (operador escolheu N unidades especificas).
    const isManual = chosen.manualUnlink === true;
    const qty = isManual ? Math.max(1, Number(chosen.qty) || 1) : 1;

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
      quantity: qty,
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
    // Horas/semana — env-only por enquanto (linhas nao agregam essa info ainda).
    // Default tratado dentro de heating.service quando undefined.
    const cascataHorasSemana = env.cascataHorasSemana != null ? Number(env.cascataHorasSemana) : undefined;
    const hidromassagemHorasSemana = env.hidromassagemHorasSemana != null ? Number(env.hidromassagemHorasSemana) : undefined;
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
      hidromassagemHorasSemana,
      cascataLarguraCm,
      cascataHorasSemana,
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
  private aggregateExtrasFromItems(items: Array<{ qty: number; description?: string | null; product?: { id?: string; description?: string | null; model?: string | null; poolType: string | null; technicalSpecs: any } | null }>): AggregatedExtras {
    const out: AggregatedExtras = {};

    let cascataTotal = 0;
    let hidroTotal = 0;
    let bordaTotal = 0;
    let bordaFirstAltura: number | undefined;
    let bordaFirstVazao: number | undefined;
    let bordaFirstHoras: number | undefined;

    const cascataLines: ExtraLineDetail[] = [];
    const hidromassagemLines: ExtraLineDetail[] = [];
    const bordaInfinitaLines: ExtraLineDetail[] = [];

    for (const it of items || []) {
      const product = it.product;
      if (!product) continue;
      const pt = (product.poolType || '').toLowerCase();
      const specs = (product.technicalSpecs ?? {}) as Record<string, any>;
      const qty = Number(it.qty) || 0;
      if (qty <= 0) continue;

      const productName = product.model || product.description || it.description || 'Produto sem nome';
      const productId = product.id || '';

      // Filtro: "tubos cascata", "tubos SPA" sao ACESSORIOS, nao a cascata/SPA real.
      // Mesmo padrao pra "kit tubos", "registros", etc. So conta produtos cujo poolType
      // eh DIRETAMENTE cascata/hidromassagem/spa, sem palavras de acessorio.
      const isAcessorio = pt.includes('tubo') || pt.includes('registro') || pt.includes('conexao') || pt.includes('conexão');
      if (isAcessorio) continue;

      // Cascata — cascataComprimentoCm do produto vinculado
      if (pt.includes('cascata')) {
        const raw = specs.cascataComprimentoCm;
        const cm = typeof raw === 'number' && raw > 0 ? raw : null;
        if (cm != null) {
          cascataTotal += qty * cm;
        }
        cascataLines.push({ productId, productName, qty, value: cm, specField: 'cascataComprimentoCm' });
      }
      // Hidromassagem / SPA — qtdJatos do produto vinculado
      else if (pt.includes('hidromassagem') || pt.includes('spa') || pt.includes('jato')) {
        const raw = specs.qtdJatos;
        const jatos = typeof raw === 'number' && raw > 0 ? raw : null;
        if (jatos != null) {
          hidroTotal += qty * jatos;
        }
        hidromassagemLines.push({ productId, productName, qty, value: jatos, specField: 'qtdJatos' });
      }
      // Borda Infinita — qty da linha = comprimento em metros
      else if (pt.includes('borda')) {
        bordaTotal += qty;
        bordaInfinitaLines.push({ productId, productName, qty, value: qty, specField: 'qty' });
        // Primeiro produto define specs (altura/vazao/horas)
        if (bordaInfinitaLines.length === 1) {
          if (typeof specs.bordaAlturaQuedaM === 'number') bordaFirstAltura = specs.bordaAlturaQuedaM;
          if (typeof specs.bordaVazaoLminPorM === 'number') bordaFirstVazao = specs.bordaVazaoLminPorM;
          if (typeof specs.bordaHorasAtivaDia === 'number') bordaFirstHoras = specs.bordaHorasAtivaDia;
        }
      }
    }

    if (cascataLines.length > 0) {
      out.cascataLines = cascataLines;
      if (cascataTotal > 0) out.cascataLarguraCm = cascataTotal;
    }
    if (hidromassagemLines.length > 0) {
      out.hidromassagemLines = hidromassagemLines;
      if (hidroTotal > 0) out.hidromassagensQtd = hidroTotal;
    }
    if (bordaInfinitaLines.length > 0) {
      out.bordaInfinitaLines = bordaInfinitaLines;
      if (bordaTotal > 0) {
        out.bordaInfinitaM = bordaTotal;
        if (bordaFirstAltura != null) out.bordaInfinitaAlturaM = bordaFirstAltura;
        if (bordaFirstVazao != null) out.bordaInfinitaVazaoLminPorM = bordaFirstVazao;
        if (bordaFirstHoras != null) out.bordaInfinitaHorasAtivaDia = bordaFirstHoras;
      }
    }

    return out;
  }

  /**
   * Constroi o ExtrasDetected pro report — status user-friendly de cada extra
   * (cascata, hidromassagem, borda infinita) com detalhes por linha + mensagem.
   *
   * Tres caminhos de identificacao (em ordem de prioridade):
   * 1. Linha na etapa do orcamento + produto com spec preenchida → IDENTIFICADA_COMPLETA
   * 2. Linha na etapa mas produto sem spec → IDENTIFICADA_FALTANDO_INFO (aviso)
   * 3. Sem linha mas valor manual > 0 no env (cadastro/Dados do projeto) → IDENTIFICADA_COMPLETA
   * 4. Sem linha + sem valor manual → NAO_IDENTIFICADA (card nao aparece na UI)
   */
  private buildExtrasDetected(
    aggregated: AggregatedExtras,
    tipoPiscina: TipoPiscina,
    inputs: HeatingInputs,
    report: HeatingReport,
  ): ExtrasDetected {
    const buildItem = (
      lines: ExtraLineDetail[] | undefined,
      totalFromLines: number | undefined,
      manualValue: number,
      manualSourceLabel: string,
      unit: string,
      labelExtra: string,
      cadastroPath: string,
      horasSemana: number | undefined,
      impactKw: number,
    ): ExtraDetected => {
      const hasLines = lines && lines.length > 0;
      const hasManual = manualValue > 0;

      // Sem detecção em ambos os caminhos
      if (!hasLines && !hasManual) {
        return {
          status: 'NAO_IDENTIFICADA',
          totalValue: 0,
          unit,
          lines: [],
          message: `Sem ${labelExtra} identificada`,
          impactKw: 0,
        };
      }

      // Caminho 1/2: linhas das etapas
      if (hasLines) {
        const missingLines = lines!.filter((l) => l.value == null);
        if (missingLines.length > 0) {
          const productList = missingLines.map((l) => `"${l.productName}"`).slice(0, 3).join(', ');
          const more = missingLines.length > 3 ? ` (+${missingLines.length - 3})` : '';
          const field = missingLines[0].specField;
          return {
            status: 'IDENTIFICADA_FALTANDO_INFO',
            totalValue: totalFromLines ?? 0,
            unit,
            horasSemana,
            lines: lines!,
            message: `${labelExtra} identificada na etapa mas produto sem "${field}" em ${productList}${more}. Preencha em ${cadastroPath}`,
            impactKw,
          };
        }
        return {
          status: 'IDENTIFICADA_COMPLETA',
          totalValue: totalFromLines ?? 0,
          unit,
          horasSemana,
          lines: lines!,
          message: `${labelExtra} identificada: ${totalFromLines} ${unit} total`,
          impactKw,
        };
      }

      // Caminho 3: manual no environmentParams (ex: borda infinita configurada nos Dados do projeto)
      return {
        status: 'IDENTIFICADA_COMPLETA',
        totalValue: manualValue,
        unit,
        horasSemana,
        lines: [],
        message: `${labelExtra} configurada ${manualSourceLabel}: ${manualValue} ${unit}`,
        impactKw,
      };
    };

    const cascataHoras = inputs.cascataHorasSemana ?? getExtraDefaultHorasSemana(tipoPiscina, 'cascata');
    const hidroHoras = inputs.hidromassagemHorasSemana ?? getExtraDefaultHorasSemana(tipoPiscina, 'hidromassagem');

    // Calcula contribuicao individual em kW (mesmo factor de computeMonthlyHeatLoss):
    // - Cascata e hidromassagem: rule-of-thumb constante × peso temporal (horas/168) ÷ 860
    // - Borda infinita: modelo fisico variando por mes — pego o pico mensal subtraindo
    //   os extras fixos (so quem sobra eh borda).
    const HORAS_SEMANA_TOTAL = 7 * 24;
    const cascataValue = aggregated.cascataLarguraCm ?? Number(inputs.cascataLarguraCm) ?? 0;
    const hidroValue = aggregated.hidromassagensQtd ?? Number(inputs.hidromassagensQtd) ?? 0;
    const cascataPeso = Math.max(0, Math.min(1, cascataHoras / HORAS_SEMANA_TOTAL));
    const hidroPeso = Math.max(0, Math.min(1, hidroHoras / HORAS_SEMANA_TOTAL));
    const cascataKw = Math.round((cascataValue * 50 * cascataPeso / 860) * 100) / 100;
    const hidroKw = Math.round((hidroValue * 150 * hidroPeso / 860) * 100) / 100;

    // Borda: pega qsExtrasKw maximo dos meses (que ja inclui cascata + hidromassagem fixos
    // + borda variando por mes) e subtrai cascata+hidromassagem fixos.
    const qsExtrasMaxKw = Math.max(0, ...report.monthlyHeatLoss.map((m) => m.qsExtrasKw));
    const bordaKw = Math.max(0, Math.round((qsExtrasMaxKw - cascataKw - hidroKw) * 100) / 100);

    return {
      cascata: buildItem(
        aggregated.cascataLines,
        aggregated.cascataLarguraCm,
        Number(inputs.cascataLarguraCm) || 0,
        'manualmente',
        'cm',
        'Cascata',
        'Cadastros > Produtos > Aba Piscina',
        cascataHoras,
        cascataKw,
      ),
      hidromassagem: buildItem(
        aggregated.hidromassagemLines,
        aggregated.hidromassagensQtd,
        Number(inputs.hidromassagensQtd) || 0,
        'manualmente',
        'jatos',
        'Hidromassagem/SPA',
        'Cadastros > Produtos > Aba Piscina',
        hidroHoras,
        hidroKw,
      ),
      bordaInfinita: buildItem(
        aggregated.bordaInfinitaLines,
        aggregated.bordaInfinitaM,
        Number(inputs.bordaInfinitaM) || 0,
        'no cadastro',
        'm',
        'Borda infinita',
        'Dados do projeto > Borda infinita',
        inputs.bordaInfinitaHorasAtivaDia != null ? inputs.bordaInfinitaHorasAtivaDia * 7 : undefined,
        bordaKw,
      ),
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
