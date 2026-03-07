import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SpedIcmsIpiGenerator } from './sped-icms-ipi.generator';
import { SpedContribuicoesGenerator } from './sped-contribuicoes.generator';
import { SpedController } from './sped.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SpedController],
  providers: [SpedIcmsIpiGenerator, SpedContribuicoesGenerator],
  exports: [SpedIcmsIpiGenerator, SpedContribuicoesGenerator],
})
export class SpedModule {}
