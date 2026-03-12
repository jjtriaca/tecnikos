import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';

/**
 * Public endpoints for document verification during signup.
 * No authentication required — secured by unique session tokens.
 */
@Controller('public/saas')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a verification session after signup.
   * Returns token for QR code URL.
   */
  @Public()
  @Post('create-verification')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createSession(@Body('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId é obrigatório');
    }
    const result = await this.verificationService.createSession(tenantId);
    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    return {
      ...result,
      verifyUrl: `${baseUrl}/verify/${result.token}`,
    };
  }

  /**
   * Get full session data (for initial load on verify page).
   */
  @Public()
  @Get('verification/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getSession(@Param('token') token: string) {
    return this.verificationService.getSessionByToken(token);
  }

  /**
   * Lightweight status endpoint for polling.
   */
  @Public()
  @Get('verification/:token/status')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getStatus(@Param('token') token: string) {
    return this.verificationService.getSessionStatus(token);
  }

  /**
   * Resubmit documents after rejection.
   * Creates a new session from a rejected one and returns new token.
   */
  @Public()
  @Post('verification/:token/resubmit')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resubmit(@Param('token') token: string) {
    const result = await this.verificationService.resubmitFromRejected(token);
    const baseUrl = process.env.FRONTEND_URL || 'https://tecnikos.com.br';
    return {
      ...result,
      verifyUrl: `${baseUrl}/verify/${result.token}`,
    };
  }

  /**
   * Upload a single document file.
   * type: cnpjCard | docFront | docBack | selfieFar | selfieMedium | selfieClose
   */
  @Public()
  @Post('verification/:token/upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('token') token: string,
    @UploadedFile() file: any,
    @Body('type') type: string,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo é obrigatório');
    }
    if (!type) {
      throw new BadRequestException('Tipo do documento é obrigatório');
    }
    return this.verificationService.uploadDocument(token, type, file);
  }

  /**
   * Get tenant's verification status (authenticated — uses req.tenantId).
   * Called by the frontend to show banners and block features.
   */
  @Get('tenant-verification-status')
  @Public() // Public route but needs tenantId from middleware
  async getTenantVerificationStatus(@Req() req: Request) {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return { status: null };
    }

    const session = await this.prisma.verificationSession.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return { status: null };
    }

    return {
      status: session.reviewStatus, // PENDING | APPROVED | REJECTED
      rejectionReason: session.rejectionReason,
      token: session.token, // for re-upload redirect
      uploadComplete: session.uploadComplete,
      uploadedCount: session.uploadedCount,
      createdAt: session.createdAt,
    };
  }
}
