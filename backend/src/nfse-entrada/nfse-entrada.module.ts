import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NfseEntradaController } from './nfse-entrada.controller';
import { NfseEntradaService } from './nfse-entrada.service';
import { NfseEntradaParserService } from './nfse-entrada-parser.service';

@Module({
  imports: [PrismaModule],
  controllers: [NfseEntradaController],
  providers: [NfseEntradaService, NfseEntradaParserService],
  exports: [NfseEntradaService],
})
export class NfseEntradaModule {}
