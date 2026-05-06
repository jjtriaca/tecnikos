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
import { CreatePoolCatalogConfigDto } from './dto/create-pool-catalog-config.dto';
import { UpdatePoolCatalogConfigDto } from './dto/update-pool-catalog-config.dto';
import { QueryPoolCatalogConfigDto } from './dto/query-pool-catalog-config.dto';

@Injectable()
export class PoolCatalogConfigService {
  private readonly logger = new Logger(PoolCatalogConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Garante que o tenant tem o módulo Piscina ativo. Negocio: Company.poolModuleActive.
   */
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
    dto: CreatePoolCatalogConfigDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    // Exatamente um entre productId e serviceId deve estar preenchido
    const hasProduct = !!dto.productId;
    const hasService = !!dto.serviceId;
    if (hasProduct === hasService) {
      throw new BadRequestException(
        'Informe exatamente um entre productId OU serviceId (não pode ser ambos nem nenhum)',
      );
    }

    // Valida existência do Product/Service e que pertence ao mesmo tenant
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Produto não encontrado');

      // Já existe config pra esse produto?
      const exists = await this.prisma.poolCatalogConfig.findUnique({
        where: { productId: dto.productId },
        select: { id: true },
      });
      if (exists)
        throw new BadRequestException(
          'Já existe configuração de Piscina para esse produto. Use update.',
        );
    }

    if (dto.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!service) throw new NotFoundException('Serviço não encontrado');

      const exists = await this.prisma.poolCatalogConfig.findUnique({
        where: { serviceId: dto.serviceId },
        select: { id: true },
      });
      if (exists)
        throw new BadRequestException(
          'Já existe configuração de Piscina para esse serviço. Use update.',
        );
    }

    const created = await this.prisma.poolCatalogConfig.create({
      data: {
        companyId,
        productId: dto.productId,
        serviceId: dto.serviceId,
        poolSection: dto.poolSection,
        displayOrder: dto.displayOrder ?? 0,
        poolFormula: dto.poolFormula as Prisma.InputJsonValue | undefined,
        poolCondition: dto.poolCondition as Prisma.InputJsonValue | undefined,
        technicalSpecs: dto.technicalSpecs as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
      },
      include: {
        product: { select: { id: true, code: true, description: true, unit: true, imageUrl: true } },
        service: { select: { id: true, code: true, name: true, unit: true, imageUrl: true } },
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_CATALOG_CONFIG',
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
    filters: QueryPoolCatalogConfigDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.assertModuleActive(companyId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolCatalogConfigWhereInput = {
      companyId,
      ...(filters.poolSection ? { poolSection: filters.poolSection } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.onlyProducts ? { productId: { not: null } } : {}),
      ...(filters.onlyServices ? { serviceId: { not: null } } : {}),
      ...(filters.search
        ? {
            OR: [
              { product: { description: { contains: filters.search, mode: 'insensitive' } } },
              { product: { code: { contains: filters.search, mode: 'insensitive' } } },
              { service: { name: { contains: filters.search, mode: 'insensitive' } } },
              { service: { code: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.PoolCatalogConfigOrderByWithRelationInput = pagination.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder ?? 'asc' }
      : [{ poolSection: 'asc' }, { displayOrder: 'asc' }] as never;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poolCatalogConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: { select: { id: true, code: true, description: true, brand: true, unit: true, imageUrl: true, salePriceCents: true, technicalSpecs: true } },
          service: { select: { id: true, code: true, name: true, unit: true, imageUrl: true, priceCents: true, technicalSpecs: true } },
        },
      }),
      this.prisma.poolCatalogConfig.count({ where }),
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

    const config = await this.prisma.poolCatalogConfig.findFirst({
      where: { id, companyId },
      include: {
        product: true,
        service: true,
      },
    });

    if (!config) throw new NotFoundException('Configuração de Piscina não encontrada');
    return config;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePoolCatalogConfigDto,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolCatalogConfig.findFirst({
      where: { id, companyId },
    });
    if (!before) throw new NotFoundException('Configuração de Piscina não encontrada');

    // Se trocou productId ou serviceId, valida unicidade
    if (dto.productId && dto.productId !== before.productId) {
      const exists = await this.prisma.poolCatalogConfig.findUnique({
        where: { productId: dto.productId },
        select: { id: true },
      });
      if (exists)
        throw new BadRequestException('Já existe configuração de Piscina para esse produto');
    }
    if (dto.serviceId && dto.serviceId !== before.serviceId) {
      const exists = await this.prisma.poolCatalogConfig.findUnique({
        where: { serviceId: dto.serviceId },
        select: { id: true },
      });
      if (exists)
        throw new BadRequestException('Já existe configuração de Piscina para esse serviço');
    }

    const updated = await this.prisma.poolCatalogConfig.update({
      where: { id },
      data: {
        productId: dto.productId,
        serviceId: dto.serviceId,
        poolSection: dto.poolSection,
        displayOrder: dto.displayOrder,
        poolFormula: dto.poolFormula as Prisma.InputJsonValue | undefined,
        poolCondition: dto.poolCondition as Prisma.InputJsonValue | undefined,
        technicalSpecs: dto.technicalSpecs as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
      include: {
        product: { select: { id: true, code: true, description: true, unit: true, imageUrl: true } },
        service: { select: { id: true, code: true, name: true, unit: true, imageUrl: true } },
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_CATALOG_CONFIG',
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

    const before = await this.prisma.poolCatalogConfig.findFirst({
      where: { id, companyId },
    });
    if (!before) throw new NotFoundException('Configuração de Piscina não encontrada');

    // Verifica se está em uso em algum PoolBudgetItem
    const inUse = await this.prisma.poolBudgetItem.findFirst({
      where: { catalogConfigId: id },
      select: { id: true },
    });
    if (inUse) {
      throw new BadRequestException(
        'Esta configuração está em uso em orçamentos. Desative ao invés de remover (isActive=false).',
      );
    }

    await this.prisma.poolCatalogConfig.delete({ where: { id } });

    this.audit.log({
      companyId,
      entityType: 'POOL_CATALOG_CONFIG',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  /**
   * Lista configs ativas de uma seção - usado pelo budget builder pra montar templates
   */
  async listBySection(companyId: string, poolSection: string) {
    await this.assertModuleActive(companyId);
    return this.prisma.poolCatalogConfig.findMany({
      where: {
        companyId,
        isActive: true,
        poolSection: poolSection as never,
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        product: { select: { id: true, code: true, description: true, unit: true, imageUrl: true, salePriceCents: true } },
        service: { select: { id: true, code: true, name: true, unit: true, imageUrl: true, priceCents: true } },
      },
    });
  }
}
