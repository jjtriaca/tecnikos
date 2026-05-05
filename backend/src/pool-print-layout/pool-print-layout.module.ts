import { Module } from '@nestjs/common';
import { PoolPrintLayoutService } from './pool-print-layout.service';
import { PoolPrintLayoutController } from './pool-print-layout.controller';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PoolPrintLayoutController],
  providers: [PoolPrintLayoutService],
  exports: [PoolPrintLayoutService],
})
export class PoolPrintLayoutModule {}
