import { Module, forwardRef } from '@nestjs/common';
import { PublicOfferService } from './public-offer.service';
import { PublicOfferController } from './public-offer.controller';
import { PublicLinkController } from './public-link.controller';
import { NotificationModule } from '../notification/notification.module';
import { ChecklistResponseModule } from '../checklist-response/checklist-response.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [NotificationModule, ChecklistResponseModule, forwardRef(() => WorkflowModule)],
  controllers: [PublicOfferController, PublicLinkController],
  providers: [PublicOfferService],
  exports: [PublicOfferService],
})
export class PublicOfferModule {}
