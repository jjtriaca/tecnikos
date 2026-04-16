import { Module, forwardRef } from '@nestjs/common';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';
import { NfeParserService } from './nfe-parser.service';
import { SefazDfeService } from './sefaz-dfe.service';
import { SefazDfeController } from './sefaz-dfe.controller';
import { DanfeService } from './danfe.service';
import { EncryptionService } from '../common/encryption.service';
import { FocusNfeProvider } from '../nfse-emission/focus-nfe.provider';
import { TenantModule } from '../tenant/tenant.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [TenantModule, forwardRef(() => FinanceModule)],
  controllers: [NfeController, SefazDfeController],
  providers: [NfeService, NfeParserService, SefazDfeService, DanfeService, EncryptionService, FocusNfeProvider],
  exports: [NfeService, SefazDfeService, DanfeService],
})
export class NfeModule {}
