import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PoolPaymentTermController } from './pool-payment-term.controller';
import { PoolPaymentTermService } from './pool-payment-term.service';

@Module({
  imports: [PrismaModule],
  controllers: [PoolPaymentTermController],
  providers: [PoolPaymentTermService],
  exports: [PoolPaymentTermService],
})
export class PoolPaymentTermModule {}
