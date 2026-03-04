import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
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
  'commissionBps',
  'evalGestorWeight', 'evalClientWeight', 'evalMinRating',
];

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

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

    const data: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
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

    // Remove old logo if exists
    const company = await this.findOne(companyId);
    if (company.logoUrl) {
      const safeName = path.basename(company.logoUrl);
      const oldPath = path.join(UPLOAD_DIR, companyId, safeName);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
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
}
