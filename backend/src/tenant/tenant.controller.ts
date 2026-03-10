import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, TenantStatus } from '@prisma/client';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { TenantMiddleware } from './tenant.middleware';

/**
 * Admin-only controller for managing multi-tenant SaaS.
 * Only ADMIN users can access these endpoints.
 * All operations are on the public schema (global tables).
 */
@Controller('admin/tenants')
@Roles(UserRole.ADMIN)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly prisma: PrismaService,
    private readonly tenantMiddleware: TenantMiddleware,
  ) {}

  // ─── TENANTS ──────────────────────────────────────────

  @Get()
  findAll(@Query('status') status?: TenantStatus) {
    return this.tenantService.findAll({ status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.provisionTenant(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    this.tenantMiddleware.clearCache();
    return this.tenantService.activate(id);
  }

  @Patch(':id/block')
  block(@Param('id') id: string, @Body('reason') reason: string) {
    this.tenantMiddleware.clearCache();
    return this.tenantService.block(id, reason);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string, @Body('reason') reason: string) {
    this.tenantMiddleware.clearCache();
    return this.tenantService.suspend(id, reason);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    this.tenantMiddleware.clearCache();
    return this.tenantService.cancel(id);
  }

  @Patch(':id/plan')
  changePlan(@Param('id') id: string, @Body('planId') planId: string) {
    return this.tenantService.changePlan(id, planId);
  }

  @Get(':id/schema')
  getSchemaInfo(@Param('id') id: string) {
    return this.tenantService.findById(id).then(async (tenant) => {
      if (!tenant) return null;
      return this.tenantService.getSchemaInfo(tenant.schemaName);
    });
  }

  // ─── PLANS ────────────────────────────────────────────

  @Get('/plans/list')
  findAllPlans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Post('/plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: dto });
  }

  @Put('/plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) {
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  @Delete('/plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── PROMOTIONS ───────────────────────────────────────

  @Get('/promotions/list')
  findAllPromotions() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Post('/promotions')
  createPromotion(@Body() dto: CreatePromotionDto) {
    return this.prisma.promotion.create({
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  @Put('/promotions/:id')
  updatePromotion(@Param('id') id: string, @Body() dto: Partial<CreatePromotionDto>) {
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  // ─── DASHBOARD METRICS ────────────────────────────────

  @Get('/metrics/overview')
  async getMetrics() {
    const [totalTenants, activeTenants, blockedTenants, cancelledTenants] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.BLOCKED } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.CANCELLED } }),
    ]);

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: { _count: { select: { tenants: true } } },
    });

    return {
      totalTenants,
      activeTenants,
      blockedTenants,
      cancelledTenants,
      planDistribution: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        tenantCount: p._count.tenants,
      })),
      // MRR = sum of active tenants' plan prices
      mrrCents: plans.reduce((sum, p) => sum + p.priceCents * p._count.tenants, 0),
    };
  }
}
