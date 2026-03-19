import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateQuoteDto, CreateQuoteItemDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { NotificationService } from '../notification/notification.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { randomUUID } from 'crypto';
import { QuoteStatus, Prisma } from '@prisma/client';
import { Inject, Optional } from '@nestjs/common';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    @Optional() @Inject(WorkflowEngineService) private readonly workflowEngine?: WorkflowEngineService,
  ) {}

  // ---- Totals computation ----

  private computeItemTotal(item: CreateQuoteItemDto): number {
    const subtotal = item.quantity * item.unitPriceCents;
    const discount = item.discountPercent
      ? subtotal * (item.discountPercent / 100)
      : 0;
    return Math.round(subtotal - discount);
  }

  private computeTotals(
    items: CreateQuoteItemDto[],
    discountPercent?: number | null,
    discountCents?: number | null,
  ) {
    const itemTotals = items.map((item) => this.computeItemTotal(item));
    const subtotalCents = itemTotals.reduce((sum, t) => sum + t, 0);

    let globalDiscount = 0;
    if (discountPercent && discountPercent > 0) {
      globalDiscount = Math.round(subtotalCents * (discountPercent / 100));
    }
    if (discountCents && discountCents > globalDiscount) {
      globalDiscount = discountCents;
    }

    const totalCents = Math.max(0, subtotalCents - globalDiscount);
    return { subtotalCents, totalCents, itemTotals };
  }

  // ---- CRUD ----

  async create(dto: CreateQuoteDto, companyId: string, user: AuthenticatedUser) {
    const code = await this.codeGenerator.generateCode(companyId, 'QUOTE');
    const { subtotalCents, totalCents, itemTotals } = this.computeTotals(
      dto.items,
      dto.discountPercent,
      dto.discountCents,
    );

    // TODO: validityDays, deliveryMethod, approvalMode will come from workflow config in the future
    const validityDays = 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const quote = await this.prisma.quote.create({
      data: {
        companyId,
        code,
        title: dto.title,
        description: dto.description,
        clientPartnerId: dto.clientPartnerId,
        serviceOrderId: dto.serviceOrderId || null,
        createdByUserId: user.id,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        validityDays,
        expiresAt,
        discountPercent: dto.discountPercent ?? null,
        discountCents: dto.discountCents ?? null,
        subtotalCents,
        totalCents,
        deliveryMethod: 'WHATSAPP_LINK',
        approvalMode: 'CLIENT',
        items: {
          create: dto.items.map((item, idx) => ({
            type: item.type,
            productId: item.productId || null,
            serviceId: item.serviceId || null,
            description: item.description,
            unit: item.unit ?? 'UN',
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountPercent: item.discountPercent ?? null,
            totalCents: itemTotals[idx],
            sortOrder: item.sortOrder ?? idx,
          })),
        },
      },
      include: { items: true, clientPartner: true },
    });

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: quote.id,
      action: 'CREATED',
      after: { code, totalCents },
    });

    // Fire workflow trigger (async, non-blocking)
    this.executeQuoteWorkflow(companyId, quote).catch(err =>
      this.logger.error(`Quote workflow failed: ${err.message}`),
    );

    return quote;
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: {
      status?: string;
      clientId?: string;
      serviceOrderId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.QuoteWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (filters?.status) where.status = filters.status as QuoteStatus;
    if (filters?.clientId) where.clientPartnerId = filters.clientId;
    if (filters?.serviceOrderId) where.serviceOrderId = filters.serviceOrderId;

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (pagination.search) {
      const words = pagination.search.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        where.OR = [
          { title: { contains: pagination.search, mode: 'insensitive' } },
          { code: { contains: pagination.search, mode: 'insensitive' } },
          { clientPartner: { name: { contains: pagination.search, mode: 'insensitive' } } },
        ];
      } else {
        where.AND = words.map((word) => ({
          OR: [
            { title: { contains: word, mode: 'insensitive' } },
            { code: { contains: word, mode: 'insensitive' } },
            { clientPartner: { name: { contains: word, mode: 'insensitive' } } },
          ],
        }));
      }
    }

    // Sort
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';
    const orderBy: any = {};

    if (sortBy === 'clientName') {
      orderBy.clientPartner = { name: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          clientPartner: { select: { id: true, name: true, phone: true, email: true } },
          serviceOrder: { select: { id: true, code: true, title: true } },
          _count: { select: { items: true, attachments: true } },
        },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, companyId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        clientPartner: true,
        serviceOrder: { select: { id: true, code: true, title: true, status: true } },
        items: { orderBy: { sortOrder: 'asc' }, include: { product: true, service: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        parentQuote: { select: { id: true, code: true, version: true } },
        childQuotes: { select: { id: true, code: true, version: true, status: true, createdAt: true } },
      },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    return quote;
  }

  async update(id: string, companyId: string, dto: UpdateQuoteDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'RASCUNHO') {
      throw new BadRequestException('Só é possível editar orçamentos em rascunho');
    }

    const items = dto.items;
    let subtotalCents = quote.subtotalCents;
    let totalCents = quote.totalCents;
    let itemTotals: number[] = [];

    if (items) {
      const result = this.computeTotals(
        items,
        dto.discountPercent ?? quote.discountPercent,
        dto.discountCents ?? quote.discountCents,
      );
      subtotalCents = result.subtotalCents;
      totalCents = result.totalCents;
      itemTotals = result.itemTotals;
    } else if (dto.discountPercent !== undefined || dto.discountCents !== undefined) {
      // Recalculate with existing items
      const existingItems = await this.prisma.quoteItem.findMany({
        where: { quoteId: id },
      });
      const asDto = existingItems.map((i) => ({
        type: i.type,
        description: i.description,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        discountPercent: i.discountPercent,
      })) as CreateQuoteItemDto[];
      const result = this.computeTotals(
        asDto,
        dto.discountPercent ?? quote.discountPercent,
        dto.discountCents ?? quote.discountCents,
      );
      subtotalCents = result.subtotalCents;
      totalCents = result.totalCents;
    }

    const expiresAt = quote.expiresAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Delete and recreate items if provided
      if (items) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quoteItem.createMany({
          data: items.map((item, idx) => ({
            quoteId: id,
            type: item.type,
            productId: item.productId || null,
            serviceId: item.serviceId || null,
            description: item.description,
            unit: item.unit ?? 'UN',
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountPercent: item.discountPercent ?? null,
            totalCents: itemTotals[idx],
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      return tx.quote.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.clientPartnerId !== undefined && { clientPartnerId: dto.clientPartnerId }),
          ...(dto.serviceOrderId !== undefined && { serviceOrderId: dto.serviceOrderId || null }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.termsConditions !== undefined && { termsConditions: dto.termsConditions }),
          ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent }),
          ...(dto.discountCents !== undefined && { discountCents: dto.discountCents }),
          subtotalCents,
          totalCents,
          expiresAt,
        },
        include: { items: true, clientPartner: true },
      });
    });

    return updated;
  }

  async remove(id: string, companyId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'RASCUNHO') {
      throw new BadRequestException('Só é possível excluir orçamentos em rascunho');
    }

    await this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: id,
      action: 'DELETED',
      after: { code: quote.code },
    });

    return { success: true };
  }

  // ---- Actions ----

  async send(id: string, companyId: string, dto: SendQuoteDto, user: AuthenticatedUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        clientPartner: true,
        company: true,
        attachments: true,
      },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (!['RASCUNHO', 'ENVIADO'].includes(quote.status)) {
      throw new BadRequestException('Orçamento não pode ser enviado neste status');
    }

    const deliveryMethod = dto.deliveryMethod || quote.deliveryMethod;
    const publicToken = quote.publicToken || randomUUID();
    const tokenExpiry = new Date(quote.expiresAt || new Date());
    tokenExpiry.setDate(tokenExpiry.getDate() + 7); // Extra 7 days after quote expiry

    const baseDomain = process.env.BASE_DOMAIN || 'https://tecnikos.com.br';
    const publicUrl = `${baseDomain}/q/${publicToken}`;

    // Update quote status
    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'ENVIADO',
        publicToken,
        publicTokenExpiresAt: tokenExpiry,
        sentAt: new Date(),
        sentVia: deliveryMethod.includes('WHATSAPP') ? 'WHATSAPP' : 'EMAIL',
        deliveryMethod,
      },
    });

    // Send notification
    const formatMoney = (cents: number) =>
      `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

    if (deliveryMethod === 'WHATSAPP_LINK' || deliveryMethod === 'WHATSAPP_MESSAGE') {
      const message =
        deliveryMethod === 'WHATSAPP_LINK'
          ? `Olá ${quote.clientPartner.name}! Segue o orçamento *${quote.code}* - ${quote.title}.\n\nValor: *${formatMoney(quote.totalCents)}*\nValidade: ${quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString('pt-BR') : 'Indeterminada'}\n\nAcesse para aprovar ou recusar:\n${publicUrl}`
          : `Olá ${quote.clientPartner.name}! Segue o orçamento *${quote.code}*:\n\n*${quote.title}*\nValor Total: *${formatMoney(quote.totalCents)}*\n\n${dto.message || 'Entre em contato para aprovar.'}`;

      try {
        await this.notifications.send({
          companyId,
          channel: 'WHATSAPP',
          recipientPhone: quote.clientPartner.phone || undefined,
          message,
          type: 'QUOTE_SENT',
          forceTemplate: true, // Business-initiated — skip text attempt
        });
      } catch (err) {
        this.logger.warn(`Failed to send WhatsApp for quote ${id}: ${err.message}`);
      }
    }

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: id,
      action: 'SENT',
      after: { deliveryMethod, publicUrl },
    });

    return { ...updated, publicUrl };
  }

  async approve(id: string, companyId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'ENVIADO') {
      throw new BadRequestException('Apenas orçamentos enviados podem ser aprovados');
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'APROVADO',
        approvedAt: new Date(),
        approvedByName: user.email,
        approvedByType: 'INTERNAL',
      },
    });

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: id,
      action: 'APPROVED',
      after: { approvedByType: 'INTERNAL' },
    });

    return updated;
  }

  async reject(id: string, companyId: string, user: AuthenticatedUser, reason?: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'ENVIADO') {
      throw new BadRequestException('Apenas orçamentos enviados podem ser rejeitados');
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'REJEITADO',
        rejectedAt: new Date(),
        rejectedByName: user.email,
        rejectedReason: reason || null,
      },
    });

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: id,
      action: 'REJECTED',
      after: { reason },
    });

    return updated;
  }

  async cancel(id: string, companyId: string, user: AuthenticatedUser, reason?: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (['CANCELADO', 'APROVADO'].includes(quote.status)) {
      throw new BadRequestException('Orçamento não pode ser cancelado neste status');
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        cancelledAt: new Date(),
        cancelledByName: user.email,
        cancelledReason: reason || null,
      },
    });

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: id,
      action: 'CANCELLED',
      after: { reason },
    });

    return updated;
  }

  async duplicate(id: string, companyId: string, user: AuthenticatedUser) {
    const original = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });

    if (!original) throw new NotFoundException('Orçamento não encontrado');

    const code = await this.codeGenerator.generateCode(companyId, 'QUOTE');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + original.validityDays);

    const duplicate = await this.prisma.quote.create({
      data: {
        companyId,
        code,
        title: `${original.title} (Cópia)`,
        description: original.description,
        clientPartnerId: original.clientPartnerId,
        serviceOrderId: original.serviceOrderId,
        createdByUserId: user.id,
        notes: original.notes,
        termsConditions: original.termsConditions,
        validityDays: original.validityDays,
        expiresAt,
        discountPercent: original.discountPercent,
        discountCents: original.discountCents,
        subtotalCents: original.subtotalCents,
        totalCents: original.totalCents,
        deliveryMethod: original.deliveryMethod,
        approvalMode: original.approvalMode,
        items: {
          create: original.items.map((item) => ({
            type: item.type,
            productId: item.productId,
            serviceId: item.serviceId,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountPercent: item.discountPercent,
            totalCents: item.totalCents,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: true },
    });

    return duplicate;
  }

  async createOsFromQuote(id: string, companyId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true, clientPartner: true },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'APROVADO') {
      throw new BadRequestException('Apenas orçamentos aprovados podem gerar OS');
    }

    // ── Enforce maxOsPerMonth limit (OS + NFS-e avulsas = transações) ──
    const company = await this.prisma.company.findFirst({ select: { maxOsPerMonth: true } });
    const maxOs = company?.maxOsPerMonth || 0;
    if (maxOs > 0) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [osCount, avulsaNfseCount] = await Promise.all([
        this.prisma.serviceOrder.count({
          where: { companyId, createdAt: { gte: startOfMonth } },
        }),
        this.prisma.nfseEmission.count({
          where: { companyId, serviceOrderId: null, status: { not: 'ERROR' }, createdAt: { gte: startOfMonth } },
        }).catch(() => 0),
      ]);
      if (osCount + avulsaNfseCount >= maxOs) {
        throw new ForbiddenException(
          `Limite de ${maxOs} transações por mês atingido. Não é possível gerar OS a partir do orçamento. Faça upgrade do plano.`,
        );
      }
    }

    // Build description from items
    const itemsList = quote.items
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.description} - ${item.quantity} ${item.unit} x R$ ${(item.unitPriceCents / 100).toFixed(2)}`,
      )
      .join('\n');

    const description = `Gerada a partir do orçamento ${quote.code}\n\nItens:\n${itemsList}`;

    // Import CodeGeneratorService to generate OS code
    const osCode = await this.codeGenerator.generateCode(companyId, 'SERVICE_ORDER');

    const os = await this.prisma.serviceOrder.create({
      data: {
        companyId,
        code: osCode,
        title: quote.title,
        description,
        clientPartnerId: quote.clientPartnerId,
        valueCents: quote.totalCents,
        deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        addressText: quote.clientPartner.addressStreet
          ? `${quote.clientPartner.addressStreet}, ${quote.clientPartner.addressNumber || 'S/N'} - ${quote.clientPartner.neighborhood || ''}, ${quote.clientPartner.city || ''} - ${quote.clientPartner.state || ''}`
          : 'A definir',
      },
    });

    // Link quote to OS
    await this.prisma.quote.update({
      where: { id },
      data: { serviceOrderId: os.id },
    });

    this.audit.log({
      companyId,
      actorType: 'USER',
      actorId: user.id,
      entityType: 'QUOTE',
      entityId: id,
      action: 'OS_CREATED',
      after: { osId: os.id, osCode },
    });

    return os;
  }

  async stats(companyId: string) {
    const counts = await this.prisma.quote.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: true,
    });

    const result: Record<string, number> = {
      RASCUNHO: 0,
      ENVIADO: 0,
      APROVADO: 0,
      REJEITADO: 0,
      EXPIRADO: 0,
      CANCELADO: 0,
    };

    for (const c of counts) {
      result[c.status] = c._count;
    }

    return result;
  }

  // ---- Public token methods ----

  async findByPublicToken(token: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { publicToken: token, deletedAt: null },
      include: {
        company: {
          select: {
            name: true,
            tradeName: true,
            cnpj: true,
            phone: true,
            email: true,
            logoUrl: true,
            addressStreet: true,
            addressNumber: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
          },
        },
        clientPartner: {
          select: { name: true, document: true, phone: true, email: true },
        },
        items: { orderBy: { sortOrder: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');

    // Check token expiry
    if (quote.publicTokenExpiresAt && new Date() > quote.publicTokenExpiresAt) {
      throw new BadRequestException('Link expirado');
    }

    // Don't expose internal notes
    const { notes, createdByUserId, ...publicData } = quote;
    return publicData;
  }

  async approvePublic(token: string, approverName: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { publicToken: token, deletedAt: null },
      include: { company: true },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'ENVIADO') {
      throw new BadRequestException('Este orçamento não está aguardando aprovação');
    }
    if (quote.publicTokenExpiresAt && new Date() > quote.publicTokenExpiresAt) {
      throw new BadRequestException('Link expirado');
    }

    const updated = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'APROVADO',
        approvedAt: new Date(),
        approvedByName: approverName,
        approvedByType: 'CLIENT',
      },
    });

    // Notify company
    try {
      await this.notifications.send({
        companyId: quote.companyId,
        channel: 'WHATSAPP',
        recipientPhone: quote.company.phone || undefined,
        message: `✅ Orçamento *${quote.code}* aprovado pelo cliente ${approverName}!\nValor: R$ ${(quote.totalCents / 100).toFixed(2).replace('.', ',')}`,
        type: 'QUOTE_APPROVED',
        forceTemplate: true,
      });
    } catch (err) {
      this.logger.warn(`Failed to notify company about quote approval: ${err.message}`);
    }

    return updated;
  }

  async rejectPublic(token: string, reason?: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { publicToken: token, deletedAt: null },
      include: { company: true, clientPartner: true },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'ENVIADO') {
      throw new BadRequestException('Este orçamento não está aguardando aprovação');
    }

    const updated = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'REJEITADO',
        rejectedAt: new Date(),
        rejectedByName: quote.clientPartner.name,
        rejectedReason: reason || null,
      },
    });

    // Notify company
    try {
      await this.notifications.send({
        companyId: quote.companyId,
        channel: 'WHATSAPP',
        recipientPhone: quote.company.phone || undefined,
        message: `❌ Orçamento *${quote.code}* recusado pelo cliente ${quote.clientPartner.name}.${reason ? `\nMotivo: ${reason}` : ''}`,
        type: 'QUOTE_REJECTED',
        forceTemplate: true,
      });
    } catch (err) {
      this.logger.warn(`Failed to notify company about quote rejection: ${err.message}`);
    }

    return updated;
  }

  // ---- Cron: Expire old quotes ----

  @Cron('0 0 * * *') // Midnight daily
  async expireQuotes() {
    const result = await this.prisma.quote.updateMany({
      where: {
        status: 'ENVIADO',
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'EXPIRADO' },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} quotes`);
    }
  }

  // ---- Attachment management ----

  async addAttachment(
    quoteId: string,
    companyId: string,
    data: { fileName: string; filePath: string; fileSize?: number; mimeType?: string; label?: string; supplierName?: string },
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');

    return this.prisma.quoteAttachment.create({
      data: {
        quoteId,
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? 'application/pdf',
        label: data.label ?? null,
        supplierName: data.supplierName ?? null,
      },
    });
  }

  async removeAttachment(attachmentId: string, companyId: string) {
    const attachment = await this.prisma.quoteAttachment.findFirst({
      where: { id: attachmentId },
      include: { quote: { select: { companyId: true } } },
    });

    if (!attachment || attachment.quote.companyId !== companyId) {
      throw new NotFoundException('Anexo não encontrado');
    }

    await this.prisma.quoteAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }

  /* ── Execute workflow NOTIFY blocks for quote_created trigger ── */

  private async executeQuoteWorkflow(companyId: string, quote: any): Promise<void> {
    if (!this.workflowEngine) return;

    const matched = await this.workflowEngine.findWorkflowByTrigger(companyId, ['quote_created']);
    if (!matched) return;

    const workflow = await this.prisma.workflowTemplate.findUnique({ where: { id: matched.id } });
    if (!workflow) return;

    const steps = workflow.steps as any;
    const blocks = steps?.blocks as any[];
    if (!blocks?.length) return;

    // Load data for variable substitution
    const client = quote.clientPartner || (quote.clientPartnerId
      ? await this.prisma.partner.findUnique({ where: { id: quote.clientPartnerId } })
      : null);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const companyDisplay = company?.tradeName || company?.name || '';
    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';

    const resolveVars = (msg: string): string => {
      return msg
        .replace(/\{codigo\}/gi, quote.code || '')
        .replace(/\{titulo\}/gi, quote.title || '')
        .replace(/\{descricao\}/gi, quote.description || '')
        .replace(/\{valor\}/gi, `R$ ${((quote.totalCents || 0) / 100).toFixed(2).replace('.', ',')}`)
        .replace(/\{cliente\}/gi, client?.name || '')
        .replace(/\{telefone_cliente\}/gi, client?.phone || '')
        .replace(/\{email_cliente\}/gi, client?.email || '')
        .replace(/\{empresa\}/gi, companyDisplay)
        .replace(/\{data\}/gi, new Date().toLocaleDateString('pt-BR'))
        .replace(/\{link\}/gi, `${baseUrl}/q/${quote.publicToken || ''}`);
    };

    // Walk blocks sequentially
    const blockMap = new Map(blocks.map((b: any) => [b.id, b]));
    let current = blocks.find((b: any) => b.type === 'START');
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      if (current.type === 'NOTIFY') {
        const recipients = current.config?.recipients || [];
        for (const r of recipients) {
          if (r.enabled === false) continue;

          const message = resolveVars(r.message || '');
          if (!message) continue;

          const channel = r.channel || 'WHATSAPP';

          // Determine recipient target
          if (r.type === 'CLIENTE' && client?.phone && channel === 'WHATSAPP') {
            await this.notifications.send({
              companyId,
              channel: 'WHATSAPP',
              type: 'QUOTE_WORKFLOW',
              recipientPhone: client.phone,
              message,
            });
            this.logger.log(`💰 Quote workflow: sent WhatsApp to client ${client.name}`);
          } else if (r.type === 'CLIENTE' && client?.email && channel === 'EMAIL') {
            await this.notifications.send({
              companyId,
              channel: 'EMAIL',
              type: 'QUOTE_WORKFLOW',
              recipientEmail: client.email,
              message,
            });
            this.logger.log(`💰 Quote workflow: sent email to client ${client.name}`);
          } else if (r.type === 'GESTOR') {
            // Notify all admin/manager users
            const managers = await this.prisma.user.findMany({
              where: { companyId, deletedAt: null, roles: { has: 'ADMIN' } },
              select: { email: true, name: true },
            });
            for (const m of managers) {
              if (channel === 'EMAIL' && m.email) {
                await this.notifications.send({ companyId, channel: 'EMAIL', type: 'QUOTE_WORKFLOW', recipientEmail: m.email, message });
              }
            }
            this.logger.log(`💰 Quote workflow: notified ${managers.length} manager(s)`);
          }
        }
      }

      current = current.next ? blockMap.get(current.next) : undefined;
    }
  }
}
