import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  PoolBudgetStatus,
  PoolProjectStatus,
  Prisma,
  FinancialEntryType,
  FinancialEntryStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreatePoolProjectDto } from './dto/create-pool-project.dto';
import { UpdatePoolProjectDto } from './dto/update-pool-project.dto';
import { QueryPoolProjectDto } from './dto/query-pool-project.dto';
import { CreatePoolStageDto, UpdatePoolStageDto } from './dto/stage.dto';
import { CreatePoolProjectEntryDto, UpdatePoolProjectEntryDto } from './dto/entry.dto';
import { CreatePoolProjectPhotoDto } from './dto/photo.dto';

@Injectable()
export class PoolProjectService {
  private readonly logger = new Logger(PoolProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeGenerator: CodeGeneratorService,
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
    dto: CreatePoolProjectDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const budget = await this.prisma.poolBudget.findFirst({
      where: { id: dto.budgetId, companyId, deletedAt: null },
      include: { project: true, clientPartner: { select: { id: true } } },
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    if (budget.status !== PoolBudgetStatus.APROVADO) {
      throw new BadRequestException('Orçamento precisa estar APROVADO pra gerar obra');
    }
    if (budget.project) {
      throw new BadRequestException(
        `Orçamento já tem obra vinculada (${budget.project.code ?? budget.project.id})`,
      );
    }

    const code = await this.codeGenerator
      .generateCode(companyId, 'POOL_PROJECT')
      .catch(() => null);

    const created = await this.prisma.poolProject.create({
      data: {
        companyId,
        code: code ?? undefined,
        budgetId: dto.budgetId,
        customerId: budget.clientPartner.id,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        expectedEndDate: dto.expectedEndDate ? new Date(dto.expectedEndDate) : undefined,
        notes: dto.notes,
        status: PoolProjectStatus.PLANEJADA,
      },
      include: {
        budget: { select: { id: true, code: true, title: true, totalCents: true } },
        customer: { select: { id: true, name: true, document: true } },
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT',
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
    filters: QueryPoolProjectDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.assertModuleActive(companyId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolProjectWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.search
        ? {
            OR: [
              { code: { contains: filters.search, mode: 'insensitive' } },
              { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poolProject.findMany({
        where,
        skip,
        take: limit,
        orderBy: pagination.sortBy
          ? { [pagination.sortBy]: pagination.sortOrder ?? 'desc' }
          : { createdAt: 'desc' },
        include: {
          budget: { select: { id: true, code: true, title: true, totalCents: true } },
          customer: { select: { id: true, name: true, document: true } },
          _count: { select: { stages: true, entries: true, photos: true } },
        },
      }),
      this.prisma.poolProject.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, companyId: string) {
    await this.assertModuleActive(companyId);

    const project = await this.prisma.poolProject.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        budget: {
          include: {
            items: { orderBy: [{ poolSection: 'asc' }, { sortOrder: 'asc' }] },
          },
        },
        customer: true,
        stages: { orderBy: [{ sortOrder: 'asc' }] },
        entries: { orderBy: [{ date: 'desc' }] },
        photos: { orderBy: [{ takenAt: 'desc' }] },
      },
    });

    if (!project) throw new NotFoundException('Obra não encontrada');
    return project;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePoolProjectDto,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const before = await this.prisma.poolProject.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Obra não encontrada');

    const updated = await this.prisma.poolProject.update({
      where: { id },
      data: {
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        expectedEndDate: dto.expectedEndDate ? new Date(dto.expectedEndDate) : undefined,
        actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        notes: dto.notes,
        progressPercent: dto.progressPercent,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT',
      entityId: id,
      action: dto.status ? 'STATUS_CHANGED' : 'UPDATED',
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

    const before = await this.prisma.poolProject.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Obra não encontrada');

    await this.prisma.poolProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: before as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== STAGES ==============

  async addStage(
    projectId: string,
    dto: CreatePoolStageDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const project = await this.prisma.poolProject.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Obra não encontrada');

    const stage = await this.prisma.poolProjectStage.create({
      data: {
        projectId,
        poolSection: dto.poolSection,
        name: dto.name,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        sortOrder: dto.sortOrder ?? 0,
        notes: dto.notes,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_STAGE',
      entityId: stage.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: stage as unknown as Record<string, unknown>,
    });

    return stage;
  }

  async updateStage(
    stageId: string,
    dto: UpdatePoolStageDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const stage = await this.prisma.poolProjectStage.findFirst({
      where: { id: stageId, project: { companyId, deletedAt: null } },
    });
    if (!stage) throw new NotFoundException('Etapa não encontrada');

    const updated = await this.prisma.poolProjectStage.update({
      where: { id: stageId },
      data: {
        status: dto.status,
        name: dto.name,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
        sortOrder: dto.sortOrder,
        notes: dto.notes,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_STAGE',
      entityId: stageId,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: stage as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async removeStage(stageId: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const stage = await this.prisma.poolProjectStage.findFirst({
      where: { id: stageId, project: { companyId, deletedAt: null } },
    });
    if (!stage) throw new NotFoundException('Etapa não encontrada');

    await this.prisma.poolProjectStage.delete({ where: { id: stageId } });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_STAGE',
      entityId: stageId,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: stage as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== ENTRIES (Livro Caixa da Obra) ==============

  async addEntry(
    projectId: string,
    dto: CreatePoolProjectEntryDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const project = await this.prisma.poolProject.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!project) throw new NotFoundException('Obra não encontrada');

    if (dto.budgetItemId) {
      const item = await this.prisma.poolBudgetItem.findFirst({
        where: { id: dto.budgetItemId, budget: { companyId } },
        select: { id: true },
      });
      if (!item)
        throw new BadRequestException('Item do orçamento não encontrado');
    }

    if (dto.partnerId) {
      const partner = await this.prisma.partner.findFirst({
        where: { id: dto.partnerId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!partner) throw new BadRequestException('Fornecedor não encontrado');
    }

    // Cria entry
    const entry = await this.prisma.poolProjectEntry.create({
      data: {
        projectId,
        budgetItemId: dto.budgetItemId,
        date: new Date(dto.date),
        supplierName: dto.supplierName,
        partnerId: dto.partnerId,
        description: dto.description,
        qty: dto.qty,
        unitPriceCents: dto.unitPriceCents,
        totalCents: dto.totalCents,
        type: dto.type,
        paymentMethod: dto.paymentMethod,
        invoiceNumber: dto.invoiceNumber,
        reflectsInFinance: dto.reflectsInFinance ?? false,
        notes: dto.notes,
      },
    });

    // Se reflectsInFinance, cria FinancialEntry de despesa (PAYABLE)
    if (dto.reflectsInFinance) {
      try {
        const finCode = await this.codeGenerator.generateCode(
          companyId,
          'FINANCIAL_ENTRY',
        );
        const finEntry = await this.prisma.financialEntry.create({
          data: {
            companyId,
            code: finCode,
            type: FinancialEntryType.PAYABLE,
            status: FinancialEntryStatus.PAID,
            description: `[Obra ${project.code ?? project.id}] ${dto.description}`,
            grossCents: dto.totalCents,
            netCents: dto.totalCents,
            dueDate: new Date(dto.date),
            paidAt: new Date(dto.date),
            partnerId: dto.partnerId,
            paymentMethod: dto.paymentMethod,
          },
        });
        await this.prisma.poolProjectEntry.update({
          where: { id: entry.id },
          data: { financialEntryId: finEntry.id },
        });
      } catch (err) {
        this.logger.warn(
          `reflectsInFinance falhou para PoolProjectEntry ${entry.id}: ${err}`,
        );
      }
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_ENTRY',
      entityId: entry.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: entry as unknown as Record<string, unknown>,
    });

    return entry;
  }

  async updateEntry(
    entryId: string,
    dto: UpdatePoolProjectEntryDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const entry = await this.prisma.poolProjectEntry.findFirst({
      where: { id: entryId, project: { companyId, deletedAt: null } },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado');

    const updated = await this.prisma.poolProjectEntry.update({
      where: { id: entryId },
      data: {
        budgetItemId: dto.budgetItemId,
        date: dto.date ? new Date(dto.date) : undefined,
        supplierName: dto.supplierName,
        partnerId: dto.partnerId,
        description: dto.description,
        qty: dto.qty,
        unitPriceCents: dto.unitPriceCents,
        totalCents: dto.totalCents,
        type: dto.type,
        paymentMethod: dto.paymentMethod,
        invoiceNumber: dto.invoiceNumber,
        notes: dto.notes,
      },
    });

    // Se a entry tem FinancialEntry vinculada, atualiza ela também
    if (entry.financialEntryId && (dto.totalCents !== undefined || dto.description !== undefined)) {
      try {
        await this.prisma.financialEntry.update({
          where: { id: entry.financialEntryId },
          data: {
            grossCents: dto.totalCents ?? entry.totalCents,
            netCents: dto.totalCents ?? entry.totalCents,
            description: dto.description ?? entry.description,
          },
        });
      } catch (err) {
        this.logger.warn(`Falha ao sincronizar FinancialEntry: ${err}`);
      }
    }

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_ENTRY',
      entityId: entryId,
      action: 'UPDATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: entry as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async removeEntry(entryId: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const entry = await this.prisma.poolProjectEntry.findFirst({
      where: { id: entryId, project: { companyId, deletedAt: null } },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado');

    // Se reflete no Financeiro, marca FinancialEntry como CANCELLED ao invés de deletar
    if (entry.financialEntryId) {
      try {
        await this.prisma.financialEntry.update({
          where: { id: entry.financialEntryId },
          data: { status: FinancialEntryStatus.CANCELLED },
        });
      } catch (err) {
        this.logger.warn(`Falha ao cancelar FinancialEntry: ${err}`);
      }
    }

    await this.prisma.poolProjectEntry.delete({ where: { id: entryId } });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_ENTRY',
      entityId: entryId,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: entry as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  // ============== PHOTOS ==============

  async addPhoto(
    projectId: string,
    dto: CreatePoolProjectPhotoDto,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertModuleActive(companyId);

    const project = await this.prisma.poolProject.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Obra não encontrada');

    const photo = await this.prisma.poolProjectPhoto.create({
      data: {
        projectId,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        caption: dto.caption,
        takenAt: dto.takenAt ? new Date(dto.takenAt) : undefined,
        uploadedByUserId: user.id,
      },
    });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_PHOTO',
      entityId: photo.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      after: photo as unknown as Record<string, unknown>,
    });

    return photo;
  }

  async removePhoto(photoId: string, companyId: string, user: AuthenticatedUser) {
    await this.assertModuleActive(companyId);

    const photo = await this.prisma.poolProjectPhoto.findFirst({
      where: { id: photoId, project: { companyId, deletedAt: null } },
    });
    if (!photo) throw new NotFoundException('Foto não encontrada');

    await this.prisma.poolProjectPhoto.delete({ where: { id: photoId } });

    this.audit.log({
      companyId,
      entityType: 'POOL_PROJECT_PHOTO',
      entityId: photoId,
      action: 'DELETED',
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      before: photo as unknown as Record<string, unknown>,
    });

    return { success: true };
  }
}
