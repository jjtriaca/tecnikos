import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto, ChangeEntryStatusDto } from './dto/financial-entry.dto';
import { RenegotiateDto } from './dto/renegotiate.dto';
import { NfseEmissionService } from '../nfse-emission/nfse-emission.service';
import { CardSettlementService } from './card-settlement.service';
import { FinancialReportService } from './financial-report.service';
import { CashAccountService } from './cash-account.service';
import { InstallmentService } from './installment.service';

const LEDGER_SORTABLE = ['grossCents', 'commissionCents', 'netCents', 'confirmedAt'];
const ENTRY_SORTABLE = ['grossCents', 'netCents', 'dueDate', 'createdAt', 'status', 'confirmedAt'];

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
    @Inject(forwardRef(() => NfseEmissionService))
    private readonly nfseService: NfseEmissionService,
    private readonly cardSettlementService: CardSettlementService,
    private readonly reportService: FinancialReportService,
    private readonly cashAccountService: CashAccountService,
    private readonly installmentService: InstallmentService,
  ) {}

  /* ═══════════════════════════════════════════════════════════════
     LEGACY — ServiceOrderLedger (backward compat, v1.00.16)
     ═══════════════════════════════════════════════════════════════ */

  async summary(companyId: string) {
    const ledgers = await this.prisma.serviceOrderLedger.findMany({
      where: { serviceOrder: { companyId, deletedAt: null } },
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
        deletedAt: null,
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

    const where: any = { serviceOrder: { companyId, deletedAt: null } };
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

    // Auto-generate sequential code
    const code = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');

    const entry = await this.prisma.financialEntry.create({
      data: {
        companyId,
        code,
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
        financialAccountId: data.financialAccountId || undefined,
      },
      include: {
        serviceOrder: { select: { id: true, title: true, status: true } },
        partner: { select: { id: true, name: true } },
        financialAccount: { select: { id: true, code: true, name: true } },
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
          financialAccount: { select: { id: true, code: true, name: true } },
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
        financialAccount: { select: { id: true, code: true, name: true } },
      },
    });
    if (!entry) throw new NotFoundException('Entrada financeira não encontrada');
    return entry;
  }

  async updateEntry(id: string, companyId: string, dto: UpdateFinancialEntryDto) {
    const entry = await this.findOneEntry(id, companyId);

    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;
    if (dto.financialAccountId !== undefined) data.financialAccountId = dto.financialAccountId || null;
    if (dto.partnerId !== undefined) data.partnerId = dto.partnerId;
    if (dto.grossCents !== undefined) {
      data.grossCents = dto.grossCents;
      data.netCents = dto.grossCents - (entry.commissionCents || 0);
    }
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    return this.prisma.financialEntry.update({
      where: { id },
      data,
      include: {
        partner: { select: { id: true, name: true } },
        financialAccount: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async changeEntryStatus(id: string, companyId: string, dto: ChangeEntryStatusDto) {
    const entry = await this.findOneEntry(id, companyId);

    // State machine validation
    const { status: currentStatus } = entry;
    const { status: newStatus, notes } = dto;

    // REVERSED is an alias — transitions to CONFIRMED while reversing side effects
    const isReversal = newStatus === 'REVERSED';

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PAID', 'CANCELLED'],
      PAID: ['REVERSED'],  // estorno
      CANCELLED: [],       // terminal
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Transição de ${currentStatus} para ${newStatus} não é permitida`,
      );
    }

    const data: any = {};
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    if (isReversal) {
      // Reversal: go back to CONFIRMED, clear payment fields
      data.status = 'CONFIRMED';
      data.paidAt = null;
      data.paymentMethod = null;
      data.cardBrand = null;
      data.cashAccountId = null;
      data.paymentInstrumentId = null;
      // Append reversal log to notes
      const who = dto.cancelledByName || 'Sistema';
      const logLine = `[${timestamp}] ESTORNO por ${who}: ${notes || 'sem motivo'}`;
      data.notes = entry.notes ? `${entry.notes}\n${logLine}` : logLine;
    } else {
      data.status = newStatus;
      if (newStatus === 'CONFIRMED') data.confirmedAt = now;
      if (newStatus === 'PAID') {
        data.paidAt = now;
        if (dto.paymentMethod) data.paymentMethod = dto.paymentMethod;
        if (dto.cardBrand) data.cardBrand = dto.cardBrand;
        if (dto.cashAccountId) data.cashAccountId = dto.cashAccountId;
        if (dto.paymentInstrumentId) data.paymentInstrumentId = dto.paymentInstrumentId;
        // Append payment log to notes
        const payLog = `[${timestamp}] RECEBIDO via ${dto.paymentMethod || 'N/A'}`;
        data.notes = entry.notes ? `${entry.notes}\n${payLog}` : payLog;
      }
      if (newStatus === 'CANCELLED') {
        data.cancelledAt = now;
        if (dto.cancelledReason) data.cancelledReason = dto.cancelledReason;
        if (dto.cancelledByName) data.cancelledByName = dto.cancelledByName;
      }
      if (notes && newStatus !== 'PAID') data.notes = notes;
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

      // Reversal: undo all side effects (card settlements, cash accounts, fee expenses)
      if (isReversal) {
        // 1. Find ALL card settlements for this entry (any status)
        const cardSettlements = await tx.cardSettlement.findMany({
          where: { financialEntryId: id },
        });

        for (const cs of cardSettlements) {
          // If card settlement was already settled, reverse the cash account balance
          if (cs.status === 'SETTLED' && cs.cashAccountId && cs.actualAmountCents) {
            await tx.cashAccount.update({
              where: { id: cs.cashAccountId },
              data: { currentBalanceCents: { increment: -cs.actualAmountCents } },
            });
            this.logger.log(`Cash account ${cs.cashAccountId} reversed by -${cs.actualAmountCents} for settled card ${cs.id}`);
          }

          // Delete the card settlement entirely
          await tx.cardSettlement.delete({ where: { id: cs.id } });
          this.logger.log(`Card settlement ${cs.id} deleted due to reversal of entry ${id}`);
        }

        // 2. Delete any auto-generated fee expense entries for this card payment
        if (cardSettlements.length > 0) {
          const deleted = await tx.financialEntry.deleteMany({
            where: {
              companyId: entry.companyId,
              type: 'PAYABLE',
              description: { startsWith: 'Taxa cartão' },
              notes: { contains: id },
            },
          });
          if (deleted.count > 0) {
            this.logger.log(`Deleted ${deleted.count} fee expense entries for reversed card payment ${id}`);
          }
        }

        // 3. If it was a direct (non-card) payment with cashAccountId, reverse cash account
        if (entry.cashAccountId && cardSettlements.length === 0) {
          const deltaCents = entry.type === 'RECEIVABLE' ? -entry.netCents : entry.netCents;
          await tx.cashAccount.update({
            where: { id: entry.cashAccountId },
            data: { currentBalanceCents: { increment: deltaCents } },
          });
          this.logger.log(`Cash account ${entry.cashAccountId} reversed by ${deltaCents} cents for entry ${id}`);
        }

        return updated;
      }

      // Handle PAID status: create card settlement or update cash account
      if (newStatus === 'PAID') {
        let isCardPayment = false;
        let pm: any = null;

        if (dto.paymentMethod) {
          pm = await tx.paymentMethod.findFirst({
            where: { companyId, code: dto.paymentMethod, deletedAt: null },
          });
          if (pm && pm.requiresBrand) {
            isCardPayment = true;
          }
        }

        if (isCardPayment) {
          // Card payment: create card settlement (cash account updated at settle time)
          let feePercent = pm.feePercent || 0;
          let receivingDays = pm.receivingDays || 0;
          let cardBrand = dto.cardBrand;

          // If a specific card fee rate was selected, use its values
          if (dto.cardFeeRateId) {
            const cardRate = await tx.cardFeeRate.findFirst({
              where: { id: dto.cardFeeRateId, companyId, isActive: true },
            });
            if (cardRate) {
              feePercent = cardRate.feePercent;
              receivingDays = cardRate.receivingDays;
              cardBrand = cardRate.brand;
              this.logger.log(`Using CardFeeRate ${cardRate.id}: brand=${cardRate.brand}, fee=${cardRate.feePercent}%, days=${cardRate.receivingDays}`);
            }
          }

          await this.cardSettlementService.createFromEntry(tx, {
            id: entry.id,
            companyId,
            netCents: entry.netCents,
            paidAt: data.paidAt,
          }, {
            code: pm.code,
            feePercent,
            receivingDays,
            cardBrand,
            cardFeeRateId: dto.cardFeeRateId,
          });
          this.logger.log(`Card settlement created for entry ${entry.id}, method=${pm.code}, fee=${feePercent}%, days=${receivingDays}`);
        } else if (dto.cashAccountId) {
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

  /* ═══════════════════════════════════════════════════════════════
     Dashboard Financeiro — Agregação para o dashboard
     ═══════════════════════════════════════════════════════════════ */

  async dashboardSummary(companyId: string, dateFrom: string, dateTo: string) {
    const startDate = new Date(dateFrom);
    const endDate = new Date(`${dateTo}T23:59:59.999Z`);

    const [dre, cashFlow, cashAccounts, overdue, cardSettlements] = await Promise.all([
      this.reportService.generateDre(companyId, dateFrom, dateTo),
      this.getDailyCashFlow(companyId, startDate, endDate),
      this.cashAccountService.findActive(companyId),
      this.installmentService.getOverdueAgingReport(companyId),
      this.cardSettlementService.summary(companyId),
    ]);

    // Extract top 5 revenue accounts from DRE
    const topAccounts: { code: string; name: string; totalCents: number; percentage: number }[] = [];
    const totalRevenue = dre.revenue.totalCents || 1;
    for (const group of dre.revenue.groups) {
      if (group.children.length > 0) {
        for (const child of group.children) {
          topAccounts.push({
            code: child.code,
            name: child.name,
            totalCents: child.totalCents,
            percentage: Math.round((child.totalCents / totalRevenue) * 10000) / 100,
          });
        }
      } else {
        topAccounts.push({
          code: group.code,
          name: group.name,
          totalCents: group.totalCents,
          percentage: Math.round((group.totalCents / totalRevenue) * 10000) / 100,
        });
      }
    }
    topAccounts.sort((a, b) => b.totalCents - a.totalCents);

    // Period-filtered summary (receivables/payables)
    const periodEntries = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        dueDate: { gte: startDate, lte: endDate },
      },
      select: { type: true, status: true, grossCents: true, netCents: true },
    });

    const buildSummary = (type: string) => {
      const items = periodEntries.filter(e => e.type === type);
      const byStatus = (s: string) => items.filter(e => e.status === s);
      return {
        pendingCents: byStatus('PENDING').reduce((sum, e) => sum + e.netCents, 0),
        confirmedCents: byStatus('CONFIRMED').reduce((sum, e) => sum + e.netCents, 0),
        paidCents: byStatus('PAID').reduce((sum, e) => sum + e.netCents, 0),
        pendingCount: byStatus('PENDING').length,
        confirmedCount: byStatus('CONFIRMED').length,
        paidCount: byStatus('PAID').length,
        totalCents: items.reduce((sum, e) => sum + e.netCents, 0),
        totalCount: items.length,
      };
    };

    return {
      dre: {
        revenue: dre.revenue,
        costs: dre.costs,
        expenses: dre.expenses,
        grossProfitCents: dre.grossProfitCents,
        netResultCents: dre.netResultCents,
      },
      summary: {
        receivables: buildSummary('RECEIVABLE'),
        payables: buildSummary('PAYABLE'),
      },
      cashFlow,
      cashAccounts,
      overdue,
      topAccounts: topAccounts.slice(0, 5),
      cardSettlements,
    };
  }

  private async getDailyCashFlow(companyId: string, startDate: Date, endDate: Date) {
    const rows: { date: string; receivableCents: string; payableCents: string }[] = await this.prisma.$queryRaw`
      SELECT
        TO_CHAR(fe."paidAt", 'YYYY-MM-DD') as date,
        COALESCE(SUM(CASE WHEN fe.type = 'RECEIVABLE' THEN fe."netCents" ELSE 0 END), 0)::TEXT as "receivableCents",
        COALESCE(SUM(CASE WHEN fe.type = 'PAYABLE' THEN fe."netCents" ELSE 0 END), 0)::TEXT as "payableCents"
      FROM "FinancialEntry" fe
      WHERE fe."companyId" = ${companyId}
        AND fe."deletedAt" IS NULL
        AND fe.status = 'PAID'
        AND fe."paidAt" >= ${startDate}
        AND fe."paidAt" <= ${endDate}
      GROUP BY TO_CHAR(fe."paidAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `;

    return rows.map(r => ({
      date: r.date,
      receivableCents: Number(r.receivableCents),
      payableCents: Number(r.payableCents),
    }));
  }
}
