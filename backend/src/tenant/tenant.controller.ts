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
import { TenantOnboardingService } from './tenant-onboarding.service';
import { AsaasService } from './asaas.service';
import { AsaasProvider } from './asaas.provider';
import { EmailService } from '../email/email.service';
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
    private readonly onboarding: TenantOnboardingService,
    private readonly asaasService: AsaasService,
    private readonly asaasProvider: AsaasProvider,
    private readonly emailService: EmailService,
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

  @Patch(':id/fix-subscription')
  async fixSubscription(@Param('id') id: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) return { success: false, message: 'No subscription found' };

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        overdueAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
      },
    });

    return { success: true, message: `Subscription ${subscription.id} set to ACTIVE` };
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
  async findAllPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tenants: true } } },
    });
    return plans.map((p) => ({
      ...p,
      tenantCount: p._count?.tenants ?? 0,
      _count: undefined,
    }));
  }

  @Post('/plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: dto });
  }

  @Put('/plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) {
    const oldPlan = await this.prisma.plan.findUnique({ where: { id } });
    if (!oldPlan) throw new NotFoundException('Plano não encontrado');

    const updated = await this.prisma.plan.update({ where: { id }, data: dto });

    // Price changed? Propagate to ALL active Asaas subscriptions on this plan
    const priceChanged =
      (dto.priceCents !== undefined && dto.priceCents !== oldPlan.priceCents) ||
      (dto.priceYearlyCents !== undefined && dto.priceYearlyCents !== oldPlan.priceYearlyCents);

    if (priceChanged) {
      const subs = await this.prisma.subscription.findMany({
        where: { planId: id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      });
      for (const sub of subs) {
        if (!sub.asaasSubscriptionId) continue;
        const isYearly = sub.billingCycle === 'ANNUAL';
        const newValue = isYearly && updated.priceYearlyCents
          ? updated.priceYearlyCents / 100
          : updated.priceCents / 100;
        try {
          await this.asaasProvider.updateSubscription(sub.asaasSubscriptionId, {
            value: newValue,
            updatePendingPayments: false, // Only future invoices
          });
        } catch (err) {
          // Log but don't fail the update
          console.warn(`Failed to update Asaas subscription ${sub.asaasSubscriptionId}: ${(err as Error).message}`);
        }
      }
    }

    // GRANDFATHER: Feature changes (maxUsers, maxOsPerMonth, maxTechnicians, maxAiMessages,
    // supportLevel, allModulesIncluded) do NOT propagate to existing tenants.
    // Only new subscribers get the updated features.

    return updated;
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
  createAddOn(@Body() dto: {
    name: string; description?: string; priceCents: number; sortOrder?: number;
    osQuantity?: number; userQuantity?: number; technicianQuantity?: number; aiMessageQuantity?: number;
    nfseImportQuantity?: number;
  }) {
    return this.prisma.addOn.create({
      data: {
        name: dto.name,
        description: dto.description,
        osQuantity: dto.osQuantity ?? 0,
        userQuantity: dto.userQuantity ?? 0,
        technicianQuantity: dto.technicianQuantity ?? 0,
        aiMessageQuantity: dto.aiMessageQuantity ?? 0,
        nfseImportQuantity: dto.nfseImportQuantity ?? 0,
        priceCents: dto.priceCents,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Put('/addons/:id')
  updateAddOn(@Param('id') id: string, @Body() dto: Partial<{
    name: string; description: string; priceCents: number; isActive: boolean; sortOrder: number;
    osQuantity: number; userQuantity: number; technicianQuantity: number; aiMessageQuantity: number;
    nfseImportQuantity: number;
  }>) {
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

  // ─── VERIFICATION REVIEW ─────────────────────────────

  /** List tenants with pending document verification */
  @Get('/pending-verifications')
  async getPendingVerifications() {
    const sessions = await this.prisma.verificationSession.findMany({
      where: { reviewStatus: 'PENDING' },
      include: {
        tenant: {
          select: {
            id: true, slug: true, name: true, cnpj: true, status: true,
            responsibleName: true, responsibleEmail: true, responsiblePhone: true,
            createdAt: true, planId: true,
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => ({
      sessionId: s.id,
      tenantId: s.tenant.id,
      tenantName: s.tenant.name,
      tenantSlug: s.tenant.slug,
      cnpj: s.tenant.cnpj,
      responsibleName: s.tenant.responsibleName,
      responsibleEmail: s.tenant.responsibleEmail,
      responsiblePhone: s.tenant.responsiblePhone,
      planName: s.tenant.plan?.name,
      uploadedCount: s.uploadedCount,
      uploadComplete: s.uploadComplete,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  /** Get verification documents for a tenant */
  @Get(':id/verification')
  async getVerification(@Param('id') id: string) {
    const session = await this.prisma.verificationSession.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true, slug: true, name: true, cnpj: true,
            responsibleName: true, responsibleEmail: true, responsiblePhone: true,
            plan: { select: { name: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Verificação não encontrada para este tenant');

    return {
      sessionId: session.id,
      tenant: session.tenant,
      cnpjCardUrl: session.cnpjCardUrl,
      docFrontUrl: session.docFrontUrl,
      docBackUrl: session.docBackUrl,
      selfieCloseUrl: session.selfieCloseUrl,
      selfieMediumUrl: session.selfieMediumUrl,
      uploadedCount: session.uploadedCount,
      uploadComplete: session.uploadComplete,
      reviewStatus: session.reviewStatus,
      reviewedAt: session.reviewedAt,
      reviewedBy: session.reviewedBy,
      rejectionReason: session.rejectionReason,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  /** Approve verification — activates tenant */
  @Post(':id/approve-verification')
  async approveVerification(
    @Param('id') id: string,
    @Body('reviewedBy') reviewedBy?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const session = await this.prisma.verificationSession.findFirst({
      where: { tenantId: id, reviewStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw new NotFoundException('Nenhuma verificação pendente');

    // Update session
    await this.prisma.verificationSession.update({
      where: { id: session.id },
      data: {
        reviewStatus: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: reviewedBy || 'Admin',
      },
    });

    // Activate tenant (onboarding already ran at signup)
    await this.tenantService.activate(id);
    this.tenantMiddleware.clearCache();

    return { success: true, message: 'Tenant aprovado e ativado com sucesso!' };
  }

  /** Reject verification */
  @Post(':id/reject-verification')
  async rejectVerification(
    @Param('id') id: string,
    @Body() body: { reason?: string; reviewedBy?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const session = await this.prisma.verificationSession.findFirst({
      where: { tenantId: id, reviewStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw new NotFoundException('Nenhuma verificação pendente');

    // Update session
    await this.prisma.verificationSession.update({
      where: { id: session.id },
      data: {
        reviewStatus: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: body.reviewedBy || 'Admin',
        rejectionReason: body.reason || 'Documentos não aprovados',
      },
    });

    // Send rejection email
    if (tenant.responsibleEmail) {
      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Tecnikos</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Verificação não aprovada</h2>
            <p style="color: #475569; line-height: 1.6;">
              Olá, <strong>${tenant.responsibleName || 'Responsável'}</strong>.
              Sua verificação de documentos para a empresa <strong>${tenant.name}</strong> não foi aprovada.
            </p>
            ${body.reason ? `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>Motivo:</strong> ${body.reason}</p>
            </div>` : ''}
            <p style="color: #475569; line-height: 1.6;">
              Você pode tentar novamente realizando um novo cadastro com documentos válidos.
              Em caso de dúvidas, entre em contato com nosso suporte.
            </p>
          </div>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">Tecnikos © ${new Date().getFullYear()}</p>
          </div>
        </div>
      `;
      this.emailService.sendSystemEmail(
        tenant.responsibleEmail,
        `Verificação não aprovada — ${tenant.name}`,
        html,
      ).catch(() => {});
    }

    return { success: true, message: 'Verificação rejeitada.' };
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

    // Calculate real MRR from active subscriptions (respecting promotions)
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    // Batch-fetch all promotions to avoid N+1 queries
    const promoIds = [...new Set(activeSubscriptions.map(s => s.promotionId).filter(Boolean))] as string[];
    const promos = promoIds.length > 0
      ? await this.prisma.promotion.findMany({ where: { id: { in: promoIds } } })
      : [];
    const promoMap = new Map(promos.map(p => [p.id, p]));

    let mrrCents = 0;
    for (const sub of activeSubscriptions) {
      const planPrice = sub.originalValueCents || sub.plan?.priceCents || 0;
      let effectivePrice = planPrice;
      // Detect promo: monthsLeft > 0 (monthly) OR upfront paid (monthsLeft=0 but promotionId + originalValueCents set)
      const hasPromo = ((sub.promotionMonthsLeft || 0) > 0) ||
        (!!sub.promotionId && !!sub.originalValueCents);
      if (hasPromo && sub.promotionId) {
        const promo = promoMap.get(sub.promotionId);
        if (promo) {
          if (promo.discountCents) {
            effectivePrice = Math.max(0, planPrice - promo.discountCents);
          } else if (promo.discountPercent) {
            effectivePrice = Math.round(planPrice * (1 - promo.discountPercent / 100));
          }
        }
      }
      // For annual billing, convert to monthly equivalent
      if (sub.billingCycle === 'ANNUAL') {
        mrrCents += Math.round(effectivePrice / 12);
      } else {
        mrrCents += effectivePrice;
      }
    }

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
      mrrCents,
    };
  }

  // ─── ANALYTICS ──────────────────────────────────────────

  @Get('/analytics/overview')
  async getAnalytics(@Query('days') days?: string) {
    const d = Math.min(parseInt(days || '30', 10), 90);
    const since = new Date();
    since.setDate(since.getDate() - d);

    // Known internal indicators (server IP, common bot patterns, Hetzner, known IPs)
    const INTERNAL_IPS = [
      '178.156.240.163',  // Hetzner server
      '127.0.0.1',
      '::1',
    ];
    const INTERNAL_UA_PATTERNS = [
      'HeadlessChrome',
      'Puppeteer',
      'ClaudeBot',
      'node-fetch',
      'python-requests',
      'curl/',
      'Googlebot',
      'bingbot',
      'Bytespider',
      'AhrefsBot',
      'SemrushBot',
      'MJ12bot',
      'DotBot',
      'PetalBot',
      'YandexBot',
      'facebookexternalhit',
      'Twitterbot',
      'LinkedInBot',
    ];

    function isInternal(ip?: string | null, ua?: string | null): boolean {
      if (ip && INTERNAL_IPS.some((iip) => ip.includes(iip))) return true;
      if (ua && INTERNAL_UA_PATTERNS.some((p) => ua.includes(p))) return true;
      return false;
    }

    // Load ALL landing_view events with IP + UA for internal/external analysis
    const allLandingEvents = await this.prisma.saasEvent.findMany({
      where: { createdAt: { gte: since }, event: 'landing_view' },
      select: { ipAddress: true, userAgent: true, sessionId: true, createdAt: true },
    });

    // Classify sessions as internal/external
    const sessionClassification = new Map<string, 'internal' | 'external'>();
    allLandingEvents.forEach((e) => {
      const sid = e.sessionId || 'unknown';
      if (!sessionClassification.has(sid)) {
        sessionClassification.set(sid, isInternal(e.ipAddress, e.userAgent) ? 'internal' : 'external');
      }
    });

    // Count internal vs external pageviews
    let internalPageviews = 0;
    let externalPageviews = 0;
    allLandingEvents.forEach((e) => {
      if (isInternal(e.ipAddress, e.userAgent)) internalPageviews++;
      else externalPageviews++;
    });

    // Unique sessions
    const allSessions = await this.prisma.saasEvent.groupBy({
      by: ['sessionId'],
      where: { createdAt: { gte: since }, sessionId: { not: null } },
    });
    // For unique visitors, we need IP + UA per session
    const sessionDetails = await this.prisma.saasEvent.findMany({
      where: { createdAt: { gte: since }, sessionId: { not: null } },
      select: { sessionId: true, ipAddress: true, userAgent: true },
      distinct: ['sessionId'],
    });
    let internalSessions = 0;
    let externalSessions = 0;
    sessionDetails.forEach((s) => {
      if (isInternal(s.ipAddress, s.userAgent)) internalSessions++;
      else externalSessions++;
    });

    // Aggregate event counts — UNIQUE per sessionId (not raw event count)
    // This prevents the same person refreshing/revisiting from inflating numbers
    const uniqueEventCounts = await this.prisma.saasEvent.groupBy({
      by: ['event', 'sessionId'],
      where: { createdAt: { gte: since }, sessionId: { not: null } },
    });
    // Count unique sessions per event type
    const eventSessionMap: Record<string, Set<string>> = {};
    uniqueEventCounts.forEach((e) => {
      if (!eventSessionMap[e.event]) eventSessionMap[e.event] = new Set();
      eventSessionMap[e.event].add(e.sessionId!);
    });
    const eventMap: Record<string, number> = {};
    Object.entries(eventSessionMap).forEach(([event, sessions]) => {
      eventMap[event] = sessions.size;
    });

    // Real business metrics: use actual DB records, not events
    // Signups Iniciados = unique SignupAttempt records (not repeated page visits)
    const realSignupAttempts = await this.prisma.signupAttempt.count({
      where: { createdAt: { gte: since } },
    });

    // Conversões = Tenants that reached ACTIVE status (full process: signup + docs + verification)
    const realConversions = await this.prisma.tenant.count({
      where: { status: 'ACTIVE', createdAt: { gte: since } },
    });

    // Daily pageviews (landing) — split by internal/external
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

    // Device breakdown from user agents (external only)
    const devices: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
    allLandingEvents.forEach((e) => {
      if (isInternal(e.ipAddress, e.userAgent)) return; // skip internal
      const ua = e.userAgent || '';
      if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone'))
        devices.Mobile++;
      else if (ua.includes('iPad') || ua.includes('Tablet')) devices.Tablet++;
      else devices.Desktop++;
    });

    // Unique IPs for geographic insight
    const uniqueIps = new Set<string>();
    const ipBreakdown: { ip: string; count: number; isInternal: boolean; lastUa: string }[] = [];
    const ipCounts: Record<string, { count: number; ua: string }> = {};
    allLandingEvents.forEach((e) => {
      const ip = e.ipAddress || 'unknown';
      uniqueIps.add(ip);
      if (!ipCounts[ip]) ipCounts[ip] = { count: 0, ua: e.userAgent || '' };
      ipCounts[ip].count++;
      ipCounts[ip].ua = e.userAgent || ipCounts[ip].ua;
    });
    Object.entries(ipCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .forEach(([ip, { count, ua }]) => {
        ipBreakdown.push({
          ip,
          count,
          isInternal: isInternal(ip, ua),
          lastUa: ua.length > 80 ? ua.substring(0, 80) + '...' : ua,
        });
      });

    // External-only conversion rate (based on real conversions, not events)
    const externalConversion = externalSessions > 0
      ? Math.round((realConversions / externalSessions) * 10000) / 100
      : 0;

    return {
      period: d,
      landingViews: eventMap['landing_view'] || 0,
      signupStarts: realSignupAttempts,  // Real unique signup attempts, not repeated page visits
      signupStep2: eventMap['signup_step_2'] || 0,
      signupStep3: eventMap['signup_step_3'] || 0,
      signupStep4: eventMap['signup_step_4'] || 0,
      signupComplete: realConversions,   // Real conversions: Tenants ACTIVE (full process complete)
      signupRejected: eventMap['signup_rejected'] || 0,
      clickSignup: eventMap['landing_click_signup'] || 0,
      clickPlan: eventMap['landing_click_plan'] || 0,
      uniqueVisitors: allSessions.length,
      conversionRate:
        externalSessions > 0
          ? Math.round((realConversions / externalSessions) * 10000) / 100
          : 0,
      dailyViews,
      topReasons,
      devices,
      // Internal vs external breakdown
      internalPageviews,
      externalPageviews,
      internalSessions,
      externalSessions,
      externalConversion,
      uniqueIps: uniqueIps.size,
      ipBreakdown,
    };
  }

  // ─── ACCESS 24H (Security & Geo) ──────────────────────

  @Get('/analytics/access-24h')
  async getAccess24h() {
    const since = new Date();
    since.setHours(since.getHours() - 24);

    // All events in last 24h (not just landing_view — any activity)
    const events = await this.prisma.saasEvent.findMany({
      where: { createdAt: { gte: since } },
      select: {
        ipAddress: true,
        userAgent: true,
        event: true,
        createdAt: true,
        sessionId: true,
      },
    });

    // Known internal IPs
    const INTERNAL_IPS = ['178.156.240.163', '127.0.0.1', '::1'];
    const INTERNAL_UA_PATTERNS = [
      'HeadlessChrome', 'Puppeteer', 'ClaudeBot', 'node-fetch',
      'python-requests', 'curl/', 'Googlebot', 'bingbot',
      'Bytespider', 'AhrefsBot', 'SemrushBot', 'MJ12bot',
      'DotBot', 'PetalBot', 'YandexBot', 'facebookexternalhit',
      'Twitterbot', 'LinkedInBot',
    ];

    function isInternal(ip?: string | null, ua?: string | null): boolean {
      if (ip && INTERNAL_IPS.some((iip) => ip.includes(iip))) return true;
      if (ua && INTERNAL_UA_PATTERNS.some((p) => ua.includes(p))) return true;
      return false;
    }

    // Group by IP
    const ipMap: Record<string, { count: number; ua: string; events: string[]; firstSeen: Date; lastSeen: Date; isInternal: boolean }> = {};
    events.forEach((e) => {
      const ip = e.ipAddress || 'unknown';
      if (!ipMap[ip]) {
        ipMap[ip] = {
          count: 0,
          ua: e.userAgent || '',
          events: [],
          firstSeen: e.createdAt,
          lastSeen: e.createdAt,
          isInternal: isInternal(e.ipAddress, e.userAgent),
        };
      }
      ipMap[ip].count++;
      if (!ipMap[ip].events.includes(e.event)) ipMap[ip].events.push(e.event);
      if (e.createdAt < ipMap[ip].firstSeen) ipMap[ip].firstSeen = e.createdAt;
      if (e.createdAt > ipMap[ip].lastSeen) ipMap[ip].lastSeen = e.createdAt;
    });

    // Filter to external IPs only for geo lookup
    const externalIps = Object.entries(ipMap)
      .filter(([_, v]) => !v.isInternal)
      .map(([ip]) => ip)
      .filter((ip) => ip !== 'unknown' && !ip.startsWith('172.') && !ip.startsWith('10.') && !ip.startsWith('192.168.'));

    // Batch geo-IP lookup via ip-api.com (free, 100 IPs per batch, 45 req/min)
    type GeoResult = { query: string; status: string; country: string; countryCode: string; region: string; regionName: string; city: string; isp: string };
    const geoMap: Record<string, GeoResult> = {};

    if (externalIps.length > 0) {
      // ip-api.com batch: POST http://ip-api.com/batch with array of IPs (max 100)
      const batches: string[][] = [];
      for (let i = 0; i < externalIps.length; i += 100) {
        batches.push(externalIps.slice(i, i + 100));
      }

      for (const batch of batches) {
        try {
          const resp = await fetch('http://ip-api.com/batch?fields=query,status,country,countryCode,region,regionName,city,isp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
          });
          if (resp.ok) {
            const results: GeoResult[] = await resp.json();
            results.forEach((r) => { geoMap[r.query] = r; });
          }
        } catch {
          // Silent fail — geo data is best-effort
        }
      }
    }

    // Build results
    const foreignAccess: {
      ip: string;
      country: string;
      countryCode: string;
      city: string;
      region: string;
      isp: string;
      accessCount: number;
      events: string[];
      lastSeen: string;
    }[] = [];

    const brazilAccess: typeof foreignAccess = [];

    externalIps.forEach((ip) => {
      const geo = geoMap[ip];
      const info = ipMap[ip];
      if (!info) return;

      const entry = {
        ip,
        country: geo?.country || 'Desconhecido',
        countryCode: geo?.countryCode || '??',
        city: geo?.city || '',
        region: geo?.regionName || '',
        isp: geo?.isp || '',
        accessCount: info.count,
        events: info.events,
        lastSeen: info.lastSeen.toISOString(),
      };

      if (geo?.countryCode === 'BR') {
        brazilAccess.push(entry);
      } else {
        foreignAccess.push(entry);
      }
    });

    // Sort foreign by count desc
    foreignAccess.sort((a, b) => b.accessCount - a.accessCount);
    brazilAccess.sort((a, b) => b.accessCount - a.accessCount);

    // Unique sessions
    const uniqueSessions = new Set(events.filter((e) => e.sessionId).map((e) => e.sessionId));

    // Total counts
    const totalEvents = events.length;
    const externalEvents = events.filter((e) => !isInternal(e.ipAddress, e.userAgent)).length;
    const internalEvents = totalEvents - externalEvents;

    // ── 24h Analytics KPIs ──
    const [signupStarts24h, signupComplete24h] = await Promise.all([
      this.prisma.signupAttempt.count({ where: { createdAt: { gte: since } } }),
      this.prisma.tenant.count({ where: { status: 'ACTIVE', createdAt: { gte: since } } }),
    ]);

    // External sessions (unique session IDs from non-internal events)
    const externalSessionIds = new Set<string>();
    events.forEach((e) => {
      if (e.sessionId && !isInternal(e.ipAddress, e.userAgent)) {
        externalSessionIds.add(e.sessionId);
      }
    });
    const externalSessions24h = externalSessionIds.size;

    // External pageviews (landing_view only, external)
    const externalPageviews24h = events.filter(
      (e) => e.event === 'landing_view' && !isInternal(e.ipAddress, e.userAgent),
    ).length;

    const conversionRate24h = externalSessions24h > 0
      ? Math.round((signupComplete24h / externalSessions24h) * 10000) / 100
      : 0;

    return {
      period: '24h',
      totalEvents,
      externalEvents,
      internalEvents,
      uniqueIps: Object.keys(ipMap).length,
      externalUniqueIps: externalIps.length,
      uniqueSessions: uniqueSessions.size,
      foreignAccess,
      foreignCount: foreignAccess.length,
      brazilAccess: brazilAccess.slice(0, 10), // Top 10 Brazil IPs
      brazilCount: brazilAccess.length,
      hasForeignAccess: foreignAccess.length > 0,
      // 24h analytics KPIs
      externalSessions24h,
      externalPageviews24h,
      signupStarts24h,
      signupComplete24h,
      conversionRate24h,
    };
  }

  // ─── INVOICES (NFS-e) ──────────────────────────────────

  /** Issue an invoice for a tenant */
  @Post(':id/issue-invoice')
  async issueInvoice(
    @Param('id') id: string,
    @Body() body: {
      value?: number;
      serviceDescription?: string;
      observations?: string;
      effectiveDate?: string;
      taxes?: {
        iss?: number;
        cofins?: number;
        csll?: number;
        inss?: number;
        ir?: number;
        pis?: number;
        retainIss?: boolean;
      };
    },
  ) {
    return this.asaasService.issueInvoice({
      tenantId: id,
      ...body,
    });
  }

  /** List all invoices */
  @Get('/invoices/list')
  async listInvoices(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.asaasService.listInvoices({
      tenantId,
      status,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    });
  }

  /** Cancel an invoice */
  @Delete('/invoices/:invoiceId')
  async cancelInvoice(@Param('invoiceId') invoiceId: string) {
    return this.asaasService.cancelInvoice(invoiceId);
  }

  /** Get invoice config */
  @Get('/invoices/config')
  async getInvoiceConfig() {
    return this.asaasService.getInvoiceConfig();
  }

  /** Update invoice config */
  @Put('/invoices/config')
  async updateInvoiceConfig(
    @Body() body: {
      autoEmitOnPayment?: boolean;
      municipalServiceId?: string;
      municipalServiceCode?: string;
      municipalServiceName?: string;
      defaultIss?: number;
      defaultCofins?: number;
      defaultCsll?: number;
      defaultInss?: number;
      defaultIr?: number;
      defaultPis?: number;
      defaultRetainIss?: boolean;
      serviceDescriptionTemplate?: string;
    },
  ) {
    return this.asaasService.updateInvoiceConfig(body);
  }

  /** Get Asaas fiscal info (municipal options, current config) */
  @Get('/invoices/fiscal-info')
  async getFiscalInfo() {
    if (!this.asaasProvider.isConfigured) {
      return { configured: false, message: 'Asaas não configurado' };
    }
    try {
      const [municipalOptions, fiscalInfo] = await Promise.all([
        this.asaasProvider.getMunicipalOptions().catch(() => null),
        this.asaasProvider.getFiscalInfo().catch(() => null),
      ]);
      return { configured: true, municipalOptions, fiscalInfo };
    } catch {
      return { configured: true, municipalOptions: null, fiscalInfo: null };
    }
  }

  /** List available municipal services from Asaas */
  @Get('/invoices/municipal-services')
  async getMunicipalServices(@Query('description') description?: string) {
    if (!this.asaasProvider.isConfigured) {
      return { data: [] };
    }
    return this.asaasProvider.getMunicipalServices(description);
  }
}
