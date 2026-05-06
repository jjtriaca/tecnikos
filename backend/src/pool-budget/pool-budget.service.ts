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
import { CreateBudgetItemDto, UpdateBudgetItemDto } from './dto/budget-item.dto';
import {
  PoolFormulaService,
  PoolFormulaConfig,
  PoolConditionConfig,
} from './pool-formula.service';
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
  ) {}

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
    let template: { sections: unknown } | null = null;
    if (dto.templateId) {
      template = await this.prisma.poolBudgetTemplate.findFirst({
        where: { id: dto.templateId, companyId, deletedAt: null, isActive: true },
        select: { sections: true },
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
        poolDimensions: dto.poolDimensions as unknown as Prisma.InputJsonValue,
        environmentParams: dto.environmentParams as Prisma.InputJsonValue | undefined,
        validityDays: dto.validityDays ?? 30,
        discountCents: dto.discountCents,
        discountPercent: dto.discountPercent,
        taxesPercent: dto.taxesPercent,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        equipmentWarranty: dto.equipmentWarranty,
        workWarranty: dto.workWarranty,
        paymentTerms: dto.paymentTerms,
        earlyPaymentDiscountPct: dto.earlyPaymentDiscountPct,
        status: PoolBudgetStatus.RASCUNHO,
      },
      include: {
        clientPartner: { select: { id: true, name: true, document: true } },
        template: { select: { id: true, name: true } },
      },
    });

    // Se tem template, popula os itens automaticamente
    if (template) {
      await this.applyTemplate(created.id, companyId, template.sections, dto.poolDimensions);
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
   * Recalcula subtotalCents, taxesCents e totalCents do orçamento somando os itens.
   */
  async recalculateTotals(budgetId: string) {
    const items = await this.prisma.poolBudgetItem.findMany({
      where: { budgetId },
      select: { totalCents: true, qty: true, unit: true },
    });
    const subtotalCents = items.reduce((sum, i) => sum + (i.totalCents ?? 0), 0);

    const budget = await this.prisma.poolBudget.findUnique({
      where: { id: budgetId },
      select: {
        discountCents: true,
        discountPercent: true,
        taxesPercent: true,
        startDate: true,
      },
    });

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

    // Prazo: itens com unit ∈ {h,H,hora,horas} = horas; {d,D,dia,dias} = dias × 8h
    const HOURS_PER_DAY = 8;
    let totalHours = 0;
    for (const it of items) {
      const u = (it.unit || '').trim().toLowerCase();
      const qty = Number(it.qty) || 0;
      if (qty <= 0) continue;
      if (u === 'h' || u === 'hora' || u === 'horas') {
        totalHours += qty;
      } else if (u === 'd' || u === 'dia' || u === 'dias') {
        totalHours += qty * HOURS_PER_DAY;
      }
    }
    const estimatedDurationDays = totalHours > 0 ? Math.ceil(totalHours / HOURS_PER_DAY) : null;

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
        items: {
          orderBy: [{ poolSection: 'asc' }, { sortOrder: 'asc' }],
          include: {
            product: { select: { id: true, code: true, description: true, imageUrl: true } },
            service: { select: { id: true, code: true, name: true, imageUrl: true } },
          },
        },
        project: { select: { id: true, code: true, status: true } },
      },
    });

    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    return budget;
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
          ? (dto.poolDimensions as unknown as Prisma.InputJsonValue)
          : undefined,
        environmentParams: dto.environmentParams as Prisma.InputJsonValue | undefined,
        validityDays: dto.validityDays,
        discountCents: dto.discountCents,
        discountPercent: dto.discountPercent,
        taxesPercent: dto.taxesPercent,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        equipmentWarranty: dto.equipmentWarranty,
        workWarranty: dto.workWarranty,
        paymentTerms: dto.paymentTerms,
        earlyPaymentDiscountPct: dto.earlyPaymentDiscountPct,
      },
    });

    if (
      dto.discountCents !== undefined ||
      dto.discountPercent !== undefined ||
      dto.taxesPercent !== undefined ||
      dto.startDate !== undefined
    ) {
      await this.recalculateTotals(id);
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
      select: { id: true, status: true },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode adicionar items');
    }

    const totalCents = Math.round(dto.qty * dto.unitPriceCents);
    const item = await this.prisma.poolBudgetItem.create({
      data: {
        budgetId,
        catalogConfigId: dto.catalogConfigId,
        productId: dto.productId,
        serviceId: dto.serviceId,
        poolSection: dto.poolSection,
        sortOrder: dto.sortOrder ?? 0,
        slotName: dto.slotName,
        description: dto.description,
        unit: dto.unit ?? 'UN',
        qty: dto.qty,
        unitPriceCents: dto.unitPriceCents,
        totalCents,
        isAutoCalculated: false,
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

  async updateItem(
    itemId: string,
    dto: UpdateBudgetItemDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const item = await this.prisma.poolBudgetItem.findFirst({
      where: { id: itemId, budget: { companyId, deletedAt: null } },
      include: { budget: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode editar items');
    }

    const newQty = dto.qty ?? item.qty;
    const newUnitPrice = dto.unitPriceCents ?? item.unitPriceCents;
    const totalCents = Math.round(newQty * newUnitPrice);

    const updated = await this.prisma.poolBudgetItem.update({
      where: { id: itemId },
      data: {
        slotName: dto.slotName,
        description: dto.description,
        unit: dto.unit,
        qty: dto.qty,
        unitPriceCents: dto.unitPriceCents,
        totalCents,
        sortOrder: dto.sortOrder,
        notes: dto.notes,
        // Marcar como editado se mudou qty ou preço
        ...(dto.qty !== undefined || dto.unitPriceCents !== undefined
          ? { isAutoCalculated: false }
          : {}),
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
      include: { budget: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.budget.status === PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento aprovado — não pode remover items');
    }

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
}
