import { Module } from '@nestjs/common';
import { ChecklistResponseService } from './checklist-response.service';
import { ChecklistResponseController } from './checklist-response.controller';

@Module({
  controllers: [ChecklistResponseController],
  providers: [ChecklistResponseService],
  exports: [ChecklistResponseService],
})
export class ChecklistResponseModule {}
