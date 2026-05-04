import { Module } from '@nestjs/common';
import { PoolCatalogConfigService } from './pool-catalog-config.service';
import { PoolCatalogConfigController } from './pool-catalog-config.controller';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PoolCatalogConfigController],
  providers: [PoolCatalogConfigService],
  exports: [PoolCatalogConfigService],
})
export class PoolCatalogConfigModule {}
