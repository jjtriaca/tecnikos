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
const ENTRY_SORTABLE = ['grossCents', 'netCents', 'dueDate', 'createdAt', 'status', 'confirmedAt', 'paidAt'];

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
      const words = pagination.search.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        where.serviceOrder = {
          ...where.serviceOrder,
          title: { contains: pagination.search, mode: 'insensitive' },
        };
      } else {
        where.AND = words.map((word) => ({
          serviceOrder: { title: { contains: word, mode: 'insensitive' } },
        }));
      }
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
      include: { ledger: true },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId) throw new ForbiddenException('Acesso negado');
    if (so.ledger) throw new BadRequestException('Repasse já calculado');

    const gross = so.valueCents;
    const bps = so.commissionBps ?? 0;
    const commission = Math.round((gross * bps) / 10000);
    const net = gross - commission;

    return { grossCents: gross, commissionBps: bps, commissionCents: commission, netCents: net };
  }

  async confirm(serviceOrderId: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { ledger: true },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId) throw new ForbiddenException('Acesso negado');
    if (so.ledger) throw new BadRequestException('Repasse já confirmado');

    const gross = so.valueCents;
    const bps = so.commissionBps ?? 0;
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

    // Decide se entry nasce PAID (autoMarkPaid) — olha primeiro pelo PaymentInstrument
    // informado. Se veio apenas paymentMethod (code, ex: "DINHEIRO"), busca um Instrument
    // ativo da empresa com esse code — assim wizards que usam codigo genérico
    // (ex: import NFe) respeitam a flag do instrumento padrao.
    let autoPaidStatus: 'PAID' | undefined;
    let autoPaidCashAccountId: string | null | undefined;
    let autoPaidPaidAt: Date | undefined;
    let autoPaidFlag = false;
    let resolvedInstrumentId: string | null = data.paymentInstrumentId || null;

    if (!resolvedInstrumentId && data.paymentMethod) {
      // Procura o PaymentMethod + Instrument padrao da empresa pra esse code
      const pm = await this.prisma.paymentMethod.findFirst({
        where: { companyId, code: data.paymentMethod, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (pm) {
        const defaultInstrument = await this.prisma.paymentInstrument.findFirst({
          where: { companyId, paymentMethodId: pm.id, deletedAt: null, isActive: true },
          orderBy: [{ autoMarkPaid: 'desc' }, { sortOrder: 'asc' }],
          select: { id: true, autoMarkPaid: true, cashAccountId: true },
        });
        if (defaultInstrument) {
          resolvedInstrumentId = defaultInstrument.id;
          if (defaultInstrument.autoMarkPaid) {
            autoPaidStatus = 'PAID';
            autoPaidCashAccountId = defaultInstrument.cashAccountId;
            autoPaidPaidAt = new Date();
            autoPaidFlag = true;
          }
        }
      }
    } else if (resolvedInstrumentId) {
      const instrument = await this.prisma.paymentInstrument.findFirst({
        where: { id: resolvedInstrumentId, companyId, deletedAt: null, isActive: true },
        select: { id: true, autoMarkPaid: true, cashAccountId: true },
      });
      if (instrument?.autoMarkPaid) {
        autoPaidStatus = 'PAID';
        autoPaidCashAccountId = instrument.cashAccountId;
        autoPaidPaidAt = new Date();
        autoPaidFlag = true;
      }
    }

    // Fallback: se autoMarkPaid=true mas instrumento nao tem conta vinculada E dto tambem nao passou,
    // usa a conta de TRANSITO (padrao system-wide). UI oferece a opcao "Nenhuma conta -> Valores em Transito",
    // entao precisamos garantir que o saldo nao fique orfao.
    if (autoPaidFlag && !autoPaidCashAccountId && !data.cashAccountId) {
      const transitAccount = await this.prisma.cashAccount.findFirst({
        where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
        select: { id: true },
      });
      if (transitAccount) {
        autoPaidCashAccountId = transitAccount.id;
        this.logger.log(`Entry ${code}: autoMarkPaid sem conta vinculada -> fallback TRANSITO (${transitAccount.id})`);
      }
    }

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
        paymentMethod: data.paymentMethod || undefined,
        paymentInstrumentId: resolvedInstrumentId || undefined,
        receivedCardLast4: data.receivedCardLast4 || undefined,
        cashAccountId: (data.cashAccountId ?? autoPaidCashAccountId) || undefined,
        ...(autoPaidStatus && {
          status: autoPaidStatus,
          paidAt: autoPaidPaidAt,
          autoMarkedPaid: autoPaidFlag,
        }),
      },
      include: {
        serviceOrder: { select: { id: true, title: true, status: true } },
        partner: { select: { id: true, name: true } },
        financialAccount: { select: { id: true, code: true, name: true } },
      },
    });

    // Atualiza saldo da conta se auto-pay + tem cashAccount
    if (autoPaidFlag && autoPaidCashAccountId) {
      const delta = data.type === 'RECEIVABLE' ? netCents : -netCents;
      await this.prisma.cashAccount.update({
        where: { id: autoPaidCashAccountId },
        data: { currentBalanceCents: { increment: delta } },
      });
    }

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
    filters?: { status?: string; dateFrom?: string; dateTo?: string; dateType?: string; partnerId?: string; nfseStatus?: string; excludeMatched?: boolean; matchableForCashAccountId?: string },
  ): Promise<PaginatedResult<any> & { totals?: { sumNetCents: number; sumGrossCents: number } }> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, type, deletedAt: null };

    if (filters?.status === 'OVERDUE') {
      // Vencidas: pendentes com data de vencimento no passado
      where.status = 'PENDING';
      where.dueDate = { lt: new Date() };
    } else if (filters?.status) {
      where.status = filters.status;
    } else {
      // By default, exclude CANCELLED entries — user must explicitly filter by CANCELLED
      where.status = { not: 'CANCELLED' };
    }
    if (filters?.partnerId) where.partnerId = filters.partnerId;
    if (filters?.nfseStatus) {
      if (filters.nfseStatus === 'NOT_ISSUED') {
        where.nfseStatus = null;
      } else {
        where.nfseStatus = filters.nfseStatus;
      }
    }
    if (filters?.dateFrom || filters?.dateTo) {
      // dateType: 'created' (default) | 'paid' | 'due'
      const dateField = filters?.dateType === 'paid' ? 'paidAt' : filters?.dateType === 'due' ? 'dueDate' : 'createdAt';
      where[dateField] = {};
      if (filters.dateFrom) where[dateField].gte = new Date(filters.dateFrom);
      if (filters.dateTo) where[dateField].lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }

    // Filtro por conta compativel com a linha do extrato sendo conciliada.
    // Exclui entries pagos em DINHEIRO (conta tipo CAIXA) ou em outro banco.
    // Aceita entries: (a) sem cashAccount (PENDING), (b) no banco da linha, (c) em conta TRANSITO.
    if (filters?.matchableForCashAccountId) {
      const targetAccount = await this.prisma.cashAccount.findUnique({
        where: { id: filters.matchableForCashAccountId },
        select: { id: true, type: true },
      });
      if (targetAccount) {
        // IDs de todas as contas tipo TRANSITO da empresa (candidatas validas)
        const transitAccounts = await this.prisma.cashAccount.findMany({
          where: { companyId, type: 'TRANSITO', deletedAt: null },
          select: { id: true },
        });
        const validAccountIds = [targetAccount.id, ...transitAccounts.map((a) => a.id)];
        where.OR = [
          { cashAccountId: null },
          { cashAccountId: { in: validAccountIds } },
        ];
      }
    }

    // Exclui entries ja conciliados com o extrato:
    //  - Ligados diretamente a uma BankStatementLine (matchedEntryId)
    //  - Agrupados em uma fatura de cartao (invoiceMatchLineId)
    // Usado pelo ConciliationModal pra nao mostrar candidatos ja casados.
    if (filters?.excludeMatched) {
      const matchedLines = await this.prisma.bankStatementLine.findMany({
        where: { status: 'MATCHED', matchedEntryId: { not: null } },
        select: { matchedEntryId: true },
      });
      const matchedEntryIds = Array.from(new Set(
        matchedLines.map((l) => l.matchedEntryId!).filter(Boolean),
      ));
      where.invoiceMatchLineId = null;
      if (matchedEntryIds.length > 0) {
        where.id = { notIn: matchedEntryIds };
      }
    }
    if (pagination?.search) {
      const words = pagination.search.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        where.OR = [
          { description: { contains: pagination.search, mode: 'insensitive' } },
          { serviceOrder: { title: { contains: pagination.search, mode: 'insensitive' } } },
          { partner: { name: { contains: pagination.search, mode: 'insensitive' } } },
        ];
      } else {
        where.AND = words.map((word) => ({
          OR: [
            { description: { contains: word, mode: 'insensitive' } },
            { serviceOrder: { title: { contains: word, mode: 'insensitive' } } },
            { partner: { name: { contains: word, mode: 'insensitive' } } },
          ],
        }));
      }
    }

    const orderBy = buildOrderBy(pagination?.sortBy, pagination?.sortOrder, ENTRY_SORTABLE, { createdAt: 'desc' });

    const [data, total, agg] = await this.prisma.$transaction([
      this.prisma.financialEntry.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          serviceOrder: { select: { id: true, title: true, status: true } },
          partner: { select: { id: true, name: true } },
          financialAccount: { select: { id: true, code: true, name: true } },
          parentEntry: { select: { id: true, nfseStatus: true, nfseEmissionId: true } },
          cashAccountRef: { select: { id: true, name: true, type: true } },
          paymentInstrumentRef: {
            select: {
              id: true,
              name: true,
              cardLast4: true,
              cardBrand: true,
              paymentMethod: { select: { code: true, name: true, requiresBrand: true } },
            },
          },
        },
      }),
      this.prisma.financialEntry.count({ where }),
      this.prisma.financialEntry.aggregate({
        where,
        _sum: { netCents: true, grossCents: true },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      totals: {
        sumNetCents: agg._sum.netCents || 0,
        sumGrossCents: agg._sum.grossCents || 0,
      },
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

  /* ═══════════════════════════════════════════════════════════════════
     batchPay — Pay multiple entries at once
     ═══════════════════════════════════════════════════════════════════ */

  async batchPay(
    companyId: string,
    body: {
      entryIds: string[];
      paymentMethod: string;
      paidAt?: string;
      cashAccountId?: string;
      paymentInstrumentId?: string;
    },
  ) {
    if (!body.entryIds?.length) throw new BadRequestException('Nenhuma entrada selecionada');
    if (!body.paymentMethod) throw new BadRequestException('Forma de pagamento obrigatoria');

    const batchId = `BATCH_${Date.now().toString(36)}`;
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let totalPaidCents = 0;
    let paidCount = 0;
    const errors: string[] = [];

    for (const entryId of body.entryIds) {
      try {
        await this.changeEntryStatus(entryId, companyId, {
          status: 'PAID',
          paymentMethod: body.paymentMethod,
          paidAt: body.paidAt,
          cashAccountId: body.cashAccountId,
          paymentInstrumentId: body.paymentInstrumentId,
        } as ChangeEntryStatusDto);

        // Set batchPaymentId
        const entry = await this.prisma.financialEntry.update({
          where: { id: entryId },
          data: { batchPaymentId: batchId },
        });
        totalPaidCents += entry.netCents;
        paidCount++;
      } catch (err: any) {
        errors.push(`${entryId}: ${err.message || 'Erro desconhecido'}`);
      }
    }

    return {
      batchId,
      paidCount,
      totalPaidCents,
      totalRequested: body.entryIds.length,
      errors,
    };
  }

  async changeEntryStatus(id: string, companyId: string, dto: ChangeEntryStatusDto) {
    const entry = await this.findOneEntry(id, companyId);

    // State machine validation
    const { status: currentStatus } = entry;
    const { status: newStatus, notes } = dto;

    // REVERSED is an alias — transitions to PENDING while reversing side effects
    const isReversal = newStatus === 'REVERSED';

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['PAID', 'CANCELLED'],
      CONFIRMED: ['PAID', 'CANCELLED'],  // backward-compat for legacy entries
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
      // Reversal: go back to PENDING, clear payment fields
      data.status = 'PENDING';
      data.paidAt = null;
      data.paymentMethod = null;
      data.cardBrand = null;
      data.cashAccountId = null;
      data.paymentInstrumentId = null;
      data.checkNumber = null;
      data.checkBank = null;
      data.checkAgency = null;
      data.checkAccount = null;
      data.checkClearanceDate = null;
      data.checkHolder = null;
      // Append reversal log to notes
      const who = dto.cancelledByName || 'Sistema';
      const logLine = `[${timestamp}] ESTORNO por ${who}: ${notes || 'sem motivo'}`;
      data.notes = entry.notes ? `${entry.notes}\n${logLine}` : logLine;
    } else {
      data.status = newStatus;
      if (newStatus === 'PAID') {
        data.paidAt = dto.paidAt ? new Date(dto.paidAt) : now;
        if (dto.paymentMethod) data.paymentMethod = dto.paymentMethod;
        if (dto.cardBrand) data.cardBrand = dto.cardBrand;
        if (dto.cashAccountId) data.cashAccountId = dto.cashAccountId;
        if (dto.paymentInstrumentId) data.paymentInstrumentId = dto.paymentInstrumentId;
        if (dto.receivedCardLast4) data.receivedCardLast4 = dto.receivedCardLast4;
        // Check (cheque) data
        if (dto.checkNumber) data.checkNumber = dto.checkNumber;
        if (dto.checkBank) data.checkBank = dto.checkBank;
        if (dto.checkAgency) data.checkAgency = dto.checkAgency;
        if (dto.checkAccount) data.checkAccount = dto.checkAccount;
        if (dto.checkClearanceDate) data.checkClearanceDate = new Date(dto.checkClearanceDate);
        if (dto.checkHolder) data.checkHolder = dto.checkHolder;
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

        if (isCardPayment && entry.type === 'RECEIVABLE') {
          // RECEIVABLE com cartao (maquininha): cria CardSettlement (prazo + taxa) — cliente paga,
          // operadora desconta taxa, empresa recebe liquido em D+N
          let feePercent = pm.feePercent || 0;
          let receivingDays = pm.receivingDays || 0;
          let cardBrand = dto.cardBrand;
          let installmentCount = 1;

          // If a specific card fee rate was selected, use its values
          if (dto.cardFeeRateId) {
            const cardRate = await tx.cardFeeRate.findFirst({
              where: { id: dto.cardFeeRateId, companyId, isActive: true },
            });
            if (cardRate) {
              feePercent = cardRate.feePercent;
              receivingDays = cardRate.receivingDays;
              cardBrand = cardRate.brand;
              installmentCount = cardRate.installmentTo || 1;
              this.logger.log(`Using CardFeeRate ${cardRate.id}: brand=${cardRate.brand}, fee=${cardRate.feePercent}%, days=${cardRate.receivingDays}, installments=${installmentCount}`);
            }
          }
          await this.cardSettlementService.createFromEntry(tx, {
            id: entry.id,
            companyId,
            netCents: entry.netCents,
            paidAt: data.paidAt,
            paymentInstrumentId: entry.paymentInstrumentId || dto.paymentInstrumentId,
          }, {
            code: pm.code,
            feePercent,
            receivingDays,
            cardBrand,
            cardFeeRateId: dto.cardFeeRateId,
            installmentCount,
          });
          this.logger.log(`Card settlement created for entry ${entry.id}, method=${pm.code}, fee=${feePercent}%, days=${receivingDays}`);
        } else if (isCardPayment && entry.type === 'PAYABLE') {
          // PAYABLE com cartao (empresa paga fornecedor): acumula divida na conta vinculada ao
          // cartao — NAO gera CardSettlement nem taxa (fornecedor nao desconta, fatura chega depois).
          // Se o cartao tem conta virtual (CARTAO_CREDITO), debita saldo dela.
          let destAccountId: string | null = dto.cashAccountId || entry.cashAccountId || null;
          if (!destAccountId) {
            const piId = dto.paymentInstrumentId || entry.paymentInstrumentId;
            if (piId) {
              const pi = await tx.paymentInstrument.findUnique({
                where: { id: piId },
                select: { cashAccountId: true },
              });
              destAccountId = pi?.cashAccountId || null;
            }
          }
          if (destAccountId) {
            await tx.cashAccount.update({
              where: { id: destAccountId },
              data: { currentBalanceCents: { decrement: entry.netCents } },
            });
            // Persiste o cashAccountId no entry (ja foi updated — aplica patch)
            if (entry.cashAccountId !== destAccountId) {
              await tx.financialEntry.update({
                where: { id },
                data: { cashAccountId: destAccountId },
              });
            }
            this.logger.log(`Card PAYABLE: debited ${entry.netCents} cents from virtual account ${destAccountId} for entry ${entry.id}`);
          }
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
          // Herdar NFS-e do entry pai (renegociacao nao reemite nota)
          nfseStatus: entry.nfseStatus,
          nfseEmissionId: entry.nfseEmissionId,
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

    // Transit account breakdown: credits (receivables) and debits (payables)
    const transitAccount = cashAccounts.find((a: any) => a.type === 'TRANSITO');
    let transitCredits = 0;
    let transitDebits = 0;
    if (transitAccount) {
      const transitEntries = await this.prisma.financialEntry.findMany({
        where: {
          companyId,
          cashAccountId: transitAccount.id,
          status: 'PAID',
          deletedAt: null,
        },
        select: { type: true, netCents: true },
      });
      for (const e of transitEntries) {
        if (e.type === 'RECEIVABLE') {
          transitCredits += e.netCents;
        } else {
          transitDebits += e.netCents;
        }
      }
    }

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
      transitBreakdown: { creditsCents: transitCredits, debitsCents: transitDebits },
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

  /* ═══════════════════════════════════════════════════════════════
     STATEMENT — Extrato Consolidado
     ═══════════════════════════════════════════════════════════════ */

  async getStatement(companyId: string, limit = 50, dateFrom?: string, dateTo?: string) {
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      dateFilter.lte = d;
    }
    const hasDates = Object.keys(dateFilter).length > 0;

    // 1) Fetch paid FinancialEntries
    const entries = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        status: 'PAID',
        deletedAt: null,
        ...(hasDates ? { paidAt: dateFilter } : {}),
      },
      orderBy: { paidAt: 'desc' },
      take: hasDates ? 500 : limit * 2,
      include: {
        partner: { select: { name: true } },
        financialAccount: { select: { name: true } },
        cashAccountRef: { select: { name: true } },
        paymentInstrumentRef: { select: { name: true } },
      },
    });

    // 2) Fetch account transfers
    const transfers = await this.prisma.accountTransfer.findMany({
      where: {
        companyId,
        ...(hasDates ? { transferDate: dateFilter } : {}),
      },
      orderBy: { transferDate: 'desc' },
      take: hasDates ? 500 : limit,
      select: {
        id: true,
        amountCents: true,
        description: true,
        transferDate: true,
        createdAt: true,
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    });

    // 2b) Fetch reconciliation data for card entries (matched liquid/tax from gestor)
    const entryIds = entries.filter(e => e.paymentMethod?.startsWith('CARTAO')).map(e => e.id);
    const reconMatches = entryIds.length > 0
      ? await this.prisma.bankStatementLine.findMany({
          where: { matchedEntryId: { in: entryIds }, status: 'MATCHED' },
          select: { matchedEntryId: true, matchedLiquidCents: true, matchedTaxCents: true, cashAccountId: true },
          distinct: ['matchedEntryId'],
        })
      : [];
    const reconMap = new Map(reconMatches.map(r => [r.matchedEntryId!, r]));

    // 2c) Fetch card fee rates as fallback
    const cardFeeRates = await this.prisma.cardFeeRate.findMany({
      where: { companyId, isActive: true },
    });
    const findFeePercent = (pm: string | null, brand: string | null): number => {
      if (!pm) return 0;
      const type = pm === 'CARTAO_CREDITO' ? 'CREDITO' : pm === 'CARTAO_DEBITO' ? 'DEBITO' : '';
      if (!type) return 0;
      const rate = cardFeeRates.find(r =>
        r.type.toUpperCase() === type &&
        (brand ? r.brand.toUpperCase() === brand.toUpperCase() : true) &&
        r.installmentFrom <= 1 && r.installmentTo >= 1
      );
      return rate?.feePercent ?? 0;
    };

    // 2d) Fetch cash account names for recon matches
    const reconAccountIds = [...new Set(reconMatches.filter(r => r.cashAccountId).map(r => r.cashAccountId))];
    const reconAccounts = reconAccountIds.length > 0
      ? await this.prisma.cashAccount.findMany({ where: { id: { in: reconAccountIds } }, select: { id: true, name: true } })
      : [];
    const reconAccountMap = new Map(reconAccounts.map(a => [a.id, a.name]));

    // 3) Map entries to statement rows (with card tax split)
    const entryRows: any[] = [];
    for (const e of entries) {
      const isCard = e.paymentMethod?.startsWith('CARTAO');
      // Taxa de cartao so se aplica a RECEBIMENTO (maquininha desconta do cliente).
      // PAGAMENTO com cartao: empresa paga valor integral ao fornecedor; taxa cobrada pela operadora
      // de cartao vem depois na fatura, nao por compra individual.
      const isReceivableCard = isCard && e.type === 'RECEIVABLE';
      const recon = isReceivableCard ? reconMap.get(e.id) : undefined;

      let liquidCents: number;
      let taxCents: number;
      let cashName = e.cashAccountRef?.name ?? null;

      if (isReceivableCard && recon?.matchedLiquidCents != null && recon?.matchedTaxCents != null) {
        // Use gestor-confirmed values from reconciliation
        liquidCents = recon.matchedLiquidCents;
        taxCents = recon.matchedTaxCents;
        if (recon.cashAccountId) cashName = reconAccountMap.get(recon.cashAccountId) ?? cashName;
      } else if (isReceivableCard) {
        // Fallback: calculate from fee rates (apenas para recebimento)
        const feePercent = findFeePercent(e.paymentMethod, e.cardBrand);
        const gross = e.grossCents;
        taxCents = feePercent > 0 ? Math.round(gross * feePercent / 100) : 0;
        liquidCents = gross - taxCents;
      } else {
        // PAYABLE com ou sem cartao, ou RECEIVABLE nao-cartao: valor integral, sem taxa
        liquidCents = e.netCents;
        taxCents = 0;
      }

      entryRows.push({
        id: e.id,
        date: e.paidAt ?? e.createdAt,
        description: e.description || (e.type === 'RECEIVABLE' ? 'Recebimento' : 'Pagamento'),
        type: e.type === 'RECEIVABLE' ? 'CREDIT' as const : 'DEBIT' as const,
        amountCents: e.type === 'RECEIVABLE' ? liquidCents : -liquidCents,
        category: e.financialAccount?.name ?? null,
        source: e.type as string,
        partnerName: e.partner?.name ?? null,
        paymentMethod: e.paymentMethod ?? null,
        paymentInstrumentName: (e as any).paymentInstrumentRef?.name ?? null,
        cashAccountName: cashName,
        code: e.code ?? null,
      });

      if (taxCents > 0) {
        const feePercent = findFeePercent(e.paymentMethod, e.cardBrand);
        entryRows.push({
          id: `${e.id}-tax`,
          date: e.paidAt ?? e.createdAt,
          description: `Taxa cartão ${e.cardBrand || ''} ${feePercent ? `(${feePercent}%)` : ''} — ${e.description || ''}`.trim(),
          type: 'DEBIT' as const,
          amountCents: -taxCents,
          category: 'Taxas de Cartão',
          source: 'CARD_FEE',
          partnerName: e.partner?.name ?? null,
          paymentMethod: e.paymentMethod ?? null,
          paymentInstrumentName: (e as any).paymentInstrumentRef?.name ?? null,
          cashAccountName: cashName,
          code: null,
        });
      }
    }

    // 4) Map transfers to TWO rows each (debit from source, credit to destination)
    const transferRows = transfers.flatMap((t) => [
      {
        id: `${t.id}-from`,
        date: t.transferDate ?? t.createdAt,
        description: t.description || `Transferência para ${t.toAccount.name}`,
        type: 'DEBIT' as const,
        amountCents: -t.amountCents,
        category: null,
        source: 'TRANSFER',
        partnerName: null,
        paymentMethod: 'TRANSFERENCIA',
        cashAccountName: t.fromAccount.name,
        code: null,
      },
      {
        id: `${t.id}-to`,
        date: t.transferDate ?? t.createdAt,
        description: t.description || `Transferência de ${t.fromAccount.name}`,
        type: 'CREDIT' as const,
        amountCents: t.amountCents,
        category: null,
        source: 'TRANSFER',
        partnerName: null,
        paymentMethod: 'TRANSFERENCIA',
        cashAccountName: t.toAccount.name,
        code: null,
      },
    ]);

    // 5) Add initial balance rows for accounts with initialBalanceCents > 0
    const cashAccounts = await this.prisma.cashAccount.findMany({
      where: { companyId, deletedAt: null, isActive: true, initialBalanceCents: { gt: 0 } },
      select: { id: true, name: true, type: true, initialBalanceCents: true, createdAt: true },
    });
    // Use dateFrom as the initial balance date, or first day of month
    const initialDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    initialDate.setHours(0, 0, 0, 0);
    const initialRows = cashAccounts.map(acc => ({
      id: `initial-${acc.id}`,
      date: initialDate,
      description: `Saldo inicial — ${acc.name}`,
      type: 'CREDIT' as const,
      amountCents: acc.initialBalanceCents,
      category: null,
      source: 'INITIAL_BALANCE',
      partnerName: null,
      paymentMethod: null,
      cashAccountName: acc.name,
      code: null,
    }));

    // 6) Merge, sort by date desc, take limit
    const all = [...entryRows, ...transferRows, ...initialRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return all;
  }
}
