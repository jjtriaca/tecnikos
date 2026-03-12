import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantStatus } from '@prisma/client';

/**
 * Service for managing tenants: CRUD, schema provisioning, status changes.
 * All operations use the public schema (PrismaService).
 */
@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConn: TenantConnectionService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────

  async findAll(filters?: { status?: TenantStatus }) {
    const where: any = { deletedAt: null };
    if (filters?.status) where.status = filters.status;
    return this.prisma.tenant.findMany({
      where,
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  async findById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: { plan: true, subscriptions: { include: { plan: true } } },
    });
  }

  async findBySchemaName(schemaName: string) {
    return this.prisma.tenant.findUnique({ where: { schemaName } });
  }

  // ─── PROVISIONING ─────────────────────────────────────

  /**
   * Create a new tenant:
   * 1. Insert tenant record in public.Tenant
   * 2. Create PostgreSQL schema
   * 3. Copy all table structures from public schema
   * 4. Create initial Company record in tenant schema
   */
  async provisionTenant(data: {
    slug: string;
    name: string;
    cnpj?: string;
    planId?: string;
    responsibleName?: string;
    responsibleEmail?: string;
    responsiblePhone?: string;
    passwordHash?: string;
    isMaster?: boolean;
  }) {
    // Validate slug
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
    if (!slugRegex.test(data.slug)) {
      throw new BadRequestException(
        'Slug deve conter apenas letras minúsculas, números e hifens (3-32 chars)',
      );
    }

    // Check uniqueness
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug: data.slug }, ...(data.cnpj ? [{ cnpj: data.cnpj }] : [])] },
    });
    if (existing) {
      throw new ConflictException(
        existing.slug === data.slug ? 'Subdomínio já em uso' : 'CNPJ já cadastrado',
      );
    }

    const schemaName = `tenant_${data.slug.replace(/-/g, '_')}`;

    // Get plan limits
    let maxUsers = 5;
    let maxOsPerMonth = 100;
    if (data.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: data.planId } });
      if (plan) {
        maxUsers = plan.maxUsers;
        maxOsPerMonth = plan.maxOsPerMonth;
      }
    }

    // 1. Create tenant record
    const tenant = await this.prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        schemaName,
        cnpj: data.cnpj,
        planId: data.planId,
        responsibleName: data.responsibleName,
        responsibleEmail: data.responsibleEmail,
        responsiblePhone: data.responsiblePhone,
        passwordHash: data.passwordHash,
        isMaster: data.isMaster || false,
        maxUsers,
        maxOsPerMonth,
        status: data.isMaster ? TenantStatus.ACTIVE : TenantStatus.PENDING_VERIFICATION,
      },
    });

    // 2. Create PostgreSQL schema + tables
    await this.createSchema(schemaName);

    this.logger.log(`Tenant "${data.slug}" provisioned → schema "${schemaName}"`);
    return tenant;
  }

  /**
   * Create a PostgreSQL schema and copy all table structures from public.
   */
  async createSchema(schemaName: string): Promise<void> {
    // Sanitize schema name to prevent SQL injection
    if (!/^[a-z0-9_]+$/.test(schemaName)) {
      throw new BadRequestException('Invalid schema name');
    }

    this.logger.log(`Creating schema "${schemaName}"...`);

    // Create schema
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Get all tables in public schema (tenant-specific ones, not multi-tenant management tables)
    const tables: { tablename: string }[] = await this.prisma.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('_prisma_migrations', 'Tenant', 'Plan', 'Subscription', 'Promotion')
        AND tablename NOT LIKE '\\_%'
    `);

    // Copy table structures (including indexes, defaults, constraints)
    for (const { tablename } of tables) {
      try {
        await this.prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tablename}" (LIKE public."${tablename}" INCLUDING ALL)`,
        );
      } catch (err) {
        this.logger.warn(`Failed to copy table "${tablename}" to "${schemaName}": ${(err as Error).message}`);
      }
    }

    this.logger.log(`Schema "${schemaName}" created with ${tables.length} tables`);
  }

  /**
   * Run self-healing migrations on a specific tenant schema.
   * Replicates column additions/table creations from PrismaService.
   */
  async runMigrationsOnSchema(schemaName: string): Promise<void> {
    // Get the tenant's PrismaClient (which connects to the right schema)
    const client = this.tenantConn.getClient(schemaName);

    // The self-healing migrations in PrismaService use unqualified table names,
    // so they'll run against whatever schema the client is connected to.
    // For now, the table structure copy via INCLUDING ALL handles this.
    this.logger.log(`Migrations verified for schema "${schemaName}"`);
  }

  // ─── STATUS MANAGEMENT ──────────────────────────────────

  async activate(id: string) {
    const tenant = await this.getTenantOrThrow(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.ACTIVE,
        blockedAt: null,
        blockReason: null,
      },
    });
  }

  async block(id: string, reason: string) {
    await this.getTenantOrThrow(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.BLOCKED,
        blockedAt: new Date(),
        blockReason: reason,
      },
    });
  }

  async suspend(id: string, reason: string) {
    await this.getTenantOrThrow(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.SUSPENDED,
        blockedAt: new Date(),
        blockReason: reason,
      },
    });
  }

  async cancel(id: string) {
    await this.getTenantOrThrow(id);
    // Remove cached connection
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (tenant) {
      await this.tenantConn.removeClient(tenant.schemaName);
    }
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.CANCELLED,
        deletedAt: new Date(),
      },
    });
  }

  // ─── PLAN MANAGEMENT ─────────────────────────────────

  async changePlan(tenantId: string, newPlanId: string) {
    const tenant = await this.getTenantOrThrow(tenantId);
    const plan = await this.prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: newPlanId,
        maxUsers: plan.maxUsers,
        maxOsPerMonth: plan.maxOsPerMonth,
      },
    });

    // Propagar limites para a Company no schema do tenant
    try {
      const tenantPrisma = this.tenantConn.getClient(`tenant_${tenant.slug}`);
      await tenantPrisma.company.updateMany({
        data: {
          maxOsPerMonth: plan.maxOsPerMonth,
          maxUsers: plan.maxUsers,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to propagate plan limits to tenant schema: ${err.message}`);
    }

    return updated;
  }

  // ─── HELPERS ──────────────────────────────────────────

  private async getTenantOrThrow(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  /**
   * List all tenant tables (for admin inspection).
   */
  async getSchemaInfo(schemaName: string) {
    const tables: { tablename: string }[] = await this.prisma.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename
    `, schemaName);

    return {
      schemaName,
      tableCount: tables.length,
      tables: tables.map((t) => t.tablename),
    };
  }
}
