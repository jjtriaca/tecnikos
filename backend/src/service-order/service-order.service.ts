import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceOrderStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { AutomationEngineService, AutomationEvent } from '../automation/automation-engine.service';
import { WaitForService } from '../workflow/wait-for.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { AuthenticatedUser } from '../auth/auth.types';

const SORTABLE_COLUMNS = ['title', 'status', 'valueCents', 'deadlineAt', 'createdAt', 'acceptedAt', 'startedAt', 'completedAt'];

const TERMINAL_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.CONCLUIDA,
  ServiceOrderStatus.APROVADA,
  ServiceOrderStatus.CANCELADA,
];

@Injectable()
export class ServiceOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() @Inject(NotificationService) private readonly notifications?: NotificationService,
    @Optional() @Inject(AutomationEngineService) private readonly automationEngine?: AutomationEngineService,
    @Optional() @Inject(WaitForService) private readonly waitForService?: WaitForService,
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

  async create(data: CreateServiceOrderDto & { companyId: string }, actor?: AuthenticatedUser) {
    const result = await this.prisma.serviceOrder.create({
      data: {
        companyId: data.companyId,
        title: data.title,
        description: data.description,
        addressText: data.addressText,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        valueCents: data.valueCents,
        deadlineAt: new Date(data.deadlineAt),
        workflowTemplateId: data.workflowTemplateId || undefined,
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
      },
    });

    this.audit.log({
      companyId: data.companyId,
      entityType: 'SERVICE_ORDER',
      entityId: result.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
      after: { title: result.title, status: 'ABERTA' },
    });

    this.dispatchAutomation({
      companyId: data.companyId, entity: 'SERVICE_ORDER', entityId: result.id, eventType: 'created',
      data: { status: 'ABERTA', state: data.state, city: data.city, neighborhood: data.neighborhood, valueCents: data.valueCents, clientPartnerId: data.clientPartnerId, title: result.title, description: data.description, addressStreet: data.addressStreet, cep: data.cep, deadlineAt: data.deadlineAt, createdAt: result.createdAt?.toISOString() },
    });

    return result;
  }

  async findAll(
    companyId: string,
    pagination?: PaginationDto,
    filters?: { status?: string; dateFrom?: string; dateTo?: string; valueMin?: string; valueMax?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };
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
      where.OR = [
        { title: { contains: pagination.search, mode: 'insensitive' } },
        { addressText: { contains: pagination.search, mode: 'insensitive' } },
        { clientPartner: { name: { contains: pagination.search, mode: 'insensitive' } } },
      ];
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
      },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    return so;
  }

  async assign(id: string, technicianId: string, companyId: string, actor?: AuthenticatedUser) {
    const so = await this.findOne(id, companyId);

    let result;
    if (!so.workflowTemplateId) {
      const defaultWf = await this.prisma.workflowTemplate.findFirst({
        where: { companyId, isDefault: true, deletedAt: null },
      });
      if (defaultWf) {
        result = await this.prisma.serviceOrder.update({
          where: { id },
          data: { assignedPartnerId: technicianId, acceptedAt: new Date(), status: ServiceOrderStatus.ATRIBUIDA, workflowTemplateId: defaultWf.id },
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

    return result;
  }

  async updateStatus(id: string, status: ServiceOrderStatus, companyId: string, actor?: AuthenticatedUser) {
    const so = await this.findOne(id, companyId);
    const oldStatus = so.status;
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

    const checkField = (key: string, newVal: any, oldVal: any) => {
      if (newVal !== undefined && newVal !== oldVal) {
        beforeFields[key] = oldVal;
        afterFields[key] = newVal;
        updateData[key] = key === 'deadlineAt' ? new Date(newVal) : newVal;
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

    if (Object.keys(updateData).length === 0) return so;

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
}
