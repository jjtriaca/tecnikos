import { Body, Controller, Get, Param, Post, Delete, Put, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceOrderService } from './service-order.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { UpdateServiceOrderStatusDto } from './dto/update-status.dto';
import { AssignPartnerDto } from './dto/assign-partner.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Service Orders')
@Controller('service-orders')
export class ServiceOrderController {
  constructor(private readonly service: ServiceOrderService) {}

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
    return this.service.findAll(user.companyId, pagination, { status, dateFrom, dateTo, valueMin, valueMax });
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
}
