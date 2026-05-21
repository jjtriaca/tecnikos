// Wrapper de SolarService que integra com Prisma (PoolBudget + Product + ClimateData).
// Responsabilidades:
//  - Resolve dados climaticos via ClimateDataService
//  - Lista coletores cadastrados (Product.technicalSpecs.tipoEquipamento=SOLAR)
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
  // Lista de specs tecnicas obrigatorias que NAO estao preenchidas no cadastro do
  // produto. Quando preenchida, o coletor aparece no dropdown com ⚠ e o motor
  // lanca BadRequest se for selecionado (em vez de usar defaults silenciosos).
  missingSpecs?: string[];
}

// Labels amigaveis pra cada spec exibida ao usuario no erro/aviso.
const SPEC_FIELD_LABELS: Record<string, string> = {
  areaM2: 'Area (m²)',
  kwhPorM2: 'Radiacao util (kWh por m²/dia)',
  eficiencia: 'Eficiencia (fracao 0-1)',
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

  /** Lista produtos com tipoEquipamento=SOLAR cadastrados no tenant. */
  async listSolarCollectors(companyId: string): Promise<SolarCollectorCandidate[]> {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        useInWork: true,
        status: 'ATIVO',
      },
      select: {
        id: true, code: true, description: true, model: true,
        salePriceCents: true, technicalSpecs: true,
      },
    });
    return products
      .filter((p) => {
        const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
        // Aceita o novo tipo (COLETOR_SOLAR_PISCINA) e o legado (SOLAR) pra nao quebrar
        // produtos cadastrados antes da migracao
        return specs.tipoEquipamento === 'COLETOR_SOLAR_PISCINA' || specs.tipoEquipamento === 'SOLAR';
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
      throw new BadRequestException(
        'Nenhum coletor solar cadastrado. Cadastre produtos com Tipo de equipamento = "Coletor Solar Piscina" em /products.',
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

  async getReport(budgetId: string, companyId: string): Promise<SolarReport | null> {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { environmentParams: true },
    });
    if (!budget) throw new NotFoundException('Orcamento nao encontrado');
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    return (env.solarReport as SolarReport) ?? null;
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
