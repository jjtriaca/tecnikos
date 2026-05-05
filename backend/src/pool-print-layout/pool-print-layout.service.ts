import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma, PoolPrintPageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import {
  CreatePoolPrintLayoutDto,
  UpdatePoolPrintLayoutDto,
} from './dto/layout.dto';
import {
  CreatePoolPrintPageDto,
  UpdatePoolPrintPageDto,
  ReorderPagesDto,
} from './dto/page.dto';

@Injectable()
export class PoolPrintLayoutService {
  private readonly logger = new Logger(PoolPrintLayoutService.name);

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

  // ============== LAYOUTS ==============

  async create(
    dto: CreatePoolPrintLayoutDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    if (dto.isDefault) {
      await this.prisma.poolPrintLayout.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.poolPrintLayout.create({
      data: {
        companyId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        branding: dto.branding as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_LAYOUT',
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
  ): Promise<PaginatedResult<unknown>> {
    await this.assertModuleActive(companyId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolPrintLayoutWhereInput = {
      companyId,
      deletedAt: null,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poolPrintLayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        include: { _count: { select: { pages: true } } },
      }),
      this.prisma.poolPrintLayout.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, companyId: string) {
    await this.assertModuleActive(companyId);

    const layout = await this.prisma.poolPrintLayout.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        pages: { orderBy: { order: 'asc' } },
      },
    });

    if (!layout) throw new NotFoundException('Layout não encontrado');
    return layout;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePoolPrintLayoutDto,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolPrintLayout.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Layout não encontrado');

    if (dto.isDefault) {
      await this.prisma.poolPrintLayout.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.poolPrintLayout.update({
      where: { id },
      data: {
        name: dto.name,
        isDefault: dto.isDefault,
        branding: dto.branding as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_LAYOUT',
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

    const before = await this.prisma.poolPrintLayout.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Layout não encontrado');

    const inUse = await this.prisma.poolBudget.findFirst({
      where: { printLayoutId: id, deletedAt: null },
      select: { id: true },
    });
    if (inUse) {
      throw new BadRequestException(
        'Layout em uso por orçamentos existentes. Desative ao invés de remover.',
      );
    }

    await this.prisma.poolPrintLayout.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_LAYOUT',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== PAGES ==============

  async addPage(
    layoutId: string,
    dto: CreatePoolPrintPageDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const layout = await this.prisma.poolPrintLayout.findFirst({
      where: { id: layoutId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!layout) throw new NotFoundException('Layout não encontrado');

    if (dto.type === PoolPrintPageType.FIXED && !dto.htmlContent) {
      throw new BadRequestException(
        'Página FIXED precisa ter htmlContent preenchido.',
      );
    }
    if (dto.type === PoolPrintPageType.DYNAMIC && !dto.dynamicType) {
      throw new BadRequestException(
        'Página DYNAMIC precisa ter dynamicType preenchido.',
      );
    }

    // Se order não enviado, joga no final
    let order = dto.order;
    if (order === undefined) {
      const last = await this.prisma.poolPrintPage.findFirst({
        where: { layoutId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (last?.order ?? -1) + 1;
    }

    const page = await this.prisma.poolPrintPage.create({
      data: {
        layoutId,
        order,
        type: dto.type,
        htmlContent: dto.htmlContent,
        dynamicType: dto.dynamicType,
        pageConfig: dto.pageConfig as Prisma.InputJsonValue | undefined,
        isConditional: dto.isConditional ?? false,
        conditionRule: dto.conditionRule as Prisma.InputJsonValue | undefined,
        pageBreak: dto.pageBreak ?? true,
        isActive: dto.isActive ?? true,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_PAGE',
      entityId: page.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: page as unknown as Record<string, unknown>,
    });

    return page;
  }

  async updatePage(
    pageId: string,
    dto: UpdatePoolPrintPageDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const page = await this.prisma.poolPrintPage.findFirst({
      where: { id: pageId, layout: { companyId, deletedAt: null } },
    });
    if (!page) throw new NotFoundException('Página não encontrada');

    const updated = await this.prisma.poolPrintPage.update({
      where: { id: pageId },
      data: {
        order: dto.order,
        type: dto.type,
        htmlContent: dto.htmlContent,
        dynamicType: dto.dynamicType,
        pageConfig: dto.pageConfig as Prisma.InputJsonValue | undefined,
        isConditional: dto.isConditional,
        conditionRule: dto.conditionRule as Prisma.InputJsonValue | undefined,
        pageBreak: dto.pageBreak,
        isActive: dto.isActive,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_PAGE',
      entityId: pageId,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: page as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async removePage(pageId: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const page = await this.prisma.poolPrintPage.findFirst({
      where: { id: pageId, layout: { companyId, deletedAt: null } },
    });
    if (!page) throw new NotFoundException('Página não encontrada');

    await this.prisma.poolPrintPage.delete({ where: { id: pageId } });

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_PAGE',
      entityId: pageId,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: page as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  /**
   * Reordena páginas de um layout. Recebe array de IDs na ordem desejada.
   * Atualiza o campo order de cada página.
   */
  async reorderPages(
    layoutId: string,
    dto: ReorderPagesDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const layout = await this.prisma.poolPrintLayout.findFirst({
      where: { id: layoutId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!layout) throw new NotFoundException('Layout não encontrado');

    // Valida que todos os pageIds pertencem a esse layout
    const pages = await this.prisma.poolPrintPage.findMany({
      where: { id: { in: dto.pageIds }, layoutId },
      select: { id: true },
    });
    if (pages.length !== dto.pageIds.length) {
      throw new BadRequestException(
        'Alguns IDs informados não pertencem ao layout',
      );
    }

    // Atualiza order em transaction
    await this.prisma.$transaction(
      dto.pageIds.map((id, index) =>
        this.prisma.poolPrintPage.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    this.audit.log({
      companyId,
      entityType: 'POOL_PRINT_LAYOUT',
      entityId: layoutId,
      action: 'PAGES_REORDERED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: { pageIds: dto.pageIds } as unknown as Record<string, unknown>,
    });

    return this.findOne(layoutId, companyId);
  }
}
