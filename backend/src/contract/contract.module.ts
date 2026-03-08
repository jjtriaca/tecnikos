import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { ContractPublicController } from './contract-public.controller';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [NotificationModule, EmailModule],
  controllers: [ContractController, ContractPublicController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
