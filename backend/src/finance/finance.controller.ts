import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { InstallmentService } from './installment.service';
import { CollectionService } from './collection.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { CreateFinancialEntryDto, ChangeEntryStatusDto } from './dto/financial-entry.dto';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';
import { RenegotiateDto } from './dto/renegotiate.dto';
import { CreateCollectionRuleDto, UpdateCollectionRuleDto } from './dto/collection-rule.dto';

@ApiTags('Finance')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly service: FinanceService,
    private readonly installmentService: InstallmentService,
    private readonly collectionService: CollectionService,
  ) {}

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

  /* ── v2.00 — Installment Endpoints ─────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('entries/:id/installments')
  generateInstallments(
    @Param('id') id: string,
    @Body() dto: GenerateInstallmentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.installmentService.generateInstallments(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('entries/:id/installments')
  getInstallments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.installmentService.getInstallments(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('installments/:id/pay')
  payInstallment(
    @Param('id') id: string,
    @Body('paidAmountCents') paidAmountCents: number | undefined,
    @Body('notes') notes: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.installmentService.payInstallment(id, user.companyId, paidAmountCents, notes);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('installments/:id/cancel')
  cancelInstallment(
    @Param('id') id: string,
    @Body('notes') notes: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.installmentService.cancelInstallment(id, user.companyId, notes);
  }

  /* ── v2.00 — Renegotiation ─────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('entries/:id/renegotiate')
  renegotiate(
    @Param('id') id: string,
    @Body() dto: RenegotiateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.renegotiate(id, user.companyId, dto);
  }

  /* ── v2.00 — Overdue / Aging Report ────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('overdue')
  overdueAgingReport(@CurrentUser() user: AuthenticatedUser) {
    return this.installmentService.getOverdueAgingReport(user.companyId);
  }

  /* ── v2.00 — Collection Rules ──────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('collection-rules')
  findCollectionRules(@CurrentUser() user: AuthenticatedUser) {
    return this.collectionService.findRules(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('collection-rules')
  createCollectionRule(
    @Body() dto: CreateCollectionRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.createRule(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('collection-rules/:id')
  updateCollectionRule(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.updateRule(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('collection-rules/:id')
  deleteCollectionRule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.deleteRule(id, user.companyId);
  }

  /* ── v2.00 — Collection Executions ─────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('collection-executions')
  findCollectionExecutions(
    @Query() pagination: PaginationDto,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.findExecutions(user.companyId, pagination, { dateFrom, dateTo });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('collection-rules/run')
  runCollectionManual(@CurrentUser() user: AuthenticatedUser) {
    return this.collectionService.runManual(user.companyId);
  }
}
