import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SendNotificationDto {
  companyId: string;
  serviceOrderId?: string;
  channel?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  message: string;
  type: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send a notification (MOCK in MVP — logs to console and saves to DB).
   * Ready for WhatsApp/SMS/Email integration.
   */
  async send(dto: SendNotificationDto) {
    const channel = dto.channel || 'MOCK';

    // Create record
    const notification = await this.prisma.notification.create({
      data: {
        companyId: dto.companyId,
        serviceOrderId: dto.serviceOrderId,
        channel,
        recipientPhone: dto.recipientPhone,
        recipientEmail: dto.recipientEmail,
        message: dto.message,
        type: dto.type,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Mock: log to console (replace with real API call)
    this.logger.log(
      `📨 [${channel}] ${dto.type} → ${dto.recipientPhone || dto.recipientEmail || 'N/A'}: ${dto.message}`,
    );

    return notification;
  }

  /**
   * Notify when OS status changes.
   */
  async notifyStatusChange(companyId: string, serviceOrderId: string, title: string, newStatus: string, recipientPhone?: string) {
    const statusMessages: Record<string, string> = {
      ATRIBUIDA: `A OS "${title}" foi atribuída a um técnico.`,
      EM_EXECUCAO: `O técnico iniciou o atendimento da OS "${title}".`,
      CONCLUIDA: `A OS "${title}" foi concluída pelo técnico.`,
      APROVADA: `A OS "${title}" foi aprovada.`,
      AJUSTE: `A OS "${title}" precisa de ajuste.`,
    };

    const message = statusMessages[newStatus] || `Status da OS "${title}" alterado para ${newStatus}.`;

    return this.send({
      companyId,
      serviceOrderId,
      message,
      type: 'STATUS_CHANGE',
      recipientPhone,
    });
  }

  /**
   * List notifications for a company.
   */
  async findAll(companyId: string, take = 50) {
    return this.prisma.notification.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Count unread/recent notifications.
   */
  async countRecent(companyId: string, sinceHours = 24) {
    const since = new Date();
    since.setHours(since.getHours() - sinceHours);
    return this.prisma.notification.count({
      where: { companyId, createdAt: { gte: since } },
    });
  }
}
