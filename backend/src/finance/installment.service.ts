import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';

/**
 * InstallmentService — arquitetura pos-refactor (v1.09.99):
 * Parcelas sao FinancialEntry filhas com parentEntryId apontando pro pai.
 * O FinancialInstallment continua no schema (apenas pra compat com dados antigos)
 * mas parcelamentos novos NAO criam mais FinancialInstallment.
 *
 * Adapter pattern: endpoints que retornam "installment" formatam entries filhas
 * no shape legado { id, installmentNumber, dueDate, amountCents, totalCents, status, ... }
 * pra nao quebrar o frontend atual.
 */
@Injectable()
export class InstallmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  /**
   * Gera N parcelas como entries filhas com parentEntryId = pai.
   * Pai vira CANCELLED (some do "a receber") mas preserva NFS-e/histórico.
   * Filhas herdam nfseStatus, nfseEmissionId, paymentMethod, paymentInstrumentId,
   * financialAccountId, partner, type, serviceOrderId, config de juros/multa.
   */
  async generateInstallments(entryId: string, companyId: string, dto: GenerateInstallmentsDto) {
    const pai = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Lancamento nao encontrado');
    if (pai.status === 'PAID' || pai.status === 'CANCELLED') {
      throw new BadRequestException('Lancamento com status terminal nao pode ser parcelado');
    }
    const existentes = await this.prisma.financialEntry.count({
      where: { parentEntryId: entryId, deletedAt: null },
    });
    if (existentes > 0) {
      throw new BadRequestException('Lancamento ja possui parcelas');
    }

    const count = dto.count;
    const intervalDays = dto.intervalDays ?? 30;
    const baseAmount = Math.floor(pai.netCents / count);
    const remainder = pai.netCents - (baseAmount * count);

    const firstDue = new Date(dto.firstDueDate.includes('T') ? dto.firstDueDate : `${dto.firstDueDate}T12:00:00`);

    // Pre-gera N codigos (sequencial)
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY'));
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(firstDue);
        dueDate.setDate(dueDate.getDate() + (i * intervalDays));
        const amountCents = i === count - 1 ? baseAmount + remainder : baseAmount;
        await tx.financialEntry.create({
          data: {
            companyId,
            code: codes[i],
            type: pai.type,
            status: 'PENDING',
            description: `${pai.description} — Parcela ${i + 1}/${count}`,
            grossCents: amountCents,
            netCents: amountCents,
            dueDate,
            parentEntryId: entryId,
            partnerId: pai.partnerId,
            serviceOrderId: pai.serviceOrderId,
            paymentMethod: pai.paymentMethod,
            paymentMethodId: pai.paymentMethodId,
            paymentInstrumentId: pai.paymentInstrumentId,
            financialAccountId: pai.financialAccountId,
            cashAccountId: pai.cashAccountId,
            nfseStatus: pai.nfseStatus,
            nfseEmissionId: pai.nfseEmissionId,
            interestType: dto.interestType || pai.interestType || 'SIMPLE',
            interestRateMonthly: dto.interestRateMonthly ?? pai.interestRateMonthly ?? null,
            penaltyPercent: dto.penaltyPercent ?? pai.penaltyPercent ?? null,
            penaltyFixedCents: dto.penaltyFixedCents ?? pai.penaltyFixedCents ?? null,
            installmentCount: count,
          },
        });
      }
      // Pai: CANCELLED, preserva valores/NFS-e, registra info de parcelamento
      await tx.financialEntry.update({
        where: { id: entryId },
        data: {
          status: 'CANCELLED',
          installmentCount: count,
          interestType: dto.interestType || pai.interestType,
          interestRateMonthly: dto.interestRateMonthly ?? pai.interestRateMonthly,
          penaltyPercent: dto.penaltyPercent ?? pai.penaltyPercent,
          penaltyFixedCents: dto.penaltyFixedCents ?? pai.penaltyFixedCents,
          notes: `[Parcelado em ${count}x — substituido por entries filhas]`,
        },
      });
    });

    return this.getInstallments(entryId, companyId);
  }

  /**
   * Lista parcelas do entry (entries filhas via parentEntryId) no shape legado.
   */
  async getInstallments(entryId: string, companyId: string) {
    const pai = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Lancamento nao encontrado');

    const filhas = await this.prisma.financialEntry.findMany({
      where: { parentEntryId: entryId, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return filhas.map((f, idx) => this.toInstallmentShape(f, idx + 1, entryId));
  }

  /**
   * "Paga" uma parcela — na verdade, marca a entry filha como PAID.
   * id = FinancialEntry.id (filha).
   */
  async payInstallment(installmentId: string, companyId: string, paidAmountCents?: number, notes?: string) {
    const filha = await this.prisma.financialEntry.findFirst({
      where: { id: installmentId, companyId, deletedAt: null },
    });
    if (!filha) throw new NotFoundException('Parcela nao encontrada');
    if (filha.status === 'PAID') throw new BadRequestException('Parcela ja foi paga');
    if (filha.status === 'CANCELLED') throw new BadRequestException('Parcela com status terminal');

    const updated = await this.prisma.financialEntry.update({
      where: { id: installmentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        grossCents: paidAmountCents ?? filha.grossCents,
        netCents: paidAmountCents ?? filha.netCents,
        notes: notes ?? filha.notes,
      },
    });

    return this.toInstallmentShape(updated, 1, filha.parentEntryId || installmentId);
  }

  /**
   * Cancela uma parcela (marca entry filha como CANCELLED).
   */
  async cancelInstallment(installmentId: string, companyId: string, notes?: string) {
    const filha = await this.prisma.financialEntry.findFirst({
      where: { id: installmentId, companyId, deletedAt: null },
    });
    if (!filha) throw new NotFoundException('Parcela nao encontrada');
    if (filha.status === 'PAID') throw new BadRequestException('Parcela ja paga nao pode ser cancelada');
    if (filha.status === 'CANCELLED') throw new BadRequestException('Parcela ja esta cancelada');

    const updated = await this.prisma.financialEntry.update({
      where: { id: installmentId },
      data: { status: 'CANCELLED', notes: notes ?? filha.notes },
    });
    return this.toInstallmentShape(updated, 1, filha.parentEntryId || installmentId);
  }

  /**
   * Atualiza dueDate/amountCents da parcela (entry filha).
   */
  async updateInstallment(installmentId: string, companyId: string, data: { dueDate?: string; amountCents?: number }) {
    const filha = await this.prisma.financialEntry.findFirst({
      where: { id: installmentId, companyId, deletedAt: null },
    });
    if (!filha) throw new NotFoundException('Parcela nao encontrada');
    if (filha.status === 'PAID') throw new BadRequestException('Parcela ja paga nao pode ser editada');
    if (filha.status === 'CANCELLED') throw new BadRequestException('Parcela cancelada nao pode ser editada');

    const updateData: Record<string, unknown> = {};
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate.includes('T') ? data.dueDate : `${data.dueDate}T12:00:00`);
    }
    if (data.amountCents !== undefined && data.amountCents > 0) {
      updateData.grossCents = data.amountCents;
      updateData.netCents = data.amountCents;
    }
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nenhum dado para atualizar');
    }

    const updated = await this.prisma.financialEntry.update({
      where: { id: installmentId },
      data: updateData,
    });
    return this.toInstallmentShape(updated, 1, filha.parentEntryId || installmentId);
  }

  /**
   * Cron diario: aplica juros/multa em parcelas (entries filhas) vencidas.
   * grossCents recebe principal + juros + multa calculados.
   * Principal original e preservado no campo netCents (snapshot do momento da criacao).
   */
  async applyInterestToOverdue(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentEntryId: { not: null },
        status: 'PENDING',
        dueDate: { lt: today },
      },
    });

    let processedCount = 0;
    if (overdue.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const f of overdue) {
          if (!f.dueDate) continue;
          const principal = f.netCents;
          let interestCents = 0;
          if (f.interestRateMonthly && f.interestRateMonthly > 0) {
            const daysOverdue = Math.floor((today.getTime() - f.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const dailyRate = f.interestRateMonthly / 30 / 100;
            interestCents = f.interestType === 'COMPOUND'
              ? Math.round(principal * (Math.pow(1 + dailyRate, daysOverdue) - 1))
              : Math.round(principal * dailyRate * daysOverdue);
          }
          let penaltyCents = 0;
          if (f.penaltyPercent && f.penaltyPercent > 0) {
            penaltyCents += Math.round(principal * f.penaltyPercent / 100);
          }
          if (f.penaltyFixedCents && f.penaltyFixedCents > 0) {
            penaltyCents += f.penaltyFixedCents;
          }
          await tx.financialEntry.update({
            where: { id: f.id },
            data: {
              grossCents: principal + interestCents + penaltyCents,
            },
          });
          processedCount++;
        }
      });
    }
    return { processed: processedCount };
  }

  /**
   * Aging report: overdue entries filhas + entries sem parentEntryId vencidas.
   */
  async getOverdueAgingReport(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Entries filhas (parcelas) vencidas
    const overdueFilhas = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentEntryId: { not: null },
        status: { in: ['PENDING', 'CONFIRMED'] },
        dueDate: { lt: today },
      },
      include: { partner: { select: { id: true, name: true } } },
    });
    // Entries sem parcelamento vencidas
    const overdueEntries = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentEntryId: null,
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

    for (const f of overdueFilhas) {
      if (f.dueDate) categorize(f.dueDate, f.grossCents);
    }
    for (const e of overdueEntries) {
      if (e.dueDate) categorize(e.dueDate, e.netCents);
    }

    const totalOverdueCents = Object.values(buckets).reduce((s, b) => s + b.totalCents, 0);
    const totalOverdueCount = Object.values(buckets).reduce((s, b) => s + b.count, 0);

    return { buckets, totalOverdueCents, totalOverdueCount };
  }

  /**
   * Adapter: formata FinancialEntry filha no shape legado FinancialInstallment
   * pra compatibilidade com o frontend atual.
   */
  private toInstallmentShape(entry: any, installmentNumber: number, financialEntryId: string) {
    const principal = entry.netCents || entry.grossCents || 0;
    const total = entry.grossCents || 0;
    const diff = total - principal;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = entry.status === 'PENDING' && entry.dueDate && entry.dueDate < today;
    return {
      id: entry.id,
      financialEntryId,
      installmentNumber,
      dueDate: entry.dueDate,
      amountCents: principal,
      interestCents: diff > 0 ? diff : 0,
      penaltyCents: 0,
      discountCents: 0,
      totalCents: total,
      status: entry.status === 'PAID' ? 'PAID'
        : entry.status === 'CANCELLED' ? 'CANCELLED'
        : isOverdue ? 'OVERDUE' : 'PENDING',
      paidAt: entry.paidAt,
      paidAmountCents: entry.status === 'PAID' ? total : null,
      notes: entry.notes,
      // Campos extras pra debug/audit
      _entryId: entry.id,
      _entryCode: entry.code,
    };
  }
}
