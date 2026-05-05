import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreatePoolBudgetTemplateDto, TemplateSectionDto } from './dto/create-pool-budget-template.dto';
import { UpdatePoolBudgetTemplateDto } from './dto/update-pool-budget-template.dto';
import { QueryPoolBudgetTemplateDto } from './dto/query-pool-budget-template.dto';

@Injectable()
export class PoolBudgetTemplateService {
  private readonly logger = new Logger(PoolBudgetTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  /**
   * Valida que todos os catalogConfigIds referenciados existem e pertencem ao tenant.
   */
  private async validateSections(companyId: string, sections: TemplateSectionDto[]) {
    const allCatalogIds = sections.flatMap((s) =>
      s.items.map((i) => i.catalogConfigId),
    );
    if (allCatalogIds.length === 0) {
      throw new BadRequestException('O template precisa ter pelo menos 1 item.');
    }

    const found = await this.prisma.poolCatalogConfig.findMany({
      where: { id: { in: allCatalogIds }, companyId },
      select: { id: true },
    });

    const foundIds = new Set(found.map((c) => c.id));
    const missing = allCatalogIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Items do catálogo não encontrados: ${missing.join(', ')}`,
      );
    }
  }

  async create(
    dto: CreatePoolBudgetTemplateDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);
    await this.validateSections(companyId, dto.sections);

    // Se isDefault=true, desmarca outros como default primeiro
    if (dto.isDefault) {
      await this.prisma.poolBudgetTemplate.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.poolBudgetTemplate.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        sections: dto.sections as unknown as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_TEMPLATE',
      entityId: created.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters: QueryPoolBudgetTemplateDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.assertModuleActive(companyId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolBudgetTemplateWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.isDefault !== undefined ? { isDefault: filters.isDefault } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.PoolBudgetTemplateOrderByWithRelationInput = pagination.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder ?? 'asc' }
      : ({ isDefault: 'desc' } as never);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poolBudgetTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.poolBudgetTemplate.count({ where }),
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

    const template = await this.prisma.poolBudgetTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!template) throw new NotFoundException('Template de orçamento não encontrado');
    return template;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePoolBudgetTemplateDto,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolBudgetTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Template de orçamento não encontrado');

    if (dto.sections) {
      await this.validateSections(companyId, dto.sections);
    }

    if (dto.isDefault) {
      await this.prisma.poolBudgetTemplate.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.poolBudgetTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault,
        sections: dto.sections
          ? (dto.sections as unknown as Prisma.InputJsonValue)
          : undefined,
        isActive: dto.isActive,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_TEMPLATE',
      entityId: id,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async remove(id: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolBudgetTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Template de orçamento não encontrado');

    // Verifica se está em uso por algum PoolBudget
    const inUse = await this.prisma.poolBudget.findFirst({
      where: { templateId: id },
      select: { id: true },
    });
    if (inUse) {
      throw new BadRequestException(
        'Este template está em uso em orçamentos existentes. Desative ao invés de remover.',
      );
    }

    // Soft delete
    await this.prisma.poolBudgetTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_BUDGET_TEMPLATE',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
    });

    return { success: true };
  }
}
