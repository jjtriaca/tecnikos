import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

@Injectable()
export class UploadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upload a file for a service order.
   * Saves to local disk (MVP). Ready for S3 swap later.
   */
  async upload(
    serviceOrderId: string,
    companyId: string,
    uploadedBy: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    type: string,
    stepOrder?: number,
    blockId?: string,
  ) {
    // Validate
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo: 10MB.');
    }

    // Verify OS belongs to company
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, deletedAt: null },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId) throw new ForbiddenException('Acesso negado');

    // Save file
    const ext = path.extname(file.originalname) || '.jpg';
    const fileName = `${randomUUID()}${ext}`;
    const dirPath = path.join(UPLOAD_DIR, companyId, serviceOrderId);

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, fileName), file.buffer);

    const url = `/uploads/${companyId}/${serviceOrderId}/${fileName}`;

    // Save to DB
    return this.prisma.attachment.create({
      data: {
        serviceOrderId,
        companyId,
        type,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url,
        uploadedBy,
        stepOrder,
        blockId,
      },
    });
  }

  /**
   * List attachments for a service order.
   */
  async findByOrder(serviceOrderId: string, companyId: string) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, deletedAt: null },
    });
    if (!so) throw new NotFoundException('OS não encontrada');
    if (so.companyId !== companyId) throw new ForbiddenException('Acesso negado');

    return this.prisma.attachment.findMany({
      where: { serviceOrderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Delete an attachment.
   */
  async remove(id: string, companyId: string) {
    const att = await this.prisma.attachment.findFirst({
      where: { id },
    });
    if (!att) throw new NotFoundException('Anexo não encontrado');
    if (att.companyId !== companyId) throw new ForbiddenException('Acesso negado');

    // Delete DB record first, then remove file from disk
    const deleted = await this.prisma.attachment.delete({ where: { id } });

    const filePath = path.join(UPLOAD_DIR, att.companyId, att.serviceOrderId, path.basename(att.url));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return deleted;
  }
}
