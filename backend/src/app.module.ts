import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { ServiceOrderModule } from './service-order/service-order.module';
import { PublicOfferModule } from './public-offer/public-offer.module';
import { FinanceModule } from './finance/finance.module';
import { UserModule } from './user/user.module';
import { WorkflowModule } from './workflow/workflow.module';
import { UploadModule } from './upload/upload.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { SpecializationModule } from './specialization/specialization.module';
import { PartnerModule } from './partner/partner.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { AutomationModule } from './automation/automation.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ProductModule } from './product/product.module';
import { NfeModule } from './nfe/nfe.module';
import { NfseEmissionModule } from './nfse-emission/nfse-emission.module';

import { RequestLoggerMiddleware } from './common/logger/request-logger.middleware';
import { AuditModule } from './common/audit/audit.module';
import { THROTTLE_LIMIT, THROTTLE_TTL_MS } from './common/throttler';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: THROTTLE_TTL_MS,
        limit: THROTTLE_LIMIT,
      },
    ]),
    PrismaModule,
    AuthModule,
    CompanyModule,
    ServiceOrderModule,
    PublicOfferModule,
    FinanceModule,
    UserModule,
    WorkflowModule,
    UploadModule,
    ReportsModule,
    NotificationModule,
    HealthModule,
    AuditModule,
    SpecializationModule,
    PartnerModule,
    EvaluationModule,
    AutomationModule,
    WhatsAppModule,
    ProductModule,
    NfeModule,
    NfseEmissionModule,
  ],
  providers: [
    // Order matters: Throttle → JWT Auth → Roles
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
