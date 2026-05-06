import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePoolPaymentTermDto,
  PoolPaymentTermPartDto,
  UpdatePoolPaymentTermDto,
} from './dto/pool-payment-term.dto';

// Formas padrao pre-cadastradas pra novos tenants (espelha as formas mais usadas em obras de piscina).
const DEFAULT_TERMS: Array<{ name: string; isDefault?: boolean; structure: PoolPaymentTermPartDto[] }> = [
  {
    name: 'A vista',
    structure: [
      { label: 'A vista', percent: 100, count: 1, intervalDays: 0, firstOffsetDays: 0 },
    ],
  },
  {
    name: '50% Entrada + 50% Final',
    structure: [
      { label: 'Entrada', percent: 50, count: 1, intervalDays: 0, firstOffsetDays: 0 },
      { label: 'Final', percent: 50, count: 1, intervalDays: 0, firstOffsetDays: 60 },
    ],
  },
  {
    name: '30% Entrada + 70% Final',
    structure: [
      { label: 'Entrada', percent: 30, count: 1, intervalDays: 0, firstOffsetDays: 0 },
      { label: 'Final', percent: 70, count: 1, intervalDays: 0, firstOffsetDays: 60 },
    ],
  },
  {
    name: '33% Entrada + 10x quinzenal',
    isDefault: true,
    structure: [
      { label: 'Entrada', percent: 33, count: 1, intervalDays: 0, firstOffsetDays: 0 },
      { label: 'Parcela quinzenal', percent: 67, count: 10, intervalDays: 15, firstOffsetDays: 15 },
    ],
  },
  {
    name: '10x mensal',
    structure: [
      { label: 'Parcela mensal', percent: 100, count: 10, intervalDays: 30, firstOffsetDays: 30 },
    ],
  },
  {
    name: '12x mensal',
    structure: [
      { label: 'Parcela mensal', percent: 100, count: 12, intervalDays: 30, firstOffsetDays: 30 },
    ],
  },
];

@Injectable()
export class PoolPaymentTermService {
  constructor(private readonly prisma: PrismaService) {}

  private validateStructure(structure: PoolPaymentTermPartDto[]): void {
    if (!structure || structure.length === 0) {
      throw new BadRequestException('Estrutura nao pode estar vazia');
    }
    const total = structure.reduce((s, p) => s + (p.percent || 0), 0);
    if (Math.abs(total - 100) > 0.001) {
      throw new BadRequestException(`Soma dos percents deve ser 100. Recebido: ${total.toFixed(2)}`);
    }
  }

  async ensureSeeded(companyId: string): Promise<void> {
    const count = await this.prisma.poolPaymentTerm.count({
      where: { companyId, deletedAt: null },
    });
    if (count > 0) return;
    for (const t of DEFAULT_TERMS) {
      await this.prisma.poolPaymentTerm.create({
        data: {
          companyId,
          name: t.name,
          isActive: true,
          isDefault: t.isDefault ?? false,
          structure: t.structure as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  async findAll(companyId: string) {
    await this.ensureSeeded(companyId);
    return this.prisma.poolPaymentTerm.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const item = await this.prisma.poolPaymentTerm.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Forma de pagamento nao encontrada');
    return item;
  }

  async create(companyId: string, dto: CreatePoolPaymentTermDto) {
    this.validateStructure(dto.structure);
    if (dto.isDefault) {
      // Desmarca outros padroes
      await this.prisma.poolPaymentTerm.updateMany({
        where: { companyId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }
    return this.prisma.poolPaymentTerm.create({
      data: {
        companyId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        structure: dto.structure as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdatePoolPaymentTermDto) {
    await this.findOne(id, companyId);
    if (dto.structure) this.validateStructure(dto.structure);
    if (dto.isDefault) {
      await this.prisma.poolPaymentTerm.updateMany({
        where: { companyId, isDefault: true, id: { not: id }, deletedAt: null },
        data: { isDefault: false },
      });
    }
    return this.prisma.poolPaymentTerm.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        isDefault: dto.isDefault,
        structure: dto.structure
          ? (dto.structure as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.poolPaymentTerm.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }
}
