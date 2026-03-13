import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { EncryptionService } from '../common/encryption.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, EncryptionService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
