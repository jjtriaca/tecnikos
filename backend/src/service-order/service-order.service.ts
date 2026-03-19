import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { ServiceOrderStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { AutomationEngineService, AutomationEvent } from '../automation/automation-engine.service';
import { WaitForService } from '../workflow/wait-for.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { AuditService } from '../common/audit/audit.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { AuthenticatedUser } from '../auth/auth.types';

const SORTABLE_COLUMNS = ['title', 'status', 'valueCents', 'deadlineAt', 'createdAt', 'acceptedAt', 'startedAt', 'completedAt', 'scheduledStartAt'];

const TERMINAL_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.CONCLUIDA,
  ServiceOrderStatus.APROVADA,
  ServiceOrderStatus.CANCELADA,
];

// State machine: allowed status transitions
const ALLOWED_TRANSITIONS: Record<string, ServiceOrderStatus[]> = {
  ABERTA: [ServiceOrderStatus.OFERTADA, ServiceOrderStatus.ATRIBUIDA, ServiceOrderStatus.CANCELADA],
  OFERTADA: [ServiceOrderStatus.ATRIBUIDA, ServiceOrderStatus.ABERTA, ServiceOrderStatus.RECUSADA, ServiceOrderStatus.CANCELADA],
  ATRIBUIDA: [ServiceOrderStatus.A_CAMINHO, ServiceOrderStatus.EM_EXECUCAO, ServiceOrderStatus.ABERTA, ServiceOrderStatus.CANCELADA],
  A_CAMINHO: [ServiceOrderStatus.EM_EXECUCAO, ServiceOrderStatus.ATRIBUIDA, ServiceOrderStatus.CANCELADA],
  EM_EXECUCAO: [ServiceOrderStatus.CONCLUIDA, ServiceOrderStatus.AJUSTE, ServiceOrderStatus.CANCELADA],
  AJUSTE: [ServiceOrderStatus.EM_EXECUCAO, ServiceOrderStatus.CANCELADA],
  CONCLUIDA: [ServiceOrderStatus.APROVADA, ServiceOrderStatus.AJUSTE],
  APROVADA: [], // terminal
  CANCELADA: [], // terminal
  RECUSADA: [ServiceOrderStatus.OFERTADA, ServiceOrderStatus.ABERTA, ServiceOrderStatus.CANCELADA], // pode re-ofertar ou cancelar
  FINALIZADA: [], // terminal
};

@Injectable()
export class ServiceOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeGenerator: CodeGeneratorService,
    @Optional() @Inject(NotificationService) private readonly notifications?: NotificationService,
    @Optional() @Inject(AutomationEngineService) private readonly automationEngine?: AutomationEngineService,
    @Optional() @Inject(WaitForService) private readonly waitForService?: WaitForService,
    @Optional() @Inject(WorkflowEngineService) private readonly workflowEngine?: WorkflowEngineService,
    @Optional() @Inject(EvaluationService) private readonly evaluationService?: EvaluationService,
  ) {}

  /** Fire-and-forget automation dispatch + WAIT_FOR early trigger check */
  private dispatchAutomation(event: AutomationEvent): void {
    this.automationEngine?.dispatch(event).catch(() => {});
    // Verificar triggers de WAIT_FOR pendentes
    if (event.entity === 'SERVICE_ORDER') {
      this.waitForService?.checkEarlyTrigger(
        event.entityId,
        event.companyId,
        event.eventType,
        { status: event.data.status, oldStatus: event.data.oldStatus },
      ).catch(() => {});
    }
  }

  /** Get billing cycle period (subscription-based), fallback to calendar month */
  private async getBillingPeriod(companyId: string): Promise<{ periodStart: Date; periodEnd: Date }> {
    const now = new Date();
    const tenant = await this.prisma.tenant.findFirst({
      where: { companyId },
      select: { id: true },
    });
    if (tenant) {
      const sub = await this.prisma.subscription.findFirst({
        where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        select: { currentPeriodStart: true, currentPeriodEnd: true },
        orderBy: { createdAt: 'desc' },
      });
      if (sub) {
        return { periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd };
      }
    }
    // Fallback: calendar month
    return {
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  async create(data: CreateServiceOrderDto & { companyId: string }, actor?: AuthenticatedUser) {
    // ── Enforce maxOsPerMonth limit (OS + NFS-e avulsas = transações) ──
    // Uses billing cycle period, NOT calendar month
    const company = await this.prisma.company.findFirst({
      select: { maxOsPerMonth: true },
    });
    const maxOs = company?.maxOsPerMonth || 0;
    if (maxOs > 0) {
      const { periodStart, periodEnd } = await this.getBillingPeriod(data.companyId);
      const [osCount, avulsaNfseCount] = await Promise.all([
        this.prisma.serviceOrder.count({
          where: {
            companyId: data.companyId,
            createdAt: { gte: periodStart, lte: periodEnd },
            // Deletadas CONTAM no limite — evita burlar criando e apagando
          },
        }),
        // NFS-e avulsas (sem OS) contam no limite de transações
        this.prisma.nfseEmission.count({
          where: {
            companyId: data.companyId,
            serviceOrderId: null,
            status: { not: 'ERROR' },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }).catch(() => 0),
      ]);
      const totalTransactions = osCount + avulsaNfseCount;
      if (totalTransactions >= maxOs) {
        throw new ForbiddenException(
          `Limite de ${maxOs} transações por mês atingido (${osCount} OS + ${avulsaNfseCount} NFS-e avulsas). Faça upgrade do plano ou adquira OS adicionais.`,
        );
      }
    }

    // Auto-generate sequential code
    const code = await this.codeGenerator.generateCode(data.companyId, 'SERVICE_ORDER');

    // Auto-attach workflow by trigger if no explicit workflowTemplateId
    // Priority: urgent → return → assignment mode → generic
    let resolvedWorkflowId = data.workflowTemplateId || undefined;
    if (!resolvedWorkflowId && this.workflowEngine) {
      const triggerIds: string[] = [];
      if (data.isEvaluation) triggerIds.push('os_evaluation_created');
      if (data.isUrgent) triggerIds.push('os_urgent_created');
      if (data.isReturn) triggerIds.push('os_return_created');
      // Assignment mode triggers (more specific before generic)
      const mode = data.techAssignmentMode || 'BY_SPECIALIZATION';
      if (mode === 'BY_SPECIALIZATION') triggerIds.push('os_specialization_created');
      else if (mode === 'DIRECTED') triggerIds.push('os_directed_created');
      else if (mode === 'BY_AGENDA' || mode === 'BY_WORKFLOW') triggerIds.push('os_agenda_created');
      triggerIds.push('os_created'); // fallback genérico
      const matched = await this.workflowEngine.findWorkflowByTrigger(data.companyId, triggerIds);
      if (matched) resolvedWorkflowId = matched.id;
    }

    // ── Pre-check: inspect workflow blocks for TECH_REVIEW_SCREEN ──
    let workflowHasReviewScreen = false;
    if (resolvedWorkflowId) {
      try {
        const wf = await this.prisma.workflowTemplate.findUnique({
          where: { id: resolvedWorkflowId },
          select: { steps: true },
        });
        if (wf?.steps) {
          const def = typeof wf.steps === 'string' ? JSON.parse(wf.steps as string) : wf.steps;
          let blocks: any[] = [];
          if (def?.version === 2 && Array.isArray(def.blocks)) blocks = def.blocks;
          else if (def?.version === 3 && Array.isArray(def.blocks)) blocks = def.blocks;
          workflowHasReviewScreen = blocks.some((b: any) => b.type === 'TECH_REVIEW_SCREEN');
        }
      } catch { /* ignore parse errors */ }
    }

    const result = await this.prisma.serviceOrder.create({
      data: {
        companyId: data.companyId,
        code,
        title: data.title,
        description: data.description,
        addressText: data.addressText,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        valueCents: data.valueCents,
        deadlineAt: new Date(data.deadlineAt),
        workflowTemplateId: resolvedWorkflowId,
        clientPartnerId: data.clientPartnerId || undefined,
        // Endereço estruturado
        addressStreet: data.addressStreet || undefined,
        addressNumber: data.addressNumber || undefined,
        addressComp: data.addressComp || undefined,
        neighborhood: data.neighborhood || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        cep: data.cep || undefined,
        // Atribuição de técnico (v1.00.24)
        techAssignmentMode: data.techAssignmentMode || 'BY_SPECIALIZATION',
        requiredSpecializationIds: data.requiredSpecializationIds || [],
        directedTechnicianIds: data.directedTechnicianIds || [],
        contactPersonName: data.contactPersonName || undefined,
        acceptTimeoutMinutes: data.acceptTimeoutMinutes ?? undefined,
        enRouteTimeoutMinutes: data.enRouteTimeoutMinutes ?? undefined,
        obraId: data.obraId || undefined,
        // Agendamento CLT (v1.01.72)
        scheduledStartAt: data.scheduledStartAt ? new Date(data.scheduledStartAt) : undefined,
        estimatedDurationMinutes: data.estimatedDurationMinutes ?? undefined,
        // Comissão e retorno (v1.01.81)
        commissionBps: data.commissionBps ?? undefined,
        techCommissionCents: data.techCommissionCents ?? undefined,
        isReturn: data.isReturn ?? undefined,
        returnPaidToTech: data.returnPaidToTech ?? undefined,
        isUrgent: data.isUrgent ?? undefined,
        isEvaluation: data.isEvaluation ?? undefined,
        // OS SEMPRE nasce ABERTA — blocos do workflow controlam status/atribuicao
        status: 'ABERTA' as any,
      },
    });

    // Create service items if provided (v1.03.31)
    if (data.items?.length) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: data.items.map(i => i.serviceId) }, companyId: data.companyId, deletedAt: null },
      });
      const serviceMap = new Map(services.map(s => [s.id, s]));
      const itemsData = data.items
        .filter(i => serviceMap.has(i.serviceId))
        .map(i => {
          const svc = serviceMap.get(i.serviceId)!;
          return {
            serviceOrderId: result.id,
            serviceId: svc.id,
            serviceName: svc.name,
            unit: svc.unit,
            quantity: i.quantity || 1,
            unitPriceCents: svc.priceCents || 0,
            commissionBps: svc.commissionBps ?? null,
          };
        });
      if (itemsData.length) {
        await this.prisma.serviceOrderItem.createMany({ data: itemsData });
      }
    }

    this.audit.log({
      companyId: data.companyId,
      entityType: 'SERVICE_ORDER',
      entityId: result.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
      after: { title: result.title, status: result.status },
    });

    const eventData = { status: result.status, state: data.state, city: data.city, neighborhood: data.neighborhood, valueCents: data.valueCents, clientPartnerId: data.clientPartnerId, title: result.title, description: data.description, addressStreet: data.addressStreet, cep: data.cep, deadlineAt: data.deadlineAt, createdAt: result.createdAt?.toISOString(), scheduledStartAt: data.scheduledStartAt, isReturn: data.isReturn, isUrgent: data.isUrgent, isEvaluation: data.isEvaluation };

    // ── Tech Review: skip notifications, return candidates ──
    const shouldReview = !!data.skipNotifications || workflowHasReviewScreen;
    let reviewAllowEdit = false;
    if (workflowHasReviewScreen && resolvedWorkflowId) {
      try {
        const wf = await this.prisma.workflowTemplate.findUnique({
          where: { id: resolvedWorkflowId },
          select: { steps: true },
        });
        if (wf?.steps) {
          const def = typeof wf.steps === 'string' ? JSON.parse(wf.steps as string) : wf.steps;
          let blocks: any[] = [];
          if (def?.version === 2 && Array.isArray(def.blocks)) blocks = def.blocks;
          else if (def?.version === 3 && Array.isArray(def.blocks)) blocks = def.blocks;
          const reviewBlock = blocks.find((b: any) => b.type === 'TECH_REVIEW_SCREEN');
          if (reviewBlock) reviewAllowEdit = !!reviewBlock.config?.allowEdit;
        }
      } catch { /* ignore parse errors */ }
    }

    if (shouldReview) {
      const candidates = await this.getCandidateTechnicians(data, result);
      return { ...result, _pendingReview: true, _candidates: candidates, _workflowId: resolvedWorkflowId, _allowEdit: reviewAllowEdit };
    }

    // Execute workflow in background — don't block the HTTP response
    // The workflow may have DELAY blocks that take seconds/minutes
    if (resolvedWorkflowId && this.workflowEngine) {
      const wfEngine = this.workflowEngine;
      const osId = result.id;
      const cId = data.companyId;
      const wfId = resolvedWorkflowId;
      setImmediate(async () => {
        try {
          await wfEngine.executeWorkflowFromStart(osId, cId, wfId);
        } catch (err) {
          console.error('executeWorkflowFromStart failed:', (err as Error)?.message || err);
        }
      });
    }

    return result;
  }

  /** Get candidate technicians for tech review modal */
  private async getCandidateTechnicians(data: any, os: any): Promise<any[]> {
    const companyId = data.companyId;

    if (data.techAssignmentMode === 'DIRECTED' && data.directedTechnicianIds?.length > 0) {
      // Return the directed technicians
      const techs = await this.prisma.partner.findMany({
        where: { id: { in: data.directedTechnicianIds }, deletedAt: null },
        select: {
          id: true, name: true, phone: true, rating: true,
          specializations: { select: { specialization: { select: { id: true, name: true } } } },
        },
      });
      return techs.map(t => ({
        id: t.id,
        name: t.name,
        phone: t.phone || '',
        rating: t.rating,
        specializations: t.specializations.map(s => s.specialization.name),
      }));
    }

    // BY_SPECIALIZATION or BY_WORKFLOW: find techs matching specializations
    const specIds = data.requiredSpecializationIds || os.requiredSpecializationIds || [];
    const where: any = {
      companyId,
      deletedAt: null,
      partnerTypes: { has: 'TECNICO' },
      status: 'ATIVO',
    };
    if (specIds.length > 0) {
      where.AND = specIds.map((sid: string) => ({
        specializations: { some: { specializationId: sid } },
      }));
    }

    const techs = await this.prisma.partner.findMany({
      where,
      select: {
        id: true, name: true, phone: true, rating: true,
        specializations: { select: { specialization: { select: { id: true, name: true } } } },
      },
      orderBy: { rating: 'desc' },
      take: 50,
    });

    return techs.map(t => ({
      id: t.id,
      name: t.name,
      phone: t.phone || '',
      rating: t.rating,
      specializations: t.specializations.map(s => s.specialization.name),
    }));
  }

  /** Dispatch notifications after tech review (manual confirmation) */
  async dispatchNotifications(
    osId: string,
    companyId: string,
    technicianIds: string[],
    userId: string,
  ) {
    const os = await this.prisma.serviceOrder.findFirst({
      where: { id: osId, companyId, deletedAt: null },
      select: {
        id: true, status: true, workflowTemplateId: true,
        assignedPartnerId: true, directedTechnicianIds: true,
      },
    });
    if (!os) throw new Error('OS não encontrada');

    // Update directed technician IDs with confirmed list
    await this.prisma.serviceOrder.update({
      where: { id: osId },
      data: { directedTechnicianIds: technicianIds },
    });

    // If single tech and not yet assigned, assign
    if (technicianIds.length === 1 && !os.assignedPartnerId) {
      await this.prisma.serviceOrder.update({
        where: { id: osId },
        data: {
          assignedPartnerId: technicianIds[0],
          status: 'ATRIBUIDA' as any,
          acceptedAt: new Date(),
        },
      });
    }

    // Execute workflow notifications
    let _dispatch: any = undefined;
    const workflowId = os.workflowTemplateId;
    const assignedTechId = technicianIds.length === 1 ? technicianIds[0] : os.assignedPartnerId;

    if (workflowId && this.workflowEngine) {
      const currentStatus = technicianIds.length === 1 && !os.assignedPartnerId ? 'ATRIBUIDA' : os.status;
      try {
        const notifResult = await this.workflowEngine.executeStageNotifications(
          osId, companyId, currentStatus, workflowId,
        );

        if (assignedTechId) {
          const tech = await this.prisma.partner.findUnique({
            where: { id: assignedTechId },
            select: { name: true, phone: true },
          });
          if (tech) {
            _dispatch = {
              technicianName: tech.name,
              technicianPhone: tech.phone || '',
              notificationId: notifResult?.notificationId,
              notificationStatus: notifResult?.notificationStatus || 'PENDING',
              notificationChannel: notifResult?.notificationChannel || 'WHATSAPP',
              errorDetail: notifResult?.errorDetail,
            };
          }
        }
      } catch (err) {
        if (assignedTechId) {
          const tech = await this.prisma.partner.findUnique({
            where: { id: assignedTechId },
            select: { name: true, phone: true },
          });
          if (tech) {
            _dispatch = {
              technicianName: tech.name,
              technicianPhone: tech.phone || '',
              notificationStatus: 'FAILED',
              errorDetail: err?.message || 'Erro desconhecido',
            };
          }
        }
      }
    }

    return { success: true, _dispatch };
  }

  async findAll(
    companyId: string,
    pagination?: PaginationDto,
    filters?: { status?: string; dateFrom?: string; dateTo?: string; valueMin?: string; valueMax?: string; technicianId?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };
    if (filters?.technicianId) where.assignedPartnerId = filters.technicianId;
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (filters?.valueMin || filters?.valueMax) {
      where.valueCents = {};
      if (filters.valueMin) where.valueCents.gte = Number(filters.valueMin);
      if (filters.valueMax) where.valueCents.lte = Number(filters.valueMax);
    }
    if (pagination?.search) {
      const words = pagination.search.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        where.OR = [
          { title: { contains: pagination.search, mode: 'insensitive' } },
          { addressText: { contains: pagination.search, mode: 'insensitive' } },
          { code: { contains: pagination.search, mode: 'insensitive' } },
          { clientPartner: { name: { contains: pagination.search, mode: 'insensitive' } } },
        ];
      } else {
        where.AND = words.map((word) => ({
          OR: [
            { title: { contains: word, mode: 'insensitive' } },
            { addressText: { contains: word, mode: 'insensitive' } },
            { code: { contains: word, mode: 'insensitive' } },
            { clientPartner: { name: { contains: word, mode: 'insensitive' } } },
          ],
        }));
      }
    }

    const orderBy = buildOrderBy(pagination?.sortBy, pagination?.sortOrder, SORTABLE_COLUMNS, { createdAt: 'desc' });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceOrder.findMany({
        where, orderBy, skip, take: limit,
        include: {
          assignedPartner: { select: { id: true, name: true, phone: true } },
          clientPartner: { select: { id: true, name: true } },
          workflowTemplate: { select: { id: true, name: true, steps: true } },
          _count: { select: { workflowStepLogs: true } },
        },
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async stats(companyId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const statusGroups = await this.prisma.serviceOrder.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const g of statusGroups) {
      byStatus[g.status] = g._count._all;
      total += g._count._all;
    }

    const overdue = await this.prisma.serviceOrder.count({
      where: { companyId, deletedAt: null, deadlineAt: { lt: now }, status: { notIn: ['CONCLUIDA', 'APROVADA', 'CANCELADA'] } },
    });

    const completedToday = await this.prisma.serviceOrder.count({
      where: { companyId, deletedAt: null, status: { in: ['CONCLUIDA', 'APROVADA'] }, updatedAt: { gte: todayStart } },
    });

    return { total, byStatus, overdue, completedToday };
  }

  async monthlyUsage(companyId: string) {
    const now = new Date();
    const { periodStart, periodEnd } = await this.getBillingPeriod(companyId);

    const [osCount, avulsaNfseCount, company] = await Promise.all([
      this.prisma.serviceOrder.count({
        where: { companyId, createdAt: { gte: periodStart, lte: periodEnd } },
        // Deletadas CONTAM no limite — evita burlar criando e apagando
      }),
      // NFS-e avulsas (sem OS) contam como transações no limite
      this.prisma.nfseEmission.count({
        where: {
          companyId,
          serviceOrderId: null,
          status: { not: 'ERROR' },
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }).catch(() => 0),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { maxOsPerMonth: true, maxUsers: true },
      }),
    ]);

    const usedThisMonth = osCount + avulsaNfseCount;
    const limit = company?.maxOsPerMonth || 0;
    const isUnlimited = limit === 0;
    const percentage = isUnlimited ? 0 : Math.round((usedThisMonth / limit) * 100);
    const daysLeft = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      usedThisMonth,
      maxOsPerMonth: limit,
      isUnlimited,
      percentage: Math.min(percentage, 100),
      daysLeft,
      maxUsers: company?.maxUsers || 0,
      osCount,
      avulsaNfseCount,
    };
  }

  /* ── Agenda CLT ─────────────────────────────────────────── */

  async findAgenda(companyId: string, dateFrom: string, dateTo: string) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo + 'T23:59:59.999Z');

    return this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        scheduledStartAt: { gte: from, lte: to },
        status: { notIn: ['CANCELADA'] },
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        scheduledStartAt: true,
        estimatedDurationMinutes: true,
        valueCents: true,
        addressText: true,
        city: true,
        neighborhood: true,
        lat: true,
        lng: true,
        assignedPartner: { select: { id: true, name: true, phone: true } },
        clientPartner: { select: { id: true, name: true } },
      },
      orderBy: { scheduledStartAt: 'asc' },
    });
  }

  async checkConflicts(
    companyId: string,
    technicianId: string,
    scheduledStartAt: string,
    durationMinutes: number,
    excludeOrderId?: string,
  ) {
    const start = new Date(scheduledStartAt);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const where: any = {
      companyId,
      deletedAt: null,
      assignedPartnerId: technicianId,
      status: { notIn: ['CANCELADA', 'CONCLUIDA', 'APROVADA'] },
      scheduledStartAt: { not: null },
    };
    if (excludeOrderId) {
      where.id = { not: excludeOrderId };
    }

    const orders = await this.prisma.serviceOrder.findMany({
      where,
      select: {
        id: true, title: true, code: true,
        scheduledStartAt: true, estimatedDurationMinutes: true,
      },
    });

    const conflicts = orders.filter(o => {
      const oStart = new Date(o.scheduledStartAt!);
      const oEnd = new Date(oStart.getTime() + (o.estimatedDurationMinutes || 60) * 60 * 1000);
      return start < oEnd && end > oStart;
    });

    return { hasConflict: conflicts.length > 0, conflicts };
  }

  /**
   * Returns all active (non-terminal) OS for the dispatch panel.
   * Called once on login/mount to populate the floating cards.
   */
  async getActiveDispatches(companyId: string) {
    const terminalStatuses: ServiceOrderStatus[] = [
      ServiceOrderStatus.CONCLUIDA,
      ServiceOrderStatus.APROVADA,
      ServiceOrderStatus.CANCELADA,
    ];
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: terminalStatuses },
        assignedPartnerId: { not: null },
      },
      include: {
        clientPartner: { select: { name: true } },
        assignedPartner: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to avoid overloading
    });

    // Fetch notification status + last GPS location for each OS in parallel
    const results = await Promise.all(
      orders.map(async (so) => {
        const [notification, location] = await Promise.all([
          this.notifications
            ? this.notifications.getDispatchStatus(so.id, companyId)
            : null,
          this.getLastTechnicianLocation(so.id),
        ]);
        return {
          serviceOrder: {
            id: so.id, code: so.code, title: so.title, description: so.description,
            status: so.status, assignedPartnerId: so.assignedPartnerId,
            acceptedAt: so.acceptedAt, enRouteAt: so.enRouteAt,
            arrivedAt: so.arrivedAt, startedAt: so.startedAt, completedAt: so.completedAt,
            valueCents: so.valueCents, deadlineAt: so.deadlineAt,
            scheduledStartAt: so.scheduledStartAt, createdAt: so.createdAt,
            addressText: so.addressText, city: so.city, state: so.state,
            neighborhood: so.neighborhood,
            isUrgent: so.isUrgent, isReturn: so.isReturn,
            clientName: so.clientPartner?.name || null,
            lat: so.lat, lng: so.lng,
          },
          technician: so.assignedPartner
            ? { name: so.assignedPartner.name, phone: so.assignedPartner.phone }
            : null,
          notification,
          location,
        };
      }),
    );

    return results;
  }

  /**
   * Lightweight dispatch status for polling (used by DispatchPanel).
   */
  async getDispatchStatus(id: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true, code: true, title: true, description: true, status: true,
        assignedPartnerId: true, acceptedAt: true,
        enRouteAt: true, arrivedAt: true, startedAt: true, completedAt: true,
        valueCents: true, deadlineAt: true, scheduledStartAt: true,
        addressText: true, city: true, state: true, neighborhood: true,
        isUrgent: true, isReturn: true, createdAt: true,
        lat: true, lng: true,
        clientPartner: { select: { name: true } },
        assignedPartner: { select: { name: true, phone: true } },
      },
    });
    if (!so) throw new NotFoundException('OS não encontrada');

    // Get notification status
    const notification = this.notifications
      ? await this.notifications.getDispatchStatus(id, companyId)
      : null;

    // Get last technician GPS location for this OS
    const location = await this.getLastTechnicianLocation(id);

    return {
      serviceOrder: {
        id: so.id, code: so.code, title: so.title, description: so.description,
        status: so.status, assignedPartnerId: so.assignedPartnerId,
        acceptedAt: so.acceptedAt, enRouteAt: so.enRouteAt,
        arrivedAt: so.arrivedAt, startedAt: so.startedAt, completedAt: so.completedAt,
        valueCents: so.valueCents, deadlineAt: so.deadlineAt,
        scheduledStartAt: so.scheduledStartAt, createdAt: so.createdAt,
        addressText: so.addressText, city: so.city, state: so.state,
        neighborhood: so.neighborhood,
        isUrgent: so.isUrgent, isReturn: so.isReturn,
        clientName: so.clientPartner?.name || null,
        lat: so.lat, lng: so.lng,
      },
      technician: so.assignedPartner
        ? { name: so.assignedPartner.name, phone: so.assignedPartner.phone }
        : null,
      notification,
      location,
    };
  }

  /**
   * Returns the last known GPS position of the technician for a given service order.
   */
  private async getLastTechnicianLocation(serviceOrderId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT lat, lng, accuracy, speed, heading, "distanceToTarget", "createdAt"
        FROM "TechnicianLocationLog"
        WHERE "serviceOrderId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
      `, serviceOrderId);
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        lat: r.lat,
        lng: r.lng,
        accuracy: r.accuracy,
        speed: r.speed,
        heading: r.heading,
        distanceMeters: r.distanceToTarget,
        updatedAt: r.createdAt,
      };
    } catch {
      return null;
    }
  }

  async findOne(id: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        assignedPartner: { select: { id: true, name: true, phone: true } },
        clientPartner: { select: { id: true, name: true } },
        workflowTemplate: { select: { id: true, name: true, steps: true } },
        workflowStepLogs: { orderBy: { stepOrder: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
        attachments: { orderBy: { createdAt: 'asc' } },
        items: { include: { service: { select: { id: true, name: true, unit: true, priceCents: true } } } },
      },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    return so;
  }

  async assign(id: string, technicianId: string, companyId: string, actor?: AuthenticatedUser) {
    const so = await this.findOne(id, companyId);

    // Block assignment on terminal statuses
    if (TERMINAL_STATUSES.includes(so.status as ServiceOrderStatus)) {
      throw new ForbiddenException('Não é possível atribuir técnico a uma OS neste status.');
    }

    let result;
    if (!so.workflowTemplateId && this.workflowEngine) {
      // Auto-attach workflow by trigger (priority: urgent > return > normal)
      const triggerIds: string[] = [];
      if (so.isUrgent) triggerIds.push('os_urgent_created');
      if (so.isReturn) triggerIds.push('os_return_created');
      triggerIds.push('os_created');
      const matched = await this.workflowEngine.findWorkflowByTrigger(companyId, triggerIds);
      if (matched) {
        result = await this.prisma.serviceOrder.update({
          where: { id },
          data: { assignedPartnerId: technicianId, acceptedAt: new Date(), status: ServiceOrderStatus.ATRIBUIDA, workflowTemplateId: matched.id },
        });
      }
    }

    if (!result) {
      result = await this.prisma.serviceOrder.update({
        where: { id },
        data: { assignedPartnerId: technicianId, acceptedAt: new Date(), status: ServiceOrderStatus.ATRIBUIDA },
      });
    }

    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: id,
      action: 'ASSIGNED', actorType: 'USER', actorId: actor?.id, actorName: actor?.email,
      after: { assignedPartnerId: technicianId, status: 'ATRIBUIDA' },
    });

    if (this.notifications) {
      const tech = await this.prisma.partner.findUnique({ where: { id: technicianId }, select: { phone: true } });
      this.notifications.notifyStatusChange(companyId, id, so.title, 'ATRIBUIDA', tech?.phone ?? undefined).catch(() => {});
    }

    this.dispatchAutomation({
      companyId, entity: 'SERVICE_ORDER', entityId: id, eventType: 'assigned',
      data: { status: 'ATRIBUIDA', oldStatus: so.status, state: (so as any).state, city: (so as any).city, neighborhood: (so as any).neighborhood, valueCents: so.valueCents, assignedPartnerId: technicianId, clientPartnerId: so.clientPartnerId ?? undefined, title: so.title, description: so.description ?? undefined, addressStreet: (so as any).addressStreet, cep: (so as any).cep, deadlineAt: so.deadlineAt?.toISOString(), createdAt: so.createdAt?.toISOString() },
    });

    // Execute workflow stage notifications (NOTIFY blocks for ATRIBUIDA)
    if (this.workflowEngine) {
      this.workflowEngine.executeStageNotifications(id, companyId, ServiceOrderStatus.ATRIBUIDA).catch(() => {});
    }

    return result;
  }

  async updateStatus(id: string, status: ServiceOrderStatus, companyId: string, actor?: AuthenticatedUser) {
    const so = await this.findOne(id, companyId);
    const oldStatus = so.status;

    // ── State machine validation ──
    const allowed = ALLOWED_TRANSITIONS[oldStatus];
    if (!allowed || allowed.length === 0) {
      throw new ForbiddenException(`OS em status ${oldStatus} não pode ser alterada.`);
    }
    if (!allowed.includes(status)) {
      throw new ForbiddenException(`Transição ${oldStatus} → ${status} não permitida.`);
    }

    const data: any = { status };
    if (status === ServiceOrderStatus.EM_EXECUCAO && !so.startedAt) data.startedAt = new Date();
    if ((status === ServiceOrderStatus.CONCLUIDA || status === ServiceOrderStatus.APROVADA) && !so.completedAt) data.completedAt = new Date();

    const updated = await this.prisma.serviceOrder.update({ where: { id }, data });

    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: id,
      action: 'STATUS_CHANGED', actorType: 'USER', actorId: actor?.id, actorName: actor?.email,
      before: { status: oldStatus }, after: { status },
    });

    if (this.notifications) {
      this.notifications.notifyStatusChange(companyId, id, so.title, status, so.assignedPartner?.phone ?? undefined).catch(() => {});
    }

    // Determine specific event type for automation
    const eventMap: Record<string, string> = {
      CONCLUIDA: 'completed', APROVADA: 'approved', CANCELADA: 'cancelled',
    };
    const eventType = eventMap[status] || 'status_changed';

    this.dispatchAutomation({
      companyId, entity: 'SERVICE_ORDER', entityId: id, eventType,
      data: { status, oldStatus, state: (so as any).state, city: (so as any).city, neighborhood: (so as any).neighborhood, valueCents: so.valueCents, assignedPartnerId: so.assignedPartnerId ?? undefined, clientPartnerId: so.clientPartnerId ?? undefined, title: so.title, description: so.description ?? undefined, addressStreet: (so as any).addressStreet, cep: (so as any).cep, deadlineAt: so.deadlineAt?.toISOString(), createdAt: so.createdAt?.toISOString() },
    });

    // Execute workflow stage notifications (NOTIFY blocks for new status)
    if (this.workflowEngine) {
      this.workflowEngine.executeStageNotifications(id, companyId, status).catch(() => {});
    }

    return updated;
  }

  async update(id: string, companyId: string, data: UpdateServiceOrderDto, actor: AuthenticatedUser) {
    const so = await this.findOne(id, companyId);

    if (TERMINAL_STATUSES.includes(so.status as ServiceOrderStatus)) {
      throw new ForbiddenException('Não é possível editar uma OS neste status');
    }

    const updateData: any = {};
    const beforeFields: Record<string, any> = {};
    const afterFields: Record<string, any> = {};

    const DATE_FIELDS = ['deadlineAt', 'scheduledStartAt'];
    const checkField = (key: string, newVal: any, oldVal: any) => {
      if (newVal !== undefined && newVal !== oldVal) {
        beforeFields[key] = oldVal;
        afterFields[key] = newVal;
        updateData[key] = DATE_FIELDS.includes(key) ? new Date(newVal) : newVal;
      }
    };

    checkField('title', data.title, so.title);
    checkField('description', data.description, so.description);
    checkField('addressText', data.addressText, so.addressText);
    checkField('lat', data.lat, so.lat);
    checkField('lng', data.lng, so.lng);
    checkField('valueCents', data.valueCents, so.valueCents);
    checkField('deadlineAt', data.deadlineAt, so.deadlineAt?.toISOString());
    // Endereço estruturado
    checkField('addressStreet', data.addressStreet, (so as any).addressStreet);
    checkField('addressNumber', data.addressNumber, (so as any).addressNumber);
    checkField('addressComp', data.addressComp, (so as any).addressComp);
    checkField('neighborhood', data.neighborhood, (so as any).neighborhood);
    checkField('city', data.city, (so as any).city);
    checkField('state', data.state, (so as any).state);
    checkField('cep', data.cep, (so as any).cep);

    if (data.clientPartnerId !== undefined) {
      const newVal = data.clientPartnerId || null;
      if (newVal !== so.clientPartnerId) {
        beforeFields['clientPartnerId'] = so.clientPartnerId;
        afterFields['clientPartnerId'] = newVal;
        updateData['clientPartnerId'] = newVal;
      }
    }

    // Atribuição de técnico (v1.00.24)
    checkField('techAssignmentMode', data.techAssignmentMode, (so as any).techAssignmentMode);
    if (data.requiredSpecializationIds !== undefined) {
      updateData['requiredSpecializationIds'] = data.requiredSpecializationIds;
      afterFields['requiredSpecializationIds'] = data.requiredSpecializationIds;
    }
    if (data.directedTechnicianIds !== undefined) {
      updateData['directedTechnicianIds'] = data.directedTechnicianIds;
      afterFields['directedTechnicianIds'] = data.directedTechnicianIds;
    }
    checkField('contactPersonName', data.contactPersonName, (so as any).contactPersonName);
    if (data.acceptTimeoutMinutes !== undefined) {
      checkField('acceptTimeoutMinutes', data.acceptTimeoutMinutes, (so as any).acceptTimeoutMinutes);
    }
    if (data.enRouteTimeoutMinutes !== undefined) {
      checkField('enRouteTimeoutMinutes', data.enRouteTimeoutMinutes, (so as any).enRouteTimeoutMinutes);
    }
    if (data.workflowTemplateId !== undefined) {
      const newVal = data.workflowTemplateId || null;
      if (newVal !== so.workflowTemplateId) {
        beforeFields['workflowTemplateId'] = so.workflowTemplateId;
        afterFields['workflowTemplateId'] = newVal;
        updateData['workflowTemplateId'] = newVal;
      }
    }
    // Obra vinculada (v1.00.88)
    if (data.obraId !== undefined) {
      const newVal = data.obraId || null;
      if (newVal !== (so as any).obraId) {
        beforeFields['obraId'] = (so as any).obraId;
        afterFields['obraId'] = newVal;
        updateData['obraId'] = newVal;
      }
    }
    // Agendamento CLT (v1.01.72)
    if (data.scheduledStartAt !== undefined) {
      checkField('scheduledStartAt', data.scheduledStartAt, (so as any).scheduledStartAt?.toISOString());
    }
    if (data.estimatedDurationMinutes !== undefined) {
      checkField('estimatedDurationMinutes', data.estimatedDurationMinutes, (so as any).estimatedDurationMinutes);
    }
    // Comissão e retorno (v1.01.81)
    if (data.commissionBps !== undefined) {
      checkField('commissionBps', data.commissionBps, (so as any).commissionBps);
    }
    if (data.techCommissionCents !== undefined) {
      checkField('techCommissionCents', data.techCommissionCents, (so as any).techCommissionCents);
    }
    if (data.isReturn !== undefined) {
      checkField('isReturn', data.isReturn, (so as any).isReturn);
    }
    if (data.returnPaidToTech !== undefined) {
      checkField('returnPaidToTech', data.returnPaidToTech, (so as any).returnPaidToTech);
    }
    if (data.isUrgent !== undefined) {
      checkField('isUrgent', data.isUrgent, (so as any).isUrgent);
    }

    // Atualizar itens de serviço (v1.03.66) — replace strategy
    if (data.items !== undefined) {
      await this.prisma.serviceOrderItem.deleteMany({ where: { serviceOrderId: id } });
      if (data.items.length > 0) {
        const services = await this.prisma.service.findMany({
          where: { id: { in: data.items.map(i => i.serviceId) }, companyId, deletedAt: null },
        });
        const serviceMap = new Map(services.map(s => [s.id, s]));
        const itemsData = data.items
          .filter(i => serviceMap.has(i.serviceId))
          .map(i => {
            const svc = serviceMap.get(i.serviceId)!;
            return {
              serviceOrderId: id,
              serviceId: svc.id,
              serviceName: svc.name,
              unit: svc.unit || 'SV',
              unitPriceCents: svc.priceCents || 0,
              commissionBps: (svc as any).commissionBps ?? null,
              quantity: i.quantity || 1,
            };
          });
        if (itemsData.length) {
          await this.prisma.serviceOrderItem.createMany({ data: itemsData });
        }
      }
      // Recalculate valueCents from items if items were provided
      const newItems = await this.prisma.serviceOrderItem.findMany({ where: { serviceOrderId: id } });
      const newTotal = newItems.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
      if (newTotal > 0 && updateData['valueCents'] === undefined) {
        updateData['valueCents'] = newTotal;
      }
    }

    if (Object.keys(updateData).length === 0 && data.items === undefined) return so;

    const updated = await this.prisma.serviceOrder.update({ where: { id }, data: updateData });

    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: id,
      action: 'UPDATED', actorType: 'USER', actorId: actor.id, actorName: actor.email,
      before: beforeFields, after: afterFields,
    });

    this.dispatchAutomation({
      companyId, entity: 'SERVICE_ORDER', entityId: id, eventType: 'updated',
      data: { status: so.status, state: (updated as any).state, city: (updated as any).city, neighborhood: (updated as any).neighborhood, valueCents: (updated as any).valueCents, assignedPartnerId: so.assignedPartnerId ?? undefined, clientPartnerId: (updated as any).clientPartnerId ?? undefined, title: (updated as any).title, description: (updated as any).description, addressStreet: (updated as any).addressStreet, cep: (updated as any).cep, deadlineAt: (updated as any).deadlineAt?.toISOString(), createdAt: so.createdAt?.toISOString() },
    });

    return updated;
  }

  async cancel(id: string, companyId: string, actor: AuthenticatedUser, reason?: string) {
    const so = await this.findOne(id, companyId);

    if (TERMINAL_STATUSES.includes(so.status as ServiceOrderStatus)) {
      throw new ForbiddenException('OS já está em status terminal');
    }

    const updated = await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: ServiceOrderStatus.CANCELADA,
        cancelledReason: reason || null,
        cancelledByName: actor.email,
      },
    });

    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: id,
      action: 'CANCELLED', actorType: 'USER', actorId: actor.id, actorName: actor.email,
      before: { status: so.status }, after: { status: 'CANCELADA', reason: reason || undefined },
    });

    this.dispatchAutomation({
      companyId, entity: 'SERVICE_ORDER', entityId: id, eventType: 'cancelled',
      data: { status: 'CANCELADA', oldStatus: so.status, state: (so as any).state, city: (so as any).city, valueCents: so.valueCents, assignedPartnerId: so.assignedPartnerId ?? undefined, clientPartnerId: so.clientPartnerId ?? undefined, title: so.title, description: so.description ?? undefined, addressStreet: (so as any).addressStreet, cep: (so as any).cep, deadlineAt: so.deadlineAt?.toISOString(), createdAt: so.createdAt?.toISOString() },
    });

    return updated;
  }

  async duplicate(id: string, companyId: string, actor: AuthenticatedUser) {
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
          `Limite de ${maxOs} transações por mês atingido. Não é possível duplicar. Faça upgrade do plano ou adquira OS adicionais.`,
        );
      }
    }

    const so = await this.findOne(id, companyId);

    const result = await this.prisma.serviceOrder.create({
      data: {
        companyId,
        title: `${so.title} (cópia)`,
        description: so.description,
        addressText: so.addressText,
        lat: so.lat,
        lng: so.lng,
        valueCents: so.valueCents,
        deadlineAt: so.deadlineAt,
        clientPartnerId: so.clientPartnerId,
        // Copiar endereço estruturado
        addressStreet: (so as any).addressStreet,
        addressNumber: (so as any).addressNumber,
        addressComp: (so as any).addressComp,
        neighborhood: (so as any).neighborhood,
        city: (so as any).city,
        state: (so as any).state,
        cep: (so as any).cep,
        // Copiar atribuição de técnico
        techAssignmentMode: (so as any).techAssignmentMode,
        requiredSpecializationIds: (so as any).requiredSpecializationIds || [],
        directedTechnicianIds: (so as any).directedTechnicianIds || [],
        contactPersonName: (so as any).contactPersonName,
        acceptTimeoutMinutes: (so as any).acceptTimeoutMinutes,
        enRouteTimeoutMinutes: (so as any).enRouteTimeoutMinutes,
      },
    });

    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: result.id,
      action: 'DUPLICATED', actorType: 'USER', actorId: actor.id, actorName: actor.email,
      after: { sourceId: id, title: result.title },
    });

    return result;
  }

  async remove(id: string, companyId: string, actor?: AuthenticatedUser) {
    await this.findOne(id, companyId);
    const result = await this.prisma.serviceOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: id,
      action: 'DELETED', actorType: 'USER', actorId: actor?.id, actorName: actor?.email,
    });

    this.dispatchAutomation({
      companyId, entity: 'SERVICE_ORDER', entityId: id, eventType: 'deleted',
      data: { status: (result as any).status, title: (result as any).title, description: (result as any).description, addressStreet: (result as any).addressStreet, cep: (result as any).cep, deadlineAt: (result as any).deadlineAt?.toISOString(), createdAt: (result as any).createdAt?.toISOString() },
    });

    return result;
  }

  /* ── Finalize (Confirmar OS) ─────────────────────── */

  async finalizePreview(id: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        company: true,
        assignedPartner: { select: { id: true, name: true } },
        clientPartner: { select: { id: true, name: true } },
        ledger: true,
      },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (TERMINAL_STATUSES.includes(so.status as ServiceOrderStatus)) {
      throw new BadRequestException('OS já está em status terminal');
    }
    if (so.ledger) {
      throw new BadRequestException('OS já foi finalizada (repasse já existe)');
    }

    // Check workflow completeness
    let needsTechFinalization = false;
    const techName = so.assignedPartner?.name || null;
    if (so.workflowTemplateId && this.workflowEngine) {
      try {
        const progress = await this.workflowEngine.getProgress(id, companyId);
        if (progress && !(progress as any).isComplete) {
          needsTechFinalization = true;
        }
      } catch { /* no workflow progress = no issue */ }
    }

    // Calculate financial entries preview
    const grossCents = so.valueCents;
    const effectiveBps = so.commissionBps ?? 0;
    const effectiveTechCents = so.techCommissionCents ?? Math.round((grossCents * effectiveBps) / 10000);
    const companyKeeps = grossCents - effectiveTechCents;

    const entries: Array<{
      type: 'RECEIVABLE' | 'PAYABLE';
      partnerName: string | null;
      description: string;
      grossCents: number;
      commissionBps: number;
      commissionCents: number;
      netCents: number;
    }> = [];

    // RECEIVABLE (a receber do cliente)
    if (so.clientPartnerId) {
      entries.push({
        type: 'RECEIVABLE',
        partnerName: so.clientPartner?.name || null,
        description: `A receber OS: ${so.title}`,
        grossCents,
        commissionBps: 0,
        commissionCents: 0,
        netCents: grossCents,
      });
    }

    // PAYABLE (a pagar ao tecnico)
    const isReturn = (so as any).isReturn ?? false;
    const returnPaidToTech = (so as any).returnPaidToTech ?? true;
    const shouldPayTech = so.assignedPartnerId && (!isReturn || returnPaidToTech);
    if (shouldPayTech) {
      entries.push({
        type: 'PAYABLE',
        partnerName: so.assignedPartner?.name || null,
        description: `Repasse técnico OS: ${so.title}`,
        grossCents,
        commissionBps: effectiveBps,
        commissionCents: companyKeeps,
        netCents: effectiveTechCents,
      });
    }

    return {
      needsTechFinalization,
      techName,
      osTitle: so.title,
      osCode: (so as any).code,
      isReturn,
      returnPaidToTech,
      entries,
    };
  }

  async finalize(id: string, companyId: string, actor: AuthenticatedUser) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        company: true,
        assignedPartner: { select: { id: true, name: true } },
        clientPartner: { select: { id: true, name: true } },
        ledger: true,
      },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (TERMINAL_STATUSES.includes(so.status as ServiceOrderStatus)) {
      throw new BadRequestException('OS já está em status terminal');
    }
    if (so.ledger) {
      throw new BadRequestException('OS já foi finalizada');
    }

    const grossCents = so.valueCents;
    const effectiveBps = so.commissionBps ?? 0;
    const effectiveTechCents = so.techCommissionCents ?? Math.round((grossCents * effectiveBps) / 10000);
    const companyKeeps = grossCents - effectiveTechCents;

    const isReturn = (so as any).isReturn ?? false;
    const returnPaidToTech = (so as any).returnPaidToTech ?? true;
    const shouldPayTech = so.assignedPartnerId && (!isReturn || returnPaidToTech);

    // Generate codes before transaction
    const codes: string[] = [];
    if (so.clientPartnerId) {
      codes.push(await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY'));
    }
    if (shouldPayTech) {
      codes.push(await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY'));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const createdEntries: any[] = [];
      let codeIdx = 0;

      // 1. RECEIVABLE (a receber do cliente)
      if (so.clientPartnerId) {
        const receivable = await tx.financialEntry.create({
          data: {
            companyId,
            code: codes[codeIdx++],
            serviceOrderId: id,
            partnerId: so.clientPartnerId,
            type: 'RECEIVABLE',
            status: 'PENDING',
            description: `A receber OS: ${so.title}`,
            grossCents,
            netCents: grossCents,
          },
        });
        createdEntries.push(receivable);
      }

      // 2. PAYABLE (a pagar ao tecnico)
      if (shouldPayTech) {
        const payable = await tx.financialEntry.create({
          data: {
            companyId,
            code: codes[codeIdx++],
            serviceOrderId: id,
            partnerId: so.assignedPartnerId!,
            type: 'PAYABLE',
            status: 'CONFIRMED',
            description: `Repasse técnico OS: ${so.title}`,
            grossCents,
            commissionBps: effectiveBps,
            commissionCents: companyKeeps,
            netCents: effectiveTechCents,
            confirmedAt: new Date(),
          },
        });
        createdEntries.push(payable);
      }

      // 3. ServiceOrderLedger (backward compat)
      await tx.serviceOrderLedger.create({
        data: {
          serviceOrderId: id,
          grossCents,
          commissionBps: effectiveBps,
          commissionCents: companyKeeps,
          netCents: effectiveTechCents,
          confirmedAt: new Date(),
        },
      });

      // 4. Update OS status to CONCLUIDA
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.CONCLUIDA,
          completedAt: so.completedAt || new Date(),
        },
      });

      return { entries: createdEntries, status: updated.status };
    });

    // Fire-and-forget: audit + automation
    this.audit.log({
      companyId, entityType: 'SERVICE_ORDER', entityId: id,
      action: 'FINALIZED', actorType: 'USER', actorId: actor?.id, actorName: actor?.email,
      after: { status: 'CONCLUIDA', entriesCreated: result.entries.length },
    });

    this.dispatchAutomation({
      companyId, entity: 'SERVICE_ORDER', entityId: id, eventType: 'completed',
      data: { status: 'CONCLUIDA', oldStatus: so.status, valueCents: so.valueCents, title: so.title },
    });

    // Fire-and-forget: generate client evaluation token and send notification
    if (so.assignedPartnerId && so.clientPartnerId && this.evaluationService) {
      this.generateAndSendEvaluationLink(id, so.assignedPartnerId, companyId, so.title, so.clientPartnerId)
        .catch((err) => this.audit.log({
          companyId, entityType: 'SERVICE_ORDER', entityId: id,
          action: 'EVAL_TOKEN_ERROR', actorType: 'SYSTEM', actorId: 'system',
          after: { error: err.message },
        }));
    }

    return result;
  }

  private async generateAndSendEvaluationLink(
    serviceOrderId: string,
    technicianId: string,
    companyId: string,
    osTitle: string,
    clientPartnerId: string,
  ) {
    const token = await this.evaluationService!.generateClientEvaluationToken(
      serviceOrderId, technicianId, companyId,
    );

    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    const evaluationLink = `${baseUrl}/rate/${token}`;

    // Get client phone for notification
    const client = await this.prisma.partner.findUnique({
      where: { id: clientPartnerId },
      select: { phone: true, name: true },
    });

    if (client?.phone && this.notifications) {
      await this.notifications.send({
        companyId,
        serviceOrderId,
        channel: 'WHATSAPP',
        recipientPhone: client.phone,
        message: `Olá ${client.name || ''}! O serviço "${osTitle}" foi concluído. Avalie o atendimento: ${evaluationLink}`,
        type: 'EVALUATION_REQUEST',
        forceTemplate: true,
      });
    }
  }
}
