import { Global, Module } from '@nestjs/common';
import { SaasConfigService } from './saas-config.service';
import { SaasConfigController } from './saas-config.controller';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [SaasConfigService, EncryptionService],
  controllers: [SaasConfigController],
  exports: [SaasConfigService],
})
export class SaasConfigModule {}
