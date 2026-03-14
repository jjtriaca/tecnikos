import { Module } from '@nestjs/common';
import { PublicOfferService } from './public-offer.service';
import { PublicOfferController } from './public-offer.controller';
import { PublicLinkController } from './public-link.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [PublicOfferController, PublicLinkController],
  providers: [PublicOfferService],
  exports: [PublicOfferService],
})
export class PublicOfferModule {}
