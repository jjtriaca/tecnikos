import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';

@Injectable()
export class InstallmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate N installments for a financial entry.
   * Splits the entry’s netCents equally across installments.
   * Remainder cents go to the last installment.
   */
  async generateInstallments(entryId: string, companyId: string, dto: GenerateInstallmentsDto) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
      include: { installments: true },
    });
    if (!entry) throw new NotFoundException('Lancamento nao encontrado');
    if (entry.installments.length > 0) {
      throw new BadRequestException('Lancamento ja possui parcelas');
    }
    if (entry.status === 'PAID' || entry.status === 'CANCELLED') {
      throw new BadRequestException('Lancamento com status terminal nao pode ser parcelado');
    }

    const count = dto.count;
    const intervalDays = dto.intervalDays ?? 30;
    const baseAmount = Math.floor(entry.netCents / count);
    const remainder = entry.netCents - (baseAmount * count);

    const installments: Array<{
      financialEntryId: string;
      installmentNumber: number;
      dueDate: Date;
      amountCents: number;
      interestCents: number;
      penaltyCents: number;
      discountCents: number;
      totalCents: number;
      status: 'PENDING';
    }> = [];
    const firstDue = new Date(dto.firstDueDate);

    for (let i = 0; i < count; i++) {
      const dueDate = new Date(firstDue);
      dueDate.setDate(dueDate.getDate() + (i * intervalDays));

      const amountCents = i === count - 1 ? baseAmount + remainder : baseAmount;

      installments.push({
        financialEntryId: entryId,
        installmentNumber: i + 1,
        dueDate,
        amountCents,
        interestCents: 0,
        penaltyCents: 0,
        discountCents: 0,
        totalCents: amountCents,
        status: 'PENDING' as const,
      });
    }

    // Use interactive transaction to create all installments and update the entry
    await this.prisma.$transaction(async (tx) => {
      for (const inst of installments) {
        await tx.financialInstallment.create({ data: inst });
      }
      await tx.financialEntry.update({
        where: { id: entryId },
        data: {
          installmentCount: count,
          interestType: dto.interestType || 'SIMPLE',
          interestRateMonthly: dto.interestRateMonthly ?? null,
          penaltyPercent: dto.penaltyPercent ?? null,
          penaltyFixedCents: dto.penaltyFixedCents ?? null,
        },
      });
    });

    return this.getInstallments(entryId, companyId);
  }

  /**
   * List all installments for an entry
   */
  async getInstallments(entryId: string, companyId: string) {
    // Verify entry belongs to company
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Lancamento nao encontrado');

    return this.prisma.financialInstallment.findMany({
      where: { financialEntryId: entryId },
      orderBy: { installmentNumber: 'asc' },
    });
  }

  /**
   * Pay an installment (mark as PAID)
   */
  async payInstallment(installmentId: string, companyId: string, paidAmountCents?: number, notes?: string) {
    const installment = await this.prisma.financialInstallment.findFirst({
      where: { id: installmentId },
      include: { financialEntry: true },
    });
    if (!installment) throw new NotFoundException('Parcela nao encontrada');
    if (installment.financialEntry.companyId !== companyId) {
      throw new NotFoundException('Parcela nao encontrada');
    }
    if (installment.status === 'PAID') {
      throw new BadRequestException('Parcela ja foi paga');
    }
    if (installment.status === 'CANCELLED' || installment.status === 'RENEGOTIATED') {
      throw new BadRequestException('Parcela com status terminal');
    }

    const updated = await this.prisma.financialInstallment.update({
      where: { id: installmentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidAmountCents: paidAmountCents ?? installment.totalCents,
        notes: notes ?? installment.notes,
      },
    });

    // Check if all installments are paid — if so, mark entry as PAID
    await this.checkAndUpdateEntryStatus(installment.financialEntryId);

    return updated;
  }

  /**
   * Cancel an installment
   */
  async cancelInstallment(installmentId: string, companyId: string, notes?: string) {
    const installment = await this.prisma.financialInstallment.findFirst({
      where: { id: installmentId },
      include: { financialEntry: true },
    });
    if (!installment) throw new NotFoundException('Parcela nao encontrada');
    if (installment.financialEntry.companyId !== companyId) {
      throw new NotFoundException('Parcela nao encontrada');
    }
    if (installment.status === 'PAID') {
      throw new BadRequestException('Parcela ja paga nao pode ser cancelada');
    }
    if (installment.status === 'CANCELLED') {
      throw new BadRequestException('Parcela ja esta cancelada');
    }

    return this.prisma.financialInstallment.update({
      where: { id: installmentId },
      data: {
        status: 'CANCELLED',
        notes: notes ?? installment.notes,
      },
    });
  }

  /**
   * Update installment (dueDate, amountCents)
   */
  async updateInstallment(installmentId: string, companyId: string, data: { dueDate?: string; amountCents?: number }) {
    const installment = await this.prisma.financialInstallment.findFirst({
      where: { id: installmentId },
      include: { financialEntry: true },
    });
    if (!installment) throw new NotFoundException('Parcela nao encontrada');
    if (installment.financialEntry.companyId !== companyId) {
      throw new NotFoundException('Parcela nao encontrada');
    }
    if (installment.status === 'PAID') {
      throw new BadRequestException('Parcela ja paga nao pode ser editada');
    }
    if (installment.status === 'CANCELLED') {
      throw new BadRequestException('Parcela cancelada nao pode ser editada');
    }

    const updateData: any = {};
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
      // Reset overdue status if new date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (updateData.dueDate >= today && installment.status === 'OVERDUE') {
        updateData.status = 'PENDING';
      }
    }
    if (data.amountCents !== undefined && data.amountCents > 0) {
      updateData.amountCents = data.amountCents;
      updateData.totalCents = data.amountCents + installment.interestCents + installment.penaltyCents;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nenhum dado para atualizar');
    }

    return this.prisma.financialInstallment.update({
      where: { id: installmentId },
      data: updateData,
    });
  }

  /**
   * Calculate and apply interest on overdue installments
   * Called by the collection cron job daily
   */
  async applyInterestToOverdue(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find overdue PENDING installments for this company
    const overdueInstallments = await this.prisma.financialInstallment.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: today },
        financialEntry: { companyId, deletedAt: null },
      },
      include: { financialEntry: true },
    });

    let processedCount = 0;

    if (overdueInstallments.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const inst of overdueInstallments) {
          const entry = inst.financialEntry;
          let interestCents = 0;
          let penaltyCents = inst.penaltyCents; // Keep existing penalty

          // Calculate interest if rate is set
          if (entry.interestRateMonthly && entry.interestRateMonthly > 0) {
            const daysOverdue = Math.floor((today.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const dailyRate = entry.interestRateMonthly / 30 / 100; // Convert monthly % to daily decimal

            if (entry.interestType === 'COMPOUND') {
              // Compound: interest on (amount + previous interest)
              interestCents = Math.round(inst.amountCents * (Math.pow(1 + dailyRate, daysOverdue) - 1));
            } else {
              // Simple: interest only on original amount
              interestCents = Math.round(inst.amountCents * dailyRate * daysOverdue);
            }
          }

          // Apply penalty (only once, on first day overdue)
          if (penaltyCents === 0) {
            if (entry.penaltyPercent && entry.penaltyPercent > 0) {
              penaltyCents += Math.round(inst.amountCents * entry.penaltyPercent / 100);
            }
            if (entry.penaltyFixedCents && entry.penaltyFixedCents > 0) {
              penaltyCents += entry.penaltyFixedCents;
            }
          }

          const totalCents = inst.amountCents + interestCents + penaltyCents - inst.discountCents;

          await tx.financialInstallment.update({
            where: { id: inst.id },
            data: {
              status: 'OVERDUE',
              interestCents,
              penaltyCents,
              totalCents,
            },
          });

          processedCount++;
        }
      });
    }

    return { processed: processedCount };
  }

  /**
   * Get overdue aging report
   * Groups overdue amounts by aging buckets: 0-30, 31-60, 61-90, 90+
   */
  async getOverdueAgingReport(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInstallments = await this.prisma.financialInstallment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: today },
        financialEntry: { companyId, deletedAt: null },
      },
      include: {
        financialEntry: {
          select: { type: true, partner: { select: { id: true, name: true } } },
        },
      },
    });

    // Also get entries without installments that are overdue
    const overdueEntries = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        installmentCount: null,
        dueDate: { lt: today },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { partner: { select: { id: true, name: true } } },
    });

    const buckets = {
      '0-30': { count: 0, totalCents: 0 },
      '31-60': { count: 0, totalCents: 0 },
      '61-90': { count: 0, totalCents: 0 },
      '90+': { count: 0, totalCents: 0 },
    };

    const categorize = (dueDate: Date, amount: number) => {
      const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 30) { buckets['0-30'].count++; buckets['0-30'].totalCents += amount; }
      else if (days <= 60) { buckets['31-60'].count++; buckets['31-60'].totalCents += amount; }
      else if (days <= 90) { buckets['61-90'].count++; buckets['61-90'].totalCents += amount; }
      else { buckets['90+'].count++; buckets['90+'].totalCents += amount; }
    };

    for (const inst of overdueInstallments) {
      categorize(inst.dueDate, inst.totalCents);
    }
    for (const entry of overdueEntries) {
      if (entry.dueDate) {
        categorize(entry.dueDate, entry.netCents);
      }
    }

    const totalOverdueCents = Object.values(buckets).reduce((s, b) => s + b.totalCents, 0);
    const totalOverdueCount = Object.values(buckets).reduce((s, b) => s + b.count, 0);

    return { buckets, totalOverdueCents, totalOverdueCount };
  }

  /**
   * Check if all installments are paid/cancelled and update parent entry status
   */
  private async checkAndUpdateEntryStatus(entryId: string) {
    const installments = await this.prisma.financialInstallment.findMany({
      where: { financialEntryId: entryId },
    });

    const allPaidOrCancelled = installments.every(
      i => i.status === 'PAID' || i.status === 'CANCELLED',
    );
    const hasAtLeastOnePaid = installments.some(i => i.status === 'PAID');

    if (allPaidOrCancelled && hasAtLeastOnePaid) {
      await this.prisma.financialEntry.update({
        where: { id: entryId },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
  }
}
