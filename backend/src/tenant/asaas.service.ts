import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from './tenant.service';
import { AsaasProvider } from './asaas.provider';

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
    let valueCents: number;
    if (isYearly && plan.priceYearlyCents) {
      valueCents = plan.priceYearlyCents;
    } else {
      valueCents = plan.priceCents;
    }

    // Apply promotion discount to first payment
    let discount: { value: number; type: 'FIXED' | 'PERCENTAGE'; dueDateLimitDays: number } | undefined;
    let promoId: string | undefined;
    let promoDuration = 0;

    if (params.promoCode) {
      const promo = await this.prisma.promotion.findUnique({
        where: { code: params.promoCode },
      });
      if (promo && promo.isActive && !promo.skipPayment) {
        if (promo.discountPercent) {
          discount = { value: promo.discountPercent, type: 'PERCENTAGE', dueDateLimitDays: 0 };
        } else if (promo.discountCents) {
          discount = { value: promo.discountCents / 100, type: 'FIXED', dueDateLimitDays: 0 };
        }
        promoId = promo.id;
        promoDuration = promo.durationMonths;
      }
    }

    const value = valueCents / 100; // Asaas uses BRL (not cents)
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

    if (discount) subscriptionData.discount = discount;
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
        promotionId: promoId,
        promotionMonthsLeft: promoDuration || null,
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
   * Handle Asaas webhook payment events.
   */
  async handlePaymentWebhook(event: string, payment: any) {
    const subscriptionId = payment.subscription;
    if (!subscriptionId) {
      this.logger.debug(`Payment webhook ${event} without subscription — skipping`);
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
        // Activate tenant if not already active
        const tenant = subscription.tenant;
        if (tenant.status !== 'ACTIVE') {
          await this.tenantService.activate(tenantId);
          this.logger.log(`Tenant ${tenant.slug} activated via payment`);
        }

        // Update subscription period
        const nextDue = new Date(payment.dueDate || payment.paymentDate);
        const nextEnd = new Date(nextDue);
        nextEnd.setMonth(nextEnd.getMonth() + 1);

        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(payment.paymentDate || payment.dueDate),
            currentPeriodEnd: nextEnd,
            nextBillingDate: nextEnd,
          },
        });
        break;
      }

      case 'PAYMENT_OVERDUE': {
        // Mark subscription as past due
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'PAST_DUE' },
        });
        this.logger.warn(`Subscription ${subscription.id} is PAST_DUE`);
        break;
      }

      case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': {
        // Mark subscription as past due
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'PAST_DUE' },
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

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
