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
import { SOLAR_LATITUDE_ABS_BY_UF } from './solar-constants';
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
      areaPiscinaM2: Number(dims.area) || 0,
      volumeM3: Number(dims.volume) || 0,
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
        ? `(filtro: ${[bombaRule?.filterPoolType, bombaRule?.filterDescription].filter(Boolean).join(' · ')})`
        : '(sem regra solarBombaRule definida)';
      warnings.push({
        severity: 'warning',
        message: `Nenhuma bomba encontrada no catalogo ${filtroStr}. Cadastre bombas com poolType correto e a flag "Usado em Piscina", ou configure a regra de busca em Configuracoes > Piscina > Bomba Solar.`,
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
