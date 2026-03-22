import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Financial report: revenue, commissions, net by period and technician.
   */
  async financeReport(companyId: string, from?: string, to?: string, technicianId?: string) {
    const where: any = { serviceOrder: { companyId, deletedAt: null } };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    if (technicianId) {
      where.serviceOrder.assignedPartnerId = technicianId;
    }

    const ledgers = await this.prisma.serviceOrderLedger.findMany({
      where,
      include: {
        serviceOrder: {
          select: {
            id: true, title: true, status: true, createdAt: true,
            assignedPartner: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;
    let confirmedCount = 0;

    const byMonth: Record<string, { gross: number; commission: number; net: number; count: number }> = {};
    const byTechnician: Record<string, { name: string; gross: number; commission: number; net: number; count: number }> = {};

    for (const l of ledgers) {
      totalGross += l.grossCents;
      totalCommission += l.commissionCents;
      totalNet += l.netCents;
      if (l.confirmedAt) confirmedCount++;

      // Group by month
      const month = l.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = { gross: 0, commission: 0, net: 0, count: 0 };
      byMonth[month].gross += l.grossCents;
      byMonth[month].commission += l.commissionCents;
      byMonth[month].net += l.netCents;
      byMonth[month].count++;

      // Group by technician
      const tech = l.serviceOrder?.assignedPartner;
      if (tech) {
        if (!byTechnician[tech.id]) byTechnician[tech.id] = { name: tech.name, gross: 0, commission: 0, net: 0, count: 0 };
        byTechnician[tech.id].gross += l.grossCents;
        byTechnician[tech.id].commission += l.commissionCents;
        byTechnician[tech.id].net += l.netCents;
        byTechnician[tech.id].count++;
      }
    }

    return {
      totalGross,
      totalCommission,
      totalNet,
      totalCount: ledgers.length,
      confirmedCount,
      byMonth: Object.entries(byMonth).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month)),
      byTechnician: Object.entries(byTechnician).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.gross - a.gross),
      ledgers: ledgers.map((l) => ({
        id: l.id,
        serviceOrderId: l.serviceOrderId,
        title: l.serviceOrder?.title,
        status: l.serviceOrder?.status,
        technicianName: l.serviceOrder?.assignedPartner?.name,
        grossCents: l.grossCents,
        commissionCents: l.commissionCents,
        netCents: l.netCents,
        confirmedAt: l.confirmedAt,
        createdAt: l.createdAt,
      })),
    };
  }

  /**
   * Orders report: by status, period, technician.
   */
  async ordersReport(companyId: string, from?: string, to?: string) {
    const where: any = { companyId, deletedAt: null };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const orders = await this.prisma.serviceOrder.findMany({
      where,
      select: {
        id: true, status: true, createdAt: true, deadlineAt: true, valueCents: true,
        assignedPartner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const byStatus: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let overdue = 0;
    let totalValue = 0;

    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      totalValue += o.valueCents;

      const day = o.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;

      if (o.deadlineAt < now && !['CONCLUIDA', 'APROVADA', 'CANCELADA'].includes(o.status)) {
        overdue++;
      }
    }

    return {
      total: orders.length,
      totalValue,
      overdue,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      byDay: Object.entries(byDay).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)),
    };
  }

  /**
   * Technicians performance report: ranking, OS count, avg time, rating.
   */
  async techniciansReport(companyId: string) {
    const technicians = await this.prisma.partner.findMany({
      where: { companyId, deletedAt: null, partnerTypes: { has: 'TECNICO' } },
      select: {
        id: true, name: true, phone: true, rating: true, status: true,
        serviceOrders: {
          where: { deletedAt: null },
          select: { id: true, status: true, createdAt: true, valueCents: true },
        },
      },
    });

    return technicians.map((t) => {
      const completed = t.serviceOrders.filter((o) => ['CONCLUIDA', 'APROVADA'].includes(o.status));
      const totalValue = t.serviceOrders.reduce((sum, o) => sum + o.valueCents, 0);

      return {
        id: t.id,
        name: t.name,
        phone: t.phone,
        rating: t.rating,
        status: t.status,
        totalOs: t.serviceOrders.length,
        completedOs: completed.length,
        totalValue,
        completionRate: t.serviceOrders.length > 0 ? Math.round((completed.length / t.serviceOrders.length) * 100) : 0,
      };
    }).sort((a, b) => b.completedOs - a.completedOs);
  }

  /**
   * Detailed technician report: time tracking, commission, per OS.
   */
  async technicianDetailReport(
    companyId: string,
    technicianId: string,
    from?: string,
    to?: string,
  ) {
    const where: any = {
      companyId,
      deletedAt: null,
      assignedPartnerId: technicianId,
      status: { in: ['CONCLUIDA', 'APROVADA'] },
    };

    if (from || to) {
      where.completedAt = {};
      if (from) where.completedAt.gte = new Date(from);
      if (to) where.completedAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const orders = await this.prisma.serviceOrder.findMany({
      where,
      select: {
        id: true, code: true, title: true, status: true,
        valueCents: true, commissionBps: true, techCommissionCents: true,
        enRouteAt: true, startedAt: true, completedAt: true,
        acceptedAt: true, arrivedAt: true,
        totalPausedMs: true, pauseCount: true,
        isReturn: true, isEvaluation: true,
        createdAt: true,
        items: {
          select: {
            serviceName: true, quantity: true, unitPriceCents: true,
            commissionBps: true, techFixedValueCents: true, commissionRule: true,
          },
        },
        ledger: {
          select: { grossCents: true, commissionCents: true, netCents: true, commissionBps: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Get technician info
    const tech = await this.prisma.partner.findFirst({
      where: { id: technicianId, companyId },
      select: {
        id: true, name: true, phone: true, rating: true, status: true,
        specializations: {
          include: { specialization: { select: { name: true } } },
        },
      },
    });

    // Get evaluation scores for this period
    const evalWhere: any = {
      partnerId: technicianId,
      companyId,
      evaluatorType: 'GESTOR',
      score: { gt: 0 },
    };
    if (from || to) {
      evalWhere.createdAt = {};
      if (from) evalWhere.createdAt.gte = new Date(from);
      if (to) evalWhere.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }
    const evaluations = await this.prisma.evaluation.findMany({
      where: evalWhere,
      select: { score: true },
    });

    // Build detailed rows
    const rows = orders.map((os) => {
      const enRoute = os.enRouteAt ? new Date(os.enRouteAt).getTime() : null;
      const started = os.startedAt ? new Date(os.startedAt).getTime() : null;
      const completed = os.completedAt ? new Date(os.completedAt).getTime() : null;
      const pausedMs = Number(os.totalPausedMs || 0);

      // Time calculations (in minutes)
      let totalMinutes = 0;
      let travelMinutes = 0;
      let executionMinutes = 0;
      let pauseMinutes = Math.round(pausedMs / 60000);

      if (enRoute && completed) {
        totalMinutes = Math.round((completed - enRoute) / 60000);
      } else if (started && completed) {
        totalMinutes = Math.round((completed - started) / 60000);
      }

      if (enRoute && started) {
        travelMinutes = Math.round((started - enRoute) / 60000);
      }

      if (started && completed) {
        executionMinutes = Math.round((completed - started - pausedMs) / 60000);
        if (executionMinutes < 0) executionMinutes = 0;
      }

      const netMinutes = totalMinutes - pauseMinutes;

      // Commission (from ledger or calculated)
      const commissionCents = os.ledger?.netCents ?? os.techCommissionCents ?? 0;

      // Service names
      const serviceNames = os.items.map(i => i.serviceName).join(', ') || '—';

      return {
        id: os.id,
        code: (os as any).code,
        title: os.title,
        status: os.status,
        serviceName: serviceNames,
        date: os.completedAt,
        enRouteAt: os.enRouteAt,
        startedAt: os.startedAt,
        completedAt: os.completedAt,
        totalMinutes,
        travelMinutes,
        executionMinutes,
        pauseMinutes,
        netMinutes,
        pauseCount: os.pauseCount,
        valueCents: os.valueCents,
        commissionCents,
        isReturn: os.isReturn,
        isEvaluation: os.isEvaluation,
      };
    });

    // Summaries
    const totalOs = rows.length;
    const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
    const totalNetMinutes = rows.reduce((s, r) => s + r.netMinutes, 0);
    const totalTravelMinutes = rows.reduce((s, r) => s + r.travelMinutes, 0);
    const totalPauseMinutes = rows.reduce((s, r) => s + r.pauseMinutes, 0);
    const totalValueCents = rows.reduce((s, r) => s + r.valueCents, 0);
    const totalCommissionCents = rows.reduce((s, r) => s + r.commissionCents, 0);
    const avgScore = evaluations.length > 0
      ? Math.round((evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length) * 10) / 10
      : tech?.rating ?? 0;

    // Group by service
    const byService: Record<string, { count: number; minutes: number; commissionCents: number }> = {};
    for (const r of rows) {
      const key = r.serviceName;
      if (!byService[key]) byService[key] = { count: 0, minutes: 0, commissionCents: 0 };
      byService[key].count++;
      byService[key].minutes += r.netMinutes;
      byService[key].commissionCents += r.commissionCents;
    }

    return {
      technician: tech ? {
        id: tech.id,
        name: tech.name,
        phone: tech.phone,
        rating: tech.rating,
        status: tech.status,
        specializations: tech.specializations.map(s => s.specialization.name),
      } : null,
      summary: {
        totalOs,
        totalMinutes,
        totalNetMinutes,
        totalTravelMinutes,
        totalPauseMinutes,
        totalValueCents,
        totalCommissionCents,
        avgScore,
      },
      byService: Object.entries(byService).map(([name, data]) => ({
        serviceName: name,
        ...data,
      })),
      rows,
    };
  }
}
