import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationTemplateController } from './automation-template.controller';
import { AutomationService } from './automation.service';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationTemplateService } from './automation-template.service';
import { NotificationModule } from '../notification/notification.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [NotificationModule, FinanceModule],
  controllers: [AutomationController, AutomationTemplateController],
  providers: [AutomationService, AutomationEngineService, AutomationTemplateService],
  exports: [AutomationEngineService],
})
export class AutomationModule {}
