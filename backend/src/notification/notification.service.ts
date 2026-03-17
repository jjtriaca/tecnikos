import { Injectable, Logger, Optional, NotFoundException } from '@nestjs/common';
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
  /** Force template delivery (skip text attempt). Use for business-initiated messages. */
  forceTemplate?: boolean;
  /** Use a specific WhatsApp template name (falls back to aviso_os if not found). */
  templateName?: string;
  /** Explicit template parameters (e.g. [name, link]) instead of sending full message as {{1}}. */
  templateParams?: string[];
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
    const channel = (dto.channel || 'MOCK').toUpperCase();
    let status = 'SENT';
    let whatsappMessageId: string | undefined;
    let errorDetail: string | undefined;

    // ── WhatsApp channel — send via Meta Cloud API ──
    if (channel === 'WHATSAPP' && dto.recipientPhone && this.whatsApp) {
      try {
        const connected = await this.whatsApp.isConnected(dto.companyId);
        if (connected) {
          const result = dto.templateName
            ? await this.whatsApp.sendWithNamedTemplate(dto.companyId, dto.recipientPhone, dto.message, dto.templateName, dto.templateParams)
            : await this.whatsApp.sendTextWithTemplateFallback(dto.companyId, dto.recipientPhone, dto.message, dto.forceTemplate);
          status = result.success ? 'SENT' : 'FAILED';
          whatsappMessageId = result.messageId;
          errorDetail = result.error;
          this.logger.log(`📱 [WHATSAPP] ${dto.type} → ${dto.recipientPhone}: ${status}${whatsappMessageId ? ` (msgId: ${whatsappMessageId})` : ''}`);
        } else {
          status = 'FAILED';
          errorDetail = 'WhatsApp não conectado';
          this.logger.warn(`📱 [WHATSAPP] Not connected — notification saved as FAILED`);
        }
      } catch (err) {
        status = 'FAILED';
        errorDetail = err.message;
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
        whatsappMessageId: whatsappMessageId || null,
        errorDetail: errorDetail || null,
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

    // Auto-detect channel: use WhatsApp when phone is available, otherwise MOCK
    const channel = recipientPhone && this.whatsApp ? 'WHATSAPP' : 'MOCK';

    return this.send({
      companyId,
      serviceOrderId,
      channel,
      message,
      type: 'STATUS_CHANGE',
      recipientPhone,
      forceTemplate: true, // Business-initiated: always use template
    });
  }

  /**
   * Resend a failed notification.
   */
  async resend(notificationId: string, companyId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, companyId },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada');
    }

    // Re-send via the same channel
    let status = 'SENT';
    let whatsappMessageId: string | undefined;
    let errorDetail: string | undefined;

    if (notification.channel === 'WHATSAPP' && notification.recipientPhone && this.whatsApp) {
      try {
        const connected = await this.whatsApp.isConnected(companyId);
        if (connected) {
          const result = await this.whatsApp.sendTextWithTemplateFallback(
            companyId, notification.recipientPhone, notification.message, true,
          );
          status = result.success ? 'SENT' : 'FAILED';
          whatsappMessageId = result.messageId;
          errorDetail = result.error;
        } else {
          status = 'FAILED';
          errorDetail = 'WhatsApp não conectado';
        }
      } catch (err) {
        status = 'FAILED';
        errorDetail = err.message;
      }
    } else {
      // Non-WhatsApp: just mark as sent (mock)
      status = 'SENT';
    }

    // Update the existing notification record
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status,
        whatsappMessageId: whatsappMessageId || notification.whatsappMessageId,
        errorDetail: errorDetail || null,
        sentAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get dispatch status for a service order (notification + WhatsApp delivery status).
   */
  async getDispatchStatus(serviceOrderId: string, companyId: string) {
    // Get the latest notification for this OS
    const notification = await this.prisma.notification.findFirst({
      where: { serviceOrderId, companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (!notification) return null;

    // If WhatsApp, check delivery status from WhatsAppMessage table
    let whatsappStatus: string | null = null;
    if (notification.whatsappMessageId) {
      const waMsg = await this.prisma.whatsAppMessage.findFirst({
        where: { whatsappMsgId: notification.whatsappMessageId },
        select: { status: true },
      });
      whatsappStatus = waMsg?.status || null;
    }

    return {
      id: notification.id,
      channel: notification.channel,
      status: notification.status,
      whatsappStatus, // SENT, DELIVERED, READ, FAILED
      errorDetail: notification.errorDetail,
      sentAt: notification.sentAt,
      recipientPhone: notification.recipientPhone,
    };
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
