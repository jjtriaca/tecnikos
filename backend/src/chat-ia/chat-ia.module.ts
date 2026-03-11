import { Module } from '@nestjs/common';
import { ChatIAController } from './chat-ia.controller';
import { ChatIAService } from './chat-ia.service';
import { ChatIAOnboardingService } from './chat-ia.onboarding';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ChatIAController],
  providers: [ChatIAService, ChatIAOnboardingService],
  exports: [ChatIAService, ChatIAOnboardingService],
})
export class ChatIAModule {}
