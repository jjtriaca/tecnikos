import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SaasConfigService } from '../common/saas-config.service';
import * as webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);
  private configured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saasConfig: SaasConfigService,
  ) {}

  async onModuleInit() {
    await this.loadVapidKeys();
  }

  private async loadVapidKeys(): Promise<void> {
    try {
      const publicKey = await this.saasConfig.get('VAPID_PUBLIC_KEY');
      const privateKey = await this.saasConfig.get('VAPID_PRIVATE_KEY');
      if (publicKey && privateKey) {
        webpush.setVapidDetails(
          'mailto:admin@tecnikos.com.br',
          publicKey,
          privateKey,
        );
        this.configured = true;
        this.logger.log('VAPID keys loaded — Push Notifications enabled');
      } else {
        this.logger.warn('VAPID keys not configured — Push Notifications disabled. Generate in Admin > Configurações.');
      }
    } catch (err) {
      this.logger.error(`Failed to load VAPID keys: ${(err as Error).message}`);
    }
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  async getPublicKey(): Promise<string | null> {
    return this.saasConfig.get('VAPID_PUBLIC_KEY');
  }

  async subscribe(
    companyId: string,
    userId: string,
    dto: { endpoint: string; keys: { p256dh: string; auth: string }; deviceName?: string },
  ): Promise<void> {
    // Use deleteMany + create instead of upsert to avoid Prisma relation issues
    await this.prisma.pushSubscription.deleteMany({
      where: { companyId, endpoint: dto.endpoint },
    });
    await this.prisma.pushSubscription.create({
      data: {
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        deviceName: dto.deviceName || null,
      },
    });
    this.logger.log(`Push subscription saved for user ${userId} (${dto.deviceName || 'unknown device'})`);
  }

  async unsubscribe(companyId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { companyId, endpoint },
    });
  }

  /**
   * Send push notification to all subscriptions of a specific user.
   */
  async sendToUser(companyId: string, userId: string, payload: PushPayload): Promise<number> {
    if (!this.configured) return 0;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { companyId, userId },
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid — cleanup
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          this.logger.log(`Removed expired push subscription ${sub.id}`);
        } else {
          this.logger.warn(`Push send failed for ${sub.id}: ${err.message}`);
        }
      }
    }
    return sent;
  }

  /**
   * Send push notification to ALL users of a company.
   */
  async sendToCompany(companyId: string, payload: PushPayload): Promise<number> {
    if (!this.configured) return 0;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { companyId },
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
    return sent;
  }

  /** Daily cleanup of expired subscriptions */
  @Cron('0 3 * * *')
  async cleanupExpired() {
    const now = new Date();
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { expiresAt: { not: null, lt: now } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired push subscription(s)`);
    }
  }
}
