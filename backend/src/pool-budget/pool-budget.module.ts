import { Module } from '@nestjs/common';
import { PoolBudgetService } from './pool-budget.service';
import { PoolBudgetController } from './pool-budget.controller';
import { PoolFormulaService } from './pool-formula.service';
import { AuditModule } from '../common/audit/audit.module';
import { CodeGeneratorService } from '../common/code-generator.service';

@Module({
  imports: [AuditModule],
  controllers: [PoolBudgetController],
  providers: [PoolBudgetService, PoolFormulaService, CodeGeneratorService],
  exports: [PoolBudgetService, PoolFormulaService],
})
export class PoolBudgetModule {}
