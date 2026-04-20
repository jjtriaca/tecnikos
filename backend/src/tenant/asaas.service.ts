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
 *
 * ════════════════════════════════════════════════════════════════════════════
 *   REGRAS ABSOLUTAS — NUNCA VIOLAR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. NADA muda no sistema ate o webhook PAYMENT_CONFIRMED chegar.
 *    - Signup: Subscription=PENDING, Tenant=PENDING_PAYMENT. So ativa no webhook.
 *    - Upgrade: pendingPlanId salvo. Plano/limites so mudam no webhook.
 *    - Add-on: AddOnPurchase=PENDING. Limites creditados so no webhook.
 *    - Downgrade sem cobranca: agenda via pendingPlanId pro proximo ciclo.
 *    - Excecao: credito pro-rata 100% -> aplicar imediatamente.
 *
 * 2. Asaas e a fonte de verdade de:
 *    - Proxima cobranca (nextBillingDate) — sincronizado via webhook
 *    - Status financeiro (PAID, OVERDUE, etc.)
 *    - Valor a cobrar
 *    Local nao "chuta" esses campos; espera o webhook.
 *
 * 3. Idempotencia: webhooks podem chegar em duplicata ou fora de ordem.
 *    - Ex: PAYMENT_CONFIRMED pode chegar 2x (rede instavel). Codigo deve lidar.
 *    - Activation usa updateMany + where status!=ACTIVE pra evitar double-onboard.
 *
 * ════════════════════════════════════════════════════════════════════════════
 *   ARQUITETURA — CICLO DE VIDA DE TENANT/SUBSCRIPTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tenant status:   PENDING_VERIFICATION -> PENDING_PAYMENT -> ACTIVE -> BLOCKED
 * Subscription:    PENDING -> ACTIVE (<-> PAST_DUE) -> SUSPENDED/CANCELLED
 *
 * Fluxo normal:
 *   signup -> Asaas cria customer + subscription -> webhook cobra boleto/pix
 *   -> cliente paga -> webhook PAYMENT_CONFIRMED -> tenant ACTIVE
 *
 * Fluxo de atraso:
 *   vencimento passa -> webhook PAYMENT_OVERDUE -> sub=PAST_DUE, overdueAt=hoje
 *   -> 7 dias de graca (cliente ainda usa o sistema com warning "Atrasado")
 *   -> cron checkOverdueSubscriptions (diario 07h) -> tenant BLOCKED, sub SUSPENDED
 *   -> cliente paga -> webhook reativa tenant + sub ACTIVE
 *
 * ════════════════════════════════════════════════════════════════════════════
 *   CRONS (@Cron decorators)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * - checkOverdueSubscriptions (07:00 diario): bloqueia tenants PAST_DUE > 7 dias
 * - applyPendingDowngrades (00:30 diario): aplica downgrades agendados
 * - (ver decorators @Cron no arquivo pra lista completa)
 *
 * ════════════════════════════════════════════════════════════════════════════
 *   PROBLEMAS CONHECIDOS / MELHORIAS FUTURAS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * [P1] Ciclo de consumo trava em PAST_DUE
 *   Situacao: subscription.currentPeriodEnd e definido no webhook PAYMENT_CONFIRMED
 *   (linha ~940). Enquanto cliente nao paga, currentPeriodEnd fica congelado no ciclo
 *   vencido. service-order.service.ts conta OS nesse intervalo -> quota trava em
 *   X/X ate pagar. Teoricamente o cliente deveria poder continuar criando OS durante
 *   os 7 dias de graca (ciclo novo deve avancar).
 *
 *   Solucao proposta (NAO implementada, requer teste em sandbox Asaas):
 *   - Criar @Cron('0 1 * * *') advanceBillingCycles():
 *       Para cada sub ACTIVE/PAST_DUE com currentPeriodEnd < now:
 *         Avanca currentPeriodStart = currentPeriodEnd
 *         Avanca currentPeriodEnd = currentPeriodEnd + 1 mes (anchor-based)
 *   - Webhook PAYMENT_CONFIRMED deixa de alterar currentPeriodStart/End (cron cuida).
 *     Continua alterando: status, overdueAt, nextBillingDate.
 *   - Garantir: cron e idempotente (nao avanca 2x no mesmo dia).
 *   - Validar: pagamento adiantado/no-prazo/atrasado preserva anchor (dia fixo do
 *     vencimento, ex: sempre dia 16).
 *
 * [P2] SLS como tenant dono
 *   Hoje SLS (empresa do dono da plataforma) e tratado como tenant regular,
 *   precisa pagar a propria assinatura. Opcoes:
 *   a) Criar plano "INTERNAL" R$ 0 com limites altos; migrar SLS pra la.
 *   b) Flag isMaster ja existe mas so pula KYC — poderia ser estendida pra pular
 *      cobranca tambem (verificar impacto em todos os checks de quota).
 *
 * [P3] Divergencia local x Asaas
 *   Sem sync periodico de status com Asaas. Se webhook falha (rede, config),
 *   status local pode ficar desatualizado indefinidamente. Solucao: cron semanal
 *   que reconcilia status local com Asaas API pra todas subs ativas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 *   ANTES DE MEXER AQUI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. Ler esta secao inteira e o CLAUDE.md ("REGRA ABSOLUTA: Pagamento Asaas").
 * 2. Testar em sandbox Asaas, NUNCA direto em prod. Asaas sandbox e gratis.
 * 3. Um bug aqui pode: ativar tenant sem pagar, bloquear tenant que pagou,
 *    duplicar cobranca, inflar/bloquear quota. Todos critico pro negocio.
 * 4. Webhooks sao re-entrantes: codigo deve ser idempotente.
 * 5. Nunca remover logs — sao a unica auditoria de eventos Asaas.
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

    // Apply promotion — charge ALL promo months upfront (e.g., 6 × R$15 = R$90)
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

        // Calculate monthly discounted value
        let monthlyDiscountedCents = fullValueCents;
        if (promo.discountPercent) {
          monthlyDiscountedCents = Math.round(fullValueCents * (1 - promo.discountPercent / 100));
        } else if (promo.discountCents) {
          monthlyDiscountedCents = Math.max(0, fullValueCents - promo.discountCents);
        }

        // Charge all promo months upfront in the first payment
        if (promoDuration > 0) {
          subscriptionValueCents = monthlyDiscountedCents * promoDuration;
        } else {
          subscriptionValueCents = monthlyDiscountedCents;
        }

        this.logger.log(
          `Promo "${promo.code}" applied: R$${(subscriptionValueCents / 100).toFixed(2)} upfront ` +
          `(${promoDuration} months × R$${(monthlyDiscountedCents / 100).toFixed(2)}, full: R$${(fullValueCents / 100).toFixed(2)}/mo)`,
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
    if (promoDuration > 0) {
      // Upfront promo: period covers all promo months
      periodEnd.setMonth(periodEnd.getMonth() + promoDuration);
    } else if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Subscription starts as PENDING — only becomes ACTIVE on PAYMENT_CONFIRMED webhook
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: params.tenantId,
        planId: plan.id,
        status: 'PENDING',
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

    // Apply promotion — charge ALL promo months upfront (e.g., 6 × R$15 = R$90)
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

        // Calculate monthly discounted value
        let monthlyDiscountedCents = fullValueCents;
        if (promo.discountPercent) {
          monthlyDiscountedCents = Math.round(fullValueCents * (1 - promo.discountPercent / 100));
        } else if (promo.discountCents) {
          monthlyDiscountedCents = Math.max(0, fullValueCents - promo.discountCents);
        }

        // Charge all promo months upfront in the first payment
        if (promoDuration > 0) {
          subscriptionValueCents = monthlyDiscountedCents * promoDuration;
        } else {
          subscriptionValueCents = monthlyDiscountedCents;
        }

        this.logger.log(
          `Promo "${promo.code}" applied: R$${(subscriptionValueCents / 100).toFixed(2)} upfront ` +
          `(${promoDuration} months × R$${(monthlyDiscountedCents / 100).toFixed(2)}, full: R$${(fullValueCents / 100).toFixed(2)}/mo)`,
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
    if (promoDuration > 0) {
      // Upfront promo: period covers all promo months
      periodEnd.setMonth(periodEnd.getMonth() + promoDuration);
    } else if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Subscription starts as PENDING — only becomes ACTIVE on PAYMENT_CONFIRMED webhook
    await this.prisma.subscription.create({
      data: {
        tenantId: params.tenantId,
        planId: plan.id,
        status: 'PENDING',
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
    if (addOn.nfseImportQuantity > 0) descParts.push(`+${addOn.nfseImportQuantity} import. NFS-e`);
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
        nfseImportQuantity: addOn.nfseImportQuantity,
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

    // Create a one-time payment (UNDEFINED = customer chooses PIX/boleto/cartão)
    const payment = await this.asaas.createPayment({
      customer: customerId,
      billingType: 'UNDEFINED',
      value: addOn.priceCents / 100,
      dueDate: this.formatDate(new Date()),
      description: `Add-on: ${addOn.name} — ${descStr} — Tecnikos`,
      externalReference: `addon_${purchase.id}`,
    });

    // Build checkout URL from payment
    let checkoutUrl = payment.invoiceUrl || payment.bankSlipUrl || null;
    if (!checkoutUrl && payment.id) {
      const isSandbox = (this.asaas as any).baseUrl?.includes('sandbox');
      const host = isSandbox ? 'https://sandbox.asaas.com' : 'https://www.asaas.com';
      checkoutUrl = `${host}/i/${payment.id}`;
    }

    this.logger.log(`Add-on payment created: ${addOn.name} (${descStr}) for tenant ${tenantId}, purchase ${purchase.id}`);
    return { checkoutUrl, purchase };
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

    // ── Calculate pro-rata credit (preview only, applied on payment confirmation) ──
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

    const newValueCents = isYearly && newPlan.priceYearlyCents
      ? newPlan.priceYearlyCents
      : newPlan.priceCents;

    const firstInvoiceDiscount = Math.min(totalCredit, newValueCents);

    this.logger.log(
      `Upgrade checkout: ${currentPlan?.name} → ${newPlan.name}, ` +
      `${remainingDays}/${totalDays} days remaining, ` +
      `credit R$${(creditCents / 100).toFixed(2)} + existing R$${(existingCredit / 100).toFixed(2)} ` +
      `= total R$${(totalCredit / 100).toFixed(2)}, discount R$${(firstInvoiceDiscount / 100).toFixed(2)}`,
    );

    // ── ONLY create Asaas payment — do NOT change plan/subscription/limits yet ──
    // Everything is applied in applyUpgrade() when PAYMENT_CONFIRMED webhook fires.

    // Save upgrade intent on the current subscription (pendingPlanId)
    await this.prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        pendingPlanId: newPlan.id,
        pendingPlanAt: now, // Marks when upgrade was requested
      },
    });

    // Create a one-time payment (NOT a subscription) for the upgrade
    const customerId = await this.ensureCustomer(tenantId);
    const chargeValue = (newValueCents - firstInvoiceDiscount) / 100;

    let checkoutUrl: string | null = null;

    if (chargeValue > 0 && this.asaas.isConfigured) {
      // Create a single payment with externalReference linking to the upgrade
      const payment = await this.asaas.createPayment({
        customer: customerId,
        billingType: 'UNDEFINED',
        value: chargeValue,
        dueDate: this.formatDate(now),
        description: `Upgrade: ${currentPlan?.name} → ${newPlan.name} - Tecnikos`,
        externalReference: `upgrade_${currentSub.id}_${newPlan.id}`,
      });

      checkoutUrl = payment.invoiceUrl || payment.bankSlipUrl || null;

      // Fallback URL
      if (!checkoutUrl && payment.id) {
        const isSandbox = (this.asaas as any).baseUrl?.includes('sandbox');
        const host = isSandbox ? 'https://sandbox.asaas.com' : 'https://www.asaas.com';
        checkoutUrl = `${host}/i/${payment.id}`;
      }
    } else if (chargeValue <= 0) {
      // Credit covers the entire upgrade — apply immediately
      await this.applyUpgrade(currentSub.id, newPlan.id, tenantId, totalCredit, newValueCents);
      return { checkoutUrl: null, creditApplied: firstInvoiceDiscount / 100 };
    }

    this.logger.log(
      `Upgrade checkout created: ${currentPlan?.name} → ${newPlan.name} for tenant ${tenantId}. ` +
      `Charge: R$${chargeValue.toFixed(2)}, checkout: ${checkoutUrl}`,
    );
    return { checkoutUrl, creditApplied: firstInvoiceDiscount / 100 };
  }

  /**
   * Apply an upgrade after payment confirmation.
   * Called from webhook handler when payment with upgrade_ reference is confirmed.
   */
  async applyUpgrade(
    currentSubId: string,
    newPlanId: string,
    tenantId: string,
    totalCreditCents: number,
    newValueCents: number,
  ) {
    const [tenant, newPlan, currentSub] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.plan.findUnique({ where: { id: newPlanId } }),
      this.prisma.subscription.findUnique({ where: { id: currentSubId } }),
    ]);

    if (!tenant || !newPlan || !currentSub) {
      this.logger.error(`applyUpgrade: missing data — tenant=${!!tenant}, plan=${!!newPlan}, sub=${!!currentSub}`);
      return;
    }

    const now = new Date();
    const billingCycle = currentSub.billingCycle || 'MONTHLY';
    const isYearly = billingCycle === 'ANNUAL';

    // Cancel old Asaas subscription
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
      data: { status: 'CANCELLED', cancelledAt: now, pendingPlanId: null, pendingPlanAt: null },
    });

    // Create new subscription
    const newPeriodEnd = new Date(now);
    if (isYearly) {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    } else {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    }

    const remainingCredit = Math.max(0, totalCreditCents - newValueCents);

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
        creditBalanceCents: remainingCredit,
      },
    });

    // Create new Asaas subscription for recurring billing going forward
    if (this.asaas.isConfigured) {
      try {
        const customerId = await this.ensureCustomer(tenantId);
        const recurringValue = (isYearly && newPlan.priceYearlyCents ? newPlan.priceYearlyCents : newPlan.priceCents) / 100;
        const asaasSub = await this.asaas.createSubscription({
          customer: customerId,
          billingType: 'UNDEFINED',
          value: recurringValue,
          nextDueDate: this.formatDate(newPeriodEnd),
          cycle: isYearly ? 'ANNUAL' : 'MONTHLY',
          description: `${newPlan.name} - Tecnikos`,
          externalReference: tenantId,
        });
        await this.prisma.subscription.update({
          where: { id: newSub.id },
          data: { asaasSubscriptionId: asaasSub.id },
        });
      } catch (err) {
        this.logger.error(`Failed to create recurring Asaas subscription after upgrade: ${(err as Error).message}`);
      }
    }

    // Update tenant plan + limits (snapshot — grandfather)
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: newPlan.id,
        maxUsers: newPlan.maxUsers,
        maxOsPerMonth: newPlan.maxOsPerMonth,
        maxTechnicians: newPlan.maxTechnicians,
        maxAiMessages: newPlan.maxAiMessages,
        maxNfseImports: newPlan.maxNfseImports,
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
            maxNfseImports: newPlan.maxNfseImports,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to update Company limits on upgrade: ${(err as Error).message}`);
    }

    this.logger.log(`Upgrade applied: tenant ${tenantId} → plan ${newPlan.name}`);
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

    // Handle standalone payments (add-on purchases + upgrades)
    if (!subscriptionId) {
      if ((event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') && payment.id) {
        let confirmed = false;

        // 0. Check for upgrade payment (externalReference = upgrade_{subId}_{planId})
        if (payment.externalReference && String(payment.externalReference).startsWith('upgrade_')) {
          const parts = String(payment.externalReference).split('_');
          // Format: upgrade_{subscriptionId}_{planId}
          const currentSubId = parts[1];
          const newPlanId = parts[2];
          if (currentSubId && newPlanId) {
            const sub = await this.prisma.subscription.findUnique({ where: { id: currentSubId } });
            if (sub) {
              // Calculate credit at time of payment
              const now = new Date();
              const totalDays = Math.max(1, Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)));
              const remainingDays = Math.max(0, Math.round((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
              const billingCycle = sub.billingCycle || 'MONTHLY';
              const isYearly = billingCycle === 'ANNUAL';
              const currentPlan = await this.prisma.plan.findUnique({ where: { id: sub.planId } });
              const currentValueCents = isYearly && currentPlan?.priceYearlyCents ? currentPlan.priceYearlyCents : (currentPlan?.priceCents || 0);
              const creditCents = Math.round((remainingDays / totalDays) * currentValueCents);
              const totalCredit = (sub.creditBalanceCents || 0) + creditCents;
              const newPlan = await this.prisma.plan.findUnique({ where: { id: newPlanId } });
              const newValueCents = isYearly && newPlan?.priceYearlyCents ? newPlan.priceYearlyCents : (newPlan?.priceCents || 0);

              await this.applyUpgrade(currentSubId, newPlanId, sub.tenantId, totalCredit, newValueCents);
              this.logger.log(`Upgrade payment confirmed: sub ${currentSubId} → plan ${newPlanId}`);
            }
          }
          return;
        }

        // 1. Try by externalReference (checkout flow — most reliable)
        if (payment.externalReference && String(payment.externalReference).startsWith('addon_')) {
          const purchaseId = String(payment.externalReference).replace('addon_', '');
          confirmed = await this.confirmAddOnById(purchaseId);
        }

        // 2. Try by asaasPaymentId (direct payment flow)
        if (!confirmed) {
          confirmed = await this.confirmAddOnPayment(payment.id);
        }

        // 3. Fallback: find by customer (FIFO — last resort)
        if (!confirmed && payment.customer) {
          confirmed = await this.confirmAddOnByCustomer(payment.customer);
        }

        if (!confirmed) {
          this.logger.warn(`Add-on payment webhook: could not confirm payment ${payment.id} for customer ${payment.customer} — no PENDING purchase found`);
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
        // Use atomic update to prevent race condition on concurrent webhooks
        const tenant = subscription.tenant;
        if (tenant.status !== 'ACTIVE') {
          const activated = await this.prisma.tenant.updateMany({
            where: { id: tenantId, status: { not: 'ACTIVE' } },
            data: { status: 'ACTIVE' },
          });
          if (activated.count > 0) {
            // Only the first concurrent webhook proceeds here
            await this.tenantService.activate(tenantId);
            await this.onboarding.onboard(tenantId, tenant.passwordHash || undefined);
            this.logger.log(`Tenant ${tenant.slug} activated + onboarded via payment`);

            // Send welcome email now that payment is confirmed
            this.onboarding.sendWelcomeEmailForTenant(tenantId).catch((err) => {
              this.logger.error(`Failed to send welcome email: ${(err as Error).message}`);
            });
          } else {
            this.logger.log(`Tenant ${tenant.slug} already activated by concurrent webhook — skipping`);
          }
        }

        // Update subscription period + clear overdue
        // ATENCAO (design atual): currentPeriodStart usa payment.paymentDate.
        // Se cliente paga ATRASADO (ex: vence 16/04, paga 24/04), start=24/04, end=16/05
        // — cliente "consome" o periodo reduzido (23 dias ao inves de 30), mas o anchor
        // (16) e preservado via dueDate em nextEnd. E consistente com o dueDate do Asaas.
        //
        // PROBLEMA CONHECIDO: enquanto subscription fica PAST_DUE (nao pago), o
        // currentPeriodEnd NAO avanca — getBillingPeriod() em service-order.service.ts
        // continua contando OS do ciclo vencido. Cliente trava em X/X no medidor de cota.
        //
        // MELHORIA FUTURA (nao trivial, requer teste completo em sandbox Asaas):
        //   1. Criar cron @Cron('0 1 * * *') advanceBillingCycles() que avanca
        //      currentPeriodEnd anchor-based (mantem o dia do vencimento) mesmo durante
        //      PAST_DUE. Assim a quota zera no proximo anchor independente de pagamento.
        //   2. Webhook deixa de alterar currentPeriodStart/End (cron cuida). Webhook
        //      altera apenas: status, overdueAt, nextBillingDate.
        //   3. Garantir idempotencia (subscription.lastCycleAdvancedAt) pra evitar
        //      avancos duplicados se cron rodar multiplas vezes.
        //   4. Validar que Asaas nao desalinha: Asaas e a fonte de verdade de nextBillingDate
        //      — local deve seguir Asaas, nao o contrario.
        //   5. Teste: simular pagamentos adiantado/no-prazo/atrasado em sandbox antes
        //      de mexer em prod. UN bug aqui pode inflar quota ou travar tenants.
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

        // ── Apply stored credit balance as discount on next invoice ──
        if (subscription.creditBalanceCents > 0 && subscription.asaasSubscriptionId) {
          try {
            const creditValue = Math.min(subscription.creditBalanceCents, payment.value ? Math.round(payment.value * 100) : subscription.creditBalanceCents);
            await this.asaas.updateSubscription(subscription.asaasSubscriptionId, {
              discount: {
                value: creditValue / 100,
                type: 'FIXED',
                dueDateLimitDays: 0, // Only next invoice
              },
            });
            updateData.creditBalanceCents = subscription.creditBalanceCents - creditValue;
            this.logger.log(`Applied R$${(creditValue / 100).toFixed(2)} credit to next invoice (remaining: R$${((subscription.creditBalanceCents - creditValue) / 100).toFixed(2)})`);
          } catch (err) {
            this.logger.warn(`Failed to apply credit discount: ${(err as Error).message}`);
          }
        }

        // Handle promotion — upfront model: all promo months paid in first payment
        // On first payment, transition Asaas to full price and set period to cover promo duration
        if (subscription.promotionMonthsLeft && subscription.promotionMonthsLeft > 0) {
          const promoDuration = subscription.promotionMonthsLeft;

          // All promo months are paid upfront — mark as fully consumed
          updateData.promotionMonthsLeft = 0;

          // Set period to cover all promo months from payment date
          const promoEnd = new Date(payment.paymentDate || payment.dueDate);
          promoEnd.setMonth(promoEnd.getMonth() + promoDuration);
          updateData.currentPeriodEnd = promoEnd;
          updateData.nextBillingDate = promoEnd;

          // Update Asaas subscription to full price + next due date after promo period
          if (subscription.originalValueCents && subscription.asaasSubscriptionId) {
            const fullValue = subscription.originalValueCents / 100;
            try {
              await this.asaas.updateSubscription(subscription.asaasSubscriptionId, {
                value: fullValue,
                nextDueDate: this.formatDate(promoEnd),
                updatePendingPayments: false,
              });
              this.logger.log(
                `Promo upfront paid for subscription ${subscription.id}: ` +
                `${promoDuration} months covered, next billing at R$${fullValue.toFixed(2)} on ${promoEnd.toISOString().split('T')[0]}`,
              );
            } catch (err) {
              this.logger.error(
                `Failed to update Asaas subscription after promo upfront: ${(err as Error).message}`,
              );
            }
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
                maxNfseImports: pendingPlan.maxNfseImports,
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
                    maxNfseImports: pendingPlan.maxNfseImports,
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

        // Auto-emit invoice if configured (with deduplication: skip if invoice already emitted this month)
        try {
          const config = await this.prisma.saasInvoiceConfig.findFirst();
          if (config?.autoEmitOnPayment) {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const existing = await this.prisma.saasInvoice.findFirst({
              where: { tenantId, createdAt: { gte: monthStart } },
            });
            if (!existing) {
              await this.issueInvoice({ tenantId });
              this.logger.log(`Auto-emitted invoice for tenant ${tenantId} on payment confirmation`);
            } else {
              this.logger.log(`Skipping auto-emit for tenant ${tenantId} — invoice already exists this month`);
            }
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

        // Only suspend tenant if there is NO other ACTIVE subscription
        // (upgrade flow cancels old subscription but creates a new ACTIVE one)
        const otherActive = await this.prisma.subscription.findFirst({
          where: {
            tenantId: subscription.tenantId,
            status: 'ACTIVE',
            id: { not: subscription.id },
          },
        });

        if (otherActive) {
          this.logger.log(
            `Subscription ${event} for ${subscription.tenant.slug}, but another ACTIVE subscription exists (${otherActive.id}) — NOT suspending`,
          );
        } else {
          await this.tenantService.suspend(
            subscription.tenantId,
            event === 'SUBSCRIPTION_DELETED' ? 'Assinatura cancelada' : 'Assinatura inativada',
          );
          this.logger.log(`Subscription ${event} → tenant ${subscription.tenant.slug} suspended`);
        }
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
        nfseImportQuantity: addOn.nfseImportQuantity,
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
   * Confirm add-on by purchase ID (from externalReference in checkout flow).
   * Most reliable method — directly links checkout to purchase.
   */
  async confirmAddOnById(purchaseId: string): Promise<boolean> {
    const purchase = await this.prisma.addOnPurchase.findFirst({
      where: { id: purchaseId, status: 'PENDING' },
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

    this.logger.log(`Add-on confirmed by ID: ${purchase.id} (OS:${purchase.osQuantity} Users:${purchase.userQuantity} Tech:${purchase.technicianQuantity} AI:${purchase.aiMessageQuantity})`);
    return true;
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
    addon: { osQuantity: number; userQuantity: number; technicianQuantity: number; aiMessageQuantity: number; nfseImportQuantity?: number },
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
      if (addon.nfseImportQuantity && addon.nfseImportQuantity > 0) data.maxNfseImports = { increment: addon.nfseImportQuantity };

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

    // Build service description from template (null-safe)
    const template = config.serviceDescriptionTemplate || 'Serviço de gestão de campo - {empresa} - Plano {plano} - {periodo}';
    const serviceDescription = params.serviceDescription || template
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
    // Promo detection: promotionMonthsLeft > 0 (monthly mode) OR promotionId set + upfront paid (monthsLeft=0 but still in promo period)
    const hasPromoMonths = (subscription.promotionMonthsLeft || 0) > 0;
    const isUpfrontPromo = !hasPromoMonths && !!subscription.promotionId && !!subscription.originalValueCents;
    const isPromo = hasPromoMonths || isUpfrontPromo;

    // Calculate promo months remaining for display (upfront: use period end)
    let promoMonthsLeft = subscription.promotionMonthsLeft || 0;
    if (isUpfrontPromo) {
      // Upfront promo: months left = months until next billing (when full price kicks in)
      const monthsRemaining = Math.max(0, Math.ceil(
        (subscription.nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30),
      ));
      promoMonthsLeft = monthsRemaining;
    }

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
      promoMonthsLeft,
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
        // Mark subscription as SUSPENDED — prevents re-processing by this cron
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'SUSPENDED' },
        });
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

  // ─── CRON: ADVANCE BILLING CYCLES (anchor-based) ─────────

  /**
   * Daily at 01:00 — avanca currentPeriodStart/End de subs ACTIVE/PAST_DUE cujo
   * currentPeriodEnd ja passou. Anchor-based: preserva o dia do vencimento
   * (ex: sempre dia 16), ajustando automaticamente se o mes seguinte nao tem
   * esse dia (ex: 31/01 -> 28/02).
   *
   * POR QUE: sem isso, um tenant PAST_DUE fica com currentPeriodEnd congelado
   * no ciclo vencido. service-order.service.ts conta OS dentro desse intervalo
   * e trava a quota ate o webhook PAYMENT_CONFIRMED avancar manualmente. O cron
   * garante que a quota zera no proximo anchor mesmo sem pagamento (cliente
   * ainda pode criar OS durante os 7 dias de graca ate o bloqueio automatico).
   *
   * IDEMPOTENCIA: filtro where currentPeriodEnd < now — se ja foi avancado,
   * currentPeriodEnd fica no futuro e o registro nao retorna na busca.
   *
   * CONVIVENCIA COM WEBHOOK: se cliente paga atrasado, webhook PAYMENT_CONFIRMED
   * pode sobrescrever currentPeriodStart/End (com data do pagamento). Isso e
   * aceitavel — anchor (dueDate) e preservado via nextEnd no webhook.
   *
   * EXECUCAO MANUAL: tambem exposto via endpoint admin POST /admin/cron/advance-billing-cycles
   * pra dry-run e testes.
   */
  @Cron('0 1 * * *')
  async advanceBillingCycles(): Promise<{ advanced: number; errors: number }> {
    this.logger.log('Running daily billing cycle advance...');

    const now = new Date();
    const expiredSubs = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        currentPeriodEnd: { lt: now },
      },
      include: { tenant: { select: { slug: true } } },
    });

    let advanced = 0;
    let errors = 0;

    for (const sub of expiredSubs) {
      try {
        const oldEnd = sub.currentPeriodEnd;
        const anchorDay = oldEnd.getDate();
        const newStart = oldEnd;

        // Avanca 1 mes. Se mes novo nao tem o anchorDay (ex: 31/01 -> 28/02),
        // setDate() faz overflow (31/02 -> 03/03), entao precisa normalizar.
        const newEnd = new Date(oldEnd);
        newEnd.setMonth(newEnd.getMonth() + 1);
        if (newEnd.getDate() !== anchorDay) {
          // Mes novo nao tem o anchorDay: usa ultimo dia do mes alvo
          newEnd.setDate(0);
        }

        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodStart: newStart,
            currentPeriodEnd: newEnd,
          },
        });
        advanced++;
        this.logger.log(
          `Cycle advanced for tenant ${sub.tenant.slug}: ` +
          `${oldEnd.toISOString().split('T')[0]} -> ${newEnd.toISOString().split('T')[0]}`,
        );
      } catch (err) {
        errors++;
        this.logger.error(
          `Failed to advance cycle for tenant ${sub.tenant.slug}: ${(err as Error).message}`,
        );
      }
    }

    if (expiredSubs.length > 0) {
      this.logger.log(
        `Billing cycle advance complete: ${advanced} advanced, ${errors} errors (total ${expiredSubs.length})`,
      );
    }
    return { advanced, errors };
  }

  // ─── CRON: APPLY PENDING DOWNGRADES ──────────────────────

  /**
   * Daily at 00:30 — apply pending downgrades that are past their scheduled date.
   * This ensures downgrades happen even if the payment webhook didn't fire.
   */
  @Cron('30 0 * * *')
  async applyPendingDowngrades() {
    this.logger.log('Running daily pending downgrade check...');

    const now = new Date();
    const pendingSubs = await this.prisma.subscription.findMany({
      where: {
        pendingPlanId: { not: null },
        pendingPlanAt: { not: null, lte: now },
        status: { in: ['ACTIVE', 'PAST_DUE'] },
      },
      include: { tenant: true },
    });

    if (pendingSubs.length === 0) return;

    let applied = 0;
    for (const sub of pendingSubs) {
      try {
        const pendingPlan = await this.prisma.plan.findUnique({ where: { id: sub.pendingPlanId! } });
        if (!pendingPlan) {
          // Plan no longer exists — clear pending
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { pendingPlanId: null, pendingPlanAt: null },
          });
          continue;
        }

        // Apply downgrade to subscription
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            planId: pendingPlan.id,
            pendingPlanId: null,
            pendingPlanAt: null,
          },
        });

        // Update tenant limits (snapshot)
        await this.prisma.tenant.update({
          where: { id: sub.tenantId },
          data: {
            planId: pendingPlan.id,
            maxUsers: pendingPlan.maxUsers,
            maxOsPerMonth: pendingPlan.maxOsPerMonth,
            maxTechnicians: pendingPlan.maxTechnicians,
            maxAiMessages: pendingPlan.maxAiMessages,
            maxNfseImports: pendingPlan.maxNfseImports,
            supportLevel: pendingPlan.supportLevel,
            allModulesIncluded: pendingPlan.allModulesIncluded,
          },
        });

        // Update Company in tenant schema
        await this.tenantService.changePlan(sub.tenantId, pendingPlan.id);

        // Update Asaas subscription value
        if (sub.asaasSubscriptionId) {
          const isYearly = sub.billingCycle === 'ANNUAL';
          const newValue = isYearly && pendingPlan.priceYearlyCents
            ? pendingPlan.priceYearlyCents / 100
            : pendingPlan.priceCents / 100;
          try {
            await this.asaas.updateSubscription(sub.asaasSubscriptionId, {
              value: newValue,
              updatePendingPayments: false,
            });
          } catch (err) {
            this.logger.warn(`Failed to update Asaas subscription value for downgrade: ${(err as Error).message}`);
          }
        }

        applied++;
        this.logger.log(`Pending downgrade applied: tenant ${sub.tenant.slug} → plan ${pendingPlan.name}`);
      } catch (err) {
        this.logger.error(`Failed to apply pending downgrade for ${sub.tenant.slug}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Pending downgrade check complete: ${applied}/${pendingSubs.length} applied`);
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
    tenant: { schemaName: string; id?: string },
    addon: { osQuantity: number; userQuantity: number; technicianQuantity: number; aiMessageQuantity: number; nfseImportQuantity?: number },
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
      if (addon.nfseImportQuantity && addon.nfseImportQuantity > 0) data.maxNfseImports = { decrement: addon.nfseImportQuantity };

      if (Object.keys(data).length > 0) {
        await client.company.update({ where: { id: company.id }, data });

        // Safety: ensure limits never go below plan baseline
        // Get the tenant's plan to know the baseline (not just 0)
        let planBaseline = { maxOsPerMonth: 0, maxUsers: 0, maxTechnicians: 0, maxAiMessages: 0, maxNfseImports: 0 };
        if (tenant.id) {
          const tenantData = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            include: { plan: true },
          });
          if (tenantData?.plan) {
            planBaseline = {
              maxOsPerMonth: tenantData.plan.maxOsPerMonth,
              maxUsers: tenantData.plan.maxUsers,
              maxTechnicians: tenantData.plan.maxTechnicians,
              maxAiMessages: tenantData.plan.maxAiMessages,
              maxNfseImports: tenantData.plan.maxNfseImports,
            };
          }
        }

        const updated = await client.company.findFirst();
        if (updated) {
          const fixes: Record<string, number> = {};
          if ((updated.maxOsPerMonth || 0) < planBaseline.maxOsPerMonth) fixes.maxOsPerMonth = planBaseline.maxOsPerMonth;
          if ((updated.maxUsers || 0) < planBaseline.maxUsers) fixes.maxUsers = planBaseline.maxUsers;
          if ((updated.maxTechnicians || 0) < planBaseline.maxTechnicians) fixes.maxTechnicians = planBaseline.maxTechnicians;
          if ((updated.maxAiMessages || 0) < planBaseline.maxAiMessages) fixes.maxAiMessages = planBaseline.maxAiMessages;
          if ((updated.maxNfseImports || 0) < planBaseline.maxNfseImports) fixes.maxNfseImports = planBaseline.maxNfseImports;
          if (Object.keys(fixes).length > 0) {
            await client.company.update({ where: { id: updated.id }, data: fixes });
            this.logger.log(`Fixed Company limits below plan baseline for tenant ${tenant.schemaName}: ${JSON.stringify(fixes)}`);
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
