import { Module } from '@nestjs/common';
import { NfseEmissionController, NfseWebhookController } from './nfse-emission.controller';
import { NfseEmissionService } from './nfse-emission.service';
import { FocusNfeProvider } from './focus-nfe.provider';
import { DanfseService } from './danfse.service';
import { EncryptionService } from '../common/encryption.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [WhatsAppModule, TenantModule],
  controllers: [NfseEmissionController, NfseWebhookController],
  providers: [NfseEmissionService, FocusNfeProvider, DanfseService, EncryptionService],
  exports: [NfseEmissionService],
})
export class NfseEmissionModule {}
