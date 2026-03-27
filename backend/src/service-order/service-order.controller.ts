import { Body, Controller, Get, Param, Post, Delete, Put, Patch, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ServiceOrderService } from './service-order.service';
import { ServiceOrderPdfService } from './service-order-pdf.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { UpdateServiceOrderStatusDto } from './dto/update-status.dto';
import { AssignPartnerDto } from './dto/assign-partner.dto';
import { EarlyFinancialDto } from './dto/early-financial.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@ApiTags('Service Orders')
@Controller('service-orders')
export class ServiceOrderController {
  constructor(
    private readonly service: ServiceOrderService,
    private readonly pdfService: ServiceOrderPdfService,
    private readonly notificationService: NotificationService,
  ) {}

  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreateServiceOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create({ ...body, companyId: user.companyId }, user);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('valueMin') valueMin: string | undefined,
    @Query('valueMax') valueMax: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const technicianId = user.isTecnico ? (user.partnerId || user.technicianId) : undefined;
    return this.service.findAll(user.companyId, pagination, { status, dateFrom, dateTo, valueMin, valueMax, technicianId });
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.stats(user.companyId);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthenticatedUser) {
    return this.service.monthlyUsage(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO, UserRole.LEITURA)
  @Get('agenda')
  agenda(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAgenda(user.companyId, dateFrom, dateTo);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('check-conflicts')
  checkConflicts(
    @Query('technicianId') technicianId: string,
    @Query('scheduledStartAt') scheduledStartAt: string,
    @Query('durationMinutes') durationMinutes: string,
    @Query('excludeOrderId') excludeOrderId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.checkConflicts(
      user.companyId,
      technicianId,
      scheduledStartAt,
      parseInt(durationMinutes) || 60,
      excludeOrderId,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('active-dispatches')
  activeDispatches(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getActiveDispatches(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('active-tokens')
  activeTokens(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getActiveTokens(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Get('pdf-preview')
  async getPdfPreview(
    @Query('layout') layout: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const layoutNum = parseInt(layout || '1') || 1;
    const buffer = await this.pdfService.generatePreview(user.companyId, layoutNum);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview_layout_${layoutNum}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Get(':id/pdf')
  async getPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const so = await this.service.findOne(id, user.companyId);
    const buffer = await this.pdfService.generatePdf(id, user.companyId);
    const clientName = (so.clientPartner?.name || 'cliente')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();
    const filename = `${so.code || 'OS'}_${clientName}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  /* ---- Specific paths BEFORE generic :id routes ---- */

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() body: AssignPartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.assign(id, body.partnerId, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, user.companyId, user, body.reason);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.duplicate(id, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/reassign')
  reassign(
    @Param('id') id: string,
    @Body() body: { technicianId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reassign(id, body.technicianId, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/dispatch-notifications')
  dispatchNotifications(
    @Param('id') id: string,
    @Body() body: { technicianIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.dispatchNotifications(id, user.companyId, body.technicianIds, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get(':id/dispatch-status')
  async dispatchStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getDispatchStatus(id, user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/retry-workflow')
  retryWorkflow(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.retryWorkflow(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get(':id/early-financial-preview')
  earlyFinancialPreview(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.earlyFinancialPreview(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/early-financial')
  earlyFinancialLaunch(
    @Param('id') id: string,
    @Body() body: EarlyFinancialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.earlyFinancialLaunch(id, user.companyId, user, body);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get(':id/finalize-preview')
  finalizePreview(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.finalizePreview(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/finalize')
  finalize(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.finalize(id, user.companyId, user);
  }

  @Post(':id/incident')
  reportIncident(
    @Param('id') id: string,
    @Body() body: { category: string; description: string; clientTimestamp?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reportIncident(id, user.companyId, user, body);
  }

  @Post(':id/pause')
  pauseExecution(
    @Param('id') id: string,
    @Body() body: { reasonCategory: string; reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.pauseExecution(id, user.companyId, user, body.reasonCategory, body.reason);
  }

  @Post(':id/resume')
  resumeExecution(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resumeExecution(id, user.companyId, user);
  }

  @Get(':id/pause-status')
  getPauseStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getPauseStatus(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/approve-and-finalize')
  approveAndFinalize(
    @Param('id') id: string,
    @Body() body: { score: number; comment?: string; receivableDueDate?: string; payableDueDate?: string; receivableAccountId?: string; payableAccountId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approveAndFinalize(id, user.companyId, user, body);
  }

  /* ---- Generic :id routes ---- */

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateServiceOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateServiceOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, body.status, user.companyId, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeAttachment(id, attachmentId, user);
  }
}
