import { Module } from '@nestjs/common';
import { ServiceOrderService } from './service-order.service';
import { ServiceOrderPdfService } from './service-order-pdf.service';
import { ServiceOrderController } from './service-order.controller';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../common/audit/audit.module';
import { AutomationModule } from '../automation/automation.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { EvaluationModule } from '../evaluation/evaluation.module';

@Module({
  imports: [NotificationModule, AuditModule, AutomationModule, WorkflowModule, EvaluationModule],
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService, ServiceOrderPdfService],
  exports: [ServiceOrderService],
})
export class ServiceOrderModule {}
