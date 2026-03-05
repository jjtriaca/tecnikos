import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto, ChangeEntryStatusDto } from './dto/financial-entry.dto';
import { RenegotiateDto } from './dto/renegotiate.dto';
import { NfseEmissionService } from '../nfse-emission/nfse-emission.service';
import { CardSettlementService } from './card-settlement.service';

const LEDGER_SORTABLE = ['grossCents', 'commissionCents', 'netCents', 'confirmedAt'];
const ENTRY_SORTABLE = ['grossCents', 'netCents', 'dueDate', 'createdAt', 'status', 'confirmedAt'];

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NfseEmissionService))
    private readonly nfseService: NfseEmissionService,
    private readonly cardSettlementService: CardSettlementService,
  ) {}

  /* ═══════════════════════════════════════════════════════════════
     LEGACY — ServiceOrderLedger (backward compat, v1.00.16)
     ═══════════════════════════════════════════════════════════════ */

  async summary(companyId: string) {
    const ledgers = await this.prisma.serviceOrderLedger.findMany({
      where: { serviceOrder: { companyId } },
      include: {
        serviceOrder: {
          select: { id: true, title: true, status: true, assignedPartnerId: true },
        },
      },
      orderBy: { confirmedAt: 'desc' },
    });

    const totalGross = ledgers.reduce((s, l) => s + l.grossCents, 0);
    const totalCommission = ledgers.reduce((s, l) => s + l.commissionCents, 0);
    const totalNet = ledgers.reduce((s, l) => s + l.netCents, 0);

    // OS concluídas/aprovadas sem ledger (pendentes de confirmação)
    const pendingOs = await this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        status: { in: ['CONCLUIDA', 'APROVADA'] },
        ledger: null,
      },
      select: { id: true, title: true, valueCents: true, status: true },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      totalGrossCents: totalGross,
      totalCommissionCents: totalCommission,
      totalNetCents: totalNet,
      confirmedCount: ledgers.length,
      ledgers,
      pendingOs,
    };
  }

  async findLedgers(
    companyId: string,
    pagination?: PaginationDto,
    filters?: { dateFrom?: string; dateTo?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { serviceOrder: { companyId } };
    if (filters?.dateFrom || filters?.dateTo) {
      where.confirmedAt = {};
      if (filters.dateFrom) where.confirmedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.confirmedAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (pagination?.search) {
      where.serviceOrder = {
        ...where.serviceOrder,
        title: { contains: pagination.search, mode: 'insensitive' },
      };
    }

    const orderBy = buildOrderBy(pagination?.sortBy, pagination?.sortOrder, LEDGER_SORTABLE, { confirmedAt: 'desc' });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceOrderLedger.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          serviceOrder: { select: { id: true, title: true, status: true } },
        },
      }),
      this.prisma.serviceOrderLedger.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async simulate(serviceOrderId: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { company: true, ledger: true },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId) throw new ForbiddenException('Acesso negado');
    if (so.ledger) throw new BadRequestException('Repasse já calculado');

    const gross = so.valueCents;
    const bps = so.company.commissionBps;
    const commission = Math.round((gross * bps) / 10000);
    const net = gross - commission;

    return { grossCents: gross, commissionBps: bps, commissionCents: commission, netCents: net };
  }

  async confirm(serviceOrderId: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { company: true, ledger: true },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId) throw new ForbiddenException('Acesso negado');
    if (so.ledger) throw new BadRequestException('Repasse já confirmado');

    const gross = so.valueCents;
    const bps = so.company.commissionBps;
    const commission = Math.round((gross * bps) / 10000);
    const net = gross - commission;

    return this.prisma.$transaction(async (tx) => {
      const ledger = await tx.serviceOrderLedger.create({
        data: {
          serviceOrderId,
          grossCents: gross,
          commissionBps: bps,
          commissionCents: commission,
          netCents: net,
          confirmedAt: new Date(),
        },
      });

      // v1.00.17: Also create FinancialEntry (PAYABLE) for AP/AR tracking
      await tx.financialEntry.create({
        data: {
          companyId,
          serviceOrderId,
          partnerId: so.assignedPartnerId,
          type: 'PAYABLE',
          status: 'CONFIRMED',
          grossCents: gross,
          commissionBps: bps,
          commissionCents: commission,
          netCents: net,
          confirmedAt: new Date(),
          description: `Repasse OS: ${so.title}`,
        },
      });

      return ledger;
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     v1.00.17 — FinancialEntry (Contas a Receber / Pagar)
     ═══════════════════════════════════════════════════════════════ */

  async summaryV2(companyId: string) {
    const entries = await this.prisma.financialEntry.findMany({
      where: { companyId, deletedAt: null },
      select: { type: true, status: true, grossCents: true, netCents: true },
    });

    const calc = (type: string) => {
      const items = entries.filter(e => e.type === type);
      const byStatus = (s: string) => items.filter(e => e.status === s);
      return {
        pendingCents: byStatus('PENDING').reduce((s, e) => s + e.netCents, 0),
        confirmedCents: byStatus('CONFIRMED').reduce((s, e) => s + e.netCents, 0),
        paidCents: byStatus('PAID').reduce((s, e) => s + e.netCents, 0),
        pendingCount: byStatus('PENDING').length,
        confirmedCount: byStatus('CONFIRMED').length,
        paidCount: byStatus('PAID').length,
      };
    };

    const receivables = calc('RECEIVABLE');
    const payables = calc('PAYABLE');

    return {
      receivables,
      payables,
      balanceCents: receivables.paidCents - payables.paidCents,
    };
  }

  async createEntry(data: CreateFinancialEntryDto, companyId: string) {
    // Validate serviceOrder belongs to company
    if (data.serviceOrderId) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: data.serviceOrderId, companyId, deletedAt: null },
      });
      if (!so) throw new NotFoundException('OS não encontrada');
    }

    // Validate partner belongs to company
    if (data.partnerId) {
      const partner = await this.prisma.partner.findFirst({
        where: { id: data.partnerId, companyId, deletedAt: null },
      });
      if (!partner) throw new NotFoundException('Parceiro não encontrado');
    }

    // Calculate commission for PAYABLE
    let commissionBps = data.commissionBps ?? null;
    let commissionCents: number | null = null;
    let netCents = data.grossCents;

    if (data.type === 'PAYABLE' && commissionBps != null) {
      commissionCents = Math.round((data.grossCents * commissionBps) / 10000);
      netCents = data.grossCents - commissionCents;
    }

    const entry = await this.prisma.financialEntry.create({
      data: {
        companyId,
        serviceOrderId: data.serviceOrderId || undefined,
        partnerId: data.partnerId || undefined,
        type: data.type,
        description: data.description,
        grossCents: data.grossCents,
        commissionBps,
        commissionCents,
        netCents,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
      },
      include: {
        serviceOrder: { select: { id: true, title: true, status: true } },
        partner: { select: { id: true, name: true } },
      },
    });

    // Auto-emit NFS-e if configured and entry is RECEIVABLE
    if (data.type === 'RECEIVABLE') {
      this.tryAutoEmitNfse(companyId, entry.id, entry.grossCents).catch((err) => {
        this.logger.warn(`Auto-emissão NFS-e falhou para entry ${entry.id}: ${err.message}`);
      });
    }

    return entry;
  }

  /**
   * Checks if auto-emission is enabled and triggers NFS-e emission.
   * Runs async (fire-and-forget) — errors are logged, not thrown.
   */
  private async tryAutoEmitNfse(companyId: string, entryId: string, grossCents: number) {
    const [company, config] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { fiscalEnabled: true } }),
      this.prisma.nfseConfig.findUnique({ where: { companyId } }),
    ]);

    if (!company?.fiscalEnabled || !config?.autoEmitOnEntry || !config.focusNfeToken) return;

    // Fetch entry with partner data for tomador
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId },
      include: {
        partner: true,
        serviceOrder: { include: { clientPartner: true } },
      },
    });
    if (!entry) return;

    const tomador = entry.serviceOrder?.clientPartner || entry.partner;

    // Build discriminacao from template
    let discriminacao = config.defaultDiscriminacao || entry.description || '';
    if (entry.serviceOrder) {
      discriminacao = discriminacao
        .replace('{titulo_os}', entry.serviceOrder.title || '')
        .replace('{descricao_os}', entry.serviceOrder.description || '');
    }

    await this.nfseService.emit(companyId, {
      financialEntryId: entryId,
      serviceOrderId: entry.serviceOrderId || undefined,
      tomadorCnpjCpf: tomador?.document || undefined,
      tomadorRazaoSocial: tomador?.name || undefined,
      tomadorEmail: tomador?.email || undefined,
      valorServicosCents: grossCents,
      aliquotaIss: config.aliquotaIss || undefined,
      issRetido: false,
      itemListaServico: config.itemListaServico || undefined,
      codigoCnae: config.codigoCnae || undefined,
      codigoTributarioMunicipio: config.codigoTributarioMunicipio || undefined,
      discriminacao,
      naturezaOperacao: config.naturezaOperacao || undefined,
      codigoMunicipioServico: config.codigoMunicipio || undefined,
    });

    this.logger.log(`Auto-emissão NFS-e disparada para entry ${entryId}`);
  }

  async findEntries(
    companyId: string,
    type: 'RECEIVABLE' | 'PAYABLE',
    pagination?: PaginationDto,
    filters?: { status?: string; dateFrom?: string; dateTo?: string; partnerId?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, type, deletedAt: null };

    if (filters?.status) {
      where.status = filters.status;
    } else {
      // By default, exclude CANCELLED entries — user must explicitly filter by CANCELLED
      where.status = { not: 'CANCELLED' };
    }
    if (filters?.partnerId) where.partnerId = filters.partnerId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (pagination?.search) {
      where.OR = [
        { description: { contains: pagination.search, mode: 'insensitive' } },
        { serviceOrder: { title: { contains: pagination.search, mode: 'insensitive' } } },
        { partner: { name: { contains: pagination.search, mode: 'insensitive' } } },
      ];
    }

    const orderBy = buildOrderBy(pagination?.sortBy, pagination?.sortOrder, ENTRY_SORTABLE, { createdAt: 'desc' });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financialEntry.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          serviceOrder: { select: { id: true, title: true, status: true } },
          partner: { select: { id: true, name: true } },
        },
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneEntry(id: string, companyId: string) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        serviceOrder: { select: { id: true, title: true, status: true } },
        partner: { select: { id: true, name: true } },
      },
    });
    if (!entry) throw new NotFoundException('Entrada financeira não encontrada');
    return entry;
  }

  async changeEntryStatus(id: string, companyId: string, dto: ChangeEntryStatusDto) {
    const entry = await this.findOneEntry(id, companyId);

    // State machine validation
    const { status: currentStatus } = entry;
    const { status: newStatus, notes } = dto;

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PAID', 'CANCELLED'],
      PAID: [],       // terminal
      CANCELLED: [],  // terminal
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Transição de ${currentStatus} para ${newStatus} não é permitida`,
      );
    }

    const data: any = { status: newStatus };
    if (notes) data.notes = notes;
    if (newStatus === 'CONFIRMED') data.confirmedAt = new Date();
    if (newStatus === 'PAID') {
      data.paidAt = new Date();
      if (dto.paymentMethod) data.paymentMethod = dto.paymentMethod;
      if (dto.cardBrand) data.cardBrand = dto.cardBrand;
      if (dto.cashAccountId) data.cashAccountId = dto.cashAccountId;
    }
    if (newStatus === 'CANCELLED') {
      data.cancelledAt = new Date();
      if (dto.cancelledReason) data.cancelledReason = dto.cancelledReason;
      if (dto.cancelledByName) data.cancelledByName = dto.cancelledByName;
    }

    // Update entry + cash account atomically
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.financialEntry.update({
        where: { id },
        data,
        include: {
          serviceOrder: { select: { id: true, title: true, status: true } },
          partner: { select: { id: true, name: true } },
        },
      });

      // Adjust cash account balance when PAID and cashAccountId is provided
      if (newStatus === 'PAID' && dto.cashAccountId) {
        // Check if payment method has fee/delay (card payment)
        let isCardWithDelay = false;
        let pm: any = null;

        if (dto.paymentMethod) {
          pm = await tx.paymentMethod.findFirst({
            where: { companyId, code: dto.paymentMethod, deletedAt: null },
          });
          if (pm && ((pm.feePercent && pm.feePercent > 0) || (pm.receivingDays && pm.receivingDays > 0))) {
            isCardWithDelay = true;
          }
        }

        if (isCardWithDelay) {
          // Card payment: create settlement record, do NOT update cash account now
          await this.cardSettlementService.createFromEntry(tx, {
            id: entry.id,
            companyId,
            netCents: entry.netCents,
            paidAt: data.paidAt,
          }, {
            code: pm.code,
            feePercent: pm.feePercent || 0,
            receivingDays: pm.receivingDays || 0,
            cardBrand: dto.cardBrand,
          });
          this.logger.log(`Card settlement created for entry ${entry.id}, method=${pm.code}, fee=${pm.feePercent}%, days=${pm.receivingDays}`);
        } else {
          // Immediate payment (PIX, Dinheiro, etc.): update cash account now
          const deltaCents = entry.type === 'RECEIVABLE' ? entry.netCents : -entry.netCents;
          await tx.cashAccount.update({
            where: { id: dto.cashAccountId },
            data: { currentBalanceCents: { increment: deltaCents } },
          });
        }
      }

      return updated;
    });
  }

  async deleteEntry(id: string, companyId: string) {
    await this.findOneEntry(id, companyId);
    return this.prisma.financialEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     v2.00 — Renegotiation
     ═══════════════════════════════════════════════════════════════ */

  async renegotiate(id: string, companyId: string, dto: RenegotiateDto) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { installments: true },
    });
    if (!entry) throw new NotFoundException('Lancamento nao encontrado');

    if (entry.status === 'PAID' || entry.status === 'CANCELLED') {
      throw new BadRequestException('Lancamento com status terminal nao pode ser renegociado');
    }

    // Calculate remaining balance from unpaid installments, or use full netCents
    let remainingCents: number;
    if (entry.installments.length > 0) {
      remainingCents = entry.installments
        .filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED')
        .reduce((sum, i) => sum + i.totalCents, 0);
    } else {
      remainingCents = entry.netCents;
    }

    const newAmountCents = dto.newAmountCents ?? remainingCents;

    // Use a transaction to: cancel old installments, mark old entry, create new entry + installments
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cancel all pending/overdue installments on old entry
      if (entry.installments.length > 0) {
        await tx.financialInstallment.updateMany({
          where: {
            financialEntryId: id,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          data: { status: 'RENEGOTIATED' },
        });
      }

      // 2. Mark old entry as renegotiated
      await tx.financialEntry.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          renegotiatedAt: new Date(),
          cancelledAt: new Date(),
          notes: dto.notes
            ? `${entry.notes ? entry.notes + ' | ' : ''}Renegociado: ${dto.notes}`
            : entry.notes,
        },
      });

      // 3. Create new financial entry
      const newEntry = await tx.financialEntry.create({
        data: {
          companyId,
          serviceOrderId: entry.serviceOrderId,
          partnerId: entry.partnerId,
          type: entry.type,
          description: `Renegociacao de: ${entry.description || entry.id}`,
          grossCents: newAmountCents,
          commissionBps: entry.commissionBps,
          commissionCents: entry.commissionCents
            ? Math.round((newAmountCents * (entry.commissionBps ?? 0)) / 10000)
            : null,
          netCents: entry.commissionBps
            ? newAmountCents - Math.round((newAmountCents * (entry.commissionBps ?? 0)) / 10000)
            : newAmountCents,
          dueDate: dto.firstDueDate ? new Date(dto.firstDueDate) : entry.dueDate,
          notes: dto.notes,
          parentEntryId: id,
          installmentCount: dto.installmentCount ?? null,
          interestType: dto.interestType ?? entry.interestType,
          interestRateMonthly: dto.interestRateMonthly ?? entry.interestRateMonthly,
          penaltyPercent: dto.penaltyPercent ?? entry.penaltyPercent,
          penaltyFixedCents: dto.penaltyFixedCents ?? entry.penaltyFixedCents,
        },
      });

      // 4. Link old entry to new one
      await tx.financialEntry.update({
        where: { id },
        data: { renegotiatedToId: newEntry.id },
      });

      // 5. Generate installments for new entry if requested
      if (dto.installmentCount && dto.installmentCount >= 2 && dto.firstDueDate) {
        const intervalDays = dto.intervalDays ?? 30;
        const count = dto.installmentCount;
        const baseAmount = Math.floor(newEntry.netCents / count);
        const remainder = newEntry.netCents - (baseAmount * count);
        const firstDue = new Date(dto.firstDueDate);

        for (let i = 0; i < count; i++) {
          const dueDate = new Date(firstDue);
          dueDate.setDate(dueDate.getDate() + (i * intervalDays));

          const amountCents = i === count - 1 ? baseAmount + remainder : baseAmount;

          await tx.financialInstallment.create({
            data: {
              financialEntryId: newEntry.id,
              installmentNumber: i + 1,
              dueDate,
              amountCents,
              interestCents: 0,
              penaltyCents: 0,
              discountCents: 0,
              totalCents: amountCents,
              status: 'PENDING',
            },
          });
        }
      }

      return newEntry;
    });

    // Return the new entry with relations
    return this.prisma.financialEntry.findFirst({
      where: { id: result.id },
      include: {
        serviceOrder: { select: { id: true, title: true, status: true } },
        partner: { select: { id: true, name: true } },
        installments: { orderBy: { installmentNumber: 'asc' } },
        parentEntry: { select: { id: true, description: true, grossCents: true, netCents: true } },
      },
    });
  }
}
