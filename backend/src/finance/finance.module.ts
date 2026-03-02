import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { InstallmentService } from './installment.service';
import { CollectionService } from './collection.service';
import { FinanceController } from './finance.controller';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, InstallmentService, CollectionService],
  exports: [FinanceService, InstallmentService, CollectionService],
})
export class FinanceModule {}
