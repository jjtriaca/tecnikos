import { Module } from '@nestjs/common';
import { PoolProjectService } from './pool-project.service';
import { PoolProjectController } from './pool-project.controller';
import { AuditModule } from '../common/audit/audit.module';
import { CodeGeneratorService } from '../common/code-generator.service';

@Module({
  imports: [AuditModule],
  controllers: [PoolProjectController],
  providers: [PoolProjectService, CodeGeneratorService],
  exports: [PoolProjectService],
})
export class PoolProjectModule {}
