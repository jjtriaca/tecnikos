import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PublicOfferService } from '../public-offer/public-offer.service';
import { buildSearchWhere } from '../common/util/build-search-where';

export interface WorkflowStep {
  order: number;
  name: string;
  icon: string;
  requirePhoto: boolean;
  requireNote: boolean;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(NotificationService) private readonly notifications?: NotificationService,
    @Optional() @Inject(PublicOfferService) private readonly publicOfferService?: PublicOfferService,
  ) {}

  async findAll(companyId: string, opts?: { search?: string; page?: number; limit?: number; activeOnly?: boolean }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 100, 100);
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };
    if (opts?.activeOnly) {
      where.isActive = true;
    }

    if (opts?.search) {
      const searchClause = buildSearchWhere(opts.search, [
        { field: 'name', mode: 'insensitive' },
      ]);
      if (searchClause) Object.assign(where, searchClause);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflowTemplate.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: { id: true, name: true, isActive: true, sortOrder: true, createdAt: true },
      }),
      this.prisma.workflowTemplate.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const wf = await this.prisma.workflowTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!wf) throw new NotFoundException('Fluxo não encontrado');
    if (wf.companyId !== companyId) throw new ForbiddenException('Acesso negado');
    return wf;
  }

  async create(companyId: string, name: string, steps: any, requiredSpecializationIds?: string[]) {
    this.validateSteps(steps);
    return this.prisma.workflowTemplate.create({
      data: {
        companyId,
        name,
        steps: steps as any,
        requiredSpecializationIds: requiredSpecializationIds || [],
      },
    });
  }

  async update(id: string, companyId: string, body: { name?: string; steps?: any; isActive?: boolean; requiredSpecializationIds?: string[] }) {
    await this.findOne(id, companyId);
    if (body.steps) this.validateSteps(body.steps);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.steps !== undefined) data.steps = body.steps as any;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.requiredSpecializationIds !== undefined) data.requiredSpecializationIds = body.requiredSpecializationIds;

    return this.prisma.workflowTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.workflowTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reorder(companyId: string, orderedIds: string[]) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestException('Lista de IDs é obrigatória');
    }

    const updates = orderedIds.map((id, index) =>
      this.prisma.workflowTemplate.updateMany({
        where: { id, companyId, deletedAt: null },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return { success: true };
  }

  /* ── Validation ── */

  private validateSteps(steps: any) {
    // V2 format: { version: 2, blocks: [...] }
    if (steps && typeof steps === 'object' && !Array.isArray(steps) && steps.version === 2) {
      return this.validateStepsV2(steps);
    }

    // V1 format: WorkflowStep[]
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new BadRequestException('O fluxo deve ter pelo menos 1 etapa');
    }
    if (steps.length > 50) {
      throw new BadRequestException('O fluxo pode ter no máximo 50 etapas');
    }
    for (const step of steps) {
      if (!step.name || step.name.trim().length === 0) {
        throw new BadRequestException('Todas as etapas devem ter um nome');
      }
    }
  }

  private validateStepsV2(def: { version: 2; blocks: any[]; trigger?: any }) {
    const blocks = def.blocks;
    if (!Array.isArray(blocks) || blocks.length < 2) {
      throw new BadRequestException('O fluxo V2 deve ter pelo menos os blocos Início e Fim');
    }
    if (blocks.length > 100) {
      throw new BadRequestException('O fluxo pode ter no máximo 100 blocos');
    }
    const hasStart = blocks.some((b: any) => b.type === 'START');
    const hasEnd = blocks.some((b: any) => b.type === 'END');
    if (!hasStart || !hasEnd) {
      throw new BadRequestException('O fluxo V2 deve ter blocos Início (START) e Fim (END)');
    }
    for (const block of blocks) {
      if (!block.id || !block.type || !block.name) {
        throw new BadRequestException('Cada bloco deve ter id, type e name');
      }
    }

    // Validate trigger if present
    if (def.trigger) {
      const validEntities = ['SERVICE_ORDER', 'QUOTE', 'PARTNER'];
      if (def.trigger.entity && !validEntities.includes(def.trigger.entity)) {
        throw new BadRequestException(`Entidade do gatilho inválida: ${def.trigger.entity}`);
      }
      if (def.trigger.event && typeof def.trigger.event !== 'string') {
        throw new BadRequestException('O gatilho deve ter um evento válido');
      }
    }
  }

  /**
   * Test workflow notification blocks with sample data.
   * Sends a real notification to the specified phone number.
   */
  async testNotification(companyId: string, blocks: any[], phone: string): Promise<{ sent: number; preview: string }> {
    if (!this.notifications) throw new BadRequestException('Serviço de notificações não disponível');
    if (!phone || phone.replace(/\D/g, '').length < 10) throw new BadRequestException('Telefone inválido');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const companyDisplay = company?.tradeName || company?.name || 'Empresa Teste';

    // Sample data for variable substitution
    const sampleVars: Record<string, string> = {
      '{nome}': 'João Técnico',
      '{empresa}': companyDisplay,
      '{razao_social}': company?.name || 'Razão Social Teste',
      '{cnpj}': company?.cnpj || '00.000.000/0001-00',
      '{titulo}': 'Manutenção preventiva - Ar condicionado',
      '{nome_cliente}': 'Maria Silva',
      '{endereco}': 'Rua das Flores, 123 - Centro - São Paulo/SP',
      '{data}': new Date().toLocaleDateString('pt-BR'),
      '{data_agendamento}': new Date(Date.now() + 86400000).toLocaleDateString('pt-BR') + ' 09:00',
      '{link_app}': '[link-teste]',
      '{link_primeiro_acesso}': '[link-teste]',
      '{link_os}': '[link-teste]',
      '{codigo}': 'OS-00001',
      '{valor}': 'R$ 350,00',
      '{cliente}': 'Maria Silva',
      '{link}': '[link-teste]',
    };

    const resolveVars = (msg: string): string => {
      let result = msg;
      for (const [key, val] of Object.entries(sampleVars)) {
        result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'gi'), val);
      }
      return result;
    };

    // Walk blocks and find NOTIFY blocks
    const blockMap = new Map(blocks.map((b: any) => [b.id, b]));
    let current = blocks.find((b: any) => b.type === 'START');
    const visited = new Set<string>();
    let sent = 0;
    let preview = '';

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      if (current.type === 'NOTIFY') {
        const recipients = current.config?.recipients || [];
        for (const r of recipients) {
          if (r.enabled === false) continue;
          const message = resolveVars(r.message || '');
          if (!message) continue;

          preview = message; // Last message as preview

          await this.notifications.send({
            companyId,
            channel: 'WHATSAPP',
            type: 'WORKFLOW_TEST',
            recipientPhone: phone.replace(/\D/g, ''),
            message: `[TESTE] ${message}`,
          });
          sent++;
        }
      }

      current = current.next ? blockMap.get(current.next) : undefined;
    }

    if (sent === 0) throw new BadRequestException('Nenhum bloco de notificação encontrado no fluxo');

    return { sent, preview };
  }

  /* ── Preview OS for Tech Portal emulator ── */

  /**
   * Find or create a preview OS for this workflow.
   * Returns { token, serviceOrderId } for iframe loading.
   */
  async getOrCreatePreviewOs(workflowId: string, companyId: string, triggerLabel: string) {
    const wf = await this.findOne(workflowId, companyId);

    // Look for existing preview OS with a valid (non-expired, non-revoked) offer
    const existingOffer = await this.prisma.serviceOrderOffer.findFirst({
      where: {
        companyId,
        channel: 'PREVIEW',
        expiresAt: { gt: new Date() },
        revokedAt: null,
        serviceOrder: { workflowTemplateId: workflowId },
      },
      select: { token: true, serviceOrderId: true },
    });

    if (existingOffer) {
      return { token: existingOffer.token, serviceOrderId: existingOffer.serviceOrderId };
    }

    // Find or create a dummy client partner for preview
    let client = await this.prisma.partner.findFirst({
      where: { companyId, type: 'CLIENT', deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!client) {
      client = await this.prisma.partner.create({
        data: {
          companyId,
          type: 'CLIENT',
          name: 'Cliente Teste (Preview)',
          phone: '00000000000',
        },
        select: { id: true },
      });
    }

    // Find a tech partner (needed for token auth to work)
    let tech = await this.prisma.partner.findFirst({
      where: { companyId, type: 'TECHNICIAN', deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    // Generate sequential code
    const lastOs = await this.prisma.serviceOrder.findFirst({
      where: { companyId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = lastOs?.code ? parseInt(lastOs.code.replace(/\D/g, ''), 10) : 0;
    const code = `OS-${String((lastNum || 0) + 1).padStart(5, '0')}`;

    // Create preview OS directly (bypasses engine — no notifications/automations)
    const os = await this.prisma.serviceOrder.create({
      data: {
        companyId,
        code,
        title: `Preview - ${triggerLabel}`,
        description: `OS de teste para visualizar o portal do técnico (${wf.name})`,
        addressText: 'Rua Exemplo, 123 - Centro',
        valueCents: 35000,
        deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
        workflowTemplateId: workflowId,
        clientPartnerId: client.id,
        assignedPartnerId: tech?.id || undefined,
        directedTechnicianIds: tech ? [tech.id] : [],
        status: 'OFERTADA',
      },
    });

    // Create offer token with 7-day expiry, channel=PREVIEW to distinguish
    const { randomUUID } = await import('crypto');
    const token = randomUUID();
    await this.prisma.serviceOrderOffer.create({
      data: {
        serviceOrderId: os.id,
        companyId,
        channel: 'PREVIEW',
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { token, serviceOrderId: os.id };
  }
}
