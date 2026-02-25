import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava um log de auditoria (fire-and-forget — nunca bloqueia).
   */
  log(params: {
    companyId: string;
    entityType: 'SERVICE_ORDER' | 'PARTNER' | 'USER';
    entityId: string;
    action: string;
    actorType: 'USER' | 'SYSTEM';
    actorId?: string;
    actorName?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
  }): void {
    this.prisma.auditLog
      .create({
        data: {
          companyId: params.companyId,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          actorType: params.actorType,
          actorId: params.actorId,
          actorName: params.actorName,
          before: params.before ?? undefined,
          after: params.after ?? undefined,
        },
      })
      .catch((err) =>
        this.logger.error('Failed to write audit log', err?.stack || err),
      );
  }

  /**
   * Busca os últimos N logs de uma entidade.
   */
  async getForEntity(
    entityType: string,
    entityId: string,
    companyId: string,
    limit = 10,
  ) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId, companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
