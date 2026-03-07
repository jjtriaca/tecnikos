import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FiscalPeriodService } from './fiscal-period.service';
import { FiscalPeriodController } from './fiscal-period.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FiscalPeriodController],
  providers: [FiscalPeriodService],
  exports: [FiscalPeriodService],
})
export class FiscalPeriodModule {}
