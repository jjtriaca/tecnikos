import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicOfferService } from './public-offer.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@Controller('public-offers')
export class PublicOfferController {
  constructor(private readonly service: PublicOfferService) {}

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('eligible-technicians/:serviceOrderId')
  getEligibleTechnicians(
    @Param('serviceOrderId') serviceOrderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getEligibleTechnicians(serviceOrderId, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body('serviceOrderId') serviceOrderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createOffer(serviceOrderId, user.companyId);
  }

  @Get(':token')
  get(@Param('token') token: string) {
    return this.service.getOfferByToken(token);
  }
}
