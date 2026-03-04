import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { InstallmentService } from './installment.service';
import { CollectionService } from './collection.service';
import { PaymentMethodService } from './payment-method.service';
import { CashAccountService } from './cash-account.service';
import { TransferService } from './transfer.service';
import { ReconciliationService } from './reconciliation.service';
import { FinancialReportService } from './financial-report.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { FinanceController } from './finance.controller';

@Module({
  controllers: [FinanceController],
  providers: [
    FinanceService,
    InstallmentService,
    CollectionService,
    PaymentMethodService,
    CashAccountService,
    TransferService,
    ReconciliationService,
    FinancialReportService,
    OfxParserService,
    CsvParserService,
  ],
  exports: [
    FinanceService,
    InstallmentService,
    CollectionService,
    PaymentMethodService,
    CashAccountService,
    TransferService,
    ReconciliationService,
    FinancialReportService,
  ],
})
export class FinanceModule {}
