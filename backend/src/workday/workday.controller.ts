import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkDayService } from './workday.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('WorkDay')
@Controller('workday')
export class WorkDayController {
  constructor(private readonly service: WorkDayService) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthenticatedUser) {
    const partnerId = user.partnerId || user.technicianId;
    if (!partnerId) return { workDay: null, date: '', isActive: false };
    return this.service.getToday(user.companyId, partnerId);
  }

  @Post('start')
  startDay(@CurrentUser() user: AuthenticatedUser) {
    const partnerId = user.partnerId || user.technicianId;
    if (!partnerId) throw new Error('Nenhum técnico vinculado');
    return this.service.startDay(user.companyId, partnerId);
  }

  @Post('end')
  endDay(
    @Body() body: { notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const partnerId = user.partnerId || user.technicianId;
    if (!partnerId) throw new Error('Nenhum técnico vinculado');
    return this.service.endDay(user.companyId, partnerId, body.notes);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const partnerId = user.partnerId || user.technicianId;
    if (!partnerId) return [];
    return this.service.getHistory(user.companyId, partnerId, from, to);
  }
}
