import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { QuotePublicController } from './quote-public.controller';
import { QuotePdfService } from './quote-pdf.service';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../common/audit/audit.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [NotificationModule, AuditModule, MulterModule, EmailModule, forwardRef(() => WorkflowModule)],
  controllers: [QuoteController, QuotePublicController],
  providers: [QuoteService, QuotePdfService],
  exports: [QuoteService, QuotePdfService],
})
export class QuoteModule {}
