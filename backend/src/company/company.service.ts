import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const LOGO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const LOGO_MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

    // Sync logo as WhatsApp profile picture (fire-and-forget)
    if (this.whatsApp) {
      this.whatsApp.syncProfilePicture(companyId).catch(err =>
        this.logger.warn(`WhatsApp profile picture sync failed: ${err.message}`),
      );
    }

    return { logoUrl };
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

    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: null },
    });

    return { logoUrl: null };
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
