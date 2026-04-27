import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { TenantBrandingController } from './tenant-branding.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsAppModule],
  controllers: [CompanyController, TenantBrandingController],
  providers: [CompanyService],
})
export class CompanyModule {}
