import { Module } from '@nestjs/common';
import { BoletoController } from './boleto.controller';
import { BoletoWebhookController } from './boleto-webhook.controller';
import { BoletoService } from './boleto.service';
import { BoletoConfigService } from './boleto-config.service';
import { BoletoCronService } from './boleto-cron.service';
import { BankProviderFactory } from './providers/bank-provider.factory';
import { BankInterProvider } from './providers/bank-inter.provider';
import { BankSicrediProvider } from './providers/bank-sicredi.provider';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [BoletoController, BoletoWebhookController],
  providers: [
    BoletoService,
    BoletoConfigService,
    BoletoCronService,
    BankProviderFactory,
    BankInterProvider,
    BankSicrediProvider,
    EncryptionService,
  ],
  exports: [BoletoService, BoletoConfigService],
})
export class BoletoModule {}
