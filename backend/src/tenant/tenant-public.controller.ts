import { Controller, Get, Post, Body, Query as QueryParam, BadRequestException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from './tenant.service';
import { AsaasService } from './asaas.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly asaasService: AsaasService,
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
      promoCode?: string;
    },
  ) {
    // Validate required fields
    if (!body.slug || !body.name || !body.planId || !body.responsibleName || !body.responsibleEmail) {
      throw new BadRequestException('Campos obrigatórios: slug, name, planId, responsibleName, responsibleEmail');
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

    // Create tenant (normalize CNPJ to digits only)
    const tenant = await this.tenantService.provisionTenant({
      slug: body.slug,
      name: body.name,
      cnpj: cnpjDigits,
      planId: body.planId,
      responsibleName: body.responsibleName,
      responsibleEmail: body.responsibleEmail,
      responsiblePhone: body.responsiblePhone,
    });

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
        ? 'Empresa ativada com sucesso! Acesse seu painel agora.'
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
}
