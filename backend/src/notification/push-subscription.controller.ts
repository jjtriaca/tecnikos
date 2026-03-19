import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { PushNotificationService, PushPayload } from './push-notification.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('push')
export class PushSubscriptionController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Get('vapid-key')
  async getVapidKey() {
    const publicKey = await this.pushService.getPublicKey();
    return { publicKey };
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: any,
    @Body() dto: { endpoint: string; keys: { p256dh: string; auth: string }; deviceName?: string },
  ) {
    const { companyId, userId } = req.user;
    await this.pushService.subscribe(companyId, userId, dto);
    return { success: true };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @Req() req: any,
    @Body() dto: { endpoint: string },
  ) {
    const { companyId } = req.user;
    await this.pushService.unsubscribe(companyId, dto.endpoint);
    return { success: true };
  }

  @Post('test')
  @Roles(UserRole.ADMIN)
  async testPush(@Req() req: any) {
    const { companyId, userId } = req.user;
    const payload: PushPayload = {
      title: 'Teste Push — Tecnikos',
      body: 'Se você recebeu esta notificação, o Push está funcionando!',
      url: '/dashboard',
      tag: 'push-test',
    };
    const sent = await this.pushService.sendToUser(companyId, userId, payload);
    return { success: true, sent };
  }
}
