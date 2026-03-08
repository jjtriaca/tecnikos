import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';

@Global()
@Module({
  providers: [PrismaService, CodeGeneratorService],
  exports: [PrismaService, CodeGeneratorService],
})
export class PrismaModule {}
