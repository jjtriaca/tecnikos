import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { FinanceService } from '../finance/finance.service';

/* ═══════════════════════════════════════════════════════════════
   AUTOMATION ENGINE — Event-driven rule evaluator & executor
   Dispatched after every ServiceOrder / Partner mutation.
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ───────────────────────────────────────────────────── */

export interface AutomationEvent {
  companyId: string;
  entity: 'SERVICE_ORDER' | 'PARTNER';
  entityId: string;
  eventType: string;
  data: {
    // SERVICE_ORDER fields
    status?: string;
    oldStatus?: string;
    state?: string;
    city?: string;
    neighborhood?: string;
    valueCents?: number;
    assignedPartnerId?: string;
    clientPartnerId?: string;
    title?: string;
    description?: string;
    addressStreet?: string;
    cep?: string;
    deadlineAt?: string;
    createdAt?: string;
    // PARTNER fields
    name?: string;
    personType?: string;
    partnerTypes?: string[];
    rating?: number;
  };
}

interface TriggerDef {
  entity: string;
  event: string;
  conditions?: ConditionNode[];
  conditionMode?: 'simple' | 'advanced';
}

interface ConditionDef {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}

/** v1.00.20 — Condition with optional SIM/NÃO branching */
interface ConditionNode extends ConditionDef {
  trueBranch?: BranchDef;
  falseBranch?: BranchDef;
}

interface BranchDef {
  conditions?: ConditionNode[];
  actions?: ActionDef[];
}

interface ActionDef {
  type: 'LAUNCH_FINANCIAL' | 'SEND_NOTIFICATION' | 'CHANGE_STATUS' | 'ALERT_MANAGER' | 'ASSIGN_TECHNICIAN' | 'DUPLICATE_OS' | 'WEBHOOK';
  config?: Record<string, any>;
}

@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(NotificationService) private readonly notifications?: NotificationService,
    @Optional() @Inject(FinanceService) private readonly finance?: FinanceService,
  ) {}

  /**
   * Main entry point — called by ServiceOrderService after each mutation.
   * Finds all active rules for the company, evaluates them, and executes matching ones.
   * Fire-and-forget: errors are caught and logged, never block the caller.
   */
  async dispatch(event: AutomationEvent): Promise<void> {
    try {
      const rules = await this.prisma.automationRule.findMany({
        where: { companyId: event.companyId, isActive: true, deletedAt: null },
      });

      if (rules.length === 0) return;

      this.logger.log(
        `⚡ Dispatch: ${event.eventType} on ${event.entity} ${event.entityId} — ${rules.length} rule(s) to evaluate`,
      );

      for (const rule of rules) {
        await this.evaluateAndExecute(rule, event).catch((err) =>
          this.logger.error(`❌ Automation rule ${rule.id} ("${rule.name}") failed: ${err.message}`),
        );
      }
    } catch (err) {
      this.logger.error(`❌ Dispatch failed: ${(err as Error).message}`);
    }
  }

  /* ── Evaluate & Execute ────────────────────────────────── */

  private async evaluateAndExecute(rule: any, event: AutomationEvent): Promise<void> {
    const trigger = rule.trigger as TriggerDef;

    // 1. Check entity match
    if (trigger.entity !== event.entity) return;

    // 2. Check event match
    if (trigger.event !== event.eventType) return;

    // 3. Determine actions to run based on condition mode
    const conditions = trigger.conditions ?? [];
    const isAdvanced = trigger.conditionMode === 'advanced';
    let actionsToRun: ActionDef[];

    if (isAdvanced && conditions.some(c => c.trueBranch || c.falseBranch)) {
      // ── Advanced mode: walk the SIM/NÃO tree to collect actions ──
      actionsToRun = this.walkConditionTree(conditions, event);
      // Also include rule-level actions (always run if tree didn't abort)
      const ruleActions = rule.actions as ActionDef[];
      if (ruleActions?.length > 0) {
        actionsToRun = [...actionsToRun, ...ruleActions];
      }

      if (actionsToRun.length === 0) {
        await this.logExecution(rule, event, 'SKIPPED', null, 'Nenhuma ação coletada na árvore de decisão');
        this.logger.log(`⏭️  Rule "${rule.name}" SKIPPED — no actions collected from tree`);
        return;
      }
    } else {
      // ── Simple/legacy mode: AND logic — all conditions must pass ──
      for (const cond of conditions) {
        if (!this.evaluateCondition(cond, event)) {
          await this.logExecution(rule, event, 'SKIPPED', null, 'Condição não atendida');
          this.logger.log(`⏭️  Rule "${rule.name}" SKIPPED — condition not met`);
          return;
        }
      }
      actionsToRun = rule.actions as ActionDef[];
    }

    // 4. Execute collected actions
    this.logger.log(`✅ Rule "${rule.name}" MATCHED — executing ${actionsToRun.length} action(s)`);

    const results: any[] = [];

    try {
      for (const action of actionsToRun) {
        const result = await this.executeAction(action, event);
        results.push({ type: action.type, success: true, result: result?.id || 'ok' });
      }
      await this.logExecution(rule, event, 'SUCCESS', results);
      this.logger.log(`✅ Rule "${rule.name}" executed successfully`);
    } catch (err) {
      await this.logExecution(rule, event, 'FAILED', results, (err as Error).message);
      this.logger.error(`❌ Rule "${rule.name}" action failed: ${(err as Error).message}`);
    }
  }

  /* ── Condition Tree Walker (v1.00.20) ──────────────────── */

  /**
   * Recursively walk a SIM/NÃO condition tree and collect all actions from
   * the branches that match. Each condition is evaluated:
   * - TRUE → follow trueBranch (collect its actions, recurse into nested conditions)
   * - FALSE → follow falseBranch (same)
   */
  private walkConditionTree(conditions: ConditionNode[], event: AutomationEvent): ActionDef[] {
    const collectedActions: ActionDef[] = [];

    for (const node of conditions) {
      const passed = this.evaluateCondition(node, event);

      if (passed) {
        // ✅ SIM branch
        if (node.trueBranch) {
          if (node.trueBranch.actions) {
            collectedActions.push(...node.trueBranch.actions);
          }
          if (node.trueBranch.conditions?.length) {
            collectedActions.push(...this.walkConditionTree(node.trueBranch.conditions, event));
          }
        }
      } else {
        // ❌ NÃO branch
        if (node.falseBranch) {
          if (node.falseBranch.actions) {
            collectedActions.push(...node.falseBranch.actions);
          }
          if (node.falseBranch.conditions?.length) {
            collectedActions.push(...this.walkConditionTree(node.falseBranch.conditions, event));
          }
        }
      }
    }

    return collectedActions;
  }

  /* ── Condition Evaluator ───────────────────────────────── */

  private evaluateCondition(cond: ConditionDef, event: AutomationEvent): boolean {
    const value = this.resolveField(cond.field, event);

    switch (cond.operator) {
      case 'eq':
        return String(value).toLowerCase() === String(cond.value).toLowerCase();
      case 'neq':
        return String(value).toLowerCase() !== String(cond.value).toLowerCase();
      case 'gt':
        return Number(value) > Number(cond.value);
      case 'lt':
        return Number(value) < Number(cond.value);
      case 'gte':
        return Number(value) >= Number(cond.value);
      case 'lte':
        return Number(value) <= Number(cond.value);
      case 'contains':
        return String(value).toLowerCase().includes(String(cond.value).toLowerCase());
      case 'in':
        if (Array.isArray(cond.value)) {
          return cond.value.map((v: any) => String(v).toLowerCase()).includes(String(value).toLowerCase());
        }
        return false;
      default:
        this.logger.warn(`Unknown operator: ${cond.operator}`);
        return false;
    }
  }

  private resolveField(field: string, event: AutomationEvent): any {
    return (event.data as any)?.[field] ?? undefined;
  }

  /* ── Action Executor ───────────────────────────────────── */

  private async executeAction(action: ActionDef, event: AutomationEvent): Promise<any> {
    switch (action.type) {
      case 'LAUNCH_FINANCIAL':
        return this.executeLaunchFinancial(event);
      case 'SEND_NOTIFICATION':
        return this.executeSendNotification(action, event);
      case 'CHANGE_STATUS':
        return this.executeChangeStatus(action, event);
      case 'ALERT_MANAGER':
        return this.executeAlertManager(action, event);
      case 'ASSIGN_TECHNICIAN':
        return this.executeAssignTechnician(action, event);
      case 'DUPLICATE_OS':
        return this.executeDuplicateOs(event);
      case 'WEBHOOK':
        return this.executeWebhook(action, event);
      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  /* ── Existing Action Executors ─────────────────────────── */

  private async executeLaunchFinancial(event: AutomationEvent): Promise<any> {
    if (!this.finance) {
      this.logger.warn('FinanceService not available — skipping LAUNCH_FINANCIAL');
      return null;
    }
    try {
      return await this.finance.confirm(event.entityId, event.companyId);
    } catch (err) {
      if ((err as any)?.status === 400) {
        this.logger.log(`ℹ️  Financial ledger already exists for OS ${event.entityId}`);
        return { alreadyExists: true };
      }
      throw err;
    }
  }

  private async executeSendNotification(action: ActionDef, event: AutomationEvent): Promise<any> {
    if (!this.notifications) {
      this.logger.warn('NotificationService not available — skipping SEND_NOTIFICATION');
      return null;
    }

    const config = action.config || {};
    const channel = config.channel || 'MOCK';
    const message = config.message || `Automação executada para OS ${event.data.title || event.entityId}`;
    const recipient = config.recipient || 'GESTOR';

    let recipientPhone: string | undefined;
    let recipientEmail: string | undefined;

    if (recipient === 'TECNICO' && event.data.assignedPartnerId) {
      const tech = await this.prisma.partner.findUnique({
        where: { id: event.data.assignedPartnerId },
        select: { phone: true, email: true },
      });
      recipientPhone = tech?.phone ?? undefined;
      recipientEmail = tech?.email ?? undefined;
    } else if (recipient === 'CLIENTE' && event.data.clientPartnerId) {
      const client = await this.prisma.partner.findUnique({
        where: { id: event.data.clientPartnerId },
        select: { phone: true, email: true },
      });
      recipientPhone = client?.phone ?? undefined;
      recipientEmail = client?.email ?? undefined;
    }

    return this.notifications.send({
      companyId: event.companyId,
      serviceOrderId: event.entityId,
      channel,
      recipientPhone,
      recipientEmail,
      message,
      type: 'AUTOMATION',
    });
  }

  private async executeChangeStatus(action: ActionDef, event: AutomationEvent): Promise<any> {
    const targetStatus = action.config?.targetStatus;
    if (!targetStatus) {
      this.logger.warn('CHANGE_STATUS action missing targetStatus config');
      return null;
    }

    const data: any = { status: targetStatus };
    if (targetStatus === 'EM_EXECUCAO') data.startedAt = new Date();
    if (targetStatus === 'CONCLUIDA' || targetStatus === 'APROVADA') data.completedAt = new Date();

    return this.prisma.serviceOrder.update({
      where: { id: event.entityId },
      data,
    });
  }

  private async executeAlertManager(action: ActionDef, event: AutomationEvent): Promise<any> {
    const message = action.config?.message || `Alerta automático: evento ${event.eventType} na OS ${event.data.title || event.entityId}`;
    const severity = action.config?.severity || 'info';

    return this.prisma.notification.create({
      data: {
        companyId: event.companyId,
        serviceOrderId: event.entityId,
        channel: 'MOCK',
        message: `[${severity.toUpperCase()}] ${message}`,
        type: 'AUTOMATION_ALERT',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  /* ── New Action Executors (v1.00.18) ───────────────────── */

  /**
   * ASSIGN_TECHNICIAN — Auto-assign the best available technician.
   * Strategy: BEST_RATING (highest rating) or LEAST_BUSY (fewest active OS).
   */
  private async executeAssignTechnician(action: ActionDef, event: AutomationEvent): Promise<any> {
    const strategy = action.config?.strategy || 'BEST_RATING';

    // Get the OS to check if it already has a technician
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: event.entityId },
      select: { assignedPartnerId: true, workflowTemplateId: true, companyId: true },
    });
    if (!so) {
      this.logger.warn(`ASSIGN_TECHNICIAN: OS ${event.entityId} not found`);
      return null;
    }
    if (so.assignedPartnerId) {
      this.logger.log(`ℹ️  OS ${event.entityId} already has a technician assigned`);
      return { alreadyAssigned: true };
    }

    // Find active technicians in the same company
    let orderBy: any;
    if (strategy === 'LEAST_BUSY') {
      // We'll sort by service order count after fetching
      orderBy = { rating: 'desc' as const }; // fallback order
    } else {
      orderBy = { rating: 'desc' as const };
    }

    const technicians = await this.prisma.partner.findMany({
      where: {
        companyId: event.companyId,
        partnerTypes: { has: 'TECNICO' },
        status: 'ATIVO',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        rating: true,
        _count: { select: { serviceOrders: { where: { status: { in: ['ATRIBUIDA', 'EM_EXECUCAO'] } } } } },
      },
      orderBy,
    });

    if (technicians.length === 0) {
      this.logger.warn('ASSIGN_TECHNICIAN: No available technicians found');
      return null;
    }

    let selectedTech: typeof technicians[0];
    if (strategy === 'LEAST_BUSY') {
      // Sort by fewest active OS, then by highest rating as tiebreaker
      technicians.sort((a, b) => {
        const diff = a._count.serviceOrders - b._count.serviceOrders;
        return diff !== 0 ? diff : b.rating - a.rating;
      });
      selectedTech = technicians[0];
    } else {
      selectedTech = technicians[0]; // Already sorted by rating DESC
    }

    this.logger.log(`👷 ASSIGN_TECHNICIAN: Assigning "${selectedTech.name}" (rating: ${selectedTech.rating}) to OS ${event.entityId}`);

    return this.prisma.serviceOrder.update({
      where: { id: event.entityId },
      data: {
        assignedPartnerId: selectedTech.id,
        status: 'ATRIBUIDA',
      },
    });
  }

  /**
   * DUPLICATE_OS — Create a copy of the service order with ABERTA status.
   */
  private async executeDuplicateOs(event: AutomationEvent): Promise<any> {
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: event.entityId },
    });
    if (!so) {
      this.logger.warn(`DUPLICATE_OS: OS ${event.entityId} not found`);
      return null;
    }

    const copy = await this.prisma.serviceOrder.create({
      data: {
        companyId: so.companyId,
        title: `${so.title} (cópia)`,
        description: so.description,
        addressText: so.addressText,
        lat: so.lat,
        lng: so.lng,
        valueCents: so.valueCents,
        addressStreet: so.addressStreet,
        addressNumber: so.addressNumber,
        addressComp: so.addressComp,
        neighborhood: so.neighborhood,
        city: so.city,
        state: so.state,
        cep: so.cep,
        deadlineAt: so.deadlineAt,
        status: 'ABERTA',
        clientPartnerId: so.clientPartnerId,
        workflowTemplateId: so.workflowTemplateId,
        // assignedPartnerId intentionally NOT copied
      },
    });

    this.logger.log(`📋 DUPLICATE_OS: Created copy ${copy.id} from OS ${event.entityId}`);
    return copy;
  }

  /**
   * WEBHOOK — Send event data to an external URL via HTTP POST.
   * Timeout: 10 seconds.
   */
  private async executeWebhook(action: ActionDef, event: AutomationEvent): Promise<any> {
    const url = action.config?.url;
    if (!url) {
      this.logger.warn('WEBHOOK action missing url config');
      return null;
    }

    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (action.config?.headers) {
      try {
        const parsed = typeof action.config.headers === 'string'
          ? JSON.parse(action.config.headers)
          : action.config.headers;
        headers = { ...headers, ...parsed };
      } catch {
        this.logger.warn('WEBHOOK: Invalid headers JSON, using defaults');
      }
    }

    const body = JSON.stringify({
      event: event.eventType,
      entity: event.entity,
      entityId: event.entityId,
      companyId: event.companyId,
      data: event.data,
      timestamp: new Date().toISOString(),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      this.logger.log(`🔗 WEBHOOK: POST ${url} → ${response.status}`);
      return { url, status: response.status, ok: response.ok };
    } catch (err) {
      const message = (err as Error).name === 'AbortError'
        ? `WEBHOOK timeout after 10s: ${url}`
        : `WEBHOOK failed: ${(err as Error).message}`;
      this.logger.warn(message);
      return { url, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  /* ── Simulation (dry run) — v1.00.22 ──────────────────── */

  /**
   * Simulate a rule against a real entity. Evaluates conditions but does NOT execute actions.
   * Returns which conditions matched and which actions WOULD be executed.
   */
  async simulateRule(
    ruleId: string,
    companyId: string,
    entityType: string,
    entityId: string,
    eventType?: string,
  ): Promise<{
    ruleId: string;
    ruleName: string;
    entityMatch: boolean;
    eventMatch: boolean;
    conditionsEvaluated: { field: string; operator: string; value: any; actual: any; passed: boolean }[];
    actionsWouldExecute: { type: string; config?: any }[];
    result: 'WOULD_EXECUTE' | 'WOULD_SKIP';
  }> {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, companyId, deletedAt: null },
    });
    if (!rule) throw new Error('Regra de automação não encontrada');

    const trigger = rule.trigger as unknown as TriggerDef;

    // Build mock event from real entity data
    let eventData: AutomationEvent['data'] = {};

    if (entityType === 'SERVICE_ORDER') {
      const so = await this.prisma.serviceOrder.findUnique({
        where: { id: entityId },
        include: { assignedPartner: { select: { id: true } }, clientPartner: { select: { id: true } } },
      });
      if (so) {
        eventData = {
          status: so.status,
          state: so.state ?? undefined,
          city: so.city ?? undefined,
          neighborhood: so.neighborhood ?? undefined,
          valueCents: so.valueCents,
          assignedPartnerId: so.assignedPartnerId ?? undefined,
          clientPartnerId: so.clientPartnerId ?? undefined,
          title: so.title,
          description: so.description ?? undefined,
          addressStreet: so.addressStreet ?? undefined,
          cep: so.cep ?? undefined,
          deadlineAt: so.deadlineAt?.toISOString(),
          createdAt: so.createdAt.toISOString(),
        };
      }
    } else if (entityType === 'PARTNER') {
      const partner = await this.prisma.partner.findUnique({ where: { id: entityId } });
      if (partner) {
        eventData = {
          status: partner.status,
          name: partner.name,
          personType: partner.personType ?? undefined,
          partnerTypes: partner.partnerTypes,
          rating: partner.rating,
          state: partner.state ?? undefined,
          city: partner.city ?? undefined,
        };
      }
    }

    const mockEvent: AutomationEvent = {
      companyId,
      entity: entityType as 'SERVICE_ORDER' | 'PARTNER',
      entityId,
      eventType: eventType || trigger.event,
      data: eventData,
    };

    // Check entity match
    const entityMatch = trigger.entity === entityType;

    // Check event match
    const eventMatch = trigger.event === (eventType || trigger.event);

    // Evaluate conditions
    const conditions = trigger.conditions ?? [];
    const conditionsEvaluated = conditions.map((cond) => ({
      field: cond.field,
      operator: cond.operator,
      value: cond.value,
      actual: this.resolveField(cond.field, mockEvent),
      passed: this.evaluateCondition(cond, mockEvent),
    }));

    const allConditionsPassed = conditionsEvaluated.every((c) => c.passed);

    // Determine actions that would execute
    let actionsWouldExecute: { type: string; config?: any }[] = [];
    if (entityMatch && eventMatch && allConditionsPassed) {
      const isAdvanced = trigger.conditionMode === 'advanced';
      if (isAdvanced && conditions.some((c) => c.trueBranch || c.falseBranch)) {
        const treeActions = this.walkConditionTree(conditions, mockEvent);
        actionsWouldExecute = [...treeActions, ...(rule.actions as unknown as ActionDef[])].map((a) => ({
          type: a.type,
          config: a.config,
        }));
      } else {
        actionsWouldExecute = (rule.actions as unknown as ActionDef[]).map((a) => ({
          type: a.type,
          config: a.config,
        }));
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      entityMatch,
      eventMatch,
      conditionsEvaluated,
      actionsWouldExecute,
      result: entityMatch && eventMatch && allConditionsPassed && actionsWouldExecute.length > 0
        ? 'WOULD_EXECUTE'
        : 'WOULD_SKIP',
    };
  }

  /* ── Execution Log ─────────────────────────────────────── */

  private async logExecution(
    rule: any,
    event: AutomationEvent,
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
    actionsExecuted?: any[] | null,
    error?: string,
  ): Promise<void> {
    await this.prisma.automationExecution.create({
      data: {
        automationRuleId: rule.id,
        companyId: event.companyId,
        entityType: event.entity,
        entityId: event.entityId,
        eventType: event.eventType,
        status,
        actionsExecuted: actionsExecuted ?? undefined,
        error: error ?? undefined,
      },
    }).catch((err) =>
      this.logger.error(`Failed to log automation execution: ${err.message}`),
    );
  }
}
