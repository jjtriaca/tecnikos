import { Module } from '@nestjs/common';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';
import { NfeParserService } from './nfe-parser.service';
import { SefazDfeService } from './sefaz-dfe.service';
import { SefazDfeController } from './sefaz-dfe.controller';
import { DanfeService } from './danfe.service';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [NfeController, SefazDfeController],
  providers: [NfeService, NfeParserService, SefazDfeService, DanfeService, EncryptionService],
  exports: [NfeService, SefazDfeService, DanfeService],
})
export class NfeModule {}
