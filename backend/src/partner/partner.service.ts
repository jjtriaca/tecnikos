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

  /** Fire-and-forget: check ANY workflow for technician onboarding config and send contract/notification */
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

      // ── Try V2 workflows first (visual editor) ──
      const v2Workflow = workflows.find(wf => {
        const steps = wf.steps as any;
        return steps?.version === 2 && steps?.trigger?.triggerId === 'partner_tech_created';
      });

      if (v2Workflow) {
        this.logger.log(`📄 Found V2 workflow "${v2Workflow.name}" (${v2Workflow.id}) with trigger partner_tech_created`);
        await this.executeV2OnboardingWorkflow(companyId, partnerId, v2Workflow);
        return;
      }

      // ── Fallback: V1 technicianOnboarding format ──
      let onboarding: any = null;
      for (const wf of workflows) {
        const steps = wf.steps as any;
        if (steps?.technicianOnboarding?.enabled) {
          onboarding = steps.technicianOnboarding;
          this.logger.log(`📄 Found V1 onboarding config in workflow "${wf.name}" (${wf.id})`);
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

  /** Execute V2 visual-editor workflow for partner onboarding — processes NOTIFY blocks */
  private async executeV2OnboardingWorkflow(
    companyId: string,
    partnerId: string,
    workflow: any,
  ): Promise<void> {
    if (!this.contractService) return;

    const steps = workflow.steps as any;
    const blocks = steps?.blocks as any[];
    if (!blocks?.length) {
      this.logger.log(`📄 V2 workflow has no blocks — skipping`);
      return;
    }

    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      this.logger.warn(`📄 Partner ${partnerId} not found — skipping V2 execution`);
      return;
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const companyDisplay = company?.tradeName || company?.name || '';

    // Template variable resolver — for onboarding, {nome} = partner name
    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    const companyPhone = (company as any)?.phone || '';
    const companyAddress = [company?.addressStreet, (company as any)?.addressNumber, (company as any)?.neighborhood, company?.city, company?.state].filter(Boolean).join(', ');
    const resolveVars = (msg: string): string => {
      return msg
        .replace(/\{nome\}/gi, partner.name)
        .replace(/\{empresa\}/gi, companyDisplay)
        .replace(/\{razao_social\}/gi, company?.name || '')
        .replace(/\{cnpj_empresa\}/gi, company?.cnpj || '')
        .replace(/\{telefone_empresa\}/gi, companyPhone)
        .replace(/\{endereco_empresa\}/gi, companyAddress)
        .replace(/\{data\}/gi, new Date().toLocaleDateString('pt-BR'))
        .replace(/\{documento\}/gi, partner.document || '')
        .replace(/\{email\}/gi, partner.email || '')
        .replace(/\{telefone\}/gi, partner.phone || '')
        .replace(/\{link_app\}/gi, `${baseUrl}/tech`);
    };

    // Walk blocks sequentially (follow "next" pointers from START)
    const blockMap = new Map(blocks.map((b: any) => [b.id, b]));
    let current = blocks.find((b: any) => b.type === 'START');
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      if (current.type === 'NOTIFY') {
        const recipients = current.config?.recipients || [];
        for (const r of recipients) {
          if (!r.enabled && r.enabled !== undefined) continue;
          if (r.type !== 'TECNICO') continue; // Only process TECNICO recipients for onboarding

          const message = resolveVars(r.message || '');
          if (!message) continue;

          const channel = r.channel || 'WHATSAPP';

          // Check if this notification requires contract acceptance
          if (r.includeLink && r.acceptanceType === 'contract') {
            // Send contract (with optional signature requirement)
            const contractContent = resolveVars(r.contractContent || message);
            this.logger.log(`📄 V2 Onboarding: Sending contract to ${partner.name} via ${channel}`);
            await this.contractService.sendContract({
              companyId,
              partnerId,
              trigger: 'onNewTechnician',
              contractName: r.contractName || 'Contrato de Prestação de Serviços',
              contractContent,
              blockUntilAccepted: true,
              requireSignature: r.requireSignature ?? false,
              requireAcceptance: true,
              expirationDays: 36500, // ~100 years (doesn't expire)
              channel: channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
            });
          } else {
            // Send welcome message (simple confirmation or no acceptance)
            const waitForReply = r.includeLink === true; // simple acceptance = block until confirmed
            if (channel === 'WHATSAPP' && partner.phone) {
              this.logger.log(`💬 V2 Onboarding: Sending WhatsApp to ${partner.name} (${partner.phone})`);
              await this.contractService.sendWelcomeMessage({
                companyId,
                partnerId,
                channel: 'WHATSAPP',
                message,
                waitForReply,
                confirmVia: 'WHATSAPP',
              });
            } else if (channel === 'EMAIL' && partner.email) {
              this.logger.log(`📧 V2 Onboarding: Sending email to ${partner.name} (${partner.email})`);
              await this.contractService.sendWelcomeMessage({
                companyId,
                partnerId,
                channel: 'EMAIL',
                message,
                waitForReply,
              });
            }
          }

          this.logger.log(`✅ V2 Onboarding notification sent to ${partner.name} via ${channel}`);
        }
      }

      // Follow next pointer
      if (current.next) {
        current = blockMap.get(current.next);
      } else {
        break;
      }
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
    // ── Enforce maxTechnicians limit ──
    if (data.partnerTypes?.includes('TECNICO')) {
      const company = await this.prisma.company.findFirst({
        select: { maxTechnicians: true },
      });
      const maxTechnicians = company?.maxTechnicians || 0;
      if (maxTechnicians > 0) {
        const activeCount = await this.prisma.partner.count({
          where: {
            companyId,
            partnerTypes: { has: 'TECNICO' },
            deletedAt: null,
            status: { not: 'INATIVO' },
          },
        });
        if (activeCount >= maxTechnicians) {
          throw new ForbiddenException(
            `Limite de ${maxTechnicians} técnico(s) atingido. Faça upgrade do plano para adicionar mais técnicos.`,
          );
        }
      }

      // ── Anti-fraud: cooldown after deactivation (doubles each time) ──
      if (data.document) {
        const recentlyDeactivated = await this.prisma.partner.findFirst({
          where: { companyId, document: data.document, deletedAt: { not: null } },
          select: { deactivationCount: true, lastDeactivatedAt: true },
          orderBy: { lastDeactivatedAt: 'desc' },
        });
        if (recentlyDeactivated?.lastDeactivatedAt && recentlyDeactivated.deactivationCount > 1) {
          const cooldownHours = 24 * Math.pow(2, Math.min(recentlyDeactivated.deactivationCount - 2, 5));
          const cooldownMs = cooldownHours * 60 * 60 * 1000;
          const elapsed = Date.now() - recentlyDeactivated.lastDeactivatedAt.getTime();
          if (elapsed < cooldownMs) {
            const hoursLeft = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
            throw new ForbiddenException(
              `Este técnico foi desativado recentemente. Aguarde ${hoursLeft}h para recriar.`,
            );
          }
        }
      }
    }

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

    // ── Enforce maxTechnicians when adding TECNICO type to existing partner ──
    const wasTecnico = (existing as any).partnerTypes?.includes('TECNICO');
    const willBeTecnico = data.partnerTypes?.includes('TECNICO');
    if (!wasTecnico && willBeTecnico) {
      // Multi-tenant: each schema has exactly one Company
      const company = await this.prisma.company.findFirst({ select: { maxTechnicians: true } });
      const maxTechnicians = company?.maxTechnicians || 0;
      if (maxTechnicians > 0) {
        const activeCount = await this.prisma.partner.count({
          where: { companyId, partnerTypes: { has: 'TECNICO' }, deletedAt: null, status: { not: 'INATIVO' } },
        });
        if (activeCount >= maxTechnicians) {
          throw new ForbiddenException(
            `Limite de ${maxTechnicians} técnico(s) atingido. Faça upgrade do plano para adicionar mais técnicos.`,
          );
        }
      }
    }

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
      data: {
        deletedAt: new Date(),
        deactivationCount: { increment: 1 },
        lastDeactivatedAt: new Date(),
      },
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
    // ── Enforce maxTechnicians for bulk import ──
    const incomingTecnicos = partners.filter(p => p.partnerTypes?.includes('TECNICO')).length;
    if (incomingTecnicos > 0) {
      // Multi-tenant: each schema has exactly one Company
      const company = await this.prisma.company.findFirst({ select: { maxTechnicians: true } });
      const maxTechnicians = company?.maxTechnicians || 0;
      if (maxTechnicians > 0) {
        const activeCount = await this.prisma.partner.count({
          where: { companyId, partnerTypes: { has: 'TECNICO' }, deletedAt: null, status: { not: 'INATIVO' } },
        });
        const remaining = maxTechnicians - activeCount;
        if (remaining <= 0) {
          throw new ForbiddenException(
            `Limite de ${maxTechnicians} técnico(s) atingido. Não é possível importar técnicos. Faça upgrade do plano.`,
          );
        }
        if (incomingTecnicos > remaining) {
          throw new ForbiddenException(
            `Limite de ${maxTechnicians} técnico(s) permite mais ${remaining}, mas a importação contém ${incomingTecnicos}. Reduza a quantidade ou faça upgrade.`,
          );
        }
      }
    }

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

  // ========== CONTACTS ==========

  async listContacts(partnerId: string, companyId: string, type?: string) {
    return this.prisma.partnerContact.findMany({
      where: {
        partnerId,
        companyId,
        ...(type ? { type } : {}),
        active: true,
      },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
  }

  async createContact(partnerId: string, companyId: string, data: { type: string; value: string; label?: string }) {
    // Verify partner belongs to company
    const partner = await this.prisma.partner.findFirst({ where: { id: partnerId, companyId, deletedAt: null } });
    if (!partner) throw new NotFoundException('Parceiro não encontrado');

    return this.prisma.partnerContact.create({
      data: {
        companyId,
        partnerId,
        type: data.type,
        value: data.value,
        label: data.label || null,
        lastUsedAt: new Date(),
      },
    });
  }

  async updateContact(partnerId: string, contactId: string, companyId: string, data: { value?: string; label?: string; active?: boolean }) {
    const contact = await this.prisma.partnerContact.findFirst({ where: { id: contactId, partnerId, companyId } });
    if (!contact) throw new NotFoundException('Contato não encontrado');

    return this.prisma.partnerContact.update({
      where: { id: contactId },
      data: {
        ...(data.value !== undefined && { value: data.value }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  }

  async deleteContact(partnerId: string, contactId: string, companyId: string) {
    const contact = await this.prisma.partnerContact.findFirst({ where: { id: contactId, partnerId, companyId } });
    if (!contact) throw new NotFoundException('Contato não encontrado');

    await this.prisma.partnerContact.delete({ where: { id: contactId } });
    return { deleted: true };
  }

  async markContactUsed(partnerId: string, contactId: string, companyId: string) {
    const contact = await this.prisma.partnerContact.findFirst({ where: { id: contactId, partnerId, companyId } });
    if (!contact) throw new NotFoundException('Contato não encontrado');

    return this.prisma.partnerContact.update({
      where: { id: contactId },
      data: { lastUsedAt: new Date() },
    });
  }
}
