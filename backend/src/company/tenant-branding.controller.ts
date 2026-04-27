import {
  Controller, Get, Param, Res, NotFoundException, Logger,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyService } from './company.service';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const FRONTEND_PUBLIC = path.join(process.cwd(), '..', 'frontend', 'public');

const VALID_VARIANTS = ['favicon-32', 'icon-192', 'icon-512', 'apple-touch', 'og'] as const;
type Variant = typeof VALID_VARIANTS[number];

/**
 * Endpoints publicos de branding por tenant (v1.10.16).
 *
 * Sem autenticacao — usados por:
 *  - crawlers de previews social (WhatsApp, Facebook, Twitter)
 *  - tags `<link rel="icon">` e `<meta property="og:image">` no metadata Next.js
 *  - generateMetadata() das rotas publicas /q/[token] e /p/[token]
 *
 * Estrategia: slug → Tenant.schemaName → Company (no schema do tenant) → logoUrl
 * → arquivo em uploads/{companyId}/variants/{variant}.png. Fallback pra logo
 * padrao Tecnikos quando empresa nao subiu logo ainda.
 */
@Controller('public/tenant')
export class TenantBrandingController {
  private readonly logger = new Logger(TenantBrandingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
  ) {}

  /**
   * GET /api/public/tenant/:slug/branding
   * Retorna info de marca pra metadata dinamica.
   */
  @Public()
  @Get(':slug/branding')
  async getBranding(@Param('slug') slug: string) {
    const info = await this.resolveTenant(slug);
    if (!info) throw new NotFoundException('Tenant nao encontrado.');

    const { tenant, company } = info;
    const hasLogo = !!company?.logoUrl;
    const baseUrl = `/api/public/tenant/${slug}/logo`;

    return {
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      companyName: company?.tradeName || company?.name || tenant.name,
      hasCustomLogo: hasLogo,
      logos: {
        og: `${baseUrl}/og`,
        favicon32: `${baseUrl}/favicon-32`,
        icon192: `${baseUrl}/icon-192`,
        icon512: `${baseUrl}/icon-512`,
        appleTouch: `${baseUrl}/apple-touch`,
      },
    };
  }

  /**
   * GET /api/public/tenant/:slug/logo/:variant
   * Serve PNG da variante. Fallback pra logo Tecnikos quando empresa nao tem.
   */
  @Public()
  @Get(':slug/logo/:variant')
  async getLogo(
    @Param('slug') slug: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ) {
    if (!(VALID_VARIANTS as readonly string[]).includes(variant)) {
      throw new NotFoundException('Variante invalida.');
    }

    const info = await this.resolveTenant(slug);
    let filePath: string | null = null;

    if (info?.company?.id) {
      // Tenta variante gerada
      const candidate = path.join(
        UPLOAD_DIR,
        info.company.id,
        'variants',
        `${variant}.png`,
      );
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      } else {
        // Variante nao existe — tenta backfill on-the-fly e tenta de novo
        try {
          await this.companyService.ensureLogoVariants(info.company.id);
          if (fs.existsSync(candidate)) filePath = candidate;
        } catch (err) {
          this.logger.warn(
            `Backfill on-the-fly falhou pra ${slug}/${variant}: ${(err as Error).message}`,
          );
        }
      }
    }

    // Fallback: logo padrao Tecnikos servida do public do frontend
    if (!filePath) {
      filePath = this.getDefaultLogo(variant as Variant);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('Logo indisponivel.');
    }

    const isDefault = !info?.company?.logoUrl;
    res.setHeader('Content-Type', filePath.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
    // Cache curto pra default (pode mudar quando empresa subir logo), longo pra customizada
    res.setHeader(
      'Cache-Control',
      isDefault ? 'public, max-age=300' : 'public, max-age=86400, immutable',
    );
    res.sendFile(filePath);
  }

  private getDefaultLogo(variant: Variant): string | null {
    // Fallback pra arquivos do frontend/public (servidos quando empresa nao tem logo).
    // Mapeia variante pra arquivo correspondente.
    const map: Record<Variant, string> = {
      'favicon-32': 'favicon.svg',
      'icon-192': 'icons/icon-192.png',
      'icon-512': 'icons/icon-512.png',
      'apple-touch': 'apple-touch-icon.png',
      'og': 'icons/icon-512.png', // melhor temos por padrao
    };
    const candidate = path.join(FRONTEND_PUBLIC, map[variant]);
    return fs.existsSync(candidate) ? candidate : null;
  }

  /**
   * Resolve slug -> tenant + company. Retorna null se tenant nao existe ou esta cancelado.
   */
  private async resolveTenant(slug: string): Promise<{
    tenant: { slug: string; name: string; schemaName: string };
    company: { id: string; name: string; tradeName: string | null; logoUrl: string | null } | null;
  } | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { slug: true, name: true, schemaName: true, status: true },
    });
    if (!tenant) return null;
    if (tenant.status === 'CANCELLED') return null;

    // Busca Company no schema do tenant
    try {
      const tenantClient = this.prisma._getTenantClient(tenant.schemaName);
      const company = await tenantClient.company.findFirst({
        where: { deletedAt: null },
        select: { id: true, name: true, tradeName: true, logoUrl: true },
      });
      return { tenant, company };
    } catch (err) {
      this.logger.warn(`Falha buscando Company do tenant ${slug}: ${(err as Error).message}`);
      return { tenant, company: null };
    }
  }
}
