import { Module } from '@nestjs/common';
import { ServiceOrderService } from './service-order.service';
import { ServiceOrderController } from './service-order.controller';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../common/audit/audit.module';
import { AutomationModule } from '../automation/automation.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { EvaluationModule } from '../evaluation/evaluation.module';

@Module({
  imports: [NotificationModule, AuditModule, AutomationModule, WorkflowModule, EvaluationModule],
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService],
  exports: [ServiceOrderService],
})
export class ServiceOrderModule {}
