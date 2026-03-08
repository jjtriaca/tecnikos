import { Module } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { AuditModule } from '../common/audit/audit.module';
import { AutomationModule } from '../automation/automation.module';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [AuditModule, AutomationModule, ContractModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
