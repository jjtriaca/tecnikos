import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: { category?: string; status?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };

    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.status === 'active') where.isActive = true;
    if (filters?.status === 'inactive') where.isActive = false;

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
        { description: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const sortBy = pagination.sortBy || 'name';
    const sortOrder = pagination.sortOrder || 'asc';
    const validSorts = ['name', 'code', 'priceCents', 'commissionBps', 'category', 'createdAt', 'updatedAt'];
    const orderBy = validSorts.includes(sortBy) ? { [sortBy]: sortOrder } : { name: 'asc' as const };

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, companyId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado');
    return service;
  }

  async create(companyId: string, dto: CreateServiceDto) {
    const code = await this.codeGenerator.generateCode(companyId, 'SERVICE');

    return this.prisma.service.create({
      data: {
        companyId,
        code,
        name: dto.name,
        description: dto.description,
        unit: dto.unit || 'SV',
        priceCents: dto.priceCents,
        commissionBps: dto.commissionBps,
        category: dto.category,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateServiceDto) {
    await this.findOne(id, companyId);
    const { code: _code, ...updateData } = dto as any;
    return this.prisma.service.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getCategories(companyId: string): Promise<string[]> {
    const results = await this.prisma.service.findMany({
      where: { companyId, deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return results.map((r) => r.category).filter(Boolean) as string[];
  }
}
