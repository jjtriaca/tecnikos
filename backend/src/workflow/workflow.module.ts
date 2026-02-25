import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WaitForService } from './wait-for.service';
import { NotificationModule } from '../notification/notification.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [NotificationModule, FinanceModule],
  controllers: [WorkflowController, WorkflowEngineController],
  providers: [WorkflowService, WorkflowEngineService, WaitForService],
  exports: [WorkflowService, WorkflowEngineService, WaitForService],
})
export class WorkflowModule {}
