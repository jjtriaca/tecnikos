import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkflowStep {
  order: number;
  name: string;
  icon: string;
  requirePhoto: boolean;
  requireNote: boolean;
}

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, opts?: { search?: string; page?: number; limit?: number }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 100, 100);
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };

    if (opts?.search) {
      where.name = { contains: opts.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflowTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, name: true, isDefault: true, isActive: true, createdAt: true },
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

  async update(id: string, companyId: string, body: { name?: string; steps?: any; isDefault?: boolean; isActive?: boolean; requiredSpecializationIds?: string[] }) {
    await this.findOne(id, companyId);
    if (body.steps) this.validateSteps(body.steps);

    // If setting as default, unset other defaults first
    if (body.isDefault) {
      await this.prisma.workflowTemplate.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.steps !== undefined) data.steps = body.steps as any;
    if (body.isDefault !== undefined) data.isDefault = body.isDefault;
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
}
