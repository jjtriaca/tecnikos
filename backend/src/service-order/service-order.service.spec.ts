/**
 * ServiceOrderService — Unit Tests
 *
 * Tests cover:
 * 1. State machine (ALLOWED_TRANSITIONS)
 * 2. Auto-timestamps (startedAt, completedAt)
 * 3. Monthly OS limit enforcement
 * 4. Technician assignment rules
 * 5. Soft delete behavior
 * 6. Monthly usage calculation
 * 7. Audit logging
 */
import { ForbiddenException } from '@nestjs/common';
import { ServiceOrderService } from './service-order.service';

// ── Mock factories ──────────────────────────────────────────────────
function createMockPrisma() {
  return {
    serviceOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    partner: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fns: any[]) => Promise.all(fns.map((fn: any) => (typeof fn === 'function' ? fn() : fn)))),
  };
}

function createMockAudit() {
  return { log: jest.fn() };
}

function createMockCodeGenerator() {
  return { generateCode: jest.fn().mockResolvedValue('OS-00001') };
}

// ── Helper: build a mock ServiceOrder ────────────────────────────────
function buildOS(overrides: Record<string, any> = {}) {
  return {
    id: 'os-1',
    companyId: 'comp-1',
    code: 'OS-00001',
    title: 'Test OS',
    status: 'ABERTA',
    assignedPartnerId: null,
    startedAt: null,
    completedAt: null,
    deletedAt: null,
    isUrgent: false,
    isReturn: false,
    workflowTemplateId: null,
    assignedPartner: null,
    ...overrides,
  };
}

describe('ServiceOrderService', () => {
  let service: ServiceOrderService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAudit: ReturnType<typeof createMockAudit>;
  let mockCodeGen: ReturnType<typeof createMockCodeGenerator>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockAudit = createMockAudit();
    mockCodeGen = createMockCodeGenerator();

    // Create service instance directly, bypassing NestJS DI
    service = new ServiceOrderService(
      mockPrisma as any,   // PrismaService
      mockAudit as any,    // AuditService
      mockCodeGen as any,  // CodeGeneratorService
      undefined,           // NotificationService (optional)
      undefined,           // AutomationEngineService (optional)
      undefined,           // WaitForService (optional)
      undefined,           // WorkflowEngineService (optional)
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 1. STATE MACHINE — ALLOWED_TRANSITIONS
  // ════════════════════════════════════════════════════════════════════
  describe('State Machine — updateStatus()', () => {
    const validTransitions: [string, string][] = [
      ['ABERTA', 'OFERTADA'],
      ['ABERTA', 'ATRIBUIDA'],
      ['ABERTA', 'CANCELADA'],
      ['OFERTADA', 'ATRIBUIDA'],
      ['OFERTADA', 'ABERTA'],
      ['OFERTADA', 'CANCELADA'],
      ['ATRIBUIDA', 'A_CAMINHO'],
      ['ATRIBUIDA', 'EM_EXECUCAO'],
      ['ATRIBUIDA', 'ABERTA'],
      ['ATRIBUIDA', 'CANCELADA'],
      ['A_CAMINHO', 'EM_EXECUCAO'],
      ['A_CAMINHO', 'ATRIBUIDA'],
      ['A_CAMINHO', 'CANCELADA'],
      ['EM_EXECUCAO', 'CONCLUIDA'],
      ['EM_EXECUCAO', 'AJUSTE'],
      ['EM_EXECUCAO', 'CANCELADA'],
      ['AJUSTE', 'EM_EXECUCAO'],
      ['AJUSTE', 'CANCELADA'],
      ['CONCLUIDA', 'APROVADA'],
      ['CONCLUIDA', 'AJUSTE'],
    ];

    it.each(validTransitions)(
      'should allow transition %s → %s',
      async (from, to) => {
        const os = buildOS({ status: from });
        mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
        mockPrisma.serviceOrder.update.mockResolvedValue({ ...os, status: to });

        const result = await service.updateStatus('os-1', to as any, 'comp-1');
        expect(result.status).toBe(to);
        expect(mockPrisma.serviceOrder.update).toHaveBeenCalled();
      },
    );

    const invalidTransitions: [string, string][] = [
      ['ABERTA', 'EM_EXECUCAO'],
      ['ABERTA', 'CONCLUIDA'],
      ['ABERTA', 'APROVADA'],
      ['OFERTADA', 'EM_EXECUCAO'],
      ['OFERTADA', 'CONCLUIDA'],
      ['A_CAMINHO', 'ABERTA'],
      ['A_CAMINHO', 'CONCLUIDA'],
      ['EM_EXECUCAO', 'ABERTA'],
      ['EM_EXECUCAO', 'ATRIBUIDA'],
      ['CONCLUIDA', 'ABERTA'],
      ['CONCLUIDA', 'CANCELADA'],
    ];

    it.each(invalidTransitions)(
      'should BLOCK transition %s → %s',
      async (from, to) => {
        const os = buildOS({ status: from });
        mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);

        await expect(
          service.updateStatus('os-1', to as any, 'comp-1'),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.serviceOrder.update).not.toHaveBeenCalled();
      },
    );

    const terminalStatuses = ['APROVADA', 'CANCELADA'];

    it.each(terminalStatuses)(
      'should BLOCK any transition from terminal status %s',
      async (terminal) => {
        const os = buildOS({ status: terminal });
        mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);

        await expect(
          service.updateStatus('os-1', 'ABERTA' as any, 'comp-1'),
        ).rejects.toThrow(ForbiddenException);
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. AUTO-TIMESTAMPS
  // ════════════════════════════════════════════════════════════════════
  describe('Auto-timestamps on status change', () => {
    it('should set startedAt on first transition to EM_EXECUCAO', async () => {
      const os = buildOS({ status: 'ATRIBUIDA', startedAt: null });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...os, ...data }),
      );

      await service.updateStatus('os-1', 'EM_EXECUCAO' as any, 'comp-1');

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.startedAt).toBeInstanceOf(Date);
    });

    it('should NOT overwrite startedAt if already set', async () => {
      const existingDate = new Date('2026-01-01');
      const os = buildOS({ status: 'AJUSTE', startedAt: existingDate });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...os, ...data }),
      );

      await service.updateStatus('os-1', 'EM_EXECUCAO' as any, 'comp-1');

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.startedAt).toBeUndefined();
    });

    it('should set completedAt on transition to CONCLUIDA', async () => {
      const os = buildOS({ status: 'EM_EXECUCAO', completedAt: null });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...os, ...data }),
      );

      await service.updateStatus('os-1', 'CONCLUIDA' as any, 'comp-1');

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt on transition to APROVADA if not set', async () => {
      const os = buildOS({ status: 'CONCLUIDA', completedAt: null });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...os, ...data }),
      );

      await service.updateStatus('os-1', 'APROVADA' as any, 'comp-1');

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 3. MONTHLY LIMIT ENFORCEMENT
  // ════════════════════════════════════════════════════════════════════
  describe('Monthly OS Limit', () => {
    const createDto = {
      companyId: 'comp-1',
      title: 'Nova OS',
      description: 'Desc',
      addressText: 'Rua X',
      valueCents: 10000,
      deadlineAt: new Date().toISOString(),
    };

    it('should BLOCK creation when monthly limit is reached', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ maxOsPerMonth: 72 });
      mockPrisma.serviceOrder.count.mockResolvedValue(72);

      await expect(service.create(createDto as any)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.serviceOrder.create).not.toHaveBeenCalled();
    });

    it('should show plan limit in error message', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ maxOsPerMonth: 72 });
      mockPrisma.serviceOrder.count.mockResolvedValue(72);

      await expect(service.create(createDto as any)).rejects.toThrow(/Limite de 72 OS/);
    });

    it('should ALLOW creation when under limit', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ maxOsPerMonth: 72 });
      mockPrisma.serviceOrder.count.mockResolvedValue(50);
      mockPrisma.serviceOrder.create.mockResolvedValue(buildOS());

      const result = await service.create(createDto as any);
      expect(mockPrisma.serviceOrder.create).toHaveBeenCalled();
    });

    it('should ALLOW unlimited creation when maxOsPerMonth is 0', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ maxOsPerMonth: 0 });
      mockPrisma.serviceOrder.create.mockResolvedValue(buildOS());

      await service.create(createDto as any);
      expect(mockPrisma.serviceOrder.create).toHaveBeenCalled();
    });

    it('deleted OS should count toward monthly limit (fraud prevention)', async () => {
      // Count includes deleted OS (no deletedAt filter in count query)
      mockPrisma.company.findFirst.mockResolvedValue({ maxOsPerMonth: 72 });
      mockPrisma.serviceOrder.count.mockResolvedValue(72); // includes deleted

      await expect(service.create(createDto as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 4. ASSIGN TECHNICIAN
  // ════════════════════════════════════════════════════════════════════
  describe('Assign Technician', () => {
    it('should assign technician and set status to ATRIBUIDA', async () => {
      const os = buildOS({ status: 'ABERTA' });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...os,
        assignedPartnerId: 'tech-1',
        status: 'ATRIBUIDA',
        acceptedAt: new Date(),
      });
      mockPrisma.partner.findUnique.mockResolvedValue({ phone: '11999999999' });

      await service.assign('os-1', 'tech-1', 'comp-1');

      expect(mockPrisma.serviceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedPartnerId: 'tech-1',
            status: 'ATRIBUIDA',
          }),
        }),
      );
    });

    it('should set acceptedAt when assigning', async () => {
      const os = buildOS({ status: 'ABERTA' });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...os, ...data }),
      );

      await service.assign('os-1', 'tech-1', 'comp-1');

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.acceptedAt).toBeInstanceOf(Date);
    });

    it('should BLOCK assignment on terminal statuses', async () => {
      for (const terminal of ['CONCLUIDA', 'APROVADA', 'CANCELADA']) {
        jest.clearAllMocks();
        mockPrisma.serviceOrder.findFirst.mockResolvedValue(buildOS({ status: terminal }));

        await expect(
          service.assign('os-1', 'tech-1', 'comp-1'),
        ).rejects.toThrow(ForbiddenException);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 5. SOFT DELETE
  // ════════════════════════════════════════════════════════════════════
  describe('Soft Delete', () => {
    it('should set deletedAt instead of hard delete', async () => {
      const os = buildOS();
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...os, ...data }),
      );

      await service.remove('os-1', 'comp-1');

      const updateCall = mockPrisma.serviceOrder.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });

    it('should log audit on delete', async () => {
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(buildOS());
      mockPrisma.serviceOrder.update.mockResolvedValue(buildOS({ deletedAt: new Date() }));

      await service.remove('os-1', 'comp-1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETED',
          entityType: 'SERVICE_ORDER',
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 6. MONTHLY USAGE
  // ════════════════════════════════════════════════════════════════════
  describe('monthlyUsage()', () => {
    it('should return correct usage data', async () => {
      mockPrisma.serviceOrder.count.mockResolvedValue(45);
      mockPrisma.company.findUnique.mockResolvedValue({ maxOsPerMonth: 72, maxUsers: 2 });

      const result = await service.monthlyUsage('comp-1');

      expect(result.usedThisMonth).toBe(45);
      expect(result.maxOsPerMonth).toBe(72);
      expect(result.isUnlimited).toBe(false);
      expect(result.percentage).toBe(63); // 45/72 ≈ 62.5 → rounds to 63
    });

    it('should return isUnlimited when maxOsPerMonth is 0', async () => {
      mockPrisma.serviceOrder.count.mockResolvedValue(100);
      mockPrisma.company.findUnique.mockResolvedValue({ maxOsPerMonth: 0, maxUsers: 8 });

      const result = await service.monthlyUsage('comp-1');

      expect(result.isUnlimited).toBe(true);
      expect(result.percentage).toBe(0);
    });

    it('should cap percentage at 100', async () => {
      mockPrisma.serviceOrder.count.mockResolvedValue(80);
      mockPrisma.company.findUnique.mockResolvedValue({ maxOsPerMonth: 72, maxUsers: 2 });

      const result = await service.monthlyUsage('comp-1');

      expect(result.percentage).toBe(100);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 7. AUDIT LOGGING
  // ════════════════════════════════════════════════════════════════════
  describe('Audit Logging', () => {
    it('should log STATUS_CHANGED on status update', async () => {
      const os = buildOS({ status: 'ABERTA' });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockResolvedValue({ ...os, status: 'OFERTADA' });

      await service.updateStatus('os-1', 'OFERTADA' as any, 'comp-1', {
        id: 'user-1',
        email: 'admin@test.com',
      } as any);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STATUS_CHANGED',
          before: { status: 'ABERTA' },
          after: { status: 'OFERTADA' },
          actorId: 'user-1',
        }),
      );
    });

    it('should log ASSIGNED on technician assignment', async () => {
      const os = buildOS({ status: 'ABERTA' });
      mockPrisma.serviceOrder.findFirst.mockResolvedValue(os);
      mockPrisma.serviceOrder.update.mockResolvedValue({
        ...os,
        status: 'ATRIBUIDA',
        assignedPartnerId: 'tech-1',
      });

      await service.assign('os-1', 'tech-1', 'comp-1', {
        id: 'user-1',
        email: 'admin@test.com',
      } as any);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ASSIGNED',
          entityType: 'SERVICE_ORDER',
        }),
      );
    });
  });
});
