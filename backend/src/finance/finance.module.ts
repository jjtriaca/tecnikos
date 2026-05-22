import { Module, forwardRef } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { InstallmentService } from './installment.service';
import { CollectionService } from './collection.service';
import { PaymentMethodService } from './payment-method.service';
import { PaymentInstrumentService } from './payment-instrument.service';
import { CashAccountService } from './cash-account.service';
import { TransferService } from './transfer.service';
import { ReconciliationService } from './reconciliation.service';
import { FinancialReportService } from './financial-report.service';
import { CardSettlementService } from './card-settlement.service';
import { CardFeeRateService } from './card-fee-rate.service';
import { FinancialAccountService } from './financial-account.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { ClosedMonthGuardService } from './closed-month-guard.service';
import { FinanceController } from './finance.controller';
import { NfseEmissionModule } from '../nfse-emission/nfse-emission.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [forwardRef(() => NfseEmissionModule), AuditModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    InstallmentService,
    CollectionService,
    PaymentMethodService,
    PaymentInstrumentService,
    CashAccountService,
    TransferService,
    ReconciliationService,
    FinancialReportService,
    CardSettlementService,
    CardFeeRateService,
    FinancialAccountService,
    OfxParserService,
    CsvParserService,
    ClosedMonthGuardService,
  ],
  exports: [
    FinanceService,
    InstallmentService,
    CollectionService,
    PaymentMethodService,
    PaymentInstrumentService,
    CashAccountService,
    TransferService,
    ReconciliationService,
    FinancialReportService,
    CardSettlementService,
    CardFeeRateService,
    FinancialAccountService,
  ],
})
export class FinanceModule {}
