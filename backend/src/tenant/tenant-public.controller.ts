import { Controller, Get, Post, Patch, Param, Body, Req, Query as QueryParam, BadRequestException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from './tenant.service';
import { AsaasService } from './asaas.service';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';

/**
 * Validate strong password:
 * - Min 8 chars
 * - At least 1 uppercase
 * - At least 1 lowercase
 * - At least 1 digit
 * - At least 1 special char
 */
function validateStrongPassword(password: string): string | null {
  if (!password || password.length < 8) return 'A senha deve ter no mínimo 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'A senha deve conter pelo menos uma letra maiúscula';
  if (!/[a-z]/.test(password)) return 'A senha deve conter pelo menos uma letra minúscula';
  if (!/\d/.test(password)) return 'A senha deve conter pelo menos um número';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return 'A senha deve conter pelo menos um caractere especial';
  return null;
}

function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // all same digits
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split('').reduce((s, d, i) => s + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calc(digits.slice(0, 12), w1) !== parseInt(digits[12])) return false;
  if (calc(digits.slice(0, 13), w2) !== parseInt(digits[13])) return false;
  return true;
}

/**
 * Public endpoints for the SaaS landing page and signup flow.
 * No authentication required.
 */
@Controller('public/saas')
export class TenantPublicController {
  private readonly logger = new Logger(TenantPublicController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly asaasService: AsaasService,
    private readonly onboarding: TenantOnboardingService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * List active plans for the pricing page.
   * Returns only active plans with public-facing fields.
   */
  @Public()
  @Get('plans')
  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        maxUsers: true,
        maxOsPerMonth: true,
        priceCents: true,
        priceYearlyCents: true,
        description: true,
        features: true,
        sortOrder: true,
      },
    });
    return plans;
  }

  /** List available add-on packages */
  @Public()
  @Get('addons')
  async getAddOns() {
    return this.prisma.addOn.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, description: true, osQuantity: true, priceCents: true },
    });
  }

  /**
   * Check if a slug is available for a new tenant.
   */
  @Public()
  @Get('check-slug')
  async checkSlug(@QueryParam('slug') slug: string) {
    if (!slug) return { available: false, reason: 'Slug é obrigatório' };

    const existing = await this.tenantService.findBySlug(slug);
    return { available: !existing };
  }

  /**
   * Return availability of pioneer program slots (4 segments).
   */
  @Public()
  @Get('pioneer-slots')
  async pioneerSlots() {
    const codes = ['PIONEIRO-PISCINAS', 'PIONEIRO-TELECOM', 'PIONEIRO-CLIMA', 'PIONEIRO-SOLAR', 'PIONEIRO-SEGURANCA'];
    const promos = await this.prisma.promotion.findMany({
      where: { code: { in: codes } },
      select: { code: true, currentUses: true, maxUses: true, isActive: true },
    });

    const segmentMap: Record<string, { name: string; description: string }> = {
      'PIONEIRO-PISCINAS': { name: 'Piscinas e Aquecedores', description: 'Manutencao de piscinas, aquecedores, bombas, tratamento' },
      'PIONEIRO-TELECOM': { name: 'Telecomunicacoes', description: 'Internet, fibra optica, TV a cabo, telefonia' },
      'PIONEIRO-CLIMA': { name: 'Climatizacao', description: 'Ar condicionado, refrigeracao, ventilacao' },
      'PIONEIRO-SOLAR': { name: 'Energia Solar', description: 'Paineis fotovoltaicos, inversores, manutencao' },
      'PIONEIRO-SEGURANCA': { name: 'Seguranca Eletronica', description: 'CFTV, alarmes, cercas eletricas, controle de acesso' },
    };

    const slots = codes.map((code) => {
      const promo = promos.find((p) => p.code === code);
      const available = promo ? promo.isActive && (!promo.maxUses || promo.currentUses < promo.maxUses) : false;
      return {
        segment: code.replace('PIONEIRO-', '').toLowerCase(),
        code,
        name: segmentMap[code].name,
        description: segmentMap[code].description,
        available,
      };
    });

    return { slots, totalAvailable: slots.filter((s) => s.available).length };
  }

  /**
   * Validate a voucher/promo code and return its details.
   */
  @Public()
  @Get('validate-code')
  async validateCode(@QueryParam('code') code: string) {
    if (!code) return { valid: false, reason: 'Código é obrigatório' };

    const promo = await this.prisma.promotion.findUnique({ where: { code } });
    if (!promo) return { valid: false, reason: 'Código inválido' };
    if (!promo.isActive) return { valid: false, reason: 'Código expirado ou inativo' };
    if (promo.expiresAt && promo.expiresAt < new Date()) return { valid: false, reason: 'Código expirado' };
    if (promo.maxUses && promo.currentUses >= promo.maxUses) return { valid: false, reason: 'Código já utilizado' };

    return {
      valid: true,
      name: promo.name,
      discountPercent: promo.discountPercent,
      discountCents: promo.discountCents,
      durationMonths: promo.durationMonths,
      skipPayment: promo.skipPayment,
      applicablePlans: promo.applicablePlans,
    };
  }

  /**
   * Lookup CNPJ via BrasilAPI (public, free).
   * Returns company info for auto-fill.
   */
  @Public()
  @Get('cnpj-lookup')
  async cnpjLookup(@QueryParam('cnpj') cnpj: string) {
    if (!cnpj) return { found: false, reason: 'CNPJ é obrigatório' };

    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return { found: false, reason: 'CNPJ inválido' };

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        headers: { 'User-Agent': 'Tecnikos/1.0', 'Accept': 'application/json' },
      });
      if (!response.ok) {
        return { found: false, reason: 'CNPJ não encontrado na Receita Federal' };
      }
      const data = await response.json();

      // Extract QSA (partners/administrators)
      const socios = Array.isArray(data.qsa)
        ? data.qsa.map((s: any) => ({
            nome: s.nome_socio || '',
            cpfCnpj: (s.cnpj_cpf_do_socio || '').replace(/\D/g, ''),
            qualificacao: s.qualificacao_socio || '',
            dataEntrada: s.data_entrada_sociedade || '',
          }))
        : [];

      return {
        found: true,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        email: data.email || '',
        telefone: data.ddd_telefone_1
          ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`
          : '',
        cep: data.cep || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        situacao: data.descricao_situacao_cadastral || '',
        socios,
      };
    } catch (err: any) {
      this.logger.warn(`CNPJ lookup failed: ${err.message}`);
      return { found: false, reason: 'Erro ao consultar CNPJ' };
    }
  }

  /**
   * Public signup — creates a new tenant with PENDING_VERIFICATION status.
   * If a voucher with skipPayment is provided, tenant goes directly to ACTIVE.
   */
  @Public()
  @Post('signup')
  async signup(
    @Body()
    body: {
      slug: string;
      name: string;
      cnpj?: string;
      planId: string;
      billingCycle: 'monthly' | 'yearly';
      responsibleName: string;
      responsibleEmail: string;
      responsiblePhone?: string;
      password: string;
      promoCode?: string;
    },
  ) {
    // Validate required fields
    if (!body.slug || !body.name || !body.planId || !body.responsibleName || !body.responsibleEmail) {
      throw new BadRequestException('Campos obrigatórios: slug, name, planId, responsibleName, responsibleEmail');
    }

    // Validate password
    if (!body.password) {
      throw new BadRequestException('Senha é obrigatória');
    }
    const passwordError = validateStrongPassword(body.password);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }

    // Validate CNPJ
    if (!body.cnpj) {
      throw new BadRequestException('CNPJ é obrigatório');
    }
    const cnpjDigits = body.cnpj.replace(/\D/g, '');
    if (!isValidCNPJ(cnpjDigits)) {
      throw new BadRequestException('CNPJ inválido');
    }

    // Check duplicate slug
    const existingSlug = await this.prisma.tenant.findFirst({ where: { slug: body.slug } });
    if (existingSlug) {
      throw new BadRequestException('Este subdomínio já está em uso');
    }

    // Check duplicate CNPJ (cnpj is @unique but nullable, so check explicitly)
    const existingCnpj = await this.prisma.tenant.findFirst({ where: { cnpj: cnpjDigits, status: { not: 'CANCELLED' } } });
    if (existingCnpj) {
      throw new BadRequestException('Já existe uma empresa cadastrada com este CNPJ');
    }

    // Check duplicate email
    const existingEmail = await this.prisma.tenant.findFirst({
      where: { responsibleEmail: body.responsibleEmail.toLowerCase().trim() },
    });
    if (existingEmail) {
      throw new BadRequestException('Este email já está vinculado a uma empresa');
    }

    // Validate plan exists and is active
    const plan = await this.prisma.plan.findFirst({
      where: { id: body.planId, isActive: true },
    });
    if (!plan) {
      throw new BadRequestException('Plano selecionado não está disponível');
    }

    // Validate promo code if provided
    let skipPayment = false;
    let promoId: string | undefined;
    if (body.promoCode) {
      const promo = await this.prisma.promotion.findUnique({ where: { code: body.promoCode } });
      if (!promo || !promo.isActive) {
        throw new BadRequestException('Código promocional inválido');
      }
      if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw new BadRequestException('Código promocional expirado');
      }
      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        throw new BadRequestException('Código promocional já utilizado');
      }
      if (promo.applicablePlans.length > 0 && !promo.applicablePlans.includes(body.planId)) {
        throw new BadRequestException('Código não aplicável ao plano selecionado');
      }

      skipPayment = promo.skipPayment;
      promoId = promo.id;

      // Increment usage
      await this.prisma.promotion.update({
        where: { id: promo.id },
        data: { currentUses: { increment: 1 } },
      });
    }

    // Hash the password for storage
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create tenant (normalize CNPJ to digits only)
    const tenant = await this.tenantService.provisionTenant({
      slug: body.slug,
      name: body.name,
      cnpj: cnpjDigits,
      planId: body.planId,
      responsibleName: body.responsibleName,
      responsibleEmail: body.responsibleEmail,
      responsiblePhone: body.responsiblePhone,
      passwordHash,
    });

    // Always run onboarding so user can login immediately
    // (creates Company + User in tenant schema, sends welcome email)
    await this.onboarding.onboard(tenant.id, passwordHash);

    // If voucher skips payment, activate immediately
    if (skipPayment) {
      await this.tenantService.activate(tenant.id);
    }

    return {
      success: true,
      tenantId: tenant.id,
      slug: tenant.slug,
      status: skipPayment ? 'ACTIVE' : tenant.status,
      skipPayment,
      message: skipPayment
        ? 'Empresa ativada com sucesso! Verifique seu email para os dados de acesso.'
        : 'Cadastro realizado! Escolha sua forma de pagamento.',
    };
  }

  /**
   * Create a subscription (payment) for a tenant.
   * Called after signup, when user provides payment info.
   */
  @Public()
  @Post('subscribe')
  async subscribe(
    @Body()
    body: {
      tenantId: string;
      billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
      billingCycle: 'monthly' | 'yearly';
      promoCode?: string;
      creditCard?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo?: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone?: string;
      };
    },
  ) {
    if (!body.tenantId || !body.billingType) {
      throw new BadRequestException('tenantId e billingType são obrigatórios');
    }

    // Validate tenant exists and is in a valid state for subscription
    const tenant = await this.prisma.tenant.findUnique({ where: { id: body.tenantId } });
    if (!tenant) throw new BadRequestException('Empresa não encontrada');
    if (tenant.status === 'ACTIVE') {
      return { success: true, message: 'Empresa já está ativa', alreadyActive: true };
    }

    const result = await this.asaasService.createSubscription({
      tenantId: body.tenantId,
      billingType: body.billingType,
      billingCycle: body.billingCycle || 'monthly',
      creditCard: body.creditCard,
      creditCardHolderInfo: body.creditCardHolderInfo,
      promoCode: body.promoCode,
    });

    return {
      success: true,
      subscriptionId: result.subscription.id,
      asaasSubscriptionId: result.asaasSubscription.id,
      message: body.billingType === 'CREDIT_CARD'
        ? 'Pagamento processado! Sua empresa será ativada em instantes.'
        : body.billingType === 'PIX'
          ? 'QR Code PIX gerado! Pague para ativar sua empresa.'
          : 'Boleto gerado! Sua empresa será ativada após o pagamento.',
    };
  }

  /** Purchase an add-on package */
  @Public()
  @Post('purchase-addon')
  async purchaseAddOn(
    @Body() body: { tenantId: string; addOnId: string; billingType?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' },
  ) {
    if (!body.tenantId || !body.addOnId) {
      throw new BadRequestException('tenantId e addOnId são obrigatórios');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: body.tenantId } });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new BadRequestException('Empresa não encontrada ou inativa');
    }

    const result = await this.asaasService.purchaseAddOn(
      body.tenantId,
      body.addOnId,
      body.billingType || 'PIX',
    );

    return {
      success: true,
      purchaseId: result.purchase.id,
      asaasPaymentId: result.asaasPayment?.id,
      message: result.asaasPayment
        ? 'Pagamento criado! OS extras serão creditadas após confirmação.'
        : 'OS extras creditadas com sucesso!',
    };
  }

  /* ── Signup Attempt Tracking ──────────────────────── */

  @Public()
  @Post('signup-attempt')
  async submitSignupAttempt(
    @Body() body: {
      id?: string; // If provided, updates existing attempt (upsert)
      slug?: string;
      companyName?: string;
      cnpj?: string;
      responsibleName?: string;
      responsibleEmail?: string;
      responsiblePhone?: string;
      planId?: string;
      planName?: string;
      billingCycle?: string;
      cnpjData?: any;
      verificationResult?: any;
      rejectionReasons?: string[];
      criticism?: string;
      lastStep?: number;
      lastError?: string;
      completedAt?: string;
    },
    @Req() req: Request,
  ) {
    const data: any = {
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
      userAgent: req.headers['user-agent'],
    };

    // Only set fields that are provided (partial update support)
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.companyName !== undefined) data.companyName = body.companyName;
    if (body.cnpj !== undefined) data.cnpj = body.cnpj.replace(/\D/g, '');
    if (body.responsibleName !== undefined) data.responsibleName = body.responsibleName;
    if (body.responsibleEmail !== undefined) data.responsibleEmail = body.responsibleEmail;
    if (body.responsiblePhone !== undefined) data.responsiblePhone = body.responsiblePhone;
    if (body.planId !== undefined) data.planId = body.planId;
    if (body.planName !== undefined) data.planName = body.planName;
    if (body.billingCycle !== undefined) data.billingCycle = body.billingCycle;
    if (body.cnpjData !== undefined) data.cnpjData = body.cnpjData;
    if (body.verificationResult !== undefined) data.verificationResult = body.verificationResult;
    if (body.rejectionReasons !== undefined) data.rejectionReasons = body.rejectionReasons;
    if (body.criticism !== undefined) data.criticism = body.criticism;
    if (body.lastStep !== undefined) data.lastStep = body.lastStep;
    if (body.lastError !== undefined) data.lastError = body.lastError;
    if (body.completedAt !== undefined) data.completedAt = new Date(body.completedAt);

    let attempt: any;
    if (body.id) {
      // Update existing attempt
      attempt = await this.prisma.signupAttempt.update({
        where: { id: body.id },
        data,
      }).catch(() => null);
      // If not found, create new
      if (!attempt) {
        attempt = await this.prisma.signupAttempt.create({ data });
      }
    } else {
      attempt = await this.prisma.signupAttempt.create({ data });
    }

    return { success: true, id: attempt.id };
  }

  @Public()
  @Patch('signup-attempt/:id/criticism')
  async addCriticism(
    @Param('id') id: string,
    @Body('criticism') criticism: string,
  ) {
    if (!criticism?.trim()) throw new BadRequestException('Mensagem é obrigatória');
    const attempt = await this.prisma.signupAttempt.findUnique({ where: { id } });
    if (!attempt) throw new BadRequestException('Tentativa não encontrada');
    await this.prisma.signupAttempt.update({
      where: { id },
      data: { criticism: criticism.trim() },
    });

    // Notify admin by email
    const stepNames: Record<number, string> = { 1: 'Plano', 2: 'Dados da Empresa', 3: 'Documentos', 4: 'Pagamento', 5: 'Concluido' };
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'contato@tecnikos.com.br';
    this.emailService.sendSystemEmail(
      adminEmail,
      `[Tecnikos] Problema reportado no cadastro — ${attempt.companyName || attempt.slug || 'Sem nome'}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e293b">Problema Reportado no Cadastro</h2>
        <p>Um potencial cliente reportou um problema durante o cadastro:</p>
        <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
          <strong>Mensagem:</strong><br/>"${criticism.trim()}"
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:4px 8px;color:#64748b">Empresa</td><td style="padding:4px 8px;font-weight:bold">${attempt.companyName || '-'}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b">CNPJ</td><td style="padding:4px 8px">${attempt.cnpj || '-'}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b">Responsavel</td><td style="padding:4px 8px">${attempt.responsibleName || '-'} (${attempt.responsibleEmail || '-'})</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b">Telefone</td><td style="padding:4px 8px">${attempt.responsiblePhone || '-'}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b">Step</td><td style="padding:4px 8px">${attempt.lastStep || 1} — ${stepNames[attempt.lastStep || 1] || 'Desconhecido'}</td></tr>
          ${attempt.lastError ? `<tr><td style="padding:4px 8px;color:#64748b">Erro</td><td style="padding:4px 8px;color:#dc2626">${attempt.lastError}</td></tr>` : ''}
        </table>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px">Acesse o painel admin para mais detalhes.</p>
      </div>`,
    ).catch((err: any) => this.logger.warn(`Failed to send signup problem email: ${err.message}`));

    return { success: true };
  }

  /* ── Analytics Event Tracking ─────────────────────── */

  @Public()
  @Post('track')
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  async trackEvent(
    @Body() body: { event: string; page?: string; metadata?: any; sessionId?: string },
    @Req() req: Request,
  ) {
    if (!body.event) return { ok: true };
    await this.prisma.saasEvent.create({
      data: {
        event: body.event,
        page: body.page,
        metadata: body.metadata || undefined,
        sessionId: body.sessionId,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
    return { ok: true };
  }
}
