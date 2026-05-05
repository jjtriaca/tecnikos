import { Module } from '@nestjs/common';
import { PoolBudgetTemplateService } from './pool-budget-template.service';
import { PoolBudgetTemplateController } from './pool-budget-template.controller';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PoolBudgetTemplateController],
  providers: [PoolBudgetTemplateService],
  exports: [PoolBudgetTemplateService],
})
export class PoolBudgetTemplateModule {}
