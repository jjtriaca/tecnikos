import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('finance')
  financeReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.service.financeReport(user.companyId, from, to, technicianId);
  }

  @Get('orders')
  ordersReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.ordersReport(user.companyId, from, to);
  }

  @Get('technicians')
  techniciansReport(@CurrentUser() user: AuthenticatedUser) {
    return this.service.techniciansReport(user.companyId);
  }

  @Get('technician-detail')
  technicianDetailReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('technicianId') technicianId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.technicianDetailReport(user.companyId, technicianId, from, to);
  }
}
