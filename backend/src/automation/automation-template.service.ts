import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/* ═══════════════════════════════════════════════════════════════
   AUTOMATION TEMPLATE SERVICE — Pre-built templates + CRUD
   v1.00.22 "Templates & Debug"
   ═══════════════════════════════════════════════════════════════ */

/** Built-in template categories */
const TEMPLATE_CATEGORIES = ['FINANCEIRO', 'COMUNICACAO', 'GESTAO', 'INTEGRACAO'] as const;

/** Seed data — pre-built templates */
const BUILTIN_TEMPLATES = [
  {
    name: 'Lançar financeiro ao aprovar OS',
    description: 'Confirma automaticamente o repasse financeiro quando uma OS é aprovada pelo cliente.',
    category: 'FINANCEIRO',
    trigger: { entity: 'SERVICE_ORDER', event: 'approved', conditions: [] },
    actions: [{ type: 'LAUNCH_FINANCIAL', config: {} }],
  },
  {
    name: 'Notificar técnico na atribuição',
    description: 'Envia WhatsApp ao técnico quando ele é atribuído a uma nova OS.',
    category: 'COMUNICACAO',
    trigger: { entity: 'SERVICE_ORDER', event: 'assigned', conditions: [] },
    actions: [{ type: 'SEND_NOTIFICATION', config: { channel: 'WHATSAPP', recipient: 'TECNICO', message: 'Você recebeu uma nova OS!' } }],
  },
  {
    name: 'Alertar gestor em OS de alto valor',
    description: 'Cria alerta crítico quando uma OS com valor acima de R$1.000 é criada.',
    category: 'GESTAO',
    trigger: {
      entity: 'SERVICE_ORDER', event: 'created',
      conditions: [{ field: 'valueCents', operator: 'gte', value: 100000 }],
    },
    actions: [{ type: 'ALERT_MANAGER', config: { message: 'Nova OS de alto valor criada!', severity: 'critical' } }],
  },
  {
    name: 'Atribuir técnico automaticamente',
    description: 'Atribui o técnico com melhor avaliação automaticamente quando uma OS é criada.',
    category: 'GESTAO',
    trigger: { entity: 'SERVICE_ORDER', event: 'created', conditions: [] },
    actions: [{ type: 'ASSIGN_TECHNICIAN', config: { strategy: 'BEST_RATING' } }],
  },
  {
    name: 'Webhook ao finalizar OS',
    description: 'Envia os dados da OS para um sistema externo via webhook ao ser finalizada.',
    category: 'INTEGRACAO',
    trigger: { entity: 'SERVICE_ORDER', event: 'completed', conditions: [] },
    actions: [{ type: 'WEBHOOK', config: { url: 'https://api.exemplo.com/webhook', headers: '' } }],
  },
  {
    name: 'Notificar cliente ao concluir OS',
    description: 'Envia email ao cliente quando a OS é concluída.',
    category: 'COMUNICACAO',
    trigger: { entity: 'SERVICE_ORDER', event: 'completed', conditions: [] },
    actions: [{ type: 'SEND_NOTIFICATION', config: { channel: 'EMAIL', recipient: 'CLIENTE', message: 'Sua ordem de serviço foi concluída!' } }],
  },
  {
    name: 'Duplicar OS cancelada',
    description: 'Cria automaticamente uma cópia da OS quando ela é cancelada, para facilitar re-abertura.',
    category: 'GESTAO',
    trigger: { entity: 'SERVICE_ORDER', event: 'cancelled', conditions: [] },
    actions: [{ type: 'DUPLICATE_OS', config: {} }],
  },
  {
    name: 'Alertar sobre parceiro suspenso',
    description: 'Cria alerta quando um parceiro é suspenso.',
    category: 'GESTAO',
    trigger: {
      entity: 'PARTNER', event: 'partner_status_changed',
      conditions: [{ field: 'status', operator: 'eq', value: 'SUSPENSO' }],
    },
    actions: [{ type: 'ALERT_MANAGER', config: { message: 'Parceiro foi suspenso!', severity: 'warning' } }],
  },
];

@Injectable()
export class AutomationTemplateService implements OnModuleInit {
  private readonly logger = new Logger(AutomationTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Seed built-in templates on startup if none exist */
  async onModuleInit() {
    try {
      const count = await this.prisma.automationTemplate.count({ where: { isBuiltIn: true } });
      if (count === 0) {
        this.logger.log('🌱 Seeding built-in automation templates...');
        await this.prisma.automationTemplate.createMany({
          data: BUILTIN_TEMPLATES.map((t) => ({
            ...t,
            trigger: t.trigger as any,
            actions: t.actions as any,
            isBuiltIn: true,
            companyId: null,
          })),
        });
        this.logger.log(`✅ Seeded ${BUILTIN_TEMPLATES.length} built-in templates`);
      }
    } catch (err) {
      this.logger.error(`❌ Template seed failed: ${(err as Error).message}`);
    }
  }

  /** List all templates (built-in + company-specific) */
  async findAll(companyId: string) {
    return this.prisma.automationTemplate.findMany({
      where: {
        OR: [
          { isBuiltIn: true },           // Global built-in
          { companyId },                  // Company-specific
        ],
      },
      orderBy: [{ isBuiltIn: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });
  }

  /** Get template by ID */
  async findOne(id: string) {
    const template = await this.prisma.automationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template não encontrado');
    return template;
  }

  /** Create a template from an existing rule */
  async createFromRule(ruleId: string, companyId: string, data: { name: string; description?: string; category: string }) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, companyId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Regra de automação não encontrada');

    return this.prisma.automationTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        trigger: rule.trigger as any,
        actions: rule.actions as any,
        layout: rule.layout as any ?? undefined,
        isBuiltIn: false,
        companyId,
      },
    });
  }

  /** Apply a template — create a new rule from it */
  async applyTemplate(templateId: string, companyId: string, overrides?: { name?: string }) {
    const template = await this.findOne(templateId);

    return this.prisma.automationRule.create({
      data: {
        companyId,
        name: overrides?.name || template.name,
        description: template.description,
        isActive: false, // Start inactive so user can review
        trigger: template.trigger as any,
        actions: template.actions as any,
        layout: template.layout as any ?? undefined,
      },
    });
  }

  /** Delete a company-specific template (can't delete built-in) */
  async remove(id: string, companyId: string) {
    const template = await this.findOne(id);
    if (template.isBuiltIn) {
      throw new Error('Não é possível excluir templates do sistema');
    }
    if (template.companyId !== companyId) {
      throw new Error('Acesso negado');
    }
    return this.prisma.automationTemplate.delete({ where: { id } });
  }
}
