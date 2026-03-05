import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { SettleCardDto, BatchSettleCardDto } from './dto/card-settlement.dto';

@Injectable()
export class CardSettlementService {
  private readonly logger = new Logger(CardSettlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a card settlement record when an entry is paid by card.
   * Called from finance.service.ts within the PAID transaction.
   */
  async createFromEntry(
    tx: any, // Prisma transaction client
    entry: { id: string; companyId: string; netCents: number; paidAt: Date },
    pm: { code: string; feePercent: number; receivingDays: number; cardBrand?: string },
  ) {
    const grossCents = entry.netCents;
    const feeCents = Math.round(grossCents * pm.feePercent / 100);
    const expectedNetCents = grossCents - feeCents;
    const expectedDate = new Date(entry.paidAt);
    expectedDate.setDate(expectedDate.getDate() + pm.receivingDays);

    return tx.cardSettlement.create({
      data: {
        companyId: entry.companyId,
        financialEntryId: entry.id,
        paymentMethodCode: pm.code,
        cardBrand: pm.cardBrand || undefined,
        grossCents,
        feePercent: pm.feePercent,
        feeCents,
        expectedNetCents,
        expectedDate,
        receivingDays: pm.receivingDays,
        status: 'PENDING',
      },
    });
  }

  /** Summary counts for the tab header */
  async summary(companyId: string) {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const [pending, thisWeek, overdue] = await Promise.all([
      this.prisma.cardSettlement.aggregate({
        where: { companyId, status: 'PENDING' },
        _count: true,
        _sum: { expectedNetCents: true },
      }),
      this.prisma.cardSettlement.aggregate({
        where: { companyId, status: 'PENDING', expectedDate: { lte: endOfWeek } },
        _count: true,
        _sum: { expectedNetCents: true },
      }),
      this.prisma.cardSettlement.aggregate({
        where: { companyId, status: 'PENDING', expectedDate: { lt: now } },
        _count: true,
        _sum: { expectedNetCents: true },
      }),
    ]);

    return {
      pendingCount: pending._count,
      pendingAmountCents: pending._sum.expectedNetCents || 0,
      expectedThisWeekCount: thisWeek._count,
      expectedThisWeekCents: thisWeek._sum.expectedNetCents || 0,
      overdueCount: overdue._count,
      overdueCents: overdue._sum.expectedNetCents || 0,
    };
  }

  /** List card settlements with pagination and filters */
  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: { status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.dateFrom) {
      where.expectedDate = { ...where.expectedDate, gte: new Date(filters.dateFrom) };
    }
    if (filters?.dateTo) {
      where.expectedDate = { ...where.expectedDate, lte: new Date(`${filters.dateTo}T23:59:59.999Z`) };
    }
    if (pagination.search) {
      where.OR = [
        { financialEntry: { description: { contains: pagination.search, mode: 'insensitive' } } },
        { financialEntry: { partner: { name: { contains: pagination.search, mode: 'insensitive' } } } },
        { cardBrand: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    // Sort
    const sortBy = pagination.sortBy || 'expectedDate';
    const sortOrder = pagination.sortOrder || 'asc';
    const validSorts = ['expectedDate', 'grossCents', 'expectedNetCents', 'createdAt', 'settledAt'];
    const orderBy = validSorts.includes(sortBy) ? { [sortBy]: sortOrder } : { expectedDate: 'asc' as const };

    const [data, total] = await Promise.all([
      this.prisma.cardSettlement.findMany({
        where,
        include: {
          financialEntry: {
            select: { id: true, description: true, partner: { select: { id: true, name: true } } },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.cardSettlement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Settle a single card settlement */
  async settle(id: string, companyId: string, dto: SettleCardDto, settledByName: string) {
    const cs = await this.prisma.cardSettlement.findFirst({
      where: { id, companyId, status: 'PENDING' },
    });
    if (!cs) throw new NotFoundException('Baixa de cartão não encontrada');

    const differenceCents = dto.actualAmountCents - cs.expectedNetCents;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cardSettlement.update({
        where: { id },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
          actualAmountCents: dto.actualAmountCents,
          differenceCents,
          cashAccountId: dto.cashAccountId,
          settledByName,
          notes: dto.notes,
        },
      });

      // Update cash account balance with the ACTUAL received amount
      await tx.cashAccount.update({
        where: { id: dto.cashAccountId },
        data: { currentBalanceCents: { increment: dto.actualAmountCents } },
      });

      this.logger.log(`Card settlement ${id} settled: expected=${cs.expectedNetCents}, actual=${dto.actualAmountCents}, diff=${differenceCents}`);
      return updated;
    });
  }

  /** Batch settle multiple card settlements using expected amounts */
  async settleBatch(companyId: string, dto: BatchSettleCardDto, settledByName: string) {
    const settlements = await this.prisma.cardSettlement.findMany({
      where: { id: { in: dto.ids }, companyId, status: 'PENDING' },
    });

    if (settlements.length === 0) throw new BadRequestException('Nenhuma baixa pendente encontrada');

    let totalActual = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const cs of settlements) {
        const actualAmount = dto.useExpectedAmounts ? cs.expectedNetCents : Math.round(cs.expectedNetCents); // use expected if flag set
        const diff = actualAmount - cs.expectedNetCents;

        await tx.cardSettlement.update({
          where: { id: cs.id },
          data: {
            status: 'SETTLED',
            settledAt: new Date(),
            actualAmountCents: actualAmount,
            differenceCents: diff,
            cashAccountId: dto.cashAccountId,
            settledByName,
            notes: dto.notes,
          },
        });

        totalActual += actualAmount;
      }

      // Update cash account with total
      await tx.cashAccount.update({
        where: { id: dto.cashAccountId },
        data: { currentBalanceCents: { increment: totalActual } },
      });
    });

    this.logger.log(`Batch settled ${settlements.length} card settlements, total=${totalActual}`);
    return { settled: settlements.length, totalAmountCents: totalActual };
  }

  /** Cancel a pending card settlement */
  async cancel(id: string, companyId: string, notes?: string) {
    const cs = await this.prisma.cardSettlement.findFirst({
      where: { id, companyId, status: 'PENDING' },
    });
    if (!cs) throw new NotFoundException('Baixa de cartão não encontrada');

    return this.prisma.cardSettlement.update({
      where: { id },
      data: { status: 'CANCELLED', notes },
    });
  }
}
