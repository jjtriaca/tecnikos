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
}
