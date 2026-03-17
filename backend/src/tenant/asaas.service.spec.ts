/**
 * AsaasService — Unit Tests
 *
 * Tests cover:
 * 1. PAYMENT_CONFIRMED — Tenant activation (first payment)
 * 2. PAYMENT_CONFIRMED — Renewal (clear overdueAt)
 * 3. PAYMENT_CONFIRMED — Pending downgrade application
 * 4. PAYMENT_OVERDUE — Grace period start
 * 5. Add-on purchase confirmation
 * 6. Grace period blocking (7 days)
 * 7. Subscription cancellation (safe deletion)
 * 8. Promotion tracking
 * 9. Upgrade checkout
 * 10. Downgrade scheduling
 */
import { AsaasService } from './asaas.service';

// ── Mock factories ──────────────────────────────────────────────────
function createMockPrisma() {
  return {
    tenant: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    addOnPurchase: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    promotion: {
      update: jest.fn(),
    },
    saasEvent: {
      create: jest.fn(),
    },
    saasInvoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

function createMockTenantService() {
  return {
    activate: jest.fn(),
    block: jest.fn(),
    suspend: jest.fn(),
    getTenantPrisma: jest.fn(),
  };
}

function createMockTenantConn() {
  return {
    getConnection: jest.fn().mockResolvedValue({
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-1', maxOsPerMonth: 72 }),
        update: jest.fn().mockResolvedValue({}),
      },
    }),
  };
}

function createMockOnboarding() {
  return {
    onboard: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmailForTenant: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockAsaasProvider() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
}

// ── Helper: build mock objects ───────────────────────────────────────
function buildTenant(overrides: Record<string, any> = {}) {
  return {
    id: 'tenant-1',
    slug: 'acme',
    schemaName: 'tenant_acme',
    cnpj: '12345678000190',
    status: 'PENDING_PAYMENT',
    asaasCustomerId: 'cus_test123',
    promoCode: null,
    blockedAt: null,
    blockReason: null,
    maxUsers: 2,
    maxOsPerMonth: 72,
    maxTechnicians: 6,
    maxAiMessages: 50,
    ...overrides,
  };
}

function buildSubscription(overrides: Record<string, any> = {}) {
  const tenantOverride = overrides.tenant || {};
  delete overrides.tenant;
  return {
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: 'plan-essencial',
    status: 'PENDING',
    billingCycle: 'MONTHLY',
    asaasSubscriptionId: 'sub_asaas_123',
    pendingPlanId: null,
    pendingPlanAt: null,
    creditBalanceCents: 0,
    overdueAt: null,
    promotionId: null,
    promotionMonthsLeft: 0,
    originalValueCents: 19700,
    extraOsPurchased: 0,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    plan: {
      id: 'plan-essencial',
      priceCents: 19700,
      maxUsers: 2,
      maxOsPerMonth: 72,
      maxTechnicians: 6,
      maxAiMessages: 50,
    },
    tenant: buildTenant(tenantOverride),
    ...overrides,
  };
}

function buildPlan(overrides: Record<string, any> = {}) {
  return {
    id: 'plan-essencial',
    name: 'Essencial',
    slug: 'essencial',
    priceCents: 19700,
    priceYearlyCents: 197000,
    maxUsers: 2,
    maxOsPerMonth: 72,
    maxTechnicians: 6,
    maxAiMessages: 50,
    ...overrides,
  };
}

function buildPaymentEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'pay_test_123',
    subscription: 'sub_asaas_123',
    customer: 'cus_test123',
    value: 197.0,
    netValue: 190.0,
    billingType: 'PIX',
    status: 'CONFIRMED',
    paymentDate: '2026-03-17',
    dueDate: '2026-03-17',
    externalReference: null,
    ...overrides,
  };
}

describe('AsaasService — Webhook & Billing Logic', () => {
  let service: AsaasService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockTenantService: ReturnType<typeof createMockTenantService>;
  let mockTenantConn: ReturnType<typeof createMockTenantConn>;
  let mockOnboarding: ReturnType<typeof createMockOnboarding>;
  let mockAsaas: ReturnType<typeof createMockAsaasProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockTenantService = createMockTenantService();
    mockTenantConn = createMockTenantConn();
    mockOnboarding = createMockOnboarding();
    mockAsaas = createMockAsaasProvider();

    // Create service bypassing NestJS DI
    service = new AsaasService(
      mockPrisma as any,
      mockTenantService as any,
      mockTenantConn as any,
      mockOnboarding as any,
      mockAsaas as any,
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 1. PAYMENT_CONFIRMED — Tenant Activation
  // ════════════════════════════════════════════════════════════════════
  describe('PAYMENT_CONFIRMED — First Payment (Activation)', () => {
    it('should activate tenant on first payment', async () => {
      const sub = buildSubscription({
        status: 'PENDING',
        tenant: { status: 'PENDING_PAYMENT' },
      });
      const payment = buildPaymentEvent();

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.tenant.updateMany.mockResolvedValue({ count: 1 });
      mockTenantService.activate.mockResolvedValue({ ...sub.tenant, status: 'ACTIVE' });
      mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'ACTIVE' });
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_CONFIRMED', payment);

      // Tenant should be activated
      expect(mockTenantService.activate).toHaveBeenCalledWith('tenant-1');
      // Onboarding should run
      expect(mockOnboarding.onboard).toHaveBeenCalled();
      // Subscription should become ACTIVE
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should use atomic updateMany to prevent race conditions', async () => {
      const sub = buildSubscription({
        status: 'PENDING',
        tenant: { status: 'PENDING_PAYMENT' },
      });
      const payment = buildPaymentEvent();

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      // Race condition: another webhook already activated this tenant
      mockPrisma.tenant.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_CONFIRMED', payment);

      // Should NOT call activate (race condition prevented)
      expect(mockTenantService.activate).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. PAYMENT_CONFIRMED — Renewal
  // ════════════════════════════════════════════════════════════════════
  describe('PAYMENT_CONFIRMED — Renewal', () => {
    it('should clear overdueAt on payment', async () => {
      const sub = buildSubscription({
        status: 'PAST_DUE',
        overdueAt: new Date('2026-03-10'),
        tenant: { status: 'ACTIVE' },
      });
      const payment = buildPaymentEvent();

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_CONFIRMED', payment);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            overdueAt: null,
          }),
        }),
      );
    });

    it('should update subscription to ACTIVE on renewal', async () => {
      const sub = buildSubscription({ status: 'ACTIVE', tenant: { status: 'ACTIVE' } });
      const payment = buildPaymentEvent();

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'ACTIVE' });
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_CONFIRMED', payment);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 3. PAYMENT_OVERDUE — Grace Period Start
  // ════════════════════════════════════════════════════════════════════
  describe('PAYMENT_OVERDUE', () => {
    it('should set status to PAST_DUE and record overdueAt', async () => {
      const sub = buildSubscription({ status: 'ACTIVE', overdueAt: null, tenant: { status: 'ACTIVE' } });
      const payment = buildPaymentEvent({ status: 'OVERDUE' });

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_OVERDUE', payment);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAST_DUE',
          }),
        }),
      );
    });

    it('should NOT overwrite overdueAt if already set', async () => {
      const existingOverdue = new Date('2026-03-10');
      const sub = buildSubscription({
        status: 'PAST_DUE',
        overdueAt: existingOverdue,
        tenant: { status: 'ACTIVE' },
      });
      const payment = buildPaymentEvent({ status: 'OVERDUE' });

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_OVERDUE', payment);

      // Should preserve existing overdueAt
      const updateCall = mockPrisma.subscription.update.mock.calls[0]?.[0];
      if (updateCall?.data?.overdueAt !== undefined) {
        // If it sets overdueAt, it should keep the original
        expect(updateCall.data.overdueAt).toEqual(existingOverdue);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 4. ADD-ON CONFIRMATION
  // ════════════════════════════════════════════════════════════════════
  describe('Add-On Purchase Confirmation', () => {
    it('should confirm add-on by ID and mark as PAID', async () => {
      const tenant = buildTenant({ status: 'ACTIVE' });
      const purchase = {
        id: 'purchase-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        addOnId: 'addon-os',
        status: 'PENDING',
        osQuantity: 50,
        userQuantity: 0,
        technicianQuantity: 0,
        aiMessageQuantity: 0,
        addOn: { type: 'OS', quantity: 50 },
        subscription: { id: 'sub-1', tenant },
      };

      mockPrisma.addOnPurchase.findFirst.mockResolvedValue(purchase);
      mockPrisma.addOnPurchase.update.mockResolvedValue({ ...purchase, status: 'PAID' });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockTenantConn.getConnection.mockResolvedValue({
        company: {
          findFirst: jest.fn().mockResolvedValue({ id: 'company-1', maxOsPerMonth: 72 }),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      await service.confirmAddOnById('purchase-1');

      expect(mockPrisma.addOnPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('should skip already-paid add-on (returns false)', async () => {
      // findFirst with status: PENDING won't find a PAID purchase
      mockPrisma.addOnPurchase.findFirst.mockResolvedValue(null);

      await service.confirmAddOnById('purchase-1');
      // Should not try to update again
      expect(mockPrisma.addOnPurchase.update).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 5. GRACE PERIOD — 7 Days Blocking
  // ════════════════════════════════════════════════════════════════════
  describe('Grace Period — checkOverdueSubscriptions()', () => {
    it('should block tenant after 7+ days overdue', async () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const overdueSub = buildSubscription({
        status: 'PAST_DUE',
        overdueAt: eightDaysAgo,
      });

      mockPrisma.subscription.findMany.mockResolvedValue([overdueSub]);
      mockTenantService.block.mockResolvedValue(undefined);
      mockPrisma.subscription.update.mockResolvedValue(overdueSub);
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.checkOverdueSubscriptions();

      // Should block tenant
      expect(mockTenantService.block).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
      );
      // Should mark subscription as SUSPENDED
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUSPENDED' }),
        }),
      );
    });

    it('should NOT block tenant within grace period (< 7 days)', async () => {
      // The query itself filters by overdueAt <= 7 days ago
      // So findMany returns empty when all subs are within grace
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      await service.checkOverdueSubscriptions();

      expect(mockTenantService.block).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 6. SUBSCRIPTION DELETED — Safe Cancellation
  // ════════════════════════════════════════════════════════════════════
  describe('Subscription Deleted/Inactivated', () => {
    it('should cancel subscription', async () => {
      const sub = buildSubscription({ status: 'ACTIVE', tenant: { status: 'ACTIVE' } });

      mockPrisma.subscription.findFirst
        .mockResolvedValueOnce(sub)  // find by asaas ID
        .mockResolvedValueOnce(null); // no other ACTIVE sub
      mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'CANCELLED' });
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handleSubscriptionWebhook('SUBSCRIPTION_DELETED', {
        id: 'sub_asaas_123',
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should NOT suspend tenant if another ACTIVE subscription exists (upgrade safety)', async () => {
      const sub = buildSubscription({ status: 'ACTIVE', tenant: { status: 'ACTIVE' } });
      const otherActiveSub = buildSubscription({ id: 'sub-2', status: 'ACTIVE', tenant: { status: 'ACTIVE' } });

      mockPrisma.subscription.findFirst
        .mockResolvedValueOnce(sub)          // find by asaas ID
        .mockResolvedValueOnce(otherActiveSub); // other ACTIVE sub exists
      mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'CANCELLED' });
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handleSubscriptionWebhook('SUBSCRIPTION_DELETED', {
        id: 'sub_asaas_123',
      });

      // Should NOT suspend (upgrade flow creates new sub before cancelling old)
      expect(mockTenantService.suspend).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 7. PROMOTION TRACKING
  // ════════════════════════════════════════════════════════════════════
  describe('Promotion Handling', () => {
    it('should decrement promotionMonthsLeft on payment', async () => {
      const sub = buildSubscription({
        status: 'ACTIVE',
        promotionId: 'promo-1',
        promotionMonthsLeft: 3,
        originalValueCents: 19700,
        tenant: { status: 'ACTIVE' },
      });
      const payment = buildPaymentEvent();

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_CONFIRMED', payment);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promotionMonthsLeft: 2,
          }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 8. UPGRADE FLOW
  // ════════════════════════════════════════════════════════════════════
  describe('Upgrade — createUpgradeCheckout()', () => {
    it('should save pendingPlanId on upgrade', async () => {
      const currentPlan = buildPlan({ id: 'plan-essencial', priceCents: 19700 });
      const newPlan = buildPlan({ id: 'plan-pro', priceCents: 39700 });
      const sub = buildSubscription({
        status: 'ACTIVE',
        planId: 'plan-essencial',
        currentPeriodStart: new Date('2026-03-01'),
        currentPeriodEnd: new Date('2026-03-31'),
        plan: currentPlan,
        tenant: { status: 'ACTIVE', plan: currentPlan },
      });

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.plan.findFirst.mockResolvedValue(newPlan);
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockAsaas.post.mockResolvedValue({
        id: 'pay_upgrade',
        invoiceUrl: 'https://asaas.com/pay',
      });
      mockPrisma.saasEvent.create.mockResolvedValue({});

      await service.createUpgradeCheckout('tenant-1', 'plan-pro');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingPlanId: 'plan-pro',
          }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 9. DOWNGRADE FLOW
  // ════════════════════════════════════════════════════════════════════
  describe('Downgrade — schedulePlanDowngrade()', () => {
    it('should schedule downgrade for next billing cycle', async () => {
      const currentPlan = buildPlan({ id: 'plan-pro', priceCents: 39700 });
      const cheaperPlan = buildPlan({ id: 'plan-essencial', priceCents: 19700 });
      const sub = buildSubscription({
        status: 'ACTIVE',
        planId: 'plan-pro',
        plan: currentPlan,
        currentPeriodEnd: new Date('2026-04-17'),
        tenant: { status: 'ACTIVE' },
      });

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.plan.findFirst.mockResolvedValue(cheaperPlan);
      mockPrisma.subscription.update.mockResolvedValue(sub);

      await service.schedulePlanDowngrade('tenant-1', 'plan-essencial');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingPlanId: 'plan-essencial',
          }),
        }),
      );
    });

    it('should REJECT downgrade to more expensive plan', async () => {
      const currentPlan = buildPlan({ id: 'plan-essencial', priceCents: 19700 });
      const expensivePlan = buildPlan({ id: 'plan-pro', priceCents: 39700 });
      const sub = buildSubscription({
        planId: 'plan-essencial',
        plan: currentPlan,
        status: 'ACTIVE',
        tenant: { status: 'ACTIVE' },
      });

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.plan.findFirst.mockResolvedValue(expensivePlan);

      await expect(
        service.schedulePlanDowngrade('tenant-1', 'plan-pro'),
      ).rejects.toThrow();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 10. PENDING DOWNGRADE — Applied on Payment
  // ════════════════════════════════════════════════════════════════════
  describe('Pending Downgrade on Payment', () => {
    it('should apply pending downgrade and clear pendingPlanId', async () => {
      const cheaperPlan = buildPlan({
        id: 'plan-essencial',
        priceCents: 19700,
        maxUsers: 2,
        maxOsPerMonth: 72,
      });
      const sub = buildSubscription({
        status: 'ACTIVE',
        planId: 'plan-pro',
        pendingPlanId: 'plan-essencial',
        pendingPlanAt: new Date(),
        tenant: { status: 'ACTIVE' },
      });
      const payment = buildPaymentEvent();

      mockPrisma.subscription.findFirst.mockResolvedValue(sub);
      mockPrisma.tenant.findUnique.mockResolvedValue(sub.tenant);
      mockPrisma.plan.findUnique.mockResolvedValue(cheaperPlan);
      mockPrisma.subscription.update.mockResolvedValue(sub);
      mockPrisma.tenant.update.mockResolvedValue(sub.tenant);
      mockPrisma.saasEvent.create.mockResolvedValue({});
      mockTenantConn.getConnection.mockResolvedValue({
        company: {
          findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      mockAsaas.put.mockResolvedValue({});

      await service.handlePaymentWebhook('PAYMENT_CONFIRMED', payment);

      // Should clear pendingPlanId after applying
      const updateCalls = mockPrisma.subscription.update.mock.calls;
      const clearPendingCall = updateCalls.find(
        (call: any) => call[0]?.data?.pendingPlanId === null,
      );
      expect(clearPendingCall).toBeDefined();
    });
  });
});
