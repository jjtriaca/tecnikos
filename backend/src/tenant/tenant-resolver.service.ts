import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { runInTenantContext } from './tenant-context';

/**
 * Service to resolve tenant context for webhooks and cron jobs.
 *
 * Unlike TenantMiddleware (which uses the subdomain from HTTP requests),
 * this service resolves the tenant from a companyId or iterates all tenants.
 *
 * It uses a RAW PrismaClient connected to the public schema (not the Proxy)
 * to avoid circular dependency — the Proxy itself depends on tenant context.
 */
@Injectable()
export class TenantResolverService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantResolverService.name);
  private rawPrisma: PrismaClient;

  constructor() {
    // Direct PrismaClient (no Proxy) — always queries public schema
    this.rawPrisma = new PrismaClient({
      log: ['error'],
    });
  }

  /**
   * Find the tenant that owns a specific companyId and run the function
   * within that tenant's context.
   *
   * @param companyId - The Company UUID to look up
   * @param fn - The async function to run in tenant context
   * @returns The result of fn, or null if no tenant found
   */
  async runForCompany<T>(
    companyId: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const tenant = await this.rawPrisma.tenant.findFirst({
      where: {
        companyId,
        status: { notIn: ['CANCELLED'] },
      },
      select: { id: true, schemaName: true, slug: true },
    });

    if (!tenant) {
      this.logger.warn(`No tenant found for companyId=${companyId}`);
      return null;
    }

    this.logger.debug(`Resolved tenant "${tenant.slug}" for companyId=${companyId}`);
    return runInTenantContext(
      { tenantId: tenant.id, tenantSchema: tenant.schemaName },
      fn,
    );
  }

  /**
   * Get all active tenants with their schema names.
   * Used by cron jobs that need to iterate over all tenants.
   */
  async getActiveTenants(): Promise<Array<{ id: string; slug: string; schemaName: string }>> {
    return this.rawPrisma.tenant.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'BLOCKED'] },
        deletedAt: null,
      },
      select: { id: true, slug: true, schemaName: true },
    });
  }

  /**
   * Run a function for EACH active tenant in its own context.
   * Used by cron jobs that need to process all tenants.
   *
   * @param fn - Async function receiving (tenantId, tenantSlug) to run per tenant
   */
  async forEachTenant(
    fn: (tenantId: string, tenantSlug: string) => Promise<void>,
  ): Promise<void> {
    const tenants = await this.getActiveTenants();

    for (const tenant of tenants) {
      try {
        await runInTenantContext(
          { tenantId: tenant.id, tenantSchema: tenant.schemaName },
          () => fn(tenant.id, tenant.slug),
        );
      } catch (err) {
        this.logger.error(
          `Error processing tenant "${tenant.slug}": ${(err as Error).message}`,
        );
      }
    }
  }

  async onModuleDestroy() {
    await this.rawPrisma.$disconnect();
  }
}
