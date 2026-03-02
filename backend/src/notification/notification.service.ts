import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly whatsApp?: WhatsAppService,
  ) {}

  /**
   * Send a notification via the appropriate channel.
   * Supports: WHATSAPP (real via Evolution API), MOCK (console log), EMAIL/SMS (future).
   */
  async send(dto: SendNotificationDto) {
    const channel = dto.channel || 'MOCK';
    let status = 'SENT';

    // ── WhatsApp channel — send via Evolution API ──
    if (channel === 'WHATSAPP' && dto.recipientPhone && this.whatsApp) {
      try {
        const connected = await this.whatsApp.isConnected();
        if (connected) {
          const result = await this.whatsApp.sendText(dto.recipientPhone, dto.message);
          status = result ? 'SENT' : 'FAILED';
          this.logger.log(`📱 [WHATSAPP] ${dto.type} → ${dto.recipientPhone}: ${status}`);
        } else {
          status = 'FAILED';
          this.logger.warn(`📱 [WHATSAPP] Not connected — notification saved as FAILED`);
        }
      } catch (err) {
        status = 'FAILED';
        this.logger.error(`📱 [WHATSAPP] Error: ${err.message}`);
      }
    } else {
      // Mock: log to console (future: EMAIL, SMS, PUSH)
      this.logger.log(
        `📨 [${channel}] ${dto.type} → ${dto.recipientPhone || dto.recipientEmail || 'N/A'}: ${dto.message}`,
      );
    }

    // Create record in DB
    const notification = await this.prisma.notification.create({
      data: {
        companyId: dto.companyId,
        serviceOrderId: dto.serviceOrderId,
        channel,
        recipientPhone: dto.recipientPhone,
        recipientEmail: dto.recipientEmail,
        message: dto.message,
        type: dto.type,
        status,
        sentAt: new Date(),
      },
    });

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
