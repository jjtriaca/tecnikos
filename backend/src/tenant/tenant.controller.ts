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
  NotFoundException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, TenantStatus } from '@prisma/client';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { TenantMiddleware } from './tenant.middleware';
import { Public } from '../auth/decorators/public.decorator';

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

  /** Generate a voucher with random code that skips payment */
  @Post('/promotions/generate-voucher')
  async generateVoucher(
    @Body() body: { name: string; planId?: string; durationMonths?: number },
  ) {
    const code = 'VCH-' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    return this.prisma.promotion.create({
      data: {
        name: body.name || `Voucher ${code}`,
        code,
        discountPercent: 100,
        durationMonths: body.durationMonths || 12,
        applicablePlans: body.planId ? [body.planId] : [],
        maxUses: 1,
        skipPayment: true,
        isActive: true,
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

  // ─── ADD-ONS ─────────────────────────────────────────

  @Get('/addons/list')
  findAllAddOns() {
    return this.prisma.addOn.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Post('/addons')
  createAddOn(@Body() dto: { name: string; description?: string; osQuantity: number; priceCents: number; sortOrder?: number }) {
    return this.prisma.addOn.create({
      data: {
        name: dto.name,
        description: dto.description,
        osQuantity: dto.osQuantity,
        priceCents: dto.priceCents,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Put('/addons/:id')
  updateAddOn(@Param('id') id: string, @Body() dto: Partial<{ name: string; description: string; osQuantity: number; priceCents: number; isActive: boolean; sortOrder: number }>) {
    return this.prisma.addOn.update({ where: { id }, data: dto });
  }

  @Delete('/addons/:id')
  deactivateAddOn(@Param('id') id: string) {
    return this.prisma.addOn.update({ where: { id }, data: { isActive: false } });
  }

  // ─── SIGNUP ATTEMPTS ─────────────────────────────────

  @Get('/signup-attempts/unread-count')
  async getUnreadSignupAttemptCount() {
    const count = await this.prisma.signupAttempt.count({ where: { readAt: null } });
    return { count };
  }

  @Get('/signup-attempts/list')
  async listSignupAttempts(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit || '20', 10), 100);
    const skip = (Math.max(parseInt(page || '1', 10), 1) - 1) * take;
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.signupAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.signupAttempt.count({ where }),
    ]);
    return { items, total, page: Math.max(parseInt(page || '1', 10), 1), limit: take };
  }

  @Get('/signup-attempts/:id')
  async getSignupAttempt(@Param('id') id: string) {
    const attempt = await this.prisma.signupAttempt.findUnique({ where: { id } });
    if (!attempt) throw new NotFoundException('Tentativa não encontrada');
    if (!attempt.readAt) {
      await this.prisma.signupAttempt.update({ where: { id }, data: { readAt: new Date() } });
    }
    return attempt;
  }

  @Patch('/signup-attempts/:id')
  async updateSignupAttempt(
    @Param('id') id: string,
    @Body() body: { status?: string; adminNotes?: string },
  ) {
    return this.prisma.signupAttempt.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.adminNotes !== undefined && { adminNotes: body.adminNotes }),
      },
    });
  }

  // ─── DASHBOARD METRICS ────────────────────────────────

  @Get('/metrics/overview')
  async getMetrics() {
    const [totalTenants, activeTenants, blockedTenants, cancelledTenants, pendingAttempts] =
      await Promise.all([
        this.prisma.tenant.count({ where: { deletedAt: null } }),
        this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
        this.prisma.tenant.count({ where: { status: TenantStatus.BLOCKED } }),
        this.prisma.tenant.count({ where: { status: TenantStatus.CANCELLED } }),
        this.prisma.signupAttempt.count({ where: { readAt: null } }),
      ]);

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { tenants: { where: { status: TenantStatus.ACTIVE, deletedAt: null } } },
        },
      },
    });

    return {
      totalTenants,
      activeTenants,
      blockedTenants,
      cancelledTenants,
      pendingAttempts,
      planDistribution: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        tenantCount: p._count.tenants,
      })),
      mrrCents: plans.reduce((sum, p) => sum + p.priceCents * p._count.tenants, 0),
    };
  }

  // ─── ANALYTICS ──────────────────────────────────────────

  @Get('/analytics/overview')
  async getAnalytics(@Query('days') days?: string) {
    const d = Math.min(parseInt(days || '30', 10), 90);
    const since = new Date();
    since.setDate(since.getDate() - d);

    // Aggregate event counts
    const events = await this.prisma.saasEvent.groupBy({
      by: ['event'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });

    const eventMap: Record<string, number> = {};
    events.forEach((e) => (eventMap[e.event] = e._count.id));

    // Daily pageviews (landing)
    const dailyViews: { date: string; count: number }[] = await this.prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(*)::int as count
      FROM "SaasEvent"
      WHERE event = 'landing_view' AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `;

    // Top rejection reasons
    const recentAttempts = await this.prisma.signupAttempt.findMany({
      where: { createdAt: { gte: since } },
      select: { rejectionReasons: true },
    });
    const reasonCounts: Record<string, number> = {};
    recentAttempts.forEach((a) =>
      a.rejectionReasons.forEach((r) => (reasonCounts[r] = (reasonCounts[r] || 0) + 1)),
    );
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // Device breakdown from user agents
    const allEvents = await this.prisma.saasEvent.findMany({
      where: { createdAt: { gte: since }, event: 'landing_view' },
      select: { userAgent: true },
    });
    const devices: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
    allEvents.forEach((e) => {
      const ua = e.userAgent || '';
      if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone'))
        devices.Mobile++;
      else if (ua.includes('iPad') || ua.includes('Tablet')) devices.Tablet++;
      else devices.Desktop++;
    });

    // Unique sessions
    const uniqueSessions = await this.prisma.saasEvent.groupBy({
      by: ['sessionId'],
      where: { createdAt: { gte: since }, sessionId: { not: null } },
    });

    return {
      period: d,
      landingViews: eventMap['landing_view'] || 0,
      signupStarts: eventMap['signup_step_1'] || 0,
      signupStep2: eventMap['signup_step_2'] || 0,
      signupStep3: eventMap['signup_step_3'] || 0,
      signupStep4: eventMap['signup_step_4'] || 0,
      signupComplete: eventMap['signup_complete'] || 0,
      signupRejected: eventMap['signup_rejected'] || 0,
      clickSignup: eventMap['landing_click_signup'] || 0,
      clickPlan: eventMap['landing_click_plan'] || 0,
      uniqueVisitors: uniqueSessions.length,
      conversionRate:
        eventMap['landing_view'] > 0
          ? Math.round(((eventMap['signup_complete'] || 0) / eventMap['landing_view']) * 10000) / 100
          : 0,
      dailyViews,
      topReasons,
      devices,
    };
  }
}
