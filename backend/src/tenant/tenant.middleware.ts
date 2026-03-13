import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantStatus } from '@prisma/client';
import { tenantContext } from './tenant-context';

// Extend Express Request to carry tenant info
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantSlug?: string;
      tenantSchema?: string;
      tenantStatus?: TenantStatus;
    }
  }
}

/**
 * Middleware that extracts the tenant from the subdomain of the request.
 *
 * Examples:
 *   acme.tecnikos.com.br  → tenant "acme"
 *   sls.tecnikos.com.br   → tenant "sls"
 *   tecnikos.com.br       → no tenant (landing page / public routes)
 *   localhost:3000         → no tenant (development)
 *
 * If a tenant is found, req.tenantId, req.tenantSlug, req.tenantSchema are set.
 * If the tenant is blocked/suspended/cancelled, a 403 response is returned.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  // Cache tenant lookups for 60s to avoid hitting DB on every request
  private readonly cache = new Map<string, { tenant: any; expiresAt: number }>();
  private readonly CACHE_TTL = 60_000; // 60 seconds

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const host = req.hostname || req.headers.host || '';

    // Extract subdomain
    const slug = this.extractSlug(host);

    if (!slug) {
      // No subdomain — public/landing page or development
      return next();
    }

    try {
      const tenant = await this.getCachedTenant(slug);

      if (!tenant) {
        // Unknown subdomain — could be a typo or non-existent tenant
        res.status(404).json({
          statusCode: 404,
          message: 'Empresa não encontrada. Verifique o endereço.',
        });
        return;
      }

      // Check if tenant is accessible
      if (tenant.status === TenantStatus.BLOCKED || tenant.status === TenantStatus.SUSPENDED) {
        res.status(403).json({
          statusCode: 403,
          message: 'Acesso suspenso. Entre em contato com o suporte.',
          reason: tenant.blockReason || undefined,
        });
        return;
      }

      if (tenant.status === TenantStatus.CANCELLED) {
        res.status(410).json({
          statusCode: 410,
          message: 'Esta conta foi cancelada.',
        });
        return;
      }

      // PENDING_VERIFICATION and PENDING_PAYMENT: let through but mark status
      // The frontend will show appropriate banners and block certain actions

      // Attach tenant info to request
      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;
      req.tenantSchema = tenant.schemaName;
      req.tenantStatus = tenant.status;

      // Wrap the rest of the request in tenant context so that
      // PrismaService automatically routes queries to the tenant schema
      tenantContext.run(
        { tenantId: tenant.id, tenantSchema: tenant.schemaName },
        () => next(),
      );
    } catch (err) {
      this.logger.error(`TenantMiddleware error for "${slug}": ${(err as Error).message}`);
      // On error, allow request to proceed without tenant context
      // (services will use public schema as fallback)
      next();
    }
  }

  /**
   * Extract subdomain slug from hostname.
   * Returns null if no subdomain or if it's a known non-tenant prefix.
   */
  private extractSlug(host: string): string | null {
    // Remove port if present
    const hostname = host.split(':')[0];

    // Development: localhost, 127.0.0.1
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null;
    }

    // Production: xxx.tecnikos.com.br
    const baseDomain = process.env.BASE_DOMAIN || 'tecnikos.com.br';
    if (hostname.endsWith(`.${baseDomain}`)) {
      const slug = hostname.replace(`.${baseDomain}`, '');
      // Ignore known non-tenant subdomains
      if (['www', 'api', 'admin', 'mail', 'smtp', 'imap'].includes(slug)) {
        return null;
      }
      return slug;
    }

    // Custom domain mapping could go here in the future

    return null;
  }

  /**
   * Get tenant from cache or database.
   */
  private async getCachedTenant(slug: string) {
    const cached = this.cache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        schemaName: true,
        status: true,
        blockReason: true,
        isMaster: true,
      },
    });

    this.cache.set(slug, {
      tenant,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return tenant;
  }

  /**
   * Clear cache for a specific tenant (e.g., after status change).
   */
  clearCache(slug?: string): void {
    if (slug) {
      this.cache.delete(slug);
    } else {
      this.cache.clear();
    }
  }
}
