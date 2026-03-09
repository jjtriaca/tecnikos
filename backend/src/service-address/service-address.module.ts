import { Module } from '@nestjs/common';
import { ServiceAddressController } from './service-address.controller';
import { ServiceAddressService } from './service-address.service';

@Module({
  controllers: [ServiceAddressController],
  providers: [ServiceAddressService],
  exports: [ServiceAddressService],
})
export class ServiceAddressModule {}
