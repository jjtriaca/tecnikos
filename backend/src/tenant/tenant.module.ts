import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantPublicController } from './tenant-public.controller';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantMiddleware } from './tenant.middleware';

@Module({
  providers: [TenantService, TenantConnectionService, TenantMiddleware],
  controllers: [TenantController, TenantPublicController],
  exports: [TenantService, TenantConnectionService, TenantMiddleware],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant middleware to all routes
    // It will identify the tenant from subdomain and attach to request
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
