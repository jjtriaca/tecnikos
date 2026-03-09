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
   * Supports: WHATSAPP (via Meta Cloud API), MOCK (console log), EMAIL/SMS (future).
   */
  async send(dto: SendNotificationDto) {
    const channel = dto.channel || 'MOCK';
    let status = 'SENT';

    // ── WhatsApp channel — send via Meta Cloud API ──
    if (channel === 'WHATSAPP' && dto.recipientPhone && this.whatsApp) {
      try {
        const connected = await this.whatsApp.isConnected(dto.companyId);
        if (connected) {
          // Use sendTextWithTemplateFallback to handle 24h window rule:
          // tries text first, falls back to template if outside conversation window
          const success = await this.whatsApp.sendTextWithTemplateFallback(dto.companyId, dto.recipientPhone, dto.message);
          status = success ? 'SENT' : 'FAILED';
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
      ATRIBUIDA: `A OS "${title}" foi atribuida a um tecnico.`,
      EM_EXECUCAO: `O tecnico iniciou o atendimento da OS "${title}".`,
      CONCLUIDA: `A OS "${title}" foi concluida pelo tecnico.`,
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
   * Count unread notifications (readAt is null).
   */
  async countUnread(companyId: string) {
    return this.prisma.notification.count({
      where: { companyId, readAt: null },
    });
  }

  /**
   * Mark all notifications as read for a company.
   */
  async markAllRead(companyId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: result.count };
  }
}
