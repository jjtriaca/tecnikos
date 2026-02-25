import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { CreateFinancialEntryDto, ChangeEntryStatusDto } from './dto/financial-entry.dto';

@ApiTags('Finance')
@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  /* ── Legacy Endpoints (backward compat) ────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('ledgers')
  ledgers(
    @Query() pagination: PaginationDto,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findLedgers(user.companyId, pagination, { dateFrom, dateTo });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('simulate/:serviceOrderId')
  simulate(
    @Param('serviceOrderId') serviceOrderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.simulate(serviceOrderId, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('confirm/:serviceOrderId')
  confirm(
    @Param('serviceOrderId') serviceOrderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.confirm(serviceOrderId, user.companyId);
  }

  /* ── v1.00.17 — FinancialEntry Endpoints ───────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('summary-v2')
  summaryV2(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summaryV2(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('entries')
  findEntries(
    @Query('type') type: 'RECEIVABLE' | 'PAYABLE',
    @Query() pagination: PaginationDto,
    @Query('status') status: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('partnerId') partnerId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findEntries(user.companyId, type || 'RECEIVABLE', pagination, {
      status,
      dateFrom,
      dateTo,
      partnerId,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('entries/:id')
  findOneEntry(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneEntry(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('entries')
  createEntry(
    @Body() dto: CreateFinancialEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createEntry(dto, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('entries/:id/status')
  changeEntryStatus(
    @Param('id') id: string,
    @Body() dto: ChangeEntryStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeEntryStatus(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('entries/:id')
  deleteEntry(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteEntry(id, user.companyId);
  }
}
