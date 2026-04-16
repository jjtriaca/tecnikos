import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { InstallmentService } from './installment.service';
import { CollectionService } from './collection.service';
import { PaymentMethodService } from './payment-method.service';
import { PaymentInstrumentService } from './payment-instrument.service';
import { CashAccountService } from './cash-account.service';
import { TransferService } from './transfer.service';
import { ReconciliationService } from './reconciliation.service';
import { FinancialReportService } from './financial-report.service';
import { CardSettlementService } from './card-settlement.service';
import { CardFeeRateService } from './card-fee-rate.service';
import { FinancialAccountService } from './financial-account.service';
import { SettleCardDto, BatchSettleCardDto } from './dto/card-settlement.dto';
import { CreateCardFeeRateDto, UpdateCardFeeRateDto } from './dto/card-fee-rate.dto';
import { CreateFinancialAccountDto, UpdateFinancialAccountDto } from './dto/financial-account.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto, ChangeEntryStatusDto } from './dto/financial-entry.dto';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';
import { RenegotiateDto } from './dto/renegotiate.dto';
import { CreateCollectionRuleDto, UpdateCollectionRuleDto } from './dto/collection-rule.dto';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';
import { CreatePaymentInstrumentDto, UpdatePaymentInstrumentDto } from './dto/payment-instrument.dto';
import { CreateCashAccountDto, UpdateCashAccountDto } from './dto/cash-account.dto';
import { CreateTransferDto } from './dto/transfer.dto';
import { MatchLineDto, MatchAsRefundDto, MatchCardInvoiceDto, MatchAsTransferDto } from './dto/reconciliation.dto';

@ApiTags('Finance')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly service: FinanceService,
    private readonly installmentService: InstallmentService,
    private readonly collectionService: CollectionService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly paymentInstrumentService: PaymentInstrumentService,
    private readonly cashAccountService: CashAccountService,
    private readonly transferService: TransferService,
    private readonly reconciliationService: ReconciliationService,
    private readonly reportService: FinancialReportService,
    private readonly cardSettlementService: CardSettlementService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly cardFeeRateService: CardFeeRateService,
  ) {}

  /* ── Financial Accounts (Plano de Contas) ──────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('accounts')
  findAccounts(@CurrentUser() user: AuthenticatedUser, @Query('type') type?: string) {
    return this.financialAccountService.findAll(user.companyId, type);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.DESPACHO)
  @Get('accounts/postable')
  findPostableAccounts(@CurrentUser() user: AuthenticatedUser, @Query('type') type?: string) {
    return this.financialAccountService.findPostable(user.companyId, type);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('accounts')
  createAccount(@Body() dto: CreateFinancialAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financialAccountService.create(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('accounts/seed')
  seedAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.financialAccountService.seedDefaults(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateFinancialAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financialAccountService.update(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financialAccountService.delete(id, user.companyId);
  }

  /* ── Payment Methods ──────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('payment-methods')
  findPaymentMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentMethodService.findAll(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.DESPACHO)
  @Get('payment-methods/active')
  findActivePaymentMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentMethodService.findActive(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('payment-methods')
  createPaymentMethod(
    @Body() dto: CreatePaymentMethodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodService.create(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('payment-methods/seed')
  seedPaymentMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentMethodService.seedDefaults(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodService.update(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('payment-methods/:id')
  deletePaymentMethod(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodService.remove(id, user.companyId);
  }

  /* ── Payment Instruments (Instrumentos da Empresa) ───── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('payment-instruments')
  findPaymentInstruments(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentInstrumentService.findAll(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('payment-instruments/active')
  findActivePaymentInstruments(
    @Query('direction') direction: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (direction === 'RECEIVABLE' || direction === 'PAYABLE') {
      return this.paymentInstrumentService.findActiveByDirection(user.companyId, direction);
    }
    return this.paymentInstrumentService.findActive(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('payment-instruments/by-method/:paymentMethodId')
  findInstrumentsByMethod(
    @Param('paymentMethodId') paymentMethodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentInstrumentService.findByMethod(user.companyId, paymentMethodId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('payment-instruments')
  createPaymentInstrument(
    @Body() dto: CreatePaymentInstrumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentInstrumentService.create(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('payment-instruments/:id')
  updatePaymentInstrument(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentInstrumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentInstrumentService.update(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('payment-instruments/:id')
  deletePaymentInstrument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentInstrumentService.remove(id, user.companyId);
  }

  /**
   * Migra CardFeeRate → PaymentInstrumentFeeRate (idempotente).
   * Admin roda uma vez para "puxar" as taxas antigas pros novos meios.
   */
  @Roles(UserRole.ADMIN)
  @Post('payment-instruments/migrate-card-fee-rates')
  migrateCardFeeRates(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentInstrumentService.migrateCardFeeRates(user.companyId);
  }

  /**
   * Lookup de taxa por (instrumento + parcelas). Usado pelo modal de conciliacao.
   */
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('payment-instruments/:id/fee-rate-lookup')
  lookupFeeRate(
    @Param('id') id: string,
    @Query('installments') installments: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const n = Math.max(1, parseInt(installments || '1', 10) || 1);
    return this.paymentInstrumentService.lookupFeeRate(id, user.companyId, n);
  }

  /**
   * Atualiza uma faixa de taxa individual (usado no modal de conciliacao quando o usuario
   * clica "Atualizar para X%").
   */
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('payment-instrument-fee-rates/:id')
  updateFeeRate(
    @Param('id') id: string,
    @Body() dto: { feePercent?: number; receivingDays?: number | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentInstrumentService.updateFeeRate(id, user.companyId, dto);
  }

  /* ── Cash Accounts ────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('cash-accounts')
  findCashAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountService.findAll(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('cash-accounts/active')
  findActiveCashAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountService.findActive(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('cash-accounts/:id')
  findOneCashAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashAccountService.findOne(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('cash-accounts')
  createCashAccount(
    @Body() dto: CreateCashAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashAccountService.create(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('cash-accounts/:id')
  updateCashAccount(
    @Param('id') id: string,
    @Body() dto: UpdateCashAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashAccountService.update(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('cash-accounts/:id')
  deleteCashAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashAccountService.remove(id, user.companyId);
  }

  /* ── Transfers ───────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('transfers')
  findTransfers(
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transferService.findAll(user.companyId, { dateFrom, dateTo });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('transfers')
  createTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transferService.create(user.companyId, dto, user.email);
  }

  /* ── Reconciliation ──────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reconciliation/statements')
  findReconciliationStatements(@CurrentUser() user: AuthenticatedUser) {
    return this.reconciliationService.findStatements(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reconciliation/statements/:statementId/lines')
  findStatementLines(
    @Param('statementId') statementId: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.findStatementLines(statementId, user.companyId, status);
  }

  // Compara o saldo oficial do banco (OFX LEDGERBAL) com o saldo do sistema
  // calculado na mesma data — util pra auditoria de fechamento mensal.
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reconciliation/statements/:statementId/balance-compare')
  getStatementBalanceCompare(
    @Param('statementId') statementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.getStatementBalanceCompare(statementId, user.companyId);
  }

  // Define manualmente o saldo oficial do banco (caso o OFX antigo nao tenha LEDGERBAL).
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('reconciliation/statements/:statementId/balance')
  setManualStatementBalance(
    @Param('statementId') statementId: string,
    @Body() body: { balanceCents: number; balanceDate: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.setManualStatementBalance(
      statementId,
      user.companyId,
      body.balanceCents,
      new Date(body.balanceDate),
    );
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reconciliation/imports')
  findReconciliationImports(@CurrentUser() user: AuthenticatedUser) {
    return this.reconciliationService.findImports(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reconciliation/imports/:importId/lines')
  findReconciliationLines(
    @Param('importId') importId: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.findLines(importId, user.companyId, status);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/import')
  importStatement(
    @Body('cashAccountId') cashAccountId: string,
    @Body('fileName') fileName: string,
    @Body('fileContent') fileContent: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.importFile(
      user.companyId,
      cashAccountId,
      fileName,
      fileContent,
      user.email,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/match')
  matchLine(
    @Param('lineId') lineId: string,
    @Body() dto: MatchLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.matchLine(lineId, user.companyId, dto, user.email);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/match-as-refund')
  matchAsRefund(
    @Param('lineId') lineId: string,
    @Body() dto: MatchAsRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.matchAsRefund(lineId, user.companyId, dto, user.email);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reconciliation/card-invoice-candidates')
  cardInvoiceCandidates(
    @Query('paymentInstrumentIds') paymentInstrumentIds: string,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('includeAlreadyMatched') includeAlreadyMatched: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ids = (paymentInstrumentIds || '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.reconciliationService.findCardInvoiceCandidates(user.companyId, {
      paymentInstrumentIds: ids,
      fromDate,
      toDate,
      includeAlreadyMatched: includeAlreadyMatched === 'true',
    });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/match-card-invoice')
  matchAsCardInvoice(
    @Param('lineId') lineId: string,
    @Body() dto: MatchCardInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.matchAsCardInvoice(lineId, user.companyId, dto, user.email);
  }

  // Concilia linha como transferencia entre contas (deposito em dinheiro, saque, etc).
  // Cria uma AccountTransfer e vincula a linha a ela.
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/match-as-transfer')
  matchAsTransfer(
    @Param('lineId') lineId: string,
    @Body() dto: MatchAsTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.matchAsTransfer(lineId, user.companyId, dto, user.email);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/unmatch')
  unmatchLine(
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.unmatchLine(lineId, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/ignore')
  ignoreLine(
    @Param('lineId') lineId: string,
    @Body('notes') notes: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.ignoreLine(lineId, user.companyId, notes);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('reconciliation/lines/:lineId/unignore')
  unignoreLine(
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconciliationService.unignoreLine(lineId, user.companyId);
  }

  /* ── Card Settlements (Baixa de Cartoes) ──────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('card-settlements/summary')
  cardSettlementSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.cardSettlementService.summary(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('card-settlements')
  findCardSettlements(
    @Query() pagination: PaginationDto,
    @Query('status') status: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardSettlementService.findAll(user.companyId, pagination, { status, dateFrom, dateTo });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('card-settlements/:id/settle')
  settleCard(
    @Param('id') id: string,
    @Body() dto: SettleCardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardSettlementService.settle(id, user.companyId, dto, user.email);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('card-settlements/batch-settle')
  batchSettleCards(
    @Body() dto: BatchSettleCardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardSettlementService.settleBatch(user.companyId, dto, user.email);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('card-settlements/:id/cancel')
  cancelCardSettlement(
    @Param('id') id: string,
    @Body('notes') notes: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardSettlementService.cancel(id, user.companyId, notes);
  }

  /* ── Card Fee Rates (Taxas de Cartao) ───────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.DESPACHO)
  @Get('card-fee-rates')
  findCardFeeRates(@CurrentUser() user: AuthenticatedUser) {
    return this.cardFeeRateService.findAll(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('card-fee-rates')
  createCardFeeRate(
    @Body() dto: CreateCardFeeRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardFeeRateService.create(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('card-fee-rates/:id')
  updateCardFeeRate(
    @Param('id') id: string,
    @Body() dto: UpdateCardFeeRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardFeeRateService.update(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Delete('card-fee-rates/:id')
  deleteCardFeeRate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardFeeRateService.remove(id, user.companyId);
  }

  /* ── Statement (Extrato Consolidado) ─────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('statement')
  getStatement(
    @Query('limit') limit: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getStatement(user.companyId, limit ? parseInt(limit, 10) : 50, dateFrom, dateTo);
  }

  /* ── Dashboard Financeiro ────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('dashboard')
  financeDashboard(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.dashboardSummary(user.companyId, dateFrom, dateTo);
  }

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
    @Query('dateType') dateType: string | undefined,
    @Query('partnerId') partnerId: string | undefined,
    @Query('nfseStatus') nfseStatus: string | undefined,
    @Query('excludeMatched') excludeMatched: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findEntries(user.companyId, type || 'RECEIVABLE', pagination, {
      status,
      dateFrom,
      dateTo,
      dateType,
      partnerId,
      nfseStatus,
      excludeMatched: excludeMatched === 'true',
    });
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('entries/batch-pay')
  batchPay(
    @Body() body: {
      entryIds: string[];
      paymentMethod: string;
      paidAt?: string;
      cashAccountId?: string;
      paymentInstrumentId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.batchPay(user.companyId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('entries/:id')
  findOneEntry(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneEntry(id, user.companyId);
  }

  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Post('entries')
  createEntry(
    @Body() dto: CreateFinancialEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createEntry(dto, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('entries/:id')
  updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateEntry(id, user.companyId, dto);
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

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Patch('installments/:id')
  updateInstallment(
    @Param('id') id: string,
    @Body('dueDate') dueDate: string | undefined,
    @Body('amountCents') amountCents: number | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.installmentService.updateInstallment(id, user.companyId, { dueDate, amountCents });
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

  /* ── Financial Report PDF ─────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('report/pdf')
  async generateReportPdf(
    @Query('partnerId') partnerId: string | undefined,
    @Query('type') type: 'RECEIVABLE' | 'PAYABLE' | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportService.generateReport(user.companyId, {
      partnerId,
      type,
      dateFrom,
      dateTo,
      status,
    });

    const date = new Date().toISOString().slice(0, 10);
    const filename = `Relatorio_Financeiro_${date}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  }

  /* ── DRE — Demonstrativo de Resultado ────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Get('reports/dre')
  async getDre(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportService.generateDre(user.companyId, dateFrom, dateTo);
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
