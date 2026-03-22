import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkDayService {
  constructor(private readonly prisma: PrismaService) {}

  private todayStr(timezone?: string): string {
    const tz = timezone || 'America/Sao_Paulo';
    return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  }

  /** Get or create today's work day for a technician */
  async getToday(companyId: string, partnerId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const date = this.todayStr(company?.timezone || undefined);

    const existing = await this.prisma.workDay.findUnique({
      where: { companyId_partnerId_date: { companyId, partnerId, date } },
    });

    return {
      workDay: existing,
      date,
      isActive: existing ? !existing.endedAt : false,
    };
  }

  /** Start work day */
  async startDay(companyId: string, partnerId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const date = this.todayStr(company?.timezone || undefined);

    const existing = await this.prisma.workDay.findUnique({
      where: { companyId_partnerId_date: { companyId, partnerId, date } },
    });

    if (existing && !existing.endedAt) {
      throw new BadRequestException('Jornada já iniciada hoje');
    }
    if (existing && existing.endedAt) {
      throw new BadRequestException('Jornada já encerrada hoje');
    }

    const workDay = await this.prisma.workDay.create({
      data: {
        companyId,
        partnerId,
        date,
        startedAt: new Date(),
      },
    });

    return workDay;
  }

  /** End work day */
  async endDay(companyId: string, partnerId: string, notes?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const date = this.todayStr(company?.timezone || undefined);

    const existing = await this.prisma.workDay.findUnique({
      where: { companyId_partnerId_date: { companyId, partnerId, date } },
    });

    if (!existing) throw new NotFoundException('Nenhuma jornada iniciada hoje');
    if (existing.endedAt) throw new BadRequestException('Jornada já encerrada');

    const now = new Date();
    const totalWorkedMs = BigInt(now.getTime() - new Date(existing.startedAt).getTime());
    const netWorkedMs = totalWorkedMs - existing.totalPausedMs;
    const eightHoursMs = BigInt(8 * 60 * 60 * 1000);
    const overtimeMs = netWorkedMs > eightHoursMs ? netWorkedMs - eightHoursMs : BigInt(0);

    // Count OS completed today by this technician
    const osCount = await this.prisma.serviceOrder.count({
      where: {
        companyId,
        assignedPartnerId: partnerId,
        completedAt: {
          gte: new Date(existing.startedAt),
          lte: now,
        },
        status: { in: ['CONCLUIDA', 'APROVADA'] },
        deletedAt: null,
      },
    });

    // Check if meal break was taken (any pause with reasonCategory 'meal_break')
    const mealBreak = await this.prisma.executionPause.findFirst({
      where: {
        partnerId,
        reasonCategory: 'meal_break',
        pausedAt: { gte: new Date(existing.startedAt), lte: now },
      },
    });

    const workDay = await this.prisma.workDay.update({
      where: { id: existing.id },
      data: {
        endedAt: now,
        totalWorkedMs,
        overtimeMs,
        osCount,
        mealBreakTaken: !!mealBreak,
        notes: notes || existing.notes,
      },
    });

    return workDay;
  }

  /** Get work days history for a technician */
  async getHistory(companyId: string, partnerId: string, from?: string, to?: string) {
    const where: any = { companyId, partnerId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const days = await this.prisma.workDay.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 60,
    });

    return days.map(d => ({
      ...d,
      totalWorkedMs: Number(d.totalWorkedMs),
      totalPausedMs: Number(d.totalPausedMs),
      overtimeMs: Number(d.overtimeMs),
    }));
  }
}
