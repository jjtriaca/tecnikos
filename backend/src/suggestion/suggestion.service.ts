import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSuggestionDto, UpdateSuggestionStatusDto } from './dto/create-suggestion.dto';

@Injectable()
export class SuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSuggestionDto, userId: string, companyId: string) {
    return this.prisma.suggestion.create({
      data: {
        companyId,
        userId,
        category: dto.category || 'MELHORIA',
        title: dto.title,
        description: dto.description,
      },
    });
  }

  async findAll(companyId: string, status?: string) {
    return this.prisma.suggestion.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** SUPER_ADMIN: list all suggestions across tenants */
  async findAllGlobal(status?: string) {
    return this.prisma.suggestion.findMany({
      where: status ? { status } : {},
      include: {
        user: { select: { name: true, email: true } },
        company: { select: { name: true, tradeName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateSuggestionStatusDto) {
    const suggestion = await this.prisma.suggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestao nao encontrada');

    return this.prisma.suggestion.update({
      where: { id },
      data: {
        status: dto.status,
        adminNotes: dto.adminNotes,
      },
    });
  }
}
