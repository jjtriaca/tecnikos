import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ContractService } from './contract.service';

@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('partner/:partnerId')
  async findByPartner(
    @Param('partnerId') partnerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contractService.findByPartner(partnerId, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('send')
  async sendContract(
    @Body() body: {
      partnerId: string;
      contractName: string;
      contractContent: string;
      blockUntilAccepted?: boolean;
      expirationDays?: number;
      channel?: 'WHATSAPP' | 'EMAIL';
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contractService.sendContract({
      companyId: user.companyId,
      partnerId: body.partnerId,
      contractName: body.contractName,
      contractContent: body.contractContent,
      blockUntilAccepted: body.blockUntilAccepted,
      expirationDays: body.expirationDays,
      channel: body.channel,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/cancel')
  async cancelContract(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contractService.cancelContract(id, user.companyId, body.reason);
  }
}
