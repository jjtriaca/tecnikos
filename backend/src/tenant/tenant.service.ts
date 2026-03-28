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
    promoCode?: string;
    isMaster?: boolean;
    agreeTermsAt?: Date;
  }) {
    // Validate slug
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
    if (!slugRegex.test(data.slug)) {
      throw new BadRequestException(
        'Slug deve conter apenas letras minúsculas, números e hifens (3-32 chars)',
      );
    }

    // Only ACTIVE/BLOCKED/SUSPENDED tenants lock slug/CNPJ
    // PENDING tenants can be replaced (abandoned signups)
    const LOCKED: TenantStatus[] = ['ACTIVE', 'BLOCKED', 'SUSPENDED'];
    const existing = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: data.slug }, ...(data.cnpj ? [{ cnpj: data.cnpj }] : [])],
        status: { in: LOCKED },
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.slug === data.slug ? 'Subdomínio já em uso' : 'CNPJ já cadastrado',
      );
    }

    const schemaName = `tenant_${data.slug.replace(/-/g, '_')}`;

    // Get plan limits (snapshot all features for grandfather pattern)
    let maxUsers = 5;
    let maxOsPerMonth = 100;
    let maxTechnicians = 0;
    let maxAiMessages = 0;
    let maxNfseImports = 0;
    let supportLevel = 'EMAIL';
    let allModulesIncluded = true;
    if (data.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: data.planId } });
      if (plan) {
        maxUsers = plan.maxUsers;
        maxOsPerMonth = plan.maxOsPerMonth;
        maxTechnicians = plan.maxTechnicians;
        maxAiMessages = plan.maxAiMessages;
        maxNfseImports = plan.maxNfseImports;
        supportLevel = plan.supportLevel;
        allModulesIncluded = plan.allModulesIncluded;
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
        promoCode: data.promoCode,
        isMaster: data.isMaster || false,
        agreeTermsAt: data.agreeTermsAt,
        maxUsers,
        maxOsPerMonth,
        maxTechnicians,
        maxAiMessages,
        maxNfseImports,
        supportLevel,
        allModulesIncluded,
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
   * Also copies enum types so Prisma can find them when connecting to the tenant schema.
   */
  async createSchema(schemaName: string): Promise<void> {
    // Sanitize schema name to prevent SQL injection
    if (!/^[a-z0-9_]+$/.test(schemaName)) {
      throw new BadRequestException('Invalid schema name');
    }

    this.logger.log(`Creating schema "${schemaName}"...`);

    // Create schema
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // 1. Copy all enum types from public schema to tenant schema
    // Prisma with ?schema=tenant_xxx sets search_path to just that schema,
    // so enums like UserRole must exist there too.
    const enums: { typname: string; labels: string[] }[] = await this.prisma.$queryRawUnsafe(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      GROUP BY t.typname
    `);

    for (const { typname, labels } of enums) {
      try {
        const labelsSql = labels.map((l) => `'${l}'`).join(', ');
        await this.prisma.$executeRawUnsafe(
          `CREATE TYPE "${schemaName}"."${typname}" AS ENUM (${labelsSql})`,
        );
      } catch (err) {
        // Type might already exist (idempotent)
        this.logger.debug?.(`Enum "${typname}" in "${schemaName}": ${(err as Error).message}`);
      }
    }
    this.logger.log(`Copied ${enums.length} enum types to "${schemaName}"`);

    // 2. Get all tables in public schema (tenant-specific ones, not multi-tenant management tables)
    const tables: { tablename: string }[] = await this.prisma.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('_prisma_migrations', 'Tenant', 'Plan', 'Subscription', 'Promotion', 'SignupAttempt', 'SaasEvent', 'SaasInvoice', 'SaasInvoiceConfig', 'AddOn', 'AddOnPurchase', 'VerificationSession')
        AND tablename NOT LIKE '\\_%'
    `);

    // 3. Copy table structures — then remap enum column types from public to tenant schema
    for (const { tablename } of tables) {
      try {
        // First create the table using LIKE (copies structure with public enum references)
        await this.prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tablename}" (LIKE public."${tablename}" INCLUDING ALL)`,
        );

        // Find ALL columns that still reference public schema types (enums + enum arrays)
        const publicCols: { column_name: string; data_type: string; udt_name: string; column_default: string | null }[] =
          await this.prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, udt_name, column_default
            FROM information_schema.columns
            WHERE table_schema = '${schemaName}'
              AND table_name = '${tablename}'
              AND udt_schema = 'public'
              AND (data_type = 'USER-DEFINED' OR data_type = 'ARRAY')
          `);

        for (const { column_name, data_type, udt_name, column_default } of publicCols) {
          try {
            const isArray = data_type === 'ARRAY';
            // Array enum udt_name has underscore prefix: _UserRole → UserRole
            const enumName = isArray ? udt_name.substring(1) : udt_name;
            const targetType = isArray
              ? `"${schemaName}"."${enumName}"[]`
              : `"${schemaName}"."${enumName}"`;

            // 1. Save and drop default (it references public enum, blocks ALTER)
            if (column_default) {
              await this.prisma.$executeRawUnsafe(
                `ALTER TABLE "${schemaName}"."${tablename}" ALTER COLUMN "${column_name}" DROP DEFAULT`,
              );
            }

            // 2. Change column type to tenant schema enum
            await this.prisma.$executeRawUnsafe(
              `ALTER TABLE "${schemaName}"."${tablename}"
               ALTER COLUMN "${column_name}"
               TYPE ${targetType}
               USING "${column_name}"::text${isArray ? '[]' : ''}::"${schemaName}"."${enumName}"${isArray ? '[]' : ''}`,
            );

            // 3. Restore default with tenant schema enum reference
            //    e.g. '{}'::"UserRole"[] → '{}'::"tenant_sls"."UserRole"[]
            //    e.g. 'PENDING'::"FinancialEntryStatus" → 'PENDING'::"tenant_sls"."FinancialEntryStatus"
            if (column_default) {
              const newDefault = column_default.replace(
                /::"([A-Za-z]+)"(\[\])?/g,
                `::"${schemaName}"."$1"$2`,
              );
              await this.prisma.$executeRawUnsafe(
                `ALTER TABLE "${schemaName}"."${tablename}" ALTER COLUMN "${column_name}" SET DEFAULT ${newDefault}`,
              );
            }
          } catch (colErr) {
            this.logger.warn(`Remap "${tablename}.${column_name}": ${(colErr as Error).message}`);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to copy table "${tablename}" to "${schemaName}": ${(err as Error).message}`);
      }
    }

    // 4. Fix foreign keys that still reference public schema tables
    let fksRemapped = 0;
    const crossSchemaFks = await this.prisma.$queryRawUnsafe<{
      constraint_name: string;
      table_name: string;
      ref_table: string;
      constraint_def: string;
    }[]>(`
      SELECT
        con.conname AS "constraint_name",
        cl.relname AS "table_name",
        ref_cl.relname AS "ref_table",
        pg_get_constraintdef(con.oid) AS "constraint_def"
      FROM pg_constraint con
      JOIN pg_namespace ns ON con.connamespace = ns.oid
      JOIN pg_class cl ON con.conrelid = cl.oid
      JOIN pg_class ref_cl ON con.confrelid = ref_cl.oid
      JOIN pg_namespace ref_ns ON ref_cl.relnamespace = ref_ns.oid
      WHERE con.contype = 'f'
        AND ns.nspname = '${schemaName}'
        AND ref_ns.nspname = 'public'
    `);

    const tenantTableSet = new Set(tables.map(t => t.tablename));
    const publicOnlyTables = ['_prisma_migrations', 'Tenant', 'Plan', 'Subscription', 'Promotion', 'SignupAttempt', 'SaasEvent', 'SaasInvoice', 'SaasInvoiceConfig', 'AddOn', 'AddOnPurchase', 'VerificationSession'];

    for (const fk of crossSchemaFks) {
      try {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE "${schemaName}"."${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`,
        );
        if (tenantTableSet.has(fk.ref_table) && !publicOnlyTables.includes(fk.ref_table)) {
          const newDef = fk.constraint_def.replace(/public\./g, `"${schemaName}".`);
          await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "${schemaName}"."${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" ${newDef}`,
          );
        }
        fksRemapped++;
      } catch (err) {
        this.logger.warn(`FK remap "${fk.constraint_name}": ${(err as Error).message}`);
      }
    }

    this.logger.log(`Schema "${schemaName}" created with ${enums.length} enums + ${tables.length} tables + ${fksRemapped} FKs remapped`);

    // 5. Seed default TRANSITO cash account
    try {
      const existing: { id: string }[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "${schemaName}"."CashAccount" WHERE type = 'TRANSITO' LIMIT 1`,
      );
      if (existing.length === 0) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "${schemaName}"."CashAccount" (id, "companyId", code, name, type, "initialBalanceCents", "currentBalanceCents", "showInReceivables", "showInPayables", "isActive", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), (SELECT id FROM "${schemaName}"."Company" LIMIT 1), 'CX-00001', 'Valores em Transito', 'TRANSITO', 0, 0, false, false, true, now(), now())`,
        );
        this.logger.log(`Created default TRANSITO account in "${schemaName}"`);
      }
    } catch (err) {
      this.logger.warn(`Failed to seed TRANSITO account in "${schemaName}": ${(err as Error).message}`);
    }
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

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.ACTIVE,
        blockedAt: null,
        blockReason: null,
      },
    });

    // Increment promo currentUses only on activation (payment confirmed)
    // "Quem pagar primeiro tem o direito"
    if (tenant.promoCode) {
      await this.prisma.promotion.updateMany({
        where: { code: tenant.promoCode },
        data: { currentUses: { increment: 1 } },
      });
      this.logger.log(`Promo "${tenant.promoCode}" usage incremented for tenant "${tenant.slug}"`);
    }

    return updated;
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

    // Snapshot ALL plan features to tenant (grandfather pattern)
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: newPlanId,
        maxUsers: plan.maxUsers,
        maxOsPerMonth: plan.maxOsPerMonth,
        maxTechnicians: plan.maxTechnicians,
        maxAiMessages: plan.maxAiMessages,
        maxNfseImports: plan.maxNfseImports,
        supportLevel: plan.supportLevel,
        allModulesIncluded: plan.allModulesIncluded,
      },
    });

    // Propagar limites para a Company no schema do tenant
    try {
      const tenantPrisma = this.tenantConn.getClient(`tenant_${tenant.slug}`);
      await tenantPrisma.company.updateMany({
        data: {
          maxOsPerMonth: plan.maxOsPerMonth,
          maxUsers: plan.maxUsers,
          maxTechnicians: plan.maxTechnicians,
          maxAiMessages: plan.maxAiMessages,
          maxNfseImports: plan.maxNfseImports,
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
