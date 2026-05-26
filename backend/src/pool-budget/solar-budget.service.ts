// Wrapper de SolarService que integra com Prisma (PoolBudget + Product + ClimateData).
// Responsabilidades:
//  - Resolve dados climaticos via ClimateDataService
//  - Lista coletores aplicando a regra do tenant (Company.systemConfig.pool.solarCollectorRule)
//  - Computa report e salva em PoolBudget.environmentParams.solarReport
//
// SolarService permanece puro pra ser testavel sem DB.

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SolarService, SolarInputs, SolarReport } from './solar.service';
import { ClimateDataService } from './climate-data.service';
import { SolarRecomputeDto } from './dto/solar-simulate.dto';
import { SolarPipeDto } from './dto/solar-pipe.dto';
import { PipeHeadLossService, PipeMaterial } from './pipe-head-loss.service';
import { SOLAR_LATITUDE_ABS_BY_UF } from './solar-constants';
import { filterByWhere, orderCandidates, evaluateIndicator, interpolatePumpCurve } from './auto-select.helper';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const SOLAR_HEADER_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const SOLAR_HEADER_MAX_SIZE = 5 * 1024 * 1024; // 5MB

export interface SolarCollectorCandidate {
  productId: string;
  modelName: string;
  areaM2: number;
  kwhPorM2: number;
  eficiencia: number;
  salePriceCents?: number;
  // URL da imagem cadastrada no Product (aparece no header do PDF do Simulador
  // quando este coletor esta selecionado).
  imageUrl?: string | null;
  // Lista de specs tecnicas obrigatorias que NAO estao preenchidas no cadastro do
  // produto. Quando preenchida, o coletor aparece no dropdown com ⚠ e o motor
  // lanca BadRequest se for selecionado (em vez de usar defaults silenciosos).
  missingSpecs?: string[];
}

// Labels amigaveis pra cada spec exibida ao usuario no erro/aviso.
// Labels alinhados com a etiqueta Procel/Inmetro PBE Coletor Solar Piscina
const SPEC_FIELD_LABELS: Record<string, string> = {
  areaM2: 'Area externa (m²)',
  kwhPorM2: 'Producao especifica (kWh/mes·m²)',
  eficiencia: 'Eficiencia energetica media (%)',
};

@Injectable()
export class SolarBudgetService {
  private readonly logger = new Logger(SolarBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly solar: SolarService,
    private readonly climateData: ClimateDataService,
    private readonly pipeHeadLoss: PipeHeadLossService,
  ) {}

  // ============ Coletores ============

  /**
   * Lista candidatos a coletor solar do tenant aplicando a regra de filtro
   * salva em Company.systemConfig.pool.solarCollectorRule.
   *
   * Sem regra configurada (ou regra com todos os filtros vazios), retorna [] —
   * o frontend exibe aviso "Configure a regra no ✨". Nao ha mais filtro fixo
   * por tipoEquipamento — TUDO depende da regra que o usuario configura.
   */
  async listSolarCollectors(companyId: string): Promise<SolarCollectorCandidate[]> {
    const rule = await this.getSolarCollectorRule(companyId);
    if (!this.ruleHasAnyFilter(rule)) return [];

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        useInWork: true,
        status: 'ATIVO',
      },
      select: {
        id: true, code: true, description: true, model: true,
        poolType: true, imageUrl: true,
        salePriceCents: true, technicalSpecs: true,
      },
    });

    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const filterPoolType = String(rule.filterPoolType ?? '').trim();
    const filterCategoria = String(rule.filterCategoria ?? '').trim();
    const filterDescription = String(rule.filterDescription ?? '').trim();

    return products
      .filter((p) => {
        const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
        if (filterPoolType && norm(p.poolType ?? '') !== norm(filterPoolType)) return false;
        if (filterCategoria && norm(String(specs.categoriaPlanilha ?? '')) !== norm(filterCategoria)) return false;
        if (filterDescription && !norm(p.description ?? '').includes(norm(filterDescription))) return false;
        return true;
      })
      .map((p) => {
        const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
        const areaM2 = Number(specs.areaM2) || Number(specs.coletorAreaM2) || 0;
        const kwhPorM2 = Number(specs.kwhPorM2) || Number(specs.kwhM2) || 0;
        const eficiencia = Number(specs.eficiencia) || 0;
        const missingSpecs: string[] = [];
        if (areaM2 <= 0) missingSpecs.push('areaM2');
        if (kwhPorM2 <= 0) missingSpecs.push('kwhPorM2');
        if (eficiencia <= 0) missingSpecs.push('eficiencia');
        return {
          productId: p.id,
          // Usa EXATAMENTE a description cadastrada — fallback so se vazia
          modelName: p.description?.trim() || p.model?.trim() || p.code || 'Coletor Solar',
          areaM2,
          kwhPorM2,
          eficiencia,
          salePriceCents: p.salePriceCents ?? undefined,
          imageUrl: p.imageUrl ?? null,
          ...(missingSpecs.length > 0 ? { missingSpecs } : {}),
        };
      })
      .sort((a, b) => a.areaM2 - b.areaM2);
  }

  // ============ Simulacao livre ============

  /** Calculo rapido — sem salvar no PoolBudget. */
  async simulate(companyId: string, params: {
    areaPiscinaM2: number;
    volumeM3: number;
    tempDesejada: number;
    capa: 'SIM' | 'NAO';
    vento: 'FRACO' | 'MODERADO' | 'FORTE';
    extraColetoresPct: number;
    uf: string;
    cidade?: string | null;
    collectorProductId?: string;
    orientacaoTelhado?: string;
    inclinacaoTelhadoGraus?: number;
    temperaturaAguaInicial?: number;
  }): Promise<SolarReport> {
    const climate = await this.climateData.findForLookup(companyId, params.uf, params.cidade ?? null);
    if (!climate) {
      throw new NotFoundException(`Dados climaticos nao encontrados pra ${params.uf}${params.cidade ? '/' + params.cidade : ''}`);
    }

    const candidates = await this.listSolarCollectors(companyId);
    if (candidates.length === 0) {
      const rule = await this.getSolarCollectorRule(companyId);
      if (!this.ruleHasAnyFilter(rule)) {
        throw new BadRequestException(
          'Regra de auto-selecao do coletor solar nao configurada. Abra o Simulador, clique no ✨ ao lado do Coletor e defina o filtro (filterPoolType ou filterDescription) pra escolher quais produtos do catalogo entram no dropdown.',
        );
      }
      throw new BadRequestException(
        'Nenhum produto do catalogo passa na regra atual de auto-selecao do coletor solar. Revise a regra no ✨ ou ajuste os filtros (filterPoolType / filterDescription / filterCategoria).',
      );
    }
    const selected = params.collectorProductId
      ? candidates.find((c) => c.productId === params.collectorProductId)
      : candidates[candidates.length - 1]; // padrao = ultimo (geralmente maior modelo)

    if (!selected) {
      throw new BadRequestException('Coletor solar selecionado nao foi encontrado no catalogo do tenant.');
    }
    if (selected.missingSpecs && selected.missingSpecs.length > 0) {
      const lista = selected.missingSpecs.map((k) => SPEC_FIELD_LABELS[k] ?? k).join(', ');
      throw new BadRequestException(
        `Coletor "${selected.modelName}" esta com cadastro incompleto. Caracteristicas faltando: ${lista}. Edite o produto em /products na aba Especificacoes tecnicas.`,
      );
    }
    const coletor = selected;

    const inputs: SolarInputs = {
      areaPiscinaM2: params.areaPiscinaM2,
      volumeM3: params.volumeM3,
      tempDesejada: params.tempDesejada,
      capa: params.capa,
      vento: params.vento,
      extraColetoresPct: params.extraColetoresPct,
      orientacaoTelhado: params.orientacaoTelhado,
      inclinacaoTelhadoGraus: params.inclinacaoTelhadoGraus,
      temperaturaAguaInicial: params.temperaturaAguaInicial,
      latitudeAbs: SOLAR_LATITUDE_ABS_BY_UF[params.uf],
      climate: {
        name: params.cidade?.trim() || params.uf,
        tempAmbiente: climate.temp,
        radSol: climate.radSol,
      },
      coletor: {
        productId: coletor.productId,
        modelName: coletor.modelName,
        areaM2: coletor.areaM2,
        kwhPorM2: coletor.kwhPorM2,
        eficiencia: coletor.eficiencia,
      },
    };

    const report = this.solar.computeSolarReport(inputs);
    report.resolved = { uf: params.uf, cidade: params.cidade ?? undefined, name: inputs.climate.name };
    return report;
  }

  // ============ Report cacheado no PoolBudget ============

  /** Recomputa e salva em environmentParams.solarReport. */
  async computeAndSaveReport(budgetId: string, companyId: string, overrides?: SolarRecomputeDto): Promise<SolarReport> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    const dims = (budget.poolDimensions ?? {}) as Record<string, any>;
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const existingSolar = (env.solarOverride ?? {}) as Record<string, any>;

    const params = {
      // v1.12.49: override de area/volume vindo do estado do formulario (sem persistir).
      // Permite operador testar dimensionamento sem precisar salvar o orcamento antes.
      areaPiscinaM2: overrides?.areaPiscinaM2 ?? (Number(dims.area) || 0),
      volumeM3: overrides?.volumeM3 ?? (Number(dims.volume) || 0),
      tempDesejada: overrides?.tempDesejada ?? Number(env.temperaturaAguaDesejada) ?? 30,
      capa: (env.capaTermica === false ? 'NAO' : 'SIM') as 'SIM' | 'NAO',
      vento: ((env.vento ?? 'MODERADO') as string).toUpperCase() as 'FRACO' | 'MODERADO' | 'FORTE',
      extraColetoresPct: overrides?.extraColetoresPct ?? Number(existingSolar.extraColetoresPct) ?? 0,
      uf: (env.uf ?? 'SP') as string,
      cidade: env.cidade ?? null,
      collectorProductId: overrides?.collectorProductId ?? existingSolar.collectorProductId,
      // v5: passa orientacao/inclinacao/tempInicial pro motor aplicar no ganhoDia
      orientacaoTelhado: overrides?.orientacaoTelhado ?? (env.orientacaoTelhado as string | undefined),
      inclinacaoTelhadoGraus: overrides?.inclinacaoTelhadoGraus ?? (env.inclinacaoTelhadoGraus as number | undefined),
      temperaturaAguaInicial: overrides?.temperaturaAguaInicial ?? (env.temperaturaAguaInicial as number | undefined),
    };

    const report = await this.simulate(companyId, params);

    // v1.12.29: gera avisos pra exibir no Simulador. Hoje: verifica se ha
    // bombas no catalogo com vazaoM3h suficiente pra atender vazaoTotalM3h
    // calculada. Se faltar, operador precisa cadastrar bombas (ou ajustar a
    // regra solarBombaRule) antes da auto-selecao da linha funcionar.
    report.warnings = await this.computeWarnings(companyId, report);

    // Salva report + overrides em environmentParams (v5: persiste orientacao/inclinacao/tempInicial)
    const newEnv = {
      ...env,
      solarReport: report as unknown as object,
      solarOverride: {
        extraColetoresPct: params.extraColetoresPct,
        collectorProductId: report.selectedCollector.productId,
      },
      ...(overrides?.orientacaoTelhado !== undefined && { orientacaoTelhado: overrides.orientacaoTelhado }),
      ...(overrides?.inclinacaoTelhadoGraus !== undefined && { inclinacaoTelhadoGraus: overrides.inclinacaoTelhadoGraus }),
      ...(overrides?.temperaturaAguaInicial !== undefined && { temperaturaAguaInicial: overrides.temperaturaAguaInicial }),
      ...(overrides?.alturaTelhadoM !== undefined && { alturaTelhadoM: overrides.alturaTelhadoM }),
    };
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { environmentParams: newEnv as any },
    });

    return report;
  }

  // v1.12.29: gera lista de avisos pra exibir no Simulador.
  // Avalia o catalogo do tenant contra a vazao calculada e a regra solarBombaRule
  // do tenant — alerta se nao ha bomba que sirva.
  private async computeWarnings(
    companyId: string,
    report: SolarReport,
  ): Promise<Array<{ severity: 'warning' | 'info'; message: string }>> {
    const warnings: Array<{ severity: 'warning' | 'info'; message: string }> = [];
    const vazao = report.vazaoTotalM3h;
    if (!vazao || vazao <= 0) return warnings;

    const bombaRule = await this.getSolarBombaRule(companyId);

    // Carrega candidatos a bomba (filtra pela regra do tenant se houver)
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(bombaRule?.filterPoolType?.trim()
          ? { poolType: { equals: String(bombaRule.filterPoolType).trim(), mode: 'insensitive' } as any }
          : {}),
        ...(bombaRule?.filterDescription?.trim()
          ? { description: { contains: String(bombaRule.filterDescription).trim(), mode: 'insensitive' } }
          : {}),
      },
      select: { id: true, description: true, technicalSpecs: true },
    });

    if (products.length === 0) {
      const filtroStr = bombaRule?.filterPoolType || bombaRule?.filterDescription
        ? `(filtros: ${[
            bombaRule?.filterPoolType ? `tipo='${bombaRule.filterPoolType}'` : null,
            bombaRule?.filterDescription ? `descricao contendo '${bombaRule.filterDescription}'` : null,
          ].filter(Boolean).join(', ')})`
        : '(sem regra cadastrada)';
      warnings.push({
        severity: 'warning',
        message: `Nenhuma bomba encontrada no catalogo ${filtroStr}. Cadastre bombas com poolType correspondente, ou edite a regra clicando no icone ✨ ao lado de "Bomba recomendada" (acima).`,
      });
      return warnings;
    }

    // Verifica quantas tem vazaoM3h suficiente
    const semVazao: string[] = [];
    let suficiente = 0;
    for (const p of products) {
      const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
      const v = Number(specs?.vazaoM3h);
      if (!Number.isFinite(v) || v <= 0) semVazao.push(p.description);
      else if (v >= vazao) suficiente++;
    }

    if (suficiente === 0) {
      const maxVazao = Math.max(
        0,
        ...products.map((p) => Number((p.technicalSpecs as any)?.vazaoM3h) || 0),
      );
      warnings.push({
        severity: 'warning',
        message: `Nenhuma bomba do catalogo atende a vazao necessaria de ${vazao.toFixed(2)} m³/h (maior vazao cadastrada: ${maxVazao.toFixed(2)} m³/h). Cadastre uma bomba com vazaoM3h >= ${vazao.toFixed(2)} ou ajuste o dimensionamento.`,
      });
    }

    if (semVazao.length > 0) {
      const lista = semVazao.slice(0, 5).join(', ');
      const extra = semVazao.length > 5 ? ` e mais ${semVazao.length - 5}` : '';
      warnings.push({
        severity: 'info',
        message: `${semVazao.length} bomba(s) sem vazaoM3h cadastrado nao foram avaliadas: ${lista}${extra}. Preencha "Vazao (m³/h)" no cadastro do produto pra entrar na auto-selecao.`,
      });
    }

    return warnings;
  }

  // v1.12.34: calcula perda de carga da tubulacao + persiste em environmentParams.solarPipe.
  // Usa a vazao calculada no solarReport como vazao de projeto. Material/diametro/conexoes
  // vem dos defaults (Company.systemConfig.pool.pipeDefaults) sobrescritos pelos inputs.
  async computeAndSavePipe(budgetId: string, companyId: string, dto: SolarPipeDto): Promise<{
    inputs: SolarPipeDto & { vazaoM3h: number };
    result: ReturnType<PipeHeadLossService['compute']>;
  }> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const solarReport = env.solarReport as Record<string, any> | undefined;
    const vazaoM3h = Number(solarReport?.vazaoTotalM3h) || 0;

    // Defaults do tenant (Company.systemConfig.pool.pipeDefaults) — opcional.
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    const tenantDefaults = ((company?.systemConfig as any)?.pool?.pipeDefaults ?? {}) as Record<string, any>;

    // Defaults hardcoded de seguranca caso o tenant nao tenha configurado.
    // v1.12.35: PVC + auto-pick entre [32, 40, 50, 60, 75] (cobre 95% das obras de piscina).
    // v1.12.38: aumentado joelhos 4->10 e tes 1->4 — instalacoes reais de coletor solar
    // tem mais conexoes (cada coletor tem joelhos de entrada/saida).
    const HARDCODED_DEFAULTS = {
      material: 'PVC' as PipeMaterial,
      availableDiametersMm: [32, 40, 50, 60, 75],
      fatorSegurancaPct: 20,
      joelho90Qty: 10,
      teQty: 4,
      registroQty: 1,
      valvulaQty: 1,
    };

    const material = (dto.material ?? tenantDefaults.material ?? HARDCODED_DEFAULTS.material) as PipeMaterial;
    const availableDiameters: number[] = Array.isArray(tenantDefaults.availableDiametersMm)
      ? tenantDefaults.availableDiametersMm
      : HARDCODED_DEFAULTS.availableDiametersMm;

    // Se operador especificou diametro, usa direto. Senao, auto-pick: menor
    // diametro com velocidade <= 2,5 m/s.
    let diametroMm: number;
    let autoPickInfo: { diametroMm: number; velocidade: number; suficiente: boolean } | null = null;
    if (dto.diametroMm) {
      diametroMm = dto.diametroMm;
    } else {
      autoPickInfo = this.pipeHeadLoss.pickOptimalDiameter(material, vazaoM3h, availableDiameters);
      diametroMm = autoPickInfo.diametroMm;
    }

    const inputs = {
      comprimentoM: dto.comprimentoM,
      desnivelM: dto.desnivelM,
      vazaoM3h,
      temperaturaC: 25,
      material,
      diametroMm,
      fatorSegurancaPct: dto.fatorSegurancaPct ?? tenantDefaults.fatorSegurancaPct ?? HARDCODED_DEFAULTS.fatorSegurancaPct,
      joelho90Qty: dto.joelho90Qty ?? tenantDefaults.joelho90Qty ?? HARDCODED_DEFAULTS.joelho90Qty,
      teQty: dto.teQty ?? tenantDefaults.teQty ?? HARDCODED_DEFAULTS.teQty,
      registroQty: dto.registroQty ?? tenantDefaults.registroQty ?? HARDCODED_DEFAULTS.registroQty,
      valvulaQty: dto.valvulaQty ?? tenantDefaults.valvulaQty ?? HARDCODED_DEFAULTS.valvulaQty,
    };

    const result = this.pipeHeadLoss.compute(inputs);
    // Marca se o diametro foi auto-escolhido (UI mostra "auto: 50mm"  ou "configurado: 50mm")
    (result as any).diametroAutoPicked = autoPickInfo !== null;
    (result as any).availableDiametersMm = availableDiameters;

    // Persiste em environmentParams.solarPipe. Tambem atualiza alturaTelhadoM
    // (formulario antigo) pra retrocompat — recebe a altura manometrica TOTAL
    // calculada, nao mais so a altura geometrica.
    const newEnv = {
      ...env,
      solarPipe: { inputs, result },
      alturaTelhadoM: result.alturaManometricaTotal,
    };
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { environmentParams: newEnv as any },
    });

    return { inputs, result };
  }

  async getReport(budgetId: string, companyId: string): Promise<SolarReport | null> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    return (env.solarReport as SolarReport) ?? null;
  }

  // ============ Regra de auto-selecao do Coletor e da Bomba (config do tenant) ============
  // Salva em Company.systemConfig.pool.{solarCollectorRule|solarBombaRule}.
  // O Simulador Solar le essas regras pra montar o dropdown — sem regra, dropdown vazio.

  async getSolarCollectorRule(companyId: string): Promise<any | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    const rule = (company?.systemConfig as any)?.pool?.solarCollectorRule;
    return rule && typeof rule === 'object' ? rule : null;
  }

  async setSolarCollectorRule(companyId: string, rule: any | null): Promise<{ rule: any | null }> {
    return this.setTenantPoolKey(companyId, 'solarCollectorRule', rule);
  }

  async getSolarBombaRule(companyId: string): Promise<any | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    const rule = (company?.systemConfig as any)?.pool?.solarBombaRule;
    return rule && typeof rule === 'object' ? rule : null;
  }

  async setSolarBombaRule(companyId: string, rule: any | null): Promise<{ rule: any | null }> {
    return this.setTenantPoolKey(companyId, 'solarBombaRule', rule);
  }

  // ============ Solar Override (v1.12.52) ============
  // Persiste area/volume manuais em environmentParams.solarOverride. Permite operador
  // testar dimensionamento com area diferente sem alterar poolDimensions (cadastro).
  // Ao reabrir o Simulador, o frontend le esse override e marca modo MANUAL.
  async setSolarOverride(
    budgetId: string,
    companyId: string,
    override: { areaPiscinaM2?: number | null; volumeM3?: number | null } | null,
  ): Promise<{ solarOverride: any | null }> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    if (override === null) {
      delete env.solarOverride;
    } else {
      const cleaned: Record<string, number> = {};
      if (Number.isFinite(override.areaPiscinaM2) && (override.areaPiscinaM2 as number) > 0) {
        cleaned.areaPiscinaM2 = override.areaPiscinaM2 as number;
      }
      if (Number.isFinite(override.volumeM3) && (override.volumeM3 as number) > 0) {
        cleaned.volumeM3 = override.volumeM3 as number;
      }
      if (Object.keys(cleaned).length === 0) {
        delete env.solarOverride;
      } else {
        env.solarOverride = cleaned;
      }
    }
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { environmentParams: env as any },
    });
    return { solarOverride: env.solarOverride ?? null };
  }

  // ============ Candidatos da Bomba Solar (v1.12.43) ============

  /**
   * v1.12.43: lista TODOS os candidatos a bomba que passam na regra (filtros + where)
   * ordenados pelo orderBy da regra. Substitui a Bomba recomendada (string fixa) por
   * dropdown com candidatos reais do catalogo do tenant.
   *
   * Inclui interpolacao da pumpCurve quando o candidato tem curva caracteristica
   * cadastrada (vazaoM3h e pressaoTrabalhoMca sao recalculados na altura alvo).
   *
   * Retorna ate 20 candidatos com info pra renderizar o dropdown:
   *  - productId, description, salePriceCents, poolType
   *  - vazaoM3h, pressaoTrabalhoMca, potenciaCv (do technicalSpecs, interpolados quando ha curva)
   *  - hasPumpCurve (boolean)
   *  - indicator (resultado avaliado, ex: "Folga vazao: +25%")
   */
  async listSolarBombaCandidates(
    budgetId: string,
    companyId: string,
  ): Promise<Array<{
    productId: string;
    description: string;
    salePriceCents: number;
    poolType: string | null;
    imageUrl: string | null;
    vazaoM3h: number;
    pressaoTrabalhoMca: number;
    potenciaCv: number | null;
    hasPumpCurve: boolean;
    indicator: { value: number; label: string; color: string; unit: string } | null;
  }>> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const solarReport = env.solarReport as Record<string, any> | undefined;
    const vazaoSolarM3h = Number(solarReport?.vazaoTotalM3h) || 0;
    const alturaTelhadoMca = Number(env.alturaTelhadoM) || 0;
    if (vazaoSolarM3h <= 0) return []; // sem solarReport, nada a sugerir

    const bombaRule = await this.getSolarBombaRule(companyId);
    if (!bombaRule) return [];

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(bombaRule?.filterPoolType?.trim()
          ? { poolType: { equals: String(bombaRule.filterPoolType).trim(), mode: 'insensitive' } as any }
          : {}),
        ...(bombaRule?.filterDescription?.trim()
          ? { description: { contains: String(bombaRule.filterDescription).trim(), mode: 'insensitive' } }
          : {}),
      },
      select: {
        id: true, description: true, salePriceCents: true,
        poolType: true, technicalSpecs: true, pumpCurve: true, imageUrl: true,
      },
    });
    if (products.length === 0) return [];

    const baseVars = { vazaoSolarM3h, alturaTelhadoMca };

    // Aplica where (filtro de criterio) e orderBy da regra. filterByWhere/orderCandidates
    // ja interpolam pumpCurve quando candidato tem curva cadastrada (v1.12.41).
    const passed = filterByWhere(products as any, bombaRule, baseVars);
    const ordered = orderCandidates(passed as any, bombaRule, baseVars).slice(0, 20);

    return ordered.map((p: any) => {
      const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
      const hasPumpCurve = Array.isArray(p.pumpCurve) && (p.pumpCurve as any[]).length >= 2;
      const interp = hasPumpCurve && alturaTelhadoMca > 0
        ? interpolatePumpCurve(p.pumpCurve, alturaTelhadoMca)
        : null;
      const vazaoEfetiva = interp ? interp.vazaoInterpolada : Number(specs.vazaoM3h) || 0;
      const pressaoEfetiva = interp ? interp.shutOffHead : Number(specs.pressaoTrabalhoMca) || 0;
      const potenciaCv = specs.potenciaCv != null ? Number(specs.potenciaCv) : null;

      // Avalia indicator (folga vazao) com os specs interpolados
      const indicatorVars = {
        ...baseVars,
        vazaoM3h: vazaoEfetiva,
        pressaoTrabalhoMca: pressaoEfetiva,
        ...(potenciaCv != null ? { potenciaCv } : {}),
      };
      const indicatorResult = evaluateIndicator(bombaRule, indicatorVars);

      return {
        productId: p.id,
        description: p.description ?? '',
        salePriceCents: p.salePriceCents ?? 0,
        poolType: p.poolType ?? null,
        imageUrl: p.imageUrl ?? null,
        vazaoM3h: vazaoEfetiva,
        pressaoTrabalhoMca: pressaoEfetiva,
        potenciaCv: Number.isFinite(potenciaCv as number) ? (potenciaCv as number) : null,
        hasPumpCurve,
        indicator: indicatorResult,
      };
    });
  }

  /**
   * v1.12.43: persiste a bomba escolhida pelo operador no dropdown em
   * environmentParams.solarReport.selectedBombaId. Operador pode trocar a
   * sugestao default da regra por outra que tambem passa.
   */
  async setSelectedBomba(
    budgetId: string,
    companyId: string,
    productId: string | null,
  ): Promise<{ selectedBombaId: string | null }> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const solarReport = (env.solarReport ?? {}) as Record<string, any>;
    if (productId === null) delete solarReport.selectedBombaId;
    else solarReport.selectedBombaId = productId;
    env.solarReport = solarReport;
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { environmentParams: env as any },
    });
    return { selectedBombaId: productId };
  }

  private ruleHasAnyFilter(rule: any): boolean {
    if (!rule || typeof rule !== 'object') return false;
    const fields = [rule.filterPoolType, rule.filterCategoria, rule.filterDescription];
    return fields.some((f) => typeof f === 'string' && f.trim().length > 0);
  }

  private async setTenantPoolKey(
    companyId: string,
    key: 'solarCollectorRule' | 'solarBombaRule',
    value: any | null,
  ): Promise<{ rule: any | null }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    const cfg = (company?.systemConfig ?? {}) as Record<string, any>;
    const pool = (cfg.pool ?? {}) as Record<string, any>;
    if (value === null) delete pool[key];
    else pool[key] = value;
    cfg.pool = pool;
    await this.prisma.company.update({
      where: { id: companyId },
      data: { systemConfig: cfg as any },
    });
    return { rule: value };
  }

  // ============ Upload da imagem do header (Solar PDF) ============

  async uploadHeaderImage(
    budgetId: string,
    companyId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<{ solarHeaderImage: string }> {
    if (!SOLAR_HEADER_ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo nao permitido. Use JPEG, PNG ou WebP.');
    }
    if (file.size > SOLAR_HEADER_MAX_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Maximo: 5MB.');
    }

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { id: true, solarHeaderImage: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    if (budget.solarHeaderImage) {
      this.deleteFileIfLocal(budget.solarHeaderImage);
    }

    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    const fileName = `solar-header-${randomUUID()}${ext}`;
    const dirPath = path.join(UPLOAD_DIR, companyId, 'pool-budgets', budgetId);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, fileName), file.buffer);

    const solarHeaderImage = `/uploads/${companyId}/pool-budgets/${budgetId}/${fileName}`;
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { solarHeaderImage },
    });

    return { solarHeaderImage };
  }

  async removeHeaderImage(budgetId: string, companyId: string): Promise<{ solarHeaderImage: null }> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { id: true, solarHeaderImage: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');

    if (budget.solarHeaderImage) {
      this.deleteFileIfLocal(budget.solarHeaderImage);
    }
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { solarHeaderImage: null },
    });
    return { solarHeaderImage: null };
  }

  private deleteFileIfLocal(url: string) {
    if (!url.startsWith('/uploads/')) return;
    const rel = url.replace('/uploads/', '');
    const full = path.join(UPLOAD_DIR, rel);
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err: any) {
      this.logger.warn(`Falha ao remover ${full}: ${err.message}`);
    }
  }
}
