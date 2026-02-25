import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from './workflow-engine.service';

/* ═══════════════════════════════════════════════════════════════
   WAIT FOR SERVICE — Gerencia blocos WAIT_FOR pendentes
   - checkEarlyTrigger: chamado por eventos da OS (assigned, status_changed, etc.)
   - handleExpiredWaits: cron a cada 1 minuto para expirar waits
   - resumeWorkflow: retoma fluxo após resolução do wait
   ═══════════════════════════════════════════════════════════════ */

/** Mapeamento de eventType → conditionKey do bloco WAIT_FOR */
const EVENT_TO_CONDITION: Record<string, string> = {
  assigned: 'os_assigned',
  status_changed: 'os_status_changed',
  completed: 'os_completed',
  approved: 'os_approved',
};

@Injectable()
export class WaitForService {
  private readonly logger = new Logger(WaitForService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly engineService: WorkflowEngineService,
  ) {}

  /* ══════════════════════════════════════════════════════════
     1) CHECK EARLY TRIGGER — chamado por dispatchAutomation
     ══════════════════════════════════════════════════════════ */

  async checkEarlyTrigger(
    serviceOrderId: string,
    companyId: string,
    eventType: string,
    eventData?: { status?: string; oldStatus?: string },
  ): Promise<void> {
    try {
      // OS cancelada → cancela todos os waits pendentes
      if (eventType === 'cancelled') {
        const cancelled = await this.prisma.pendingWorkflowWait.updateMany({
          where: { serviceOrderId, status: 'WAITING' },
          data: {
            status: 'CANCELLED',
            resolvedAt: new Date(),
            resolvedBy: 'OS_CANCELLED',
          },
        });
        if (cancelled.count > 0) {
          this.logger.log(
            `❌ WAIT_FOR: Cancelled ${cancelled.count} pending wait(s) for OS ${serviceOrderId} (OS cancelled)`,
          );
        }
        return;
      }

      const conditionKey = EVENT_TO_CONDITION[eventType];
      if (!conditionKey) return;

      const pendingWaits = await this.prisma.pendingWorkflowWait.findMany({
        where: { serviceOrderId, status: 'WAITING' },
      });
      if (pendingWaits.length === 0) return;

      for (const wait of pendingWaits) {
        const conditions = wait.triggerConditions as string[];
        if (!Array.isArray(conditions) || !conditions.includes(conditionKey)) {
          continue;
        }

        // Para os_status_changed com targetStatus configurado, verificar match
        if (
          conditionKey === 'os_status_changed' &&
          wait.targetStatus &&
          eventData?.status !== wait.targetStatus
        ) {
          continue;
        }

        this.logger.log(
          `⚡ WAIT_FOR early trigger: event "${eventType}" matched for OS ${serviceOrderId}, block ${wait.blockId}`,
        );

        await this.resolveWait(wait.id, `EVENT:${eventType}`);
      }
    } catch (err) {
      this.logger.error(
        `❌ WAIT_FOR checkEarlyTrigger failed: ${(err as Error).message}`,
      );
    }
  }

  /* ══════════════════════════════════════════════════════════
     2) CRON — a cada 1 minuto, verificar waits expirados
     ══════════════════════════════════════════════════════════ */

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredWaits(): Promise<void> {
    try {
      const now = new Date();
      const expired = await this.prisma.pendingWorkflowWait.findMany({
        where: {
          status: 'WAITING',
          expiresAt: { lte: now },
        },
      });

      if (expired.length === 0) return;

      this.logger.log(`⏰ Found ${expired.length} expired WAIT_FOR block(s)`);

      for (const wait of expired) {
        // Atômico: só atualiza se ainda WAITING (previne processamento duplo)
        const updated = await this.prisma.pendingWorkflowWait.updateMany({
          where: { id: wait.id, status: 'WAITING' },
          data: {
            status: 'EXPIRED',
            resolvedAt: now,
            resolvedBy: 'TIMEOUT',
          },
        });

        if (updated.count === 0) continue; // Já resolvido por outro processo

        this.logger.log(
          `⏰ WAIT_FOR expired: OS ${wait.serviceOrderId}, block ${wait.blockId}`,
        );

        // Se timeoutAction = 'cancel', não retoma
        if (wait.timeoutAction === 'cancel') {
          this.logger.log(
            `⏹️ WAIT_FOR: Timeout with cancel action — ending workflow for OS ${wait.serviceOrderId}`,
          );
          await this.logWaitResolution(wait, 'TIMEOUT', 'EXPIRED');
          continue;
        }

        // Retomar fluxo
        await this.logWaitResolution(wait, 'TIMEOUT', 'EXPIRED');
        await this.resumeWorkflow(wait);
      }
    } catch (err) {
      this.logger.error(
        `❌ WAIT_FOR handleExpiredWaits failed: ${(err as Error).message}`,
      );
    }
  }

  /* ══════════════════════════════════════════════════════════
     3) RESOLVE WAIT — marca como resolvido e retoma fluxo
     ══════════════════════════════════════════════════════════ */

  private async resolveWait(
    waitId: string,
    resolvedBy: string,
  ): Promise<void> {
    const status = resolvedBy.startsWith('EVENT') ? 'TRIGGERED' : 'EXPIRED';

    // Atômico: previne processamento duplo
    const updated = await this.prisma.pendingWorkflowWait.updateMany({
      where: { id: waitId, status: 'WAITING' },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });

    if (updated.count === 0) return; // Já resolvido

    const wait = await this.prisma.pendingWorkflowWait.findUnique({
      where: { id: waitId },
    });
    if (!wait) return;

    await this.logWaitResolution(wait, resolvedBy, status);
    await this.resumeWorkflow(wait);
  }

  /* ══════════════════════════════════════════════════════════
     4) LOG — atualiza StepLog e cria Event
     ══════════════════════════════════════════════════════════ */

  private async logWaitResolution(
    wait: any,
    resolvedBy: string,
    status: string,
  ): Promise<void> {
    // Atualiza o WorkflowStepLog do bloco WAIT_FOR
    await this.prisma.workflowStepLog.updateMany({
      where: {
        serviceOrderId: wait.serviceOrderId,
        blockId: wait.blockId,
      },
      data: {
        responseData: {
          autoCompleted: true,
          waitingFor: wait.triggerConditions,
          resolvedBy,
          resolvedAt: new Date().toISOString(),
          status,
        },
      },
    });

    // Cria evento de resolução
    await this.prisma.serviceOrderEvent.create({
      data: {
        companyId: wait.companyId,
        serviceOrderId: wait.serviceOrderId,
        type: 'WORKFLOW_WAIT_RESOLVED',
        actorType: 'SYSTEM',
        actorId: null,
        payload: {
          blockId: wait.blockId,
          resolvedBy,
          nextBlockId: wait.nextBlockId,
          status,
        },
      },
    });
  }

  /* ══════════════════════════════════════════════════════════
     5) RESUME WORKFLOW — continua a partir do próximo bloco
     ══════════════════════════════════════════════════════════ */

  private async resumeWorkflow(wait: any): Promise<void> {
    if (!wait.nextBlockId) {
      this.logger.log(
        `⏹️ WAIT_FOR: No nextBlockId — workflow ends for OS ${wait.serviceOrderId}`,
      );
      return;
    }

    try {
      await this.engineService.resumeFromBlock(
        wait.serviceOrderId,
        wait.companyId,
        wait.technicianId,
        wait.nextBlockId,
        wait.stepOrder,
      );
    } catch (err) {
      this.logger.error(
        `❌ WAIT_FOR resumeWorkflow failed: ${(err as Error).message}`,
      );
    }
  }
}
