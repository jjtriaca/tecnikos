import { Module } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { AuditModule } from '../common/audit/audit.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [AuditModule, AutomationModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
