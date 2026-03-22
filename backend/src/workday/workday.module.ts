import { Module } from '@nestjs/common';
import { WorkDayController } from './workday.controller';
import { WorkDayService } from './workday.service';

@Module({
  controllers: [WorkDayController],
  providers: [WorkDayService],
  exports: [WorkDayService],
})
export class WorkDayModule {}
