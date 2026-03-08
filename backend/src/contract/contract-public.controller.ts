import { Controller, Get, Post, Param, Req, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { ContractService } from './contract.service';

@Controller('contract')
export class ContractPublicController {
  constructor(private readonly contractService: ContractService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Get(':token')
  async getContract(@Param('token') token: string) {
    const contract = await this.contractService.getByToken(token);

    // Mark as viewed on first access
    if (contract.status === 'PENDING') {
      await this.contractService.markViewed(token);
    }

    return contract;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post(':token/accept')
  async acceptContract(
    @Param('token') token: string,
    @Req() req: any,
    @Headers('user-agent') userAgent: string,
  ) {
    const ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';

    return this.contractService.acceptContract(token, ip, userAgent);
  }
}
