import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantPublicController } from './tenant-public.controller';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantMiddleware } from './tenant.middleware';
import { AsaasProvider } from './asaas.provider';
import { AsaasService } from './asaas.service';
import { AsaasWebhookController } from './asaas-webhook.controller';

@Module({
  providers: [TenantService, TenantConnectionService, TenantMiddleware, AsaasProvider, AsaasService],
  controllers: [TenantController, TenantPublicController, AsaasWebhookController],
  exports: [TenantService, TenantConnectionService, TenantMiddleware, AsaasService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant middleware to all routes
    // It will identify the tenant from subdomain and attach to request
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
