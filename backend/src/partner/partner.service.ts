import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AutomationEngineService, AutomationEvent } from '../automation/automation-engine.service';
import { ContractService } from '../contract/contract.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/util/build-order-by';
import { AuthenticatedUser } from '../auth/auth.types';
import * as bcrypt from 'bcrypt';

const SORTABLE_COLUMNS = ['name', 'document', 'email', 'phone', 'status', 'rating', 'createdAt'];

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeGenerator: CodeGeneratorService,
    @Optional() @Inject(AutomationEngineService) private readonly automationEngine?: AutomationEngineService,
    @Optional() @Inject(ContractService) private readonly contractService?: ContractService,
  ) {}

  /** Sanitize phone: remove non-digits, strip leading zero, limit to DDD+number */
  private sanitizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    // Strip leading zeros
    while (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    // If it has country code 55 and is too long, keep as-is
    if (digits.startsWith('55') && digits.length >= 12) {
      // Remove country code — store only DDD+number
      digits = digits.substring(2);
    }
    return digits || null;
  }

  /** Fire-and-forget automation dispatch */
  private dispatchAutomation(event: AutomationEvent): void {
    this.automationEngine?.dispatch(event).catch(() => {});
  }

  /** Fire-and-forget: check ANY workflow for technician onboarding config and send contract */
  private async dispatchTechnicianContract(
    companyId: string,
    partnerId: string,
    trigger: 'onNewTechnician' | 'onNewSpecialization',
    specializationId?: string,
  ): Promise<void> {
    if (!this.contractService) {
      this.logger.warn(`📄 ContractService not available — skipping dispatch`);
      return;
    }
    try {
      // Search ALL workflows for technician onboarding config (default first, then others)
      const workflows = await this.prisma.workflowTemplate.findMany({
        where: { companyId, isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });

      this.logger.log(`📄 Checking ${workflows.length} active workflow(s) for onboarding config (trigger: ${trigger})`);

      let onboarding: any = null;
      for (const wf of workflows) {
        const steps = wf.steps as any;
        if (steps?.technicianOnboarding?.enabled) {
          onboarding = steps.technicianOnboarding;
          this.logger.log(`📄 Found onboarding config in workflow "${wf.name}" (${wf.id})`);
          break;
        }
      }

      if (!onboarding) {
        this.logger.log(`📄 No onboarding config found in any workflow — skipping`);
        return;
      }

      const triggerConfig = onboarding[trigger];
      if (!triggerConfig?.enabled) {
        this.logger.log(`📄 Trigger "${trigger}" not enabled — skipping`);
        return;
      }

      // Check partner regime for CLT vs PJ dispatch
      const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
      if (!partner) {
        this.logger.warn(`📄 Partner ${partnerId} not found — skipping dispatch`);
        return;
      }

      if (partner.regime === 'CLT') {
        // CLT: send welcome message instead of contract
        if (triggerConfig.sendWelcomeMessage && triggerConfig.welcomeMessage) {
          this.logger.log(`👋 CLT tech — sending welcome message to ${partner.name}`);
          await this.contractService.sendWelcomeMessage({
            companyId,
            partnerId,
            channel: triggerConfig.welcomeChannel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
            message: triggerConfig.welcomeMessage,
            waitForReply: triggerConfig.welcomeWaitForReply ?? false,
            confirmVia: triggerConfig.welcomeConfirmVia || 'WHATSAPP',
          });
          this.logger.log(`👋 Welcome message dispatched for CLT tech ${partner.name} ✅`);
        } else {
          this.logger.log(`📄 CLT tech but sendWelcomeMessage off — skipping`);
        }
        return;
      }

      // PJ (default): send contract — existing behavior
      if (!triggerConfig.sendContractLink) {
        this.logger.log(`📄 Trigger "${trigger}" sendContractLink off — skipping`);
        return;
      }

      // Calculate expiration in days based on unit
      const unit = triggerConfig.expirationUnit || 'days';
      const rawValue = triggerConfig.expirationDays ?? 7;
      let expirationDays: number;
      if (unit === 'indefinite') {
        expirationDays = 36500; // ~100 years
      } else if (unit === 'months') {
        expirationDays = rawValue * 30;
      } else if (unit === 'years') {
        expirationDays = rawValue * 365;
      } else {
        expirationDays = rawValue;
      }

      this.logger.log(`📄 Sending contract to partner ${partnerId} via ${triggerConfig.channel || 'WHATSAPP'} (expires in ${expirationDays} days)...`);

      await this.contractService.sendContract({
        companyId,
        partnerId,
        trigger,
        specializationId: specializationId || undefined,
        contractName: triggerConfig.contractName || 'Contrato de Prestação de Serviços',
        contractContent: triggerConfig.contractContent || '',
        blockUntilAccepted: triggerConfig.blockUntilAccepted ?? true,
        requireSignature: triggerConfig.requireSignature ?? false,
        requireAcceptance: triggerConfig.requireAcceptance ?? true,
        expirationDays,
        channel: triggerConfig.channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
      });

      this.logger.log(`📄 Contract dispatched for partner ${partnerId} (${trigger}${specializationId ? `, spec: ${specializationId}` : ''}) ✅`);
    } catch (err) {
      this.logger.error(`Failed to dispatch technician contract: ${err.message}`, err.stack);
    }
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

  /**
   * Check for duplicate documents (CNPJ/CPF) within the same company.
   * Returns matching partners so the frontend can show a warning or block.
   */
  async checkDuplicateDocument(
    companyId: string,
    document: string,
    excludeId?: string,
  ): Promise<{ id: string; name: string; document: string | null; documentType: string | null; ie: string | null; partnerTypes: string[] }[]> {
    if (!document) return [];
    const cleanDoc = document.replace(/\D/g, '');
    if (!cleanDoc) return [];

    const where: any = {
      companyId,
      deletedAt: null,
      document: { contains: cleanDoc, mode: 'insensitive' },
    };
    if (excludeId) where.id = { not: excludeId };

    return this.prisma.partner.findMany({
      where,
      select: { id: true, name: true, document: true, documentType: true, ie: true, partnerTypes: true },
    });
  }

  async create(companyId: string, data: CreatePartnerDto & { forceDuplicate?: boolean }, actor?: AuthenticatedUser) {
    const { specializationIds, password, forceDuplicate, ...rest } = data;
    // Sanitize phone before saving
    if (rest.phone) rest.phone = this.sanitizePhone(rest.phone) as any;
    const createData: any = { companyId, ...rest };

    // Check for duplicate document
    if (data.document) {
      const duplicates = await this.checkDuplicateDocument(companyId, data.document);
      if (duplicates.length > 0) {
        const isCnpj = data.documentType === 'CNPJ';
        if (isCnpj && !forceDuplicate) {
          throw new ConflictException({
            message: `CNPJ ${data.document} já cadastrado para: ${duplicates.map(d => d.name).join(', ')}`,
            duplicates,
          });
        }
        // CPF: allow but frontend will have warned the user
      }
    }

    if (password && data.partnerTypes?.includes('TECNICO')) {
      createData.passwordHash = await bcrypt.hash(password, 10);
    }
    delete createData.password;
    delete createData.specializationIds;
    delete createData.forceDuplicate;

    // Auto-generate sequential code
    createData.code = await this.codeGenerator.generateCode(companyId, 'PARTNER');

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

    // Dispatch technician contract if partner is TECNICO
    if (data.partnerTypes?.includes('TECNICO')) {
      this.dispatchTechnicianContract(companyId, partner.id, 'onNewTechnician').catch(() => {});
    }

    return this.findOne(partner.id, companyId);
  }

  async update(id: string, companyId: string, data: UpdatePartnerDto, actor?: AuthenticatedUser) {
    const existing = await this.findOne(id, companyId);
    const { specializationIds, password, ...rest } = data;
    // Sanitize phone before saving
    if (rest.phone !== undefined) rest.phone = this.sanitizePhone(rest.phone) as any;
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

    await this.prisma.$transaction(async (tx) => {
      await tx.partner.update({ where: { id }, data: updateData });

      if (specializationIds !== undefined) {
        await tx.partnerSpecialization.deleteMany({
          where: { partnerId: id },
        });
        if (specializationIds.length > 0) {
          await tx.partnerSpecialization.createMany({
            data: specializationIds.map((sid) => ({
              partnerId: id,
              specializationId: sid,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    if (specializationIds !== undefined) {
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

      // Dispatch technician contract: new TECNICO assignment
      const wasTecnico = existing.partnerTypes.includes('TECNICO');
      const isTecnico = data.partnerTypes?.includes('TECNICO') ?? wasTecnico;
      if (!wasTecnico && isTecnico) {
        this.dispatchTechnicianContract(companyId, id, 'onNewTechnician').catch(() => {});
      }

      // Dispatch technician contract: one per new specialization added
      if (isTecnico && specializationIds !== undefined) {
        const existingSpecIds = (existing as any).specializations?.map((s: any) => s.specialization?.id || s.specializationId) ?? [];
        const newSpecIds = specializationIds.filter((sid: string) => !existingSpecIds.includes(sid));
        for (const specId of newSpecIds) {
          this.dispatchTechnicianContract(companyId, id, 'onNewSpecialization', specId).catch(() => {});
        }
      }
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

    // Pré-carrega documentos e emails existentes em batch (evita N queries)
    const existingPartners = await this.prisma.partner.findMany({
      where: { companyId, deletedAt: null },
      select: { document: true, email: true },
    });
    const existingDocs = new Set(existingPartners.map(p => p.document).filter(Boolean));
    const existingEmails = new Set(existingPartners.map(p => p.email?.toLowerCase()).filter(Boolean));

    // Set para rastrear duplicatas dentro do próprio lote de importação
    const batchDocs = new Set<string>();
    const batchEmails = new Set<string>();

    // Campos aceitos pelo Prisma Partner model
    const ALLOWED_FIELDS = new Set([
      'companyId', 'partnerTypes', 'personType', 'isRuralProducer',
      'name', 'tradeName', 'document', 'documentType', 'ie', 'im', 'ieStatus',
      'phone', 'email', 'passwordHash', 'rating',
      'cep', 'addressStreet', 'addressNumber', 'addressComp',
      'neighborhood', 'city', 'state', 'status',
    ]);

    // Filtra parceiros, removendo duplicatas do lote
    const toCreate: { row: number; data: any }[] = [];
    for (let i = 0; i < partners.length; i++) {
      const data = partners[i] as any;
      const row = i + 1;

      // Verifica documento duplicado
      if (data.document) {
        if (existingDocs.has(data.document) || batchDocs.has(data.document)) {
          skipped++;
          continue;
        }
        batchDocs.add(data.document);
      }

      // Verifica email duplicado
      const emailLower = data.email?.toLowerCase();
      if (emailLower) {
        if (existingEmails.has(emailLower) || batchEmails.has(emailLower)) {
          skipped++;
          continue;
        }
        batchEmails.add(emailLower);
      }

      // Limpa campos não aceitos pelo Prisma
      const createData: any = { companyId };
      for (const [key, val] of Object.entries(data)) {
        if (ALLOWED_FIELDS.has(key) && val !== undefined && val !== '' && key !== 'password' && key !== 'specializationIds') {
          createData[key] = val;
        }
      }

      toCreate.push({ row, data: createData });
    }

    // Insere em chunks paralelos de 50
    const CHUNK_SIZE = 50;
    for (let start = 0; start < toCreate.length; start += CHUNK_SIZE) {
      const chunk = toCreate.slice(start, start + CHUNK_SIZE);
      const promises = chunk.map(async ({ row, data }) => {
        try {
          await this.prisma.partner.create({ data });
          created++;
        } catch (err: any) {
          errors.push({
            row,
            name: data.name || `Linha ${row}`,
            message: err.message?.slice(0, 120) || 'Erro desconhecido',
          });
        }
      });
      await Promise.all(promises);
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
