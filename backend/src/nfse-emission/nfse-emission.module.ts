import { Module } from '@nestjs/common';
import { NfseEmissionController, NfseWebhookController } from './nfse-emission.controller';
import { NfseEmissionService } from './nfse-emission.service';
import { FocusNfeProvider } from './focus-nfe.provider';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [NfseEmissionController, NfseWebhookController],
  providers: [NfseEmissionService, FocusNfeProvider, EncryptionService],
  exports: [NfseEmissionService],
})
export class NfseEmissionModule {}
