import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';

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
import { WorkDayModule } from './workday/workday.module';
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
import { NfseEntradaModule } from './nfse-entrada/nfse-entrada.module';
import { ObraModule } from './obra/obra.module';
import { ServiceAddressModule } from './service-address/service-address.module';
import { ServiceModule } from './service/service.module';
import { ChecklistResponseModule } from './checklist-response/checklist-response.module';
import { FiscalPeriodModule } from './fiscal-period/fiscal-period.module';
import { SpedModule } from './sped/sped.module';
import { EmailModule } from './email/email.module';
import { ContractModule } from './contract/contract.module';
import { TenantModule } from './tenant/tenant.module';
import { ChatIAModule } from './chat-ia/chat-ia.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { QuoteModule } from './quote/quote.module';
import { VerificationModule } from './verification/verification.module';
import { BoletoModule } from './boleto/boleto.module';
import { PoolCatalogConfigModule } from './pool-catalog-config/pool-catalog-config.module';

import { RequestLoggerMiddleware } from './common/logger/request-logger.middleware';
import { AuditModule } from './common/audit/audit.module';
import { SaasConfigModule } from './common/saas-config.module';
import { THROTTLE_LIMIT, THROTTLE_TTL_MS } from './common/throttler';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { VerificationGuard } from './auth/guards/verification.guard';

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: THROTTLE_TTL_MS,
        limit: THROTTLE_LIMIT,
      },
    ]),
    PrismaModule,
    SaasConfigModule,
    AuthModule,
    CompanyModule,
    ServiceOrderModule,
    PublicOfferModule,
    FinanceModule,
    UserModule,
    WorkflowModule,
    UploadModule,
    ReportsModule,
    WorkDayModule,
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
    NfseEntradaModule,
    ObraModule,
    ServiceAddressModule,
    ServiceModule,
    ChecklistResponseModule,
    FiscalPeriodModule,
    SpedModule,
    EmailModule,
    ContractModule,
    TenantModule,
    ChatIAModule,
    SuggestionModule,
    QuoteModule,
    VerificationModule,
    BoletoModule,
    PoolCatalogConfigModule,
  ],
  providers: [
    // Sentry global exception filter — captures all unhandled errors
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    // Order matters: Throttle → JWT Auth → Roles → Verification
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
    {
      provide: APP_GUARD,
      useClass: VerificationGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
