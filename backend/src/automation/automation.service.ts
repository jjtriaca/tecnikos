import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/create-automation.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { buildSearchWhere } from '../common/util/build-search-where';

const SORTABLE_COLUMNS = ['name', 'isActive', 'createdAt', 'updatedAt'];

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, pagination?: PaginationDto): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };
    if (pagination?.search) {
      const searchWhere = buildSearchWhere(pagination.search, [
        { field: 'name', mode: 'insensitive' },
        { field: 'description', mode: 'insensitive' },
      ]);
      if (searchWhere) Object.assign(where, searchWhere);
    }

    const orderBy = buildOrderBy(pagination?.sortBy, pagination?.sortOrder, SORTABLE_COLUMNS, { createdAt: 'desc' });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.automationRule.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { executions: true } },
        },
      }),
      this.prisma.automationRule.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        _count: { select: { executions: true } },
      },
    });
    if (!rule) throw new NotFoundException('Automação não encontrada');
    return rule;
  }

  async create(data: CreateAutomationDto, companyId: string) {
    return this.prisma.automationRule.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        trigger: data.trigger as any,
        actions: data.actions as any,
        layout: data.layout as any ?? undefined,
      },
    });
  }

  async update(id: string, data: UpdateAutomationDto, companyId: string) {
    await this.findOne(id, companyId);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.trigger !== undefined) updateData.trigger = data.trigger;
    if (data.actions !== undefined) updateData.actions = data.actions;
    if (data.layout !== undefined) updateData.layout = data.layout;

    return this.prisma.automationRule.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.automationRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async toggle(id: string, companyId: string) {
    const rule = await this.findOne(id, companyId);
    return this.prisma.automationRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
  }

  async getExecutions(ruleId: string, companyId: string, pagination?: PaginationDto): Promise<PaginatedResult<any>> {
    // Verify ownership
    await this.findOne(ruleId, companyId);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { automationRuleId: ruleId, companyId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.automationExecution.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.automationExecution.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
