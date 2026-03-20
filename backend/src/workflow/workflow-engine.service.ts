import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceOrderStatus } from '@prisma/client';
import { WorkflowStep } from './workflow.service';
import { NotificationService } from '../notification/notification.service';
import { FinanceService } from '../finance/finance.service';
import { PublicOfferService } from '../public-offer/public-offer.service';
import { StepProgressDto } from './dto/step-progress.dto';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

// ── V1 (linear) ──

export interface WorkflowProgress {
  templateId: string;
  templateName: string;
  version: number;
  totalSteps: number;
  completedSteps: number;
  currentStep: (WorkflowStep & { completed: boolean }) | null;
  steps: Array<
    WorkflowStep & {
      completed: boolean;
      completedAt?: string;
      note?: string;
      photoUrl?: string;
    }
  >;
  isComplete: boolean;
}

// ── V2 (graph) ──

interface BlockDef {
  id: string;
  type: string;
  name: string;
  icon: string;
  config: Record<string, any>;
  next: string | null;
  yesBranch?: string | null;
  noBranch?: string | null;
}

interface V2Def {
  version: 2;
  blocks: BlockDef[];
  techPortalConfig?: Record<string, any>;
}

export interface BlockProgress extends BlockDef {
  completed: boolean;
  completedAt?: string;
  note?: string;
  photoUrl?: string;
  responseData?: any;
}

export interface WorkflowProgressV2 {
  templateId: string;
  templateName: string;
  version: number;
  totalBlocks: number;
  completedBlocks: number;
  currentBlock: BlockDef | null;
  executionPath: BlockProgress[];
  isComplete: boolean;
  techPortalConfig?: Record<string, any> | null;
}

/* Block types that require technician interaction */
const ACTIONABLE_TYPES = new Set([
  'STEP',
  'PHOTO',
  'NOTE',
  'GPS',
  'QUESTION',
  'CHECKLIST',
  'SIGNATURE',
  'FORM',
  'CONDITION',
  'ACTION_BUTTONS',
  'ARRIVAL_QUESTION',
]);

/* ── V3 (FlowDefinition) ── */

interface V3Block {
  id: string;
  type: string;
  name: string;
  icon: string;
  config: Record<string, any>;
  children: string[];
  yesBranch?: string[];
  noBranch?: string[];
}

interface V3Def {
  version: 3;
  blocks: V3Block[];
  trigger?: { entity: string; event: string };
}

/* ── Helpers ── */

function isV2(steps: unknown): steps is V2Def {
  return (
    !!steps &&
    typeof steps === 'object' &&
    !Array.isArray(steps) &&
    (steps as any).version === 2
  );
}

function isV3(steps: unknown): steps is V3Def {
  return (
    !!steps &&
    typeof steps === 'object' &&
    !Array.isArray(steps) &&
    (steps as any).version === 3
  );
}

/**
 * Convert V3 FlowDefinition to V2 block graph format.
 * V3 uses children arrays; V2 uses linked-list next pointers.
 */
function convertV3toV2(v3: V3Def): V2Def {
  const v2Blocks: BlockDef[] = [];
  const triggerBlock = v3.blocks.find((b) => b.type === 'TRIGGER_START');
  if (!triggerBlock) return { version: 2, blocks: [] };

  const startId = '_v2_start';
  const endId = '_v2_end';

  v2Blocks.push({
    id: startId,
    type: 'START',
    name: 'Inicio',
    icon: '▶️',
    config: {},
    next: null,
  });

  function processChain(childIds: string[]): string | null {
    let prevId: string | null = null;

    for (const childId of childIds) {
      const block = v3.blocks.find((b) => b.id === childId);
      if (!block) continue;

      if (block.type === 'END') {
        if (prevId) {
          const prev = v2Blocks.find((b) => b.id === prevId);
          if (prev && !prev.next) prev.next = endId;
        }
        return endId;
      }

      // Map type: STATUS_CHANGE → STATUS for V2 compat
      const v2Type =
        block.type === 'STATUS_CHANGE' ? 'STATUS' : block.type;

      // Check if already added (from branch processing)
      if (v2Blocks.find((b) => b.id === block.id)) {
        if (prevId) {
          const prev = v2Blocks.find((b) => b.id === prevId);
          if (prev && !prev.next) prev.next = block.id;
        }
        prevId = block.id;
        continue;
      }

      const v2Block: BlockDef = {
        id: block.id,
        type: v2Type,
        name: block.name,
        icon: block.icon,
        config: block.config || {},
        next: null,
      };

      if (block.type === 'CONDITION') {
        v2Block.yesBranch = null;
        v2Block.noBranch = null;

        // Process yes branch
        if (block.yesBranch && block.yesBranch.length > 0) {
          v2Blocks.push(v2Block);
          const firstYesBlock = block.yesBranch.find((id) => {
            const b = v3.blocks.find((x) => x.id === id);
            return b && b.type !== 'END';
          });
          if (firstYesBlock) {
            v2Block.yesBranch = firstYesBlock;
            linkBranch(block.yesBranch);
          }

          // Process no branch
          if (block.noBranch && block.noBranch.length > 0) {
            const firstNoBlock = block.noBranch.find((id) => {
              const b = v3.blocks.find((x) => x.id === id);
              return b && b.type !== 'END';
            });
            if (firstNoBlock) {
              v2Block.noBranch = firstNoBlock;
              linkBranch(block.noBranch);
            }
          }

          if (prevId) {
            const prev = v2Blocks.find((b) => b.id === prevId);
            if (prev && !prev.next) prev.next = block.id;
          }
          prevId = block.id;
          continue;
        }
      }

      v2Blocks.push(v2Block);

      if (prevId) {
        const prev = v2Blocks.find((b) => b.id === prevId);
        if (prev && !prev.next) prev.next = block.id;
      }

      prevId = block.id;
    }

    return prevId;
  }

  function linkBranch(childIds: string[]) {
    let prevId: string | null = null;

    for (const childId of childIds) {
      const block = v3.blocks.find((b) => b.id === childId);
      if (!block || block.type === 'END') continue;

      if (v2Blocks.find((b) => b.id === block.id)) {
        if (prevId) {
          const prev = v2Blocks.find((b) => b.id === prevId);
          if (prev && !prev.next) prev.next = block.id;
        }
        prevId = block.id;
        continue;
      }

      const v2Type =
        block.type === 'STATUS_CHANGE' ? 'STATUS' : block.type;

      const v2Block: BlockDef = {
        id: block.id,
        type: v2Type,
        name: block.name,
        icon: block.icon,
        config: block.config || {},
        next: null,
      };

      v2Blocks.push(v2Block);

      if (prevId) {
        const prev = v2Blocks.find((b) => b.id === prevId);
        if (prev && !prev.next) prev.next = block.id;
      }
      prevId = block.id;
    }
  }

  const lastId = processChain(triggerBlock.children);

  // Add END block
  v2Blocks.push({
    id: endId,
    type: 'END',
    name: 'Fim',
    icon: '⏹️',
    config: {},
    next: null,
  });

  // Link start to first child
  const firstChild = triggerBlock.children[0];
  if (firstChild) {
    const firstBlock = v3.blocks.find((b) => b.id === firstChild);
    if (firstBlock && firstBlock.type !== 'END') {
      v2Blocks[0].next = firstChild;
    } else {
      v2Blocks[0].next = endId;
    }
  } else {
    v2Blocks[0].next = endId;
  }

  // Ensure last block links to end
  if (lastId && lastId !== endId) {
    const last = v2Blocks.find((b) => b.id === lastId);
    if (last && !last.next) last.next = endId;
  }

  return { version: 2, blocks: v2Blocks };
}

/**
 * Normalize branch endings: the builder may leave the last block in a branch
 * with next = null; we fix them to point to the CONDITION's merge-point (block.next).
 */
function normalizeBranches(blocks: BlockDef[]): BlockDef[] {
  const result = blocks.map((b) => ({ ...b }));

  for (const block of result) {
    if (block.type !== 'CONDITION') continue;
    const mergePoint = block.next;
    if (!mergePoint) continue;

    for (const branch of ['yesBranch', 'noBranch'] as const) {
      const branchStart = block[branch];
      if (!branchStart) continue;

      const visited = new Set<string>();
      let id: string | null = branchStart;
      while (id) {
        if (visited.has(id)) break;
        visited.add(id);
        const b = result.find((x) => x.id === id);
        if (!b) break;
        if (!b.next) {
          b.next = mergePoint;
          break;
        }
        if (b.next === mergePoint) break;
        id = b.next;
      }
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE
   ═══════════════════════════════════════════════════════════════ */

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(NotificationService)
    private readonly notifications?: NotificationService,
    @Optional()
    @Inject(FinanceService)
    private readonly finance?: FinanceService,
    @Optional()
    @Inject(PublicOfferService)
    private readonly publicOffer?: PublicOfferService,
  ) {}

  /* ──────────────────────────────────────────────────────────── */
  /*  Find workflow by trigger ID                                 */
  /* ──────────────────────────────────────────────────────────── */

  async findWorkflowByTrigger(
    companyId: string,
    triggerIds: string[],
  ): Promise<{ id: string } | null> {
    const workflows = await this.prisma.workflowTemplate.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // Try each trigger in priority order (e.g. urgent > return > created)
    for (const triggerId of triggerIds) {
      const match = workflows.find(wf => {
        const steps = wf.steps as any;
        return steps?.trigger?.triggerId === triggerId;
      });
      if (match) return { id: match.id };
    }

    return null;
  }

  /* ──────────────────────────────────────────────────────────── */
  /*  Execute workflow from START block (V3 mode)                 */
  /*  Replaces executeStageNotifications for new workflows.       */
  /*  Walks from START, auto-executing system blocks (NOTIFY,     */
  /*  STATUS auto) and stopping at actionable blocks (GPS, PHOTO, */
  /*  STATUS manual, etc.) — the tech portal handles the rest.    */
  /*  Works with ANY trigger (OS, partner, quote).                */
  /* ──────────────────────────────────────────────────────────── */

  async executeWorkflowFromStart(
    serviceOrderId: string,
    companyId: string,
    workflowTemplateId: string,
  ): Promise<{ executed: number; stoppedAt?: string }> {
    this.logger.log(`🚀 executeWorkflowFromStart: OS=${serviceOrderId}, template=${workflowTemplateId}`);

    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id: workflowTemplateId, deletedAt: null },
    });
    if (!template) {
      this.logger.warn(`🚀 Template ${workflowTemplateId} not found`);
      return { executed: 0 };
    }

    const rawSteps = template.steps as any;
    let blocks: any[] = [];
    if (rawSteps?.version === 2 && Array.isArray(rawSteps.blocks)) blocks = rawSteps.blocks;
    else if (rawSteps?.version === 3 && Array.isArray(rawSteps.blocks)) blocks = rawSteps.blocks;

    if (blocks.length === 0) {
      this.logger.log('🚀 No blocks in workflow — skipping');
      return { executed: 0 };
    }

    // Find START block and traverse via next pointers
    const startBlock = blocks.find((b: any) => b.type === 'START');
    if (!startBlock) {
      this.logger.warn('🚀 No START block found');
      return { executed: 0 };
    }

    let currentId: string | null = startBlock.next;
    const visited = new Set<string>();
    let executed = 0;
    let stepOrder = 0;

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const block = blocks.find((b: any) => b.id === currentId);
      if (!block || block.type === 'END') break;

      // ACTIONABLE block = parar (tecnico precisa interagir)
      if (ACTIONABLE_TYPES.has(block.type)) {
        this.logger.log(`🚀 Stopped at actionable block: ${block.type} "${block.name}"`);
        return { executed, stoppedAt: `${block.type}:${block.name}` };
      }

      // System blocks: auto-executar (STATUS blocks NUNCA param o engine — blocos interativos controlam parada)
      try {
        this.logger.log(`🚀 Auto-executing ${block.type} "${block.name}"`);

        if (block.type === 'STATUS' || block.type === 'STATUS_CHANGE') {
          await this.executeSystemBlock(block, serviceOrderId, companyId);
        } else if (block.type === 'NOTIFY') {
          await this.executeSystemBlock(block, serviceOrderId, companyId);
        } else if (block.type === 'FINANCIAL_ENTRY') {
          await this.executeSystemBlock(block, serviceOrderId, companyId);
        } else if (block.type === 'ALERT') {
          await this.executeSystemBlock(block, serviceOrderId, companyId);
        } else if (block.type === 'DELAY') {
          // Delay: compute ms from duration+unit (new) or legacy minutes field
          const delayMs = (() => {
            const dur = block.config?.duration;
            const unit = block.config?.unit;
            if (dur && unit) {
              const multipliers: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
              return dur * (multipliers[unit] || 60000);
            }
            return (block.config?.minutes || 0) * 60 * 1000;
          })();
          if (delayMs > 0 && delayMs <= 300000) {
            // Delays até 5 min: sleep inline
            this.logger.log(`⏳ DELAY: Waiting ${delayMs}ms (${block.config?.duration || block.config?.minutes} ${block.config?.unit || 'minutes'})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          } else if (delayMs > 300000) {
            // Delays > 5 min: agendar continuação assíncrona
            this.logger.log(`⏳ DELAY: Scheduling ${delayMs}ms delay for OS ${serviceOrderId}`);
            setTimeout(async () => {
              try {
                this.logger.log(`⏳ DELAY resumed for OS ${serviceOrderId}, continuing from block ${block.id}`);
                // Continue execution from the next block after delay
                let nextId = block.next;
                while (nextId) {
                  const nextBlock = blocks.find((b: any) => b.id === nextId);
                  if (!nextBlock || nextBlock.type === 'END') break;
                  if (ACTIONABLE_TYPES.has(nextBlock.type)) break;
                  try {
                    await this.executeSystemBlock(nextBlock, serviceOrderId, companyId);
                    await this.prisma.workflowStepLog.create({
                      data: {
                        serviceOrderId, stepOrder: stepOrder + 1,
                        stepName: nextBlock.name || nextBlock.type,
                        blockId: nextBlock.id, partnerId: 'SYSTEM',
                        responseData: { autoCompleted: true, executedBy: 'delayResume' },
                      },
                    });
                  } catch (err) {
                    this.logger.error(`⏳ DELAY resume failed at ${nextBlock.type}: ${(err as Error).message}`);
                    break;
                  }
                  nextId = nextBlock.next || null;
                }
              } catch (err) {
                this.logger.error(`⏳ DELAY resume error: ${(err as Error).message}`);
              }
            }, delayMs);
            // Return immediately — delay will continue execution asynchronously
            return { executed, stoppedAt: `DELAY:${block.config?.duration || block.config?.minutes}${block.config?.unit || 'min'}` };
          }
        } else {
          this.logger.log(`🚀 Skipping unhandled block type: ${block.type}`);
        }

        // Registrar log de execucao automatica
        stepOrder++;
        await this.prisma.workflowStepLog.create({
          data: {
            serviceOrderId,
            stepOrder,
            stepName: block.name || block.type,
            blockId: block.id,
            partnerId: 'SYSTEM',
            responseData: { autoCompleted: true, executedBy: 'executeWorkflowFromStart' },
          },
        });

        executed++;
      } catch (err) {
        this.logger.error(`🚀 Failed to execute ${block.type} "${block.name}": ${(err as Error).message}`);
      }

      // Seguir para proximo bloco
      currentId = block.next || null;
    }

    this.logger.log(`🚀 Workflow execution complete: ${executed} blocks auto-executed`);
    return { executed };
  }

  /* ──────────────────────────────────────────────────────────── */
  /*  Get progress — auto-detects V1 or V2                       */
  /* ──────────────────────────────────────────────────────────── */

  async getProgress(
    serviceOrderId: string,
    companyId: string,
  ): Promise<WorkflowProgress | WorkflowProgressV2 | null> {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, deletedAt: null },
      include: {
        workflowTemplate: true,
        workflowStepLogs: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId)
      throw new ForbiddenException('Acesso negado');
    if (!so.workflowTemplate) return null;

    const rawSteps = so.workflowTemplate.steps;
    if (isV3(rawSteps)) {
      return this.getProgressV2(so, convertV3toV2(rawSteps));
    }
    if (isV2(rawSteps)) {
      return this.getProgressV2(so, rawSteps);
    }
    return this.getProgressV1(so);
  }

  /* ──────────────────────────────────────────────────────────── */
  /*  Advance step/block — auto-detects V1 or V2                 */
  /* ──────────────────────────────────────────────────────────── */

  async advanceStep(
    serviceOrderId: string,
    technicianId: string,
    companyId: string,
    dto: StepProgressDto,
  ): Promise<WorkflowProgress | WorkflowProgressV2> {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, deletedAt: null },
      include: {
        workflowTemplate: true,
        workflowStepLogs: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId)
      throw new ForbiddenException('Acesso negado');
    if (!so.workflowTemplate)
      throw new BadRequestException(
        'Esta OS não possui fluxo de atendimento',
      );

    if (!['OFERTADA', 'ATRIBUIDA', 'A_CAMINHO', 'EM_EXECUCAO', 'AJUSTE'].includes(so.status)) {
      throw new BadRequestException(
        'Não é possível avançar o fluxo neste status',
      );
    }

    const rawSteps = so.workflowTemplate.steps;
    if (isV3(rawSteps)) {
      return this.advanceBlockV2(so, convertV3toV2(rawSteps), technicianId, companyId, dto);
    }
    if (isV2(rawSteps)) {
      return this.advanceBlockV2(so, rawSteps, technicianId, companyId, dto);
    }
    return this.advanceStepV1(so, technicianId, companyId, dto);
  }

  /* ──────────────────────────────────────────────────────────── */
  /*  Reset step — supports V1 (stepOrder) and V2 (blockId)      */
  /* ──────────────────────────────────────────────────────────── */

  async resetStep(
    serviceOrderId: string,
    stepOrderOrBlockId: number | string,
    companyId: string,
  ): Promise<WorkflowProgress | WorkflowProgressV2> {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, deletedAt: null },
    });

    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId)
      throw new ForbiddenException('Acesso negado');

    if (typeof stepOrderOrBlockId === 'number') {
      await this.prisma.workflowStepLog.deleteMany({
        where: {
          serviceOrderId,
          stepOrder: { gte: stepOrderOrBlockId },
        },
      });
    } else {
      const log = await this.prisma.workflowStepLog.findFirst({
        where: { serviceOrderId, blockId: stepOrderOrBlockId },
      });
      if (log) {
        await this.prisma.workflowStepLog.deleteMany({
          where: {
            serviceOrderId,
            stepOrder: { gte: log.stepOrder },
          },
        });
      }
    }

    return this.getProgress(
      serviceOrderId,
      companyId,
    ) as Promise<WorkflowProgress | WorkflowProgressV2>;
  }

  /* ═══════════════════════════════════════════════════════════
     V1 — Linear step progression (original logic)
     ═══════════════════════════════════════════════════════════ */

  private getProgressV1(so: any): WorkflowProgress {
    const templateSteps = (
      so.workflowTemplate.steps as unknown as WorkflowStep[]
    ).sort((a, b) => a.order - b.order);

    const completedMap = new Map<number, any>(
      so.workflowStepLogs.map((log: any) => [log.stepOrder, log] as [number, any]),
    );

    const steps = templateSteps.map((step) => {
      const log = completedMap.get(step.order);
      return {
        ...step,
        completed: !!log,
        completedAt: log?.completedAt?.toISOString(),
        note: log?.note ?? undefined,
        photoUrl: log?.photoUrl ?? undefined,
      };
    });

    const completedCount = so.workflowStepLogs.length;
    const currentStep = steps.find((s) => !s.completed) ?? null;

    return {
      templateId: so.workflowTemplate.id,
      templateName: so.workflowTemplate.name,
      version: 1,
      totalSteps: templateSteps.length,
      completedSteps: completedCount,
      currentStep,
      steps,
      isComplete: completedCount >= templateSteps.length,
    };
  }

  private async advanceStepV1(
    so: any,
    technicianId: string,
    companyId: string,
    dto: StepProgressDto,
  ): Promise<WorkflowProgress> {
    const templateSteps = (
      so.workflowTemplate.steps as unknown as WorkflowStep[]
    ).sort((a, b) => a.order - b.order);

    const completedOrders = new Set(
      so.workflowStepLogs.map((l: any) => l.stepOrder),
    );

    const nextStep = templateSteps.find(
      (s) => !completedOrders.has(s.order),
    );
    if (!nextStep) {
      throw new BadRequestException('Todos os passos já foram concluídos');
    }

    if (nextStep.requirePhoto && !dto.photoUrl) {
      throw new BadRequestException(
        `O passo "${nextStep.name}" requer uma foto`,
      );
    }
    if (nextStep.requireNote && !dto.note) {
      throw new BadRequestException(
        `O passo "${nextStep.name}" requer uma observação`,
      );
    }

    const newCompletedCount = completedOrders.size + 1;
    const isNowComplete = newCompletedCount >= templateSteps.length;

    let newStatus: ServiceOrderStatus | null = null;
    if (isNowComplete) {
      newStatus = ServiceOrderStatus.CONCLUIDA;
    } else if (so.status === 'ATRIBUIDA' || so.status === 'AJUSTE') {
      newStatus = ServiceOrderStatus.EM_EXECUCAO;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowStepLog.create({
        data: {
          serviceOrderId: so.id,
          stepOrder: nextStep.order,
          stepName: nextStep.name,
          partnerId: technicianId,
          note: dto.note,
          photoUrl: dto.photoUrl,
        },
      });

      if (newStatus) {
        await tx.serviceOrder.update({
          where: { id: so.id },
          data: { status: newStatus },
        });
      }

      await tx.serviceOrderEvent.create({
        data: {
          companyId,
          serviceOrderId: so.id,
          type: isNowComplete
            ? 'WORKFLOW_COMPLETED'
            : 'WORKFLOW_STEP_COMPLETED',
          actorType: 'TECNICO',
          actorId: technicianId,
          payload: {
            stepOrder: nextStep.order,
            stepName: nextStep.name,
            completedSteps: newCompletedCount,
            totalSteps: templateSteps.length,
          },
        },
      });
    });

    if (this.notifications) {
      const statusLabel = isNowComplete ? 'CONCLUIDA' : 'EM_EXECUCAO';
      this.notifications
        .notifyStatusChange(
          companyId,
          so.id,
          so.title ?? 'OS',
          statusLabel,
        )
        .catch(() => {});
    }

    return this.getProgress(
      so.id,
      companyId,
    ) as Promise<WorkflowProgress>;
  }

  /* ═══════════════════════════════════════════════════════════
     V2 — Block graph execution engine
     ═══════════════════════════════════════════════════════════ */

  private getProgressV2(so: any, def: V2Def): WorkflowProgressV2 {
    const blocks = normalizeBranches(def.blocks);
    const logsByBlockId = new Map<string, any>();
    for (const log of so.workflowStepLogs) {
      if (log.blockId) logsByBlockId.set(log.blockId, log);
    }

    const start = blocks.find((b) => b.type === 'START');
    if (!start)
      throw new BadRequestException('Template sem bloco START');

    const executionPath: BlockProgress[] = [];
    let currentBlock: BlockDef | null = null;
    let foundEnd = false;
    const visited = new Set<string>();
    let currentId: string | null = start.id;

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const block = blocks.find((b) => b.id === currentId);
      if (!block) break;

      const log = logsByBlockId.get(block.id);
      const isCompleted = !!log;
      const isActionable = ACTIONABLE_TYPES.has(block.type);

      // END block
      if (block.type === 'END') {
        foundEnd = true;
        executionPath.push({ ...block, completed: true });
        break;
      }

      // START block — always "completed"
      if (block.type === 'START') {
        executionPath.push({ ...block, completed: true });
        currentId = block.next;
        continue;
      }

      // WAIT_FOR block que está aguardando → NÃO está completado
      const isWaitForPending =
        block.type === 'WAIT_FOR' &&
        log?.responseData?.status === 'WAITING';

      // Add to execution path
      executionPath.push({
        ...block,
        completed: isWaitForPending ? false : isCompleted || !isActionable,
        completedAt: log?.completedAt?.toISOString(),
        note: log?.note ?? undefined,
        photoUrl: log?.photoUrl ?? undefined,
        responseData: log?.responseData ?? undefined,
      });

      // Se WAIT_FOR pendente, para aqui
      if (isWaitForPending) {
        currentBlock = block;
        break;
      }

      // Determine next block
      if (block.type === 'CONDITION') {
        if (isCompleted) {
          const answer = log?.responseData?.answer;
          const isYes =
            answer === 'SIM' ||
            answer === 'sim' ||
            answer === 'Sim' ||
            answer === 'yes' ||
            answer === true;
          currentId = isYes
            ? block.yesBranch || block.next
            : block.noBranch || block.next;
        } else {
          currentBlock = block;
          break;
        }
      } else if (block.type === 'ACTION_BUTTONS' && isCompleted) {
        const buttonId = log?.responseData?.buttonId;
        const branches: Record<string, string | null> = (block as any).branches || {};
        currentId = (buttonId && branches[buttonId]) || block.next;
      } else if (isActionable && !isCompleted) {
        currentBlock = block;
        break;
      } else {
        currentId = block.next;
      }
    }

    const actionBlocks = executionPath.filter((b) =>
      ACTIONABLE_TYPES.has(b.type),
    );
    const totalActionable = actionBlocks.length;
    const completedActionable = actionBlocks.filter(
      (b) => b.completed,
    ).length;

    return {
      templateId: so.workflowTemplate.id,
      templateName: so.workflowTemplate.name,
      version: 2,
      totalBlocks: totalActionable,
      completedBlocks: completedActionable,
      currentBlock,
      executionPath,
      isComplete: foundEnd && !currentBlock,
      techPortalConfig: def.techPortalConfig || null,
    };
  }

  private async advanceBlockV2(
    so: any,
    def: V2Def,
    technicianId: string,
    companyId: string,
    dto: StepProgressDto,
  ): Promise<WorkflowProgressV2> {
    const progress = this.getProgressV2(so, def);

    if (!progress.currentBlock) {
      throw new BadRequestException(
        'Todos os blocos já foram concluídos',
      );
    }

    const block = progress.currentBlock;

    if (dto.blockId && dto.blockId !== block.id) {
      throw new BadRequestException(
        `Bloco esperado: "${block.name}" (${block.id})`,
      );
    }

    this.validateBlockRequirements(block, dto);

    // ── ARRIVAL_QUESTION: validar tempo informado pelo técnico ──
    let arrivalMinutesToSave: number | null = null;
    if (block.type === 'ARRIVAL_QUESTION') {
      const selectedMinutes = dto.responseData?.selectedMinutes;
      if (typeof selectedMinutes !== 'number' || selectedMinutes < 1) {
        throw new BadRequestException('Informe um tempo estimado válido.');
      }
      // Buscar o limite (enRouteTimeout) — pode vir da OS ou do bloco config
      const enRouteFromOS = (so as any).enRouteTimeoutMinutes;
      const blockConfig = block.config || {};
      // Se a OS tem timeout definido, usa; senão tenta do workflow (config do bloco não tem, mas o ASSIGN_TECH anterior define)
      const enRouteLimit = enRouteFromOS || null;
      if (enRouteLimit && selectedMinutes > enRouteLimit) {
        throw new BadRequestException(
          `O tempo informado (${selectedMinutes} min) excede o prazo de ${enRouteLimit} minutos para ir a caminho. ` +
          `Informe um tempo menor ou clique em "Não vou poder atender".`,
        );
      }
      arrivalMinutesToSave = selectedMinutes;
    }

    let nextStepOrder = so.workflowStepLogs.length + 1;

    let newStatus: ServiceOrderStatus | null = null;

    // Legacy fallback: auto-transicionar para EM_EXECUCAO se workflow antigo sem blocos STATUS
    if (
      (so.status === 'ATRIBUIDA' || so.status === 'AJUSTE') &&
      block.type !== 'ARRIVAL_QUESTION' &&
      !def.blocks?.some((b: any) => b.type === 'STATUS')
    ) {
      newStatus = ServiceOrderStatus.EM_EXECUCAO;
    }

    const blocks = normalizeBranches(def.blocks);

    await this.prisma.$transaction(async (tx) => {
      // Se ARRIVAL_QUESTION, salvar estimatedArrivalMinutes na OS
      if (arrivalMinutesToSave !== null) {
        await tx.serviceOrder.update({
          where: { id: so.id },
          data: { estimatedArrivalMinutes: arrivalMinutesToSave } as any,
        });
      }

      await tx.workflowStepLog.create({
        data: {
          serviceOrderId: so.id,
          stepOrder: nextStepOrder,
          stepName: block.name,
          blockId: block.id,
          partnerId: technicianId,
          note: dto.note,
          photoUrl: dto.photoUrl,
          responseData: dto.responseData || undefined,
        },
      });

      if (newStatus) {
        const st = newStatus as string;
        const statusUpdateData: any = { status: newStatus };
        if (st === 'ATRIBUIDA' && !so.acceptedAt) statusUpdateData.acceptedAt = new Date();
        if (st === 'EM_EXECUCAO' && !so.startedAt) statusUpdateData.startedAt = new Date();
        if ((st === 'CONCLUIDA' || st === 'APROVADA') && !so.completedAt) statusUpdateData.completedAt = new Date();
        if (st === 'ATRIBUIDA' && !so.assignedPartnerId && (so as any).directedTechnicianIds?.length > 0) {
          statusUpdateData.assignedPartnerId = (so as any).directedTechnicianIds[0];
        }
        await tx.serviceOrder.update({ where: { id: so.id }, data: statusUpdateData });
      }

      await tx.serviceOrderEvent.create({
        data: {
          companyId,
          serviceOrderId: so.id,
          type: 'WORKFLOW_STEP_COMPLETED',
          actorType: 'TECNICO',
          actorId: technicianId,
          payload: {
            blockId: block.id,
            blockType: block.type,
            blockName: block.name,
          },
        },
      });

      // ── Auto-complete system blocks that follow ──
      let nextBlockId: string | null = null;

      if (block.type === 'CONDITION') {
        const answer = dto.responseData?.answer;
        const isYes =
          answer === 'SIM' ||
          answer === 'sim' ||
          answer === 'Sim' ||
          answer === 'yes' ||
          answer === true;
        const condBlock = blocks.find((b) => b.id === block.id);
        nextBlockId = isYes
          ? condBlock?.yesBranch || condBlock?.next || null
          : condBlock?.noBranch || condBlock?.next || null;
      } else if (block.type === 'ACTION_BUTTONS') {
        const buttonId = dto.responseData?.buttonId;
        const abBlock = blocks.find((b) => b.id === block.id);
        const branches: Record<string, string | null> = (abBlock as any)?.branches || {};
        nextBlockId = branches[buttonId] || abBlock?.next || null;
        this.logger.log(`🎯 ACTION_BUTTONS: tech chose "${buttonId}" → next=${nextBlockId}`);
      } else {
        const currBlock = blocks.find((b) => b.id === block.id);
        nextBlockId = currBlock?.next || null;
      }

      const autoVisited = new Set<string>();
      while (nextBlockId) {
        if (autoVisited.has(nextBlockId)) break;
        autoVisited.add(nextBlockId);

        const nextBlock = blocks.find((b) => b.id === nextBlockId);
        if (!nextBlock || nextBlock.type === 'END') break;
        if (ACTIONABLE_TYPES.has(nextBlock.type)) break;
        // ── WAIT_FOR: criar PendingWorkflowWait e PARAR ──
        if (nextBlock.type === 'WAIT_FOR') {
          const waitConfig = nextBlock.config || {};
          const timeoutMinutes = waitConfig.timeoutMinutes || 60;
          const expiresAt = new Date(
            Date.now() + timeoutMinutes * 60_000,
          );

          nextStepOrder++;

          // Log como "em espera" (não completado ainda)
          await tx.workflowStepLog.create({
            data: {
              serviceOrderId: so.id,
              stepOrder: nextStepOrder,
              stepName: nextBlock.name,
              blockId: nextBlock.id,
              partnerId: technicianId,
              responseData: {
                autoCompleted: false,
                waitingFor: waitConfig.triggerConditions || [],
                expiresAt: expiresAt.toISOString(),
                status: 'WAITING',
              },
            },
          });

          // Criar registro PendingWorkflowWait
          await tx.pendingWorkflowWait.create({
            data: {
              companyId,
              serviceOrderId: so.id,
              workflowTemplateId: so.workflowTemplateId || '',
              blockId: nextBlock.id,
              nextBlockId: nextBlock.next,
              technicianId,
              stepOrder: nextStepOrder,
              expiresAt,
              triggerConditions: waitConfig.triggerConditions || [],
              targetStatus: waitConfig.targetStatus || null,
              timeoutAction: waitConfig.timeoutAction || 'continue',
            },
          });

          await tx.serviceOrderEvent.create({
            data: {
              companyId,
              serviceOrderId: so.id,
              type: 'WORKFLOW_WAIT_STARTED',
              actorType: 'SYSTEM',
              actorId: null,
              payload: {
                blockId: nextBlock.id,
                blockName: nextBlock.name,
                expiresAt: expiresAt.toISOString(),
                triggerConditions: waitConfig.triggerConditions || [],
                timeoutMinutes,
              },
            },
          });

          this.logger.log(
            `⏳ WAIT_FOR: Workflow paused for OS ${so.id}, block "${nextBlock.name}", expires ${expiresAt.toISOString()}`,
          );

          break; // SAIR do while — fluxo pausado
        }

        nextStepOrder++;

        // Execute system block action
        let actionResult: any = null;
        try {
          actionResult = await this.executeSystemBlock(
            nextBlock,
            so.id,
            companyId,
            technicianId,
          );
        } catch (err) {
          this.logger.error(
            `System block ${nextBlock.type} failed: ${(err as Error).message}`,
          );
        }

        await tx.workflowStepLog.create({
          data: {
            serviceOrderId: so.id,
            stepOrder: nextStepOrder,
            stepName: nextBlock.name,
            blockId: nextBlock.id,
            partnerId: technicianId,
            responseData: {
              autoCompleted: true,
              actionResult: actionResult ?? undefined,
            },
          },
        });

        await tx.serviceOrderEvent.create({
          data: {
            companyId,
            serviceOrderId: so.id,
            type: 'WORKFLOW_STEP_COMPLETED',
            actorType: 'SYSTEM',
            actorId: null,
            payload: {
              blockId: nextBlock.id,
              blockType: nextBlock.type,
              blockName: nextBlock.name,
              autoCompleted: true,
            },
          },
        });

        nextBlockId = nextBlock.next;
      }
    });

    // Re-fetch progress
    const updatedProgress = (await this.getProgress(
      so.id,
      companyId,
    )) as WorkflowProgressV2;

    // If workflow complete → update OS status
    if (
      updatedProgress.isComplete &&
      !['CONCLUIDA', 'APROVADA'].includes(so.status)
    ) {
      await this.prisma.$transaction(async (tx) => {
        await tx.serviceOrder.update({
          where: { id: so.id },
          data: {
            status: ServiceOrderStatus.CONCLUIDA,
            completedAt: new Date(),
          },
        });
        await tx.serviceOrderEvent.create({
          data: {
            companyId,
            serviceOrderId: so.id,
            type: 'WORKFLOW_COMPLETED',
            actorType: 'TECNICO',
            actorId: technicianId,
            payload: {
              totalBlocks: updatedProgress.totalBlocks,
            },
          },
        });
      });

      if (this.notifications) {
        this.notifications
          .notifyStatusChange(
            companyId,
            so.id,
            so.title ?? 'OS',
            'CONCLUIDA',
          )
          .catch(() => {});
      }

      return this.getProgress(
        so.id,
        companyId,
      ) as Promise<WorkflowProgressV2>;
    }

    if (newStatus && this.notifications) {
      this.notifications
        .notifyStatusChange(
          companyId,
          so.id,
          so.title ?? 'OS',
          'EM_EXECUCAO',
        )
        .catch(() => {});
    }

    return updatedProgress;
  }

  /* ── Resume from block (called by WaitForService after WAIT_FOR resolves) ── */

  async resumeFromBlock(
    serviceOrderId: string,
    companyId: string,
    technicianId: string,
    startBlockId: string,
    lastStepOrder: number,
  ): Promise<void> {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, deletedAt: null },
      include: {
        workflowTemplate: true,
        workflowStepLogs: { orderBy: { stepOrder: 'asc' } },
      },
    });
    if (!so?.workflowTemplate) return;

    const rawSteps = so.workflowTemplate.steps;
    let def: V2Def;
    if (isV3(rawSteps)) def = convertV3toV2(rawSteps as any);
    else if (isV2(rawSteps)) def = rawSteps;
    else return;

    const blocks = normalizeBranches(def.blocks);
    let nextBlockId: string | null = startBlockId;

    // Buscar max stepOrder para evitar conflito de unique constraint
    const maxLog = await this.prisma.workflowStepLog.findFirst({
      where: { serviceOrderId },
      orderBy: { stepOrder: 'desc' },
      select: { stepOrder: true },
    });
    let stepOrder = maxLog?.stepOrder || lastStepOrder;

    await this.prisma.$transaction(async (tx) => {
      const autoVisited = new Set<string>();
      while (nextBlockId) {
        if (autoVisited.has(nextBlockId)) break;
        autoVisited.add(nextBlockId);

        const nextBlock = blocks.find((b) => b.id === nextBlockId);
        if (!nextBlock || nextBlock.type === 'END') break;
        if (ACTIONABLE_TYPES.has(nextBlock.type)) break;
        // Se encontrar outro WAIT_FOR, criar novo PendingWorkflowWait
        if (nextBlock.type === 'WAIT_FOR') {
          const waitConfig = nextBlock.config || {};
          const timeoutMinutes = waitConfig.timeoutMinutes || 60;
          const expiresAt = new Date(
            Date.now() + timeoutMinutes * 60_000,
          );

          stepOrder++;

          await tx.workflowStepLog.create({
            data: {
              serviceOrderId,
              stepOrder,
              stepName: nextBlock.name,
              blockId: nextBlock.id,
              partnerId: technicianId,
              responseData: {
                autoCompleted: false,
                waitingFor: waitConfig.triggerConditions || [],
                expiresAt: expiresAt.toISOString(),
                status: 'WAITING',
              },
            },
          });

          await tx.pendingWorkflowWait.create({
            data: {
              companyId,
              serviceOrderId,
              workflowTemplateId: so.workflowTemplateId || '',
              blockId: nextBlock.id,
              nextBlockId: nextBlock.next,
              technicianId,
              stepOrder,
              expiresAt,
              triggerConditions: waitConfig.triggerConditions || [],
              targetStatus: waitConfig.targetStatus || null,
              timeoutAction: waitConfig.timeoutAction || 'continue',
            },
          });

          await tx.serviceOrderEvent.create({
            data: {
              companyId,
              serviceOrderId,
              type: 'WORKFLOW_WAIT_STARTED',
              actorType: 'SYSTEM',
              actorId: null,
              payload: {
                blockId: nextBlock.id,
                blockName: nextBlock.name,
                expiresAt: expiresAt.toISOString(),
                triggerConditions: waitConfig.triggerConditions || [],
                timeoutMinutes,
              },
            },
          });

          this.logger.log(
            `⏳ WAIT_FOR (resume): Workflow paused again for OS ${serviceOrderId}, block "${nextBlock.name}"`,
          );
          break;
        }

        stepOrder++;

        let actionResult: any = null;
        try {
          actionResult = await this.executeSystemBlock(
            nextBlock,
            serviceOrderId,
            companyId,
            technicianId,
          );
        } catch (err) {
          this.logger.error(
            `System block ${nextBlock.type} failed (resume): ${(err as Error).message}`,
          );
        }

        await tx.workflowStepLog.create({
          data: {
            serviceOrderId,
            stepOrder,
            stepName: nextBlock.name,
            blockId: nextBlock.id,
            partnerId: technicianId,
            responseData: {
              autoCompleted: true,
              actionResult: actionResult ?? undefined,
            },
          },
        });

        await tx.serviceOrderEvent.create({
          data: {
            companyId,
            serviceOrderId,
            type: 'WORKFLOW_STEP_COMPLETED',
            actorType: 'SYSTEM',
            actorId: null,
            payload: {
              blockId: nextBlock.id,
              blockType: nextBlock.type,
              blockName: nextBlock.name,
              autoCompleted: true,
            },
          },
        });

        nextBlockId = nextBlock.next;
      }
    });

    // Verificar se workflow completo após resume
    const progress = (await this.getProgress(
      serviceOrderId,
      companyId,
    )) as WorkflowProgressV2;

    if (
      progress?.isComplete &&
      !['CONCLUIDA', 'APROVADA'].includes(so.status)
    ) {
      await this.prisma.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: ServiceOrderStatus.CONCLUIDA,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Workflow completed (via resume) for OS ${serviceOrderId}`,
      );
    }
  }

  /* ── System block executor (for auto-completed blocks) ── */

  private async executeSystemBlock(
    block: BlockDef,
    serviceOrderId: string,
    companyId: string,
    technicianId?: string,
  ): Promise<any> {
    const config = block.config || {};

    switch (block.type) {
      case 'STATUS':
      case 'STATUS_CHANGE': {
        const targetStatus = config.targetStatus;
        if (!targetStatus) return null;
        const data: any = { status: targetStatus };
        if (targetStatus === 'EM_EXECUCAO') data.startedAt = new Date();
        if (targetStatus === 'CONCLUIDA' || targetStatus === 'APROVADA')
          data.completedAt = new Date();

        // ATRIBUIDA: auto-assign first directed technician if not yet assigned
        if (targetStatus === 'ATRIBUIDA') {
          const os = await this.prisma.serviceOrder.findUnique({
            where: { id: serviceOrderId },
            select: { assignedPartnerId: true, directedTechnicianIds: true },
          });
          if (!os?.assignedPartnerId) {
            const directedIds: string[] = (os?.directedTechnicianIds as string[]) || [];
            if (directedIds.length > 0) {
              data.assignedPartnerId = directedIds[0];
              this.logger.log(`🔄 Auto-assigning technician ${directedIds[0]} for ATRIBUIDA`);
            }
          }
        }

        this.logger.log(
          `🔄 System block: Changing OS ${serviceOrderId} status → ${targetStatus}`,
        );
        return this.prisma.serviceOrder.update({
          where: { id: serviceOrderId },
          data,
        });
      }

      case 'FINANCIAL_ENTRY': {
        if (!this.finance) {
          this.logger.warn('FinanceService not available for FINANCIAL_ENTRY');
          return null;
        }
        const entryType = config.entryType || 'AUTO';
        if (entryType === 'AUTO') {
          this.logger.log(
            `💰 System block: Launching financial for OS ${serviceOrderId}`,
          );
          try {
            return await this.finance.confirm(serviceOrderId, companyId);
          } catch (err) {
            if ((err as any)?.status === 400) {
              this.logger.log('ℹ️  Financial entry already exists');
              return { alreadyExists: true };
            }
            throw err;
          }
        }
        return null;
      }

      case 'NOTIFY': {
        if (!this.notifications) return null;

        // Load full OS data for variable substitution
        const notifySO = await this.prisma.serviceOrder.findUnique({
          where: { id: serviceOrderId },
          include: {
            assignedPartner: { select: { id: true, name: true, phone: true, email: true } },
            clientPartner: { select: { id: true, name: true, phone: true, email: true } },
            company: { select: { name: true, tradeName: true, cnpj: true, phone: true, email: true } },
            items: { select: { serviceName: true, service: { select: { description: true } } } },
          },
        });
        if (!notifySO) return null;

        // Fetch last known distance from TechnicianLocationLog
        let lastDistanceStr = 'Não disponível';
        try {
          const lastLog: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT "distanceToTarget" FROM "TechnicianLocationLog"
             WHERE "serviceOrderId" = $1 AND "distanceToTarget" IS NOT NULL
             ORDER BY "createdAt" DESC LIMIT 1`,
            serviceOrderId,
          );
          if (lastLog.length > 0 && lastLog[0].distanceToTarget != null) {
            const dist = Number(lastLog[0].distanceToTarget);
            lastDistanceStr = dist >= 1000
              ? `${(dist / 1000).toFixed(1)} km`
              : `${Math.round(dist)} m`;
          }
        } catch {
          // Table may not exist yet — keep default
        }

        // Build variable map for substitution
        const commissionBps = notifySO.commissionBps ?? 0;
        const grossCents = notifySO.valueCents;
        const commissionCents = Math.round(grossCents * commissionBps / 10000);
        const netCents = grossCents - commissionCents;

        const vars: Record<string, string> = {
          '{titulo}': notifySO.title || '',
          '{descricao}': notifySO.description || '',
          '{status}': notifySO.status || '',
          '{valor}': `R$ ${(grossCents / 100).toFixed(2)}`,
          '{comissao}': `R$ ${(commissionCents / 100).toFixed(2)}`,
          '{valor_tecnico}': `R$ ${(netCents / 100).toFixed(2)}`,
          '{endereco}': (notifySO as any).addressText || '',
          '{rua}': (notifySO as any).addressStreet || '',
          '{numero}': (notifySO as any).addressNumber || '',
          '{bairro}': (notifySO as any).neighborhood || '',
          '{cidade}': (notifySO as any).city || '',
          '{estado}': (notifySO as any).state || '',
          '{cep}': (notifySO as any).cep || '',
          '{prazo}': notifySO.deadlineAt ? new Date(notifySO.deadlineAt).toLocaleDateString('pt-BR') : '',
          '{contato_local}': (notifySO as any).contactPersonName || '',
          '{cliente}': notifySO.clientPartner?.name || '',
          '{cliente_telefone}': notifySO.clientPartner?.phone || '',
          '{tecnico}': notifySO.assignedPartner?.name || '',
          '{tecnico_telefone}': notifySO.assignedPartner?.phone || '',
          '{empresa}': (notifySO.company as any)?.tradeName || notifySO.company?.name || '',
          '{razao_social}': notifySO.company?.name || '',
          '{cnpj_empresa}': (notifySO.company as any)?.cnpj || '',
          '{telefone_empresa}': (notifySO.company as any)?.phone || '',
          // {nome} is NOT in this global map — it's context-dependent:
          //   TECNICO: replaced per-target with target.name
          //   CLIENTE: replaced with clientPartner.name
          //   GESTOR: replaced with 'Gestor'
          '{nome_cliente}': notifySO.clientPartner?.name || '',
          '{data}': new Date().toLocaleDateString('pt-BR'),
          '{data_agendamento}': (notifySO as any).scheduledStartAt ? new Date((notifySO as any).scheduledStartAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          // {link_app} and {link_os} are NOT in this map — they are replaced per-technician in the TECNICO handler below
          '{link}': `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${serviceOrderId}`,
          '{tempo_aceitar}': (notifySO as any).acceptTimeoutMinutes
            ? ((notifySO as any).acceptTimeoutMinutes >= 60 && (notifySO as any).acceptTimeoutMinutes % 60 === 0
              ? `${(notifySO as any).acceptTimeoutMinutes / 60}h`
              : `${(notifySO as any).acceptTimeoutMinutes} min`)
            : 'Definido no fluxo',
          '{tempo_a_caminho}': (notifySO as any).enRouteTimeoutMinutes
            ? ((notifySO as any).enRouteTimeoutMinutes >= 60 && (notifySO as any).enRouteTimeoutMinutes % 60 === 0
              ? `${(notifySO as any).enRouteTimeoutMinutes / 60}h`
              : `${(notifySO as any).enRouteTimeoutMinutes} min`)
            : 'Definido no fluxo',
          '{tempo_estimado_chegada}': (notifySO as any).estimatedArrivalMinutes
            ? ((notifySO as any).estimatedArrivalMinutes >= 60 && (notifySO as any).estimatedArrivalMinutes % 60 === 0
              ? `${(notifySO as any).estimatedArrivalMinutes / 60}h`
              : `${(notifySO as any).estimatedArrivalMinutes} min`)
            : 'Não informado',
          '{distancia_tecnico}': lastDistanceStr,
          '{pausas}': String((notifySO as any).pauseCount || 0),
          '{tempo_pausado}': (() => {
            const ms = Number((notifySO as any).totalPausedMs || 0);
            if (ms === 0) return 'Nenhuma pausa';
            const min = Math.round(ms / 60000);
            if (min >= 60) return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`;
            return `${min} min`;
          })(),
          '{motivo_pausa}': (() => {
            // Try to get the latest pause reason from ExecutionPause
            // This is a sync context so we use the last known reason or 'N/A'
            return (notifySO as any).isPaused ? 'Pausa em andamento' : 'N/A';
          })(),
          '{servicos_nomes}': ((notifySO as any).items || []).map((i: any) => i.serviceName).filter(Boolean).join(', ') || '',
          '{servicos_descricoes}': ((notifySO as any).items || []).map((i: any) => i.service?.description || i.serviceName).filter(Boolean).join('; ') || '',
        };

        const replaceVars = (text: string): string => {
          let result = text;
          for (const [key, val] of Object.entries(vars)) {
            result = result.split(key).join(val);
          }
          return result;
        };

        // Support new multi-recipient format (recipients array) AND old single-recipient format
        const recipients: Array<{ type: string; channel: string; message: string; includeLink?: boolean }> = [];

        if (Array.isArray(config.recipients) && config.recipients.length > 0) {
          // New format: multiple recipients with individual messages
          for (const r of config.recipients) {
            if (r.enabled !== false) {
              let msg = replaceVars(r.message || '');
              // Per-recipient {nome} substitution based on type
              if (r.type === 'CLIENTE') {
                msg = msg.split('{nome}').join(notifySO.clientPartner?.name || '');
              } else if (r.type === 'FORNECEDOR') {
                msg = msg.split('{nome}').join(''); // Supplier name not available here
              } else if (r.type === 'GESTOR') {
                msg = msg.split('{nome}').join('Gestor');
              }
              // Note: for TECNICO, {nome} is replaced per-target in the loop below
              recipients.push({
                type: r.type,
                channel: r.channel || config.channel || 'WHATSAPP',
                message: msg,
                includeLink: r.includeLink === true,
              });
            }
          }
        } else if (config.recipient) {
          // Legacy single recipient format
          let msg = replaceVars(config.message || `Fluxo: bloco "${block.name}" executado`);
          // Per-recipient {nome} substitution
          if (config.recipient === 'TECNICO') {
            msg = msg.split('{nome}').join(notifySO.assignedPartner?.name || '');
          } else if (config.recipient === 'CLIENTE') {
            msg = msg.split('{nome}').join(notifySO.clientPartner?.name || '');
          }
          recipients.push({
            type: config.recipient,
            channel: config.channel || 'MOCK',
            message: msg,
          });
        }

        this.logger.log(`💬 System block: Sending notifications to ${recipients.length} recipient(s)`);

        // For TECNICO recipients, we may need to send to multiple technicians
        // (directedTechnicianIds when mode is DIRECTED, or assignedPartner when single)
        const directedIds: string[] = (notifySO as any).directedTechnicianIds || [];
        let directedPartners: Array<{ id: string; name: string; phone: string | null; email: string | null }> = [];
        if (directedIds.length > 0) {
          directedPartners = await this.prisma.partner.findMany({
            where: { id: { in: directedIds }, deletedAt: null },
            select: { id: true, name: true, phone: true, email: true },
          });
        }

        const results: Array<{ recipient: string; status: string }> = [];

        for (const r of recipients) {
          if (r.type === 'TECNICO') {
            // Determine all technician targets
            const techTargets: Array<{ phone?: string; email?: string; name: string }> = [];

            if (notifySO.assignedPartner?.phone || notifySO.assignedPartner?.email) {
              // Single assigned technician (BY_AGENDA or already assigned)
              techTargets.push({
                phone: notifySO.assignedPartner.phone || undefined,
                email: notifySO.assignedPartner.email || undefined,
                name: notifySO.assignedPartner.name,
              });
            } else if (directedPartners.length > 0) {
              // Multiple directed technicians (DIRECTED mode)
              for (const dp of directedPartners) {
                if (dp.phone || dp.email) {
                  techTargets.push({
                    phone: dp.phone || undefined,
                    email: dp.email || undefined,
                    name: dp.name,
                  });
                }
              }
            }

            if (techTargets.length === 0) {
              this.logger.warn(`💬 NOTIFY: No technician phone/email found for OS ${serviceOrderId}`);
              results.push({ recipient: 'TECNICO', status: 'no_target' });
              continue;
            }

            this.logger.log(`💬 Sending TECNICO notification to ${techTargets.length} technician(s), includeLink=${r.includeLink}`);

            // Generate public link if includeLink is enabled in the workflow NOTIFY block
            // The link is generated regardless of assignment status — DIRECTED/BY_AGENDA
            // auto-assign the tech at creation time, but the tech still needs the link.
            let publicLinkUrl = '';
            const recipientConfig = Array.isArray(config.recipients)
              ? config.recipients.find((rc: any) => rc.type === 'TECNICO')
              : null;
            if (r.includeLink && this.publicOffer) {
              try {
                const validityHours = recipientConfig?.linkConfig?.validityHours || 24;
                const offer = await this.publicOffer.createOffer(serviceOrderId, companyId, validityHours);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                publicLinkUrl = `${frontendUrl}/tech/os/${offer.token}`;
                this.logger.log(`📎 Public link generated: ${publicLinkUrl} (valid ${validityHours}h)`);
              } catch (linkErr: any) {
                this.logger.warn(`📎 Failed to generate public link: ${linkErr.message}`);
              }
            }

            for (const target of techTargets) {
              try {
                // Per-technician variable replacement: {nome} = this tech's name
                let finalMessage = r.message.split('{nome}').join(target.name || '');

                // Replace {link_os} and {link_app} variables or append link to message
                if (publicLinkUrl) {
                  if (finalMessage.includes('{link_os}')) {
                    finalMessage = finalMessage.replace(/\{link_os\}/gi, publicLinkUrl);
                  }
                  if (finalMessage.includes('{link_app}')) {
                    finalMessage = finalMessage.replace(/\{link_app\}/gi, publicLinkUrl);
                  }
                  // Append link if neither variable present
                  if (!finalMessage.includes(publicLinkUrl)) {
                    finalMessage += ` | Acesse: ${publicLinkUrl}`;
                  }
                } else {
                  finalMessage = finalMessage.replace(/\{link_os\}/gi, '');
                  finalMessage = finalMessage.replace(/\{link_app\}/gi, '');
                }

                await this.notifications.send({
                  companyId,
                  serviceOrderId,
                  channel: r.channel,
                  message: finalMessage,
                  type: 'WORKFLOW_AUTO',
                  recipientPhone: target.phone,
                  recipientEmail: target.email,
                  forceTemplate: true,
                });
                results.push({ recipient: `TECNICO:${target.name}`, status: 'sent' });
              } catch {
                results.push({ recipient: `TECNICO:${target.name}`, status: 'failed' });
              }
            }
          } else {
            // CLIENTE or GESTOR — single recipient
            let recipientPhone: string | undefined;
            let recipientEmail: string | undefined;

            switch (r.type) {
              case 'CLIENTE':
                recipientPhone = notifySO.clientPartner?.phone || undefined;
                recipientEmail = notifySO.clientPartner?.email || undefined;
                break;
              case 'GESTOR':
                recipientPhone = notifySO.company?.phone || undefined;
                recipientEmail = notifySO.company?.email || undefined;
                break;
            }

            try {
              await this.notifications.send({
                companyId,
                serviceOrderId,
                channel: r.channel,
                message: r.message,
                type: 'WORKFLOW_AUTO',
                recipientPhone,
                recipientEmail,
                forceTemplate: true,
              });
              results.push({ recipient: r.type, status: 'sent' });
            } catch {
              results.push({ recipient: r.type, status: 'failed' });
            }
          }
        }

        return { recipients: results };
      }

      case 'ALERT': {
        const message =
          config.message || `Alerta do fluxo: ${block.name}`;
        const severity = config.severity || 'info';
        this.logger.log(`🔔 System block: Alert (${severity})`);
        return this.prisma.notification.create({
          data: {
            companyId,
            serviceOrderId,
            channel: 'MOCK',
            message: `[${severity.toUpperCase()}] ${message}`,
            type: 'WORKFLOW_ALERT',
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      }

      case 'WEBHOOK': {
        const url = config.url;
        if (!url) return null;
        this.logger.log(`🔗 System block: Webhook POST ${url}`);
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (config.headers) {
          try {
            const parsed =
              typeof config.headers === 'string'
                ? JSON.parse(config.headers)
                : config.headers;
            headers = { ...headers, ...parsed };
          } catch {
            /* ignore */
          }
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              source: 'workflow',
              serviceOrderId,
              companyId,
              blockName: block.name,
              timestamp: new Date().toISOString(),
            }),
            signal: controller.signal,
          });
          return { url, status: response.status, ok: response.ok };
        } catch (err) {
          return {
            url,
            error: (err as Error).message,
          };
        } finally {
          clearTimeout(timeout);
        }
      }

      case 'ASSIGN_TECH': {
        const strategy = config.strategy || 'BEST_RATING';
        const so = await this.prisma.serviceOrder.findUnique({
          where: { id: serviceOrderId },
          select: { assignedPartnerId: true },
        });
        if (so?.assignedPartnerId) return { alreadyAssigned: true };

        const technicians = await this.prisma.partner.findMany({
          where: {
            companyId,
            partnerTypes: { has: 'TECNICO' },
            status: 'ATIVO',
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            rating: true,
            _count: {
              select: {
                serviceOrders: {
                  where: {
                    status: { in: ['ATRIBUIDA', 'EM_EXECUCAO'] },
                  },
                },
              },
            },
          },
          orderBy: { rating: 'desc' },
        });
        if (technicians.length === 0) return null;

        let selected = technicians[0];
        if (strategy === 'LEAST_BUSY') {
          technicians.sort((a, b) => {
            const diff =
              a._count.serviceOrders - b._count.serviceOrders;
            return diff !== 0 ? diff : b.rating - a.rating;
          });
          selected = technicians[0];
        }

        this.logger.log(
          `👷 System block: Assigning "${selected.name}" to OS ${serviceOrderId}`,
        );
        return this.prisma.serviceOrder.update({
          where: { id: serviceOrderId },
          data: {
            assignedPartnerId: selected.id,
            status: 'ATRIBUIDA',
          },
        });
      }

      case 'DUPLICATE_OS': {
        const original = await this.prisma.serviceOrder.findUnique({
          where: { id: serviceOrderId },
        });
        if (!original) return null;
        this.logger.log(
          `📋 System block: Duplicating OS ${serviceOrderId}`,
        );
        return this.prisma.serviceOrder.create({
          data: {
            companyId: original.companyId,
            title: `${original.title} (copia)`,
            description: original.description,
            addressText: original.addressText,
            lat: original.lat,
            lng: original.lng,
            valueCents: original.valueCents,
            addressStreet: original.addressStreet,
            addressNumber: original.addressNumber,
            addressComp: original.addressComp,
            neighborhood: original.neighborhood,
            city: original.city,
            state: original.state,
            cep: original.cep,
            deadlineAt: original.deadlineAt,
            status: 'ABERTA',
            clientPartnerId: original.clientPartnerId,
            workflowTemplateId: original.workflowTemplateId,
          },
        });
      }

      default:
        return null;
    }
  }

  /* ── Block validation per type ── */

  private validateBlockRequirements(
    block: BlockDef,
    dto: StepProgressDto,
  ): void {
    const c = block.config || {};

    switch (block.type) {
      case 'STEP':
        if (c.requirePhoto && !dto.photoUrl)
          throw new BadRequestException(
            `"${block.name}" requer uma foto`,
          );
        if (c.requireNote && !dto.note)
          throw new BadRequestException(
            `"${block.name}" requer uma observação`,
          );
        break;

      case 'PHOTO':
        if (!dto.photoUrl)
          throw new BadRequestException(
            `"${block.name}" requer uma foto`,
          );
        break;

      case 'NOTE':
        if (c.required !== false && !dto.note)
          throw new BadRequestException(
            `"${block.name}" requer uma observação`,
          );
        if (dto.note) {
          const noteLen = dto.note.trim().length;
          if (c.minChars && noteLen < c.minChars)
            throw new BadRequestException(
              `"${block.name}" requer no mínimo ${c.minChars} caracteres (atual: ${noteLen})`,
            );
          if (c.maxChars && noteLen > c.maxChars)
            throw new BadRequestException(
              `"${block.name}" permite no máximo ${c.maxChars} caracteres (atual: ${noteLen})`,
            );
        }
        break;

      case 'GPS':
        if (!dto.responseData?.lat || !dto.responseData?.lng)
          throw new BadRequestException(
            `"${block.name}" requer localização GPS`,
          );
        break;

      case 'QUESTION':
        if (!dto.responseData?.answer)
          throw new BadRequestException(
            `"${block.name}" requer uma resposta`,
          );
        break;

      case 'CHECKLIST':
        if (
          !dto.responseData?.checkedItems ||
          !Array.isArray(dto.responseData.checkedItems)
        )
          throw new BadRequestException(
            `"${block.name}" requer completar o checklist`,
          );
        break;

      case 'SIGNATURE':
        if (!dto.responseData?.signatureUrl && !dto.photoUrl)
          throw new BadRequestException(
            `"${block.name}" requer assinatura`,
          );
        break;

      case 'FORM':
        if (c.fields) {
          for (const field of c.fields) {
            if (
              field.required &&
              (!dto.responseData?.fields ||
                !dto.responseData.fields[field.name])
            ) {
              throw new BadRequestException(
                `"${block.name}": campo "${field.name}" é obrigatório`,
              );
            }
          }
        }
        break;

      case 'STATUS':
        // STATUS manual: nenhuma validacao necessaria — tech confirmou clicando o botao
        break;

      case 'CONDITION':
        if (
          dto.responseData?.answer === undefined ||
          dto.responseData?.answer === null
        )
          throw new BadRequestException(
            `"${block.name}" requer uma resposta (Sim/Não)`,
          );
        break;
      case 'ACTION_BUTTONS':
        if (!dto.responseData?.buttonId)
          throw new BadRequestException(
            `"${block.name}" requer a seleção de um botão`,
          );
        break;
    }
  }

  /* ──────────────────────────────────────────────────────────── */
  /*  Execute NOTIFY blocks for a given status (stage entry)     */
  /*  Called when an OS is created or changes status              */
  /* ──────────────────────────────────────────────────────────── */

  async executeStageNotifications(
    serviceOrderId: string,
    companyId: string,
    targetStatus: string,
    workflowTemplateId?: string | null,
  ): Promise<{ notificationId?: string; notificationStatus?: string; notificationChannel?: string; errorDetail?: string } | void> {
    this.logger.log(`📨 executeStageNotifications called: OS=${serviceOrderId}, status=${targetStatus}, templateId=${workflowTemplateId || 'auto'}`);

    if (!this.notifications) {
      this.logger.warn('📨 NotificationService not available — skipping');
      return;
    }

    try {
      // Load template if not provided
      let templateId = workflowTemplateId;
      if (!templateId) {
        const so = await this.prisma.serviceOrder.findUnique({
          where: { id: serviceOrderId },
          select: { workflowTemplateId: true },
        });
        templateId = so?.workflowTemplateId;
      }
      if (!templateId) {
        this.logger.log('📨 No workflow template attached — skipping');
        return;
      }

      const template = await this.prisma.workflowTemplate.findFirst({
        where: { id: templateId, deletedAt: null },
      });
      if (!template) {
        this.logger.warn(`📨 Template ${templateId} not found — skipping`);
        return;
      }

      // Parse steps V2
      const rawSteps = template.steps as any;
      let v2: V2Def | null = null;
      if (isV3(rawSteps)) v2 = convertV3toV2(rawSteps);
      else if (isV2(rawSteps)) v2 = rawSteps;
      if (!v2) {
        this.logger.log('📨 Not a V2 workflow — skipping');
        return;
      }

      // Find the STATUS block for this status, then find subsequent NOTIFY blocks
      const blocks = v2.blocks;
      this.logger.log(`📨 Workflow "${template.name}" has ${blocks.length} blocks, looking for STATUS=${targetStatus}`);

      let statusBlockIdx = blocks.findIndex(
        b => b.type === 'STATUS' && b.config?.targetStatus === targetStatus,
      );

      // DIRECTED/BY_AGENDA fallback: OS created as ATRIBUIDA.
      // If no STATUS:ATRIBUIDA block exists, OR it exists but has no NOTIFY chained after it,
      // fall back to STATUS:ABERTA since that's where the user configured notifications.
      if (targetStatus === 'ATRIBUIDA') {
        const needsFallback = statusBlockIdx === -1 || (() => {
          // Check if STATUS:ATRIBUIDA has any NOTIFY block chained after it
          let blk = blocks[statusBlockIdx];
          while (blk?.next) {
            const nb = blocks.find(b => b.id === blk!.next);
            if (!nb || nb.type === 'STATUS' || nb.type === 'END') break;
            if (nb.type === 'NOTIFY') return false; // Has a NOTIFY — no fallback needed
            blk = nb;
          }
          return true; // No NOTIFY found in chain
        })();

        if (needsFallback) {
          this.logger.log(`📨 STATUS:ATRIBUIDA has no NOTIFY — falling back to STATUS:ABERTA`);
          const abertaIdx = blocks.findIndex(
            b => b.type === 'STATUS' && b.config?.targetStatus === 'ABERTA',
          );
          if (abertaIdx !== -1) {
            statusBlockIdx = abertaIdx;
            this.logger.log(`📨 Fallback: using STATUS:ABERTA block to trigger notifications`);
          }
        }
      }

      if (statusBlockIdx === -1) {
        // FALLBACK FINAL: Nenhum STATUS block compativel encontrado no workflow.
        // Isso ocorre quando a OS eh criada como ATRIBUIDA (tecnico direcionado) mas o
        // workflow nao tem um STATUS:ATRIBUIDA com NOTIFY encadeado.
        // Nesse caso, comecamos do bloco START e percorremos a chain para encontrar
        // e executar os NOTIFY blocks — garantindo que a notificacao sempre dispara
        // independente da estrutura do workflow.
        const startBlock = blocks.find(b => b.type === 'START');
        if (startBlock) {
          this.logger.log(`📨 No STATUS block for ${targetStatus} — starting from START block to find NOTIFY`);
          statusBlockIdx = blocks.indexOf(startBlock);
        } else {
          this.logger.log(`📨 No STATUS block found for ${targetStatus} — available: ${blocks.filter(b => b.type === 'STATUS').map(b => b.config?.targetStatus).join(', ')}`);
          return;
        }
      }

      // Traverse from the status block via next pointers, executing NOTIFY and FINANCIAL_ENTRY blocks
      let currentBlock = blocks[statusBlockIdx];
      const visited = new Set<string>();
      let executedCount = 0;
      let firstNotifyResult: { notificationId?: string; notificationStatus?: string; notificationChannel?: string; errorDetail?: string } | undefined;

      this.logger.log(`📨 Starting from block "${currentBlock.name}" (${currentBlock.id}), next=${currentBlock.next}`);

      while (currentBlock?.next) {
        const nextBlock = blocks.find(b => b.id === currentBlock!.next);
        if (!nextBlock || visited.has(nextBlock.id)) {
          this.logger.log(`📨 Chain ended: nextBlock=${nextBlock?.id || 'null'}, visited=${visited.has(nextBlock?.id || '')}`);
          break;
        }
        visited.add(nextBlock.id);

        // Stop at the next STATUS block (different stage) or END
        if (nextBlock.type === 'STATUS' || nextBlock.type === 'END') {
          this.logger.log(`📨 Reached ${nextBlock.type} block — stopping`);
          break;
        }

        // Execute NOTIFY and FINANCIAL_ENTRY system blocks
        if (nextBlock.type === 'NOTIFY' || nextBlock.type === 'FINANCIAL_ENTRY' || nextBlock.type === 'ALERT') {
          this.logger.log(`📨 Executing ${nextBlock.type} block "${nextBlock.name}" (${nextBlock.id})`);
          try {
            const blockResult = await this.executeSystemBlock(nextBlock, serviceOrderId, companyId, undefined);
            executedCount++;

            // Capture first NOTIFY result for dispatch panel tracking
            if (nextBlock.type === 'NOTIFY' && !firstNotifyResult && blockResult?.recipients) {
              // Try to find the notification just created for this OS
              const latestNotif = await this.prisma.notification.findFirst({
                where: { serviceOrderId, companyId },
                orderBy: { createdAt: 'desc' },
                select: { id: true, status: true, channel: true, errorDetail: true },
              });
              if (latestNotif) {
                firstNotifyResult = {
                  notificationId: latestNotif.id,
                  notificationStatus: latestNotif.status,
                  notificationChannel: latestNotif.channel,
                  errorDetail: latestNotif.errorDetail || undefined,
                };
              }
            }
          } catch (err) {
            this.logger.error(
              `Stage notification ${nextBlock.type} failed for OS ${serviceOrderId}: ${(err as Error).message}`,
            );
          }
        } else {
          this.logger.log(`📨 Skipping non-notify block: ${nextBlock.type} "${nextBlock.name}"`);
        }

        currentBlock = nextBlock;
      }

      this.logger.log(
        `📨 Done: executed ${executedCount} notification(s) for OS ${serviceOrderId} → ${targetStatus}`,
      );

      return firstNotifyResult;
    } catch (err) {
      this.logger.error(
        `executeStageNotifications error: ${(err as Error).message}`,
      );
    }
  }
}
