import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PDF_MIME = ['application/pdf'];
const SESSION_EXPIRY_HOURS = 72;

const DOC_TYPES = ['cnpjCard', 'docFront', 'docBack', 'selfieFar', 'selfieMedium', 'selfieClose'] as const;
type DocType = typeof DOC_TYPES[number];

/** Map DocType to the corresponding VerificationSession URL field */
const DOC_URL_FIELD: Record<DocType, string> = {
  cnpjCard: 'cnpjCardUrl',
  docFront: 'docFrontUrl',
  docBack: 'docBackUrl',
  selfieFar: 'selfieFarUrl',
  selfieMedium: 'selfieMediumUrl',
  selfieClose: 'selfieCloseUrl',
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new verification session for a tenant.
   * Returns token for the public verification URL.
   */
  async createSession(tenantId: string): Promise<{
    sessionId: string;
    token: string;
    expiresAt: Date;
  }> {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    // Check for existing active session (PENDING only — rejected sessions allow re-creation)
    const existing = await this.prisma.verificationSession.findFirst({
      where: {
        tenantId,
        expiresAt: { gt: new Date() },
        reviewStatus: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return {
        sessionId: existing.id,
        token: existing.token,
        expiresAt: existing.expiresAt,
      };
    }

    // Reset tenant status back to PENDING_VERIFICATION if it was rejected
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'PENDING_VERIFICATION' },
    });

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    const session = await this.prisma.verificationSession.create({
      data: {
        tenantId,
        token,
        expiresAt,
      },
    });

    this.logger.log(`Verification session created for tenant ${tenantId}: ${session.id}`);

    return {
      sessionId: session.id,
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Get session by token (for public pages).
   * Returns session data without internal fields.
   */
  async getSessionByToken(token: string) {
    const session = await this.prisma.verificationSession.findUnique({
      where: { token },
      include: {
        tenant: {
          select: { name: true, cnpj: true, responsibleName: true },
        },
      },
    });

    if (!session) throw new NotFoundException('Sessão não encontrada');

    return {
      sessionId: session.id,
      tenantName: session.tenant.name,
      responsibleName: session.tenant.responsibleName,
      cnpjCardUrl: session.cnpjCardUrl,
      docFrontUrl: session.docFrontUrl,
      docBackUrl: session.docBackUrl,
      selfieFarUrl: session.selfieFarUrl,
      selfieMediumUrl: session.selfieMediumUrl,
      selfieCloseUrl: session.selfieCloseUrl,
      uploadedCount: session.uploadedCount,
      uploadComplete: session.uploadComplete,
      reviewStatus: session.reviewStatus,
      rejectionReason: session.rejectionReason,
      expired: session.expiresAt < new Date(),
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Lightweight status for polling (minimal data).
   */
  async getSessionStatus(token: string) {
    const session = await this.prisma.verificationSession.findUnique({
      where: { token },
      select: {
        uploadedCount: true,
        uploadComplete: true,
        reviewStatus: true,
        expiresAt: true,
        cnpjCardUrl: true,
        docFrontUrl: true,
        docBackUrl: true,
        selfieFarUrl: true,
        selfieMediumUrl: true,
        selfieCloseUrl: true,
      },
    });

    if (!session) throw new NotFoundException('Sessão não encontrada');

    return {
      uploadedCount: session.uploadedCount,
      uploadComplete: session.uploadComplete,
      reviewStatus: session.reviewStatus,
      expired: session.expiresAt < new Date(),
      documents: {
        cnpjCard: !!session.cnpjCardUrl,
        docFront: !!session.docFrontUrl,
        docBack: !!session.docBackUrl,
        selfieFar: !!session.selfieFarUrl,
        selfieMedium: !!session.selfieMediumUrl,
        selfieClose: !!session.selfieCloseUrl,
      },
    };
  }

  /**
   * Create a new session from a rejected one.
   * Finds the tenant from the old token and creates a fresh session.
   */
  async resubmitFromRejected(oldToken: string): Promise<{
    sessionId: string;
    token: string;
    expiresAt: Date;
  }> {
    const oldSession = await this.prisma.verificationSession.findUnique({
      where: { token: oldToken },
    });

    if (!oldSession) throw new NotFoundException('Sessão não encontrada');
    if (oldSession.reviewStatus !== 'REJECTED') {
      throw new BadRequestException('Apenas sessões rejeitadas podem ser reenviadas.');
    }

    // Create a new session for the same tenant
    return this.createSession(oldSession.tenantId);
  }

  /**
   * Upload a document file to a verification session.
   */
  async uploadDocument(
    token: string,
    type: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    // Validate doc type
    if (!DOC_TYPES.includes(type as DocType)) {
      throw new BadRequestException(
        `Tipo de documento inválido. Use: ${DOC_TYPES.join(', ')}`,
      );
    }
    const docType = type as DocType;

    // Validate file
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo é obrigatório');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo: 10MB.');
    }

    // CNPJ card can be PDF or image, rest must be image
    const allowedMime = docType === 'cnpjCard'
      ? [...ALLOWED_IMAGE_MIME, ...ALLOWED_PDF_MIME]
      : ALLOWED_IMAGE_MIME;

    if (!allowedMime.includes(file.mimetype)) {
      throw new BadRequestException(
        docType === 'cnpjCard'
          ? 'Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF.'
          : 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.',
      );
    }

    // Get session
    const session = await this.prisma.verificationSession.findUnique({
      where: { token },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Sessão expirada. Inicie o cadastro novamente.');
    }
    if (session.reviewStatus !== 'PENDING') {
      throw new BadRequestException('Esta verificação já foi processada.');
    }

    // Save file to disk
    const ext = path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const fileName = `${docType}_${randomUUID()}${ext}`;
    const dirPath = path.join(UPLOAD_DIR, 'verification', session.id);

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, fileName), file.buffer);

    const url = `/uploads/verification/${session.id}/${fileName}`;

    // Check if this doc type was already uploaded (replacing)
    const urlField = DOC_URL_FIELD[docType];
    const currentUrl = (session as any)[urlField];
    const wasAlreadyUploaded = !!currentUrl;

    // Delete old file if replacing
    if (wasAlreadyUploaded && currentUrl) {
      const oldFilePath = path.join(UPLOAD_DIR, currentUrl.replace('/uploads/', ''));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Count how many docs will be uploaded after this update
    const docFields = Object.values(DOC_URL_FIELD);
    let uploadedCount = 0;
    for (const field of docFields) {
      if (field === urlField) {
        uploadedCount++; // This one is being uploaded now
      } else if ((session as any)[field]) {
        uploadedCount++;
      }
    }

    const uploadComplete = uploadedCount === DOC_TYPES.length;

    // Update session
    await this.prisma.verificationSession.update({
      where: { id: session.id },
      data: {
        [urlField]: url,
        uploadedCount,
        uploadComplete,
      },
    });

    this.logger.log(
      `Verification upload: ${docType} for session ${session.id} (${uploadedCount}/${DOC_TYPES.length})`,
    );

    return {
      success: true,
      type: docType,
      url,
      uploadedCount,
      uploadComplete,
    };
  }
}
