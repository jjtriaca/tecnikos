import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PoolBudgetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreatePoolBudgetDto } from './dto/create-pool-budget.dto';
import { UpdatePoolBudgetDto } from './dto/update-pool-budget.dto';
import { QueryPoolBudgetDto } from './dto/query-pool-budget.dto';
import { evaluateFormula, extractCellRefs, extractDimensionVars, extractEnvVars, extractHeatingVars, extractSolarVars, extractProductVars, type CellRefData } from './formula-eval';
import { selectBestCandidate, evaluateIndicator, filterCandidates, filterByWhere, type AutoSelectRule } from './auto-select.helper';
import { CreateBudgetItemDto, UpdateBudgetItemDto } from './dto/budget-item.dto';
import {
  PoolFormulaService,
  PoolFormulaConfig,
  PoolConditionConfig,
} from './pool-formula.service';
import { HeatingBudgetService } from './heating-budget.service';
import { BordaInfinitaService } from './borda-infinita.service';
import { SolarBudgetService } from './solar-budget.service';
import { TrocadorBudgetService } from './trocador-budget.service';
import * as fs from 'fs';
import * as path from 'path';

interface TemplateSection {
  section: string;
  sortOrder?: number;
  items: Array<{
    catalogConfigId: string;
    sortOrder?: number;
    required?: boolean;
  }>;
}

@Injectable()
export class PoolBudgetService {
  private readonly logger = new Logger(PoolBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly formulaService: PoolFormulaService,
    private readonly heatingBudget: HeatingBudgetService,
    private readonly bordaInfinita: BordaInfinitaService,
    // v1.13.66: redimensionamento da recirc AO SALVAR (gatilho backend). Sem ciclo de DI —
    // Solar/Trocador injetam so prisma + helpers, nunca PoolBudgetService.
    private readonly solarBudget: SolarBudgetService,
    private readonly trocadorBudget: TrocadorBudgetService,
  ) {}

  /**
   * FASE 2 — Enriquece poolDimensions com o volume extra dos reservatorios da Borda
   * Infinita (`bordaVolumeExtraM3`), pra que TODO consumidor de volume (fórmulas de
   * linha, base POOL_VOLUME, solar, demanda térmica, aquecimento) inclua a água da
   * borda no "volume total da piscina" — decisão do usuário (volume total, afeta tudo).
   *
   * NAO altera `dims.volume` (volume geométrico da piscina). Só anexa o extra; cada
   * consumidor soma `dims.volume + bordaVolumeExtraM3`. Idempotente: o front sempre
   * manda o volume geométrico e a borda é recomputada das linhas. Sem borda -> extra 0.
   */
  private enrichPoolDimensions(poolDimensions: any): any {
    if (!poolDimensions || typeof poolDimensions !== 'object') return poolDimensions;
    const dims = poolDimensions as Record<string, any>;
    const lines = Array.isArray(dims.bordaInfinita) ? dims.bordaInfinita : [];
    if (lines.length === 0) {
      // Sem borda: zera o extra (limpa valor antigo se a borda foi removida).
      return dims.bordaVolumeExtraM3 ? { ...dims, bordaVolumeExtraM3: 0 } : dims;
    }
    try {
      const report = this.bordaInfinita.compute({
        poolAreaM2: Number(dims.area) || 0,
        poolVolumeM3: Number(dims.volume) || undefined,
        nBathers: dims.bordaInfinitaBathers != null ? Number(dims.bordaInfinitaBathers) : undefined,
        surgeFactor: dims.bordaInfinitaSurge != null ? Number(dims.bordaInfinitaSurge) : undefined,
        lines,
      });
      return { ...dims, bordaVolumeExtraM3: report.heatingFeed.volumeTermicoExtraM3 };
    } catch (e) {
      // Calculo da borda NUNCA pode derrubar o salvamento do orcamento — degrada pra extra 0.
      this.logger.warn(`enrichPoolDimensions: falha ao computar volume da borda — usando 0. ${String(e)}`);
      return { ...dims, bordaVolumeExtraM3: 0 };
    }
  }

  private async assertModuleActive(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { poolModuleActive: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!company.poolModuleActive) {
      throw new ForbiddenException(
        'Módulo Piscina não está ativo neste tenant. Ative em Configurações.',
      );
    }
  }

  async create(
    dto: CreatePoolBudgetDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    // Valida cliente
    const client = await this.prisma.partner.findFirst({
      where: { id: dto.clientPartnerId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    // Valida template (se enviado)
    let template: { sections: unknown; itemsSnapshot: unknown; defaults: unknown } | null = null;
    if (dto.templateId) {
      template = await this.prisma.poolBudgetTemplate.findFirst({
        where: { id: dto.templateId, companyId, deletedAt: null, isActive: true },
        select: { sections: true, itemsSnapshot: true, defaults: true },
      });
      if (!template) throw new NotFoundException('Template não encontrado ou inativo');
    }

    // Valida printLayout (se enviado)
    if (dto.printLayoutId) {
      const layout = await this.prisma.poolPrintLayout.findFirst({
        where: { id: dto.printLayoutId, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!layout) throw new NotFoundException('Layout de impressão não encontrado');
    }

    const code = await this.codeGenerator
      .generateCode(companyId, 'POOL_BUDGET')
      .catch(() => null);

    // Heranca de environmentParams: DTO > defaults do tenant > vazio
    // Pra simulador de aquecimento — operador clica "Salvar como padrao" no modal
    // de editar dados, e novos orcamentos herdam UF/cidade/temp/capa/vento/etc.
    let envParams = dto.environmentParams as Record<string, any> | undefined;
    if (!envParams || Object.keys(envParams).length === 0) {
      const cfg = await this.prisma.poolModuleConfig.findUnique({
        where: { companyId },
        select: { defaultEnvironmentParams: true },
      });
      const defaults = cfg?.defaultEnvironmentParams as Record<string, any> | null;
      if (defaults && Object.keys(defaults).length > 0) {
        envParams = defaults;
      }
    }

    // Se template tem defaults (snapshot v1.10.43+), aplica como base. DTO sobrescreve.
    const tDefaults = (template?.defaults as Record<string, any>) || {};
    // Restaura NOMES das etapas custom (labels) + ESCONDIDAS (hidden) gravados no template
    // dentro do environmentParams do novo orcamento. Sem isso o header da etapa mostra a
    // CHAVE crua (CUSTOM_<slug>_<rand>) em vez do nome amigavel. Templates salvos ANTES
    // deste fix nao tem defaults.customSections -> merge vira no-op (comportamento antigo).
    const tCustomSections = (tDefaults?.customSections ?? null) as
      | { labels?: Record<string, string>; hidden?: string[] }
      | null;
    if (tCustomSections && (tCustomSections.labels || tCustomSections.hidden)) {
      const baseEnv = (envParams ?? {}) as Record<string, any>;
      const baseCustom = (baseEnv.customSections ?? {}) as Record<string, any>;
      envParams = {
        ...baseEnv,
        customSections: {
          ...baseCustom,
          labels: { ...(baseCustom.labels ?? {}), ...(tCustomSections.labels ?? {}) },
          hidden: Array.from(
            new Set([...(baseCustom.hidden ?? []), ...(tCustomSections.hidden ?? [])]),
          ),
        },
      };
    }
    // FASE 2 — anexa bordaVolumeExtraM3 (água dos reservatórios da borda) no poolDimensions.
    const enrichedDims = this.enrichPoolDimensions(dto.poolDimensions);
    const created = await this.prisma.poolBudget.create({
      data: {
        companyId,
        code: code ?? undefined,
        clientPartnerId: dto.clientPartnerId,
        templateId: dto.templateId,
        printLayoutId: dto.printLayoutId,
        createdByUserId: user.id,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        poolDimensions: enrichedDims as unknown as Prisma.InputJsonValue,
        environmentParams: envParams as Prisma.InputJsonValue | undefined,
        validityDays: dto.validityDays ?? tDefaults.validityDays ?? 30,
        discountCents: dto.discountCents,
        discountPercent: dto.discountPercent ?? tDefaults.discountPercent ?? null,
        taxesPercent: dto.taxesPercent ?? tDefaults.taxesPercent ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        equipmentWarranty: dto.equipmentWarranty ?? tDefaults.equipmentWarranty ?? null,
        workWarranty: dto.workWarranty ?? tDefaults.workWarranty ?? null,
        paymentTerms: dto.paymentTerms ?? tDefaults.paymentTerms ?? null,
        earlyPaymentDiscountPct: dto.earlyPaymentDiscountPct ?? tDefaults.earlyPaymentDiscountPct ?? null,
        paymentTermId: dto.paymentTermId ?? tDefaults.paymentTermId ?? null,
        sectionOrder: dto.sectionOrder ?? tDefaults.sectionOrder ?? [],
        status: PoolBudgetStatus.RASCUNHO,
      },
      include: {
        clientPartner: { select: { id: true, name: true, document: true } },
        template: { select: { id: true, name: true } },
      },
    });

    // Aplica items do template:
    // 1) Se tem itemsSnapshot[] (v1.10.43+ Salvar como modelo), usa-o (mais rico)
    // 2) Caso contrario, usa sections (template legado)
    if (template) {
      const snapshot = Array.isArray(template.itemsSnapshot) ? (template.itemsSnapshot as any[]) : [];
      if (snapshot.length > 0) {
        await this.applyItemsSnapshot(created.id, snapshot, enrichedDims);
      } else {
        await this.applyTemplate(created.id, companyId, template.sections, enrichedDims);
      }
      await this.recalculateTotals(created.id);
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: created.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: created as unknown as Record<string, unknown>,
    });

    return this.findOne(created.id, companyId);
  }

  /**
   * Constroi map de cellRef -> {qty, total, unitPrice} dos items do budget,
   * pra usar em formulas que referenciam outras linhas (qty(LX), total(LX), etc).
   */
  private async buildBudgetCellRefMap(budgetId: string): Promise<Map<string, CellRefData>> {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId, cellRef: { not: null } },
      select: {
        cellRef: true, qty: true, unitPriceCents: true,
        product: { select: { technicalSpecs: true } },
        service: { select: { technicalSpecs: true } },
      },
    });
    const map = new Map<string, CellRefData>();
    for (const it of items) {
      if (!it.cellRef) continue;
      const qty = Number(it.qty) || 0;
      const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      const numericSpecs: Record<string, number> = {};
      if (specs && typeof specs === 'object') {
        for (const [k, v] of Object.entries(specs)) {
          const n = Number(v);
          if (Number.isFinite(n)) numericSpecs[k] = n;
        }
      }
      map.set(it.cellRef, {
        qty,
        total: (qty * it.unitPriceCents) / 100,
        unitPrice: it.unitPriceCents / 100,
        specs: numericSpecs,
      });
    }
    return map;
  }

  /**
   * Calcula sibling vars (technicalSpecs do equipamento principal da mesma poolSection)
   * pra serem usadas em formulas/regras com prefixo 'sibling*'. Primeira ocorrencia
   * de cada chave ganha — equipamentos cadastrados antes dos tubos/servicos.
   *
   * Exemplo: linha de servico de montagem na etapa FILTRO usa 'siblingTempoMontagemH'.
   * Esta funcao le o filtro vinculado na etapa, pega technicalSpecs.tempoMontagemH,
   * retorna { siblingTempoMontagemH: 4, siblingVazaoM3h: 9, siblingTuboEntradaMm: 50, ... }.
   */
  private async buildSiblingVars(
    budgetId: string,
    poolSection: any,
    excludeItemId?: string,
    linkedCellRef?: string | null,
  ): Promise<Record<string, number>> {
    // Se linkedCellRef definido, busca SO o item com aquele cellRef (link explicito).
    // Modo preferido — elimina ambiguidade quando varios items da etapa tem o mesmo
    // technicalSpec (ex: 2 equipamentos com tuboEntradaMm na mesma etapa).
    if (linkedCellRef && linkedCellRef.trim()) {
      const target = await this.prisma.poolBudgetItem.findFirst({
        where: { budgetId, cellRef: linkedCellRef.trim() },
        select: {
          id: true,
          product: { select: { technicalSpecs: true } },
          service: { select: { technicalSpecs: true } },
        },
      });
      const out: Record<string, number> = {};
      const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (specs) {
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
          out[siblingKey] = n;
        }
      }
      return out;
    }

    // Fallback: itera itens da etapa (excluindo o proprio) — comportamento legacy.
    const items = await this.prisma.poolBudgetItem.findMany({
      where: {
        budgetId,
        poolSection,
        ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
      },
      select: {
        id: true,
        product: { select: { technicalSpecs: true } },
        service: { select: { technicalSpecs: true } },
      },
    });
    const out: Record<string, number> = {};
    for (const it of items) {
      const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (!specs) continue;
      for (const [k, raw] of Object.entries(specs)) {
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
        if (out[siblingKey] === undefined) {
          out[siblingKey] = n;
        }
      }
    }
    return out;
  }

  /**
   * Diagnostica por que uma formula com sibling* falhou — retorna mensagem
   * clara ao operador (qual variavel falta, quais items da etapa nao tem o
   * campo preenchido, ou items sem produto/servico vinculado).
   *
   * Chamada quando evaluateFormula lanca erro e a formula contem sibling*.
   * Retorna null se a formula nao usa siblings (caller fallback pro erro generico).
   */
  private async diagnoseSiblingFailure(
    budgetId: string,
    poolSection: any,
    formula: string,
  ): Promise<string | null> {
    // Extrai todas as siblingXxx referenciadas na formula
    const siblingRefs = Array.from(formula.matchAll(/\bsibling([A-Z][A-Za-z0-9_]*)\b/g))
      .map((m) => ({ siblingKey: `sibling${m[1]}`, specKey: m[1].charAt(0).toLowerCase() + m[1].slice(1) }));
    if (siblingRefs.length === 0) return null;

    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId, poolSection },
      select: {
        description: true,
        product: { select: { description: true, technicalSpecs: true } },
        service: { select: { name: true, technicalSpecs: true } },
        productId: true,
        serviceId: true,
      },
    });

    const sectionLabel = String(poolSection);
    const problems: string[] = [];
    const uniqueRefs = Array.from(new Map(siblingRefs.map((r) => [r.siblingKey, r])).values());

    for (const ref of uniqueRefs) {
      // Procura algum item da etapa que tenha o campo preenchido
      const itemsWithField = items.filter((it) => {
        const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
        if (!specs) return false;
        const v = Number(specs[ref.specKey]);
        return Number.isFinite(v);
      });
      if (itemsWithField.length > 0) continue; // achou — sibling existe

      // Nao achou. Diagnostica:
      const unlinkedItems = items.filter((it) => !it.productId && !it.serviceId);
      const linkedWithoutField = items.filter((it) => {
        if (!it.productId && !it.serviceId) return false;
        const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
        if (!specs) return true; // vinculado mas sem specs nenhum
        return !Number.isFinite(Number(specs[ref.specKey]));
      });

      const detail: string[] = [];
      if (unlinkedItems.length > 0) {
        const names = unlinkedItems.slice(0, 3).map((it) => `"${it.description}"`).join(', ');
        const more = unlinkedItems.length > 3 ? ` e mais ${unlinkedItems.length - 3}` : '';
        detail.push(`Items SEM produto vinculado: ${names}${more} — vincule no catalogo (🔍).`);
      }
      if (linkedWithoutField.length > 0) {
        const names = linkedWithoutField.slice(0, 3).map((it) => {
          const prodName = it.product?.description || it.service?.name || it.description;
          return `"${prodName}"`;
        }).join(', ');
        const more = linkedWithoutField.length > 3 ? ` e mais ${linkedWithoutField.length - 3}` : '';
        detail.push(`Produtos vinculados sem "${ref.specKey}": ${names}${more} — preencha em Cadastros > Produtos > Aba Piscina.`);
      }
      if (detail.length === 0) {
        detail.push(`Nenhum item na etapa ${sectionLabel} tem "${ref.specKey}". Adicione um produto que tenha esse campo.`);
      }
      problems.push(`Variavel "${ref.siblingKey}" indisponivel na etapa ${sectionLabel}. ${detail.join(' ')}`);
    }

    if (problems.length === 0) return null;
    return problems.join('\n\n');
  }

  /**
   * Auto-vincula uma linha do orcamento ao Product ou Service do cadastro quando a
   * descricao da match exato (case-insensitive, trim). So vincula quando o match e
   * unico — ambiguidade (multiplos cadastros com mesmo nome) deixa sem vinculo.
   * Retorna {} se nao achou ou se houver duplicata. Sempre idempotente: caller
   * decide se aplica.
   */
  /**
   * Sincroniza heatingOverride do environmentParams com a linha "Bomba de Calor"
   * do orcamento. Quando o operador troca a linha (auto-select/catalog picker),
   * o heatingOverride antigo pode estar apontando pra produto diferente — atualiza.
   * Se a linha sumiu (apagada), limpa o override pra voltar ao auto-select padrao.
   * v1.11.85.
   */
  private async syncHeatingOverrideFromBombaLine(
    budgetId: string,
    budget: { environmentParams: any },
  ): Promise<void> {
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const override = env.heatingOverride as { productId: string; quantity: number } | undefined;

    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      include: {
        product: { select: { id: true, poolType: true, technicalSpecs: true } },
      },
    });
    const bombaLines = items.filter((it) => {
      if (!it.product) return false;
      const pt = (it.product.poolType || '').toLowerCase();
      const specs = (it.product.technicalSpecs ?? {}) as Record<string, any>;
      return (pt.includes('bomba') || pt.includes('aquecedor')) && Number(specs.kcalHNominal) > 0;
    });

    if (bombaLines.length === 0) {
      // Linha de bomba sumiu — limpa override pra voltar pro auto-select global
      if (override) {
        const newEnv = { ...env };
        delete newEnv.heatingOverride;
        await this.prisma.poolBudget.update({
          where: { id: budgetId },
          data: { environmentParams: newEnv as any, heatingReport: null as any },
        });
      }
      return;
    }

    // Pega a linha com maior capacidade total (mesmo criterio do simulador)
    bombaLines.sort((a, b) => {
      const aSpecs = (a.product!.technicalSpecs ?? {}) as Record<string, any>;
      const bSpecs = (b.product!.technicalSpecs ?? {}) as Record<string, any>;
      const aCap = (Number(a.qty) || 1) * (Number(aSpecs.kcalHNominal) || 0);
      const bCap = (Number(b.qty) || 1) * (Number(bSpecs.kcalHNominal) || 0);
      return bCap - aCap;
    });
    const line = bombaLines[0];
    const lineProductId = line.product!.id;
    const lineQty = Math.max(1, Math.min(20, Number(line.qty) || 1));

    // v1.11.95: Se manualUnlink=false, sempre considera modo auto — a linha eh dirigida
    // pelo Simulador via formula="bombaCalorQty" (formula referencia o quantity selecionado).
    // Quando override muda (Quant trocada no Simulador), formula reavalia e qty da linha
    // atualiza. Nao precisa de sync explicito linha→simulador — eh unidirecional simulador
    // dirige linha via formula. Override soh eh criado se operador escolheu MANUALMENTE
    // o equipamento (manualUnlink=true).
    const lineIsManualChoice = (line as any).manualUnlink === true;
    if (!lineIsManualChoice) {
      // Linha em modo auto — se override existe e nao bate com linha, LIMPA override.
      if (override) {
        const newEnv = { ...env };
        delete newEnv.heatingOverride;
        await this.prisma.poolBudget.update({
          where: { id: budgetId },
          data: { environmentParams: newEnv as any, heatingReport: null as any },
        });
      }
      return;
    }

    // Se override esta consistente, nao faz nada
    if (override && override.productId === lineProductId && Number(override.quantity) === lineQty) {
      return;
    }

    // Sincroniza override + invalida heatingReport pro proximo recompute
    const newEnv = { ...env, heatingOverride: { productId: lineProductId, quantity: lineQty } };
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { environmentParams: newEnv as any, heatingReport: null as any },
    });
  }

  private async findAutoLinkByDescription(
    description: string,
    companyId: string,
  ): Promise<{ productId?: string; serviceId?: string }> {
    const trimmed = (description || '').trim();
    if (!trimmed) return {};

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        description: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
      take: 2,
    });
    if (products.length === 1) return { productId: products[0].id };
    if (products.length >= 2) return {}; // ambiguidade

    const services = await this.prisma.service.findMany({
      where: {
        companyId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
      take: 2,
    });
    if (services.length === 1) return { serviceId: services[0].id };
    return {};
  }

  /**
   * Pega o proximo cellRef disponivel para o budget (L1, L2, L3, ...).
   * Nao reusa numeros de items deletados — sempre incrementa o maior existente.
   */
  private async nextCellRef(budgetId: string): Promise<string> {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId, cellRef: { not: null } },
      select: { cellRef: true },
    });
    let max = 0;
    for (const it of items) {
      const m = it.cellRef?.match(/^L(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `L${max + 1}`;
  }

  /**
   * Aplica items vindos de um snapshot (v1.10.43+ "Salvar como modelo").
   * Cada entry tem todos os campos do PoolBudgetItem preservados.
   * Re-avalia formulaExpr contra dimensions atuais quando presente.
   */
  private async applyItemsSnapshot(
    budgetId: string,
    snapshot: any[],
    poolDimensions: any,
  ) {
    if (!Array.isArray(snapshot) || snapshot.length === 0) return;
    const vars = extractDimensionVars(poolDimensions);
    const itemsToCreate: Prisma.PoolBudgetItemCreateManyInput[] = [];
    let order = 0;
    // Preserva o cellRef ORIGINAL do snapshot pra formulas entre linhas (qty(LX)/total(LX)/
    // prod(LX,"spec")) continuarem validas no novo orcamento. Coleta os preservados num Set
    // e gera fallback UNICO (sem colisao) pros itens sem cellRef (templates antigos).
    const usedCellRefs = new Set<string>();
    for (const sit of snapshot) {
      const r = typeof sit.cellRef === 'string' ? sit.cellRef.trim() : '';
      if (r) usedCellRefs.add(r);
    }
    let cellRefSeq = 0;
    const nextCellRef = (): string => {
      let r: string;
      do { cellRefSeq++; r = `L${cellRefSeq}`; } while (usedCellRefs.has(r));
      usedCellRefs.add(r);
      return r;
    };
    for (const it of snapshot) {
      let qty = Number(it.qty) || 0;
      let qtyCalculated: number | null = null;
      // Items de snapshot que tem formula com cellRef (qty(L7), etc) podem falhar aqui
      // pois nao temos os outros items ainda. Tudo bem — recalculateTotals refaz depois.
      if (it.formulaExpr && String(it.formulaExpr).trim() && extractCellRefs(it.formulaExpr).length === 0) {
        try {
          qty = evaluateFormula(String(it.formulaExpr), vars);
          qtyCalculated = qty;
        } catch {
          // Mantem qty do snapshot se a formula falhar
        }
      }
      const unitPriceCents = Number(it.unitPriceCents) || 0;
      const totalCents = Math.round(qty * unitPriceCents);
      const cellRef = typeof it.cellRef === 'string' && it.cellRef.trim() ? it.cellRef.trim() : nextCellRef();
      itemsToCreate.push({
        budgetId,
        poolSection: it.poolSection,
        kind: it.kind === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
        sortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : order++,
        slotName: it.slotName ?? null,
        description: it.description || '(sem descricao)',
        unit: it.unit || 'UN',
        cellRef,
        qty,
        qtyCalculated,
        formulaExpr: it.formulaExpr || null,
        unitPriceCents,
        totalCents,
        isAutoCalculated: !!it.formulaExpr,
        isExtra: false,
        // Snapshot carrega autoSelectRule do template — recalculateTotals
        // depois aplica auto-link (exceto se manualSelection=true).
        autoSelectRule: it.autoSelectRule ?? (Prisma.JsonNull as any),
      });
    }
    if (itemsToCreate.length > 0) {
      await this.prisma.poolBudgetItem.createMany({ data: itemsToCreate });
    }
  }

  /**
   * Aplica template: cria PoolBudgetItem pra cada item do template, calculando
   * qty automaticamente via fórmula do PoolCatalogConfig.
   */
  private async applyTemplate(
    budgetId: string,
    companyId: string,
    sections: unknown,
    poolDimensions: any,
  ) {
    const sectionsArr = sections as TemplateSection[];
    if (!Array.isArray(sectionsArr)) return;

    const metrics = this.formulaService.computeMetrics(poolDimensions);

    // Coleta todos catalogConfigIds
    const allIds = sectionsArr.flatMap((s) => s.items.map((i) => i.catalogConfigId));
    if (allIds.length === 0) return;

    // Busca configs com Product/Service
    const configs = await this.prisma.poolCatalogConfig.findMany({
      where: { id: { in: allIds }, companyId, isActive: true },
      include: {
        product: { select: { id: true, description: true, unit: true, salePriceCents: true } },
        service: { select: { id: true, name: true, unit: true, priceCents: true } },
      },
    });
    const configMap = new Map(configs.map((c) => [c.id, c]));

    const itemsToCreate: Prisma.PoolBudgetItemCreateManyInput[] = [];
    let globalSort = 0;

    for (const section of sectionsArr) {
      for (const item of section.items) {
        const cfg = configMap.get(item.catalogConfigId);
        if (!cfg) continue;

        // Filtro por condição
        if (
          !this.formulaService.matchesCondition(
            cfg.poolCondition as PoolConditionConfig | null,
            poolDimensions,
          )
        ) {
          if (!item.required) continue;
        }

        const qtyCalculated =
          this.formulaService.calculateQty(
            cfg.poolFormula as PoolFormulaConfig | null,
            metrics,
          ) ?? 1;

        const description = cfg.product?.description ?? cfg.service?.name ?? '(sem descrição)';
        const unit = cfg.product?.unit ?? cfg.service?.unit ?? 'UN';
        const unitPriceCents = cfg.product?.salePriceCents ?? cfg.service?.priceCents ?? 0;
        const totalCents = Math.round(qtyCalculated * unitPriceCents);

        itemsToCreate.push({
          budgetId,
          catalogConfigId: cfg.id,
          productId: cfg.productId,
          serviceId: cfg.serviceId,
          poolSection: cfg.poolSection,
          sortOrder: globalSort++,
          cellRef: `L${itemsToCreate.length + 1}`,
          description,
          unit,
          qtyCalculated,
          qty: qtyCalculated,
          unitPriceCents,
          totalCents,
          isAutoCalculated: true,
          isExtra: false,
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await this.prisma.poolBudgetItem.createMany({ data: itemsToCreate });
    }
  }

  /**
   * v1.13.66: redimensiona a recirculacao (bomba + tubo + N em paralelo) do Solar e da Bomba de
   * Calor (Trocador) PRO OTIMO — porte backend do que o Simulador ja faz ao ABRIR a aba (v1.13.61),
   * pro caso do operador SALVAR o orcamento SEM abrir o Aquecimento. Chamado SO pelo save
   * (recalculateTotals com opts.redimensionarRecirc) e ANTES do PASS 0 (auto-select), pra que a
   * linha useSolarBomba / useTrocadorBomba vincule ao produto novo no mesmo recalc.
   *
   * Determinista: tudo deriva do dimensionamento — salvar 2x sem mudar nada da o MESMO resultado
   * (conteudo do orcamento estavel). Cada ramo (solar/trocador) tem try/catch isolado — falha num
   * nao impede o outro nem o save (o caller tambem protege).
   *
   * "SEMPRE refazer pro otimo, descarta ajuste manual" (decisao do Juliano, v1.13.60/61) — vale
   * pros DOIS ramos, igual o gatilho "ao abrir o Aquecimento". SOLAR: o recompute do relatorio
   * DROPA a selecao da bomba, entao re-escolho a otima + re-persisto com manual=false (so restauro
   * a anterior se ficar sem candidatos). TROCADOR (nao tem flag manual): re-otimiza e so grava
   * quando a escolha realmente muda (computeTrocadorPipe preserva trocadorBombaId — sem drop).
   */
  private async redimensionarRecirc(budgetId: string, companyId: string): Promise<void> {
    // Escolhe a MELHOR bomba dos candidatos + auto-N — IGUAL pickBestBomba do front
    // (HeatingSimulatorModal): menor que atende SOZINHA (N=1; candidatos ja vem ordenados pela
    // regra ✨), senao a MAIOR (minimiza N). Auto-N = teto(vazaoAlvo / vazaoOperBomba), clamp [1,6].
    const pickBest = (
      cands: Array<{ productId: string; vazaoM3h: number }>,
      vazaoAlvo: number,
    ): { productId: string; vazaoM3h: number; qty: number } | null => {
      if (!cands.length || vazaoAlvo <= 0) return null;
      const meetsAlone = cands.filter((c) => (c.vazaoM3h || 0) >= vazaoAlvo - 0.01);
      const def = meetsAlone.length
        ? meetsAlone[0]
        : [...cands].sort((a, b) => (b.vazaoM3h || 0) - (a.vazaoM3h || 0))[0];
      const qty = Math.max(1, Math.min(6, Math.ceil(vazaoAlvo / (def.vazaoM3h || vazaoAlvo))));
      return { productId: def.productId, vazaoM3h: def.vazaoM3h || 0, qty };
    };

    // ── SOLAR ──────────────────────────────────────────────────────────────────
    // So mexe se o orcamento JA tem dimensionamento solar (operador abriu a aba Solar ao menos
    // uma vez). Sem solarReport => nao ha solar a redimensionar.
    //
    // ATENCAO: computeAndSaveReport substitui o solarReport pelo output do simulate(), que NAO
    // carrega selectedBombaId/qty/manual (so setSelectedBomba grava essas chaves). Ou seja, o
    // recompute DROPA a selecao da bomba — por isso re-escolho + re-persisto SEMPRE depois (e
    // restauro a selecao anterior se ficar sem candidatos, pra um save nunca desvincular a linha).
    try {
      const b0 = await this.prisma.poolBudget.findFirst({
        where: { id: budgetId, companyId, deletedAt: null },
        select: { environmentParams: true },
      });
      const env0 = (b0?.environmentParams ?? {}) as Record<string, any>;
      const sr0 = (env0.solarReport ?? null) as Record<string, any> | null;
      if (sr0) {
        // Selecao ANTES do recompute (pra restaurar se ficar sem candidatos).
        const preId: string | null = sr0.selectedBombaId ?? null;
        const preManual = sr0.bombaManuallySelected === true;
        const preQty = Math.max(1, Math.round(Number(sr0.selectedBombaQty) || 1));

        // Recomputa o relatorio solar SEM overrides => re-le todos os ajustes persistidos
        // (capa/vento/coletor/uf/area/volume/borda) e JA re-sincroniza o tubo (DN auto
        // preservado, v1.13.63). Mesmo caminho do "abrir" a aba Solar — determinista.
        await this.solarBudget.computeAndSaveReport(budgetId, companyId);
        const b1 = await this.prisma.poolBudget.findFirst({
          where: { id: budgetId, companyId, deletedAt: null },
          select: { environmentParams: true },
        });
        const sr1 = ((b1?.environmentParams ?? {}) as Record<string, any>).solarReport as Record<string, any> | undefined;
        const vazaoAlvo = Number(sr1?.vazaoTotalM3h) || 0;
        const cands = vazaoAlvo > 0 ? await this.solarBudget.listSolarBombaCandidates(budgetId, companyId, 6) : [];
        const best = pickBest(cands as any, vazaoAlvo);
        if (best) {
          // "Sempre refazer pro otimo, descarta ajuste manual" (Juliano v1.13.60/61) — re-otimiza
          // e grava manual=false. O recompute dropou a selecao, entao re-persisto pra restaurar+otimizar.
          await this.solarBudget.setSelectedBomba(budgetId, companyId, best.productId, false, best.qty);
        } else if (preId) {
          // Sem candidatos (transiente/regra) OU vazao 0 — RESTAURA a selecao que o recompute dropou,
          // pra NAO desvincular a linha useSolarBomba neste save. O indicador "vazao na faixa" sinaliza.
          await this.solarBudget.setSelectedBomba(budgetId, companyId, preId, preManual, preQty);
        }
      }
    } catch (err) {
      this.logger.warn(`redimensionarRecirc[solar] falhou: ${(err as Error)?.message}`);
    }

    // ── TROCADOR (Bomba de Calor) ────────────────────────────────────────────────
    // So mexe se ha equipamento de bomba de calor selecionado COM vazao (vazaoMinM3h > 0).
    try {
      const b2 = await this.prisma.poolBudget.findFirst({
        where: { id: budgetId, companyId, deletedAt: null },
        select: { environmentParams: true, heatingReport: true },
      });
      const hr = (b2?.heatingReport ?? null) as Record<string, any> | null;
      const eq = hr?.selectedEquipment as Record<string, any> | undefined;
      const vMin = Number(eq?.vazaoMinM3h) || 0;
      if (eq && vMin > 0) {
        const qtyEq = Math.max(1, Math.round(Number(eq?.quantity) || 1));
        const vMax = Number(eq?.vazaoMaxM3h) || 0;
        const vazaoAlvo = Number((vMin * qtyEq).toFixed(2));
        const vazaoMaxTotal = vMax > 0 ? Number((vMax * qtyEq).toFixed(2)) : 0;
        if (vazaoAlvo > 0) {
          const env2 = (b2?.environmentParams ?? {}) as Record<string, any>;
          // Comp/desnivel: o tamanho fisico da instalacao NAO muda no save — preserva o que o
          // operador deixou (env.trocadorPipe.inputs); senao defaults do tenant; senao 30/4.
          const company = await this.prisma.company.findUnique({
            where: { id: companyId }, select: { systemConfig: true },
          });
          const tdef = ((company?.systemConfig as any)?.pool?.pipeDefaults ?? {}) as Record<string, any>;
          const pin = (env2.trocadorPipe as any)?.inputs ?? {};
          const comprimentoM = Number(pin.comprimentoM) > 0
            ? Number(pin.comprimentoM)
            : (Number(tdef.trocadorComprimentoM) > 0 ? Number(tdef.trocadorComprimentoM) : 30);
          const desnivelM = Number.isFinite(Number(pin.desnivelM))
            ? Number(pin.desnivelM)
            : (Number.isFinite(Number(tdef.trocadorDesnivelM)) ? Number(tdef.trocadorDesnivelM) : 4);
          // Recomputa o tubo (DN auto-escolhido, sem diametroMm) + persiste env.trocadorPipe.
          const pipe = await this.trocadorBudget.computeTrocadorPipe(
            companyId, { comprimentoM, desnivelM, vazaoM3h: vazaoAlvo } as any, budgetId,
          );
          const altura = Number(pipe?.result?.alturaManometricaTotal) || 0;
          // alturaSelecao = max(atrito de operacao, desnivel) — a bomba tem que rodar E romper a
          // inercia do desnivel (mesma regra do card do Simulador, circuito fechado).
          const alturaSelecao = Math.max(altura, Number(desnivelM) || 0);
          const cands = await this.solarBudget.listBombaCandidatesByFlow(
            companyId, vazaoAlvo, alturaSelecao, 'trocadorBombaRule', vazaoMaxTotal, 6,
          );
          const best = pickBest(cands as any, vazaoAlvo);
          if (best) {
            const vazaoOperTotal = Number((best.vazaoM3h * best.qty).toFixed(2));
            const curId: string | null = env2.trocadorBombaId ?? null;
            const curQty = Math.max(1, Math.round(Number(env2.trocadorBombaQty) || 1));
            const curOper = Number(env2.trocadorBombaVazaoOperM3h) || 0;
            const changed = best.productId !== curId
              || best.qty !== curQty
              || Math.abs(vazaoOperTotal - curOper) > 0.01;
            if (changed) {
              // setSelectedTrocadorBomba vive no SolarBudgetService (dono da persistencia de
              // bomba + do listBombaCandidatesByFlow); so o computeTrocadorPipe e do TrocadorBudgetService.
              await this.solarBudget.setSelectedTrocadorBomba(
                budgetId, companyId, best.productId, best.qty, vazaoOperTotal,
              );
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`redimensionarRecirc[trocador] falhou: ${(err as Error)?.message}`);
    }
  }

  /**
   * Recalcula subtotalCents, taxesCents e totalCents do orçamento somando os itens.
   * v1.13.66: opts.redimensionarRecirc (so o save de orcamento passa true) re-otimiza a recirc
   * solar + bomba de calor antes do auto-select — ver redimensionarRecirc.
   */
  async recalculateTotals(budgetId: string, opts: { redimensionarRecirc?: boolean } = {}) {
    const HOURS_PER_DAY = 8;

    let budget = await this.prisma.poolBudget.findUnique({
      where: { id: budgetId },
      select: {
        discountCents: true,
        discountPercent: true,
        taxesPercent: true,
        startDate: true,
        poolDimensions: true,
        environmentParams: true,
        heatingReport: true,
        companyId: true,
        frozenAt: true,
      },
    });

    // CADASTRADO (congelado): nao recalcula — os valores ficam exatamente como foram
    // cadastrados, imunes a mudancas futuras de formula/feature. Os mutators ja bloqueiam
    // antes de chegar aqui; este early-return e defesa extra (qualquer caller futuro).
    if (budget?.frozenAt) return;

    // v1.11.85: Sincronia linha → simulador. Se o operador mudou a linha "Bomba de
    // Calor" do orcamento (via auto-select ou catalog picker), o heatingOverride
    // pode estar apontando pra produto/qty diferente. Sincroniza: pega productId+qty
    // da linha como verdade, atualiza heatingOverride E invalida heatingReport pra
    // recomputar na proxima visita.
    if (budget?.companyId) {
      await this.syncHeatingOverrideFromBombaLine(budgetId, budget);
      // Re-le pra capturar mudancas
      budget = await this.prisma.poolBudget.findUnique({
        where: { id: budgetId },
        select: {
          discountCents: true, discountPercent: true, taxesPercent: true,
          startDate: true, poolDimensions: true, environmentParams: true,
          heatingReport: true, companyId: true, frozenAt: true,
        },
      });
    }

    // F6.x: Auto-computa heatingReport quando nao existe — necessario pro auto-select
    // de Bomba de Calor preciso (regra usa calorNecessarioKcalH). Sem isso, regras tipo
    // "kcalHNominal >= calorNecessarioKcalH and kcalHNominal <= calorNecessarioKcalH * 3.33"
    // falham (0 <= 0 eh false pra kcalHNominal positivo).
    const dims = (budget?.poolDimensions ?? {}) as Record<string, any>;
    if (!budget?.heatingReport && budget?.companyId && Number(dims.area) > 0 && Number(dims.volume) > 0) {
      try {
        await this.heatingBudget.computeAndSaveReport(budgetId, budget.companyId);
        // Refresca budget pra ter heatingReport atualizado
        budget = await this.prisma.poolBudget.findUnique({
          where: { id: budgetId },
          select: {
            discountCents: true, discountPercent: true, taxesPercent: true,
            startDate: true, poolDimensions: true, environmentParams: true,
            heatingReport: true, companyId: true, frozenAt: true,
          },
        });
      } catch (err) {
        this.logger.debug(`Auto-compute heatingReport falhou (sem dimensoes/clima?): ${(err as Error)?.message}`);
      }
    }

    // v1.13.66: REDIMENSIONA a recirc (bomba + tubo + N) AO SALVAR — fecha a lacuna do
    // operador que salva o orcamento SEM abrir o Simulador de Aquecimento (onde isso ja
    // roda desde v1.13.61). Gatilho EXCLUSIVO do save: so update() passa a flag; edicoes de
    // linha / reorder / create NAO disparam (a recirc so depende do dimensionamento, nao das
    // linhas, e re-rodar a cada tecla seria pesado/surpreendente). Roda DEPOIS do heatingReport
    // fresco e ANTES de dimensionVars/PASS 0, com re-leitura do budget pra que as vars
    // (solarPipeDnMm / trocadorBombaVazaoOperM3h / solarBombaQty / etc.) e o linkLineToSimulator
    // peguem a escolha nova. NUNCA quebra o save (try/catch). Congelado nem chega aqui (L734).
    if (opts.redimensionarRecirc && budget?.companyId) {
      try {
        await this.redimensionarRecirc(budgetId, budget.companyId);
        budget = await this.prisma.poolBudget.findUnique({
          where: { id: budgetId },
          select: {
            discountCents: true, discountPercent: true, taxesPercent: true,
            startDate: true, poolDimensions: true, environmentParams: true,
            heatingReport: true, companyId: true, frozenAt: true,
          },
        });
      } catch (err) {
        this.logger.warn(`redimensionarRecirc falhou (save segue normal): ${(err as Error)?.message}`);
      }
    }

    const dimensionVars = {
      ...extractDimensionVars(budget?.poolDimensions),
      ...extractEnvVars(budget?.environmentParams),
      ...extractHeatingVars(budget?.heatingReport),
      ...extractSolarVars((budget?.environmentParams as any)?.solarReport),
    };

    // v1.12.20: PASSO -1 (auto-link silencioso por descricao) REMOVIDO.
    // Operador vincula manualmente via picker (icone ✨). Linha fica livre
    // pra sempre se nao for vinculada explicitamente. Se aplicar template
    // Linear, o proprio applyLinearTemplate ja faz o matching no batch
    // create (findCatalog por descricao). recalculateTotals nao re-vincula
    // mais nada — so calcula totais e roda auto-select de regras explicitas.

    // PASSO 0: auto-selecao do produto/servico em items que tem autoSelectRule.
    // Roda ANTES das formulas porque escolha do produto afeta technicalSpecs disponiveis.
    //
    // EVOLUCAO DO COMPORTAMENTO:
    // - v1.10.96: so disparava em items SEM produto/servico vinculado.
    // - v1.10.98: 2 fases (equipamentos primarios + tubos/dependentes).
    // - v1.11.11: respeita escolha que AINDA PASSA na regra. Se o produto atual
    //   nao passa mais (ex: user trocou filtro, tubo virou incompativel), re-aplica
    //   auto-select pra escolher um valido. Sem isso o tubo ficava 'incompativel'
    //   ate o user limpar e re-aplicar manualmente.
    /* ═══════════════════════════════════════════════════════════════
       AUTO-SELECT — REGRA INVIOVEL #4 (ja foi quebrado 3x)
       Doc completo: memory/pool_budget_rules.md secao 16

       Auto-select PULA items com manualUnlink=true. SEMPRE filtrar isso.

       Por que: o operador pode escolher manualmente "Sem Produto" OU outro
       produto que NAO passa na regra (ex: V30 numa regra que pede vazao >=
       volume/3.7). Sem esse filtro, o engine detectaria que o produto atual
       nao passa e substituiria pelo otimo da regra — frustrando a intencao
       manual. Botao "↩ voltar selecao auto" no frontend desfaz (seta false).

       ANTES DE MEXER: leia checklist em pool_budget_rules.md secao 16.
       ═══════════════════════════════════════════════════════════════ */
    const itemsForAutoSelect = await this.prisma.poolBudgetItem.findMany({
      where: {
        budgetId,
        autoSelectRule: { not: Prisma.JsonNull as any },
        manualUnlink: false,
      },
      select: {
        id: true, autoSelectRule: true, productId: true, serviceId: true,
        description: true, unitPriceCents: true, poolSection: true,
        qty: true, formulaExpr: true, previousQty: true,
        product: { select: { id: true, description: true, salePriceCents: true, unit: true, technicalSpecs: true, poolType: true, defaultQty: true } },
        service: { select: { id: true, name: true, priceCents: true, unit: true, technicalSpecs: true } },
      },
    });
    if (itemsForAutoSelect.length > 0) {
      const companyId = await this.prisma.poolBudget.findUnique({
        where: { id: budgetId },
        select: { companyId: true },
      }).then((b) => b?.companyId);

      if (companyId) {
        // Carrega catalogo (Products + Services) com technicalSpecs uma vez
        const allProducts = await this.prisma.product.findMany({
          where: { companyId },
          select: { id: true, description: true, salePriceCents: true, unit: true, technicalSpecs: true, poolType: true, defaultQty: true, pumpCurve: true },
        });
        const allServices = await this.prisma.service.findMany({
          where: { companyId },
          select: { id: true, name: true, priceCents: true, unit: true, technicalSpecs: true },
        });

        // Constroi map cellRef -> productSpecs do orcamento atual.
        // Usado pra substituir prod(LX, "spec") nas expressoes de regra/indicator.
        const allInBudgetForSpecs = await this.prisma.poolBudgetItem.findMany({
          where: { budgetId },
          select: {
            cellRef: true,
            qty: true,
            product: { select: { technicalSpecs: true } },
            service: { select: { technicalSpecs: true } },
          },
        });
        const cellRefSpecsMap = new Map<string, Record<string, unknown>>();
        for (const it of allInBudgetForSpecs) {
          if (!it.cellRef) continue;
          const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
          // qtdLinha = quantidade da linha, exposta como pseudo-spec pra o where da regra
          // poder fazer `prod(Lx,"vazaoM3h") * prod(Lx,"qtdLinha")` (ex: grade de fundo NBR
          // 10339 = vazao TOTAL das bombas x qtd de cada linha). prod() ja funciona no where.
          cellRefSpecsMap.set(it.cellRef, { ...(specs ?? {}), qtdLinha: Number(it.qty) || 0 });
        }

        // Detecta uso de sibling vars OU prod() cross-line no where/indicator — split em 2 fases
        const ruleUsesSiblings = (rule: AutoSelectRule | null): boolean => {
          if (!rule) return false;
          const text = `${rule.where || ''} ${rule.indicator?.expr || ''}`;
          return /\bsibling[A-Z]/.test(text) || /\bprod\s*\(\s*L\d+/.test(text);
        };

        // Avalia se o produto/servico ATUAL do item ainda passa nos 3 filtros da regra
        // (filterCategoria, filterDescription, where). Se passa, item nao precisa
        // reauto-selecao — respeita escolha que continua valida.
        const currentStillPasses = (it: typeof itemsForAutoSelect[number], rule: AutoSelectRule, vars: Record<string, number | undefined>): boolean => {
          const current = it.product || it.service;
          if (!current) return false; // sem produto: precisa escolher
          const candidate = it.product
            ? [{ ...it.product }]
            : [{ ...(it.service as any), description: (it.service as any).name }];
          const filtered1 = filterCandidates(candidate as any, rule);
          if (filtered1.length === 0) return false;
          const filtered2 = filterByWhere(filtered1, rule, vars, cellRefSpecsMap);
          return filtered2.length > 0;
        };

        const processItem = async (
          it: typeof itemsForAutoSelect[number],
          extraVars: Record<string, number>,
          opts: { forceReapply?: boolean } = {},
        ) => {
          const rule = it.autoSelectRule as AutoSelectRule | null;
          if (!rule || (!rule.where && !rule.filterCategoria && !rule.filterDescription && !rule.filterPoolType && !rule.useSolarCollector && !rule.useSolarBomba && !rule.useTrocadorBomba)) return;

          // v1.12.26 / v1.13.52: flags "use*" — vinculam a linha DIRETO ao equipamento escolhido
          // no Simulador (ignoram filtros/criterio). Quando o operador troca no Simulador,
          // recalculateTotals reaplica e a linha acompanha. Coletor solar / bomba de recirculacao
          // solar / bomba de recirculacao da bomba de calor (trocador).
          const linkLineToSimulator = async (targetProductId?: string | null) => {
            if (targetProductId && it.productId !== targetProductId) {
              const product = allProducts.find((p) => p.id === targetProductId);
              if (product) {
                await this.prisma.poolBudgetItem.update({
                  where: { id: it.id },
                  data: {
                    productId: targetProductId,
                    serviceId: null,
                    description: product.description,
                    unit: product.unit,
                    unitPriceCents: product.salePriceCents ?? 0,
                    ...(it.formulaExpr ? {} : { qty: (product as any).defaultQty ?? 1 }),
                  },
                });
              }
            }
          };
          const simEnv = budget?.environmentParams as any;
          if (rule.useSolarCollector) { await linkLineToSimulator(simEnv?.solarReport?.selectedCollector?.productId); return; }
          if (rule.useSolarBomba) { await linkLineToSimulator(simEnv?.solarReport?.selectedBombaId); return; }
          if (rule.useTrocadorBomba) { await linkLineToSimulator(simEnv?.trocadorBombaId); return; }

          // manualSelection: regra so filtra candidatos no catalog picker, engine NAO escolhe automaticamente.
          // Usado quando o item nao tem criterio objetivo (ex: cascata e estetica) e o operador escolhe na mao.
          if (rule.manualSelection) return;
          const vars = { ...dimensionVars, ...extraVars };

          // Comportamento por tipo de item:
          //   - Items PRIMARIOS (filtro/cascata/SPA/aquecedor — Fase A, sem sibling):
          //     respeita produto vinculado se ainda passa na regra. So substitui se
          //     ficou incompativel. Permite operador escolher entre opcoes validas.
          //   - Items DEPENDENTES (tubos — Fase B, com sibling*): com forceReapply=true,
          //     SEMPRE re-aplica a regra todo recalc. Pra que quando o gestor troca
          //     o filtro/cascata/aquecedor manualmente, o tubo se ajuste automaticamente.
          //     A 'escolha manual' do tubo dura ate o proximo recalc do orcamento.
          if (!opts.forceReapply && (it.productId || it.serviceId) && currentStillPasses(it, rule, vars)) {
            return;
          }

          // Tenta primeiro Products, depois Services
          const bestProduct = selectBestCandidate(allProducts as any, rule, vars, cellRefSpecsMap);
          let target: { id: string; type: 'product' | 'service'; description: string; priceCents: number; unit: string } | null = null;
          if (bestProduct) {
            target = {
              id: bestProduct.id,
              type: 'product',
              description: bestProduct.description ?? '',
              priceCents: bestProduct.salePriceCents ?? 0,
              unit: bestProduct.unit ?? 'UN',
            };
          } else {
            const bestService = selectBestCandidate(
              allServices.map((s) => ({ ...s, description: s.name })) as any,
              rule,
              vars,
              cellRefSpecsMap,
            );
            if (bestService) {
              target = {
                id: bestService.id,
                type: 'service',
                description: (bestService as any).name ?? '',
                priceCents: (bestService as any).priceCents ?? 0,
                unit: (bestService as any).unit ?? 'UN',
              };
            }
          }
          if (!target) return;

          // REGRA #5 (formula prevalece): se item tem formulaExpr, NAO toca qty.
          //   Recalc PASSO 1 reavalia formula com novo produto vinculado.
          // Senao: SEMPRE qty = targetDefaultQty do novo produto (BUSCA do cadastro,
          //   sem snapshot, sem fallback hardcoded). Sistema busca a informacao —
          //   nao cria. Se cadastro tem defaultQty=1, qty=1. Se=2, qty=2.
          const hasFormula = !!(it.formulaExpr && it.formulaExpr.trim());
          const targetDefaultQty = target.type === 'product'
            ? (bestProduct as any)?.defaultQty as number | null | undefined
            : null;
          let newQty: number | undefined;
          if (!hasFormula && typeof targetDefaultQty === 'number') {
            newQty = targetDefaultQty;
          }

          // FIX v1.11.48 (bug v1.11.47): items SEM formula precisam de totalCents recalculado aqui.
          // PASSO 1/2 so atualizam totalCents pra items COM formula (via persistItem). Sem este recalc,
          // "↩ voltar selecao auto" vindo de Sem Produto (totalCents=0) mantinha totalCents=0 mesmo apos
          // vincular produto novo com preco. Items com formula: totalCents eh recomputado no PASSO 1/2.
          const finalUnitPrice = target.priceCents || it.unitPriceCents;
          const finalQty = newQty !== undefined ? newQty : (Number(it.qty) || 0);
          await this.prisma.poolBudgetItem.update({
            where: { id: it.id },
            data: {
              productId: target.type === 'product' ? target.id : null,
              serviceId: target.type === 'service' ? target.id : null,
              description: target.description || it.description,
              unitPriceCents: finalUnitPrice,
              unit: target.unit,
              ...(newQty !== undefined ? { qty: newQty } : {}),
              ...(hasFormula ? {} : { totalCents: Math.round(finalQty * finalUnitPrice) }),
              previousQty: null,
            },
          });
        };

        // Fase A: equipamentos primarios (sem sibling vars)
        const phaseA = itemsForAutoSelect.filter((it) => !ruleUsesSiblings(it.autoSelectRule as AutoSelectRule | null));
        const phaseB = itemsForAutoSelect.filter((it) => ruleUsesSiblings(it.autoSelectRule as AutoSelectRule | null));

        for (const it of phaseA) {
          await processItem(it, {});
        }

        // Calcula vars 'sibling*' por item da Fase B — usa linkedCellRef quando
        // a regra define vinculo explicito a uma linha (preferido). Senao, fallback
        // generico: itera outros items da mesma etapa, excluindo o proprio.
        if (phaseB.length > 0) {
          const allInBudget = await this.prisma.poolBudgetItem.findMany({
            where: { budgetId },
            select: {
              id: true,
              cellRef: true,
              poolSection: true,
              product: { select: { technicalSpecs: true } },
              service: { select: { technicalSpecs: true } },
            },
          });

          // Fase B (dependentes): forceReapply=true — items como tubos sempre seguem
          // o equipamento principal da etapa. Quando filtro/cascata/SPA/aquecedor muda,
          // o tubo redo automaticamente. Escolha manual em tubo dura ate o proximo recalc.
          for (const it of phaseB) {
            const rule = it.autoSelectRule as AutoSelectRule | null;
            const linkedCellRef = rule?.linkedCellRef || null;
            const sec = String(it.poolSection);
            const sectionVars: Record<string, number> = {};
            if (linkedCellRef) {
              // Modo vinculo explicito: pega APENAS o item com aquele cellRef
              const target = allInBudget.find((o) => o.cellRef === linkedCellRef);
              const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
              if (specs) {
                for (const [k, raw] of Object.entries(specs)) {
                  const n = Number(raw);
                  if (!Number.isFinite(n)) continue;
                  sectionVars[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
                }
              }
            } else {
              // Modo legacy: itera outros items da mesma etapa
              for (const other of allInBudget) {
                if (other.id === it.id) continue;
                if (String(other.poolSection) !== sec) continue;
                const specs = (other.product?.technicalSpecs as Record<string, unknown> | null) || null;
                if (!specs) continue;
                for (const [k, raw] of Object.entries(specs)) {
                  const n = Number(raw);
                  if (!Number.isFinite(n)) continue;
                  const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
                  if (sectionVars[siblingKey] === undefined) {
                    sectionVars[siblingKey] = n;
                  }
                }
              }
            }
            await processItem(it, sectionVars, { forceReapply: true });
          }
        }
      }
    }

    // PASSO 1: re-avalia formulas de items SEM dependencias (sem dias, sem cellRef de outros items)
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      select: {
        id: true, qty: true, qtyCalculated: true, unit: true, unitPriceCents: true,
        formulaExpr: true, cellRef: true, poolSection: true, autoSelectRule: true,
        manualUnlink: true, productId: true, serviceId: true,
        product: { select: { technicalSpecs: true, isSystemProduct: true } },
        service: { select: { technicalSpecs: true } },
      },
    });
    // v1.13.77: "Sem Produto" / "Sem Servico" = operador escolheu o placeholder no picker
    // (manualUnlink=true) e NAO ha item REAL vinculado (productId nulo ou o Product universal
    // isSystemProduct; serviceId nulo). Nessas linhas a qty e SEMPRE 0, mesmo com formula — a
    // formula so volta a valer quando o operador revincula um produto/servico real (cenario B/C
    // do picker). NAO pega linha de mao-de-obra manual com formula (essa tem manualUnlink=false).
    const hasRealProduct = (it: typeof items[number]) =>
      !!it.productId && (it.product as any)?.isSystemProduct !== true;
    const isSemItem = (it: typeof items[number]) =>
      it.manualUnlink === true && !hasRealProduct(it) && !it.serviceId;
    // Pre-pass: zera qty/qtyCalculated/total dessas linhas ANTES de reavaliar formulas (os loops
    // de formula abaixo as PULAM, pra a formula nao re-sobrescrever a qty zerada). Idempotente:
    // so escreve quando ha algo a zerar. Self-healing pra orcamentos antigos (qty de formula salva).
    for (const it of items) {
      if (!isSemItem(it)) continue;
      if (Number(it.qty) === 0 && Number(it.qtyCalculated ?? 0) === 0) continue;
      await this.prisma.poolBudgetItem.update({
        where: { id: it.id },
        data: { qty: 0, qtyCalculated: 0, totalCents: 0 },
      });
      it.qty = 0;
      it.qtyCalculated = 0;
    }
    // Calcula sibling vars POR ITEM. Modo preferido: linkedCellRef da regra
    // (vinculo explicito a uma linha). Fallback: outros items da mesma etapa
    // excluindo o proprio (evita auto-referencia).
    const computeSiblingsForItem = (it: typeof items[number]): Record<string, number> => {
      const sec = String(it.poolSection);
      const out: Record<string, number> = {};
      const linkedCellRef = (it.autoSelectRule as any)?.linkedCellRef as string | null | undefined;
      if (linkedCellRef && linkedCellRef.trim()) {
        const target = items.find((o) => o.cellRef === linkedCellRef.trim());
        const specs = (target?.product?.technicalSpecs ?? target?.service?.technicalSpecs) as Record<string, unknown> | null;
        if (specs) {
          for (const [k, raw] of Object.entries(specs)) {
            const n = Number(raw);
            if (!Number.isFinite(n)) continue;
            out[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
          }
        }
        return out;
      }
      for (const other of items) {
        if (other.id === it.id) continue;
        if (String(other.poolSection) !== sec) continue;
        const specs = (other.product?.technicalSpecs ?? other.service?.technicalSpecs) as Record<string, unknown> | null;
        if (!specs) continue;
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
          if (out[siblingKey] === undefined) {
            out[siblingKey] = n;
          }
        }
      }
      return out;
    };
    // Monta o vars completo pra um item: dimensions + environment + product/service specs + siblings da etapa
    const varsForItem = (it: typeof items[number]) => {
      const productSpecs = it.product?.technicalSpecs ?? it.service?.technicalSpecs ?? null;
      const siblings = computeSiblingsForItem(it);
      return { ...dimensionVars, ...extractProductVars(productSpecs), ...siblings };
    };

    const usesDias = (expr: string | null) => !!expr && /\bdias\b/.test(expr);
    const usesCellRef = (expr: string | null) => extractCellRefs(expr).length > 0;

    // Helpers de mutate state local
    function persistItem(it: typeof items[number], newQty: number) {
      const newTotal = Math.round(newQty * it.unitPriceCents);
      it.qty = newQty;
      return { qty: newQty, qtyCalculated: newQty, totalCents: newTotal };
    }

    // Constroi mapa cellRef -> dados (atualizado conforme items sao re-avaliados)
    function buildCellRefMap(): Map<string, CellRefData> {
      const map = new Map<string, CellRefData>();
      for (const it of items) {
        if (!it.cellRef) continue;
        const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
        const numericSpecs: Record<string, number> = {};
        if (specs && typeof specs === 'object') {
          for (const [k, v] of Object.entries(specs)) {
            const n = Number(v);
            if (Number.isFinite(n)) numericSpecs[k] = n;
          }
        }
        map.set(it.cellRef, {
          qty: Number(it.qty) || 0,
          total: ((Number(it.qty) || 0) * it.unitPriceCents) / 100,
          unitPrice: it.unitPriceCents / 100,
          specs: numericSpecs,
        });
      }
      return map;
    }
    // Lista de items pra agregacoes via sum(): cada item com qty + specs + categoria do produto
    const buildBudgetItemsForFormula = () => items.map((it) => {
      const specs = (it.product?.technicalSpecs ?? it.service?.technicalSpecs) as Record<string, unknown> | null | undefined;
      const numericSpecs: Record<string, number> = {};
      let categoria: string | null = null;
      if (specs && typeof specs === 'object') {
        for (const [k, v] of Object.entries(specs)) {
          if (k === 'categoriaPlanilha' && typeof v === 'string') {
            categoria = v;
          } else {
            const n = Number(v);
            if (Number.isFinite(n)) numericSpecs[k] = n;
          }
        }
      }
      return { qty: Number(it.qty) || 0, specs: numericSpecs, categoria };
    });

    // PASSO 1a: items sem nenhuma dependencia (so dimensions)
    for (const it of items) {
      if (!it.formulaExpr) continue;
      if (isSemItem(it)) continue; // Sem Produto/Servico: qty fica 0 (zerada no pre-pass)
      if (usesDias(it.formulaExpr) || usesCellRef(it.formulaExpr)) continue;
      try {
        const newQty = evaluateFormula(it.formulaExpr, varsForItem(it), new Map(), buildBudgetItemsForFormula());
        const data = persistItem(it, newQty);
        await this.prisma.poolBudgetItem.update({ where: { id: it.id }, data });
      } catch { /* mantem qty atual */ }
    }

    function computeDias(excludeItemId?: string): number {
      let totalHours = 0;
      for (const it of items) {
        if (excludeItemId && it.id === excludeItemId) continue;
        if (it.formulaExpr && usesDias(it.formulaExpr)) continue; // ignora items que dependem de dias
        const u = (it.unit || '').trim().toLowerCase();
        const qty = Number(it.qty) || 0;
        if (qty <= 0) continue;
        if (u === 'h' || u === 'hora' || u === 'horas') totalHours += qty;
        else if (u === 'd' || u === 'dia' || u === 'dias') totalHours += qty * HOURS_PER_DAY;
      }
      return totalHours > 0 ? Math.ceil(totalHours / HOURS_PER_DAY) : 0;
    }

    // PASSO 1b: items que usam APENAS dias (sem cellRef)
    for (const it of items) {
      if (!it.formulaExpr) continue;
      if (isSemItem(it)) continue; // Sem Produto/Servico: qty fica 0 (zerada no pre-pass)
      if (!usesDias(it.formulaExpr) || usesCellRef(it.formulaExpr)) continue;
      const diasForThis = computeDias(it.id);
      try {
        const newQty = evaluateFormula(it.formulaExpr, { ...varsForItem(it), dias: diasForThis }, new Map(), buildBudgetItemsForFormula());
        const data = persistItem(it, newQty);
        await this.prisma.poolBudgetItem.update({ where: { id: it.id }, data });
      } catch { /* mantem qty atual */ }
    }

    // PASSO 2: items que usam cellRef (com ou sem dias). Resolve em ordem topologica
    // (item depende de items ja resolvidos). Em ate N iteracoes (N = items count),
    // re-avalia items cujas dependencias agora estao prontas. Detecta ciclo se nao converge.
    const itemsWithCellRef = items.filter((it) => it.formulaExpr && usesCellRef(it.formulaExpr));
    const resolved = new Set<string>(); // ids ja resolvidos nesta passada
    const maxIter = itemsWithCellRef.length + 1;
    for (let iter = 0; iter < maxIter; iter++) {
      let progressed = false;
      for (const it of itemsWithCellRef) {
        if (resolved.has(it.id)) continue;
        if (isSemItem(it)) { resolved.add(it.id); continue; } // Sem Produto/Servico: qty fica 0 (pre-pass)
        const refs = extractCellRefs(it.formulaExpr!);
        // Verifica auto-referencia
        if (it.cellRef && refs.includes(it.cellRef)) {
          // Item ref a si mesmo - mantem qty atual
          resolved.add(it.id);
          continue;
        }
        // Todos os deps existem e ja foram resolvidos (ou nao precisam ser, se nao tem formula)?
        const cellRefMap = buildCellRefMap();
        const allDepsAvailable = refs.every((ref) => {
          const target = items.find((x) => x.cellRef === ref);
          if (!target) return false; // referencia para linha inexistente
          if (!target.formulaExpr || !usesCellRef(target.formulaExpr)) return true; // nao depende de outros
          return resolved.has(target.id);
        });
        if (!allDepsAvailable) continue;

        // Avalia
        try {
          const diasForThis = usesDias(it.formulaExpr!) ? computeDias(it.id) : 0;
          const newQty = evaluateFormula(
            it.formulaExpr!,
            { ...varsForItem(it), dias: diasForThis },
            cellRefMap,
            buildBudgetItemsForFormula(),
          );
          const data = persistItem(it, newQty);
          await this.prisma.poolBudgetItem.update({ where: { id: it.id }, data });
        } catch { /* mantem qty atual */ }
        resolved.add(it.id);
        progressed = true;
      }
      if (!progressed) break;
    }
    // Items nao resolvidos = ciclo detectado (A -> B -> A). Mantem qty atual deles.

    // PASSO 3: agora soma subtotal final e calcula totais/prazo
    const finalItems = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      select: { totalCents: true, qty: true, unit: true },
    });
    const subtotalCents = finalItems.reduce((sum, i) => sum + (i.totalCents ?? 0), 0);

    // Desconto: %/valor sobre subtotal
    const discountPctCents = budget?.discountPercent && budget.discountPercent > 0
      ? Math.round(subtotalCents * (budget.discountPercent / 100))
      : 0;
    const discountFlatCents = budget?.discountCents && budget.discountCents > 0
      ? budget.discountCents
      : 0;
    const discountCents = discountPctCents + discountFlatCents;

    // Impostos: % sobre subtotal
    const taxesCents = budget?.taxesPercent && budget.taxesPercent > 0
      ? Math.round(subtotalCents * (budget.taxesPercent / 100))
      : 0;

    // Total Geral = subtotal - desconto + impostos
    const totalCents = Math.max(0, subtotalCents - discountCents + taxesCents);

    // Prazo final (ja inclui items com unit DIA/h, exceto os que dependem de dias)
    const estimatedDurationDays = computeDias() || null;

    let endDate: Date | null = null;
    if (budget?.startDate && estimatedDurationDays && estimatedDurationDays > 0) {
      endDate = new Date(budget.startDate);
      endDate.setUTCDate(endDate.getUTCDate() + estimatedDurationDays);
    }

    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: {
        subtotalCents,
        taxesCents,
        totalCents,
        estimatedDurationDays,
        endDate,
      },
    });
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters: QueryPoolBudgetDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.assertModuleActive(companyId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolBudgetWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.clientPartnerId ? { clientPartnerId: filters.clientPartnerId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { code: { contains: filters.search, mode: 'insensitive' } },
              { title: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.PoolBudgetOrderByWithRelationInput = pagination.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder ?? 'desc' }
      : { createdAt: 'desc' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poolBudget.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          clientPartner: { select: { id: true, name: true, document: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.poolBudget.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        clientPartner: true,
        template: { select: { id: true, name: true } },
        printLayout: { select: { id: true, name: true } },
        paymentTerm: true,
        items: {
          orderBy: [{ poolSection: 'asc' }, { sortOrder: 'asc' }],
          include: {
            product: { select: { id: true, code: true, description: true, imageUrl: true, technicalSpecs: true, defaultQty: true, isSystemProduct: true } },
            service: { select: { id: true, code: true, name: true, imageUrl: true, technicalSpecs: true } },
          },
        },
        project: { select: { id: true, code: true, status: true } },
      },
    });

    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    // Calcula indicator (label, color, value) em runtime pra cada item com autoSelectRule.
    // Nao armazena em DB — sempre fresco baseado em dimensoes atuais + technicalSpecs do produto.
    const dimensionVarsForIndicator = {
      ...extractDimensionVars(budget.poolDimensions),
      ...extractEnvVars(budget.environmentParams),
      ...extractHeatingVars(budget.heatingReport),
      ...extractSolarVars((budget.environmentParams as any)?.solarReport),
    };
    // Calcula sibling vars POR ITEM, excluindo o proprio (evita auto-referencia).
    // v1.11.05: necessario pra indicators que referenciam o equipamento principal
    // da etapa (ex: tubo usa siblingTuboEntradaMm). Antes calculava por etapa global
    // — bug: tubo lia o proprio tuboEntradaMm em vez do kit/filtro.
    const computeIndicatorSiblings = (currentId: string, sec: string, linkedCellRef?: string | null): Record<string, number> => {
      const out: Record<string, number> = {};
      if (linkedCellRef && linkedCellRef.trim()) {
        const target = budget.items.find((o) => o.cellRef === linkedCellRef.trim());
        const specs = ((target?.product as any)?.technicalSpecs ?? (target?.service as any)?.technicalSpecs) as Record<string, unknown> | null;
        if (specs) {
          for (const [k, raw] of Object.entries(specs)) {
            const n = Number(raw);
            if (!Number.isFinite(n)) continue;
            out[`sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`] = n;
          }
        }
        return out;
      }
      for (const other of budget.items) {
        if (other.id === currentId) continue;
        if (String(other.poolSection) !== sec) continue;
        const specs = ((other.product as any)?.technicalSpecs ?? (other.service as any)?.technicalSpecs) as Record<string, unknown> | null;
        if (!specs) continue;
        for (const [k, raw] of Object.entries(specs)) {
          const n = Number(raw);
          if (!Number.isFinite(n)) continue;
          const siblingKey = `sibling${k.charAt(0).toUpperCase()}${k.slice(1)}`;
          if (out[siblingKey] === undefined) {
            out[siblingKey] = n;
          }
        }
      }
      return out;
    };
    // Map cellRef -> productSpecs pra que evaluateIndicator possa avaliar
    // prod(LX, "spec") quando o indicator usar referencia cross-line.
    const indicatorCellRefSpecs = new Map<string, Record<string, unknown>>();
    for (const it of budget.items) {
      if (!it.cellRef) continue;
      const specs = ((it.product as any)?.technicalSpecs ?? (it.service as any)?.technicalSpecs) as Record<string, unknown> | null | undefined;
      if (specs) indicatorCellRefSpecs.set(it.cellRef, specs);
    }
    // Specs cumulativos: capacidade total = qty × unitario. Indicator "Folga aquec."
    // deve refletir 2× X23-40C como 68.800 kcal/h, nao 34.400. v1.11.86.
    const CUMULATIVE_SPECS = new Set([
      'kcalHNominal', 'kcalHMin', 'kcalHMax', 'btuH', 'kwNominal',
      'consumoMaxW', 'consumoMedioW', 'ratedInputPowerKW',
      'vazaoM3h', 'vazaoLmin', 'potenciaWatts', 'amperagem',
    ]);
    const multiplySpecsByQty = (specs: any, qty: number): any => {
      if (!specs || qty <= 1) return specs;
      const out: Record<string, unknown> = { ...specs };
      for (const k of Object.keys(out)) {
        if (CUMULATIVE_SPECS.has(k)) {
          const n = Number(out[k]);
          if (Number.isFinite(n)) out[k] = n * qty;
        }
      }
      return out;
    };

    for (const item of budget.items) {
      const rule = (item as any).autoSelectRule as AutoSelectRule | null | undefined;
      if (!rule?.indicator) continue;
      const rawSpecs = (item.product as any)?.technicalSpecs ?? (item.service as any)?.technicalSpecs ?? null;
      const itemQty = Number(item.qty) || 1;
      const productSpecs = multiplySpecsByQty(rawSpecs, itemQty);
      const siblings = computeIndicatorSiblings(item.id, String(item.poolSection), rule.linkedCellRef);
      const vars = { ...dimensionVarsForIndicator, ...extractProductVars(productSpecs), ...siblings, qty: itemQty };
      const calculated = evaluateIndicator(rule, vars, indicatorCellRefSpecs);
      if (calculated) {
        (item as any).indicatorLabel = calculated.label;
        (item as any).indicatorColor = calculated.color;
        (item as any).indicatorValue = calculated.value;
        (item as any).indicatorUnit = calculated.unit;
      }
    }

    // v1.13.77: linhas "Sem Produto" / "Sem Servico" exibem qty 0 (sem item real = nada a comprar),
    // mesmo que tenham formula. Read-time apenas (nao escreve no DB) — orcamentos antigos ja mostram 0
    // ao ABRIR, sem precisar editar; o recalculateTotals grava 0 de fato no proximo save/edit. Totais
    // nao mudam (linha Sem Produto tem unitPriceCents=0 -> totalCents ja era 0). Zera tambem
    // qtyCalculated pra a linha nao acender o amarelo de "qty fora da formula". Roda DEPOIS do loop
    // de indicadores (que usa a qty original — Sem Produto so muda o numero exibido, nao o indicador).
    for (const item of budget.items) {
      const semHasRealProduct = !!item.productId && (item.product as any)?.isSystemProduct !== true;
      const isSem = (item as any).manualUnlink === true && !semHasRealProduct && !item.serviceId;
      if (isSem && (Number(item.qty) !== 0 || Number(item.qtyCalculated) !== 0)) {
        (item as any).qty = 0;
        (item as any).qtyCalculated = 0;
      }
    }

    // Auto-backfill de cellRef em items legacy (criados antes da feature de cellRef).
    // Sem cellRef, formulas com qty(LX)/total(LX) nao acham nenhuma linha referenciavel.
    const missing = budget.items.filter((it) => !it.cellRef);
    if (missing.length > 0) {
      let nextNum = budget.items.reduce((max, it) => {
        const m = it.cellRef?.match(/^L(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const updates: Promise<any>[] = [];
      for (const it of missing.sort((a, b) => a.sortOrder - b.sortOrder)) {
        nextNum++;
        const newRef = `L${nextNum}`;
        updates.push(
          this.prisma.poolBudgetItem.update({
            where: { id: it.id },
            data: { cellRef: newRef },
          }),
        );
        it.cellRef = newRef;
      }
      await Promise.all(updates);
    }

    return budget;
  }

  /**
   * Atualiza configuracao de etapas customizadas do orcamento.
   * - labels: salvo em environmentParams.customSections.labels — sobrescreve label
   *   padrao (ex: CONSTRUCAO -> "Estrutura"). Tambem armazena labels de etapas
   *   custom criadas pelo operador (ex: CUSTOM_DECK -> "Deck Madeira")
   * - order: salvo no campo dedicado sectionOrder do PoolBudget
   * - hidden: salvo em environmentParams.customSections.hidden — etapas
   *   escondidas (mesmo que existam no SECTION_ORDER padrao)
   * Mantem retrocompatibilidade: orcamentos sem custom usam defaults do front.
   */
  async updateSections(
    id: string,
    companyId: string,
    body: { labels?: Record<string, string>; order?: string[]; hidden?: string[] },
  ) {
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true, frozenAt: true, environmentParams: true, sectionOrder: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado não pode ter etapas alteradas.');
    }
    this.assertNotFrozen(budget);

    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const current = (env.customSections ?? {}) as Record<string, any>;
    const nextCustom = {
      labels: { ...(current.labels ?? {}), ...(body.labels ?? {}) },
      hidden: body.hidden ?? current.hidden ?? [],
    };
    const nextEnv = { ...env, customSections: nextCustom };
    const updateData: Prisma.PoolBudgetUpdateInput = {
      environmentParams: nextEnv as Prisma.InputJsonValue,
    };
    if (body.order !== undefined) updateData.sectionOrder = body.order;
    await this.prisma.poolBudget.update({ where: { id }, data: updateData });
    return {
      customSections: nextCustom,
      sectionOrder: body.order ?? budget.sectionOrder ?? [],
    };
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePoolBudgetDto,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Orçamento não encontrado');

    if (before.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException(
        'Orçamento aprovado não pode ser editado. Crie uma nova versão.',
      );
    }
    this.assertNotFrozen(before);

    // Invalida cache do heatingReport quando dimensoes ou environmentParams mudam.
    // Forca recompute na proxima vez (recalculateTotals ou Simulador).
    const shouldInvalidateHeating = dto.poolDimensions !== undefined || dto.environmentParams !== undefined;

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        clientPartnerId: dto.clientPartnerId,
        templateId: dto.templateId,
        printLayoutId: dto.printLayoutId,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        poolDimensions: dto.poolDimensions
          ? (this.enrichPoolDimensions(dto.poolDimensions) as unknown as Prisma.InputJsonValue)
          : undefined,
        // MERGE (nao replace): preserva chaves que o editor NAO gerencia — customSections
        // (nomes das etapas custom renomeadas) + heatingOverride/solarReport/solarOverride do
        // simulador. Bug: o editor montava o environmentParams do zero a partir do formulario
        // e sobrescrevia tudo, dropando o nome renomeado das etapas custom.
        environmentParams: dto.environmentParams !== undefined
          ? ({ ...((before.environmentParams as Record<string, any>) ?? {}), ...(dto.environmentParams as Record<string, any>) } as Prisma.InputJsonValue)
          : undefined,
        validityDays: dto.validityDays,
        discountCents: dto.discountCents,
        discountPercent: dto.discountPercent,
        taxesPercent: dto.taxesPercent,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        equipmentWarranty: dto.equipmentWarranty,
        workWarranty: dto.workWarranty,
        paymentTerms: dto.paymentTerms,
        earlyPaymentDiscountPct: dto.earlyPaymentDiscountPct,
        sectionOrder: dto.sectionOrder,
        paymentTermId: dto.paymentTermId,
        // Limpa cache do simulador quando dimensoes/clima mudam — recompute lazy
        ...(shouldInvalidateHeating ? { heatingReport: Prisma.DbNull } : {}),
      },
    });

    if (
      dto.discountCents !== undefined ||
      dto.discountPercent !== undefined ||
      dto.taxesPercent !== undefined ||
      dto.startDate !== undefined ||
      shouldInvalidateHeating
    ) {
      // v1.13.66: redimensionarRecirc=true SO neste save de orcamento (update). Quando dims/clima
      // mudam (shouldInvalidateHeating), a recirc precisa re-otimizar — mesma logica do "abrir o
      // Aquecimento". Edicoes de linha/reorder/create chamam recalculateTotals sem a flag.
      await this.recalculateTotals(id, { redimensionarRecirc: true });
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Orçamento não encontrado');

    if (before.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException(
        'Orçamento aprovado não pode ser removido. Cancele ao invés.',
      );
    }

    await this.prisma.poolBudget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== ITEMS ==============

  async addItem(
    budgetId: string,
    dto: CreateBudgetItemDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { id: true, status: true, frozenAt: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode adicionar items');
    }
    this.assertNotFrozen(budget);

    // v1.12.20: auto-link silencioso por descricao foi REMOVIDO. Linha
    // sempre vem livre (sem vinculo) a menos que DTO traga productId/serviceId
    // explicito. Operador vincula manualmente via picker (icone ✨).
    const resolvedProductId = dto.productId ?? null;
    const resolvedServiceId = dto.serviceId ?? null;

    // Se formula foi enviada, avalia e sobrescreve qty + qtyCalculated
    let effectiveQty = dto.qty;
    let qtyCalculated: number | undefined;
    if (dto.formulaExpr && dto.formulaExpr.trim()) {
      const fullBudget = await this.prisma.poolBudget.findUnique({
        where: { id: budgetId },
        select: { poolDimensions: true },
      });
      // Inclui technicalSpecs do produto/servico vinculado pra suportar formulas
      // que usam vars como consumoKgM2, pesoKg, vazaoM3h, etc.
      let productSpecs: unknown = null;
      if (resolvedProductId) {
        const p = await this.prisma.product.findUnique({
          where: { id: resolvedProductId },
          select: { technicalSpecs: true },
        });
        productSpecs = p?.technicalSpecs;
      } else if (resolvedServiceId) {
        const s = await this.prisma.service.findUnique({
          where: { id: resolvedServiceId },
          select: { technicalSpecs: true },
        });
        productSpecs = s?.technicalSpecs;
      }
      // Se a regra tem linkedCellRef, siblings vem so dessa linha (vinculo explicito)
      const ruleLinkedCellRef = (dto.autoSelectRule as any)?.linkedCellRef as string | null | undefined;
      const siblingVars = await this.buildSiblingVars(budgetId, dto.poolSection, undefined, ruleLinkedCellRef);
      const vars = { ...extractDimensionVars(fullBudget?.poolDimensions), ...extractProductVars(productSpecs), ...siblingVars };
      const cellRefMap = await this.buildBudgetCellRefMap(budgetId);
      try {
        effectiveQty = evaluateFormula(dto.formulaExpr, vars, cellRefMap);
        qtyCalculated = effectiveQty;
      } catch (err: any) {
        // Se a formula usa cellRef e nao consegue resolver agora, deixa pro recalculateTotals
        const refs = extractCellRefs(dto.formulaExpr);
        if (refs.length > 0) {
          // mantem qty fornecido no DTO; recalculateTotals depois ajusta
          qtyCalculated = effectiveQty;
        } else {
          // Mensagem rica quando a formula usa sibling* e o erro pode ser por var indisponivel
          const diag = await this.diagnoseSiblingFailure(budgetId, dto.poolSection, dto.formulaExpr);
          throw new BadRequestException(diag || `Formula invalida: ${err.message}`);
        }
      }
    }
    const totalCents = Math.round(effectiveQty * dto.unitPriceCents);
    const cellRef = await this.nextCellRef(budgetId);

    // v1.12.25: sortOrder default = max(sortOrder da etapa) + 1, pra nova linha
    // ir sempre pro FINAL da etapa em vez de pro topo (sortOrder=0 colidindo
    // com items existentes). Mantém ordem natural "se ja tem 5, proxima eh a 6a".
    let nextSortOrder = dto.sortOrder;
    if (nextSortOrder === undefined) {
      const agg = await this.prisma.poolBudgetItem.aggregate({
        where: { budgetId, poolSection: dto.poolSection },
        _max: { sortOrder: true },
      });
      nextSortOrder = (agg._max.sortOrder ?? -1) + 1;
    }

    const item = await this.prisma.poolBudgetItem.create({
      data: {
        budgetId,
        catalogConfigId: dto.catalogConfigId,
        productId: resolvedProductId,
        serviceId: resolvedServiceId,
        poolSection: dto.poolSection,
        kind: dto.kind ?? 'PRODUCT',
        sortOrder: nextSortOrder,
        slotName: dto.slotName,
        description: dto.description,
        unit: dto.unit ?? 'UN',
        cellRef,
        qty: effectiveQty,
        qtyCalculated: qtyCalculated ?? null,
        formulaExpr: dto.formulaExpr || null,
        ...(dto.autoSelectRule ? { autoSelectRule: dto.autoSelectRule as Prisma.InputJsonValue } : {}),
        unitPriceCents: dto.unitPriceCents,
        totalCents,
        isAutoCalculated: !!dto.formulaExpr,
        isExtra: dto.isExtra ?? true,
        notes: dto.notes,
      },
    });

    await this.recalculateTotals(budgetId);

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_ITEM',
      entityId: item.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: item as unknown as Record<string, unknown>,
    });

    return item;
  }

  // Reordena items em LOTE numa unica transacao (1 request -> N updates atomicos).
  // Substitui o burst de N PUTs paralelas do front (moveItem), que estourava o Throttler
  // (60 req/60s) numa etapa com muitas linhas. Reordenar NAO muda valores: o cellRef
  // (L1, L2, ...) e o endereco estavel das formulas, independente do sortOrder -> NAO
  // chama recalculateTotals. O where (budgetId + companyId) garante tenant isolation e
  // que so linhas DESTE orcamento mudam (IDs estranhos viram no-op, count 0).
  async reorderItems(
    budgetId: string,
    orderedIds: string[],
    companyId: string,
    _user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestException('Lista de IDs e obrigatoria');
    }

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      select: { id: true, status: true, frozenAt: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode editar items');
    }
    this.assertNotFrozen(budget);

    await this.prisma.$transaction(
      orderedIds.map((itemId, index) =>
        this.prisma.poolBudgetItem.updateMany({
          where: { id: itemId, budgetId, budget: { companyId } },
          data: { sortOrder: index },
        }),
      ),
    );

    return { success: true };
  }

  async updateItem(
    itemId: string,
    dto: UpdateBudgetItemDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const item = await this.prisma.poolBudgetItem.findFirst({
      where: { id: itemId, budget: { companyId, deletedAt: null } },
      include: { budget: { select: { status: true, frozenAt: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode editar items');
    }
    this.assertNotFrozen(item.budget);

    // Se formula foi enviada, recalcula qty + qtyCalculated. String vazia = remove formula.
    let effectiveQty = dto.qty ?? item.qty;
    let qtyCalculated: number | null | undefined = undefined;
    let formulaExpr: string | null | undefined = undefined;
    let autoCalculatedOverride: boolean | undefined = undefined;

    // v1.11.95: "Voltar selecao auto" da linha (manualUnlink: false) em linha de bomba
    // de calor: tambem limpa heatingOverride no env do orcamento. Assim o Simulador
    // tambem volta pro modo auto (sem multiplicador). A formula da linha (bombaCalorQty)
    // continua intacta — reavalia automaticamente apos o override ser limpo.
    if (dto.manualUnlink === false) {
      const product = item.productId ? await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { poolType: true },
      }) : null;
      const pt = (product?.poolType || '').toLowerCase();
      if (pt.includes('bomba') || pt.includes('aquecedor')) {
        const budget = await this.prisma.poolBudget.findUnique({
          where: { id: item.budgetId },
          select: { environmentParams: true },
        });
        const env = (budget?.environmentParams ?? {}) as Record<string, any>;
        if (env.heatingOverride) {
          const newEnv = { ...env };
          delete newEnv.heatingOverride;
          await this.prisma.poolBudget.update({
            where: { id: item.budgetId },
            data: { environmentParams: newEnv as any, heatingReport: null as any },
          });
        }
      }
    }
    if (dto.formulaExpr !== undefined) {
      if (dto.formulaExpr.trim()) {
        const fullBudget = await this.prisma.poolBudget.findUnique({
          where: { id: item.budgetId },
          select: { poolDimensions: true },
        });
        // Inclui technicalSpecs do produto/servico vinculado (formulas com consumoKgM2,
        // pesoKg, vazaoM3h etc dependem disso). Usa o vinculo atual do item, ou novo do DTO se mudou.
        const targetProductId = dto.productId !== undefined ? dto.productId : item.productId;
        const targetServiceId = dto.serviceId !== undefined ? dto.serviceId : item.serviceId;
        let productSpecs: unknown = null;
        if (targetProductId) {
          const p = await this.prisma.product.findUnique({
            where: { id: targetProductId },
            select: { technicalSpecs: true },
          });
          productSpecs = p?.technicalSpecs;
        } else if (targetServiceId) {
          const s = await this.prisma.service.findUnique({
            where: { id: targetServiceId },
            select: { technicalSpecs: true },
          });
          productSpecs = s?.technicalSpecs;
        }
        // Exclui o proprio item — evita auto-referencia em items com technicalSpecs
        // (ex: tubo lendo o proprio tuboEntradaMm via siblingTuboEntradaMm).
        // Se a regra tem linkedCellRef, usa SO a linha vinculada (vinculo explicito).
        const ruleLinkedCellRef = (dto.autoSelectRule as any)?.linkedCellRef ?? (item.autoSelectRule as any)?.linkedCellRef ?? null;
        const siblingVars = await this.buildSiblingVars(item.budgetId, item.poolSection, item.id, ruleLinkedCellRef);
        const vars = { ...extractDimensionVars(fullBudget?.poolDimensions), ...extractProductVars(productSpecs), ...siblingVars };
        const cellRefMap = await this.buildBudgetCellRefMap(item.budgetId);
        try {
          effectiveQty = evaluateFormula(dto.formulaExpr, vars, cellRefMap);
        } catch (err: any) {
          // Se usa cellRef e nao resolve agora, deixa pro recalculateTotals depois
          const refs = extractCellRefs(dto.formulaExpr);
          if (refs.length === 0) {
            // Mensagem rica quando a formula usa sibling* e o erro pode ser por var indisponivel
            const diag = await this.diagnoseSiblingFailure(item.budgetId, item.poolSection, dto.formulaExpr);
            throw new BadRequestException(diag || `Formula invalida: ${err.message}`);
          }
          // mantem qty atual; recalc ajusta
        }
        qtyCalculated = effectiveQty;
        formulaExpr = dto.formulaExpr;
        autoCalculatedOverride = true;
      } else {
        // Limpa formula
        qtyCalculated = null;
        formulaExpr = null;
        autoCalculatedOverride = false;
      }
    }
    const newUnitPrice = dto.unitPriceCents ?? item.unitPriceCents;
    const totalCents = Math.round(effectiveQty * newUnitPrice);

    // v1.12.20: auto-link silencioso por descricao foi REMOVIDO. Operador
    // vincula manualmente via picker (icone ✨). Sem essa logica magica,
    // linha continua livre a menos que DTO traga productId/serviceId.

    const updated = await this.prisma.poolBudgetItem.update({
      where: { id: itemId },
      data: {
        slotName: dto.slotName,
        description: dto.description,
        unit: dto.unit,
        qty: dto.formulaExpr !== undefined && formulaExpr ? effectiveQty : dto.qty,
        qtyCalculated,
        formulaExpr,
        unitPriceCents: dto.unitPriceCents,
        totalCents,
        sortOrder: dto.sortOrder,
        notes: dto.notes,
        ...(dto.catalogConfigId !== undefined ? { catalogConfigId: dto.catalogConfigId } : {}),
        ...(dto.productId !== undefined ? { productId: dto.productId } : {}),
        ...(dto.serviceId !== undefined ? { serviceId: dto.serviceId } : {}),
        ...(dto.autoSelectRule !== undefined
          ? { autoSelectRule: (dto.autoSelectRule === null ? Prisma.JsonNull : dto.autoSelectRule) as Prisma.InputJsonValue }
          : {}),
        ...(dto.manualUnlink !== undefined ? { manualUnlink: dto.manualUnlink } : {}),
        ...(dto.suppressVazaoAlert !== undefined ? { suppressVazaoAlert: dto.suppressVazaoAlert } : {}),
        ...(dto.previousQty !== undefined ? { previousQty: dto.previousQty } : {}),
        ...(dto.qtyDecimals !== undefined ? { qtyDecimals: dto.qtyDecimals } : {}),
        ...(dto.poolSection !== undefined ? { poolSection: dto.poolSection } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(autoCalculatedOverride !== undefined
          ? { isAutoCalculated: autoCalculatedOverride }
          : (dto.qty !== undefined || dto.unitPriceCents !== undefined
            ? { isAutoCalculated: false }
            : {})),
      },
    });

    await this.recalculateTotals(item.budgetId);

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_ITEM',
      entityId: itemId,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: item as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async removeItem(itemId: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const item = await this.prisma.poolBudgetItem.findFirst({
      where: { id: itemId, budget: { companyId, deletedAt: null } },
      include: { budget: { select: { status: true, frozenAt: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode remover items');
    }
    this.assertNotFrozen(item.budget);

    await this.prisma.poolBudgetItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(item.budgetId);

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_ITEM',
      entityId: itemId,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: item as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== APLICAR TEMPLATE LINEAR (Padrao Juliano) ==============

  /**
   * Aplica o template "Linear" extraido da planilha de origem (ANDREIA SANTANA
   * - Orçamento 120614042026.xlsm aba Linear) ao orçamento atual.
   *
   * Para cada linha da planilha cria 1 PoolBudgetItem com:
   *  - slotName = coluna "Etapa" da planilha (rotulo do papel da linha)
   *  - description = coluna "Descricao" (produto/servico inicial sugerido)
   *  - unit/qty/unitPriceCents conforme planilha
   *  - poolSection = mapeamento da etapa (CONSTRUCAO, FILTRO, etc)
   *  - tenta vincular catalogConfigId/productId/serviceId procurando match
   *    pela `description` no PoolCatalogConfig/Product/Service do tenant
   *
   * So aplica se o orçamento estiver SEM items (RASCUNHO + items vazios) — pra
   * evitar duplicacao acidental.
   */
  async applyLinearTemplate(
    budgetId: string,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      include: { items: { select: { id: true } } },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode aplicar template');
    }
    this.assertNotFrozen(budget);
    if (budget.items.length > 0) {
      throw new BadRequestException(
        'Orçamento ja tem items. Apague todos antes de aplicar o template Linear, ou crie um orçamento novo.',
      );
    }

    // Carrega o JSON do template (bundled em scripts/pool-seed/linear_template.json)
    // Tenta varios caminhos pra cobrir dev (ts-node de src/) e prod (dist/) e
    // tambem container Docker (cwd=/app).
    const candidates = [
      path.join(__dirname, '../../scripts/pool-seed/linear_template.json'),
      path.join(__dirname, '../../../scripts/pool-seed/linear_template.json'),
      path.resolve(process.cwd(), 'scripts/pool-seed/linear_template.json'),
      path.resolve(process.cwd(), '../scripts/pool-seed/linear_template.json'),
    ];
    let template: Array<{ label: string; items: Array<any> }> | null = null;
    let lastError = '';
    for (const tplPath of candidates) {
      try {
        if (fs.existsSync(tplPath)) {
          template = JSON.parse(fs.readFileSync(tplPath, 'utf-8'));
          this.logger.log(`Linear template carregado de: ${tplPath}`);
          break;
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }
    if (!template) {
      throw new BadRequestException(
        `Template Linear nao encontrado. Caminhos tentados: ${candidates.join('; ')}. Erro: ${lastError}`,
      );
    }

    // Mapeia rotulos da planilha → PoolSection enum
    const SECTION_MAP: Record<string, string> = {
      'CONSTRUÇÃO': 'CONSTRUCAO',
      'FILTRO': 'FILTRO',
      'CASCATA': 'CASCATA',
      'SPA': 'SPA',
      'AQUECIMENTO': 'AQUECIMENTO',
      'ILUMINAÇÃO': 'ILUMINACAO',
      'CASA DE MAQUINAS': 'CASA_MAQUINAS',
      'OUTROS OPCIONAIS': 'OUTROS',
      'DISPOSITIVOS': 'DISPOSITIVOS',
      'ACIONAMENTOS ELÉTRICOS': 'ACIONAMENTOS',
      'BORDA E CALÇADA': 'BORDA_CALCADA',
      'EXECUÇÃO E ADICIONAIS': 'EXECUCAO',
    };

    // Carrega catalog completo do tenant (1x) pra fazer matching por descricao
    const catalogs = await this.prisma.poolCatalogConfig.findMany({
      where: { companyId },
      include: {
        product: { select: { id: true, description: true, salePriceCents: true, unit: true } },
        service: { select: { id: true, name: true, priceCents: true, unit: true } },
      },
    });
    const findCatalog = (descricao: string) => {
      if (!descricao) return null;
      const norm = descricao.toLowerCase().trim().substring(0, 30);
      for (const c of catalogs) {
        const candidato = c.product?.description?.toLowerCase()?.trim() || c.service?.name?.toLowerCase()?.trim();
        if (candidato && candidato.startsWith(norm.substring(0, 15))) return c;
      }
      return null;
    };

    // Cria todos os items em batch
    const itemsToCreate: Prisma.PoolBudgetItemCreateManyInput[] = [];
    let created = 0;
    let unmappedSections = new Set<string>();
    let globalSort = 0;

    for (const sec of template) {
      const poolSection = SECTION_MAP[sec.label];
      if (!poolSection) {
        unmappedSections.add(sec.label);
        continue;
      }
      for (const it of sec.items) {
        const cat = findCatalog(it.descricao);
        const qty = it.qty || 0;
        // Sistema eh autoritativo: unitPrice arredondado ao centavo,
        // totalCents = qty × unitPriceCents (auto consistente).
        const unitPriceCents = Math.round((it.valorUnit || 0) * 100);
        const totalCents = Math.round(qty * unitPriceCents);
        itemsToCreate.push({
          budgetId,
          poolSection: poolSection as any,
          sortOrder: globalSort++,
          cellRef: `L${itemsToCreate.length + 1}`,
          slotName: it.etapa || null,
          description: it.descricao || it.etapa || '(sem descricao)',
          unit: it.unit || 'UN',
          qty,
          unitPriceCents,
          totalCents,
          isAutoCalculated: false,
          isExtra: false,
          catalogConfigId: cat?.id || null,
          productId: cat?.productId || null,
          serviceId: cat?.serviceId || null,
          // v1.12.21: kind explicito. Se o item do template vinculou a um
          // service do catalogo, eh SERVICE. Caso contrario, PRODUCT.
          kind: cat?.serviceId ? 'SERVICE' : 'PRODUCT',
        });
        created++;
      }
    }

    if (itemsToCreate.length > 0) {
      await this.prisma.poolBudgetItem.createMany({ data: itemsToCreate });
      await this.recalculateTotals(budgetId);
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: budgetId,
      action: 'TEMPLATE_APPLIED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: { template: 'LINEAR_DEFAULT', itemsCreated: created } as any,
    });

    return {
      itemsCreated: created,
      unmappedSections: [...unmappedSections],
    };
  }

  // ============== STATUS TRANSITIONS ==============

  /**
   * Lanca se o orcamento esta CADASTRADO (congelado). Bloqueia EDICAO + recalculo.
   * As acoes de STATUS (aprovar/rejeitar/cancelar) NAO usam este guard — so a edicao.
   */
  private assertNotFrozen(budget: { frozenAt: Date | null }): void {
    if (budget.frozenAt) {
      throw new BadRequestException(
        'Orçamento cadastrado (congelado). Clique em "Editar" para liberar a edição.',
      );
    }
  }

  /**
   * Cadastrar (congelar): o gestor finaliza o orcamento. Congela edicao + recalculo
   * automatico (totais/qty/heating/solar) e libera o PDF. Reversivel via unregister.
   */
  async register(id: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, status: true, frozenAt: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.CANCELADO || budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException(`Orçamento ${budget.status} não pode ser cadastrado.`);
    }
    if (budget.frozenAt) return budget; // ja cadastrado — idempotente
    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: { frozenAt: new Date(), frozenByName: user.email },
    });
    this.audit.log({
      companyId, entityType: 'POOL_BUDGET', entityId: id, action: 'REGISTERED',
      actorType: 'USER', actorId: user.id, actorName: user.email,
    });
    return updated;
  }

  /**
   * Editar (descongelar): libera o orcamento pra edicao de novo. Limpa frozenAt.
   * A partir daqui as edicoes voltam a recalcular (aplicando a logica/features atuais).
   */
  async unregister(id: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);
    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, frozenAt: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (!budget.frozenAt) return budget; // ja editavel — idempotente
    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: { frozenAt: null, frozenByName: null },
    });
    this.audit.log({
      companyId, entityType: 'POOL_BUDGET', entityId: id, action: 'UNREGISTERED',
      actorType: 'USER', actorId: user.id, actorName: user.email,
    });
    return updated;
  }

  /** Titulo da copia: incrementa o /N final do titulo, ou embute o codigo + /2 na 1a vez. */
  private nextVersionTitle(title: string, code: string | null): string {
    const base = (title ?? '').trim();
    const m = base.match(/^(.*?)\s*\/\s*(\d+)\s*$/);
    if (m) return `${m[1].trim()}/${Number(m[2]) + 1}`;
    return `${base}${code ? ` ${code}` : ''}/2`;
  }

  /** Precos atuais do catalogo (P:<id> -> salePriceCents, S:<id> -> priceCents) pros itens. */
  private async fetchCurrentPrices(
    companyId: string,
    items: Array<{ productId: string | null; serviceId: string | null }>,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
    const serviceIds = [...new Set(items.map((i) => i.serviceId).filter(Boolean))] as string[];
    if (productIds.length) {
      const prods = await this.prisma.product.findMany({
        where: { id: { in: productIds }, companyId, deletedAt: null },
        select: { id: true, salePriceCents: true },
      });
      prods.forEach((p) => { if (p.salePriceCents != null) map.set(`P:${p.id}`, p.salePriceCents); });
    }
    if (serviceIds.length) {
      const svcs = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, companyId, deletedAt: null },
        select: { id: true, priceCents: true },
      });
      svcs.forEach((s) => { if (s.priceCents != null) map.set(`S:${s.id}`, s.priceCents); });
    }
    return map;
  }

  /**
   * Duplica um orcamento (CÓPIA FIEL: mesmas dimensoes/etapas/linhas/qty). NAO re-roda
   * auto-select nem formulas — o novo eh um rascunho editavel independente, ligado ao
   * original via parentBudgetId (historico). Boa pratica: duplicar em vez de editar um
   * cadastrado. Funciona inclusive sobre orcamento CADASTRADO (a copia nasce descongelada).
   *
   * updatePrices=true: refresca unitPriceCents dos itens vinculados com o preco ATUAL do
   * catalogo (mantendo qty/estrutura). false: mantem os precos do original (snapshot).
   */
  async duplicate(
    id: string,
    companyId: string,
    user: AuthenticatedUser,
    opts: { title?: string; updatePrices?: boolean },
  ) {
    await this.assertModuleActive(companyId);
    const source = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });
    if (!source) throw new NotFoundException('Orçamento não encontrado');

    const title = (opts.title && opts.title.trim()) || this.nextVersionTitle(source.title, source.code);
    const code = await this.codeGenerator.generateCode(companyId, 'POOL_BUDGET').catch(() => null);

    const created = await this.prisma.poolBudget.create({
      data: {
        companyId,
        code: code ?? undefined,
        parentBudgetId: source.id,
        version: (source.version ?? 1) + 1,
        clientPartnerId: source.clientPartnerId,
        templateId: source.templateId,
        printLayoutId: source.printLayoutId,
        createdByUserId: user.id,
        title,
        description: source.description,
        notes: source.notes,
        termsConditions: source.termsConditions,
        poolDimensions: source.poolDimensions as Prisma.InputJsonValue,
        environmentParams: (source.environmentParams ?? undefined) as Prisma.InputJsonValue | undefined,
        // Snapshot do simulador + imagem solar (copia fiel do estado; a copia recomputa ao editar).
        heatingReport: (source.heatingReport ?? Prisma.DbNull) as Prisma.InputJsonValue,
        solarHeaderImage: source.solarHeaderImage,
        validityDays: source.validityDays,
        discountCents: source.discountCents,
        discountPercent: source.discountPercent,
        taxesPercent: source.taxesPercent,
        startDate: source.startDate,
        equipmentWarranty: source.equipmentWarranty,
        workWarranty: source.workWarranty,
        paymentTerms: source.paymentTerms,
        earlyPaymentDiscountPct: source.earlyPaymentDiscountPct,
        paymentTermId: source.paymentTermId,
        sectionOrder: source.sectionOrder,
        status: PoolBudgetStatus.RASCUNHO,
        // frozenAt fica null — a copia nasce editavel.
      },
    });

    // Copia os itens (verbatim). Se updatePrices, refresca o preco unitario do catalogo.
    if (source.items.length > 0) {
      const priceMap = opts.updatePrices ? await this.fetchCurrentPrices(companyId, source.items) : new Map<string, number>();
      const data = source.items.map((it) => {
        let unitPriceCents = it.unitPriceCents;
        if (opts.updatePrices) {
          const key = it.productId ? `P:${it.productId}` : it.serviceId ? `S:${it.serviceId}` : null;
          if (key && priceMap.has(key)) unitPriceCents = priceMap.get(key)!;
        }
        const totalCents = Math.round((Number(it.qty) || 0) * unitPriceCents);
        return {
          budgetId: created.id,
          catalogConfigId: it.catalogConfigId,
          productId: it.productId,
          serviceId: it.serviceId,
          poolSection: it.poolSection,
          kind: it.kind,
          sortOrder: it.sortOrder,
          slotName: it.slotName,
          description: it.description,
          unit: it.unit,
          qtyCalculated: it.qtyCalculated,
          qty: it.qty,
          formulaExpr: it.formulaExpr,
          cellRef: it.cellRef,
          unitPriceCents,
          totalCents,
          isAutoCalculated: it.isAutoCalculated,
          isExtra: it.isExtra,
          manualUnlink: it.manualUnlink,
          previousQty: it.previousQty,
          qtyDecimals: it.qtyDecimals,
          notes: it.notes,
          autoSelectRule: (it.autoSelectRule ?? Prisma.DbNull) as Prisma.InputJsonValue,
        };
      });
      await this.prisma.poolBudgetItem.createMany({ data });
    }

    // Totais diretos (mesma formula do recalculateTotals) — SEM re-rodar auto-select/formula.
    const finalItems = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId: created.id },
      select: { totalCents: true },
    });
    const subtotalCents = finalItems.reduce((sum, i) => sum + (i.totalCents ?? 0), 0);
    const discountPctCents = created.discountPercent && created.discountPercent > 0 ? Math.round(subtotalCents * (created.discountPercent / 100)) : 0;
    const discountFlatCents = created.discountCents && created.discountCents > 0 ? created.discountCents : 0;
    const taxesCents = created.taxesPercent && created.taxesPercent > 0 ? Math.round(subtotalCents * (created.taxesPercent / 100)) : 0;
    const totalCents = Math.max(0, subtotalCents - (discountPctCents + discountFlatCents) + taxesCents);
    const updated = await this.prisma.poolBudget.update({
      where: { id: created.id },
      data: { subtotalCents, taxesCents, totalCents },
    });

    this.audit.log({
      companyId, entityType: 'POOL_BUDGET', entityId: created.id, action: 'DUPLICATED',
      actorType: 'USER', actorId: user.id, actorName: user.email,
      after: { sourceId: source.id, updatePrices: !!opts.updatePrices } as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async approve(id: string, companyId: string, user: AuthenticatedUser, approverName?: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status !== PoolBudgetStatus.RASCUNHO && budget.status !== PoolBudgetStatus.ENVIADO) {
      throw new BadRequestException(
        `Orçamento em status ${budget.status} não pode ser aprovado`,
      );
    }

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        status: PoolBudgetStatus.APROVADO,
        approvedAt: new Date(),
        approvedByName: approverName ?? user.email,
        approvedByType: 'INTERNAL',
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: budget as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async reject(id: string, companyId: string, user: AuthenticatedUser, reason?: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        status: PoolBudgetStatus.REJEITADO,
        rejectedAt: new Date(),
        rejectedByName: user.email,
        rejectedReason: reason,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: budget as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async cancel(id: string, companyId: string, user: AuthenticatedUser, reason?: string) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    const updated = await this.prisma.poolBudget.update({
      where: { id },
      data: {
        status: PoolBudgetStatus.CANCELADO,
        cancelledAt: new Date(),
        cancelledByName: user.email,
        cancelledReason: reason,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: budget as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────
  // Salvar como modelo: captura items + defaults do orcamento
  // atual e cria PoolBudgetTemplate. Proximo orcamento criado
  // com esse template ja vem populado com tudo.
  // ─────────────────────────────────────────────────────────
  async saveAsTemplate(
    budgetId: string,
    companyId: string,
    user: AuthenticatedUser,
    payload: { name?: string; description?: string; isDefault?: boolean; templateId?: string },
  ) {
    await this.assertModuleActive(companyId);

    // Sem templateId = criar novo (precisa de nome). Com templateId = atualizar (nome opcional).
    const isUpdate = !!payload?.templateId;
    if (!isUpdate && (!payload?.name || payload.name.trim().length === 0)) {
      throw new BadRequestException('Nome do modelo e obrigatorio');
    }

    // Se atualizando, valida que o modelo existe e pertence a empresa
    let existingTemplate: { id: string; name: string } | null = null;
    if (isUpdate) {
      existingTemplate = await this.prisma.poolBudgetTemplate.findFirst({
        where: { id: payload.templateId, companyId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!existingTemplate) {
        throw new NotFoundException('Modelo nao encontrado');
      }
    }

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: budgetId, companyId, deletedAt: null },
      include: {
        items: {
          orderBy: [{ poolSection: 'asc' }, { sortOrder: 'asc' }],
          select: {
            poolSection: true,
            kind: true,
            cellRef: true,
            sortOrder: true,
            slotName: true,
            description: true,
            unit: true,
            qty: true,
            unitPriceCents: true,
            formulaExpr: true,
            autoSelectRule: true,
          },
        },
      },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    // Snapshot dos items
    const itemsSnapshot = budget.items.map((it) => ({
      poolSection: it.poolSection,
      sortOrder: it.sortOrder,
      slotName: it.slotName,
      // kind (PRODUCT/SERVICE) — pra a linha do novo orcamento ja vir com o tipo certo.
      kind: it.kind,
      // cellRef ORIGINAL — ESSENCIAL pra preservar formulas que referenciam outras linhas
      // (qty(L7), total(L5), prod(L5,"spec")). Sem isso o applyItemsSnapshot regenerava L1,L2...
      // e a referencia apontava pra outra linha -> formula "perdia funcao" no novo orcamento.
      cellRef: it.cellRef,
      description: it.description,
      unit: it.unit,
      qty: it.qty,
      unitPriceCents: it.unitPriceCents,
      formulaExpr: it.formulaExpr,
      // Inclui autoSelectRule (regra de filtro/auto-selecao do produto). Permite
      // que novo orcamento criado a partir do template ja venha com a mesma logica.
      // Items com manualSelection=true NAO vinculam productId na criacao — o
      // operador escolhe na mao via catalog picker (que ja respeita a regra).
      autoSelectRule: (it as any).autoSelectRule ?? null,
    }));

    // Etapas custom: captura os NOMES (labels) e as ESCONDIDAS (hidden) das etapas que tem
    // item no snapshot. Sem isso, o novo orcamento criado a partir do modelo mostra a CHAVE
    // crua (CUSTOM_<slug>_<rand>) no lugar do nome amigavel. So guarda etapas EM USO (com item).
    const env = (budget.environmentParams ?? {}) as Record<string, any>;
    const usedSections = new Set(itemsSnapshot.map((i) => i.poolSection));
    const srcLabels = (env.customSections?.labels ?? {}) as Record<string, string>;
    const customLabels: Record<string, string> = {};
    for (const [k, v] of Object.entries(srcLabels)) {
      if (usedSections.has(k)) customLabels[k] = v;
    }
    const srcHidden = Array.isArray(env.customSections?.hidden)
      ? (env.customSections.hidden as string[])
      : [];
    const customHidden = srcHidden.filter((k) => usedSections.has(k));

    // Defaults
    const defaults = {
      validityDays: budget.validityDays,
      discountPercent: budget.discountPercent,
      taxesPercent: budget.taxesPercent,
      equipmentWarranty: budget.equipmentWarranty,
      workWarranty: budget.workWarranty,
      paymentTerms: budget.paymentTerms,
      earlyPaymentDiscountPct: budget.earlyPaymentDiscountPct,
      paymentTermId: budget.paymentTermId,
      sectionOrder: budget.sectionOrder,
      // Nomes/escondidas das etapas custom — restaurados no create do novo orcamento.
      customSections: { labels: customLabels, hidden: customHidden },
    };

    if (payload.isDefault) {
      await this.prisma.poolBudgetTemplate.updateMany({
        where: {
          companyId,
          isDefault: true,
          deletedAt: null,
          ...(isUpdate ? { id: { not: payload.templateId } } : {}),
        },
        data: { isDefault: false },
      });
    }

    let template: { id: string; name: string };
    if (isUpdate && existingTemplate) {
      template = await this.prisma.poolBudgetTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name: payload.name?.trim() || existingTemplate.name,
          description: payload.description !== undefined ? (payload.description || null) : undefined,
          isDefault: payload.isDefault,
          itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue,
          defaults: defaults as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, name: true },
      });
    } else {
      template = await this.prisma.poolBudgetTemplate.create({
        data: {
          companyId,
          name: payload.name!.trim(),
          description: payload.description ?? null,
          isDefault: payload.isDefault ?? false,
          sections: [] as unknown as Prisma.InputJsonValue,
          itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue,
          defaults: defaults as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, name: true },
      });
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_TEMPLATE',
      entityId: template.id,
      action: isUpdate ? 'UPDATED' : 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: { sourceBudgetId: budgetId, name: template.name } as unknown as Record<string, unknown>,
    });

    // O orcamento de origem ADOTA o modelo salvo/atualizado: o selo "Modelo: X" do
    // cabecalho passa a refletir este modelo na hora, sem precisar ir em "Editar dados".
    // NAO toca nas linhas do orcamento (so o vinculo/etiqueta). Pedido Juliano.
    await this.prisma.poolBudget.update({
      where: { id: budgetId },
      data: { templateId: template.id },
    });

    return template;
  }
}
