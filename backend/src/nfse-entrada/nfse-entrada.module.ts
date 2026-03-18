import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NfseEntradaController } from './nfse-entrada.controller';
import { NfseEntradaService } from './nfse-entrada.service';
import { NfseEntradaParserService } from './nfse-entrada-parser.service';
import { FocusNfeProvider } from '../nfse-emission/focus-nfe.provider';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [NfseEntradaController],
  providers: [NfseEntradaService, NfseEntradaParserService, FocusNfeProvider, EncryptionService],
  exports: [NfseEntradaService],
})
export class NfseEntradaModule {}
