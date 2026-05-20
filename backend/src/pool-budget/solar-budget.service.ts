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
import {
  SOLAR_DEFAULT_COLETOR_AREA_M2,
  SOLAR_DEFAULT_COLETOR_KWH_M2,
  SOLAR_DEFAULT_COLETOR_EFICIENCIA,
} from './solar-constants';
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
}

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
        const areaM2 = Number(specs.areaM2) || Number(specs.coletorAreaM2) || SOLAR_DEFAULT_COLETOR_AREA_M2;
        const kwhPorM2 = Number(specs.kwhPorM2) || Number(specs.kwhM2) || SOLAR_DEFAULT_COLETOR_KWH_M2;
        const eficiencia = Number(specs.eficiencia) || SOLAR_DEFAULT_COLETOR_EFICIENCIA;
        return {
          productId: p.id,
          modelName: p.model || p.description || p.code || 'Coletor Solar',
          areaM2,
          kwhPorM2,
          eficiencia,
          salePriceCents: p.salePriceCents ?? undefined,
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
  }): Promise<SolarReport> {
    const climate = await this.climateData.findForLookup(companyId, params.uf, params.cidade ?? null);
    if (!climate) {
      throw new NotFoundException(`Dados climaticos nao encontrados pra ${params.uf}${params.cidade ? '/' + params.cidade : ''}`);
    }

    const candidates = await this.listSolarCollectors(companyId);
    const selected = params.collectorProductId
      ? candidates.find((c) => c.productId === params.collectorProductId)
      : candidates[candidates.length - 1]; // padrao = ultimo (geralmente maior modelo)

    const coletor = selected ?? {
      productId: undefined,
      modelName: 'Coletor Solar (padrao)',
      areaM2: SOLAR_DEFAULT_COLETOR_AREA_M2,
      kwhPorM2: SOLAR_DEFAULT_COLETOR_KWH_M2,
      eficiencia: SOLAR_DEFAULT_COLETOR_EFICIENCIA,
    };

    const inputs: SolarInputs = {
      areaPiscinaM2: params.areaPiscinaM2,
      volumeM3: params.volumeM3,
      tempDesejada: params.tempDesejada,
      capa: params.capa,
      vento: params.vento,
      extraColetoresPct: params.extraColetoresPct,
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
