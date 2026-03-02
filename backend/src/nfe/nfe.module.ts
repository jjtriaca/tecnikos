import { Module } from '@nestjs/common';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';
import { NfeParserService } from './nfe-parser.service';

@Module({
  controllers: [NfeController],
  providers: [NfeService, NfeParserService],
  exports: [NfeService],
})
export class NfeModule {}
