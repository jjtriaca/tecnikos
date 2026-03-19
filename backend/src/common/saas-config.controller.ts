import { Controller, Get, Put, Delete, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SaasConfigService } from './saas-config.service';
import * as webpush from 'web-push';

@Controller('admin/config')
@Roles(UserRole.ADMIN)
export class SaasConfigController {
  constructor(private readonly config: SaasConfigService) {}

  @Get()
  getAll() {
    return this.config.getAll();
  }

  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @Body() dto: { value: string; encrypted?: boolean; label?: string; group?: string },
  ) {
    if (!dto.value) throw new BadRequestException('Valor obrigatorio');
    await this.config.set(key, dto.value, {
      encrypted: dto.encrypted,
      label: dto.label,
      group: dto.group,
    });
    return { success: true };
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    await this.config.delete(key);
    return { success: true };
  }

  @Post('generate-vapid')
  async generateVapid() {
    const vapidKeys = webpush.generateVAPIDKeys();

    await this.config.set('VAPID_PUBLIC_KEY', vapidKeys.publicKey, {
      encrypted: false,
      label: 'VAPID Public Key (Push Notifications)',
      group: 'PUSH',
    });
    await this.config.set('VAPID_PRIVATE_KEY', vapidKeys.privateKey, {
      encrypted: true,
      label: 'VAPID Private Key (Push Notifications)',
      group: 'PUSH',
    });

    return { publicKey: vapidKeys.publicKey, generated: true };
  }
}
