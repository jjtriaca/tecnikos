import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { SettleCardDto, BatchSettleCardDto } from './dto/card-settlement.dto';
import { FinancialAccountService } from './financial-account.service';
import { CardFeeRateService } from './card-fee-rate.service';

@Injectable()
export class CardSettlementService {
  private readonly logger = new Logger(CardSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly cardFeeRateService: CardFeeRateService,
  ) {}

  /**
   * Create a card settlement record when an entry is paid by card.
   * Called from finance.service.ts within the PAID transaction.
   */
  async createFromEntry(
    tx: any, // Prisma transaction client
    entry: { id: string; companyId: string; netCents: number; paidAt: Date },
    pm: { code: string; feePercent: number; receivingDays: number; cardBrand?: string; cardFeeRateId?: string },
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
        cardFeeRateId: pm.cardFeeRateId || undefined,
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
            select: {
              id: true, description: true, notes: true, financialAccountId: true,
              partner: { select: { id: true, name: true } },
              financialAccount: { select: { id: true, code: true, name: true } },
            },
          },
          cardFeeRate: {
            select: { id: true, description: true, brand: true },
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
      include: { financialEntry: { select: { description: true, partnerId: true } } },
    });
    if (!cs) throw new NotFoundException('Baixa de cartão não encontrada');

    // Recalculate fee if installments provided
    let feePercent = cs.feePercent;
    let feeCents = cs.feeCents;
    let expectedNetCents = cs.expectedNetCents;

    if (dto.installments && cs.cardBrand) {
      const cardType = (cs.paymentMethodCode || '').toUpperCase().includes('DEBIT') ? 'DEBITO' : 'CREDITO';
      const rate = await this.cardFeeRateService.lookup(companyId, cs.cardBrand, cardType, dto.installments);
      if (rate) {
        feePercent = rate.feePercent;
        feeCents = Math.round(cs.grossCents * rate.feePercent / 100);
        expectedNetCents = cs.grossCents - feeCents;
        this.logger.log(`Fee recalculated: brand=${cs.cardBrand}, type=${cardType}, installments=${dto.installments} → fee=${feePercent}%, feeCents=${feeCents}`);
      }
    }

    const differenceCents = dto.actualAmountCents - expectedNetCents;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cardSettlement.update({
        where: { id },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
          actualAmountCents: dto.actualAmountCents,
          feePercent,
          feeCents,
          expectedNetCents,
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

      // Auto-generate fee expense entry for DRE reporting
      if (feeCents > 0) {
        await this.createFeeExpense(tx, companyId, { ...cs, feeCents, feePercent }, settledByName);
      }

      this.logger.log(`Card settlement ${id} settled: expected=${expectedNetCents}, actual=${dto.actualAmountCents}, diff=${differenceCents}`);
      return updated;
    });
  }

  /** Batch settle multiple card settlements using expected amounts */
  async settleBatch(companyId: string, dto: BatchSettleCardDto, settledByName: string) {
    const settlements = await this.prisma.cardSettlement.findMany({
      where: { id: { in: dto.ids }, companyId, status: 'PENDING' },
      include: { financialEntry: { select: { description: true, partnerId: true } } },
    });

    if (settlements.length === 0) throw new BadRequestException('Nenhuma baixa pendente encontrada');

    let totalActual = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const cs of settlements) {
        const actualAmount = dto.useExpectedAmounts ? cs.expectedNetCents : Math.round(cs.expectedNetCents);
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

        // Auto-generate fee expense entry for each settlement
        if (cs.feeCents > 0) {
          await this.createFeeExpense(tx, companyId, cs, settledByName);
        }
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

  /**
   * Create a PAYABLE expense entry for card fee (DRE reporting only).
   * Does NOT debit cash — the fee was already retained by the card operator.
   */
  private async createFeeExpense(tx: any, companyId: string, cs: any, settledByName: string) {
    try {
      // Find the "5200" (Taxas de Cartão) system account
      const feeAccount = await this.financialAccountService.findByCode(companyId, '5200');
      if (!feeAccount) {
        this.logger.warn(`Account 5200 not found for company ${companyId}, skipping fee expense`);
        return;
      }

      const now = new Date();
      const brandLabel = cs.cardBrand ? ` ${cs.cardBrand}` : '';
      const entryDesc = cs.financialEntry?.description || '';
      const description = `Taxa cartão${brandLabel} - Ref: ${entryDesc}`.trim();

      await tx.financialEntry.create({
        data: {
          companyId,
          type: 'PAYABLE',
          status: 'PAID',
          description,
          grossCents: cs.feeCents,
          netCents: cs.feeCents,
          paidAt: now,
          paymentMethod: 'TAXA_CARTAO',
          partnerId: cs.financialEntry?.partnerId || undefined,
          financialAccountId: feeAccount.id,
          notes: `[${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] Auto-gerado na baixa do cartão por ${settledByName}`,
        },
      });

      this.logger.log(`Fee expense created: ${cs.feeCents} cents for card settlement ${cs.id}`);
    } catch (err) {
      this.logger.error(`Failed to create fee expense for settlement ${cs.id}: ${err.message}`);
    }
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
