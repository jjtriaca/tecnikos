// Service da aba "Trocador de Calor" do Simulador (estilo SolarBudgetService).
// Etapa 2: lista candidatos a trocador (produtos com poolType ~ "Trocador") pro
// dropdown do Simulador, lendo as specs cadastradas no produto.
//
// Etapas futuras (4-9) adicionam: oferta termica, bomba secundaria (auto-select),
// perda de carga interna no MCA, simulacao mensal e report cacheado no PoolBudget.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PipeHeadLossService, PipeMaterial } from './pipe-head-loss.service';
import { TrocadorPipeDto } from './dto/trocador-pipe.dto';

export interface TrocadorCandidate {
  productId: string;
  modelName: string;
  // Capacidade nominal de troca — reusa technicalSpecs.kcalHNominal (mesmo campo da bomba).
  capacidadeKcalH: number;
  // INOX | TITANIO | null (informativo + resistencia a cloro/sal).
  material: string | null;
  // Eficiencia de troca como fracao 0..1 (technicalSpecs.trocadorEficiencia).
  // 0 quando nao cadastrada — o motor usa o default (0.85) nesse caso.
  eficiencia: number;
  vazaoPrimariaM3h: number;
  vazaoSecundariaM3h: number;
  perdaCargaMca: number;
  pressaoMaxMca: number;
  salePriceCents?: number;
  imageUrl?: string | null;
  // Specs essenciais ausentes — quando preenchida, o dropdown mostra ⚠ e o motor
  // (etapas futuras) lanca erro em vez de usar defaults silenciosos.
  missingSpecs?: string[];
  poolType?: string | null;
  model?: string | null;
}

@Injectable()
export class TrocadorBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeHeadLoss: PipeHeadLossService,
  ) {}

  /**
   * Lista candidatos a trocador de calor do tenant pro dropdown do Simulador.
   * Filtra produtos ativos com poolType contendo "trocador" (case-insensitive),
   * igual o padrao broad do listCandidates da bomba de calor.
   */
  async listTrocadorCandidates(companyId: string): Promise<TrocadorCandidate[]> {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'ATIVO',
        poolType: { contains: 'Trocador', mode: 'insensitive' },
      },
      select: {
        id: true, code: true, description: true, model: true,
        poolType: true, imageUrl: true,
        salePriceCents: true, technicalSpecs: true,
      },
    });

    return products
      .map((p) => {
        const specs = (p.technicalSpecs ?? {}) as Record<string, any>;
        const capacidadeKcalH = Number(specs.kcalHNominal) || 0;
        const vazaoSecundariaM3h = Number(specs.vazaoSecundariaM3h) || 0;
        const missingSpecs: string[] = [];
        if (capacidadeKcalH <= 0) missingSpecs.push('kcalHNominal');
        if (vazaoSecundariaM3h <= 0) missingSpecs.push('vazaoSecundariaM3h');
        return {
          productId: p.id,
          modelName: p.description?.trim() || p.model?.trim() || p.code || 'Trocador de Calor',
          capacidadeKcalH,
          material: typeof specs.trocadorMaterial === 'string' ? specs.trocadorMaterial : null,
          eficiencia: Number(specs.trocadorEficiencia) || 0,
          vazaoPrimariaM3h: Number(specs.vazaoPrimariaM3h) || 0,
          vazaoSecundariaM3h,
          perdaCargaMca: Number(specs.perdaCargaTrocadorMca) || 0,
          pressaoMaxMca: Number(specs.pressaoMaxTrocadorMca) || 0,
          salePriceCents: p.salePriceCents ?? undefined,
          imageUrl: p.imageUrl ?? null,
          ...(missingSpecs.length > 0 ? { missingSpecs } : {}),
          poolType: p.poolType ?? null,
          model: p.model ?? null,
        };
      })
      .sort((a, b) => a.capacidadeKcalH - b.capacidadeKcalH);
  }

  // Etapa 7: calcula perda de carga da tubulacao do lado piscina do trocador.
  // STATELESS (nao persiste) — a vazao vem do DTO (lado secundario do trocador),
  // nao do solarReport. A perda interna do proprio trocador entra aditiva na
  // altura manometrica, igual as baterias do solar. Mesmos defaults do solar
  // (tenant pipeDefaults sobrescritos pelos inputs, com fallback hardcoded).
  async computeTrocadorPipe(companyId: string, dto: TrocadorPipeDto): Promise<{
    inputs: Record<string, any>;
    result: ReturnType<PipeHeadLossService['compute']> & {
      diametroAutoPicked: boolean;
      availableDiametersMm: number[];
    };
  }> {
    const vazaoM3h = Number(dto.vazaoM3h) || 0;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    const tenantDefaults = ((company?.systemConfig as any)?.pool?.pipeDefaults ?? {}) as Record<string, any>;

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

    // Operador especificou diametro? usa direto. Senao auto-pick: menor diametro
    // com velocidade <= 2,5 m/s.
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
      // Trocadores em PARALELO compartilham a mesma perda interna (vazao se divide,
      // perda por ramo eh a mesma) — por isso NAO multiplica por qtdTrocadores.
      perdaInternaExtraMca: Number(dto.perdaInternaMca) || 0,
    };

    const result = this.pipeHeadLoss.compute(inputs) as ReturnType<PipeHeadLossService['compute']> & {
      diametroAutoPicked: boolean;
      availableDiametersMm: number[];
    };
    result.diametroAutoPicked = autoPickInfo !== null;
    result.availableDiametersMm = availableDiameters;

    return { inputs, result };
  }
}
