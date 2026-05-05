import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const LOGO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const LOGO_MAX_SIZE = 5 * 1024 * 1024; // 5MB

// v1.10.16: variantes geradas automaticamente ao fazer upload da logo.
// Servidas pelo endpoint publico /api/public/tenant/:slug/logo/:variant
// pra previews social (og:image), favicon, apple-touch-icon, PWA icons.
const LOGO_VARIANTS = [
  { name: 'favicon-32', size: 32, fit: 'contain' as const },
  { name: 'icon-192', size: 192, fit: 'contain' as const },
  { name: 'icon-512', size: 512, fit: 'contain' as const },
  { name: 'apple-touch', size: 180, fit: 'contain' as const },
  // og:image precisa ser 1200x630 (proporcao 1.91:1) — logo centralizada com fundo branco
  { name: 'og', width: 1200, height: 630, fit: 'contain' as const },
];

const ALLOWED_FIELDS: (keyof UpdateCompanyDto)[] = [
  'name', 'tradeName', 'cnpj', 'ie', 'im',
  'phone', 'email',
  'cep', 'addressStreet', 'addressNumber', 'addressComp',
  'neighborhood', 'city', 'state',
  'ownerName', 'ownerCpf', 'ownerPhone', 'ownerEmail',
  'evalGestorWeight', 'evalClientWeight', 'evalMinRating',
  'timezone', 'businessHours',
];

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly whatsApp?: WhatsAppService,
  ) {}

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async update(id: string, body: UpdateCompanyDto, callerCompanyId: string) {
    if (id !== callerCompanyId) {
      throw new ForbiddenException('Acesso negado a outra empresa');
    }

    // If company already has CNPJ, don't allow changing it
    const existing = await this.prisma.company.findUnique({
      where: { id },
      select: { cnpj: true },
    });

    const data: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        // Block CNPJ change if already set
        if (key === 'cnpj' && existing?.cnpj) continue;
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  remove(id: string, callerCompanyId: string) {
    if (id !== callerCompanyId) {
      throw new ForbiddenException('Acesso negado a outra empresa');
    }
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /* ── Logo Upload ─────────────────────────────────────── */

  async uploadLogo(
    companyId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!LOGO_ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo nao permitido. Use JPEG, PNG ou WebP.');
    }
    if (file.size > LOGO_MAX_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Maximo: 5MB.');
    }

    // Reject if a logo already exists — user must remove first
    const company = await this.findOne(companyId);
    if (company.logoUrl) {
      throw new BadRequestException('Ja existe uma logo. Remova a atual antes de enviar outra.');
    }

    // Save new logo
    const ext = path.extname(file.originalname) || '.png';
    const fileName = `logo-${randomUUID()}${ext}`;
    const dirPath = path.join(UPLOAD_DIR, companyId);

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, fileName), file.buffer);

    const logoUrl = `/uploads/${companyId}/${fileName}`;

    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl },
    });

    // v1.10.16: gera variantes (favicon, icons PWA, og:image) em paralelo.
    // Sao usados pelo metadata dinamico em previews social, abas do navegador, PWA.
    this.generateLogoVariants(companyId, file.buffer).catch(err =>
      this.logger.warn(`Logo variants generation failed: ${err.message}`),
    );

    // Sync logo as WhatsApp profile picture (fire-and-forget)
    if (this.whatsApp) {
      this.whatsApp.syncProfilePicture(companyId).catch(err =>
        this.logger.warn(`WhatsApp profile picture sync failed: ${err.message}`),
      );
    }

    return { logoUrl };
  }

  /**
   * Gera variantes do logo em multiplos tamanhos (v1.10.16).
   *
   * Chamada apos upload pra produzir:
   *  - favicon-32.png (aba navegador)
   *  - apple-touch.png 180x180 (icone iOS)
   *  - icon-192.png e icon-512.png (PWA + Android)
   *  - og.png 1200x630 (Open Graph — preview WhatsApp/Facebook/Twitter)
   *
   * Salva em uploads/{companyId}/variants/{name}.png. Servidos pelo endpoint
   * publico /api/public/tenant/:slug/branding e /api/public/tenant/:slug/logo/:variant.
   *
   * og.png usa fundo branco com logo centralizada (proporcao 1.91:1) — exigencia
   * da Meta pra previews aparecerem corretamente.
   */
  private async generateLogoVariants(companyId: string, buffer: Buffer) {
    const variantsDir = path.join(UPLOAD_DIR, companyId, 'variants');
    fs.mkdirSync(variantsDir, { recursive: true });

    for (const variant of LOGO_VARIANTS) {
      try {
        const outputPath = path.join(variantsDir, `${variant.name}.png`);
        let pipeline = sharp(buffer);

        if ('size' in variant) {
          // Quadrado (favicon, apple-touch, icons PWA) — fundo transparente
          pipeline = pipeline.resize(variant.size, variant.size, {
            fit: variant.fit,
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          });
        } else {
          // og:image 1200x630 — fundo branco solido (Meta nao renderiza alpha)
          pipeline = pipeline.resize(variant.width, variant.height, {
            fit: variant.fit,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          });
        }

        await pipeline.png().toFile(outputPath);
      } catch (err) {
        this.logger.warn(
          `Falha gerando variante ${variant.name} pra ${companyId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Logo variants generated for company ${companyId}`);
  }

  async removeLogo(companyId: string) {
    const company = await this.findOne(companyId);
    if (company.logoUrl) {
      const safeName = path.basename(company.logoUrl);
      const filePath = path.join(UPLOAD_DIR, companyId, safeName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // v1.10.16: limpa variantes geradas (favicon, icons PWA, og:image)
    const variantsDir = path.join(UPLOAD_DIR, companyId, 'variants');
    if (fs.existsSync(variantsDir)) {
      try {
        fs.rmSync(variantsDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(`Falha removendo variantes: ${(err as Error).message}`);
      }
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: null },
    });

    return { logoUrl: null };
  }

  /**
   * Backfill: gera variantes pra empresas que ja tem logoUrl mas nao tem variantes.
   * Util pra rodar 1x apos deploy v1.10.16 nas empresas existentes.
   */
  async ensureLogoVariants(companyId: string): Promise<boolean> {
    const company = await this.findOne(companyId);
    if (!company.logoUrl) return false;

    const variantsDir = path.join(UPLOAD_DIR, companyId, 'variants');
    const ogPath = path.join(variantsDir, 'og.png');
    if (fs.existsSync(ogPath)) return false; // ja tem

    const safeName = path.basename(company.logoUrl);
    const originalPath = path.join(UPLOAD_DIR, companyId, safeName);
    if (!fs.existsSync(originalPath)) return false;

    const buffer = fs.readFileSync(originalPath);
    await this.generateLogoVariants(companyId, buffer);
    return true;
  }

  async updateLogoDimensions(companyId: string, logoWidth: number, logoHeight: number) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { logoWidth, logoHeight },
    });
  }

  /* ── Fiscal Module ─────────────────────────────────── */

  async getFiscalModule(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { fiscalEnabled: true },
    });
    return { fiscalEnabled: company?.fiscalEnabled ?? false };
  }

  async toggleFiscalModule(companyId: string, fiscalEnabled: boolean) {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { fiscalEnabled },
    });
    return { fiscalEnabled };
  }

  /* ── Pool Module (Sprint 2 v1.10.31) ─────────────────── */

  async getPoolModule(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { poolModuleActive: true },
    });
    return { poolModuleActive: company?.poolModuleActive ?? false };
  }

  async togglePoolModule(companyId: string, poolModuleActive: boolean) {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { poolModuleActive },
    });
    return { poolModuleActive };
  }

  /* ── Fiscal Config (Tax Regime + Accountant) ─────── */

  async getFiscalConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxRegime: true,
        crt: true,
        cnae: true,
        suframa: true,
        fiscalProfile: true,
        contabilistName: true,
        contabilistCpf: true,
        contabilistCrc: true,
        contabilistCnpj: true,
        contabilistCep: true,
        contabilistPhone: true,
        contabilistEmail: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async updateFiscalConfig(companyId: string, data: Record<string, any>) {
    const FISCAL_FIELDS = [
      'taxRegime', 'crt', 'cnae', 'suframa', 'fiscalProfile',
      'contabilistName', 'contabilistCpf', 'contabilistCrc',
      'contabilistCnpj', 'contabilistCep', 'contabilistPhone', 'contabilistEmail',
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of FISCAL_FIELDS) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    // Auto-set CRT based on taxRegime
    if (updateData.taxRegime) {
      const regimeToCrt: Record<string, number> = { SN: 1, LP: 3, LR: 3 };
      updateData.crt = regimeToCrt[updateData.taxRegime as string] ?? 3;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getFiscalConfig(companyId);
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    return this.getFiscalConfig(companyId);
  }

  // ── System Config (JSON toggles) ──

  private readonly DEFAULT_SYSTEM_CONFIG = {
    os: {
      financialOnApproval: true,
      requirePhotoBeforeComplete: false,
      allowTechSelfAssign: false,
      allowZeroValueOs: false,
      allowEditConcluida: false,
      allowEditAprovada: false,
    },
    notifications: {
      emailOnNewOrder: true,
      emailOnStatusChange: true,
      pushEnabled: true,
    },
    financial: {
      autoGenerateReceivable: true,
      autoGeneratePayable: true,
      defaultDueDays: 30,
      showBaixaCartoes: false,
      lockAccountOnReceive: true,
      lockPlanOnReceive: true,
      autoReconciliation: false,
      allowDeleteEntry: false,
    },
    evaluation: {
      requireGestorApproval: true,
      sendClientEvalLink: true,
    },
    quotes: {
      autoSendOnSave: true,
      showProductValue: true,
      showPartnerQuotes: true,
    },
    clt: {
      enabled: false,
      alertMealBreak4h: true,
      alertJourney8h: true,
      alertOvertime: true,
      alertInterjourneyInterval: true,
      journeyHoursDaily: 8,
      mealBreakMinMinutes: 60,
    },
    pdf: {
      osLayout: 1,
    },
    nfse: {
      infComplementaresTemplate: '',
    },
  };

  async getSystemConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    // Merge defaults with stored config
    const stored = (company?.systemConfig as Record<string, any>) || {};
    return this.mergeDeep(this.DEFAULT_SYSTEM_CONFIG, stored);
  }

  async updateSystemConfig(companyId: string, data: Record<string, any>) {
    const current = await this.getSystemConfig(companyId);
    const merged = this.mergeDeep(current, data);
    await this.prisma.company.update({
      where: { id: companyId },
      data: { systemConfig: merged as any },
    });
    return merged;
  }

  private mergeDeep(target: any, source: any): any {
    const output = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.mergeDeep(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }
}
