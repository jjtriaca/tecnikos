import { Module } from '@nestjs/common';
import { PpidService } from './ppid.service';

@Module({
  providers: [PpidService],
  exports: [PpidService],
})
export class PpidModule {}
