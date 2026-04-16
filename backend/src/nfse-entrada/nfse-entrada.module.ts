import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NfseEntradaController } from './nfse-entrada.controller';
import { NfseEntradaService } from './nfse-entrada.service';
import { NfseEntradaParserService } from './nfse-entrada-parser.service';
import { FocusNfeProvider } from '../nfse-emission/focus-nfe.provider';
import { EncryptionService } from '../common/encryption.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [PrismaModule, forwardRef(() => FinanceModule)],
  controllers: [NfseEntradaController],
  providers: [NfseEntradaService, NfseEntradaParserService, FocusNfeProvider, EncryptionService, CodeGeneratorService],
  exports: [NfseEntradaService],
})
export class NfseEntradaModule {}
