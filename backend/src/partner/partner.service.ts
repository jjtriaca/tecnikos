import { Injectable, NotFoundException, ForbiddenException, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AutomationEngineService, AutomationEvent } from '../automation/automation-engine.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { AuthenticatedUser } from '../auth/auth.types';
import * as bcrypt from 'bcrypt';

const SORTABLE_COLUMNS = ['name', 'document', 'email', 'phone', 'status', 'rating', 'createdAt'];

@Injectable()
export class PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() @Inject(AutomationEngineService) private readonly automationEngine?: AutomationEngineService,
  ) {}

  /** Fire-and-forget automation dispatch */
  private dispatchAutomation(event: AutomationEvent): void {
    this.automationEngine?.dispatch(event).catch(() => {});
  }

  async findAll(
    companyId: string,
    filters: { type?: string; status?: string; personType?: string },
    pagination?: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };
    if (filters.type) {
      where.partnerTypes = { has: filters.type };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.personType) {
      where.personType = filters.personType;
    }
    if (pagination?.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { document: { contains: pagination.search } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
        { phone: { contains: pagination.search } },
      ];
    }

    const orderBy = buildOrderBy(pagination?.sortBy, pagination?.sortOrder, SORTABLE_COLUMNS, { name: 'asc' });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.partner.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          specializations: { include: { specialization: true } },
        },
      }),
      this.prisma.partner.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { id, deletedAt: null },
      include: {
        specializations: { include: { specialization: true } },
        evaluations: {
          where: { score: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            serviceOrder: { select: { title: true } },
          },
        },
      },
    });
    if (!partner) throw new NotFoundException('Parceiro não encontrado');
    if (partner.companyId !== companyId) {
      throw new ForbiddenException('Acesso negado');
    }
    return partner;
  }

  async create(companyId: string, data: CreatePartnerDto, actor?: AuthenticatedUser) {
    const { specializationIds, password, ...rest } = data;
    const createData: any = { companyId, ...rest };

    if (password && data.partnerTypes?.includes('TECNICO')) {
      createData.passwordHash = await bcrypt.hash(password, 10);
    }
    delete createData.password;
    delete createData.specializationIds;

    const partner = await this.prisma.partner.create({ data: createData });

    if (specializationIds?.length && data.partnerTypes?.includes('TECNICO')) {
      await this.prisma.partnerSpecialization.createMany({
        data: specializationIds.map((sid) => ({
          partnerId: partner.id,
          specializationId: sid,
        })),
        skipDuplicates: true,
      });
    }

    this.audit.log({
      companyId,
      entityType: 'PARTNER',
      entityId: partner.id,
      action: 'CREATED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
      after: { name: partner.name, personType: partner.personType, partnerTypes: data.partnerTypes },
    });

    this.dispatchAutomation({
      companyId, entity: 'PARTNER', entityId: partner.id, eventType: 'partner_created',
      data: { status: partner.status, personType: partner.personType, partnerTypes: data.partnerTypes, state: partner.state ?? undefined, city: partner.city ?? undefined, name: partner.name, rating: partner.rating },
    });

    return this.findOne(partner.id, companyId);
  }

  async update(id: string, companyId: string, data: UpdatePartnerDto, actor?: AuthenticatedUser) {
    const existing = await this.findOne(id, companyId);
    const { specializationIds, password, ...rest } = data;
    const updateData: any = {};
    const beforeFields: Record<string, any> = {};
    const afterFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== (existing as any)[key]) {
        beforeFields[key] = (existing as any)[key];
        afterFields[key] = value;
        updateData[key] = value;
      }
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
      // Never include password hash in audit — just note that password was changed
      afterFields['password'] = '***alterada***';
    }

    await this.prisma.partner.update({ where: { id }, data: updateData });

    if (specializationIds !== undefined) {
      await this.prisma.partnerSpecialization.deleteMany({
        where: { partnerId: id },
      });
      if (specializationIds.length > 0) {
        await this.prisma.partnerSpecialization.createMany({
          data: specializationIds.map((sid) => ({
            partnerId: id,
            specializationId: sid,
          })),
          skipDuplicates: true,
        });
      }
      afterFields['specializationIds'] = specializationIds;
    }

    if (Object.keys(afterFields).length > 0) {
      this.audit.log({
        companyId,
        entityType: 'PARTNER',
        entityId: id,
        action: 'UPDATED',
        actorType: 'USER',
        actorId: actor?.id,
        actorName: actor?.email,
        before: Object.keys(beforeFields).length > 0 ? beforeFields : undefined,
        after: afterFields,
      });

      this.dispatchAutomation({
        companyId, entity: 'PARTNER', entityId: id, eventType: 'partner_updated',
        data: { status: existing.status, personType: existing.personType, partnerTypes: existing.partnerTypes, state: (existing as any).state, city: (existing as any).city, name: existing.name, rating: existing.rating },
      });
    }

    return this.findOne(id, companyId);
  }

  async updateStatus(id: string, companyId: string, status: string, actor?: AuthenticatedUser) {
    const existing = await this.findOne(id, companyId);
    const oldStatus = existing.status;

    const result = await this.prisma.partner.update({
      where: { id },
      data: { status },
    });

    this.audit.log({
      companyId,
      entityType: 'PARTNER',
      entityId: id,
      action: 'STATUS_CHANGED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
      before: { status: oldStatus },
      after: { status },
    });

    this.dispatchAutomation({
      companyId, entity: 'PARTNER', entityId: id, eventType: 'partner_status_changed',
      data: { status, oldStatus, personType: existing.personType, partnerTypes: existing.partnerTypes, state: (existing as any).state, city: (existing as any).city, name: existing.name, rating: existing.rating },
    });

    return result;
  }

  async remove(id: string, companyId: string, actor?: AuthenticatedUser) {
    await this.findOne(id, companyId);
    const result = await this.prisma.partner.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.audit.log({
      companyId,
      entityType: 'PARTNER',
      entityId: id,
      action: 'DELETED',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
    });

    this.dispatchAutomation({
      companyId, entity: 'PARTNER', entityId: id, eventType: 'partner_deleted',
      data: { status: (result as any).status, name: (result as any).name, personType: (result as any).personType },
    });

    return result;
  }

  /** Importa vários parceiros de uma vez (CSV import) */
  async importMany(
    companyId: string,
    partners: CreatePartnerDto[],
    actor?: AuthenticatedUser,
  ): Promise<{ created: number; skipped: number; errors: { row: number; name: string; message: string }[] }> {
    let created = 0;
    let skipped = 0;
    const errors: { row: number; name: string; message: string }[] = [];

    for (let i = 0; i < partners.length; i++) {
      const data = partners[i];
      try {
        // Verifica documento duplicado
        if (data.document) {
          const existing = await this.prisma.partner.findFirst({
            where: { companyId, document: data.document, deletedAt: null },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        // Verifica email duplicado
        if (data.email) {
          const existingEmail = await this.prisma.partner.findFirst({
            where: { companyId, email: data.email, deletedAt: null },
          });
          if (existingEmail) {
            skipped++;
            continue;
          }
        }

        const { specializationIds, password, ...rest } = data;
        const createData: any = { companyId, ...rest };
        delete createData.password;
        delete createData.specializationIds;

        await this.prisma.partner.create({ data: createData });
        created++;
      } catch (err: any) {
        errors.push({
          row: i + 1,
          name: data.name || `Linha ${i + 1}`,
          message: err.message?.slice(0, 120) || 'Erro desconhecido',
        });
      }
    }

    // Log de auditoria da importação
    this.audit.log({
      companyId,
      entityType: 'PARTNER',
      entityId: 'IMPORT',
      action: 'IMPORT',
      actorType: 'USER',
      actorId: actor?.id,
      actorName: actor?.email,
      after: { created, skipped, errors: errors.length, total: partners.length },
    });

    return { created, skipped, errors };
  }

  /** Find partners of type TECNICO that have ALL required specializations and are ATIVO */
  async findBySpecializations(companyId: string, specializationIds: string[]) {
    const where: any = {
      companyId,
      deletedAt: null,
      status: 'ATIVO',
      partnerTypes: { has: 'TECNICO' },
    };

    if (specializationIds.length > 0) {
      where.AND = specializationIds.map((sid) => ({
        specializations: { some: { specializationId: sid } },
      }));
    }

    return this.prisma.partner.findMany({
      where,
      include: {
        specializations: { include: { specialization: true } },
        _count: { select: { serviceOrders: true } },
      },
      orderBy: { rating: 'desc' },
    });
  }
}
