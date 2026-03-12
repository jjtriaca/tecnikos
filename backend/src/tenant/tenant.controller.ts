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
      selfieFarUrl: session.selfieFarUrl,
      selfieMediumUrl: session.selfieMediumUrl,
      selfieCloseUrl: session.selfieCloseUrl,
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

    // Aggregate event counts (ALL events, not just landing)
    const events = await this.prisma.saasEvent.groupBy({
      by: ['event'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });
    const eventMap: Record<string, number> = {};
    events.forEach((e) => (eventMap[e.event] = e._count.id));

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

    // External-only conversion rate
    const externalConversion = externalPageviews > 0
      ? Math.round(((eventMap['signup_complete'] || 0) / externalPageviews) * 10000) / 100
      : 0;

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
      uniqueVisitors: allSessions.length,
      conversionRate:
        eventMap['landing_view'] > 0
          ? Math.round(((eventMap['signup_complete'] || 0) / eventMap['landing_view']) * 10000) / 100
          : 0,
      dailyViews,
      topReasons,
      devices,
      // New: internal vs external breakdown
      internalPageviews,
      externalPageviews,
      internalSessions,
      externalSessions,
      externalConversion,
      uniqueIps: uniqueIps.size,
      ipBreakdown,
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
