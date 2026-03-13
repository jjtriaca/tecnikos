import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage for tenant context.
 * Stores the current tenant schema per request so that
 * PrismaService can transparently route queries to the correct PostgreSQL schema.
 */

interface TenantStore {
  tenantId?: string;
  tenantSchema?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantStore>();

/** Get the tenant schema for the current request (or undefined if no tenant) */
export function getTenantSchema(): string | undefined {
  return tenantContext.getStore()?.tenantSchema;
}

/** Get the tenant ID for the current request (or undefined if no tenant) */
export function getTenantId(): string | undefined {
  return tenantContext.getStore()?.tenantId;
}

/**
 * Run a function within the context of a specific tenant.
 * Used by webhooks and cron jobs that don't go through TenantMiddleware.
 *
 * @param store - The tenant store with tenantId and tenantSchema
 * @param fn - The async function to run within the tenant context
 */
export async function runInTenantContext<T>(
  store: TenantStore,
  fn: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tenantContext.run(store, () => {
      fn().then(resolve).catch(reject);
    });
  });
}
