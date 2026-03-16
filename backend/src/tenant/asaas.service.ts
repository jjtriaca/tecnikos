import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from './tenant.service';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { AsaasProvider } from './asaas.provider';

/** Grace period in days before blocking a tenant for non-payment */
const OVERDUE_GRACE_DAYS = 7;

/**
 * Business logic layer for Asaas billing integration.
 * Handles tenant lifecycle tied to payment events.
 */
@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly tenantConn: TenantConnectionService,
    private readonly onboarding: TenantOnboardingService,
    private readonly asaas: AsaasProvider,
  ) {}

  /**
   * Create an Asaas customer for a tenant and save the ID.
   */
  async ensureCustomer(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant) throw new BadRequestException('Tenant não encontrado');

    // Already has customer
    if (tenant.asaasCustomerId) return tenant.asaasCustomerId;

    if (!this.asaas.isConfigured) {
      throw new BadRequestException('Asaas não configurado. Defina ASAAS_API_KEY nas variáveis de ambiente.');
    }

    const customer = await this.asaas.createCustomer({
      name: tenant.name,
      cpfCnpj: (tenant.cnpj || '').replace(/[^\d]/g, ''),
      email: tenant.responsibleEmail || undefined,
      mobilePhone: (tenant.responsiblePhone || '').replace(/[^\d]/g, '') || undefined,
      externalReference: tenant.id,
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { asaasCustomerId: customer.id },
    });

    this.logger.log(`Asaas customer created: ${customer.id} for tenant ${tenant.slug}`);
    return customer.id;
  }

  /**
   * Create a subscription in Asaas for a tenant.
   */
  async createSubscription(params: {
    tenantId: string;
    billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
    billingCycle: 'monthly' | 'yearly';
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
    creditCardToken?: string;
    promoCode?: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      include: { plan: true },
    });
    if (!tenant || !tenant.plan) {
      throw new BadRequestException('Tenant ou plano não encontrado');
    }

    // Ensure Asaas customer
    const customerId = await this.ensureCustomer(params.tenantId);

    // Calculate value
    const plan = tenant.plan;
    const isYearly = params.billingCycle === 'yearly';
    let fullValueCents: number;
    if (isYearly && plan.priceYearlyCents) {
      fullValueCents = plan.priceYearlyCents;
    } else {
      fullValueCents = plan.priceCents;
    }

    // Apply promotion — for multi-month promos, we set the subscription VALUE
    // to the discounted price (not using Asaas discount system).
    // After promo ends, we update the subscription to the full price.
    let promoId: string | undefined;
    let promoDuration = 0;
    let subscriptionValueCents = fullValueCents;

    if (params.promoCode) {
      const promo = await this.prisma.promotion.findUnique({
        where: { code: params.promoCode },
      });
      if (promo && promo.isActive && !promo.skipPayment) {
        promoId = promo.id;
        promoDuration = promo.durationMonths;

        // Calculate discounted value
        if (promo.discountPercent) {
          subscriptionValueCents = Math.round(fullValueCents * (1 - promo.discountPercent / 100));
        } else if (promo.discountCents) {
          subscriptionValueCents = Math.max(0, fullValueCents - promo.discountCents);
        }

        this.logger.log(
          `Promo "${promo.code}" applied: R$${(subscriptionValueCents / 100).toFixed(2)} ` +
          `for ${promoDuration} months (full: R$${(fullValueCents / 100).toFixed(2)})`,
        );
      }
    }

    const value = subscriptionValueCents / 100; // Asaas uses BRL (not cents)
    const cycle = isYearly ? 'ANNUAL' : 'MONTHLY';
    const nextDueDate = this.formatDate(new Date()); // Today

    const subscriptionData: any = {
      customer: customerId,
      billingType: params.billingType,
      value,
      nextDueDate,
      cycle,
      description: `${plan.name} - Tecnikos`,
      externalReference: params.tenantId,
    };

    // No Asaas discount — we set the value directly for promo pricing
    if (params.creditCard) subscriptionData.creditCard = params.creditCard;
    if (params.creditCardHolderInfo) subscriptionData.creditCardHolderInfo = params.creditCardHolderInfo;
    if (params.creditCardToken) subscriptionData.creditCardToken = params.creditCardToken;

    const asaasSub = await this.asaas.createSubscription(subscriptionData);

    // Create local subscription
    const now = new Date();
    const periodEnd = new Date(now);
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: params.tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        asaasSubscriptionId: asaasSub.id,
        osResetDate: now,
        billingCycle: isYearly ? 'ANNUAL' : 'MONTHLY',
        promotionId: promoId,
        promotionMonthsLeft: promoDuration || null,
        originalValueCents: promoDuration > 0 ? fullValueCents : null,
      },
    });

    // Update tenant status to PENDING_PAYMENT (will become ACTIVE on first payment)
    await this.prisma.tenant.update({
      where: { id: params.tenantId },
      data: { status: 'PENDING_PAYMENT' },
    });

    this.logger.log(
      `Subscription created: ${asaasSub.id} (${cycle}) for tenant ${tenant.slug}`,
    );

    return { subscription, asaasSubscription: asaasSub };
  }

  /**
   * Create an Asaas subscription and return the invoice URL for the first payment.
   * The Asaas invoice page shows all payment methods (PIX, Boleto, Card).
   * This replaces the Checkout API which only supports CREDIT_CARD for RECURRENT.
   */
  async createSignupCheckout(params: {
    tenantId: string;
    billingCycle: 'monthly' | 'yearly';
    promoCode?: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      include: { plan: true },
    });
    if (!tenant || !tenant.plan) {
      throw new BadRequestException('Tenant ou plano não encontrado');
    }

    if (!this.asaas.isConfigured) {
      throw new BadRequestException('Asaas não configurado. Defina ASAAS_API_KEY nas variáveis de ambiente.');
    }

    const customerId = await this.ensureCustomer(params.tenantId);
    const plan = tenant.plan;
    const isYearly = params.billingCycle === 'yearly';

    let fullValueCents: number;
    if (isYearly && plan.priceYearlyCents) {
      fullValueCents = plan.priceYearlyCents;
    } else {
      fullValueCents = plan.priceCents;
    }

    // Apply promotion
    let promoId: string | undefined;
    let promoDuration = 0;
    let subscriptionValueCents = fullValueCents;

    if (params.promoCode) {
      const promo = await this.prisma.promotion.findUnique({
        where: { code: params.promoCode },
      });
      if (promo && promo.isActive && !promo.skipPayment) {
        promoId = promo.id;
        promoDuration = promo.durationMonths;
        if (promo.discountPercent) {
          subscriptionValueCents = Math.round(fullValueCents * (1 - promo.discountPercent / 100));
        } else if (promo.discountCents) {
          subscriptionValueCents = Math.max(0, fullValueCents - promo.discountCents);
        }
        this.logger.log(
          `Promo "${promo.code}" applied: R$${(subscriptionValueCents / 100).toFixed(2)} ` +
          `for ${promoDuration} months (full: R$${(fullValueCents / 100).toFixed(2)})`,
        );
      }
    }

    const value = subscriptionValueCents / 100;
    const cycle = isYearly ? 'ANNUAL' : 'MONTHLY';
    const nextDueDate = this.formatDate(new Date());

    // Create Asaas subscription (billingType UNDEFINED → customer chooses on invoice page)
    const asaasSub = await this.asaas.createSubscription({
      customer: customerId,
      billingType: 'UNDEFINED',
      value,
      nextDueDate,
      cycle,
      description: `${plan.name} - Tecnikos`,
      externalReference: params.tenantId,
    });

    // Create local subscription
    const now = new Date();
    const periodEnd = new Date(now);
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.subscription.create({
      data: {
        tenantId: params.tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        asaasSubscriptionId: asaasSub.id,
        osResetDate: now,
        billingCycle: isYearly ? 'ANNUAL' : 'MONTHLY',
        promotionId: promoId,
        promotionMonthsLeft: promoDuration || null,
        originalValueCents: promoDuration > 0 ? fullValueCents : null,
      },
    });

    // Set tenant to PENDING_PAYMENT
    await this.prisma.tenant.update({
      where: { id: params.tenantId },
      data: { status: 'PENDING_PAYMENT' },
    });

    // Get the first payment's invoiceUrl (Asaas hosted page with all payment methods)
    let checkoutUrl: string | null = null;
    try {
      const paymentInfo = await this.getFirstPaymentInfo(asaasSub.id, 'UNDEFINED');
      checkoutUrl = paymentInfo?.invoiceUrl || null;
    } catch (err) {
      this.logger.warn(`Failed to get first payment invoiceUrl: ${(err as Error).message}`);
    }

    // Fallback: build Asaas payment URL from subscription
    if (!checkoutUrl) {
      const isSandbox = (this.asaas as any).baseUrl?.includes('sandbox');
      const host = isSandbox ? 'https://sandbox.asaas.com' : 'https://www.asaas.com';
      checkoutUrl = `${host}/i/${asaasSub.id}`;
    }

    this.logger.log(`Signup subscription created for tenant ${tenant.slug}: ${checkoutUrl}`);
    return { checkoutUrl };
  }

  /**
   * Create an Asaas Checkout session for purchasing an add-on (extra OS).
   */
  async createAddOnCheckout(tenantId: string, addOnId: string) {
    const [addOn, subscription, tenant] = await Promise.all([
      this.prisma.addOn.findUnique({ where: { id: addOnId } }),
      this.prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    if (!addOn || !addOn.isActive) {
      throw new BadRequestException('Pacote não encontrado ou inativo');
    }
    if (!subscription) {
      throw new BadRequestException('Nenhuma assinatura ativa');
    }
    if (!tenant) {
      throw new BadRequestException('Tenant não encontrado');
    }

    // Compute period (current month) and expiry (end of current billing cycle or end of month)
    const now = new Date();
    const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const expiresAt = subscription.currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Build description for checkout
    const descParts: string[] = [];
    if (addOn.osQuantity > 0) descParts.push(`+${addOn.osQuantity} OS`);
    if (addOn.userQuantity > 0) descParts.push(`+${addOn.userQuantity} usuário(s)`);
    if (addOn.technicianQuantity > 0) descParts.push(`+${addOn.technicianQuantity} técnico(s)`);
    if (addOn.aiMessageQuantity > 0) descParts.push(`+${addOn.aiMessageQuantity} msgs IA`);
    const descStr = descParts.join(', ') || addOn.name;

    // Create local purchase record (PENDING)
    const purchase = await this.prisma.addOnPurchase.create({
      data: {
        subscriptionId: subscription.id,
        addOnId: addOn.id,
        osQuantity: addOn.osQuantity,
        userQuantity: addOn.userQuantity,
        technicianQuantity: addOn.technicianQuantity,
        aiMessageQuantity: addOn.aiMessageQuantity,
        priceCents: addOn.priceCents,
        periodMonth,
        expiresAt,
        status: 'PENDING',
      },
    });

    if (!this.asaas.isConfigured || addOn.priceCents <= 0) {
      // Free or no gateway — credit immediately
      await this.prisma.addOnPurchase.update({
        where: { id: purchase.id },
        data: { status: 'PAID' },
      });
      if (addOn.osQuantity > 0) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { extraOsPurchased: { increment: addOn.osQuantity } },
        });
      }
      await this.creditAddOnToTenantCompany(tenant, addOn);
      return { checkoutUrl: null, purchase };
    }

    const customerId = await this.ensureCustomer(tenantId);
    const frontendUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';

    const checkout = await this.asaas.createCheckout({
      customer: customerId,
      billingTypes: ['PIX', 'BOLETO', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      items: [{
        name: `Add-on: ${addOn.name}`,
        description: descStr,
        quantity: 1,
        value: addOn.priceCents / 100,
      }],
      callback: {
        successUrl: `${frontendUrl}/settings/billing?addon=success`,
      },
    });

    this.logger.log(`Add-on checkout created: ${addOn.name} (${descStr}) for tenant ${tenantId}`);
    return { checkoutUrl: checkout.url, purchase };
  }

  /**
   * Upgrade to a more expensive plan (immediate, with pro-rata credit).
   * Credit from remaining days is stored as balance for future invoices.
   */
  async createUpgradeCheckout(tenantId: string, newPlanId: string) {
    const [tenant, newPlan, currentSub] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } }),
      this.prisma.plan.findFirst({ where: { id: newPlanId, isActive: true } }),
      this.prisma.subscription.findFirst({
        where: { tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!tenant) throw new BadRequestException('Tenant não encontrado');
    if (!newPlan) throw new BadRequestException('Plano não encontrado ou inativo');
    if (!currentSub) throw new BadRequestException('Nenhuma assinatura ativa');
    if (newPlan.id === currentSub.planId) {
      throw new BadRequestException('Você já está neste plano');
    }

    // Validate upgrade (new plan must be more expensive)
    const currentPlan = currentSub.plan;
    if (newPlan.priceCents <= (currentPlan?.priceCents || 0)) {
      throw new BadRequestException(
        'Para trocar para um plano mais barato, use o endpoint de downgrade',
      );
    }

    // ── Calculate pro-rata credit ──
    const now = new Date();
    const periodStart = currentSub.currentPeriodStart;
    const periodEnd = currentSub.currentPeriodEnd;
    const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.max(0, Math.round((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const billingCycle = currentSub.billingCycle || 'MONTHLY';
    const isYearly = billingCycle === 'ANNUAL';
    const currentValueCents = isYearly && currentPlan?.priceYearlyCents
      ? currentPlan.priceYearlyCents
      : (currentPlan?.priceCents || 0);
    const creditCents = Math.round((remainingDays / totalDays) * currentValueCents);
    const existingCredit = currentSub.creditBalanceCents || 0;
    const totalCredit = existingCredit + creditCents;

    this.logger.log(
      `Upgrade pro-rata: ${remainingDays}/${totalDays} days remaining, ` +
      `credit R$${(creditCents / 100).toFixed(2)} + existing R$${(existingCredit / 100).toFixed(2)} ` +
      `= total R$${(totalCredit / 100).toFixed(2)}`,
    );

    // ── Cancel current Asaas subscription ──
    if (currentSub.asaasSubscriptionId && this.asaas.isConfigured) {
      try {
        await this.asaas.cancelSubscription(currentSub.asaasSubscriptionId);
      } catch (err) {
        this.logger.warn(`Failed to cancel old Asaas subscription: ${(err as Error).message}`);
      }
    }

    // Mark old subscription as cancelled
    await this.prisma.subscription.update({
      where: { id: currentSub.id },
      data: { status: 'CANCELLED', cancelledAt: now },
    });

    // ── Create new subscription (preserving billing cycle) ──
    const newPeriodEnd = new Date(now);
    if (isYearly) {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    } else {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    }

    const newValueCents = isYearly && newPlan.priceYearlyCents
      ? newPlan.priceYearlyCents
      : newPlan.priceCents;

    // Apply credit as discount on first invoice
    const firstInvoiceDiscount = Math.min(totalCredit, newValueCents);
    const remainingCredit = totalCredit - firstInvoiceDiscount;

    const newSub = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: newPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: newPeriodEnd,
        osResetDate: now,
        billingCycle,
        creditBalanceCents: remainingCredit, // Any leftover credit after first invoice
      },
    });

    // Update tenant plan + limits (snapshot all features — grandfather)
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: newPlan.id,
        maxUsers: newPlan.maxUsers,
        maxOsPerMonth: newPlan.maxOsPerMonth,
        maxTechnicians: newPlan.maxTechnicians,
        maxAiMessages: newPlan.maxAiMessages,
        supportLevel: newPlan.supportLevel,
        allModulesIncluded: newPlan.allModulesIncluded,
      },
    });

    // Update Company limits in tenant schema
    try {
      const client = this.tenantConn.getClient(tenant.schemaName);
      const company = await client.company.findFirst();
      if (company) {
        await client.company.update({
          where: { id: company.id },
          data: {
            maxUsers: newPlan.maxUsers,
            maxOsPerMonth: newPlan.maxOsPerMonth,
            maxTechnicians: newPlan.maxTechnicians,
            maxAiMessages: newPlan.maxAiMessages,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to update Company limits: ${(err as Error).message}`);
    }

    // ── Create Asaas subscription with discount on first invoice ──
    const customerId = await this.ensureCustomer(tenantId);
    const asaasValue = newValueCents / 100;
    const nextDueDate = this.formatDate(now);

    const asaasData: any = {
      customer: customerId,
      billingType: 'UNDEFINED',
      value: asaasValue,
      nextDueDate,
      cycle: isYearly ? 'ANNUAL' : 'MONTHLY',
      description: `${newPlan.name} - Tecnikos`,
      externalReference: tenantId,
    };

    // Apply pro-rata credit as discount on first invoice only
    if (firstInvoiceDiscount > 0) {
      asaasData.discount = {
        value: firstInvoiceDiscount / 100,
        type: 'FIXED',
        dueDateLimitDays: 0, // Only on first invoice
      };
      this.logger.log(`Applying R$${(firstInvoiceDiscount / 100).toFixed(2)} discount on first invoice`);
    }

    const asaasSub = await this.asaas.createSubscription(asaasData);

    // Link asaasSubscriptionId
    await this.prisma.subscription.update({
      where: { id: newSub.id },
      data: { asaasSubscriptionId: asaasSub.id },
    });

    // Get the first payment's invoiceUrl
    let checkoutUrl: string | null = null;
    try {
      const paymentInfo = await this.getFirstPaymentInfo(asaasSub.id, 'UNDEFINED');
      checkoutUrl = paymentInfo?.invoiceUrl || null;
    } catch (err) {
      this.logger.warn(`Failed to get upgrade invoiceUrl: ${(err as Error).message}`);
    }

    // Fallback URL
    if (!checkoutUrl) {
      const isSandbox = (this.asaas as any).baseUrl?.includes('sandbox');
      const host = isSandbox ? 'https://sandbox.asaas.com' : 'https://www.asaas.com';
      checkoutUrl = `${host}/i/${asaasSub.id}`;
    }

    this.logger.log(
      `Upgrade: ${currentPlan?.name} → ${newPlan.name} for tenant ${tenantId}. ` +
      `Credit: R$${(totalCredit / 100).toFixed(2)}, checkout: ${checkoutUrl}`,
    );
    return { checkoutUrl, creditApplied: firstInvoiceDiscount / 100 };
  }

  /**
   * Schedule a downgrade to a cheaper plan (applied at next billing cycle).
   * No credit is generated — client uses current plan until period end.
   */
  async schedulePlanDowngrade(tenantId: string, newPlanId: string) {
    const [currentSub, newPlan] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.plan.findFirst({ where: { id: newPlanId, isActive: true } }),
    ]);

    if (!currentSub) throw new BadRequestException('Nenhuma assinatura ativa');
    if (!newPlan) throw new BadRequestException('Plano não encontrado ou inativo');
    if (newPlan.id === currentSub.planId) {
      throw new BadRequestException('Você já está neste plano');
    }

    // Validate downgrade (new plan must be cheaper)
    if (newPlan.priceCents >= (currentSub.plan?.priceCents || 0)) {
      throw new BadRequestException(
        'Para trocar para um plano mais caro, use o endpoint de upgrade',
      );
    }

    // Schedule the change for end of current period
    await this.prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        pendingPlanId: newPlan.id,
        pendingPlanAt: currentSub.currentPeriodEnd,
      },
    });

    this.logger.log(
      `Downgrade scheduled: ${currentSub.plan?.name} → ${newPlan.name} ` +
      `for tenant ${tenantId}, effective ${currentSub.currentPeriodEnd.toISOString().split('T')[0]}`,
    );

    return {
      pendingPlan: newPlan.name,
      effectiveDate: currentSub.currentPeriodEnd,
    };
  }

  /**
   * Cancel a pending downgrade.
   */
  async cancelPendingDowngrade(tenantId: string) {
    const currentSub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] }, pendingPlanId: { not: null } },
    });

    if (!currentSub) {
      throw new BadRequestException('Nenhum downgrade pendente');
    }

    await this.prisma.subscription.update({
      where: { id: currentSub.id },
      data: { pendingPlanId: null, pendingPlanAt: null },
    });

    this.logger.log(`Pending downgrade cancelled for tenant ${tenantId}`);
    return { success: true };
  }

  /**
   * Get the first payment info for a subscription (PIX QR code, boleto URL, etc).
   * Called right after creating a subscription to show payment details to the user.
   */
  async getFirstPaymentInfo(
    asaasSubscriptionId: string,
    billingType: string,
  ): Promise<{
    paymentId: string;
    status: string;
    value: number;
    dueDate: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
    pixExpirationDate?: string;
    boletoIdentificationField?: string;
  } | null> {
    // Asaas creates the first payment asynchronously — may need a small retry
    let payments: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      payments = await this.asaas.getSubscriptionPayments(asaasSubscriptionId);
      if (payments?.data?.length > 0) break;
      await new Promise((r) => setTimeout(r, 1500)); // Wait 1.5s between retries
    }

    if (!payments?.data?.[0]) {
      this.logger.warn(`No payments found for subscription ${asaasSubscriptionId}`);
      return null;
    }

    const payment = payments.data[0];
    const result: any = {
      paymentId: payment.id,
      status: payment.status,
      value: payment.value,
      dueDate: payment.dueDate,
      invoiceUrl: payment.invoiceUrl || null,
      bankSlipUrl: payment.bankSlipUrl || null,
    };

    // Get PIX QR code data
    if (billingType === 'PIX' && payment.id) {
      try {
        const pix = await this.asaas.getPixQrCode(payment.id);
        result.pixQrCode = pix.encodedImage; // Base64 image
        result.pixCopyPaste = pix.payload; // Copy-paste code
        result.pixExpirationDate = pix.expirationDate;
      } catch (err) {
        this.logger.warn(`Failed to get PIX QR code: ${(err as Error).message}`);
      }
    }

    // Get boleto identification field (linha digitavel)
    if (billingType === 'BOLETO' && payment.id) {
      try {
        const boleto = await this.asaas.getIdentificationField(payment.id);
        result.boletoIdentificationField = boleto.identificationField;
      } catch (err) {
        this.logger.warn(`Failed to get boleto identification field: ${(err as Error).message}`);
      }
    }

    return result;
  }

  /**
   * Get current payment status for a tenant (used by frontend polling).
   */
  async getPaymentStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) return { status: 'NOT_FOUND' };

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      tenantStatus: tenant.status,
      subscriptionStatus: subscription?.status || null,
      isActive: tenant.status === 'ACTIVE',
    };
  }

  /**
   * Handle Asaas webhook payment events.
   */
  async handlePaymentWebhook(event: string, payment: any) {
    const subscriptionId = payment.subscription;

    // Handle standalone payments (add-on purchases)
    if (!subscriptionId) {
      if ((event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') && payment.id) {
        // Try by asaasPaymentId first (direct payment flow)
        const confirmed = await this.confirmAddOnPayment(payment.id);
        if (!confirmed && payment.customer) {
          // Checkout flow: find by customer → tenant → latest PENDING AddOnPurchase
          const confirmedByCustomer = await this.confirmAddOnByCustomer(payment.customer);
          if (!confirmedByCustomer) {
            this.logger.warn(`Add-on payment webhook: could not confirm payment ${payment.id} for customer ${payment.customer} — no PENDING purchase found`);
          }
        }
      }
      return;
    }

    // Find local subscription by asaas ID
    const subscription = await this.prisma.subscription.findFirst({
      where: { asaasSubscriptionId: subscriptionId },
      include: { tenant: true },
    });

    if (!subscription) {
      this.logger.warn(`No local subscription for asaas ${subscriptionId}`);
      return;
    }

    const tenantId = subscription.tenantId;

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        // Activate tenant if not already active (or reactivate if BLOCKED)
        const tenant = subscription.tenant;
        if (tenant.status !== 'ACTIVE') {
          await this.tenantService.activate(tenantId);
          // Pass stored passwordHash from signup (if available)
          await this.onboarding.onboard(tenantId, tenant.passwordHash || undefined);
          this.logger.log(`Tenant ${tenant.slug} activated + onboarded via payment`);

          // Send welcome email now that payment is confirmed
          this.onboarding.sendWelcomeEmailForTenant(tenantId).catch((err) => {
            this.logger.error(`Failed to send welcome email: ${(err as Error).message}`);
          });
        }

        // Update subscription period + clear overdue
        const nextDue = new Date(payment.dueDate || payment.paymentDate);
        const nextEnd = new Date(nextDue);
        nextEnd.setMonth(nextEnd.getMonth() + 1);

        const updateData: any = {
          status: 'ACTIVE',
          currentPeriodStart: new Date(payment.paymentDate || payment.dueDate),
          currentPeriodEnd: nextEnd,
          nextBillingDate: nextEnd,
          overdueAt: null, // Clear overdue on payment
        };

        // Handle promotion month tracking
        if (subscription.promotionMonthsLeft && subscription.promotionMonthsLeft > 0) {
          const newMonthsLeft = subscription.promotionMonthsLeft - 1;
          updateData.promotionMonthsLeft = newMonthsLeft;

          if (newMonthsLeft === 0 && subscription.originalValueCents && subscription.asaasSubscriptionId) {
            // Promo ended — update Asaas subscription to full plan price
            const fullValue = subscription.originalValueCents / 100;
            try {
              await this.asaas.updateSubscription(subscription.asaasSubscriptionId, {
                value: fullValue,
                updatePendingPayments: false,
              });
              this.logger.log(
                `Promo ended for subscription ${subscription.id}: ` +
                `updated to full price R$${fullValue.toFixed(2)}`,
              );
            } catch (err) {
              this.logger.error(
                `Failed to update Asaas subscription to full price: ${(err as Error).message}`,
              );
            }
          } else if (newMonthsLeft > 0) {
            this.logger.log(
              `Promo: ${newMonthsLeft} months left for subscription ${subscription.id}`,
            );
          }
        }

        // Apply pending downgrade if scheduled
        if (subscription.pendingPlanId) {
          const pendingPlan = await this.prisma.plan.findUnique({
            where: { id: subscription.pendingPlanId },
          });
          if (pendingPlan) {
            updateData.planId = pendingPlan.id;
            updateData.pendingPlanId = null;
            updateData.pendingPlanAt = null;

            // Update tenant limits to new (downgraded) plan — snapshot all features
            await this.prisma.tenant.update({
              where: { id: tenantId },
              data: {
                planId: pendingPlan.id,
                maxUsers: pendingPlan.maxUsers,
                maxOsPerMonth: pendingPlan.maxOsPerMonth,
                maxTechnicians: pendingPlan.maxTechnicians,
                maxAiMessages: pendingPlan.maxAiMessages,
                supportLevel: pendingPlan.supportLevel,
                allModulesIncluded: pendingPlan.allModulesIncluded,
              },
            });

            // Update Company limits in tenant schema
            try {
              const client = this.tenantConn.getClient(subscription.tenant.schemaName);
              const company = await client.company.findFirst();
              if (company) {
                await client.company.update({
                  where: { id: company.id },
                  data: {
                    maxUsers: pendingPlan.maxUsers,
                    maxOsPerMonth: pendingPlan.maxOsPerMonth,
                    maxTechnicians: pendingPlan.maxTechnicians,
                    maxAiMessages: pendingPlan.maxAiMessages,
                  },
                });
              }
            } catch (err) {
              this.logger.warn(`Failed to update Company limits on downgrade: ${(err as Error).message}`);
            }

            // Update Asaas subscription value to new plan price
            const billingCycle = subscription.billingCycle || 'MONTHLY';
            const newValue = billingCycle === 'ANNUAL' && pendingPlan.priceYearlyCents
              ? pendingPlan.priceYearlyCents / 100
              : pendingPlan.priceCents / 100;
            if (subscription.asaasSubscriptionId && this.asaas.isConfigured) {
              try {
                await this.asaas.updateSubscription(subscription.asaasSubscriptionId, {
                  value: newValue,
                  updatePendingPayments: false,
                });
              } catch (err) {
                this.logger.warn(`Failed to update Asaas value on downgrade: ${(err as Error).message}`);
              }
            }

            this.logger.log(
              `Downgrade applied: → ${pendingPlan.name} for tenant ${tenantId} (R$${newValue.toFixed(2)})`,
            );
          }
        }

        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: updateData,
        });

        // Auto-emit invoice if configured
        try {
          const config = await this.prisma.saasInvoiceConfig.findFirst();
          if (config?.autoEmitOnPayment) {
            await this.issueInvoice({ tenantId });
            this.logger.log(`Auto-emitted invoice for tenant ${tenantId} on payment confirmation`);
          }
        } catch (err) {
          this.logger.warn(`Auto-emit invoice failed for tenant ${tenantId}: ${(err as Error).message}`);
        }

        break;
      }

      case 'PAYMENT_OVERDUE': {
        // Mark subscription as past due + set overdue timestamp
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PAST_DUE',
            overdueAt: subscription.overdueAt || new Date(), // Don't overwrite if already set
          },
        });
        this.logger.warn(`Subscription ${subscription.id} is PAST_DUE`);
        break;
      }

      case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': {
        // Mark subscription as past due
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PAST_DUE',
            overdueAt: subscription.overdueAt || new Date(),
          },
        });
        this.logger.warn(`Card refused for subscription ${subscription.id}`);
        break;
      }

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED': {
        this.logger.log(`Payment ${event} for subscription ${subscription.id}`);
        break;
      }

      default:
        this.logger.debug(`Unhandled payment event: ${event}`);
    }
  }

  /**
   * Handle Asaas webhook subscription events.
   */
  async handleSubscriptionWebhook(event: string, sub: any) {
    // Handle SUBSCRIPTION_CREATED: link asaasSubscriptionId to local subscription
    if (event === 'SUBSCRIPTION_CREATED' && sub.id && sub.customer) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { asaasCustomerId: sub.customer },
      });
      if (tenant) {
        // Find latest local subscription without asaasSubscriptionId
        const unlinked = await this.prisma.subscription.findFirst({
          where: { tenantId: tenant.id, asaasSubscriptionId: null },
          orderBy: { createdAt: 'desc' },
        });
        if (unlinked) {
          await this.prisma.subscription.update({
            where: { id: unlinked.id },
            data: { asaasSubscriptionId: sub.id },
          });
          this.logger.log(`Linked Asaas subscription ${sub.id} to local ${unlinked.id}`);
        }
      }
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { asaasSubscriptionId: sub.id },
      include: { tenant: true },
    });

    if (!subscription) {
      this.logger.warn(`No local subscription for asaas ${sub.id}`);
      return;
    }

    switch (event) {
      case 'SUBSCRIPTION_INACTIVATED':
      case 'SUBSCRIPTION_DELETED': {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });

        // Suspend tenant
        await this.tenantService.suspend(
          subscription.tenantId,
          event === 'SUBSCRIPTION_DELETED' ? 'Assinatura cancelada' : 'Assinatura inativada',
        );
        this.logger.log(`Subscription ${event} → tenant ${subscription.tenant.slug} suspended`);
        break;
      }

      default:
        this.logger.debug(`Subscription event: ${event}`);
    }
  }

  /**
   * Cancel a tenant's subscription.
   */
  async cancelTenantSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });

    if (!subscription) {
      throw new BadRequestException('Nenhuma assinatura ativa');
    }

    if (subscription.asaasSubscriptionId && this.asaas.isConfigured) {
      await this.asaas.cancelSubscription(subscription.asaasSubscriptionId);
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Purchase an add-on package for a tenant (direct payment, not checkout).
   */
  async purchaseAddOn(tenantId: string, addOnId: string, billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' = 'PIX') {
    const [addOn, subscription] = await Promise.all([
      this.prisma.addOn.findUnique({ where: { id: addOnId } }),
      this.prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
      }),
    ]);

    if (!addOn || !addOn.isActive) {
      throw new BadRequestException('Pacote não encontrado ou inativo');
    }
    if (!subscription) {
      throw new BadRequestException('Nenhuma assinatura ativa');
    }

    const now = new Date();
    const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const expiresAt = subscription.currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const purchase = await this.prisma.addOnPurchase.create({
      data: {
        subscriptionId: subscription.id,
        addOnId: addOn.id,
        osQuantity: addOn.osQuantity,
        userQuantity: addOn.userQuantity,
        technicianQuantity: addOn.technicianQuantity,
        aiMessageQuantity: addOn.aiMessageQuantity,
        priceCents: addOn.priceCents,
        periodMonth,
        expiresAt,
        status: 'PENDING',
      },
    });

    let asaasPayment: any = null;
    if (this.asaas.isConfigured && addOn.priceCents > 0) {
      const customerId = await this.ensureCustomer(tenantId);
      asaasPayment = await this.asaas.createPayment({
        customer: customerId,
        billingType,
        value: addOn.priceCents / 100,
        dueDate: this.formatDate(new Date()),
        description: `Add-on: ${addOn.name} - Tecnikos`,
        externalReference: purchase.id,
      });

      await this.prisma.addOnPurchase.update({
        where: { id: purchase.id },
        data: { asaasPaymentId: asaasPayment.id },
      });
    } else {
      // No payment gateway or free — mark as paid immediately
      await this.prisma.addOnPurchase.update({
        where: { id: purchase.id },
        data: { status: 'PAID' },
      });
      if (addOn.osQuantity > 0) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { extraOsPurchased: { increment: addOn.osQuantity } },
        });
      }

      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant) await this.creditAddOnToTenantCompany(tenant, addOn);
    }

    this.logger.log(`Add-on purchased: ${addOn.name} for tenant ${tenantId}`);
    return { purchase, asaasPayment };
  }

  /**
   * Confirm add-on payment (called from webhook).
   * Returns true if a purchase was found and confirmed.
   */
  async confirmAddOnPayment(asaasPaymentId: string): Promise<boolean> {
    const purchase = await this.prisma.addOnPurchase.findFirst({
      where: { asaasPaymentId, status: 'PENDING' },
      include: { subscription: { include: { tenant: true } }, addOn: true },
    });
    if (!purchase) return false;

    await this.prisma.addOnPurchase.update({
      where: { id: purchase.id },
      data: { status: 'PAID' },
    });
    if (purchase.osQuantity > 0) {
      await this.prisma.subscription.update({
        where: { id: purchase.subscriptionId },
        data: { extraOsPurchased: { increment: purchase.osQuantity } },
      });
    }

    await this.creditAddOnToTenantCompany(purchase.subscription.tenant, purchase);

    this.logger.log(`Add-on payment confirmed: ${purchase.id} (OS:${purchase.osQuantity} Users:${purchase.userQuantity} Tech:${purchase.technicianQuantity} AI:${purchase.aiMessageQuantity})`);
    return true;
  }

  /**
   * Confirm add-on payment by customer ID (checkout flow — no asaasPaymentId stored).
   */
  private async confirmAddOnByCustomer(asaasCustomerId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { asaasCustomerId },
    });
    if (!tenant) return false;

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
    });
    if (!subscription) return false;

    // Find oldest PENDING AddOnPurchase (FIFO)
    const purchase = await this.prisma.addOnPurchase.findFirst({
      where: { subscriptionId: subscription.id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!purchase) return false;

    await this.prisma.addOnPurchase.update({
      where: { id: purchase.id },
      data: { status: 'PAID' },
    });
    if (purchase.osQuantity > 0) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { extraOsPurchased: { increment: purchase.osQuantity } },
      });
    }

    await this.creditAddOnToTenantCompany(tenant, purchase);

    this.logger.log(`Add-on checkout confirmed by customer: ${purchase.id} for tenant ${tenant.slug}`);
    return true;
  }

  /** Credit add-on quantities to the tenant's Company record */
  private async creditAddOnToTenantCompany(
    tenant: { schemaName: string },
    addon: { osQuantity: number; userQuantity: number; technicianQuantity: number; aiMessageQuantity: number },
  ) {
    try {
      const client = this.tenantConn.getClient(tenant.schemaName);
      const company = await client.company.findFirst();
      if (!company) return;

      const data: Record<string, any> = {};
      if (addon.osQuantity > 0) data.maxOsPerMonth = { increment: addon.osQuantity };
      if (addon.userQuantity > 0) data.maxUsers = { increment: addon.userQuantity };
      if (addon.technicianQuantity > 0) data.maxTechnicians = { increment: addon.technicianQuantity };
      if (addon.aiMessageQuantity > 0) data.maxAiMessages = { increment: addon.aiMessageQuantity };

      if (Object.keys(data).length > 0) {
        await client.company.update({ where: { id: company.id }, data });
      }
    } catch (err) {
      this.logger.warn(`Failed to credit add-on to tenant company: ${(err as Error).message}`);
    }
  }

  // ─── INVOICES (NFS-e) ─────────────────────────────────

  /**
   * Get or create the singleton invoice config.
   */
  async getInvoiceConfig() {
    let config = await this.prisma.saasInvoiceConfig.findFirst();
    if (!config) {
      config = await this.prisma.saasInvoiceConfig.create({ data: {} });
    }
    return config;
  }

  /**
   * Update invoice config.
   */
  async updateInvoiceConfig(data: {
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
  }) {
    const config = await this.getInvoiceConfig();
    return this.prisma.saasInvoiceConfig.update({
      where: { id: config.id },
      data,
    });
  }

  /**
   * Issue an invoice (NFS-e) for a tenant via Asaas.
   */
  async issueInvoice(params: {
    tenantId: string;
    value?: number;             // Override value (BRL). If not set, uses plan price.
    serviceDescription?: string;
    observations?: string;
    effectiveDate?: string;     // YYYY-MM-DD. Defaults to today.
    taxes?: {
      iss?: number;
      cofins?: number;
      csll?: number;
      inss?: number;
      ir?: number;
      pis?: number;
      retainIss?: boolean;
    };
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      include: { plan: true },
    });
    if (!tenant) throw new BadRequestException('Tenant não encontrado');

    const config = await this.getInvoiceConfig();

    // Determine value
    const value = params.value ?? (tenant.plan ? tenant.plan.priceCents / 100 : 0);
    if (value <= 0) throw new BadRequestException('Valor da nota fiscal deve ser maior que zero');

    // Build service description from template
    const serviceDescription = params.serviceDescription || config.serviceDescriptionTemplate
      .replace('{empresa}', tenant.name)
      .replace('{plano}', tenant.plan?.name || 'N/A')
      .replace('{periodo}', this.formatDate(new Date()));

    const effectiveDate = params.effectiveDate || this.formatDate(new Date());

    // Tax values (use params override, then config defaults)
    const taxes = {
      iss: params.taxes?.iss ?? config.defaultIss,
      cofins: params.taxes?.cofins ?? config.defaultCofins,
      csll: params.taxes?.csll ?? config.defaultCsll,
      inss: params.taxes?.inss ?? config.defaultInss,
      ir: params.taxes?.ir ?? config.defaultIr,
      pis: params.taxes?.pis ?? config.defaultPis,
      retainIss: params.taxes?.retainIss ?? config.defaultRetainIss,
    };

    // Create local record first
    const invoice = await this.prisma.saasInvoice.create({
      data: {
        tenantId: tenant.id,
        value,
        serviceDescription,
        observations: params.observations || null,
        effectiveDate: new Date(effectiveDate),
        iss: taxes.iss,
        cofins: taxes.cofins,
        csll: taxes.csll,
        inss: taxes.inss,
        ir: taxes.ir,
        pis: taxes.pis,
        retainIss: taxes.retainIss,
        status: 'PENDING',
      },
    });

    // If Asaas is configured, emit via API
    if (this.asaas.isConfigured) {
      try {
        const customerId = await this.ensureCustomer(tenant.id);

        const asaasData: any = {
          customer: customerId,
          serviceDescription,
          observations: params.observations || undefined,
          value,
          effectiveDate,
          taxes: {
            retainIss: taxes.retainIss,
            iss: taxes.iss,
            cofins: taxes.cofins,
            csll: taxes.csll,
            inss: taxes.inss,
            ir: taxes.ir,
            pis: taxes.pis,
          },
        };

        // Municipal service (from config)
        if (config.municipalServiceId) {
          asaasData.municipalServiceId = config.municipalServiceId;
        } else if (config.municipalServiceCode) {
          asaasData.municipalServiceCode = config.municipalServiceCode;
        }
        if (config.municipalServiceName) {
          asaasData.municipalServiceName = config.municipalServiceName;
        }

        const asaasInvoice = await this.asaas.createInvoice(asaasData);

        await this.prisma.saasInvoice.update({
          where: { id: invoice.id },
          data: {
            asaasInvoiceId: asaasInvoice.id,
            asaasCustomerId: customerId,
            status: asaasInvoice.status || 'SCHEDULED',
          },
        });

        this.logger.log(`Invoice created in Asaas: ${asaasInvoice.id} for tenant ${tenant.slug}`);

        return { invoice: { ...invoice, asaasInvoiceId: asaasInvoice.id, status: asaasInvoice.status || 'SCHEDULED' }, asaasInvoice };
      } catch (err) {
        const errMsg = (err as Error).message;
        await this.prisma.saasInvoice.update({
          where: { id: invoice.id },
          data: { status: 'ERROR', errorMessage: errMsg },
        });
        this.logger.error(`Invoice creation failed for tenant ${tenant.slug}: ${errMsg}`);
        throw new BadRequestException(`Erro ao emitir NF no Asaas: ${errMsg}`);
      }
    } else {
      // Asaas not configured — keep as PENDING for manual processing
      this.logger.warn('Asaas not configured — invoice saved locally only');
      return { invoice, asaasInvoice: null };
    }
  }

  /**
   * List invoices for a specific tenant (or all tenants).
   */
  async listInvoices(filters?: {
    tenantId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(filters?.limit || 20, 100);
    const skip = ((filters?.page || 1) - 1) * take;
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;

    const [items, total] = await Promise.all([
      this.prisma.saasInvoice.findMany({
        where,
        include: { tenant: { select: { id: true, name: true, slug: true, cnpj: true, plan: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.saasInvoice.count({ where }),
    ]);

    return { items, total, page: filters?.page || 1, limit: take };
  }

  /**
   * Cancel an invoice.
   */
  async cancelInvoice(invoiceId: string) {
    const invoice = await this.prisma.saasInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new BadRequestException('Nota fiscal não encontrada');

    if (invoice.asaasInvoiceId && this.asaas.isConfigured) {
      try {
        await this.asaas.cancelInvoice(invoice.asaasInvoiceId);
      } catch (err) {
        this.logger.warn(`Failed to cancel invoice in Asaas: ${(err as Error).message}`);
      }
    }

    return this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELED' },
    });
  }

  /**
   * Handle invoice webhook events from Asaas.
   */
  async handleInvoiceWebhook(event: string, invoiceData: any) {
    if (!invoiceData?.id) return;

    const invoice = await this.prisma.saasInvoice.findFirst({
      where: { asaasInvoiceId: invoiceData.id },
    });

    if (!invoice) {
      this.logger.debug(`Invoice webhook for unknown invoice: ${invoiceData.id}`);
      return;
    }

    const updateData: any = {};

    switch (event) {
      case 'INVOICE_AUTHORIZED':
        updateData.status = 'AUTHORIZED';
        updateData.pdfUrl = invoiceData.pdfUrl || null;
        updateData.xmlUrl = invoiceData.xmlUrl || null;
        updateData.rpsNumber = invoiceData.rpsNumber || null;
        updateData.invoiceNumber = invoiceData.number || null;
        this.logger.log(`Invoice ${invoiceData.id} AUTHORIZED (NF ${invoiceData.number})`);
        break;

      case 'INVOICE_CANCELED':
        updateData.status = 'CANCELED';
        this.logger.log(`Invoice ${invoiceData.id} CANCELED`);
        break;

      case 'INVOICE_ERROR':
        updateData.status = 'ERROR';
        updateData.errorMessage = invoiceData.statusDescription || 'Erro na emissão';
        this.logger.error(`Invoice ${invoiceData.id} ERROR: ${invoiceData.statusDescription}`);
        break;

      case 'INVOICE_SYNCHRONIZED':
        updateData.status = 'SYNCHRONIZED';
        break;

      case 'INVOICE_PROCESSING_CANCELLATION':
        updateData.status = 'PROCESSING_CANCELLATION';
        break;

      case 'INVOICE_CANCELLATION_DENIED':
        updateData.status = 'CANCELLATION_DENIED';
        updateData.errorMessage = 'Cancelamento negado pela prefeitura';
        break;

      default:
        this.logger.debug(`Unhandled invoice event: ${event}`);
        return;
    }

    await this.prisma.saasInvoice.update({
      where: { id: invoice.id },
      data: updateData,
    });
  }

  // ─── BILLING STATUS ─────────────────────────────────────

  /**
   * Get billing status for a tenant (used by frontend banner).
   */
  async getBillingStatus(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { hasSubscription: false };
    }

    const now = new Date();
    const nextBilling = subscription.nextBillingDate;
    const daysUntilDue = Math.ceil(
      (nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let daysOverdue = 0;
    let hoursUntilBlock = 0;
    if (subscription.overdueAt) {
      const overdueMs = now.getTime() - subscription.overdueAt.getTime();
      daysOverdue = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
      const blockAtMs = subscription.overdueAt.getTime() + OVERDUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
      hoursUntilBlock = Math.max(0, Math.ceil((blockAtMs - now.getTime()) / (1000 * 60 * 60)));
    }

    // Get overdue payment URL when past due
    let overduePaymentUrl: string | null = null;
    if (subscription.status === 'PAST_DUE' && subscription.asaasSubscriptionId && this.asaas.isConfigured) {
      try {
        const payments = await this.asaas.listPayments({
          subscription: subscription.asaasSubscriptionId,
          status: 'OVERDUE',
          limit: 1,
        });
        if (payments.data?.[0]?.invoiceUrl) {
          overduePaymentUrl = payments.data[0].invoiceUrl;
        } else if (payments.data?.[0]?.id) {
          // Fallback: try PENDING status
          const pending = await this.asaas.listPayments({
            subscription: subscription.asaasSubscriptionId,
            status: 'PENDING',
            limit: 1,
          });
          if (pending.data?.[0]?.invoiceUrl) {
            overduePaymentUrl = pending.data[0].invoiceUrl;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to get overdue payment URL: ${(err as Error).message}`);
      }
    }

    // Pending downgrade info
    let pendingPlanName: string | null = null;
    if (subscription.pendingPlanId) {
      const pendingPlan = await this.prisma.plan.findUnique({
        where: { id: subscription.pendingPlanId },
      });
      pendingPlanName = pendingPlan?.name || null;
    }

    // Calculate actual current price (including promo discount)
    const isPromo = (subscription.promotionMonthsLeft || 0) > 0;
    const planPriceCents = subscription.originalValueCents || subscription.plan?.priceCents || 0;
    let currentValueCents = planPriceCents;
    if (isPromo && subscription.promotionId) {
      const promo = await this.prisma.promotion.findUnique({
        where: { id: subscription.promotionId },
      });
      if (promo) {
        if (promo.discountCents) {
          currentValueCents = Math.max(0, planPriceCents - promo.discountCents);
        } else if (promo.discountPercent) {
          currentValueCents = Math.round(planPriceCents * (1 - promo.discountPercent / 100));
        }
      }
    }

    return {
      hasSubscription: true,
      status: subscription.status,
      planId: subscription.planId,
      nextBillingDate: subscription.nextBillingDate,
      daysUntilDue,
      overdueAt: subscription.overdueAt,
      daysOverdue,
      hoursUntilBlock: subscription.status === 'PAST_DUE' ? hoursUntilBlock : null,
      isPromo,
      promoMonthsLeft: subscription.promotionMonthsLeft || 0,
      planName: subscription.plan?.name || '',
      valueBrl: currentValueCents / 100,
      planPriceCents, // Full plan price (for upgrade/downgrade comparison)
      overduePaymentUrl,
      // New billing cycle fields
      billingCycle: subscription.billingCycle || 'MONTHLY',
      creditBalanceCents: subscription.creditBalanceCents || 0,
      pendingPlanName,
      pendingPlanAt: subscription.pendingPlanAt,
    };
  }

  // ─── CRON: BLOCK OVERDUE TENANTS ──────────────────────────

  /**
   * Daily check at 7 AM: block tenants that are PAST_DUE for > 7 days.
   */
  @Cron('0 7 * * *')
  async checkOverdueSubscriptions() {
    this.logger.log('Running daily overdue check...');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - OVERDUE_GRACE_DAYS);

    const overdueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        overdueAt: { not: null, lte: cutoff },
      },
      include: { tenant: true },
    });

    for (const sub of overdueSubscriptions) {
      if (sub.tenant.status === 'BLOCKED') continue; // Already blocked

      try {
        await this.tenantService.block(
          sub.tenantId,
          `Pagamento não efetuado há mais de ${OVERDUE_GRACE_DAYS} dias`,
        );
        this.logger.warn(
          `Tenant ${sub.tenant.slug} BLOCKED — overdue since ${sub.overdueAt?.toISOString()}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to block tenant ${sub.tenant.slug}: ${(err as Error).message}`,
        );
      }
    }

    if (overdueSubscriptions.length > 0) {
      this.logger.log(
        `Overdue check complete: ${overdueSubscriptions.length} tenant(s) processed`,
      );
    }
  }

  // ─── CRON: EXPIRE ADD-ON PURCHASES ──────────────────────

  /**
   * Daily at 00:15 — find PAID AddOnPurchases that have expired, revert their
   * quantities from the tenant Company limits, and mark them EXPIRED.
   */
  @Cron('15 0 * * *')
  async expireAddOnPurchases() {
    this.logger.log('Running daily add-on expiration check...');

    const now = new Date();
    const expiredPurchases = await this.prisma.addOnPurchase.findMany({
      where: {
        status: 'PAID',
        expiresAt: { not: null, lte: now },
      },
      include: {
        subscription: { include: { tenant: true } },
      },
    });

    if (expiredPurchases.length === 0) return;

    let reverted = 0;
    for (const purchase of expiredPurchases) {
      try {
        // Revert quantities from tenant Company
        const tenant = purchase.subscription?.tenant;
        if (tenant?.schemaName) {
          await this.revertAddOnFromTenantCompany(tenant, purchase);
        }

        // Mark as EXPIRED
        await this.prisma.addOnPurchase.update({
          where: { id: purchase.id },
          data: { status: 'EXPIRED' },
        });

        reverted++;
        this.logger.log(
          `Add-on expired: ${purchase.id} (OS:${purchase.osQuantity} Users:${purchase.userQuantity} Tech:${purchase.technicianQuantity} AI:${purchase.aiMessageQuantity}) for tenant ${tenant?.slug}`,
        );
      } catch (err) {
        this.logger.error(`Failed to expire add-on ${purchase.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Add-on expiration check complete: ${reverted}/${expiredPurchases.length} reverted`);
  }

  /** Revert add-on quantities from the tenant's Company record (opposite of creditAddOnToTenantCompany) */
  private async revertAddOnFromTenantCompany(
    tenant: { schemaName: string },
    addon: { osQuantity: number; userQuantity: number; technicianQuantity: number; aiMessageQuantity: number },
  ) {
    try {
      const client = this.tenantConn.getClient(tenant.schemaName);
      const company = await client.company.findFirst();
      if (!company) return;

      const data: Record<string, any> = {};
      if (addon.osQuantity > 0) data.maxOsPerMonth = { decrement: addon.osQuantity };
      if (addon.userQuantity > 0) data.maxUsers = { decrement: addon.userQuantity };
      if (addon.technicianQuantity > 0) data.maxTechnicians = { decrement: addon.technicianQuantity };
      if (addon.aiMessageQuantity > 0) data.maxAiMessages = { decrement: addon.aiMessageQuantity };

      if (Object.keys(data).length > 0) {
        await client.company.update({ where: { id: company.id }, data });

        // Safety: ensure limits never go below plan baseline (could happen if admin changed plan)
        const updated = await client.company.findFirst();
        if (updated) {
          const fixes: Record<string, number> = {};
          if ((updated.maxOsPerMonth || 0) < 0) fixes.maxOsPerMonth = 0;
          if ((updated.maxUsers || 0) < 0) fixes.maxUsers = 0;
          if ((updated.maxTechnicians || 0) < 0) fixes.maxTechnicians = 0;
          if ((updated.maxAiMessages || 0) < 0) fixes.maxAiMessages = 0;
          if (Object.keys(fixes).length > 0) {
            await client.company.update({ where: { id: updated.id }, data: fixes });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to revert add-on from tenant company: ${(err as Error).message}`);
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
